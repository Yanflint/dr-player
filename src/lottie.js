// src/lottie.js — ESM-обёртка для UMD-копии lottie-web 5.x (SVG-renderer-only).
// Stage 4 эпика dr-player-v1 (2026-05-22).
//
// **Какой Lottie:** `lottie_svg.min.js` — облегчённая сборка lottie-web 5.x
// только с SVG-renderer'ом (без canvas, без html, без expressions runtime).
// Размер 223KB raw (~75KB gzipped). Достаточно для всех After Effects
// экспортов которые делает Deepreview editor (preview deepreview сейчас
// тоже использует `renderer: 'svg'` — см. `js/preview/previewMain.js` Stage 4
// section). Если в будущем понадобится canvas renderer (например для
// performance на low-end devices) — Stage 4 эпика V1.x.
//
// **Почему UMD .cjs, а не npm import 'lottie-web':**
// По аналогии с JSZip (Stage 3 compromise): npm registry / CDN заблокированы
// в текущей среде Алексея, UMD pre-bundled — самый CSP-friendly путь без
// node deps и dynamic require.
//
// **Почему .cjs расширение:**
// Заставляет esbuild / vite-node / vitest интерпретировать файл как CommonJS.
// UMD-обёртка lottie 5.x:
//   !function(t,e){
//     "object"==typeof exports && "undefined"!=typeof module
//       ? module.exports = e()        // CJS branch — наш путь
//       : "function"==typeof define && define.amd
//         ? define(e)                 // AMD
//         : (t = globalThis || self).lottie = e()  // global
//   }(this, function(){ ... return lottie })
// `.cjs` → CJS-branch → `module.exports = lottie` → default ESM import
// возвращает объект lottie с loadAnimation method'ом.
//
// **Top-level browser-only код:**
// Lottie вызывает `navigator.userAgent` / `document.createElement` на
// top-level (определение isSafari + helpers). Это означает: в node без
// jsdom — `lottie-umd.cjs` бросит при require. В browser / jsdom (vitest)
// — работает. В тестах mock'аем `lottie.loadAnimation` через `vi.mock`
// до import'а, чтобы не зависеть от реального DOM-creation Lottie SVG
// renderer'а.
//
// **Размер bundle:**
// Stage 3 был 142KB minified (UMD JSZip ~95KB raw + Player.load logic).
// Stage 4: + UMD Lottie SVG ~223KB raw + customElement + mount logic +
// dr-runtime helpers → ожидание 370-400KB minified, ~120-130KB gzipped
// (target spec'а ~120KB gzipped — на границе, можно ужать дальше).
//
// **Compromise зафиксирован:** UMD Lottie 5.x из локальной Bodymovin copy
// (Mar 4 2022 vintage, 5.9.x примерно). Альтернативы (npm install / CDN
// download) недоступны в этой среде. **Пересмотр** Stage 8 эпика: перед
// publish'ем обновить на актуальную lottie-web 5.12.x (CVE fixes,
// performance улучшения). Workflow:
//   1. npm install lottie-web@latest, copy dist/lottie_svg.min.js.
//   2. Или curl https://unpkg.com/lottie-web@latest/build/player/lottie_svg.min.js.
//   3. Replace src/lottie-umd.cjs, npm test + build + manual smoke.

import lottieUMD from './lottie-umd.cjs';

if (!lottieUMD || typeof lottieUMD.loadAnimation !== 'function') {
  throw new Error('[dr-player] Lottie UMD не вернул объект с loadAnimation — bundle повреждён.');
}

/**
 * @typedef {Object} LottieAnimationItem
 * @property {() => void} play
 * @property {() => void} pause
 * @property {() => void} stop
 * @property {(value: number, isFrame?: boolean) => void} goToAndStop
 * @property {(eventName: string, callback: Function) => void} addEventListener
 * @property {() => void} destroy
 * @property {boolean} loop
 */

/**
 * @typedef {Object} LottieLoadOptions
 * @property {HTMLElement} container
 * @property {'svg'} renderer В SVG-only сборке — только 'svg'.
 * @property {boolean} loop
 * @property {boolean} autoplay
 * @property {any} animationData Parsed Lottie JSON (объект, не строка).
 * @property {{ preserveAspectRatio?: string }} [rendererSettings]
 */

/**
 * @typedef {Object} LottieAPI
 * @property {(opts: LottieLoadOptions) => LottieAnimationItem} loadAnimation
 */

/** @type {LottieAPI} */
const lottie = /** @type {LottieAPI} */ (lottieUMD);

export default lottie;
