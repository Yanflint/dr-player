// dr-player public API entry. Stage 3 (2026-05-22) — Player.load(.dr.zip)
// реализован, mount/runtime/trigger всё ещё stub (Stages 4-6 эпика).
//
// Stages эпика dr-player-v1:
//   Stage 1 ✅ extract dr-runtime в deepreview.
//   Stage 2 ✅ создание Yanflint/dr-player + skeleton.
//   Stage 3 ✅ Player.load (.dr.zip parse + asset blob URLs) ← мы здесь.
//   Stage 4 → mount() Shadow DOM + static render.
//   Stage 5 → runtime (rAF + IntersectionObserver auto-pause).
//   Stage 6 → trigger/set/on/off + полный набор out-events + emit-event node.
//   Stage 7 → editor integration (Preview-mode внутри IA-слоя через dr-player).
//   Stage 8 → CDN publish + npm + docs для ok.ru.

import JSZip from './jszip.js';
import * as runtime from './dr-runtime.js';

const STAGE = 3;

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

  mount(_el) {
    throw new Error('[dr-player] Player.mount — реализуется в Stage 4 эпика');
  }

  unmount() {
    throw new Error('[dr-player] Player.unmount — реализуется в Stage 4 эпика');
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
    this._cleanupState();
    this._listeners.clear();
  }

  // ---- internal ----

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

export const VERSION = '1.0.0-alpha.2';
export const STAGE_NUMBER = STAGE;
