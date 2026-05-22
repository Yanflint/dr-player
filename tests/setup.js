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

import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  let counter = 0;
  URL.createObjectURL = vi.fn(() => `blob:mock-${++counter}`);
  URL.revokeObjectURL = vi.fn();
});
