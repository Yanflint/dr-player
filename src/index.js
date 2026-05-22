// dr-player public API entry. Stage 2 — skeleton only.
//
// Реальная реализация методов — Stages 3-6 эпика dr-player-v1:
//   Stage 3 → load() (.dr.zip parse + asset blob URLs).
//   Stage 4 → mount() (Shadow DOM + static render).
//   Stage 5 → runtime (rAF + IntersectionObserver auto-pause).
//   Stage 6 → trigger/set/on/off + полный набор out-events.

import * as runtime from './dr-runtime.js';

const STAGE = 2;

export class Player {
  constructor(opts = {}) {
    this._opts = { autoPause: true, ...opts };
    this._listeners = new Map();
    this._mounted = false;
    this._loaded = false;
    console.log(`[dr-player] Stage ${STAGE} skeleton OK`);
  }

  async load(_input) {
    throw new Error('[dr-player] Player.load — реализуется в Stage 3 эпика');
  }

  mount(_el) {
    throw new Error('[dr-player] Player.mount — реализуется в Stage 4 эпика');
  }

  unmount() {
    throw new Error('[dr-player] Player.unmount — реализуется в Stage 4 эпика');
  }

  trigger(_name) {
    throw new Error('[dr-player] Player.trigger — реализуется в Stage 6 эпика');
  }

  set(_input, _value) {
    throw new Error('[dr-player] Player.set — реализуется в Stage 6 эпика');
  }

  on(event, cb) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(cb);
  }

  off(event, cb) {
    const set = this._listeners.get(event);
    if (set) set.delete(cb);
  }

  destroy() {
    this._listeners.clear();
  }
}

export { runtime };

export const VERSION = '1.0.0-alpha.1';
export const STAGE_NUMBER = STAGE;
