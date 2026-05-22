#!/usr/bin/env node
// scripts/build.mjs — production bundle dr-player'а через esbuild.
// Stage 2 эпика dr-player-v1 (2026-05-22) — пока bundle'ит только skeleton
// (Player class с stub методами). Реальные load/mount/runtime появятся в
// Stages 3-6.
//
// **Output:**
//   dist/dr-player.min.js      — IIFE bundle (window.DrPlayer.Player).
//   dist/dr-player.min.js.map  — source map для отладки.
//
// **esbuild config:**
//   - entry: src/index.js.
//   - format: 'iife' — одна <script src=...> + глобальная window.DrPlayer.
//   - globalName: 'DrPlayer' — потребитель пишет new DrPlayer.Player().
//   - bundle: true — всё inline (dr-runtime, в Stage 3+ JSZip + Lottie).
//   - platform: 'browser'.
//   - target: 'es2020'.
//   - minify: true.
//   - sourcemap: true.
//
// **Перед build'ом обязательно sync:** `npm run dr-runtime-sync` копирует
// src/dr-runtime.js из ../deepreview/deepreview/dist/. Без файла build падает —
// это by design (single source of truth runtime'а в Yanflint/deepreview).

import { build } from 'esbuild';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const ENTRY = join(ROOT, 'src', 'index.js');
const RUNTIME = join(ROOT, 'src', 'dr-runtime.js');
const OUTFILE = join(ROOT, 'dist', 'dr-player.min.js');
const OUTDIR = dirname(OUTFILE);

function fail(msg) {
  console.error(`[build] FAIL: ${msg}`);
  process.exit(1);
}

async function main() {
  if (!existsSync(ENTRY)) fail(`entry не найден: ${ENTRY}`);
  if (!existsSync(RUNTIME)) {
    fail(`src/dr-runtime.js отсутствует.\nЗапусти сначала: \`npm run dr-runtime-sync\` — он скопирует snapshot из соседнего ../deepreview/.`);
  }
  if (!existsSync(OUTDIR)) mkdirSync(OUTDIR, { recursive: true });

  const builtAt = new Date().toISOString();

  await build({
    entryPoints: [ENTRY],
    outfile: OUTFILE,
    bundle: true,
    format: 'iife',
    globalName: 'DrPlayer',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    sourcemap: true,
    banner: {
      js: `/* @deepreview/player | build ${builtAt} | https://github.com/Yanflint/dr-player */`,
    },
    logLevel: 'info',
  });

  const st = statSync(OUTFILE);
  const sizeKb = (st.size / 1024).toFixed(1);
  console.log(`[build] ✓ dist/dr-player.min.js — ${sizeKb}KB minified (build ${builtAt})`);
}

main().catch((err) => {
  console.error('[build] FAIL:', err);
  process.exit(1);
});
