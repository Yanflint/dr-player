// Unit-тесты для Player.load() (Stage 3 эпика dr-player-v1, 2026-05-22).
//
// **Coverage:**
//   1. Happy path Blob — `loaded` event с правильным payload'ом.
//   2. Happy path URL (fetch) — same.
//   3. Network error (fetch reject) — `error` event LOAD_FAILED.
//   4. HTTP non-200 — `error` event LOAD_FAILED.
//   5. Invalid ZIP bytes — `error` event PARSE_FAILED.
//   6. Missing manifest.json — `error` event PARSE_FAILED.
//   7. Missing cfg.json — `error` event PARSE_FAILED.
//   8. Invalid manifest JSON — `error` event PARSE_FAILED.
//   9. formatVersion major mismatch — `error` event FORMAT_VERSION_MISMATCH.
//  10. Missing asset reference (manifest без файла) — graceful (loaded ok).
//  11. Empty triggers / inputs — `loaded` с пустыми массивами.
//  12. Multiple load() calls — второй cleanup'ит первый + загружает заново.
//  13. Buggy listener — не блокирует остальных.
//
// **Fixture builder:** все .dr.zip сборки делаются inline через JSZip (внутри
// каждого теста). Это даёт детерминистичные fixture'ы без зависимости от
// внешнего файла.

import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';
import { Player, ERROR_CODES } from '../src/index.js';

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
    name: 'Test fixture',
    createdAt: '2026-05-22T00:00:00.000Z',
    createdBy: 'unit-test',
    canvas: { width: 200, height: 200 },
    triggers: ['jump'],
    inputs: [],
    outEvents: [],
    layerCount: 1,
    assetCount: 1,
    ...overrides,
  };
}

function makeCfg(overrides = {}) {
  return {
    canvas: { width: 200, height: 200 },
    layers: [
      {
        id: 'L1',
        type: 'png',
        name: 'Layer1',
        assetId: 'asset_1',
      },
    ],
    eventGraph: { nodes: [], edges: [], layout: [] },
    actions: [],
    meta: { title: '', desc: '' },
    _assets: [
      [
        'asset_1',
        {
          kind: 'png',
          payload: {
            dataURL: 'assets/asset_1.png',
            width: 1,
            height: 1,
            hash: 'sha256:test',
          },
        },
      ],
    ],
    ...overrides,
  };
}

/**
 * Собрать валидный .dr.zip как Blob.
 *
 * @param {{ manifest?: any, cfg?: any, includeAsset?: boolean, manifestRaw?: string, cfgRaw?: string, omitManifest?: boolean, omitCfg?: boolean }} [opts]
 * @returns {Promise<Blob>}
 */
async function buildZip(opts = {}) {
  const zip = new JSZip();
  if (!opts.omitManifest) {
    const m = opts.manifestRaw !== undefined
      ? opts.manifestRaw
      : JSON.stringify(opts.manifest || makeManifest());
    zip.file('manifest.json', m);
  }
  if (!opts.omitCfg) {
    const c = opts.cfgRaw !== undefined
      ? opts.cfgRaw
      : JSON.stringify(opts.cfg || makeCfg());
    zip.file('cfg.json', c);
  }
  if (opts.includeAsset !== false) {
    zip.file('assets/asset_1.png', base64ToBytes(TRANSPARENT_PNG_B64));
  }
  return zip.generateAsync({ type: 'blob' });
}

/**
 * Создать Player и собрать массив emit'нутых event'ов для проверки.
 */
function createPlayerWithRecorder() {
  const events = [];
  const player = new Player();
  for (const ev of ['loaded', 'error']) {
    player.on(ev, (payload) => events.push({ event: ev, payload }));
  }
  return { player, events };
}

// URL.createObjectURL / revokeObjectURL подменяются безусловно в
// tests/setup.js (jsdom не реализует их по-настоящему).

// ---- tests ----

describe('Player.load — happy paths', () => {
  it('1. valid .dr.zip Blob → emit `loaded` с правильным payload', async () => {
    const { player, events } = createPlayerWithRecorder();
    const blob = await buildZip();
    await player.load(blob);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('loaded');
    expect(events[0].payload).toMatchObject({
      layerCount: 1,
      triggers: ['jump'],
      inputs: [],
    });
    expect(player._loaded).toBe(true);
  });

  it('2. valid .dr.zip URL (fetch) → emit `loaded`', async () => {
    const blob = await buildZip();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: () => blob.arrayBuffer(),
    }));
    try {
      const { player, events } = createPlayerWithRecorder();
      await player.load('https://example.com/widget.dr.zip');
      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('loaded');
      expect(events[0].payload.layerCount).toBe(1);
      expect(globalThis.fetch).toHaveBeenCalledWith('https://example.com/widget.dr.zip');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Player.load — input errors (LOAD_FAILED)', () => {
  it('3. fetch reject → error LOAD_FAILED + Promise reject', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Network is down');
    });
    try {
      const { player, events } = createPlayerWithRecorder();
      await expect(player.load('https://broken.example.com/x.dr.zip')).rejects.toMatchObject({
        code: ERROR_CODES.LOAD_FAILED,
      });
      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('error');
      expect(events[0].payload.code).toBe(ERROR_CODES.LOAD_FAILED);
      expect(events[0].payload.message).toContain('Network');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('4. HTTP non-200 → error LOAD_FAILED', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      arrayBuffer: () => new ArrayBuffer(0),
    }));
    try {
      const { player, events } = createPlayerWithRecorder();
      await expect(player.load('https://example.com/missing.dr.zip')).rejects.toMatchObject({
        code: ERROR_CODES.LOAD_FAILED,
      });
      expect(events[0].payload.code).toBe(ERROR_CODES.LOAD_FAILED);
      expect(events[0].payload.message).toContain('404');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Player.load — parse errors (PARSE_FAILED)', () => {
  it('5. invalid ZIP bytes → error PARSE_FAILED', async () => {
    const garbage = new Blob([new Uint8Array([0xff, 0xfe, 0xfd, 0xfc, 0xfb])]);
    const { player, events } = createPlayerWithRecorder();
    await expect(player.load(garbage)).rejects.toMatchObject({
      code: ERROR_CODES.PARSE_FAILED,
    });
    expect(events[0].payload.code).toBe(ERROR_CODES.PARSE_FAILED);
  });

  it('6. missing manifest.json → error PARSE_FAILED', async () => {
    const blob = await buildZip({ omitManifest: true });
    const { player, events } = createPlayerWithRecorder();
    await expect(player.load(blob)).rejects.toMatchObject({
      code: ERROR_CODES.PARSE_FAILED,
    });
    expect(events[0].payload.message).toContain('manifest.json');
  });

  it('7. missing cfg.json → error PARSE_FAILED', async () => {
    const blob = await buildZip({ omitCfg: true });
    const { player, events } = createPlayerWithRecorder();
    await expect(player.load(blob)).rejects.toMatchObject({
      code: ERROR_CODES.PARSE_FAILED,
    });
    expect(events[0].payload.message).toContain('cfg.json');
  });

  it('8. invalid manifest JSON → error PARSE_FAILED', async () => {
    const blob = await buildZip({ manifestRaw: '{ this is not json' });
    const { player, events } = createPlayerWithRecorder();
    await expect(player.load(blob)).rejects.toMatchObject({
      code: ERROR_CODES.PARSE_FAILED,
    });
    expect(events[0].payload.message).toMatch(/manifest\.json|JSON/i);
  });
});

describe('Player.load — formatVersion validation', () => {
  it('9a. formatVersion "2.0" → error FORMAT_VERSION_MISMATCH', async () => {
    const blob = await buildZip({ manifest: makeManifest({ formatVersion: '2.0' }) });
    const { player, events } = createPlayerWithRecorder();
    await expect(player.load(blob)).rejects.toMatchObject({
      code: ERROR_CODES.FORMAT_VERSION_MISMATCH,
    });
    expect(events[0].payload.message).toContain('2.0');
  });

  it('9b. missing formatVersion → error FORMAT_VERSION_MISMATCH', async () => {
    const blob = await buildZip({ manifest: makeManifest({ formatVersion: undefined }) });
    const { player, events } = createPlayerWithRecorder();
    await expect(player.load(blob)).rejects.toMatchObject({
      code: ERROR_CODES.FORMAT_VERSION_MISMATCH,
    });
  });

  it('9c. formatVersion "1.5" (same major) → OK loaded', async () => {
    const blob = await buildZip({ manifest: makeManifest({ formatVersion: '1.5' }) });
    const { player, events } = createPlayerWithRecorder();
    await player.load(blob);
    expect(events[0].event).toBe('loaded');
  });
});

describe('Player.load — asset distribution', () => {
  it('10. asset reference без файла в zip → graceful (loaded ok, blob URL не выдан)', async () => {
    // cfg ссылается на assets/asset_missing.png, в zip нет такого файла.
    const cfg = makeCfg({
      _assets: [
        [
          'asset_missing',
          {
            kind: 'png',
            payload: { dataURL: 'assets/asset_missing.png', width: 1, height: 1, hash: 'sha256:x' },
          },
        ],
      ],
    });
    const blob = await buildZip({ cfg, includeAsset: false });
    const { player, events } = createPlayerWithRecorder();
    await player.load(blob);
    expect(events[0].event).toBe('loaded');
    // payload.dataURL должен остаться path (не blob:), broken-placeholder для render Stage 4.
    const rec = player._state.snap.library.get('asset_missing');
    expect(rec.payload.dataURL).toBe('assets/asset_missing.png');
  });

  it('10b. asset присутствует → dataURL заменён на blob:', async () => {
    const blob = await buildZip();
    const { player } = createPlayerWithRecorder();
    await player.load(blob);
    const rec = player._state.snap.library.get('asset_1');
    expect(rec.payload.dataURL).toMatch(/^blob:/);
  });
});

describe('Player.load — manifest variations', () => {
  it('11. empty triggers/inputs → `loaded` с пустыми массивами', async () => {
    const blob = await buildZip({
      manifest: makeManifest({ triggers: [], inputs: [] }),
    });
    const { player, events } = createPlayerWithRecorder();
    await player.load(blob);
    expect(events[0].payload.triggers).toEqual([]);
    expect(events[0].payload.inputs).toEqual([]);
  });

  it('11b. skippedLottieLayers = 0 когда Lottie-слоёв нет', async () => {
    // Stage 8b (ADR-0010): обычный .dr.zip без Lottie — counter = 0.
    const blob = await buildZip();
    const { player, events } = createPlayerWithRecorder();
    await player.load(blob);
    expect(events[0].payload.skippedLottieLayers).toBe(0);
  });

  it('11c. Lottie-слои в legacy .dr.zip → counter в payload + console.warn', async () => {
    // Stage 8b (ADR-0010): legacy .dr.zip может содержать Lottie-слои —
    // считаем и предупреждаем разработчика.
    const cfg = makeCfg({
      layers: [
        { id: 'PNG1', type: 'png', name: 'Pic', assetId: 'asset_1' },
        { id: 'L1', type: 'lottie', assetId: 'la1', w: 100, h: 100 },
        { id: 'L2', type: 'lottie', assetId: 'la2', w: 100, h: 100 },
      ],
      _assets: [
        ['asset_1', { kind: 'png', payload: { dataURL: 'assets/asset_1.png', width: 1, height: 1 } }],
        ['la1', { kind: 'lottie', payload: { lottieJSON: { v: '5.7', layers: [] } } }],
        ['la2', { kind: 'lottie', payload: { lottieJSON: { v: '5.7', layers: [] } } }],
      ],
    });
    const blob = await buildZip({ cfg });
    const { player, events } = createPlayerWithRecorder();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await player.load(blob);
      expect(events[0].event).toBe('loaded');
      expect(events[0].payload.skippedLottieLayers).toBe(2);
      // layerCount всё ещё считает Lottie-слои в общем числе (raw из snap).
      expect(events[0].payload.layerCount).toBe(3);
      // console.warn вызван с упоминанием ADR-0010.
      expect(warnSpy).toHaveBeenCalled();
      const warnCall = warnSpy.mock.calls[0][0];
      expect(warnCall).toContain('Lottie');
      expect(warnCall).toContain('ADR-0010');
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('Player.load — lifecycle', () => {
  it('12. повторный load() — cleanup previous state и загружает заново', async () => {
    const blob1 = await buildZip({ manifest: makeManifest({ triggers: ['jump'] }) });
    const blob2 = await buildZip({ manifest: makeManifest({ triggers: ['spin', 'flip'] }) });
    const { player, events } = createPlayerWithRecorder();
    await player.load(blob1);
    expect(events).toHaveLength(1);
    expect(events[0].payload.triggers).toEqual(['jump']);

    await player.load(blob2);
    expect(events).toHaveLength(2);
    expect(events[1].payload.triggers).toEqual(['spin', 'flip']);
    // state переподмонтирован.
    expect(player._state.triggers).toEqual(['spin', 'flip']);
  });

  it('13. buggy listener — не блокирует остальных', async () => {
    const blob = await buildZip();
    const player = new Player();
    let secondCalled = false;
    player.on('loaded', () => {
      throw new Error('buggy listener');
    });
    player.on('loaded', () => {
      secondCalled = true;
    });
    // Capture console.error чтобы не засорять test output.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await player.load(blob);
      expect(secondCalled).toBe(true);
      expect(errSpy).toHaveBeenCalled();
    } finally {
      errSpy.mockRestore();
    }
  });

  it('14. destroy() revoke all blob URLs', async () => {
    const blob = await buildZip();
    const player = new Player();
    await player.load(blob);
    const blobUrlsBefore = [...player._state.blobUrls.values()];
    expect(blobUrlsBefore.length).toBeGreaterThan(0);
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    try {
      player.destroy();
      expect(revokeSpy).toHaveBeenCalledTimes(blobUrlsBefore.length);
      expect(player._state).toBeNull();
      expect(player._loaded).toBe(false);
    } finally {
      revokeSpy.mockRestore();
    }
  });
});
