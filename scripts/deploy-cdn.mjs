#!/usr/bin/env node
// scripts/deploy-cdn.mjs — upload production bundle на cdn.deepreview.ru
// (Yandex Object Storage S3-compatible). Stage 8c эпика dr-player-v1
// (2026-05-23) — финальный publish ceremony.
//
// **Что загружается:**
//   dr-player@<version>.min.js      — pinned, immutable (max-age=1 year).
//   dr-player@<version>.min.js.map  — pinned, immutable.
//   dr-player@<version>.d.ts        — pinned, immutable.
//   dr-player@<major>.min.js        — alias latest 1.x (max-age=1 hour).
//   dr-player@latest.min.js         — alias current (max-age=1 hour).
//
// **Aliases только при stable release** (без -alpha/-beta/-rc в version).
//
// **Pre-flight check:** pinned versioned URL не должен существовать на
// CDN. Если есть — fail (защита от случайной перезаписи). Bypass —
// флаг `--force`.
//
// **ENV required:**
//   S3_ENDPOINT=https://storage.yandexcloud.net  (default)
//   S3_REGION=ru-central1                         (default)
//   S3_ACCESS_KEY_ID=...                          (required)
//   S3_SECRET_ACCESS_KEY=...                      (required)
//
// **CLI flags:**
//   --bucket=NAME        bucket name (default: dr-player-cdn)
//   --version=X.Y.Z      override package.json version
//   --no-aliases         не обновлять @major / @latest aliases
//   --dry-run            показать что будет загружено, без реального upload
//   --force              перезаписать pinned URL даже если уже существует
//
// **Output:**
//   Список URL'ов всех загруженных файлов + SRI hash для main bundle
//   (sha384-base64) — копируется в README dr-player и editor.html
//   integrity attribute.
//
// Bucket pre-requisite (настраивается один раз через Yandex Cloud Console):
//   - Static website hosting enabled.
//   - Public read permissions для всех файлов.
//   - CORS: Access-Control-Allow-Origin: *
//   - Custom domain: cdn.deepreview.ru (DNS CNAME → bucket).

import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DIST_DIR = join(ROOT, 'dist');
const PKG_PATH = join(ROOT, 'package.json');

const S3_ENDPOINT = process.env.S3_ENDPOINT || 'https://storage.yandexcloud.net';
const S3_REGION = process.env.S3_REGION || 'ru-central1';
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || '';
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || '';

const CACHE_IMMUTABLE = 'public, max-age=31536000, immutable';
const CACHE_ALIAS = 'public, max-age=3600';

function fail(msg) {
  console.error(`[deploy-cdn] FAIL: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { bucket: 'dr-player-cdn', version: null, aliases: true, dryRun: false, force: false };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--bucket=')) args.bucket = a.slice('--bucket='.length);
    else if (a.startsWith('--version=')) args.version = a.slice('--version='.length);
    else if (a === '--no-aliases') args.aliases = false;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else fail(`неизвестный флаг: ${a}`);
  }
  return args;
}

function contentTypeFor(filename) {
  if (filename.endsWith('.min.js')) return 'application/javascript; charset=utf-8';
  if (filename.endsWith('.map')) return 'application/json; charset=utf-8';
  if (filename.endsWith('.d.ts')) return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

function sriHash(buffer) {
  const h = createHash('sha384').update(buffer).digest('base64');
  return `sha384-${h}`;
}

function isStableVersion(v) {
  // X.Y.Z без -alpha/-beta/-rc/-pre — stable.
  return /^\d+\.\d+\.\d+$/.test(v);
}

function majorOf(v) {
  return v.split('.')[0];
}

async function objectExists(s3, bucket, key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404 || err.name === 'NotFound') return false;
    throw err;
  }
}

async function uploadObject(s3, bucket, key, body, contentType, cacheControl, dryRun) {
  const sizeKb = (body.length / 1024).toFixed(1);
  if (dryRun) {
    console.log(`[deploy-cdn] [dry-run] PUT ${key} (${sizeKb}KB, ${contentType}, cache: ${cacheControl})`);
    return;
  }
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: cacheControl,
  }));
  console.log(`[deploy-cdn] ✓ ${key} (${sizeKb}KB)`);
}

async function main() {
  const args = parseArgs(process.argv);

  if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    fail('S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY не заданы в env. Положи их в `.env.deploy` или экспортируй перед запуском.');
  }

  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf8'));
  const version = args.version || pkg.version;
  if (!version || typeof version !== 'string') fail('version не определена ни в --version, ни в package.json');

  const stable = isStableVersion(version);
  const major = majorOf(version);

  console.log(`[deploy-cdn] bucket=${args.bucket}  version=${version}  stable=${stable}  endpoint=${S3_ENDPOINT}`);

  const bundlePath = join(DIST_DIR, 'dr-player.min.js');
  const mapPath = join(DIST_DIR, 'dr-player.min.js.map');
  const dtsPath = join(DIST_DIR, 'dr-player.d.ts');

  for (const p of [bundlePath, mapPath, dtsPath]) {
    try { statSync(p); } catch { fail(`файл не найден: ${p}. Запусти \`npm run build\` сначала.`); }
  }

  const bundleBuf = readFileSync(bundlePath);
  const mapBuf = readFileSync(mapPath);
  const dtsBuf = readFileSync(dtsPath);

  const integrity = sriHash(bundleBuf);
  console.log(`[deploy-cdn] SRI: ${integrity}`);

  const s3 = new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
  });

  // Pre-flight check: pinned версия не должна существовать (immutable contract).
  const pinnedKey = `dr-player@${version}.min.js`;
  if (!args.dryRun && !args.force) {
    const exists = await objectExists(s3, args.bucket, pinnedKey);
    if (exists) {
      fail(`${pinnedKey} уже существует на CDN. Pinned URL должен быть immutable.\nЕсли действительно хочешь перезаписать — добавь --force (нарушает SRI hash у уже встроенных сайтов).`);
    }
  }

  // 1. Pinned versioned files (immutable).
  await uploadObject(s3, args.bucket, `dr-player@${version}.min.js`, bundleBuf,
    contentTypeFor('dr-player.min.js'), CACHE_IMMUTABLE, args.dryRun);
  await uploadObject(s3, args.bucket, `dr-player@${version}.min.js.map`, mapBuf,
    contentTypeFor('dr-player.min.js.map'), CACHE_IMMUTABLE, args.dryRun);
  await uploadObject(s3, args.bucket, `dr-player@${version}.d.ts`, dtsBuf,
    contentTypeFor('dr-player.d.ts'), CACHE_IMMUTABLE, args.dryRun);

  // 2. Aliases — только для stable release.
  if (stable && args.aliases) {
    await uploadObject(s3, args.bucket, `dr-player@${major}.min.js`, bundleBuf,
      contentTypeFor('dr-player.min.js'), CACHE_ALIAS, args.dryRun);
    await uploadObject(s3, args.bucket, `dr-player@${major}.min.js.map`, mapBuf,
      contentTypeFor('dr-player.min.js.map'), CACHE_ALIAS, args.dryRun);
    await uploadObject(s3, args.bucket, `dr-player@latest.min.js`, bundleBuf,
      contentTypeFor('dr-player.min.js'), CACHE_ALIAS, args.dryRun);
    await uploadObject(s3, args.bucket, `dr-player@latest.min.js.map`, mapBuf,
      contentTypeFor('dr-player.min.js.map'), CACHE_ALIAS, args.dryRun);
  } else if (!stable) {
    console.log(`[deploy-cdn] version ${version} — pre-release, aliases (@${major}, @latest) пропущены`);
  }

  // Summary.
  const base = `https://cdn.deepreview.ru`;
  console.log('');
  console.log('[deploy-cdn] === SUMMARY ===');
  console.log(`[deploy-cdn] Pinned (recommended for production):`);
  console.log(`[deploy-cdn]   ${base}/dr-player@${version}.min.js`);
  console.log(`[deploy-cdn]   integrity="${integrity}"`);
  if (stable && args.aliases) {
    console.log(`[deploy-cdn] Aliases (auto-updating):`);
    console.log(`[deploy-cdn]   ${base}/dr-player@${major}.min.js  (latest ${major}.x)`);
    console.log(`[deploy-cdn]   ${base}/dr-player@latest.min.js     (current)`);
  }
  if (args.dryRun) {
    console.log('[deploy-cdn] (dry-run — реальный upload не сделан)');
  }
}

main().catch((err) => {
  console.error('[deploy-cdn] FAIL:', err.message || err);
  if (err.$metadata) console.error('[deploy-cdn] metadata:', err.$metadata);
  process.exit(1);
});
