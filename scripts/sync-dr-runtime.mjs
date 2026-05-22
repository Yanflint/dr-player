#!/usr/bin/env node
// scripts/sync-dr-runtime.mjs — копирует snapshot dr-runtime'а из соседнего
// репозитория Yanflint/deepreview в src/dr-runtime.js + обновляет
// dr-runtime.lock. Stage 2 эпика dr-player-v1 (2026-05-22).
//
// **Workflow:**
//   1. В deepreview правится js/dr-runtime/ или одна из re-export'нутых зон.
//   2. В deepreview `npm run dr-runtime-build` пересобирает dist/dr-runtime.js.
//   3. Здесь `npm run dr-runtime-sync`:
//      - копирует ../deepreview/deepreview/dist/dr-runtime.js → src/dr-runtime.js.
//      - читает HEAD SHA из ../deepreview/.git/.
//      - считает sha256 hash скопированного файла.
//      - перезаписывает dr-runtime.lock { sha, builtAt, hash }.
//   4. Commit src/dr-runtime.js (попадёт в gitignore! — это by design, dr-runtime.js
//      generated через sync, не коммитится — каждый CI build делает свой sync.)
//      Commit dr-runtime.lock — он содержит координаты snapshot'а для CI freshness check'а.
//
// **Cross-repo path:** ../deepreview/deepreview/dist/dr-runtime.js.
// Объяснение двух уровней: Yanflint/deepreview — корень git-репо. Внутри — папка
// `deepreview/` (исторически), где живёт реальный app + dist/. dr-player —
// sibling к корню репо deepreview, поэтому относительный путь — два уровня вглубь.

import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLAYER_ROOT = resolve(__dirname, '..');

// Override через ENV для CI (где deepreview лежит не как sibling). По умолчанию —
// sibling папка ../deepreview/ (корень репо), внутри неё — папка deepreview/ (app).
const DEEPREVIEW_REPO = process.env.DEEPREVIEW_REPO_PATH
  ? resolve(process.env.DEEPREVIEW_REPO_PATH)
  : resolve(PLAYER_ROOT, '..', 'deepreview');
const DEEPREVIEW_APP = join(DEEPREVIEW_REPO, 'deepreview');
const SOURCE_FILE = join(DEEPREVIEW_APP, 'dist', 'dr-runtime.js');

const TARGET_FILE = join(PLAYER_ROOT, 'src', 'dr-runtime.js');
const LOCK_FILE = join(PLAYER_ROOT, 'dr-runtime.lock');

function fail(msg) {
  console.error(`[sync-dr-runtime] FAIL: ${msg}`);
  process.exit(1);
}

function main() {
  if (!existsSync(DEEPREVIEW_REPO)) {
    fail(`не найден sibling repo ../deepreview/ (${DEEPREVIEW_REPO}). Клонируй Yanflint/deepreview рядом с dr-player/.`);
  }
  if (!existsSync(SOURCE_FILE)) {
    fail(`не найден ${SOURCE_FILE}.\nЗапусти в deepreview: \`cd ../deepreview/deepreview && npm run dr-runtime-build\` — он соберёт dist/dr-runtime.js.`);
  }

  let sha = 'unknown';
  try {
    sha = execSync('git rev-parse HEAD', { cwd: DEEPREVIEW_REPO, encoding: 'utf8' }).trim();
  } catch (_) {
    console.warn('[sync-dr-runtime] не удалось прочитать HEAD SHA deepreview — оставляю "unknown".');
  }

  copyFileSync(SOURCE_FILE, TARGET_FILE);
  const bytes = readFileSync(TARGET_FILE);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const sizeKb = (bytes.length / 1024).toFixed(1);

  const lock = {
    sha,
    builtAt: new Date().toISOString(),
    hash,
    sourceRepo: 'Yanflint/deepreview',
    sourcePath: 'deepreview/dist/dr-runtime.js',
    sizeBytes: bytes.length,
  };
  writeFileSync(LOCK_FILE, JSON.stringify(lock, null, 2) + '\n', 'utf8');

  console.log(`[sync-dr-runtime] ✓ src/dr-runtime.js — ${sizeKb}KB`);
  console.log(`[sync-dr-runtime] ✓ dr-runtime.lock — sha ${sha.slice(0, 12)} | hash ${hash.slice(0, 16)}...`);
}

main();
