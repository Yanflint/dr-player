# @deepreview/player

> JS-плеер для интерактивных анимаций Deepreview (формат `.dr.zip`). Один
> файл, Shadow DOM-изоляция, CSP-friendly, IntersectionObserver auto-pause.

**Версия:** `1.0.0-beta.2` (Stage 8b эпика dr-player-v1, 2026-05-23).
**Bundle:** ~144 KB minified, ~50 KB gzipped.

---

## 📦 Что это

dr-player проигрывает виджет, экспортированный из редактора Deepreview в
формате `.dr.zip`. Внутри `.dr.zip` — `manifest.json` (метаданные + список
триггеров и input'ов), `cfg.json` (граф событий, слои, actions), папка
`assets/` (PNG / video).

`.dr.zip` — наш собственный формат интерактивных анимаций на channels +
eventGraph + Actions. **Альтернатива Lottie**, не смесь — Lottie-слои не
поддерживаются (см. [ADR-0010](https://github.com/Yanflint/deepreview/blob/dev/docs/adr/0010-lottie-not-part-of-ia-format.md)).
Используй Lottie для линейных анимаций без интерактива (через свой плеер
`lottie-web`), а `.dr.zip` — когда нужны триггеры / inputs / out-events.

Что делает плеер при загрузке:

1. Скачивает архив одним HTTP-запросом, парсит его в браузере (JSZip
   inline в bundle, никакого сетевого второго запроса).
2. Создаёт `<dr-player>` custom element с **closed** Shadow DOM —
   стили хост-страницы не текут внутрь, стили плеера не текут наружу.
3. Рендерит первый кадр всех слоёв (PNG / `<video>` / solid / text).
4. Компилирует граф событий: `Start` ноды стреляют сразу, `Event(trigger)`
   ноды ждут `player.trigger(name)`, Action runner двигает слои по
   keyframe'ам.
5. Подписывается на `IntersectionObserver` (threshold 0.1) — при выходе
   виджета из viewport останавливает sprite RAF / video, при возврате —
   resume. Это критично для лент с десятками виджетов.

---

## 🚀 Быстрый старт — Hello World

Минимальный пример. Копируется и работает out of the box после `npm publish`:

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Hello dr-player</title>

  <!-- Production: cdn.deepreview.com/dr-player@1.0.0.min.js (после Stage 8c).
       Universal: jsdelivr автоматически serve'ит npm-package. -->
  <script src="https://cdn.jsdelivr.net/npm/@deepreview/player@1.0.0-beta.2/dist/dr-player.min.js"
          defer></script>
</head>
<body>
  <div id="my-widget" style="width: 300px; height: 300px;"></div>

  <script>
    document.addEventListener('DOMContentLoaded', async () => {
      const player = new DrPlayer.Player({ autoPause: true });

      player.on('loaded', ({ triggers, layerCount }) => {
        console.log(`Виджет готов: ${layerCount} слоёв, ${triggers.length} триггеров`);
      });
      player.on('error', ({ code, message }) => {
        console.error(`[dr-player] ${code}: ${message}`);
      });

      try {
        await player.load('https://your-cdn.com/widgets/Button.dr.zip');
        player.mount(document.querySelector('#my-widget'));
      } catch (err) {
        // error event уже сработал; здесь только UI fallback (если нужен).
      }
    });
  </script>
</body>
</html>
```

**Запустить триггер из UI хоста** (например клик по кнопке снаружи виджета):

```js
document.querySelector('#like-btn').addEventListener('click', () => {
  player.trigger('like-clicked');
});
```

**Подписаться на внутренние события виджета** (Emit-нода в графе):

```js
player.on('event:like-anim-finished', ({ payload }) => {
  okru.uplift('button-liked', payload);
});
```

---

## 🛡 Content Security Policy

Плеер работает под restrictive CSP без `unsafe-eval` и `unsafe-inline`.
Минимальный header для встраивающей страницы:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' cdn.jsdelivr.net cdn.deepreview.com;
  img-src 'self' blob:;
  media-src 'self' blob:;
  connect-src 'self' your-cdn.com;
```

(Замените `your-cdn.com` на хост откуда вы раздаёте `.dr.zip`.
`cdn.jsdelivr.net` — пока bundle живёт там; `cdn.deepreview.com` —
production CDN после Stage 8b.)

**Что плеер делает и не делает:**

| Действие | Делает | Не делает |
|---|---|---|
| HTTP-запросы | один `fetch` за `.dr.zip` | внешние скрипты / стили / шрифты |
| DOM-мутации | внутри Shadow DOM `<dr-player>` | вне своего root'а |
| `eval` / `new Function` | нет | — |
| `<script>` injection | нет | — |
| `<style>` через innerHTML | нет | — |
| `<style>` через `createElement` (CSP-OK) | да, в Shadow root | — |
| `blob:` URLs для ассетов | да (PNG / video) | `data:` URLs |
| Доступ к `document.cookie` / `localStorage` | нет | — |
| Top-level `setTimeout` / `setInterval` | нет (только `requestAnimationFrame`) | — |

Плеер ничего не пишет в `window.*` кроме одного namespace `window.DrPlayer`
(IIFE bundle). Никаких глобальных prototype-патчей.

---

## 📚 API Reference

### `new DrPlayer.Player(opts?)`

Создаёт инстанс плеера. Один Player — один widget.

**opts:**
- `autoPause?: boolean = true` — при `true` плеер автоматически
  останавливает sprite RAF / video когда widget вне viewport (через
  `IntersectionObserver`, threshold 0.1). При `false` — играет всегда.
  Для лент с десятками виджетов — обязательно `true`. Для
  fullscreen-баннера — `false`.

```js
const p = new DrPlayer.Player({ autoPause: true });
```

### `await player.load(input)`

Загружает `.dr.zip`. После resolve — emit `loaded` event.

**input:** `string` (URL) **или** `Blob` (уже загруженный архив).

**Возвращает:** `Promise<void>` — resolves когда snapshot готов к
`mount()`.

**Ошибки:** на любую — emit `error` event **и** reject Promise с тем же
payload `{ code, message, cause? }`. Это даёт две идиомы:

```js
// Идиома 1 — try/catch:
try {
  await player.load(url);
} catch (err) {
  // err.code === 'LOAD_FAILED' | 'PARSE_FAILED' | 'FORMAT_VERSION_MISMATCH'
}

// Идиома 2 — event listener:
player.on('error', ({ code, message }) => { ... });
await player.load(url);
```

**`code` enum:**

| Код | Когда |
|---|---|
| `LOAD_FAILED` | `fetch` упал (сеть, HTTP не-200, CORS). |
| `PARSE_FAILED` | Архив битый, или отсутствуют `manifest.json` / `cfg.json`. |
| `FORMAT_VERSION_MISMATCH` | `.dr.zip` собран более новой версией редактора с breaking-change формата. |

**Повторный `load()`** — idempotent: cleanup'ит предыдущий state (revoke
blob URLs) и загружает заново. Удобно для лент где widget'ы меняются на
лету.

### `player.mount(el)`

Создаёт `<dr-player>` внутри `el`, render'ит первый кадр всех слоёв,
стартует runtime. Sync API: при возврате DOM уже attached.

**el:** `HTMLElement` — контейнер на странице хоста.

**Throws:** `MOUNT_FAILED` если:
- `el` не HTMLElement.
- Player не в `loaded` state (`mount` без `load`).

Параллельно emit'ит `error` event. При успехе — `mounted` event с
`{ width, height, skippedLottieLayers? }`. `skippedLottieLayers`
присутствует только если в `.dr.zip` были legacy Lottie-слои (значение —
количество пропущенных).

Повторный `mount(el)` — idempotent (unmount предыдущий → mount новый).

### `player.unmount()`

Снимает плеер со страницы. Cancel sprite RAF, IntersectionObserver
disconnect, video pause + load, removeChild `<dr-player>`. Идемпотент
(повторный вызов — no-op).

**Внимание:** blob URLs **не** revoke'ятся в `unmount` — caller может
`mount → unmount → mount` без повторного `load`. Полный cleanup (revoke
URLs + clear listeners) делает `destroy()`.

Emit `unmounted` event.

### `player.trigger(name)`

Запустить триггер по имени. Сработает на каждую `Event`-ноду графа с
`sourceType='trigger'` и `triggerName === name`.

**name:** `string`.

**Возвращает:** `boolean` — `true` если был хотя бы один зарегистрированный
handler. Используйте для UI-feedback («неизвестный триггер» при `false`).

Emit `trigger` event с `{ name, source: 'external' }`.

До `mount` — warning + `false` (не throw).

### `player.set(input, value)`

Установить значение named input. Используется хост-страницей для подачи
внешних значений (scroll position, drag-handle, slider) в граф событий.

V1.0.0: API стабилен и принимается, значение хранится в `inputsState`.
Реальное связывание (input → channel value через input-ноду графа) —
будет в V1.x когда input-ноды появятся в IA-редакторе. Сейчас разработчик
может писать `set()` заранее и контракт не сломается.

**input:** `string` (non-empty).
**value:** любое JSON-serializable значение.

До `mount` — warning + no-op (значение теряется; типичный flow:
`load → mount → set`).

### `player.on(event, cb)` / `player.off(event, cb)`

Subscribe / unsubscribe. Один callback регистрируется единожды (Set
внутри). Buggy listener (бросает) — ловится в `try/catch`, остальные
listener'ы продолжают, throw уходит в `console.error`.

**События:**

| Event | Когда | Payload |
|---|---|---|
| `loaded` | После `load()` resolve | `{ layerCount, triggers: string[], inputs: any[], skippedLottieLayers: number }` |
| `error` | На любую ошибку | `{ code, message, cause? }` |
| `mounted` | После `mount()` | `{ width, height, skippedLottieLayers? }` (поле опционально, только если > 0) |
| `unmounted` | После `unmount()` | `{}` |
| `trigger` | При срабатывании любого триггера | `{ name, source: 'external' \| 'internal' }` |
| `event:<name>` | При срабатывании Emit-ноды в графе | `{ payload: any }` |

**`skippedLottieLayers`** (Stage 8b, ADR-0010): если в `.dr.zip` есть
legacy Lottie-слои (тип `lottie` в `cfg.json`), они gracefully
пропускаются плеером (не рендерятся, не занимают место). Counter в
event payload — для UI feedback / telemetry разработчика. `console.warn`
со ссылкой на ADR-0010 выводится при `load()`.

`source: 'external'` = вызвал хост через `player.trigger()`;
`source: 'internal'` = граф событий сработал сам (например, по таймеру
или цепочке).

### `player.destroy()`

Final cleanup: unmount (если mounted) + revoke blob URLs + clear
listeners. После `destroy()` инстанс использовать нельзя.

---

## 🩺 Troubleshooting

### `FORMAT_VERSION_MISMATCH`

`.dr.zip` собран более новой версией редактора с breaking change формата.
Обнови dr-player до major matching `.dr.zip formatVersion`:

```js
player.on('error', ({ code, message }) => {
  if (code === 'FORMAT_VERSION_MISMATCH') {
    console.error(message); // содержит requested vs supported версии
    // UI fallback: показать static image, попросить обновить страницу.
  }
});
```

### `MOUNT_FAILED`

Две причины из текста message:

- `«Player.mount: ожидался HTMLElement как первый аргумент.»` — передан
  `null` / `undefined` / не-DOM. Проверь, что `document.querySelector('#widget')`
  возвращает реальный элемент (DOM уже загружен).
- `«Player.mount вызван до Player.load — нет snapshot для рендера.»` —
  нарушен порядок. Всегда `await load()` ДО `mount()`.

### CSP violations

В DevTools → Console увидишь сообщения вида:
```
Refused to load the script ... violates Content Security Policy directive: "script-src 'self'"
```

- `script-src` — добавь хост откуда грузишь `dr-player.min.js`
  (`cdn.jsdelivr.net` или `cdn.deepreview.com` или твой self-host) рядом с `'self'`.
- `connect-src` — добавь хост откуда грузишь `.dr.zip`.
- `img-src` + `media-src` — обязательно `blob:` (плеер генерирует
  `blob:`-URLs для ассетов внутри `.dr.zip`).

### Lottie не поддерживается в `.dr.zip`

С версии `1.0.0-beta.2` (Stage 8b, [ADR-0010](https://github.com/Yanflint/deepreview/blob/dev/docs/adr/0010-lottie-not-part-of-ia-format.md))
dr-player НЕ рендерит Lottie-слои. Lottie — отдельный формат для линейных
анимаций без интерактива; наш IA-формат `.dr.zip` — альтернатива для
интерактивных виджетов (триггеры, inputs, цепочки событий), не смесь.

Если в твоём `.dr.zip` есть Lottie-слои (legacy архив, экспортированный
до Stage 8b редактора Deepreview):
- Они gracefully пропускаются с `console.warn` со ссылкой на ADR-0010.
- `loaded` event payload содержит `skippedLottieLayers: <число>`.
- `mounted` payload — то же поле опционально (только если > 0).
- Плеер продолжает рендерить остальные слои (PNG / video / solid / text).

Чтобы убрать Lottie-слои из архива: открой проект в редакторе Deepreview,
пересоздай анимацию через Action на channels (наш формат), или вынеси
Lottie в главный проект как отдельный слой и используй `.dr.zip` только
для интерактивной части. Опция экспорта `omitLottieLayers: true` (по
умолчанию) автоматически фильтрует Lottie из `.dr.zip`.

### Виджет «дёргается» при scroll

`autoPause: true` (default) останавливает анимации при выходе виджета из
viewport. Возврат → re-play. На медленных устройствах переход pause↔play
может выглядеть резко. Если widget должен играть всегда —
`new Player({ autoPause: false })`.

### Производительность падает при многих виджетах

Каждый Player — собственный rAF-loop. На странице 30+ виджетов = 30+
rAF, что грузит CPU даже при auto-pause (один loop на каждый mounted
плеер). Рекомендации:

- Lazy mount: не вызывай `mount()` пока widget не появился в viewport
  (своим `IntersectionObserver` на placeholder div'е).
- `autoPause: true` — обязательно для ленты.

V2 рассматривает централизованный rAF (один loop на все Player'ы) —
будет если кейс реально вылезет.

---

## ⚡ Performance tips

- **`autoPause: true`** для лент — обязательно. Без него CPU взорвётся на
  10+ widget'ах.
- **Lazy `mount()`** — `player.load(url)` загружает + парсит сразу. Если
  widget может никогда не появиться в viewport — отложи `mount()` до
  своего IntersectionObserver на placeholder div'е. Auto-pause работает
  **после** mount'а; он не откладывает сам load.
- **Pinned version** в production — `@1.0.0`, не `@latest`. CDN кэширует
  pinned bundle на год (`max-age=31536000, immutable`); `@latest` имеет
  TTL ~1 час.
- **Один Player — один widget.** Не пытайся mount'ить один Player в
  несколько `el`'ов. Для нескольких widget'ов — создай по Player инстансу.
- **Reuse через `mount → unmount → mount`** — дешевле чем `destroy + new
  Player + load`. Используй когда widget может появиться снова в том же
  session.

**Бюджет V1:**

| Метрика | Бюджет | Замечание |
|---|---|---|
| FPS | 60 при 10 виджетах (или 30 при 30) | На странице с auto-pause |
| `.dr.zip` size | до 2 MB (warning при >5 MB на экспорте) | PNG + video |
| Memory per widget | до 10 MB | decoded PNG + canvas |
| Bundle size (плеер) | ~144 KB minified, ~50 KB gzipped (Stage 8b) | Без Lottie (ADR-0010) |
| Time to first frame | <500 ms на medium device | После `load()` resolve + `mount()` |
| Cold load | <2 s на 3G | CDN edge + Brotli |
| Hot load (cache) | <200 ms | Browser cache + CDN |

---

## 🔁 Migration guide

### `1.0.0-beta.1` → `1.0.0-beta.2` (Stage 8b, 2026-05-23)

**Breaking:** Lottie-слои в `.dr.zip` больше не рендерятся
([ADR-0010](https://github.com/Yanflint/deepreview/blob/dev/docs/adr/0010-lottie-not-part-of-ia-format.md)).
Это поведенческое изменение (не сигнальное `formatVersion` bump'а — он
остаётся `1.0`).

**Что нужно сделать:**
- Если ты не используешь Lottie в `.dr.zip` — ничего, обновление
  bundle прозрачное.
- Если в `.dr.zip` есть Lottie-слои — они gracefully пропускаются с
  `console.warn`. Поведение видимое в `loaded` / `mounted` event
  payload (`skippedLottieLayers: number`). Bundle уменьшился с 367 KB
  → 144 KB minified (-61%).
- Чтобы избежать warning'ов — пересоберай `.dr.zip` в редакторе
  Deepreview (опция `omitLottieLayers: true` в `exportInteractiveLayer`
  по умолчанию включена и автоматически фильтрует Lottie из архива).

**Что не сломалось:**
- API `Player.load / mount / trigger / set / on / off / destroy` —
  без изменений.
- Out-events (`loaded` / `error` / `mounted` / `unmounted` / `trigger` /
  `event:<name>`) — без изменений, только `loaded` / `mounted` получили
  новое поле `skippedLottieLayers` (рекомендуется опционально).
- `.dr.zip` `formatVersion` остаётся `1.0` — старые архивы загружаются
  без `FORMAT_VERSION_MISMATCH`.

### Будущие major bumps (V2.0.0+)

**Правило:** `formatVersion` major bump в редакторе = dr-player major
bump в плеере. Старый `@1.x` плеер на `.dr.zip` v2.0 → graceful `error`
event `FORMAT_VERSION_MISMATCH` (не crash, не throw, не undefined
behavior).

```
.dr.zip formatVersion 1.0 → dr-player @1.x (V1.0.0+)
.dr.zip formatVersion 2.0 → dr-player @2.x (когда выйдет)
```

Minor / patch bumps в плеере — backward-compatible (новые out-events,
новые опции, performance улучшения). Не требуют миграции.

---

## 🛠 Development

```bash
npm install               # esbuild + vitest + jsdom
npm run dr-runtime-sync   # копирует ../deepreview/dist/dr-runtime.js + lock
npm run build             # esbuild → dist/dr-player.min.js
npm test                  # vitest run (~55 unit-cases)
npm run dev               # local serve :8090 → http://localhost:8090/tests/manual.html
```

Cross-repo sync (runtime в `src/dr-runtime.js`) живёт в репозитории
[Yanflint/deepreview](https://github.com/Yanflint/deepreview) (приватный)
— см. `dr-runtime.lock` для зафиксированного SHA-источника. История
эпика и postmortem'ы — в `docs/specs/dr-player-v1/` того же репо.

---

## 🔗 Связанные ссылки

- npm: [@deepreview/player](https://www.npmjs.com/package/@deepreview/player)
- Issues / feature requests: [github.com/Yanflint/dr-player/issues](https://github.com/Yanflint/dr-player/issues)
- Editor (приватный): [github.com/Yanflint/deepreview](https://github.com/Yanflint/deepreview)

---

## 📄 License

MIT — см. [LICENSE](LICENSE).

Copyright © 2026 Yanflint.
