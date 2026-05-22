// src/jszip.js — ESM-обёртка для UMD-копии JSZip 3.10.x.
//
// **Почему UMD .cjs, а не npm import 'jszip':**
// npm-пакет JSZip 3.x имеет shim `lib/readable-stream-browser.js` с
// `require('stream')` — Node-only stdlib. esbuild при browser-bundling не
// stub'ит `stream` автоматически (browserify/webpack/vite делают это через
// node-polyfills). Самый CSP-friendly путь — pre-bundled UMD `dist/jszip.min.js`:
// все readable-stream шiмы inline'ed, никаких node deps, никаких dynamic
// requires.
//
// **Почему .cjs расширение для UMD-файла:**
// При ESM-режиме (vitest + Node.js "type": "module" + esbuild) UMD-код,
// импортированный как `.js`, не получает локальных `module` / `exports`
// переменных и пишет JSZip в `globalThis.JSZip`. Это работает в browser-IIFE
// bundle'е, но в vitest-окружении (vite-node) UMD ведёт себя иначе и не
// выставляет global.
// Переименовав файл в `.cjs`, мы заставляем Node.js / vite / esbuild
// интерпретировать его как CommonJS-модуль — UMD корректно идёт по ветке
// `module.exports = JSZip()`, и default ESM import возвращает конструктор.
// Pattern работает и в bundle (esbuild делает CJS↔ESM interop), и в vitest.
//
// **Размер:**
// jszip.min.js ~95KB raw, ~30KB gzipped — попадает в budget по spec'у эпика
// (общий dr-player target ~120KB gzipped после Stage 5 с Lottie).

import JSZipUMD from './jszip-umd.cjs';

if (typeof JSZipUMD !== 'function') {
  throw new Error('[dr-player] JSZip UMD не вернул конструктор — bundle повреждён.');
}

/** @type {{ loadAsync(buf: ArrayBuffer | Uint8Array | Blob, opts?: any): Promise<any> } & Function} */
const JSZip = JSZipUMD;

export default JSZip;
