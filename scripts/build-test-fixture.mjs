#!/usr/bin/env node
// scripts/build-test-fixture.mjs — детерминистично собирает
// tests/fixtures/stage3.dr.zip для manual.html и smoke-проверки.
//
// Fixture минимальный, но валидный по контракту .dr.zip (formatVersion "1.0"):
//   manifest.json — formatVersion + triggers + inputs + canvas + counts.
//   cfg.json      — пустой snapshot (canvas + один PNG-слой через assetId).
//   assets/<id>.png — 1×1 прозрачный PNG (минимальный бинарь).
//
// Запуск: `npm run build-fixture`.

import JSZipPkg from 'jszip';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const OUTDIR = join(ROOT, 'tests', 'fixtures');
const OUTFILE = join(OUTDIR, 'stage3.dr.zip');

// 1×1 прозрачный PNG (67 байт). Base64 → bytes ниже.
const TRANSPARENT_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function base64ToBytes(b64) {
  const bin = Buffer.from(b64, 'base64');
  return new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength);
}

async function main() {
  if (!existsSync(OUTDIR)) mkdirSync(OUTDIR, { recursive: true });

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
      {
        id: 'layer_1',
        type: 'png',
        name: 'TestLayer',
        assetId,
        x: 50,
        y: 50,
        w: 100,
        h: 100,
      },
    ],
    eventGraph: { nodes: [], edges: [], layout: [] },
    actions: [],
    meta: { title: '', desc: '' },
    _assets: [
      [
        assetId,
        {
          kind: 'png',
          payload: {
            dataURL: assetPath,
            width: 1,
            height: 1,
            hash: 'sha256:test',
          },
        },
      ],
    ],
  };

  const zip = new JSZipPkg();
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('cfg.json', JSON.stringify(cfg, null, 2));
  zip.file(assetPath, base64ToBytes(TRANSPARENT_PNG_B64));

  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  writeFileSync(OUTFILE, buf);
  console.log(`[build-fixture] ✓ ${OUTFILE} — ${buf.length} bytes`);
}

main().catch((err) => {
  console.error('[build-fixture] FAIL:', err);
  process.exit(1);
});
