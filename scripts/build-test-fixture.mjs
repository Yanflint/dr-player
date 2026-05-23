#!/usr/bin/env node
// scripts/build-test-fixture.mjs — детерминистично собирает test fixture'ы.
//
// Stage 3 fixture: `tests/fixtures/stage3.dr.zip` — минимальный (1 PNG слой)
//   для проверки contract'а Player.load (manifest + cfg + 1 asset).
// Stage 4 fixture: `tests/fixtures/stage4.dr.zip` — визуально богаче
//   (solid + text + PNG слои, разные позиции / opacity / rotation) для
//   ручной проверки mount() в browser.
//
// Запуск: `npm run build-fixture`. Оба файла обновляются.

import JSZipPkg from 'jszip';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const OUTDIR = join(ROOT, 'tests', 'fixtures');

// 1×1 прозрачный PNG (67 байт). Base64 → bytes ниже.
const TRANSPARENT_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function base64ToBytes(b64) {
  const bin = Buffer.from(b64, 'base64');
  return new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength);
}

// CRC-32 (IEEE 802.3, polynomial 0xEDB88320). Используется в PNG chunks.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c >>> 0;
  }
  return t;
})();

/**
 * @param {Uint8Array} bytes
 * @returns {number}
 */
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Сборка PNG chunk: 4 byte length + 4 byte type + data + 4 byte CRC
 * (CRC включает type + data).
 *
 * @param {string} type 4-char ASCII (например "IHDR").
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
function makeChunk(type, data) {
  const len = data.length;
  const buf = new Uint8Array(8 + len + 4);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, len, false); // big-endian
  buf[4] = type.charCodeAt(0);
  buf[5] = type.charCodeAt(1);
  buf[6] = type.charCodeAt(2);
  buf[7] = type.charCodeAt(3);
  buf.set(data, 8);
  const crcInput = buf.slice(4, 8 + len);
  dv.setUint32(8 + len, crc32(crcInput), false);
  return buf;
}

/**
 * Сборка PNG с одной заливкой (RGB, без alpha).
 *
 * @param {number} w
 * @param {number} h
 * @param {[number, number, number]} rgb — три байта 0..255.
 * @returns {Uint8Array}
 */
function makeSolidPng(w, h, rgb) {
  // PNG magic: 89 50 4E 47 0D 0A 1A 0A.
  const magic = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR — 13 bytes: width(4) + height(4) + bitDepth(1) + colorType(1)
  // + compression(1) + filter(1) + interlace(1).
  // colorType=2 → RGB без alpha; bitDepth=8.
  const ihdr = new Uint8Array(13);
  const ihdrDv = new DataView(ihdr.buffer);
  ihdrDv.setUint32(0, w, false);
  ihdrDv.setUint32(4, h, false);
  ihdr[8]  = 8;  // bitDepth
  ihdr[9]  = 2;  // colorType (RGB)
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // Raw scanlines: для каждой row — 1 byte filter (0=None) + w * 3 RGB bytes.
  const rowBytes = 1 + w * 3;
  const raw = new Uint8Array(rowBytes * h);
  for (let y = 0; y < h; y += 1) {
    const off = y * rowBytes;
    raw[off] = 0; // filter type None
    for (let x = 0; x < w; x += 1) {
      const p = off + 1 + x * 3;
      raw[p]     = rgb[0];
      raw[p + 1] = rgb[1];
      raw[p + 2] = rgb[2];
    }
  }
  const idat = new Uint8Array(deflateSync(raw));

  const iend = new Uint8Array(0);

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', idat);
  const iendChunk = makeChunk('IEND', iend);

  const total = magic.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const out = new Uint8Array(total);
  let off = 0;
  out.set(magic, off); off += magic.length;
  out.set(ihdrChunk, off); off += ihdrChunk.length;
  out.set(idatChunk, off); off += idatChunk.length;
  out.set(iendChunk, off);
  return out;
}

async function buildStage3() {
  const assetId = 'asset_test1';
  const assetPath = `assets/${assetId}.png`;

  const manifest = {
    formatVersion: '1.0',
    name: 'Stage3 test fixture',
    createdAt: '2026-05-22T00:00:00.000Z',
    createdBy: 'dr-player test fixture builder',
    canvas: { width: 200, height: 200 },
    triggers: ['jump', 'spin'],
    inputs: [],
    outEvents: [],
    layerCount: 1,
    assetCount: 1,
  };

  const cfg = {
    canvas: { width: 200, height: 200 },
    layers: [
      { id: 'layer_1', type: 'png', name: 'TestLayer', assetId, x: 50, y: 50, w: 100, h: 100 },
    ],
    eventGraph: { nodes: [], edges: [], layout: [] },
    actions: [],
    meta: { title: '', desc: '' },
    _assets: [
      [assetId, { kind: 'png', payload: { dataURL: assetPath, width: 1, height: 1, hash: 'sha256:test' } }],
    ],
  };

  const zip = new JSZipPkg();
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('cfg.json', JSON.stringify(cfg, null, 2));
  zip.file(assetPath, base64ToBytes(TRANSPARENT_PNG_B64));
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function buildStage4() {
  const pngId = 'asset_pink';
  const pngPath = `assets/${pngId}.png`;

  const manifest = {
    formatVersion: '1.0',
    name: 'Stage4 test fixture — visible smoke',
    createdAt: '2026-05-22T00:00:00.000Z',
    createdBy: 'dr-player test fixture builder',
    canvas: { width: 320, height: 240 },
    triggers: [],
    inputs: [],
    outEvents: [],
    layerCount: 3,
    assetCount: 1,
  };

  // Слои specifically для визуальной проверки mount():
  //   1) Solid background — голубой fill всего canvas'а.
  //   2) PNG 64×64 — pink-asset, центрируется.
  //   3) Text — "DR Player Stage 4" по центру, белый шрифт.
  // z-order через layer index: solid first → PNG поверх → text сверху всего.
  const cfg = {
    canvas: { width: 320, height: 240 },
    layers: [
      {
        id: 'bg', type: 'solid', name: 'Background',
        color: '#1e3a5f', mode: 'layer',
        x: 0, y: 0, w: 320, h: 240,
      },
      {
        id: 'pic', type: 'png', name: 'Picture',
        assetId: pngId,
        x: 128, y: 88, w: 64, h: 64,
        rotation: 15,
      },
      {
        id: 'caption', type: 'text', name: 'Caption',
        text: 'DR Player Stage 4',
        color: '#ffffff', fontSize: 18, fontWeight: 600,
        fontFamily: 'Inter, sans-serif', textAlign: 'center',
        x: 60, y: 180, w: 200, h: 28,
      },
    ],
    eventGraph: { nodes: [], edges: [], layout: [] },
    actions: [],
    meta: { title: 'Stage 4 smoke', desc: '' },
    _assets: [
      [pngId, { kind: 'png', payload: { dataURL: pngPath, width: 64, height: 64, hash: 'sha256:pink-test' } }],
    ],
  };

  const zip = new JSZipPkg();
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('cfg.json', JSON.stringify(cfg, null, 2));
  // Pink 64×64 — реальный PNG через minimal encoder (RGB, без alpha).
  zip.file(pngPath, makeSolidPng(64, 64, [0xff, 0x66, 0xaa]));
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function buildStage5() {
  const pngId = 'asset_pink';
  const pngPath = `assets/${pngId}.png`;

  const manifest = {
    formatVersion: '1.0',
    name: 'Stage5 test fixture — анимация по триггеру',
    createdAt: '2026-05-22T00:00:00.000Z',
    createdBy: 'dr-player test fixture builder',
    canvas: { width: 320, height: 240 },
    triggers: ['jump', 'spin'],
    inputs: [],
    outEvents: [],
    layerCount: 2,
    assetCount: 1,
  };

  // Action 'jump_action' — двигает pic.y с 88 (idle) до 30 (вверх) и обратно
  // за 0.5 секунды. Channel `y` — стандартный transform канал в anim-runtime.
  // Action 'spin_action' — поворот pic.rotation 0 → 360 за 1 секунду (loop).
  const jumpActionId = 'jump_action';
  const spinActionId = 'spin_action';

  // EventGraph:
  //   ev_jump (Event sourceType='trigger' name='jump') → a_jump (Action jump_action)
  //   ev_spin (Event sourceType='trigger' name='spin') → a_spin (Action spin_action)
  const evJumpId = 'ev_jump';
  const evSpinId = 'ev_spin';
  const aJumpId = 'a_jump';
  const aSpinId = 'a_spin';

  const cfg = {
    canvas: { width: 320, height: 240 },
    layers: [
      {
        id: 'bg', type: 'solid', name: 'Background',
        color: '#1e3a5f', mode: 'layer',
        x: 0, y: 0, w: 320, h: 240,
      },
      {
        id: 'pic', type: 'png', name: 'Picture',
        assetId: pngId,
        x: 128, y: 88, w: 64, h: 64,
        rotation: 0, opacity: 1,
      },
    ],
    eventGraph: {
      nodes: [
        [evJumpId, { id: evJumpId, kind: 'event', sourceType: 'trigger', triggerName: 'jump' }],
        [aJumpId,  { id: aJumpId,  kind: 'action', actionId: jumpActionId, mode: 'once', extrapolation: 'hold', blending: 'replace', priority: 0 }],
        [evSpinId, { id: evSpinId, kind: 'event', sourceType: 'trigger', triggerName: 'spin' }],
        [aSpinId,  { id: aSpinId,  kind: 'action', actionId: spinActionId, mode: 'loop', extrapolation: 'hold', blending: 'replace', priority: 0 }],
      ],
      edges: [
        ['e1', { id: 'e1', from: { nodeId: evJumpId, socket: 'onClick' }, to: { nodeId: aJumpId, socket: 'trigger' } }],
        ['e2', { id: 'e2', from: { nodeId: evSpinId, socket: 'onClick' }, to: { nodeId: aSpinId, socket: 'trigger' } }],
      ],
      layout: [],
    },
    actions: [
      [jumpActionId, {
        id: jumpActionId,
        name: 'Jump',
        playMode: 'once',
        range: [0, 0.5],
        duration: 0.5,
        tracks: [
          {
            id: 'trk_jump_y',
            layerId: 'pic',
            channel: 'y',
            keyframes: [
              { time: 0,    value: 88, interpolation: 'linear' },
              { time: 0.25, value: 30, interpolation: 'linear' },
              { time: 0.5,  value: 88, interpolation: 'linear' },
            ],
          },
        ],
      }],
      [spinActionId, {
        id: spinActionId,
        name: 'Spin',
        playMode: 'loop',
        range: [0, 1],
        duration: 1,
        tracks: [
          {
            id: 'trk_spin_rot',
            layerId: 'pic',
            channel: 'rotation',
            keyframes: [
              { time: 0, value: 0,   interpolation: 'linear' },
              { time: 1, value: 360, interpolation: 'linear' },
            ],
          },
        ],
      }],
    ],
    meta: { title: 'Stage 5 runtime smoke', desc: 'jump / spin triggers' },
    _assets: [
      [pngId, { kind: 'png', payload: { dataURL: pngPath, width: 64, height: 64, hash: 'sha256:pink-test' } }],
    ],
  };

  const zip = new JSZipPkg();
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('cfg.json', JSON.stringify(cfg, null, 2));
  zip.file(pngPath, makeSolidPng(64, 64, [0xff, 0x66, 0xaa]));
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function buildStage6() {
  const pngId = 'asset_pink';
  const pngPath = `assets/${pngId}.png`;

  const manifest = {
    formatVersion: '1.0',
    name: 'Stage6 test fixture — out-events + auto-emit',
    createdAt: '2026-05-23T00:00:00.000Z',
    createdBy: 'dr-player test fixture builder',
    canvas: { width: 320, height: 240 },
    triggers: ['jump', 'spin', 'notify'],
    inputs: [],
    outEvents: ['ready', 'notified'],
    layerCount: 2,
    assetCount: 1,
  };

  // EventGraph для Stage 6:
  //   • Start → Emit('ready', payload={"timestamp":1234,"stage":6})
  //       (auto-fire при mount: разработчик ok.ru видит event:ready сразу).
  //   • Event(trigger='jump') → Action 'jump_action' (как Stage 5).
  //   • Event(trigger='spin') → Action 'spin_action' (как Stage 5, loop).
  //   • Event(trigger='notify') → Emit('notified', payload={"reason":"clicked"})
  //       (manual trigger: проверка emit'а через player.trigger('notify')).
  const startId = 'start_emit';
  const emitReadyId = 'emit_ready';
  const evJumpId = 'ev_jump';
  const evSpinId = 'ev_spin';
  const evNotifyId = 'ev_notify';
  const aJumpId = 'a_jump';
  const aSpinId = 'a_spin';
  const emitNotifyId = 'emit_notify';
  const jumpActionId = 'jump_action';
  const spinActionId = 'spin_action';

  const cfg = {
    canvas: { width: 320, height: 240 },
    layers: [
      {
        id: 'bg', type: 'solid', name: 'Background',
        color: '#1e3a5f', mode: 'layer',
        x: 0, y: 0, w: 320, h: 240,
      },
      {
        id: 'pic', type: 'png', name: 'Picture',
        assetId: pngId,
        x: 128, y: 88, w: 64, h: 64,
        rotation: 0, opacity: 1,
      },
    ],
    eventGraph: {
      nodes: [
        // Auto-emit при mount: Start → Emit('ready').
        [startId, { id: startId, kind: 'start' }],
        [emitReadyId, { id: emitReadyId, kind: 'emit-event', name: 'ready', payload: '{"timestamp":1234,"stage":6}' }],
        // Reuse jump / spin Actions (как в Stage 5).
        [evJumpId, { id: evJumpId, kind: 'event', sourceType: 'trigger', triggerName: 'jump' }],
        [aJumpId,  { id: aJumpId,  kind: 'action', actionId: jumpActionId, mode: 'once', extrapolation: 'hold', blending: 'replace', priority: 0 }],
        [evSpinId, { id: evSpinId, kind: 'event', sourceType: 'trigger', triggerName: 'spin' }],
        [aSpinId,  { id: aSpinId,  kind: 'action', actionId: spinActionId, mode: 'loop', extrapolation: 'hold', blending: 'replace', priority: 0 }],
        // Trigger 'notify' → Emit('notified').
        [evNotifyId, { id: evNotifyId, kind: 'event', sourceType: 'trigger', triggerName: 'notify' }],
        [emitNotifyId, { id: emitNotifyId, kind: 'emit-event', name: 'notified', payload: '{"reason":"clicked"}' }],
      ],
      edges: [
        ['e1', { id: 'e1', from: { nodeId: startId, socket: 'fire' }, to: { nodeId: emitReadyId, socket: 'trigger' } }],
        ['e2', { id: 'e2', from: { nodeId: evJumpId, socket: 'onClick' }, to: { nodeId: aJumpId, socket: 'trigger' } }],
        ['e3', { id: 'e3', from: { nodeId: evSpinId, socket: 'onClick' }, to: { nodeId: aSpinId, socket: 'trigger' } }],
        ['e4', { id: 'e4', from: { nodeId: evNotifyId, socket: 'onClick' }, to: { nodeId: emitNotifyId, socket: 'trigger' } }],
      ],
      layout: [],
    },
    actions: [
      [jumpActionId, {
        id: jumpActionId,
        name: 'Jump',
        playMode: 'once',
        range: [0, 0.5],
        duration: 0.5,
        tracks: [
          {
            id: 'trk_jump_y',
            layerId: 'pic',
            channel: 'y',
            keyframes: [
              { time: 0,    value: 88, interpolation: 'linear' },
              { time: 0.25, value: 30, interpolation: 'linear' },
              { time: 0.5,  value: 88, interpolation: 'linear' },
            ],
          },
        ],
      }],
      [spinActionId, {
        id: spinActionId,
        name: 'Spin',
        playMode: 'loop',
        range: [0, 1],
        duration: 1,
        tracks: [
          {
            id: 'trk_spin_rot',
            layerId: 'pic',
            channel: 'rotation',
            keyframes: [
              { time: 0, value: 0,   interpolation: 'linear' },
              { time: 1, value: 360, interpolation: 'linear' },
            ],
          },
        ],
      }],
    ],
    meta: { title: 'Stage 6 out-events smoke', desc: 'auto-emit ready + manual notify' },
    _assets: [
      [pngId, { kind: 'png', payload: { dataURL: pngPath, width: 64, height: 64, hash: 'sha256:pink-test' } }],
    ],
  };

  const zip = new JSZipPkg();
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('cfg.json', JSON.stringify(cfg, null, 2));
  zip.file(pngPath, makeSolidPng(64, 64, [0xff, 0x66, 0xaa]));
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function main() {
  if (!existsSync(OUTDIR)) mkdirSync(OUTDIR, { recursive: true });

  const stage3 = await buildStage3();
  const stage3Out = join(OUTDIR, 'stage3.dr.zip');
  writeFileSync(stage3Out, stage3);
  console.log(`[build-fixture] ✓ ${stage3Out} — ${stage3.length} bytes`);

  const stage4 = await buildStage4();
  const stage4Out = join(OUTDIR, 'stage4.dr.zip');
  writeFileSync(stage4Out, stage4);
  console.log(`[build-fixture] ✓ ${stage4Out} — ${stage4.length} bytes`);

  const stage5 = await buildStage5();
  const stage5Out = join(OUTDIR, 'stage5.dr.zip');
  writeFileSync(stage5Out, stage5);
  console.log(`[build-fixture] ✓ ${stage5Out} — ${stage5.length} bytes`);

  const stage6 = await buildStage6();
  const stage6Out = join(OUTDIR, 'stage6.dr.zip');
  writeFileSync(stage6Out, stage6);
  console.log(`[build-fixture] ✓ ${stage6Out} — ${stage6.length} bytes`);
}

main().catch((err) => {
  console.error('[build-fixture] FAIL:', err);
  process.exit(1);
});
