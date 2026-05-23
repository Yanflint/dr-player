// Global test setup для vitest (jsdom env).
//
// jsdom не реализует `URL.createObjectURL` / `URL.revokeObjectURL` — это
// historically (jsdom 20+) и в текущей версии (29) функция отсутствует
// или throws при вызове. Player.load в Stage 3 активно использует
// createObjectURL для перевода asset blob'ов в blob: URL'ы.
//
// Безусловно подменяем эти методы детерминистичным mock'ом (`blob:mock-<n>`)
// перед каждым тестом. Тогда:
//   - Player.load работает без throw'а.
//   - `URL.revokeObjectURL` spies в тестах detect cleanup-вызовы.
//   - Mock детерминистичен — каждый createObjectURL возвращает новый
//     URL, revoke получает тот же string.
//
// Stage 8b (2026-05-23, ADR-0010): Lottie mock (`vi.mock('../src/lottie.js')`)
// удалён — Lottie больше не часть .dr.zip формата, src/lottie.js удалён вместе
// с src/lottie-umd.cjs. Lottie-слои в legacy fixture'ах → graceful skip,
// тесты проверяют counter `skippedLottieLayers` в loaded / mounted events.

import { beforeEach, vi } from 'vitest';

// IntersectionObserver (Stage 5): не реализован в jsdom. mount() с
// `autoPause: true` (default) подписывает `<dr-player>` на observer для
// pause при out-of-viewport. Глобальный mock — controllable spy через
// `_lastInstance` static reference (теsты могут вручную fire callback
// с `{ isIntersecting: true/false }` чтобы проверить _pause/_resume).
/** @type {any} */
let _lastIntersectionObserverInstance = null;
class MockIntersectionObserver {
  /** @param {(entries: any[]) => void} cb @param {any} [opts] */
  constructor(cb, opts) {
    this._cb = cb;
    this._opts = opts;
    this._observed = new Set();
    this.disconnect = vi.fn(() => { this._observed.clear(); });
    this.observe = vi.fn((/** @type {Element} */ el) => { this._observed.add(el); });
    this.unobserve = vi.fn((/** @type {Element} */ el) => { this._observed.delete(el); });
    this.takeRecords = vi.fn(() => []);
    _lastIntersectionObserverInstance = this;
  }
  /** Test helper: дёрнуть callback с заданным isIntersecting. */
  _fireIntersection(isIntersecting) {
    const entries = [...this._observed].map((el) => ({
      target: el,
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
    }));
    this._cb(entries);
  }
}
/** @type {any} */
const _globalScope = globalThis;
_globalScope.IntersectionObserver = MockIntersectionObserver;
/**
 * Test helper: получить ссылку на последний созданный observer instance.
 * @returns {any}
 */
export function getLastIntersectionObserver() {
  return _lastIntersectionObserverInstance;
}

beforeEach(() => {
  let counter = 0;
  URL.createObjectURL = vi.fn(() => `blob:mock-${++counter}`);
  URL.revokeObjectURL = vi.fn();
  _lastIntersectionObserverInstance = null;
});
