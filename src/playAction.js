// src/playAction.js — фабрика action-runner'а. Stage 5 эпика dr-player-v1
// (2026-05-22).
//
// Реплика `previewPlayAction` из deepreview/js/preview/previewMain.js —
// тот же контракт + те же inputs, без editor-зависимостей.
// Pure-функция на этапе сборки (не вызывает DOM API напрямую — всё через
// callbacks), легко тестируется.
//
// На каждый run возвращает stopFn → отмена rAF + release priority locks.
// Caller хранит stopFn'ы для cancel при unmount / destroy.
//
// **Что отличается от previewMain:**
//   • Нет cascade clip-path'ов (Stage 5 не реализует clip-path в dr-player).
//   • Нет clipChildrenByParent сборки в touched — простая cascade по parentId.
//   • Нет hidden-видимости (dr-player render Stage 4 skip'ает hidden слои).
//   • `applyClipToNode` опционален — если caller не передал, не вызываем.

/**
 * @typedef {Object} PlayActionDeps
 * @property {Map<string, any>} actionsMap actionId → Action record.
 * @property {Map<string, any>} byId layerId → Layer.
 * @property {Map<string, HTMLElement>} nodesById layerId → DOM-нода слоя.
 * @property {Map<string, (mode: 'once'|'loop') => void>} playByLayerId
 * @property {Map<string, () => void>} stopByLayerId
 * @property {Map<string, string[]>} childrenByParent parentId → array of layerIds.
 * @property {(node: HTMLElement, L: any) => void} applyTransformToNode Apply
 *   effective transform / opacity к DOM-ноде слоя.
 * @property {Function} sampleTrack import from dr-runtime.
 * @property {Function} blendValue import from dr-runtime.
 * @property {Function} applyChannelValueTo import from dr-runtime.
 * @property {Function} getChannelOrNull import from dr-runtime.
 * @property {() => Set<() => void> | null} [getRunningStops] Optional getter
 *   для коллекции stop-функций live action runs (нужен runtime для cancel
 *   при unmount).
 */

/**
 * Создаёт замыкание-runner: вызывайте `playAction(actionId, opts)` чтобы
 * запустить Action. Возвращает stopFn. Для apply per-frame использует
 * замыкание над deps + state Maps.
 *
 * @param {PlayActionDeps} deps
 * @returns {{
 *   playAction: (actionId: string, runOpts?: {
 *     mode?: 'once'|'loop',
 *     extrapolation?: 'hold'|'nothing',
 *     blending?: 'replace'|'add',
 *     priority?: number,
 *     reversed?: boolean,
 *     blendIn?: number,
 *     blendOut?: number,
 *     onDone?: () => void,
 *   }) => () => void,
 *   syncLayerDom: (layerId: string) => void,
 *   getActiveCount: () => number,
 * }}
 */
export function createPlayAction(deps) {
  const {
    actionsMap, byId, nodesById,
    playByLayerId, stopByLayerId,
    childrenByParent,
    applyTransformToNode,
    sampleTrack, blendValue, applyChannelValueTo, getChannelOrNull,
    getRunningStops,
  } = deps;

  /** Snapshot idle всех слоёв — lazy, при первом playAction. */
  /** @type {Map<string, { x: number, y: number, w: number, h: number, rotation: number, opacity: number }> | null} */
  let _idle = null;

  function ensureIdle() {
    if (_idle) return _idle;
    _idle = new Map();
    for (const [id, L] of byId) {
      if (!L) continue;
      _idle.set(id, {
        x: Number(L.x) || 0,
        y: Number(L.y) || 0,
        w: Number.isFinite(L.w) ? L.w : 0,
        h: Number.isFinite(L.h) ? L.h : 0,
        rotation: Number.isFinite(L.rotation) ? L.rotation : 0,
        opacity: Number.isFinite(L.opacity) ? L.opacity : 1,
      });
    }
    return _idle;
  }

  /** @type {Map<string, { priority: number, runId: number }>} */
  const _priorityLock = new Map();
  let _runIdSeq = 0;
  let _activeCount = 0;

  /**
   * Cascade: добавляет в `out` все descendants (recursive) слоя `layerId`.
   * Нужно чтобы при анимации parent'а — children пересчитали свой effective
   * transform (parent chain).
   *
   * @param {string} layerId
   * @param {Set<string>} out
   */
  function collectDescendants(layerId, out) {
    const kids = childrenByParent.get(layerId);
    if (!kids) return;
    for (const k of kids) {
      if (out.has(k)) continue;
      out.add(k);
      collectDescendants(k, out);
    }
  }

  /**
   * Apply layer-объект к DOM-ноде (transform + opacity). Layer мутирован
   * applyChannelValueTo — мы просто пересчитываем CSS на ноде.
   *
   * @param {string} layerId
   */
  function syncLayerDom(layerId) {
    const L = byId.get(layerId);
    const n = nodesById.get(layerId);
    if (!L || !n) return;
    applyTransformToNode(n, L);
  }

  /**
   * Run Action. Возвращает stopFn — отмена rAF + release locks + сообщить
   * onDone (single-shot для once-mode при стопе посредине; для finished —
   * onDone уже вызван).
   *
   * @param {string} actionId
   * @param {object} [runOpts]
   * @returns {() => void}
   */
  function playAction(actionId, runOpts = {}) {
    const a = actionsMap.get(actionId);
    if (!a) {
      try { runOpts.onDone?.(); } catch (_) {}
      return () => {};
    }
    ensureIdle();
    const playMode = runOpts.mode === 'loop' || runOpts.mode === 'once'
      ? runOpts.mode
      : (a.playMode === 'loop' ? 'loop' : 'once');
    const r0 = Array.isArray(a.range) && Number.isFinite(a.range[0]) ? a.range[0] : 0;
    const r1 = Array.isArray(a.range) && Number.isFinite(a.range[1]) ? a.range[1] : (a.duration || 0);
    const rs = Math.max(0, Math.min(r0, r1));
    const re = Math.max(rs, Math.max(r0, r1));
    const extrapolation = runOpts.extrapolation === 'nothing' ? 'nothing' : 'hold';
    const blending      = runOpts.blending === 'add' ? 'add' : 'replace';
    const myPriority    = Number.isFinite(runOpts.priority) ? runOpts.priority : 0;
    const myRunId       = ++_runIdSeq;

    let _prevApplyT = -Infinity;
    /** @type {Set<string>} */
    const _firedTriggers = new Set();

    const apply = (/** @type {number} */ t) => {
      /** @type {Set<string>} */
      const touched = new Set();
      for (const trk of (a.tracks || [])) {
        if (!trk.layerId) continue;

        // media-trigger каналы — discrete events (play/stop sprite/video).
        const channelDef = getChannelOrNull(trk.channel);
        if (channelDef && channelDef.kind === 'media-trigger') {
          const kfs = trk.keyframes || [];
          for (let i = 0; i < kfs.length; i++) {
            const kf = kfs[i];
            if (kf.time <= _prevApplyT) continue;
            if (kf.time > t) break;
            const key = `${trk.id}:${i}`;
            if (_firedTriggers.has(key)) continue;
            _firedTriggers.add(key);
            const kind = kf.value && kf.value.kind ? kf.value.kind : 'play';
            if (kind === 'stop') {
              const stopFn = stopByLayerId.get(trk.layerId);
              if (stopFn) try { stopFn(); } catch (_) {}
            } else {
              const playFn = playByLayerId.get(trk.layerId);
              if (playFn) try { playFn('once'); } catch (_) {}
            }
          }
          continue;
        }

        // Priority lock: другой run выше приоритетом владеет слоем — skip.
        const cur = _priorityLock.get(trk.layerId);
        if (cur && cur.priority > myPriority && cur.runId !== myRunId) continue;
        _priorityLock.set(trk.layerId, { priority: myPriority, runId: myRunId });

        const L = byId.get(trk.layerId);
        if (!L) continue;
        const idle = _idle.get(trk.layerId);
        const v = sampleTrack(trk, t, idle, extrapolation);
        if (v == null) continue;
        const final = blendValue(trk.channel, v, blending, idle, trk.keyframes?.[0]?.value);
        applyChannelValueTo(L, trk.channel, final, idle);
        touched.add(trk.layerId);
      }
      _prevApplyT = t;
      // Cascade: descendants по parentId — их effective transform зависит от parent'а.
      const toSync = new Set(touched);
      for (const lid of touched) collectDescendants(lid, toSync);
      for (const lid of toSync) syncLayerDom(lid);
    };

    const releaseLocks = () => {
      for (const [lid, info] of _priorityLock) {
        if (info && info.runId === myRunId) _priorityLock.delete(lid);
      }
    };

    apply(rs);  // synchronous первый кадр (для NODE_START без flash idle)

    let stopped = false;
    let rafId = 0;
    let wallStart = 0;
    let doneFired = false;
    const fireDone = () => {
      if (doneFired) return;
      doneFired = true;
      try { runOpts.onDone?.(); } catch (_) {}
    };
    const tick = (/** @type {number | undefined} */ now) => {
      if (stopped) return;
      if (!wallStart) wallStart = (typeof now === 'number' ? now : performance.now());
      const cur = (typeof now === 'number' ? now : performance.now());
      let t = rs + (cur - wallStart) / 1000;
      if (t >= re) {
        if (playMode === 'once') {
          apply(re);
          stopped = true;
          _activeCount = Math.max(0, _activeCount - 1);
          releaseLocks();
          if (getRunningStops) {
            const set = getRunningStops();
            if (set) set.delete(stopFn);
          }
          fireDone();
          return;
        }
        wallStart = cur;
        t = rs;
        _firedTriggers.clear();
        _prevApplyT = -Infinity;
        fireDone();
      }
      apply(t);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    _activeCount += 1;

    const stopFn = () => {
      if (stopped) return;
      stopped = true;
      _activeCount = Math.max(0, _activeCount - 1);
      if (rafId) cancelAnimationFrame(rafId);
      releaseLocks();
      if (getRunningStops) {
        const set = getRunningStops();
        if (set) set.delete(stopFn);
      }
    };
    if (getRunningStops) {
      const set = getRunningStops();
      if (set) set.add(stopFn);
    }
    return stopFn;
  }

  return {
    playAction,
    syncLayerDom,
    getActiveCount: () => _activeCount,
  };
}
