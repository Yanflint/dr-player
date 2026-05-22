// src/customElement.js — `<dr-player>` custom element с closed Shadow DOM.
// Stage 4 эпика dr-player-v1 (2026-05-22).
//
// **Назначение:**
// Player.mount(el) создаёт экземпляр `<dr-player>` и вставляет его в `el`
// (страница хоста — ok.ru / любой сайт разработчика). Внутри `<dr-player>` —
// closed Shadow DOM с isolated styles + stage area, куда mount-логика
// добавляет per-layer DOM (img / video / lottie SVG container / solid div /
// text div). После attach'а страница хоста видит только `<dr-player>` —
// внутренний DOM невидим через `document.querySelector` ХОСТА.
//
// **Что даёт Shadow DOM (см. spec эпика → Архитектурное решение 1):**
// 1. Стили страницы хоста (`body * { color: red }`) не текут в плеер.
// 2. Стили плеера (`:host`, `.dr-layer`) не текут на страницу.
// 3. Скрипты страницы не могут случайно поломать DOM плеера через
//    `document.querySelector('img')` (image слои невидимы).
// 4. closed mode — даже `element.shadowRoot` возвращает `null` снаружи
//    (защита от случайных правок сторонними скриптами).
//
// **CSP-friendly:**
// Inline `<style>` элемент в Shadow root — это НЕ `unsafe-inline` для CSP.
// `unsafe-inline` относится к `<style>` атрибутам и `style=""` атрибутам
// в HTML — а Shadow DOM `<style>` создаётся через `document.createElement`,
// не парсится из HTML-строки. Безопасен под `style-src 'self'`.
//
// **define()-singleton:**
// `customElements.define('dr-player', ...)` можно вызвать только один раз
// глобально — повторный вызов кидает `NotSupportedError`. Поэтому функция
// `defineCustomElement()` проверяет `customElements.get('dr-player')` и
// делает define только если ещё не определён. Безопасно вызывать сколько
// угодно раз (например, при создании каждого Player'а).

const TAG = 'dr-player';

// Inline стили Shadow root. `:host` — стилизация самого `<dr-player>`
// элемента (он block по умолчанию, чтобы width/height на нём срабатывали).
// `.dr-stage` — контейнер всех слоёв (canvas size IA-слоя).
// `.dr-layer` — каждый слой; transform применяется тут, internal img/video/svg
// растягивается на 100% (но Lottie SVG имеет свой rendererSettings —
// preserveAspectRatio: 'none' уже учитан в mount logic).
const SHADOW_STYLES = `
:host {
  display: block;
  position: relative;
  overflow: hidden;
  contain: layout style;
}
.dr-stage {
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
}
.dr-layer {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  pointer-events: none;
}
.dr-layer img,
.dr-layer video {
  display: block;
  width: 100%;
  height: 100%;
}
.dr-layer .dr-lottie {
  width: 100%;
  height: 100%;
}
.dr-layer .dr-text {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: pre-wrap;
  overflow: hidden;
}
.dr-layer .dr-solid {
  position: absolute;
  inset: 0;
}
`;

class DrPlayerElement extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = SHADOW_STYLES;
    const stage = document.createElement('div');
    stage.className = 'dr-stage';
    shadow.appendChild(style);
    shadow.appendChild(stage);
    // Сохраняем ссылку на stage в private property — Player.mount её
    // достаёт через `el._drStage`. closed mode прячет shadowRoot снаружи,
    // но внутри bundle'а dr-player'а доступ через свойство — это OK.
    /** @type {HTMLDivElement} */
    this._drStage = stage;
  }
}

/**
 * Зарегистрировать `<dr-player>` если ещё не зарегистрирован. Безопасно
 * вызывать несколько раз (повторные вызовы — no-op).
 *
 * @returns {void}
 */
export function defineCustomElement() {
  if (typeof customElements === 'undefined') {
    throw new Error('[dr-player] customElements API недоступен в этой среде.');
  }
  if (customElements.get(TAG)) return;
  customElements.define(TAG, DrPlayerElement);
}

/**
 * Создать новый `<dr-player>` элемент. Гарантирует что `defineCustomElement`
 * вызван заранее.
 *
 * @returns {HTMLElement & { _drStage: HTMLDivElement }}
 */
export function createDrPlayerElement() {
  defineCustomElement();
  return /** @type {HTMLElement & { _drStage: HTMLDivElement }} */ (
    document.createElement(TAG)
  );
}

export const DR_PLAYER_TAG = TAG;
