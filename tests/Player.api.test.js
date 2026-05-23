// Unit-тесты для Player.set + emit `event:<name>` pathway
// (Stage 6 эпика dr-player-v1, 2026-05-23).
//
// **Coverage (≥10 cases — фактически 12):**
//   1.  set(input, value) до mount — warning, без throw, value НЕ сохранено.
//   2.  set(input, value) после mount — value сохранён в _mount.inputsState.
//   3.  set(input, value) повторно — overwrite value.
//   4.  set(input, value) с пустой строкой имени → noop без throw.
//   5.  set(input, value) с non-string input → noop без throw.
//   6.  emit-event в графе (Start → Emit) → emit `event:<name>` с payload.
//   7.  on('event:custom', cb) + emit-event с invalid JSON → payload: null.
//   8.  Buggy listener в event:<name> — не блокирует других.
//   9.  Multiple listeners на event:<name> — все вызваны.
//  10.  off('event:<name>', cb) — listener убран.
//  11.  emit-event без name → compile null → emit НЕ срабатывает.
//  12.  emit-event с пустым payload string → emit с payload: null.
//
// **Setup:** IntersectionObserver mock'ан в tests/setup.js. Stage 8b — Lottie
// mock убран вместе с самой библиотекой (ADR-0010).
//   URL.createObjectURL / revokeObjectURL stub'нуты в beforeEach.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import JSZip from 'jszip';
import { Player } from '../src/index.js';

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
    name: 'API test fixture',
    createdAt: '2026-05-23T00:00:00.000Z',
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

async function buildZip(cfg, manifest = makeManifest()) {
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifest));
  zip.file('cfg.json', JSON.stringify(cfg));
  return zip.generateAsync({ type: 'blob' });
}

/**
 * cfg с Start → Emit-event (name='liked', payload). Auto-fire при mount —
 * emit-event compile зовёт emitOut('liked', parsedPayload) синхронно.
 */
function makeEmitFixture(emitName = 'liked', payloadStr = '{"id":42}') {
  return makeCfg({
    eventGraph: {
      nodes: [
        ['start', { id: 'start', kind: 'start' }],
        ['emit', { id: 'emit', kind: 'emit-event', name: emitName, payload: payloadStr }],
      ],
      edges: [
        ['e1', { id: 'e1', from: { nodeId: 'start', socket: 'fire' }, to: { nodeId: 'emit', socket: 'trigger' } }],
      ],
      layout: [],
    },
  });
}

function setupHost() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

// ============================================================================

describe('Player.set — Stage 6', () => {
  it('1. set(input, value) до mount → warning, без throw, value не сохранён', () => {
    const p = new Player();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => p.set('volume', 0.7)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Player.set'));
    // _mount === null до mount() — inputsState недоступен.
    expect(p._mount).toBeNull();
    warnSpy.mockRestore();
  });

  it('2. set(input, value) после mount → value сохранён в inputsState', async () => {
    const p = new Player({ autoPause: false });
    await p.load(await buildZip(makeCfg()));
    p.mount(setupHost());
    p.set('volume', 0.7);
    expect(p._mount.inputsState.get('volume')).toBe(0.7);
  });

  it('3. set(input, value) повторно — overwrite value', async () => {
    const p = new Player({ autoPause: false });
    await p.load(await buildZip(makeCfg()));
    p.mount(setupHost());
    p.set('volume', 0.7);
    p.set('volume', 1);
    expect(p._mount.inputsState.get('volume')).toBe(1);
    expect(p._mount.inputsState.size).toBe(1);
  });

  it('4. set(input, value) с пустой строкой имени → noop без throw', async () => {
    const p = new Player({ autoPause: false });
    await p.load(await buildZip(makeCfg()));
    p.mount(setupHost());
    expect(() => p.set('', 42)).not.toThrow();
    expect(p._mount.inputsState.size).toBe(0);
  });

  it('5. set(input, value) с non-string input → noop без throw', async () => {
    const p = new Player({ autoPause: false });
    await p.load(await buildZip(makeCfg()));
    p.mount(setupHost());
    expect(() => p.set(null, 42)).not.toThrow();
    expect(() => p.set(undefined, 42)).not.toThrow();
    expect(() => p.set(123, 42)).not.toThrow();
    expect(p._mount.inputsState.size).toBe(0);
  });
});

// ============================================================================

describe('emit-event nodе → event:<name> emit', () => {
  it('6. Start → Emit (name="liked", payload={"id":42}) на mount → emit event:liked', async () => {
    const p = new Player({ autoPause: false });
    await p.load(await buildZip(makeEmitFixture('liked', '{"id":42,"src":"btn"}')));

    const eventListener = vi.fn();
    p.on('event:liked', eventListener);

    p.mount(setupHost());

    // compileStarts auto-fire синхронно в mount() ПОСЛЕ emit('mounted').
    // Поэтому к моменту возврата mount() listener уже сработал.
    expect(eventListener).toHaveBeenCalledTimes(1);
    expect(eventListener).toHaveBeenCalledWith({ payload: { id: 42, src: 'btn' } });
  });

  it('7. emit-event с invalid JSON в payload → emit с payload: null, без throw', async () => {
    const p = new Player({ autoPause: false });
    // Invalid JSON в payload поле — parse fails, payload остаётся null.
    await p.load(await buildZip(makeEmitFixture('broken', '{not valid')));

    const eventListener = vi.fn();
    p.on('event:broken', eventListener);

    expect(() => p.mount(setupHost())).not.toThrow();
    expect(eventListener).toHaveBeenCalledWith({ payload: null });
  });

  it('8. Buggy listener в event:<name> — не блокирует других + не падает плеер', async () => {
    const p = new Player({ autoPause: false });
    await p.load(await buildZip(makeEmitFixture('tap', '')));

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const buggyListener = vi.fn(() => { throw new Error('boom'); });
    const goodListener = vi.fn();
    p.on('event:tap', buggyListener);
    p.on('event:tap', goodListener);

    expect(() => p.mount(setupHost())).not.toThrow();
    expect(buggyListener).toHaveBeenCalledTimes(1);
    expect(goodListener).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('event:tap'), expect.any(Error));
    errSpy.mockRestore();
  });

  it('9. Multiple listeners на event:<name> — все вызваны с тем же payload', async () => {
    const p = new Player({ autoPause: false });
    await p.load(await buildZip(makeEmitFixture('ping', '{"n":1}')));

    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    p.on('event:ping', a);
    p.on('event:ping', b);
    p.on('event:ping', c);

    p.mount(setupHost());

    const expected = { payload: { n: 1 } };
    expect(a).toHaveBeenCalledWith(expected);
    expect(b).toHaveBeenCalledWith(expected);
    expect(c).toHaveBeenCalledWith(expected);
  });

  it('10. off("event:<name>", cb) — listener убран до emit', async () => {
    const p = new Player({ autoPause: false });
    await p.load(await buildZip(makeEmitFixture('untap', '')));

    const a = vi.fn();
    const b = vi.fn();
    p.on('event:untap', a);
    p.on('event:untap', b);
    p.off('event:untap', a);

    p.mount(setupHost());

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('11. emit-event без name → compile null → emit НЕ срабатывает', async () => {
    const p = new Player({ autoPause: false });
    // name='' — compileEmitEvent вернёт null, Start без живых детей → не fire'ится.
    await p.load(await buildZip(makeEmitFixture('', '{"x":1}')));

    const eventListener = vi.fn();
    // listener на любой event:<*> — нет, мы используем wildcard'less контракт:
    // listener завёл бы на конкретное имя. Здесь без имени просто проверяем
    // что плеер не упал и НИ ОДНО `event:<...>` не вылетело.
    p.on('event:', eventListener); // даже на event: '' — не сработает.
    p.on('event:none', eventListener);

    expect(() => p.mount(setupHost())).not.toThrow();
    expect(eventListener).not.toHaveBeenCalled();
  });

  it('12. emit-event с пустым payload string → emit с payload: null', async () => {
    const p = new Player({ autoPause: false });
    await p.load(await buildZip(makeEmitFixture('beep', '')));

    const eventListener = vi.fn();
    p.on('event:beep', eventListener);

    p.mount(setupHost());

    expect(eventListener).toHaveBeenCalledWith({ payload: null });
  });
});
