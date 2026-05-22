# @deepreview/player

JS-плеер для интерактивных анимаций Deepreview (формат `.dr.zip`).

**Status:** in development — Stage 2 of 8 (skeleton).

## Quick start

(skeleton — будет в Stage 8)

## Architecture

Эпик `dr-player-v1` живёт в репозитории [Yanflint/deepreview](https://github.com/Yanflint/deepreview):

- [Spec эпика](https://github.com/Yanflint/deepreview/blob/dev/deepreview/docs/specs/dr-player-v1/README.md)
- [Stage 1 postmortem](https://github.com/Yanflint/deepreview/blob/dev/deepreview/docs/specs/dr-player-v1/stage-1-postmortem.md)
- [docs/dr-runtime.md](https://github.com/Yanflint/deepreview/blob/dev/deepreview/docs/dr-runtime.md) — зона `js/dr-runtime/`, snapshot которой потребляет dr-player через sync-script

## Development

```bash
npm install
npm run dr-runtime-sync   # копирует ../deepreview/deepreview/dist/dr-runtime.js + lock
npm run build             # esbuild → dist/dr-player.min.js
npm run dev               # local server :8090 → http://localhost:8090/tests/manual.html
```

## License

MIT
