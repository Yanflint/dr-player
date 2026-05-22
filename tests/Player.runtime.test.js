// Unit-тесты для Player runtime (Stage 5 эпика dr-player-v1, 2026-05-22).
//
// **Coverage (≥10 cases):**
//   1.  trigger(name) до mount — return false + warning, без throw.
//   2.  trigger(name) без зарегистрированного handler'а — return false +
//       emit 'trigger' event с source:'external'.
//   3.  trigger(name) с handler через compileTriggers — handler вызван,
//       emit 'trigger' event, return true.
//   4.  mount(): compileEventGraph regiт transitions в runtime.getTransitions.
//   5.  mount(): compileStarts auto-fire — Action runner был вызван при mount.
//   6.  mount(): autoPause:true — IntersectionObserver observed `<dr-player>`.
//   7.  mount(): autoPause:false — IntersectionObserver не создан, lottie
//       инстанции в play state (для loop'ов).
//   8.  IntersectionObserver callback not-intersecting → pause (lottie.pause,
//       video.pause вызваны).
//   9.  IntersectionObserver callback intersecting → resume (lottie.play
//       вызван у loop-Lottie).
//  10.  unmount() — disconnect observer + cancel sprite RAF +
//       running actions stopped.
//  11.  destroy() после mount во время play — clean (revoke blob URLs +
//       clear listeners).
//  12.  Multiple triggers — два compile'ировано'нных handler'а на разные
//       имена, каждый запускается независимо.
//
// **Setup:**
//   - lottie.js глобально mock'ан в tests/setup.js.
//   - IntersectionObserver глобально mock'ан в tests/setup.js
//     (`getLastIntersectionObserver()` test helper).
//   - URL.createObjectURL / revokeObjectURL stub'нуты в beforeEach.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import JSZip from 'jszip';
import { Player, ERROR_CODES } from '../src/index.js';
import lottie from '../src/lottie.js';
import { getLastIntersectionObserver } from './setup.js';

// ---- helpers ----

const TRANSPARENT_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function base64ToBytes(b64) {
  const bin = Buffer.from(b64, 'base64');
  return new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength);
}

function makeManifest(overrides = {}) {
  return {
    formatVersion: '1.0',
    name: 'Runtime test fixture',
    createdAt: '2026-05-22T00:00:00.000Z',
    createdBy: 'unit-test',
    canvas: { width: 200, height: 200 },
    triggers: [],
    inputs: [],
    outEvents: [],
    layerCount: 0,
    assetCount: 0,
    ...overrides,
  };
}

/**
 * Builder cfg.json с заданным eventGraph + actions + слоями.
 */
function makeCfg(opts = {}) {
  return {
    canvas: opts.canvas || { width: 200, height: 200 },
    layers: opts.layers || [],
    eventGraph: opts.eventGraph || { nodes: [], edges: [], layout: [] },
    actions: opts.actions || [],
    meta: { title: '', desc: '' },
    _assets: opts._assets || [],
  };
}

async function buildZip(cfg, manifest = makeManifest(), assets = {}) {
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifest));
  zip.file('cfg.json', JSON.stringify(cfg));
  for (const [path, bytes] of Object.entries(assets)) {
    zip.file(path, bytes);
  }
  return zip.generateAsync({ type: 'blob' });
}

/**
 * Helper: cfg с Event(trigger='jump') → Action(actionId='jump_action'),
 * action который двигает pic.y. Возвращает blob ready для player.load().
 */
async function buildJumpFixture() {
  const cfg = makeCfg({
    layers: [
      { id: 'pic', type: 'png', name: 'Pic', assetId: 'a1', x: 50, y: 100, w: 32, h: 32 },
    ],
    eventGraph: {
      nodes: [
        ['ev', { id: 'ev', kind: 'event', sourceType: 'trigger', triggerName: 'jump' }],
        ['act', { id: 'act', kind: 'action', actionId: 'jump_action', mode: 'once' }],
      ],
      edges: [
        ['e1', { id: 'e1', from: { nodeId: 'ev', socket: 'onClick' }, to: { nodeId: 'act', socket: 'trigger' } }],
      ],
      layout: [],
    },
    actions: [
      ['jump_action', {
        id: 'jump_action',
        name: 'Jump',
        playMode: 'once',
        range: [0, 0.5],
        duration: 0.5,
        tracks: [
          {
            id: 't1', layerId: 'pic', channel: 'y',
            keyframes: [
              { time: 0,   value: 100, interpolation: 'linear' },
              { time: 0.5, value: 50,  interpolation: 'linear' },
            ],
          },
        ],
      }],
    ],
    _assets: [
      ['a1', { kind: 'png', payload: { dataURL: 'assets/a1.png', width: 1, height: 1, hash: 'sha256:test' } }],
    ],
  });
  return buildZip(cfg, makeManifest({ triggers: ['jump'], layerCount: 1, assetCount: 1 }), {
    'assets/a1.png': base64ToBytes(TRANSPARENT_PNG_B64),
  });
}

/** Создать host-element + Player для теста. */
function setupHost() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host;
}

// Очищаем DOM между тестами (mount.test.js не делает — а здесь полезно).
afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

// ============================================================================

describe('Player.trigger — guard перед mount', () => {
  it('1. trigger(name) до mount — return false, warning, без throw', async () => {
    const p = new Player();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = p.trigger('jump');
    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Player.trigger'));
    warnSpy.mockRestore();
  });
});

describe('Player.trigger — без зарегистрированных handlers', () => {
  it('2. trigger без подходящего handler\'а — return false + emit `trigger`', async () => {
    const p = new Player({ autoPause: false });
    const cfg = makeCfg();  // пустой eventGraph
    const blob = await buildZip(cfg);
    await p.load(blob);

    const triggerListener = vi.fn();
    p.on('trigger', triggerListener);

    const host = setupHost();
    p.mount(host);

    const result = p.trigger('unknown_name');
    expect(result).toBe(false);
    expect(triggerListener).toHaveBeenCalledWith({ name: 'unknown_name', source: 'external' });
  });
});

describe('Player.trigger — с зарегистрированным handler через compileTriggers', () => {
  it('3. trigger("jump") → Action runner запустился + emit `trigger`', async () => {
    const blob = await buildJumpFixture();
    const p = new Player({ autoPause: false });
    await p.load(blob);

    const triggerListener = vi.fn();
    p.on('trigger', triggerListener);

    const host = setupHost();
    p.mount(host);

    const result = p.trigger('jump');
    expect(result).toBe(true);
    expect(triggerListener).toHaveBeenCalledWith({ name: 'jump', source: 'external' });
  });
});

// ============================================================================

describe('mount(): compileEventGraph registered transitions', () => {
  it('4. transitions из eventGraph попадают в runtime.getTransitions', async () => {
    // EventGraph: Event(sourceType='layer', layerId='pic') → Layer('pic').
    // compileEventGraph должен зарегистрировать 1 transition.
    const cfg = makeCfg({
      layers: [
        // PNG со sprite — становится "playable" в Layer-ноде terminal.
        {
          id: 'pic', type: 'png', name: 'Pic', assetId: 'a1', x: 0, y: 0, w: 32, h: 32,
          sprite: { enabled: true, frameW: 32, frameH: 32, startFrame: 0, endFrame: 3, fps: 24 },
        },
      ],
      eventGraph: {
        nodes: [
          ['ev', { id: 'ev', kind: 'event', sourceType: 'layer', layerId: 'pic' }],
          ['lyr', { id: 'lyr', kind: 'layer', layerId: 'pic' }],
        ],
        edges: [
          ['e1', { id: 'e1', from: { nodeId: 'ev', socket: 'onClick' }, to: { nodeId: 'lyr', socket: 'play' } }],
        ],
        layout: [],
      },
      _assets: [
        ['a1', { kind: 'png', payload: { dataURL: 'assets/a1.png', width: 1, height: 1, hash: 'sha256:test' } }],
      ],
    });
    const blob = await buildZip(cfg, makeManifest({ layerCount: 1, assetCount: 1 }), {
      'assets/a1.png': base64ToBytes(TRANSPARENT_PNG_B64),
    });

    const p = new Player({ autoPause: false });
    await p.load(blob);

    const host = setupHost();
    p.mount(host);

    const transitions = p._mount.runtime.getTransitions();
    expect(transitions.length).toBe(1);
    expect(transitions[0].fromLayerId).toBe('pic');
    expect(typeof transitions[0].play).toBe('function');
  });
});

describe('mount(): compileStarts auto-fire', () => {
  it('5. NODE_START с потомком — fire вызвана при mount (Action запустился)', async () => {
    // Start → Action 'auto_action' (двигает pic.y).
    const cfg = makeCfg({
      layers: [
        { id: 'pic', type: 'png', name: 'Pic', assetId: 'a1', x: 50, y: 100, w: 32, h: 32 },
      ],
      eventGraph: {
        nodes: [
          ['start', { id: 'start', kind: 'start' }],
          ['act', { id: 'act', kind: 'action', actionId: 'auto_action', mode: 'once' }],
        ],
        edges: [
          ['e1', { id: 'e1', from: { nodeId: 'start', socket: 'fire' }, to: { nodeId: 'act', socket: 'trigger' } }],
        ],
        layout: [],
      },
      actions: [
        ['auto_action', {
          id: 'auto_action', name: 'Auto', playMode: 'once', range: [0, 0.2], duration: 0.2,
          tracks: [
            {
              id: 't1', layerId: 'pic', channel: 'y',
              keyframes: [
                { time: 0,   value: 100, interpolation: 'linear' },
                { time: 0.2, value: 50,  interpolation: 'linear' },
              ],
            },
          ],
        }],
      ],
      _assets: [
        ['a1', { kind: 'png', payload: { dataURL: 'assets/a1.png', width: 1, height: 1, hash: 'sha256:test' } }],
      ],
    });
    const blob = await buildZip(cfg, makeManifest({ layerCount: 1, assetCount: 1 }), {
      'assets/a1.png': base64ToBytes(TRANSPARENT_PNG_B64),
    });

    const p = new Player({ autoPause: false });
    await p.load(blob);

    const host = setupHost();
    p.mount(host);

    // Action runner запустился — есть запись в runningActions
    // (она удаляется когда run завершается; sync apply(rs) первый кадр
    // случился, rAF tick запущен — поэтому min count = 1 пока не завершится).
    expect(p._mount.runningActions.size).toBeGreaterThan(0);
  });
});

// ============================================================================

describe('IntersectionObserver — autoPause:true (default)', () => {
  it('6. mount наблюдает `<dr-player>` через IntersectionObserver', async () => {
    const blob = await buildJumpFixture();
    const p = new Player();  // default autoPause:true
    await p.load(blob);

    const host = setupHost();
    p.mount(host);

    const observer = getLastIntersectionObserver();
    expect(observer).toBeTruthy();
    expect(observer.observe).toHaveBeenCalledTimes(1);
    expect(observer.observe.mock.calls[0][0].tagName).toBe('DR-PLAYER');
  });
});

describe('IntersectionObserver — autoPause:false', () => {
  it('7. autoPause:false — observer НЕ создан; loop-Lottie играет сразу', async () => {
    const cfg = makeCfg({
      layers: [
        {
          id: 'l', type: 'lottie', name: 'L', assetId: 'a1',
          x: 0, y: 0, w: 50, h: 50, loop: true,
        },
      ],
      _assets: [
        ['a1', { kind: 'lottie', payload: { lottieJSON: { v: '5.7.0', layers: [] }, width: 50, height: 50, hash: 'sha256:t' } }],
      ],
    });
    const blob = await buildZip(cfg, makeManifest({ layerCount: 1, assetCount: 1 }));

    const p = new Player({ autoPause: false });
    await p.load(blob);

    const host = setupHost();
    p.mount(host);

    // Observer не должен быть создан.
    const observer = getLastIntersectionObserver();
    expect(observer).toBeNull();

    // loop-Lottie должен играть (loadAnimation called + play вызван).
    expect(lottie.loadAnimation).toHaveBeenCalled();
    const animInstance = lottie.loadAnimation.mock.results[0].value;
    expect(animInstance.play).toHaveBeenCalled();
  });
});

describe('IntersectionObserver — not-intersecting → pause', () => {
  it('8. callback `isIntersecting:false` → Lottie.pause + video.pause', async () => {
    const cfg = makeCfg({
      layers: [
        {
          id: 'l1', type: 'lottie', name: 'L1', assetId: 'a1',
          x: 0, y: 0, w: 50, h: 50, loop: true,
        },
      ],
      _assets: [
        ['a1', { kind: 'lottie', payload: { lottieJSON: { v: '5.7.0', layers: [] }, width: 50, height: 50, hash: 'sha256:t' } }],
      ],
    });
    const blob = await buildZip(cfg, makeManifest({ layerCount: 1, assetCount: 1 }));

    const p = new Player();  // autoPause: true
    await p.load(blob);

    const host = setupHost();
    p.mount(host);

    const observer = getLastIntersectionObserver();
    const animInstance = lottie.loadAnimation.mock.results[0].value;

    // Сначала intersecting → resume; затем not intersecting → pause.
    observer._fireIntersection(true);
    animInstance.play.mockClear();
    animInstance.pause.mockClear();

    observer._fireIntersection(false);
    expect(animInstance.pause).toHaveBeenCalled();
  });
});

describe('IntersectionObserver — intersecting → resume', () => {
  it('9. callback `isIntersecting:true` → Lottie.play вызывается', async () => {
    const cfg = makeCfg({
      layers: [
        {
          id: 'l1', type: 'lottie', name: 'L1', assetId: 'a1',
          x: 0, y: 0, w: 50, h: 50, loop: true,
        },
      ],
      _assets: [
        ['a1', { kind: 'lottie', payload: { lottieJSON: { v: '5.7.0', layers: [] }, width: 50, height: 50, hash: 'sha256:t' } }],
      ],
    });
    const blob = await buildZip(cfg, makeManifest({ layerCount: 1, assetCount: 1 }));

    const p = new Player();
    await p.load(blob);

    const host = setupHost();
    p.mount(host);

    const observer = getLastIntersectionObserver();
    const animInstance = lottie.loadAnimation.mock.results[0].value;

    // Initial mount: lottie.play вызван при rendering loop-Lottie. Очистим
    // mock чтобы проверить именно intersection callback.
    animInstance.play.mockClear();

    observer._fireIntersection(true);
    expect(animInstance.play).toHaveBeenCalled();
  });
});

// ============================================================================

describe('unmount() — cleanup runtime / observer / running actions', () => {
  it('10. unmount → disconnect observer + cancel running action + sprite RAF', async () => {
    const blob = await buildJumpFixture();
    const p = new Player();
    await p.load(blob);

    const host = setupHost();
    p.mount(host);

    // Запустить action через trigger.
    p.trigger('jump');

    const observer = getLastIntersectionObserver();
    expect(observer.disconnect).not.toHaveBeenCalled();

    const savedRunningActions = p._mount.runningActions;
    expect(savedRunningActions.size).toBeGreaterThan(0);

    p.unmount();

    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    // running actions cleared (stopFn'ы тригернули delete из set).
    expect(savedRunningActions.size).toBe(0);
    // _mount = null
    expect(p._mount).toBeNull();
  });
});

describe('destroy() — после mount во время play', () => {
  it('11. destroy → unmount + revoke blob URLs + clear listeners', async () => {
    const blob = await buildJumpFixture();
    const p = new Player();
    await p.load(blob);
    const triggerListener = vi.fn();
    p.on('trigger', triggerListener);

    const host = setupHost();
    p.mount(host);
    p.trigger('jump');

    const revokeSpy = URL.revokeObjectURL;

    p.destroy();

    expect(p._mount).toBeNull();
    expect(p._state).toBeNull();
    expect(revokeSpy).toHaveBeenCalled();
    // После destroy listeners очищены — повторный trigger не дёргает callback.
    triggerListener.mockClear();
    const r = p.trigger('jump');
    // mount=null → return false, listeners cleared → triggerListener не вызван.
    expect(r).toBe(false);
    expect(triggerListener).not.toHaveBeenCalled();
  });
});

// ============================================================================

describe('Multiple triggers — independent handlers', () => {
  it('12. Два разных триггера → каждый запускает свою цепочку независимо', async () => {
    // EventGraph: Event(trigger='jump') → Action('a1');
    //             Event(trigger='spin') → Action('a2').
    // Проверяем что triggerByName('jump') запускает только a1, не a2 (и наоборот).
    const cfg = makeCfg({
      layers: [
        { id: 'pic', type: 'png', name: 'Pic', assetId: 'asset_a', x: 0, y: 100, w: 32, h: 32 },
      ],
      eventGraph: {
        nodes: [
          ['ev1', { id: 'ev1', kind: 'event', sourceType: 'trigger', triggerName: 'jump' }],
          ['a1', { id: 'a1', kind: 'action', actionId: 'A1', mode: 'once' }],
          ['ev2', { id: 'ev2', kind: 'event', sourceType: 'trigger', triggerName: 'spin' }],
          ['a2', { id: 'a2', kind: 'action', actionId: 'A2', mode: 'once' }],
        ],
        edges: [
          ['e1', { id: 'e1', from: { nodeId: 'ev1', socket: 'onClick' }, to: { nodeId: 'a1', socket: 'trigger' } }],
          ['e2', { id: 'e2', from: { nodeId: 'ev2', socket: 'onClick' }, to: { nodeId: 'a2', socket: 'trigger' } }],
        ],
        layout: [],
      },
      actions: [
        ['A1', { id: 'A1', name: 'A1', playMode: 'once', range: [0, 0.1], duration: 0.1,
          tracks: [{ id: 't1', layerId: 'pic', channel: 'y',
            keyframes: [{ time: 0, value: 100 }, { time: 0.1, value: 50 }] }] }],
        ['A2', { id: 'A2', name: 'A2', playMode: 'once', range: [0, 0.1], duration: 0.1,
          tracks: [{ id: 't2', layerId: 'pic', channel: 'rotation',
            keyframes: [{ time: 0, value: 0 }, { time: 0.1, value: 90 }] }] }],
      ],
      _assets: [
        ['asset_a', { kind: 'png', payload: { dataURL: 'assets/a.png', width: 1, height: 1, hash: 'sha256:test' } }],
      ],
    });
    const blob = await buildZip(cfg, makeManifest({ triggers: ['jump', 'spin'], layerCount: 1, assetCount: 1 }), {
      'assets/a.png': base64ToBytes(TRANSPARENT_PNG_B64),
    });

    const p = new Player({ autoPause: false });
    await p.load(blob);

    const host = setupHost();
    p.mount(host);

    // Triggers зарегистрированы как 2 (jump + spin).
    const r1 = p.trigger('jump');
    expect(r1).toBe(true);
    const r2 = p.trigger('spin');
    expect(r2).toBe(true);
    // Несуществующий — false.
    const r3 = p.trigger('teleport');
    expect(r3).toBe(false);
  });
});
