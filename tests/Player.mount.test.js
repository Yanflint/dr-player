// Unit-тесты для Player.mount() / unmount() / destroy() (Stage 4 эпика
// dr-player-v1, 2026-05-22).
//
// **Coverage:**
//   1.  mount без load → throw + emit error MOUNT_FAILED.
//   2.  mount с не-HTMLElement (null / string) → throw + emit error.
//   3.  PNG слой → `<dr-player>` + img с blob: URL внутри Shadow DOM.
//   4.  Solid слой → div с правильным background-color.
//   5.  Text слой → div с правильным textContent.
//   6.  Lottie слой → lottie.loadAnimation вызван с правильным container.
//   7.  mount → `mounted` event с правильным width/height payload.
//   8.  Transform matrix: rotation 90° → CSS matrix корректный.
//   9.  Opacity propagation: parent.opacity=0.5 + child.opacity=0.5 → effective 0.25.
//  10.  unmount → `unmounted` event + `<dr-player>` удалён из DOM хоста.
//  11.  unmount → Lottie.destroy + video.pause вызваны.
//  12.  Повторный mount после unmount — работает.
//  13.  destroy() после mount — unmount + revoke blob URLs.
//  14.  Shadow DOM isolation: img снаружи (через document.querySelector) не виден.
//
// **Setup:** lottie.js глобально mock'нут в tests/setup.js (vi.mock).
// Реальный 223KB UMD load не нужен — проверяем контракт вызова + cleanup.

import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';
import { Player, ERROR_CODES } from '../src/index.js';
import lottie from '../src/lottie.js';

// ---- helpers (синхронизированы с Player.load.test.js) ----

const TRANSPARENT_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function base64ToBytes(b64) {
  const bin = Buffer.from(b64, 'base64');
  return new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength);
}

function makeManifest(overrides = {}) {
  return {
    formatVersion: '1.0',
    name: 'Mount test fixture',
    createdAt: '2026-05-22T00:00:00.000Z',
    createdBy: 'unit-test',
    canvas: { width: 320, height: 240 },
    triggers: [],
    inputs: [],
    outEvents: [],
    layerCount: 1,
    assetCount: 1,
    ...overrides,
  };
}

/**
 * Сборка cfg с произвольным набором слоёв. `layers` и `_assets` явно.
 *
 * @param {{ layers: any[], _assets?: any[], canvas?: any }} opts
 */
function makeCfg(opts) {
  return {
    canvas: opts.canvas || { width: 320, height: 240 },
    layers: opts.layers,
    eventGraph: { nodes: [], edges: [], layout: [] },
    actions: [],
    meta: { title: '', desc: '' },
    _assets: opts._assets || [],
  };
}

async function buildZip(cfg, includeAsset = true) {
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(makeManifest()));
  zip.file('cfg.json', JSON.stringify(cfg));
  if (includeAsset) {
    zip.file('assets/asset_1.png', base64ToBytes(TRANSPARENT_PNG_B64));
  }
  return zip.generateAsync({ type: 'blob' });
}

/**
 * Player + event recorder.
 */
function createRecorder() {
  const events = [];
  const player = new Player();
  for (const ev of ['loaded', 'error', 'mounted', 'unmounted']) {
    player.on(ev, (payload) => events.push({ event: ev, payload }));
  }
  return { player, events };
}

// Достать `<dr-player>` из контейнера. Внутри его Shadow root (closed)
// для тестов через `shadowRoot` геттер не доступен — используем `_drStage`
// property (set custom element'ом, см. customElement.js).
function getDrPlayerEl(container) {
  return container.querySelector('dr-player');
}

function getStage(container) {
  const el = getDrPlayerEl(container);
  return el ? el._drStage : null;
}

// ---- tests ----

describe('Player.mount — validation', () => {
  it('1. mount без load → throw + error MOUNT_FAILED', () => {
    const { player, events } = createRecorder();
    const host = document.createElement('div');
    expect(() => player.mount(host)).toThrow();
    expect(events.some((e) => e.event === 'error' && e.payload.code === ERROR_CODES.MOUNT_FAILED)).toBe(true);
  });

  it('2. mount с не-HTMLElement → throw + error MOUNT_FAILED', async () => {
    const cfg = makeCfg({ layers: [{ id: 'L1', type: 'solid', color: '#f00', w: 100, h: 100 }] });
    const blob = await buildZip(cfg, false);
    const { player } = createRecorder();
    await player.load(blob);
    expect(() => player.mount(null)).toThrow();
    expect(() => player.mount('div')).toThrow();
  });
});

describe('Player.mount — render по типу слоя', () => {
  it('3. PNG слой → img внутри shadow DOM с blob: URL', async () => {
    const cfg = makeCfg({
      layers: [{ id: 'L1', type: 'png', name: 'pic', assetId: 'a1', w: 100, h: 100, x: 0, y: 0 }],
      _assets: [['a1', { kind: 'png', payload: { dataURL: 'assets/asset_1.png', width: 1, height: 1 } }]],
    });
    const blob = await buildZip(cfg, true);
    const { player } = createRecorder();
    await player.load(blob);

    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      player.mount(host);
      const drEl = getDrPlayerEl(host);
      expect(drEl).toBeTruthy();
      expect(drEl.style.width).toBe('320px');
      expect(drEl.style.height).toBe('240px');
      const stage = getStage(host);
      const img = stage.querySelector('img');
      expect(img).toBeTruthy();
      expect(img.getAttribute('src')).toMatch(/^blob:/);
    } finally {
      document.body.removeChild(host);
    }
  });

  it('4. Solid слой → div с правильным background', async () => {
    const cfg = makeCfg({
      layers: [{ id: 'L1', type: 'solid', color: 'rgb(123, 45, 67)', w: 80, h: 80, x: 10, y: 10 }],
    });
    const blob = await buildZip(cfg, false);
    const { player } = createRecorder();
    await player.load(blob);

    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      player.mount(host);
      const stage = getStage(host);
      const solid = stage.querySelector('.dr-solid');
      expect(solid).toBeTruthy();
      expect(solid.style.background).toBe('rgb(123, 45, 67)');
    } finally {
      document.body.removeChild(host);
    }
  });

  it('5. Text слой → div с правильным textContent', async () => {
    const cfg = makeCfg({
      layers: [{
        id: 'L1', type: 'text', text: 'Hello, world',
        color: '#222', fontSize: 16, fontFamily: 'Inter', fontWeight: 600,
        textAlign: 'center', w: 200, h: 40, x: 0, y: 0,
      }],
    });
    const blob = await buildZip(cfg, false);
    const { player } = createRecorder();
    await player.load(blob);

    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      player.mount(host);
      const stage = getStage(host);
      const text = stage.querySelector('.dr-text');
      expect(text).toBeTruthy();
      expect(text.textContent).toBe('Hello, world');
      expect(text.style.fontSize).toBe('16px');
      expect(text.style.fontFamily).toBe('Inter');
    } finally {
      document.body.removeChild(host);
    }
  });

  it('6. Lottie слой → lottie.loadAnimation вызван с правильным container + JSON', async () => {
    const lottieJSON = { v: '5.7.4', ip: 0, op: 60, w: 100, h: 100, layers: [] };
    const cfg = makeCfg({
      layers: [{ id: 'L1', type: 'lottie', assetId: 'la1', w: 100, h: 100, x: 0, y: 0 }],
      _assets: [['la1', { kind: 'lottie', payload: { lottieJSON } }]],
    });
    const blob = await buildZip(cfg, false);
    const { player } = createRecorder();
    await player.load(blob);

    vi.mocked(lottie).loadAnimation.mockClear();

    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      player.mount(host);
      const calls = vi.mocked(lottie).loadAnimation.mock.calls;
      expect(calls.length).toBe(1);
      const opts = calls[0][0];
      expect(opts.renderer).toBe('svg');
      expect(opts.loop).toBe(false);
      expect(opts.autoplay).toBe(false);
      // deserializeIaSnapshot deep-clone'ит cfg — animationData = новый объект
      // с тем же содержимым (не ref-identity исходному lottieJSON).
      expect(opts.animationData).toStrictEqual(lottieJSON);
      // container — внутри shadow root, проверяем что это HTMLElement с
      // className 'dr-lottie'.
      expect(opts.container.classList.contains('dr-lottie')).toBe(true);
    } finally {
      document.body.removeChild(host);
    }
  });
});

describe('Player.mount — event + payload', () => {
  it('7. mount → emit `mounted` с canvas width/height', async () => {
    const cfg = makeCfg({
      canvas: { width: 400, height: 300 },
      layers: [{ id: 'L1', type: 'solid', color: '#000', w: 100, h: 100 }],
    });
    const blob = await buildZip(cfg, false);
    const { player, events } = createRecorder();
    await player.load(blob);

    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      player.mount(host);
      const ev = events.find((e) => e.event === 'mounted');
      expect(ev).toBeTruthy();
      expect(ev.payload).toEqual({ width: 400, height: 300 });
    } finally {
      document.body.removeChild(host);
    }
  });
});

describe('Player.mount — transform math', () => {
  it('8. Rotation 90° → CSS matrix(0, 1, -1, 0, ...)', async () => {
    const cfg = makeCfg({
      layers: [{ id: 'L1', type: 'solid', color: '#abc', w: 100, h: 100, x: 50, y: 60, rotation: 90 }],
    });
    const blob = await buildZip(cfg, false);
    const { player } = createRecorder();
    await player.load(blob);

    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      player.mount(host);
      const stage = getStage(host);
      const layer = stage.querySelector('.dr-layer');
      expect(layer).toBeTruthy();
      // rotation 90° → cos=0, sin=1; a=0, b=1, c=-1, d=0.
      // Точность float — round'им до 3 знаков для проверки.
      // Regex учитывает exponential notation (cos(π/2) ≈ 6.12e-17).
      const m = layer.style.transform.match(/matrix\(([-\deE.+,\s]+)\)/);
      expect(m).toBeTruthy();
      const parts = m[1].split(',').map((s) => Number(s.trim()));
      expect(parts.length).toBe(6);
      expect(Math.abs(parts[0])).toBeLessThan(1e-3); // a ≈ 0
      expect(parts[1]).toBeCloseTo(1, 3);             // b = 1
      expect(parts[2]).toBeCloseTo(-1, 3);            // c = -1
      expect(Math.abs(parts[3])).toBeLessThan(1e-3); // d ≈ 0
    } finally {
      document.body.removeChild(host);
    }
  });

  it('9. Opacity propagation parent 0.5 × child 0.5 → 0.25', async () => {
    const cfg = makeCfg({
      layers: [
        { id: 'P', type: 'solid', color: '#ddd', w: 200, h: 200, opacity: 0.5 },
        { id: 'C', type: 'solid', color: '#eee', w: 100, h: 100, opacity: 0.5, parentId: 'P' },
      ],
    });
    const blob = await buildZip(cfg, false);
    const { player } = createRecorder();
    await player.load(blob);

    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      player.mount(host);
      const stage = getStage(host);
      const layers = stage.querySelectorAll('.dr-layer');
      expect(layers.length).toBe(2);
      // Layer P — parent, opacity 0.5.
      expect(Number(layers[0].style.opacity)).toBeCloseTo(0.5, 3);
      // Layer C — child, effective opacity 0.25.
      expect(Number(layers[1].style.opacity)).toBeCloseTo(0.25, 3);
    } finally {
      document.body.removeChild(host);
    }
  });
});

describe('Player.unmount', () => {
  it('10. unmount → emit `unmounted` + DOM cleanup', async () => {
    const cfg = makeCfg({
      layers: [{ id: 'L1', type: 'solid', color: '#000', w: 100, h: 100 }],
    });
    const blob = await buildZip(cfg, false);
    const { player, events } = createRecorder();
    await player.load(blob);

    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      player.mount(host);
      expect(getDrPlayerEl(host)).toBeTruthy();
      player.unmount();
      expect(getDrPlayerEl(host)).toBeNull();
      const ev = events.find((e) => e.event === 'unmounted');
      expect(ev).toBeTruthy();
      expect(player._mounted).toBe(false);
    } finally {
      document.body.removeChild(host);
    }
  });

  it('11. unmount → Lottie.destroy + video.pause вызваны', async () => {
    const lottieJSON = { v: '5.7.4', ip: 0, op: 60, w: 100, h: 100, layers: [] };
    const cfg = makeCfg({
      layers: [
        { id: 'L1', type: 'lottie', assetId: 'la1', w: 100, h: 100 },
        { id: 'L2', type: 'video', assetId: 'va1', w: 100, h: 100 },
      ],
      _assets: [
        ['la1', { kind: 'lottie', payload: { lottieJSON } }],
        ['va1', { kind: 'video', payload: { dataURL: 'assets/video.mp4', mimeType: 'video/mp4' } }],
      ],
    });
    const blob = await buildZip(cfg, false);
    const { player } = createRecorder();
    await player.load(blob);

    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      vi.mocked(lottie).loadAnimation.mockClear();
      player.mount(host);
      const lottieCalls = vi.mocked(lottie).loadAnimation.mock.results;
      expect(lottieCalls.length).toBe(1);
      const lottieInst = lottieCalls[0].value;
      const stage = getStage(host);
      const video = stage.querySelector('video');
      expect(video).toBeTruthy();
      const videoPauseSpy = vi.spyOn(video, 'pause');

      player.unmount();
      expect(lottieInst.destroy).toHaveBeenCalled();
      expect(videoPauseSpy).toHaveBeenCalled();
    } finally {
      document.body.removeChild(host);
    }
  });

  it('12. Повторный mount после unmount — работает', async () => {
    const cfg = makeCfg({
      layers: [{ id: 'L1', type: 'solid', color: '#000', w: 100, h: 100 }],
    });
    const blob = await buildZip(cfg, false);
    const { player, events } = createRecorder();
    await player.load(blob);

    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      player.mount(host);
      player.unmount();
      player.mount(host);
      expect(getDrPlayerEl(host)).toBeTruthy();
      const mountedEvents = events.filter((e) => e.event === 'mounted');
      expect(mountedEvents.length).toBe(2);
    } finally {
      document.body.removeChild(host);
    }
  });
});

describe('Player.destroy — после mount', () => {
  it('13. destroy() после mount → unmount + revoke blob URLs', async () => {
    const cfg = makeCfg({
      layers: [{ id: 'L1', type: 'png', assetId: 'a1', w: 100, h: 100 }],
      _assets: [['a1', { kind: 'png', payload: { dataURL: 'assets/asset_1.png', width: 1, height: 1 } }]],
    });
    const blob = await buildZip(cfg, true);
    const { player } = createRecorder();
    await player.load(blob);

    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      player.mount(host);
      const blobUrlsBefore = [...player._state.blobUrls.values()];
      expect(blobUrlsBefore.length).toBeGreaterThan(0);

      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
      try {
        player.destroy();
        expect(revokeSpy).toHaveBeenCalledTimes(blobUrlsBefore.length);
        expect(player._state).toBeNull();
        expect(player._mount).toBeNull();
        expect(getDrPlayerEl(host)).toBeNull();
      } finally {
        revokeSpy.mockRestore();
      }
    } finally {
      document.body.removeChild(host);
    }
  });
});

describe('Player.mount — Shadow DOM isolation', () => {
  it('14. img внутри плеера не виден через document.querySelector хоста', async () => {
    const cfg = makeCfg({
      layers: [{ id: 'L1', type: 'png', assetId: 'a1', w: 100, h: 100 }],
      _assets: [['a1', { kind: 'png', payload: { dataURL: 'assets/asset_1.png' } }]],
    });
    const blob = await buildZip(cfg, true);
    const { player } = createRecorder();
    await player.load(blob);

    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      player.mount(host);
      // closed Shadow root → document.querySelector НЕ должен находить img.
      const imgFromOutside = document.querySelector('img');
      expect(imgFromOutside).toBeNull();
      // Через _drStage (internal property плеера) — должно быть.
      const stage = getStage(host);
      expect(stage.querySelector('img')).toBeTruthy();
    } finally {
      document.body.removeChild(host);
    }
  });
});
