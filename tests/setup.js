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
// Lottie UMD (Stage 4): `src/lottie-umd.cjs` использует `navigator.userAgent`
// / `document.createElement` на top-level (определение isSafari + helpers).
// В jsdom-env это работает, но 223KB UMD load — лишний overhead на каждый
// test-import. Mock'аем `src/lottie.js` глобально: подмена возвращает
// stub-объект с `loadAnimation()` который создаёт fake AnimationItem с
// `vi.fn()`-методами. Тесты которым нужно проверить контракт вызова
// (например, что loadAnimation был вызван с правильным container + JSON)
// — импортят сам mock и используют `vi.mocked(lottie).loadAnimation.mock.calls`.

import { beforeEach, vi } from 'vitest';

vi.mock('../src/lottie.js', () => {
  const loadAnimation = vi.fn((opts) => {
    /** @type {any} */
    const inst = {
      _opts: opts,
      loop: !!opts.loop,
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      goToAndStop: vi.fn(),
      addEventListener: vi.fn(),
      destroy: vi.fn(),
    };
    return inst;
  });
  return { default: { loadAnimation } };
});

beforeEach(() => {
  let counter = 0;
  URL.createObjectURL = vi.fn(() => `blob:mock-${++counter}`);
  URL.revokeObjectURL = vi.fn();
});
