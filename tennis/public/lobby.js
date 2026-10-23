const code = Array.from({length:4}, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random()*24)]).join('');
const wsUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
const ws = new WebSocket(wsUrl);
const phoneUrl = `${location.origin}/phone.html?code=${code}`;

// Expose for tv.html game integration
window.ws = ws;
window.roomCode = code;

ws.onopen = () => ws.send(JSON.stringify({ type: 'host', code }));

// Lobby UI
function initLobby() {
  const lobby = document.getElementById('lobby');
  if (!lobby) return;
  lobby.style.cssText = 'position:fixed;inset:0;background:#0b3d2e;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;text-align:center;z-index:999';
  lobby.innerHTML = `
    <h1 style="font-size:64px;margin:0">Phone Tennis</h1>
    <p style="font-size:28px">Scan to turn your phone into a racket</p>
    <div id="qr" style="background:#fff;padding:16px;border-radius:12px"></div>
    <p style="font-size:36px;letter-spacing:10px">Room: ${code}</p>
    <p id="status" style="font-size:24px;opacity:.8">Waiting for a player...</p>`;
  new QRCode(document.getElementById('qr'), { text: phoneUrl, width: 260, height: 260 });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLobby);
} else {
  initLobby();
}

// Messages: Person B's game also listens on ws; use addEventListener so both work
ws.addEventListener('message', e => {
  let m;
  try {
    m = JSON.parse(e.data);
  } catch (_err) {
    return;
  }
  if (m.type === 'joined') {
    const lobby = document.getElementById('lobby');
    const statusEl = (lobby && lobby.querySelector('#status')) || document.getElementById('status');
    if (statusEl) statusEl.textContent = 'Player ' + m.player + ' connected!';
    setTimeout(() => {
      if (lobby) lobby.style.display = 'none';
      if (window.onGameStart) window.onGameStart();
    }, 1200);
  }
  if (m.type === 'swing' && typeof window.onTennisSwing === 'function') {
    window.onTennisSwing(m);
  }
});

// Results screen
window.showResults = function (stats) {
  const r = document.getElementById('results');
  if (!r) return;
  const s = stats || {};
  const calories = Math.round((s.swings || 0) * 0.6);   // rough estimate for the demo
  r.style.cssText = 'position:fixed;inset:0;background:#0b3d2e;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;text-align:center;z-index:999';
  r.innerHTML = `
    <h1 style="font-size:64px">${s.won ? 'You win!' : 'Good match!'}</h1>
    <p style="font-size:32px">Swings: ${s.swings || 0} &nbsp; Hits: ${s.hits || 0}</p>
    <p style="font-size:32px">Peak power: ${Math.round((s.peak || 0)*100)}% &nbsp; ~${calories} kcal</p>
    <p style="font-size:24px;opacity:.8">Press OK to play again</p>`;
  r.style.display = 'flex';
};

addEventListener('keydown', e => {
  if (e.key === 'Enter') location.reload();
});
