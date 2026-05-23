// dr-player — CSP-restrictive smoke bootstrap. Внешний файл потому что
// CSP `script-src 'self'` запрещает inline <script> в HTML.
//
// Что делает: при DOMContentLoaded — new Player → load fixture → mount →
// pipe events в #status / #events. Любое нарушение CSP попадёт в console
// и не будет вызывать каких-либо runtime-исключений в этом скрипте.

document.addEventListener('DOMContentLoaded', async () => {
  /** @type {any} */
  const DP = /** @type {any} */ (window).DrPlayer;
  const statusEl = document.getElementById('status');
  const eventsEl = document.getElementById('events');
  const widgetEl = document.getElementById('widget');

  if (!DP || !DP.Player) {
    statusEl.textContent = 'window.DrPlayer.Player не найден — bundle не загружен или CSP заблокировала.';
    return;
  }

  function log(line) {
    eventsEl.textContent = (eventsEl.textContent + '\n' + line).trim();
  }

  const player = new DP.Player({ autoPause: false });

  player.on('loaded', (payload) => {
    statusEl.textContent = 'loaded: ' + JSON.stringify(payload, null, 2);
  });
  player.on('mounted', (payload) => {
    log('mounted: ' + JSON.stringify(payload));
  });
  player.on('error', (payload) => {
    statusEl.textContent = 'ERROR ' + payload.code + ': ' + payload.message;
  });
  player.on('trigger', (payload) => {
    log('trigger: ' + JSON.stringify(payload));
  });
  // Stage 6: подписка на out-events из Emit-нод.
  for (const name of ['ready', 'notified', 'liked', 'tap']) {
    player.on('event:' + name, (payload) => {
      log('event:' + name + ' ' + JSON.stringify(payload));
    });
  }

  try {
    await player.load('./fixtures/stage6.dr.zip');
    player.mount(widgetEl);
  } catch (err) {
    // error event уже сработал.
  }
});
