# tests/fixtures/

Синтетические `.dr.zip` файлы для локального тестирования плеера.

## Stage 2 — empty

Реальный fixture `stage2.dr.zip` появится в Stage 3 эпика (когда `Player.load()`
будет реализован). Пока `tests/manual.html` использует ссылку на
`fixtures/stage2.dr.zip` только для проверки что `Player.load()` корректно
бросает Error в Stage 2 (fetch может fail'нуть, это ожидаемо).

## Stage 3+ — структура fixture'а

Каждый `.dr.zip` — стандартный ZIP-архив с:

- `manifest.json` — `{ formatVersion: "1.0", triggers: [...], inputs: [...], ... }`.
- `cfg.json` — serialized IA snapshot (canvas + layers + eventGraph + actions + library).
- `assets/<assetId>.<ext>` — бинарные ассеты (PNG / Lottie JSON / video).

Подробности формата `.dr.zip` — в `docs/dr-runtime.md` и spec'е эпика
`docs/specs/dr-player-v1/` в репо [Yanflint/deepreview](https://github.com/Yanflint/deepreview).
