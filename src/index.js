// dr-player public API entry. Stage 6 (2026-05-23) — Player.set(input, value)
// + полный набор out-events. emit-event нода в IA editor (deepreview side)
// при срабатывании зовёт `graphApi.emitOut(name, payload)` → плеер emit'ит
// `event:<name>` к listener'ам разработчика через `player.on('event:<name>', cb)`.
//
// Stages эпика dr-player-v1:
//   Stage 1 ✅ extract dr-runtime в deepreview.
//   Stage 2 ✅ создание Yanflint/dr-player + skeleton.
//   Stage 3 ✅ Player.load (.dr.zip parse + asset blob URLs).
//   Stage 4 ✅ mount() Shadow DOM + static render.
//   Stage 5 ✅ runtime (rAF + IntersectionObserver auto-pause).
//   Stage 6 ✅ Player.set + полный набор out-events + emit-event nodе ← мы здесь.
//   Stage 7 → editor integration (Preview-mode внутри IA-слоя через dr-player).
//   Stage 8 → CDN publish + npm + docs для ok.ru.

import JSZip from './jszip.js';
import lottie from './lottie.js';
import * as runtime from './dr-runtime.js';
import { createDrPlayerElement } from './customElement.js';
import { createPlayAction } from './playAction.js';

const STAGE = 6;

// Современная major-версия формата `.dr.zip` которую этот плеер понимает.
// Spec: формат запинан на "1.0" в M1 эпика interactive-animations-v1
// (см. js/project/export.js → FORMAT_VERSION в deepreview). Любой
// `formatVersion` с другой major-частью — `error` event FORMAT_VERSION_MISMATCH.
const SUPPORTED_MAJOR = 1;

// Codes для `error` event payload (enum).
export const ERROR_CODES = Object.freeze({
  LOAD_FAILED: 'LOAD_FAILED',
  PARSE_FAILED: 'PARSE_FAILED',
  FORMAT_VERSION_MISMATCH: 'FORMAT_VERSION_MISMATCH',
  MOUNT_FAILED: 'MOUNT_FAILED',
  RUNTIME_ERROR: 'RUNTIME_ERROR',
});

/**
 * Извлечь major-часть из строки `formatVersion` (`"1.0"` → 1, `"2.3"` → 2).
 * Возвращает NaN если parse не удался — caller проверяет `Number.isFinite`.
 *
 * @param {unknown} version
 * @returns {number}
 */
function parseMajor(version) {
  if (typeof version !== 'string') return NaN;
  const m = /^(\d+)\./.exec(version);
  if (!m) return NaN;
  return Number(m[1]);
}

/**
 * Создать Error с дополнительными полями `code` + `cause` (тот же shape что
 * `error` event payload). Caller использует через `await player.load()` —
 * try/catch.
 *
 * @param {string} code
 * @param {string} message
 * @param {unknown} [cause]
 * @returns {Error & { code: string, cause?: unknown }}
 */
function makeError(code, message, cause) {
  /** @type {any} */
  const err = new Error(message);
  err.code = code;
  if (cause !== undefined) err.cause = cause;
  return err;
}

export class Player {
  /**
   * @param {{ autoPause?: boolean }} [opts]
   */
  constructor(opts = {}) {
    this._opts = { autoPause: true, ...opts };
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
    this._mounted = false;
    this._loaded = false;
    /**
     * @type {null | {
     *   snap: import('./dr-runtime.js').DeserializedIaSnapshot,
     *   manifest: any,
     *   blobUrls: Map<string, string>,
     *   triggers: string[],
     *   inputs: any[],
     * }}
     */
    this._state = null;
    /**
     * Mount-state. Заполняется в `mount(el)`, очищается в `unmount()`.
     *
     * Stage 6 (2026-05-23): добавлен `inputsState` — Map значений inputs API.
     * `player.set(input, value)` пишет сюда; будущие input-ноды графа (Круг 5+
     * IA эпика) будут читать через `graphApi.getInput`. Сейчас value хранится,
     * но не консумируется графом — это «прокладка», чтобы разработчик ok.ru
     * мог start'овать использовать API заранее (контракт стабилен, поведение
     * расширяется без breaking).
     *
     * @type {null | {
     *   parentEl: HTMLElement,
     *   drPlayerEl: HTMLElement & { _drStage: HTMLDivElement },
     *   lottieInstances: Array<import('./lottie.js').LottieAnimationItem>,
     *   videos: HTMLVideoElement[],
     *   runtime: any,
     *   byId: Map<string, any>,
     *   nodesById: Map<string, HTMLElement>,
     *   playByLayerId: Map<string, (mode: 'once'|'loop') => void>,
     *   stopByLayerId: Map<string, () => void>,
     *   childrenByParent: Map<string, string[]>,
     *   actionsMap: Map<string, any>,
     *   sprites: Array<any>,
     *   spriteRafId: number,
     *   spriteLastTs: number,
     *   runningActions: Set<() => void>,
     *   observer: IntersectionObserver | null,
     *   playing: boolean,
     *   inputsState: Map<string, any>,
     * }}
     */
    this._mount = null;
    console.log(`[dr-player] Stage ${STAGE} initialised`);
  }

  /**
   * Загрузить `.dr.zip` (URL или Blob), распаковать, deserialize cfg, выдать
   * каждому asset'у `blob:` URL. После успеха — emit `loaded` event с payload
   * `{ layerCount, triggers, inputs }` (опциональный `duration` — резерв
   * V1.x).
   *
   * Повторный вызов `load()` — cleanup'ит предыдущий state (revoke blob URLs)
   * и загружает заново. Идемпотентный API для разработчика.
   *
   * @param {string | Blob} input URL строкой или Blob.
   * @returns {Promise<void>}
   */
  async load(input) {
    if (this._state) this._cleanupState();
    this._loaded = false;

    let arrayBuffer;
    try {
      arrayBuffer = await this._readInputToArrayBuffer(input);
    } catch (cause) {
      const err = makeError(
        ERROR_CODES.LOAD_FAILED,
        cause instanceof Error ? cause.message : String(cause),
        cause
      );
      this._emit('error', { code: err.code, message: err.message, cause });
      throw err;
    }

    let zip;
    let manifestJson;
    let cfgJson;
    /** @type {Map<string, string>} */
    const blobUrls = new Map();

    try {
      zip = await JSZip.loadAsync(arrayBuffer);
      const manifestFile = zip.file('manifest.json');
      if (!manifestFile) {
        throw new Error('manifest.json не найден в .dr.zip');
      }
      const cfgFile = zip.file('cfg.json');
      if (!cfgFile) {
        throw new Error('cfg.json не найден в .dr.zip');
      }
      manifestJson = await manifestFile.async('string');
      cfgJson = await cfgFile.async('string');

      // Распаковать все assets/* в blob: URLs.
      const assetFiles = zip.file(/^assets\//);
      for (const entry of assetFiles) {
        if (entry.dir) continue;
        const blob = await entry.async('blob');
        const url = URL.createObjectURL(blob);
        blobUrls.set(entry.name, url);
      }
    } catch (cause) {
      this._revokeUrls(blobUrls);
      const err = makeError(
        ERROR_CODES.PARSE_FAILED,
        cause instanceof Error ? cause.message : String(cause),
        cause
      );
      this._emit('error', { code: err.code, message: err.message, cause });
      throw err;
    }

    // Validate manifest.formatVersion (major часть).
    let manifest;
    try {
      manifest = JSON.parse(manifestJson);
    } catch (cause) {
      this._revokeUrls(blobUrls);
      const err = makeError(
        ERROR_CODES.PARSE_FAILED,
        `manifest.json не парсится как JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause
      );
      this._emit('error', { code: err.code, message: err.message, cause });
      throw err;
    }

    const major = parseMajor(manifest && manifest.formatVersion);
    if (!Number.isFinite(major) || major !== SUPPORTED_MAJOR) {
      this._revokeUrls(blobUrls);
      const got = manifest && manifest.formatVersion;
      const err = makeError(
        ERROR_CODES.FORMAT_VERSION_MISMATCH,
        `Плеер поддерживает formatVersion "${SUPPORTED_MAJOR}.x", получен "${got}". Обновите dr-player.`
      );
      this._emit('error', { code: err.code, message: err.message });
      throw err;
    }

    // Parse cfg.json + deserialize.
    let cfg;
    try {
      cfg = JSON.parse(cfgJson);
    } catch (cause) {
      this._revokeUrls(blobUrls);
      const err = makeError(
        ERROR_CODES.PARSE_FAILED,
        `cfg.json не парсится как JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause
      );
      this._emit('error', { code: err.code, message: err.message, cause });
      throw err;
    }

    const snap = runtime.deserializeIaSnapshot(cfg);

    // Distribute blob URLs в snap.library. AssetRecord.payload.dataURL после
    // exporter'а содержит "assets/<id>.<ext>" — заменяем на blob: URL.
    // Если asset в manifest упомянут (через library), но соответствующего
    // файла в zip нет — оставляем path как был (graceful: Stage 4 render
    // покажет broken placeholder, плеер не падает).
    for (const [, rec] of snap.library) {
      if (!rec || !rec.payload) continue;
      const path = rec.payload.dataURL;
      if (typeof path !== 'string' || !path.startsWith('assets/')) continue;
      const url = blobUrls.get(path);
      if (url) rec.payload.dataURL = url;
    }

    const triggers = Array.isArray(manifest.triggers) ? manifest.triggers.slice() : [];
    const inputs = Array.isArray(manifest.inputs) ? manifest.inputs.slice() : [];

    this._state = { snap, manifest, blobUrls, triggers, inputs };
    this._loaded = true;

    this._emit('loaded', {
      layerCount: snap.layers.length,
      triggers,
      inputs,
    });
  }

  /**
   * Mount Player в `el` (страница хоста — ok.ru / любой сайт). Создаёт
   * `<dr-player>` custom element (closed Shadow DOM, изоляция стилей +
   * DOM), render'ит первый кадр всех слоёв из загруженного snapshot'а
   * (PNG / Lottie / video / solid / text). После render'а Stage 5
   * стартует runtime:
   *   • compileEventGraph + compileStarts + compileTriggers через
   *     dr-runtime — собирает action runner pipeline.
   *   • Sprite RAF-loop для PNG sprite слоёв.
   *   • IntersectionObserver auto-pause (порог 10%) — когда вне viewport
   *     pause + Lottie.pause + video.pause; обратно — resume.
   *   • compileStarts auto-fire — синхронно ДО первой rAF tick'а, чтобы
   *     scene не «мелькала» idle перед NODE_START → Action.
   *
   * Опция `autoPause: false` (в constructor'е) — пропускает observer,
   * плеер играет сразу после mount'а.
   *
   * Sync API: при возврате DOM уже attached. Lottie SVG-render появляется
   * через ~1 frame после mount (нужен async fetch JSON ассета) — это
   * нормальный pattern для Lottie web, тесты могут ждать через
   * `vi.waitFor` или mock'ать `lottie.loadAnimation`.
   *
   * @param {HTMLElement} el Контейнер на странице хоста.
   * @returns {void}
   * @throws Error если `el` не HTMLElement или Player не в loaded state.
   *   Параллельно emit'ит `error` event с code `MOUNT_FAILED`.
   */
  mount(el) {
    if (!el || typeof el.appendChild !== 'function') {
      const err = makeError(
        ERROR_CODES.MOUNT_FAILED,
        'Player.mount: ожидался HTMLElement как первый аргумент.'
      );
      this._emit('error', { code: err.code, message: err.message });
      throw err;
    }
    if (!this._loaded || !this._state) {
      const err = makeError(
        ERROR_CODES.MOUNT_FAILED,
        'Player.mount вызван до Player.load — нет snapshot для рендера.'
      );
      this._emit('error', { code: err.code, message: err.message });
      throw err;
    }
    if (this._mount) {
      // Idempotent: unmount предыдущий attach перед новым mount'ом.
      this.unmount();
    }

    const { snap } = this._state;
    const canvasW = (snap.canvas && Number(snap.canvas.width))  || 200;
    const canvasH = (snap.canvas && Number(snap.canvas.height)) || 200;

    const drPlayerEl = createDrPlayerElement();
    drPlayerEl.style.width  = canvasW + 'px';
    drPlayerEl.style.height = canvasH + 'px';

    /** @type {Map<string, any>} */
    const byId = new Map();
    /** @type {Map<string, string[]>} */
    const childrenByParent = new Map();
    for (const L of snap.layers) {
      if (!L || !L.id) continue;
      byId.set(L.id, L);
      if (L.parentId) {
        if (!childrenByParent.has(L.parentId)) childrenByParent.set(L.parentId, []);
        childrenByParent.get(L.parentId).push(L.id);
      }
    }

    /** @type {Array<import('./lottie.js').LottieAnimationItem>} */
    const lottieInstances = [];
    /** @type {HTMLVideoElement[]} */
    const videos = [];
    /** @type {Map<string, HTMLElement>} */
    const nodesById = new Map();
    /** @type {Map<string, (mode: 'once'|'loop') => void>} */
    const playByLayerId = new Map();
    /** @type {Map<string, () => void>} */
    const stopByLayerId = new Map();
    /** @type {Array<any>} */
    const sprites = [];

    /**
     * Контекст для type-specific render helpers. Все Maps/lists/refs
     * заполняются in-place. Stage 4 → Stage 5: добавлены sprites + per-layer
     * play/stop колбэки.
     */
    const renderCtx = {
      lottieInstances, videos, nodesById,
      playByLayerId, stopByLayerId, sprites,
    };

    try {
      snap.layers.forEach((L, idx) => {
        if (!L || !L.id) return;
        const layerEl = this._renderLayer(L, idx, byId, snap.library, renderCtx);
        if (layerEl) {
          drPlayerEl._drStage.appendChild(layerEl);
          nodesById.set(L.id, layerEl);
        }
      });
    } catch (cause) {
      // Если render-loop упал — cleanup частично созданных Lottie / video
      // и сообщаем caller'у. Это редкий случай (битый snapshot).
      for (const inst of lottieInstances) {
        try { inst.destroy(); } catch (_) {}
      }
      const err = makeError(
        ERROR_CODES.MOUNT_FAILED,
        cause instanceof Error ? cause.message : String(cause),
        cause
      );
      this._emit('error', { code: err.code, message: err.message, cause });
      throw err;
    }

    el.appendChild(drPlayerEl);

    // ---- Stage 5: setup runtime + action runner + observer ----

    /** @type {Set<() => void>} */
    const runningActions = new Set();

    const playActionApi = createPlayAction({
      actionsMap: snap.actions,
      byId,
      nodesById,
      playByLayerId,
      stopByLayerId,
      childrenByParent,
      applyTransformToNode: (node, L) => this._applyTransformToNode(node, L, byId),
      sampleTrack: runtime.sampleTrack,
      blendValue: runtime.blendValue,
      applyChannelValueTo: runtime.applyChannelValueTo,
      getChannelOrNull: runtime.getChannelOrNull,
      getRunningStops: () => runningActions,
    });

    const rt = runtime.createRuntime();

    // Stage 6 (2026-05-23): inputsState — store значений для Player.set'а.
    // Заполняется через player.set(input, value); getInput предоставлен через
    // graphApi для будущих input-нод графа (Круг 5+ IA эпика).
    /** @type {Map<string, any>} */
    const inputsState = new Map();

    // compileGraph collects transitions / triggers / starts из snap.eventGraph.
    // routeIaTrigger пока null — nested IA-слои внутри dr-player Stage 5 не
    // поддерживаются (это Stage 6/7 — потребует instantiation вложенных
    // Player'ов для each ia-layer).
    //
    // Stage 6 (2026-05-23): emitOut пробрасывает (name, payload) от emit-event
    // ноды наружу как `event:<name>` к listener'ам разработчика.
    // getInput — read-only геттер из inputsState для будущих input-нод графа.
    const graphApi = {
      playByLayerId,
      addCycleListener: runtime.addCycleListener,
      playAction: playActionApi.playAction,
      routeIaTrigger: null,
      emitOut: (/** @type {string} */ name, /** @type {any} */ payload) => {
        if (typeof name !== 'string' || !name) return;
        this._emit(`event:${name}`, { payload });
      },
      getInput: (/** @type {string} */ name) => inputsState.get(name),
    };

    // compileEventGraph: layer-source transitions. dr-player Stage 5 пока
    // не подключает click listeners на слои — transitions зарегистрируются
    // для будущего Stage 6 (там Player.trigger будет уметь fire transition
    // по layerId), и для editor-integration Stage 7.
    try {
      const transitions = runtime.compileEventGraph(snap.eventGraph, graphApi);
      for (const t of transitions) rt.registerTransition(t);
    } catch (err) {
      console.error('[dr-player] compileEventGraph failed:', err);
    }

    // compileTriggers: triggerByName handler'ы — это основа Player.trigger(name).
    try {
      const triggers = runtime.compileTriggers(snap.eventGraph, graphApi);
      for (const t of triggers) rt.registerTrigger(t.name, t.fn);
    } catch (err) {
      console.error('[dr-player] compileTriggers failed:', err);
    }

    this._mount = {
      parentEl: el, drPlayerEl, lottieInstances, videos,
      runtime: rt,
      byId, nodesById, playByLayerId, stopByLayerId,
      childrenByParent, actionsMap: snap.actions,
      sprites, spriteRafId: 0, spriteLastTs: 0,
      runningActions,
      observer: null,
      playing: false,
      inputsState,
    };
    this._mounted = true;

    this._emit('mounted', { width: canvasW, height: canvasH });

    // compileStarts: auto-fire синхронно после `mounted` event. NODE_START —
    // entry-point'ы графа, стреляют сразу. Если autoPause включен, action'ы
    // продолжат tick'ать только когда widget попадает в viewport (sprite RAF /
    // action rAF проверяют `playing` через cancel/resume в _pause/_resume).
    try {
      const starts = runtime.compileStarts(snap.eventGraph, graphApi);
      for (const fire of starts) {
        try { fire(); } catch (err) { console.error('[dr-player] start fire failed:', err); }
      }
    } catch (err) {
      console.error('[dr-player] compileStarts failed:', err);
    }

    // IntersectionObserver или immediate resume в зависимости от опции.
    if (this._opts.autoPause && typeof IntersectionObserver === 'function') {
      this._startIntersectionObserver();
    } else {
      this._resume();
    }
  }

  /**
   * Unmount: cancel rAF (sprite + action runs), disconnect IntersectionObserver,
   * destroy Lottie instances, pause + reset video, удалить `<dr-player>` из
   * DOM хоста. Идемпотент — повторный вызов no-op. blob URLs НЕ revoke'ятся
   * здесь — это делает `destroy()` (caller может `mount → unmount → mount`
   * без re-load).
   *
   * @returns {void}
   */
  unmount() {
    if (!this._mount) return;
    const {
      parentEl, drPlayerEl, lottieInstances, videos,
      spriteRafId, observer, runningActions,
    } = this._mount;

    // Pause всё перед removeChild — это безопасно (rAF cancel'ы в _pause).
    this._pause();
    if (spriteRafId) {
      try { cancelAnimationFrame(spriteRafId); } catch (_) {}
    }
    // Cancel pending action runs (stopFn чистит rAF + locks).
    if (runningActions) {
      for (const stop of [...runningActions]) {
        try { stop(); } catch (_) {}
      }
      runningActions.clear();
    }
    if (observer) {
      try { observer.disconnect(); } catch (_) {}
    }
    for (const inst of lottieInstances) {
      try { inst.destroy(); } catch (_) {}
    }
    for (const vid of videos) {
      try {
        vid.pause();
        vid.removeAttribute('src');
        vid.load();
      } catch (_) {}
    }
    try {
      if (drPlayerEl.parentNode === parentEl) {
        parentEl.removeChild(drPlayerEl);
      }
    } catch (_) {}
    this._mount = null;
    this._mounted = false;
    this._emit('unmounted', {});
  }

  /**
   * Запустить trigger по имени. Срабатывает на Event-ноды с
   * sourceType='trigger' + triggerName в графе событий (через
   * compileTriggers → runtime.registerTrigger). Каждый совпавший handler
   * запускает свою subgraph-ветку: Action / Animation / Layer / Delay.
   *
   * Перед вызовом плеер должен быть mount'ed. Возвращает `true` если был
   * хотя бы один зарегистрированный handler на это имя — для UI feedback
   * («неизвестный триггер» если false).
   *
   * Side-effects: emit `trigger` event с `{ name, source: 'external' }`.
   *
   * @param {string} name Имя триггера (совпадение по строке).
   * @returns {boolean} true если был хотя бы один handler.
   */
  trigger(name) {
    if (typeof name !== 'string' || !name) return false;
    if (!this._mount) {
      console.warn('[dr-player] Player.trigger: вызван до mount() — игнорируется.');
      return false;
    }
    const matched = !!this._mount.runtime?.triggerByName?.(name);
    this._emit('trigger', { name, source: 'external' });
    return matched;
  }

  /**
   * Установить значение named input — public API для разработчика на хост-
   * стороне (например ok.ru — при scroll'е страницы или drag-handle widget'а
   * двигать input анимации). Stage 6 эпика dr-player-v1 (2026-05-23) — public
   * API контракт стабилен; реальная активация (input → channel value через
   * input-ноду графа) — в Кругах 5+ IA эпика.
   *
   * Контракт:
   * - До mount() — warning, no-op (без throw — разработчик может set'ить
   *   значения параллельно с `await load`, чтобы они применились при mount'е).
   *   В Stage 6 значение в этом случае теряется (mount создаёт свой
   *   inputsState с нуля). Это accept'ed compromise — set до mount редко
   *   нужен (real-world flow: load → mount → set по scroll).
   * - После mount() — value сохраняется в inputsState. Повторный set с тем
   *   же input — overwrite. Граф может читать через getInput (Круг 5+).
   * - Пустое имя input ('' / null / undefined) — игнорируется без throw.
   *
   * @param {string} input Имя input'а (string, non-empty).
   * @param {any} value Любое JSON-serializable значение (number / boolean /
   *   string / object). Type validation — отдельная задача input-нод графа.
   * @returns {void}
   */
  set(input, value) {
    if (typeof input !== 'string' || !input) return;
    if (!this._mount) {
      console.warn('[dr-player] Player.set: вызван до mount() — значение не сохранено.');
      return;
    }
    this._mount.inputsState.set(input, value);
  }

  on(event, cb) {
    if (typeof cb !== 'function') return;
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(cb);
  }

  off(event, cb) {
    const set = this._listeners.get(event);
    if (set) set.delete(cb);
  }

  destroy() {
    if (this._mount) {
      try { this.unmount(); } catch (_) {}
    }
    this._cleanupState();
    this._listeners.clear();
  }

  // ---- internal ----

  /**
   * Render одного слоя в `.dr-layer` div. Возвращает готовый element (без
   * вставки в DOM — это делает caller).
   *
   * Stage 5: добавлен `ctx` — mutable Maps для sprite state + per-layer
   * play/stop колбэков. После всех слоёв caller'ом обходится `ctx.sprites`
   * через RAF-loop, а `playByLayerId` / `stopByLayerId` подключены к
   * Action runner'у для media-trigger keyframe'ов.
   *
   * z-index по индексу `idx` в массиве layers (cfg порядок ↔ z-order,
   * симметрично previewMain).
   *
   * @param {any} L Layer-shape из snap.
   * @param {number} idx Индекс в snap.layers (для z-index).
   * @param {Map<string, any>} byId Резолвер для effectiveMatrix / effectiveOpacity.
   * @param {Map<string, any>} library AssetRecord Map (assetId → record).
   * @param {{
   *   lottieInstances: Array<import('./lottie.js').LottieAnimationItem>,
   *   videos: HTMLVideoElement[],
   *   nodesById: Map<string, HTMLElement>,
   *   playByLayerId: Map<string, (mode: 'once'|'loop') => void>,
   *   stopByLayerId: Map<string, () => void>,
   *   sprites: Array<any>,
   * }} ctx
   * @returns {HTMLElement | null}
   */
  _renderLayer(L, idx, byId, library, ctx) {
    if (L.hidden) {
      return null;
    }

    const node = document.createElement('div');
    node.className = 'dr-layer';
    node.dataset.id = L.id;

    const { w, h } = runtime.defaultVisualSize(L);
    if (w > 0) node.style.width  = w + 'px';
    if (h > 0) node.style.height = h + 'px';

    this._applyTransformToNode(node, L, byId);

    node.style.zIndex = String(1 + idx);

    // Type-specific content.
    const payload = this._payloadFor(L, library);
    const type = L.type;

    if (type === 'png') {
      this._renderPng(node, L, payload, ctx);
    } else if (type === 'lottie') {
      this._renderLottie(node, L, payload, ctx);
    } else if (type === 'video') {
      this._renderVideo(node, L, payload, ctx);
    } else if (type === 'solid') {
      this._renderSolid(node, L);
    } else if (type === 'text' || type === 'hint') {
      this._renderText(node, L);
    }
    // Unknown тип — пустой div (broken-placeholder). Не падаем.

    return node;
  }

  /**
   * Применить effective transform + opacity к DOM-ноде слоя. Используется
   * первый раз в _renderLayer + per-frame в Action runner через
   * `applyTransformToNode` callback (см. createPlayAction).
   *
   * @param {HTMLElement} node
   * @param {any} L
   * @param {Map<string, any>} byId
   */
  _applyTransformToNode(node, L, byId) {
    const getter = (/** @type {string} */ id) => byId.get(id) || null;
    const m = runtime.effectiveMatrix(L, getter, runtime.defaultVisualSize);
    node.style.transform = `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, ${m.e}, ${m.f})`;
    node.style.transformOrigin = '0 0';
    const op = runtime.effectiveOpacity(L, getter);
    if (op != null && op !== 1) {
      node.style.opacity = String(op);
    } else {
      node.style.opacity = '';
    }
  }

  /**
   * @param {any} L
   * @param {Map<string, any>} library
   * @returns {any} AssetRecord.payload или null.
   */
  _payloadFor(L, library) {
    if (!L || !L.assetId) return null;
    const rec = runtime.lookupAsset(library, L.assetId);
    return rec ? rec.payload : null;
  }

  /**
   * PNG слой — обычный image или sprite. Stage 5: для sprite создаём
   * state-объект в `ctx.sprites` (для общего RAF tick'а в _startSpriteRaf),
   * и регистрируем `playByLayerId(mode)` / `stopByLayerId()` колбэки для
   * Action runner'а (media-trigger каналы).
   *
   * @param {HTMLElement} node
   * @param {any} L
   * @param {any} payload
   * @param {any} ctx renderCtx — заполняем sprites + play/stop maps.
   */
  _renderPng(node, L, payload, ctx) {
    const src = (payload && payload.dataURL) || '';
    const sprCfg = L.sprite || null;
    const hasSprite = sprCfg && sprCfg.enabled;

    if (!hasSprite) {
      const img = document.createElement('img');
      img.alt = L.name || '';
      img.draggable = false;
      img.src = src;
      node.appendChild(img);
      return;
    }

    const origW = L._origW || L.w || 0;
    const origH = L._origH || L.h || 0;
    const frameW = sprCfg.frameW || origH || origW || 0;
    const frameH = sprCfg.frameH || origH || origW || 0;
    const start = Number.isFinite(sprCfg.startFrame) ? sprCfg.startFrame : 0;
    const end = Number.isFinite(sprCfg.endFrame) ? sprCfg.endFrame : start;
    const length = Math.max(1, end - start + 1);
    const fps = Number.isFinite(sprCfg.fps) ? sprCfg.fps : 24;
    const initialFrame = Number.isFinite(sprCfg.currentFrame) ? sprCfg.currentFrame : start;

    const wrapper = document.createElement('div');
    wrapper.style.width  = frameW + 'px';
    wrapper.style.height = frameH + 'px';
    wrapper.style.overflow = 'hidden';
    wrapper.style.position = 'relative';

    const img = document.createElement('img');
    img.alt = L.name || '';
    img.draggable = false;
    img.src = src;
    img.style.position = 'absolute';
    img.style.top  = '0';
    img.style.left = -(initialFrame * frameW) + 'px';

    wrapper.appendChild(img);

    if (L.w && L.h && (L.w !== origW || L.h !== origH)) {
      const scaleX = origW > 0 ? L.w / origW : 1;
      const scaleY = origH > 0 ? L.h / origH : 1;
      wrapper.style.transform = `scale(${scaleX}, ${scaleY})`;
      wrapper.style.transformOrigin = 'top left';
    }

    node.appendChild(wrapper);

    // Stage 5: sprite state + play/stop callbacks.
    const sprite = {
      layerId: L.id,
      img,
      frameW,
      fps,
      start,
      end,
      length,
      loop: !!L.loop,
      acc: 0,
      currentFrame: initialFrame,
      // По умолчанию sprite не играет — стартует через playByLayerId
      // (Action runner media-trigger) или auto при l.loop=true.
      playing: !!L.loop,
    };
    ctx.sprites.push(sprite);

    ctx.playByLayerId.set(L.id, (/** @type {'once'|'loop'} */ mode) => {
      sprite.loop = mode === 'loop';
      sprite.currentFrame = sprite.start;
      sprite.acc = 0;
      sprite.playing = true;
      if (sprite.img && sprite.frameW > 0) {
        sprite.img.style.left = -(sprite.currentFrame * sprite.frameW) + 'px';
      }
    });
    ctx.stopByLayerId.set(L.id, () => { sprite.playing = false; });
  }

  /**
   * Lottie слой — SVG-renderer + animationData из payload (inline JSON
   * или fetch blob:URL). Stage 5: регистрирует play/stop callbacks +
   * cycle listener для fireCycle при complete / loopComplete.
   *
   * @param {HTMLElement} node
   * @param {any} L
   * @param {any} payload
   * @param {any} ctx renderCtx — lottieInstances + play/stop maps.
   */
  _renderLottie(node, L, payload, ctx) {
    const container = document.createElement('div');
    container.className = 'dr-lottie';
    node.appendChild(container);

    const inlineJSON = payload && payload.lottieJSON;
    const url = payload && payload.dataURL;

    const launch = (animationData) => {
      if (!animationData) return;
      try {
        const anim = lottie.loadAnimation({
          container,
          renderer: 'svg',
          loop: !!L.loop,
          // По умолчанию НЕ играет — стартует через playByLayerId (Action
          // runner) или IntersectionObserver resume (auto-play loop'ов).
          autoplay: false,
          animationData,
          rendererSettings: { preserveAspectRatio: 'none' },
        });
        try { anim.goToAndStop(0, true); } catch (_) {}
        ctx.lottieInstances.push(anim);

        // Cycle listener: fireCycle для Animation 'done' subgraph'ов.
        try {
          if (anim.addEventListener) {
            anim.addEventListener('complete', () => {
              try {
                if (anim.goToAndStop) anim.goToAndStop(0, true);
              } catch (_) {}
              try { runtime.fireCycle(L.id); } catch (_) {}
            });
            anim.addEventListener('loopComplete', () => {
              try { runtime.fireCycle(L.id); } catch (_) {}
            });
          }
        } catch (_) {}

        ctx.playByLayerId.set(L.id, (/** @type {'once'|'loop'} */ mode) => {
          try {
            if (typeof anim.loop !== 'undefined') anim.loop = mode === 'loop';
            anim.stop();
            anim.play();
          } catch (_) {}
        });
        ctx.stopByLayerId.set(L.id, () => { try { anim.pause(); } catch (_) {} });

        // Если loop — авто-старт (симметрично previewMain). Sprite/loop
        // у Lottie проигрывается через web-lottie свой rAF, не наш.
        if (L.loop) {
          try { anim.play(); } catch (_) {}
        }
      } catch (err) {
        console.error('[dr-player] lottie.loadAnimation failed:', err);
      }
    };

    if (inlineJSON) {
      launch(inlineJSON);
      return;
    }
    if (typeof url === 'string' && url) {
      // Async fetch + parse. mount() возвращает sync, Lottie появляется
      // через ~1 RAF после fetch. Errors → console.error без падения.
      fetch(url)
        .then((r) => r.json())
        .then(launch)
        .catch((err) => {
          console.error('[dr-player] Lottie fetch failed:', err);
        });
    }
  }

  /**
   * Video слой. Stage 5: register play/stop callbacks + ended listener для
   * fireCycle (Animation 'done').
   *
   * GIF (mimeType 'image/gif') → `<img>` (браузер рендерит сам, fix через
   * cache-bust query при re-trigger).
   *
   * @param {HTMLElement} node
   * @param {any} L
   * @param {any} payload
   * @param {any} ctx renderCtx — videos + play/stop maps.
   */
  _renderVideo(node, L, payload, ctx) {
    const src = (payload && payload.dataURL) || '';
    const mime = ((payload && payload.mimeType) || '').toLowerCase();
    const isGif = mime === 'image/gif';

    if (isGif) {
      const img = document.createElement('img');
      img.alt = L.name || '';
      img.draggable = false;
      img.src = src;
      node.appendChild(img);
      // GIF replay через cache-bust query (browser cache'ует анимацию).
      ctx.playByLayerId.set(L.id, () => {
        const base = (payload?.dataURL || '').split('#')[0];
        img.src = base + '#t=' + Date.now();
      });
      // GIF stop невозможен через DOM API — set noop.
      return;
    }

    const vid = document.createElement('video');
    vid.muted = true;
    vid.playsInline = true;
    vid.setAttribute('playsinline', '');
    vid.preload = 'auto';
    vid.draggable = false;
    vid.loop = !!L.loop;
    vid.autoplay = false;
    vid.src = src;
    try { vid.pause(); vid.currentTime = 0; } catch (_) {}
    node.appendChild(vid);
    ctx.videos.push(vid);

    try {
      vid.addEventListener('ended', () => {
        try { runtime.fireCycle(L.id); } catch (_) {}
      });
    } catch (_) {}

    ctx.playByLayerId.set(L.id, (/** @type {'once'|'loop'} */ mode) => {
      try {
        vid.loop = mode === 'loop';
        vid.currentTime = 0;
        vid.play().catch(() => {});
      } catch (_) {}
    });
    ctx.stopByLayerId.set(L.id, () => { try { vid.pause(); } catch (_) {} });

    // Auto-start для loop'ов — IntersectionObserver pause/resume управляет
    // дальнейшим playback'ом.
    if (L.loop) {
      try { vid.play().catch(() => {}); } catch (_) {}
    }
  }

  /**
   * Solid слой — заливка цветом + опционально border-radius.
   *
   * @param {HTMLElement} node
   * @param {any} L
   */
  _renderSolid(node, L) {
    const fill = document.createElement('div');
    fill.className = 'dr-solid';
    fill.style.background = L.color || '#000000';
    if (Number.isFinite(L.radius) && L.radius > 0) {
      fill.style.borderRadius = L.radius + 'px';
    }
    node.appendChild(fill);
  }

  /**
   * Text / hint слой — `<div>` с textContent + минимальные стили
   * (color / fontFamily / fontSize / fontWeight / textAlign из L-полей).
   *
   * **Без рендеринга rich text** — Stage 4 достаточно текста на фоне.
   *
   * @param {HTMLElement} node
   * @param {any} L
   */
  _renderText(node, L) {
    const text = document.createElement('div');
    text.className = 'dr-text';
    text.textContent = String(L.text || L.content || '');
    if (L.color) text.style.color = L.color;
    if (L.fontFamily) text.style.fontFamily = L.fontFamily;
    if (Number.isFinite(L.fontSize)) text.style.fontSize = L.fontSize + 'px';
    if (L.fontWeight) text.style.fontWeight = String(L.fontWeight);
    if (L.textAlign) {
      text.style.textAlign = L.textAlign;
      // textAlign на flex-container'е — нужно justify-content:
      const map = { left: 'flex-start', center: 'center', right: 'flex-end' };
      text.style.justifyContent = map[L.textAlign] || 'center';
    }
    node.appendChild(text);
  }

  /**
   * Stage 5: запустить (или восстановить после pause) playback. Стартует
   * sprite RAF + resume Lottie / video. Action runner'ы стартуют сами
   * через trigger / compileStarts (rAF tick'и продолжаются независимо
   * от observer'а — это accept'ed для V1; будущая оптимизация — pause
   * также Action'ы при out-of-viewport).
   */
  _resume() {
    if (!this._mount || this._mount.playing) return;
    this._mount.playing = true;
    // Запустить sprite RAF (если есть sprites).
    if (this._mount.sprites.length > 0 && !this._mount.spriteRafId) {
      this._startSpriteRaf();
    }
    // Lottie / video resume.
    for (const inst of this._mount.lottieInstances) {
      try { if (typeof inst.play === 'function') inst.play(); } catch (_) {}
    }
    for (const vid of this._mount.videos) {
      try { vid.play().catch(() => {}); } catch (_) {}
    }
  }

  /**
   * Stage 5: pause sprite RAF + Lottie + video. Action runner'ы продолжают
   * rAF tick (см. _resume note); каждая tick — это мутация JS-объекта Layer
   * + DOM-write через syncLayerDom — minimal CPU когда не в viewport.
   */
  _pause() {
    if (!this._mount || !this._mount.playing) return;
    this._mount.playing = false;
    if (this._mount.spriteRafId) {
      try { cancelAnimationFrame(this._mount.spriteRafId); } catch (_) {}
      this._mount.spriteRafId = 0;
      this._mount.spriteLastTs = 0;
    }
    for (const inst of this._mount.lottieInstances) {
      try { if (typeof inst.pause === 'function') inst.pause(); } catch (_) {}
    }
    for (const vid of this._mount.videos) {
      try { vid.pause(); } catch (_) {}
    }
  }

  /**
   * Stage 5: общий sprite RAF tick. Каждый PNG sprite слой имеет state
   * `{ frameW, fps, start, length, currentFrame, acc, playing, loop }` —
   * tick инкрементит `acc` на dt, переводит в кадры по fps, обновляет
   * img.style.left для нового offset'а. На завершение loop fire'им
   * `runtime.fireCycle(layerId)` для Animation 'done' subgraph'ов.
   */
  _startSpriteRaf() {
    if (!this._mount) return;
    const tick = (/** @type {number | undefined} */ ts) => {
      if (!this._mount || !this._mount.playing) return;
      const now = typeof ts === 'number' ? ts : performance.now();
      if (!this._mount.spriteLastTs) this._mount.spriteLastTs = now;
      const dt = (now - this._mount.spriteLastTs) / 1000;
      this._mount.spriteLastTs = now;

      for (const S of this._mount.sprites) {
        if (!S.playing) continue;
        const fps = S.fps || 24;
        if (!(fps > 0)) continue;
        const frameDur = 1 / fps;
        S.acc += dt;
        if (S.acc < frameDur) continue;
        const steps = Math.floor(S.acc / frameDur);
        S.acc -= steps * frameDur;
        let cf = S.currentFrame + steps;
        if (S.loop) {
          const wrapped = cf >= S.start + S.length;
          cf = S.start + ((((cf - S.start) % S.length) + S.length) % S.length);
          if (wrapped) { try { runtime.fireCycle(S.layerId); } catch (_) {} }
        } else {
          if (cf >= S.start + S.length) {
            cf = S.start;
            S.acc = 0;
            S.playing = false;
            try { runtime.fireCycle(S.layerId); } catch (_) {}
          }
        }
        if (cf !== S.currentFrame) {
          S.currentFrame = cf;
          if (S.img && S.frameW > 0) {
            S.img.style.left = -(cf * S.frameW) + 'px';
          }
        }
      }
      this._mount.spriteRafId = requestAnimationFrame(tick);
    };
    this._mount.spriteRafId = requestAnimationFrame(tick);
  }

  /**
   * Stage 5: подписать `<dr-player>` на IntersectionObserver с порогом
   * 0.1 (10% видимости). В viewport → `_resume()`; вне viewport → `_pause()`.
   *
   * Initial state — paused до первой intersection callback'а. Если
   * `autoPause: false` (в constructor'е) — _resume() вызывается сразу
   * после mount без observer'а.
   */
  _startIntersectionObserver() {
    if (!this._mount || typeof IntersectionObserver !== 'function') return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          this._resume();
        } else {
          this._pause();
        }
      }
    }, { threshold: 0.1 });
    try {
      observer.observe(this._mount.drPlayerEl);
    } catch (err) {
      console.error('[dr-player] IntersectionObserver.observe failed:', err);
    }
    this._mount.observer = observer;
  }

  /**
   * Sync emit события всем слушателям. Buggy listener'ы не блокируют
   * остальных — каждый вызов обёрнут в try/catch. Errors уходят в
   * console.error (это для разработчика; runtime плеера продолжает).
   *
   * Итерация по копии Set, чтобы listener мог сделать `off` или `on` в
   * процессе emit'а без ConcurrentModification.
   *
   * @param {string} event
   * @param {any} payload
   */
  _emit(event, payload) {
    const set = this._listeners.get(event);
    if (!set || set.size === 0) return;
    for (const cb of [...set]) {
      try {
        cb(payload);
      } catch (err) {
        console.error(`[dr-player] listener "${event}" threw:`, err);
      }
    }
  }

  /**
   * Принять URL string ИЛИ Blob → ArrayBuffer. Errors прокидываются caller'у
   * (он обернёт в `error` event LOAD_FAILED).
   *
   * @param {string | Blob} input
   * @returns {Promise<ArrayBuffer>}
   */
  async _readInputToArrayBuffer(input) {
    if (typeof input === 'string') {
      const res = await fetch(input);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText || ''} при загрузке ${input}`);
      }
      return res.arrayBuffer();
    }
    if (input && typeof input === 'object' && typeof input.arrayBuffer === 'function') {
      return input.arrayBuffer();
    }
    throw new Error('Player.load: ожидался URL (string) или Blob, получен ' + typeof input);
  }

  /**
   * Revoke + clear blob URLs из state. Безопасно вызывать когда state нет.
   */
  _cleanupState() {
    if (!this._state) return;
    this._revokeUrls(this._state.blobUrls);
    this._state = null;
    this._loaded = false;
  }

  /**
   * @param {Map<string, string>} urls
   */
  _revokeUrls(urls) {
    if (!urls) return;
    for (const url of urls.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {}
    }
    urls.clear();
  }
}

export { runtime };

export const VERSION = '1.0.0-alpha.5';
export const STAGE_NUMBER = STAGE;
