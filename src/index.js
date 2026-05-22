// dr-player public API entry. Stage 4 (2026-05-22) — mount/unmount реализованы
// через Shadow DOM custom element; static render первого кадра PNG / Lottie /
// video / solid / text слоёв. Runtime / trigger / set всё ещё stub
// (Stages 5-6 эпика).
//
// Stages эпика dr-player-v1:
//   Stage 1 ✅ extract dr-runtime в deepreview.
//   Stage 2 ✅ создание Yanflint/dr-player + skeleton.
//   Stage 3 ✅ Player.load (.dr.zip parse + asset blob URLs).
//   Stage 4 ✅ mount() Shadow DOM + static render ← мы здесь.
//   Stage 5 → runtime (rAF + IntersectionObserver auto-pause).
//   Stage 6 → trigger/set/on/off + полный набор out-events + emit-event node.
//   Stage 7 → editor integration (Preview-mode внутри IA-слоя через dr-player).
//   Stage 8 → CDN publish + npm + docs для ok.ru.

import JSZip from './jszip.js';
import lottie from './lottie.js';
import * as runtime from './dr-runtime.js';
import { createDrPlayerElement } from './customElement.js';

const STAGE = 4;

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
     * @type {null | {
     *   parentEl: HTMLElement,
     *   drPlayerEl: HTMLElement & { _drStage: HTMLDivElement },
     *   lottieInstances: Array<import('./lottie.js').LottieAnimationItem>,
     *   videos: HTMLVideoElement[],
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
   * DOM), render'ит static первый кадр всех слоёв из загруженного
   * snapshot'а (PNG / Lottie / video poster / solid / text).
   *
   * Анимации Stage 4 НЕ играют — Stage 5 эпика добавит rAF loop +
   * IntersectionObserver auto-pause.
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
    for (const L of snap.layers) {
      if (L && L.id) byId.set(L.id, L);
    }

    /** @type {Array<import('./lottie.js').LottieAnimationItem>} */
    const lottieInstances = [];
    /** @type {HTMLVideoElement[]} */
    const videos = [];

    try {
      snap.layers.forEach((L, idx) => {
        if (!L || !L.id) return;
        const layerEl = this._renderLayer(L, idx, byId, snap.library, lottieInstances, videos);
        if (layerEl) drPlayerEl._drStage.appendChild(layerEl);
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

    this._mount = { parentEl: el, drPlayerEl, lottieInstances, videos };
    this._mounted = true;

    this._emit('mounted', { width: canvasW, height: canvasH });
  }

  /**
   * Unmount: destroy Lottie instances, pause + reset video, удалить
   * `<dr-player>` из DOM хоста. Идемпотент — повторный вызов no-op.
   * blob URLs НЕ revoke'ятся здесь — это делает `destroy()` (caller
   * может `mount → unmount → mount` без re-load).
   *
   * @returns {void}
   */
  unmount() {
    if (!this._mount) return;
    const { parentEl, drPlayerEl, lottieInstances, videos } = this._mount;
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

  trigger(_name) {
    throw new Error('[dr-player] Player.trigger — реализуется в Stage 6 эпика');
  }

  set(_input, _value) {
    throw new Error('[dr-player] Player.set — реализуется в Stage 6 эпика');
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
   * Все слои оборачиваются в `.dr-layer` div, у которого через CSS
   * `transform: matrix(...)` применяется effective матрица (parent chain
   * учтён). Размер div = visualSize слоя. Внутри слоя — type-specific
   * содержимое (img / video / lottie container / solid bg / text).
   *
   * z-index по индексу `idx` в массиве layers (cfg порядок ↔ z-order,
   * симметрично previewMain).
   *
   * @param {any} L Layer-shape из snap.
   * @param {number} idx Индекс в snap.layers (для z-index).
   * @param {Map<string, any>} byId Резолвер для effectiveMatrix / effectiveOpacity.
   * @param {Map<string, any>} library AssetRecord Map (assetId → record).
   * @param {Array<import('./lottie.js').LottieAnimationItem>} lottieInstances
   *   Сюда push'аем созданные Lottie animation items (для unmount cleanup).
   * @param {HTMLVideoElement[]} videos Сюда push'аем созданные video элементы.
   * @returns {HTMLElement | null}
   */
  _renderLayer(L, idx, byId, library, lottieInstances, videos) {
    if (L.hidden) {
      // Hidden слой не render'им. (В deepreview hidden создаётся
      // для clip-source — но для dr-player V1 это не критично, hidden →
      // skip + не trying не падает.)
      return null;
    }

    const node = document.createElement('div');
    node.className = 'dr-layer';
    node.dataset.id = L.id;

    // Visual size — фиксируем width/height div'а (matrix translate cy=h/2
    // зависит от этого; CSS img/video stretch'атся на 100%).
    const { w, h } = runtime.defaultVisualSize(L);
    if (w > 0) node.style.width  = w + 'px';
    if (h > 0) node.style.height = h + 'px';

    // Apply transform — effectiveMatrix через parent chain.
    const m = runtime.effectiveMatrix(L, (id) => byId.get(id) || null, runtime.defaultVisualSize);
    node.style.transform = `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, ${m.e}, ${m.f})`;

    // Apply opacity — effective product по chain.
    const op = runtime.effectiveOpacity(L, (id) => byId.get(id) || null);
    if (op != null && op !== 1) {
      node.style.opacity = String(op);
    }

    // z-index = 1 + idx (симметрично deepreview previewMain.renderPreview).
    node.style.zIndex = String(1 + idx);

    // Type-specific content.
    const payload = this._payloadFor(L, library);
    const type = L.type;

    if (type === 'png') {
      this._renderPng(node, L, payload);
    } else if (type === 'lottie') {
      this._renderLottie(node, L, payload, lottieInstances);
    } else if (type === 'video') {
      this._renderVideo(node, L, payload, videos);
    } else if (type === 'solid') {
      this._renderSolid(node, L);
    } else if (type === 'text' || type === 'hint') {
      this._renderText(node, L);
    }
    // Unknown тип — пустой div (broken-placeholder). Не падаем.

    return node;
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
   * PNG слой — обычный image или sprite. В Stage 4 рендерим только первый
   * кадр sprite'а (без RAF loop — Stage 5).
   *
   * @param {HTMLElement} node
   * @param {any} L
   * @param {any} payload
   */
  _renderPng(node, L, payload) {
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

    // Sprite: viewport фиксированного frame size + img позиционируется по
    // currentFrame внутри (берём первый кадр range, как deepreview).
    const origW = L._origW || L.w || 0;
    const origH = L._origH || L.h || 0;
    const frameW = sprCfg.frameW || origH || origW || 0;
    const frameH = sprCfg.frameH || origH || origW || 0;
    const start = Number.isFinite(sprCfg.startFrame) ? sprCfg.startFrame : 0;
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
  }

  /**
   * Lottie слой — SVG-renderer + animationData из payload (inline JSON
   * или fetch blob:URL).
   *
   * Stage 4 — autoplay=false (static первый кадр). Stage 5 запустит play().
   *
   * @param {HTMLElement} node
   * @param {any} L
   * @param {any} payload
   * @param {Array<import('./lottie.js').LottieAnimationItem>} lottieInstances
   */
  _renderLottie(node, L, payload, lottieInstances) {
    const container = document.createElement('div');
    container.className = 'dr-lottie';
    node.appendChild(container);

    // payload может содержать inline `lottieJSON` (старые share-link, новый
    // экспорт без bundle) или `dataURL` (blob:URL после Stage 3 distribute).
    const inlineJSON = payload && payload.lottieJSON;
    const url = payload && payload.dataURL;

    const launch = (animationData) => {
      if (!animationData) return;
      try {
        const anim = lottie.loadAnimation({
          container,
          renderer: 'svg',
          loop: !!L.loop,
          autoplay: false,
          animationData,
          rendererSettings: { preserveAspectRatio: 'none' },
        });
        // Static первый кадр для Stage 4 (без рекурсивного play).
        try { anim.goToAndStop(0, true); } catch (_) {}
        lottieInstances.push(anim);
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
   * Video слой — `<video>` элемент с poster (или first frame) для Stage 4.
   * muted + playsInline — обязательны для autoplay policy браузеров
   * (Stage 5 будет play'ить).
   *
   * GIF (mimeType 'image/gif') → `<img>` (браузер рендерит сам).
   *
   * @param {HTMLElement} node
   * @param {any} L
   * @param {any} payload
   * @param {HTMLVideoElement[]} videos
   */
  _renderVideo(node, L, payload, videos) {
    const src = (payload && payload.dataURL) || '';
    const mime = ((payload && payload.mimeType) || '').toLowerCase();
    const isGif = mime === 'image/gif';

    if (isGif) {
      const img = document.createElement('img');
      img.alt = L.name || '';
      img.draggable = false;
      img.src = src;
      node.appendChild(img);
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
    // Stage 4 — pause + currentTime=0 (poster / first frame static).
    try { vid.pause(); vid.currentTime = 0; } catch (_) {}
    node.appendChild(vid);
    videos.push(vid);
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

export const VERSION = '1.0.0-alpha.3';
export const STAGE_NUMBER = STAGE;
