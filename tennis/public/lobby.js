// tennis/public/lobby.js - Modern Lobby, Mode & Rounds Selection, Real Player Names, and Structured Report Card
(() => {
  let selectedMode = 'ai'; // 'ai' or 'pvp'
  let targetRounds = 3;    // 1, 2, or 3 rounds (each round first to 7 points)
  let p1Name = 'Player 1';
  let p2Name = 'Player 2';

  const code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');
  const wsUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  let ws = null;
  const phoneUrl = `${location.origin}/phone.html?code=${code}`;
  const connectedPlayers = new Set();

  window.roomCode = code;
  window.gameMode = selectedMode;
  window.targetRounds = targetRounds;
  window.playerNames = { p1: p1Name, p2: p2Name };

  function connectSocket() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    ws = new WebSocket(wsUrl);
    window.ws = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'host', code, mode: selectedMode }));
    };

    ws.addEventListener('message', e => {
      let m;
      try { m = JSON.parse(e.data); } catch (_err) { return; }

      if (m.type === 'joined') {
        connectedPlayers.add(m.player);
        updateLobbyUI();
      } else if (m.type === 'player_left') {
        connectedPlayers.delete(m.player);
        updateLobbyUI();
      } else if (m.type === 'player_name') {
        if (m.player === 1) p1Name = m.name || 'Player 1';
        if (m.player === 2) p2Name = m.name || 'Player 2';
        window.playerNames = { p1: p1Name, p2: p2Name };
        updateLobbyUI();
      }

      // Forward swing to game engine
      if (m.type === 'swing' && typeof window.onTennisSwing === 'function') {
        window.onTennisSwing(m);
      }
    });

    ws.onclose = () => {
      setTimeout(connectSocket, 2000);
    };
  }

  // Inject styles for Lobby, Mode Select, and Report Card
  function injectStyles() {
    if (document.getElementById('lobby-styles')) return;
    const style = document.createElement('style');
    style.id = 'lobby-styles';
    style.textContent = `
      .glass-modal {
        position: fixed; inset: 0; z-index: 9999;
        background: radial-gradient(circle at 50% 30%, #153828 0%, #081a13 100%);
        color: #f5fff8; font-family: system-ui, -apple-system, sans-serif;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 24px; box-sizing: border-box; text-align: center;
      }
      .mode-card {
        background: rgba(255,255,255,0.06); border: 2px solid rgba(199,243,107,0.25);
        border-radius: 20px; padding: 22px 28px; width: 320px; cursor: pointer;
        transition: all 0.2s ease; text-align: left;
      }
      .mode-card:hover, .mode-card.selected {
        background: rgba(199,243,107,0.14); border-color: #c7f36b;
        transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.4);
      }
      .round-pill {
        background: rgba(255,255,255,0.08); border: 2px solid rgba(199,243,107,0.25);
        border-radius: 14px; padding: 14px 22px; cursor: pointer; text-align: center;
        flex: 1; min-width: 130px; transition: all 0.2s;
      }
      .round-pill:hover, .round-pill.selected {
        background: rgba(199,243,107,0.2); border-color: #c7f36b;
        transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.3);
      }
      .mode-badge {
        display: inline-block; padding: 4px 10px; border-radius: 8px;
        font-size: 13px; font-weight: 700; letter-spacing: 0.5px;
        background: #c7f36b; color: #0f271d; margin-bottom: 12px;
      }
      .btn-primary {
        background: #c7f36b; color: #0d251c; border: none; font-weight: 800;
        font-size: 18px; padding: 14px 34px; border-radius: 14px; cursor: pointer;
        transition: transform 0.15s, background 0.15s;
      }
      .btn-primary:hover { background: #b8ea57; transform: scale(1.03); }
      .btn-secondary {
        background: rgba(255,255,255,0.12); color: #f5fff8; border: 1px solid rgba(255,255,255,0.25);
        font-weight: 600; font-size: 15px; padding: 10px 20px; border-radius: 12px; cursor: pointer;
      }
      .btn-secondary:hover { background: rgba(255,255,255,0.2); }
      .report-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 900px; width: 100%;
        margin: 16px 0; text-align: left;
      }
      .report-card {
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);
        border-radius: 16px; padding: 18px 22px;
      }
      .metric-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 15px;
      }
      .metric-val { font-weight: 700; font-variant-numeric: tabular-nums; }
      .score-table {
        width: 100%; border-collapse: collapse; margin: 12px 0 16px;
      }
      .score-table th, .score-table td {
        padding: 8px 14px; text-align: center; border: 1px solid rgba(255,255,255,0.14);
      }
      .score-table th { background: rgba(255,255,255,0.08); color: #c7f36b; font-weight: 700; }
    `;
    document.head.appendChild(style);
  }

  // Render Mode & Rounds Selection screen
  function renderSetupScreen() {
    const lobby = document.getElementById('lobby');
    if (!lobby) return;
    lobby.className = 'glass-modal';
    lobby.style.display = 'flex';

    lobby.innerHTML = `
      <div style="max-width: 820px; width: 100%;">
        <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:8px;">
          <span style="font-size:38px;">🎾</span>
          <h1 style="font-size: 44px; margin: 0; font-weight: 900; letter-spacing: -1px;">PHONE TENNIS</h1>
        </div>
        <p style="font-size: 20px; color: #b7d6c5; margin: 0 0 28px;">Configure Match Format & Rules</p>

        <!-- Mode Select -->
        <div style="font-size: 15px; text-transform: uppercase; letter-spacing: 1.5px; color: #97c2a9; margin-bottom: 10px; font-weight: 700;">
          Step 1: Choose Game Mode
        </div>
        <div style="display:flex; justify-content:center; gap:20px; flex-wrap:wrap; margin-bottom: 26px;">
          <div class="mode-card ${selectedMode === 'ai' ? 'selected' : ''}" id="mode-opt-ai">
            <span class="mode-badge">1 PLAYER</span>
            <h2 style="margin: 0 0 6px; font-size: 24px;">Player vs AI</h2>
            <p style="margin: 0; color: #a9cfb8; font-size: 14px; line-height: 1.4;">
              1 Phone as Racket. Play against tactical AI bot with precise timing.
            </p>
          </div>

          <div class="mode-card ${selectedMode === 'pvp' ? 'selected' : ''}" id="mode-opt-pvp">
            <span class="mode-badge" style="background:#f3a65a;color:#2b1402;">2 PLAYERS</span>
            <h2 style="margin: 0 0 6px; font-size: 24px;">Player vs Player (PvP)</h2>
            <p style="margin: 0; color: #a9cfb8; font-size: 14px; line-height: 1.4;">
              2 Phones as Rackets. Scan same QR code to battle head-to-head!
            </p>
          </div>
        </div>

        <!-- Rounds Select -->
        <div style="font-size: 15px; text-transform: uppercase; letter-spacing: 1.5px; color: #97c2a9; margin-bottom: 10px; font-weight: 700;">
          Step 2: Choose Number of Rounds (7 Points per Round)
        </div>
        <div style="display:flex; justify-content:center; gap:16px; max-width:680px; margin:0 auto 32px;">
          <div class="round-pill ${targetRounds === 1 ? 'selected' : ''}" id="round-opt-1">
            <div style="font-size:22px; font-weight:800; color:#c7f36b;">1 Round</div>
            <div style="font-size:13px; color:#a2caa9; margin-top:2px;">Quick Match · 7 pts</div>
          </div>
          <div class="round-pill ${targetRounds === 2 ? 'selected' : ''}" id="round-opt-2">
            <div style="font-size:22px; font-weight:800; color:#c7f36b;">2 Rounds</div>
            <div style="font-size:13px; color:#a2caa9; margin-top:2px;">Standard · 7 pts each</div>
          </div>
          <div class="round-pill ${targetRounds === 3 ? 'selected' : ''}" id="round-opt-3">
            <div style="font-size:22px; font-weight:800; color:#c7f36b;">3 Rounds</div>
            <div style="font-size:13px; color:#a2caa9; margin-top:2px;">Championship · 7 pts each</div>
          </div>
        </div>

        <button class="btn-primary" id="btn-confirm-setup">Continue to Lobby & QR Code →</button>
      </div>
    `;

    document.getElementById('mode-opt-ai').onclick = () => { selectedMode = 'ai'; renderSetupScreen(); };
    document.getElementById('mode-opt-pvp').onclick = () => { selectedMode = 'pvp'; renderSetupScreen(); };
    document.getElementById('round-opt-1').onclick = () => { targetRounds = 1; renderSetupScreen(); };
    document.getElementById('round-opt-2').onclick = () => { targetRounds = 2; renderSetupScreen(); };
    document.getElementById('round-opt-3').onclick = () => { targetRounds = 3; renderSetupScreen(); };

    document.getElementById('btn-confirm-setup').onclick = () => {
      window.gameMode = selectedMode;
      window.targetRounds = targetRounds;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'set_mode', mode: selectedMode, rounds: targetRounds }));
      }
      renderLobbyWithQR();
    };

    window.onkeydown = e => {
      if (lobby.style.display !== 'none' && !document.getElementById('qr-container')) {
        if (e.key === '1') { targetRounds = 1; renderSetupScreen(); }
        if (e.key === '2') { targetRounds = 2; renderSetupScreen(); }
        if (e.key === '3') { targetRounds = 3; renderSetupScreen(); }
        if (e.key === 'Enter') document.getElementById('btn-confirm-setup').click();
      }
    };
  }

  // Render Lobby with QR Code
  function renderLobbyWithQR() {
    const lobby = document.getElementById('lobby');
    if (!lobby) return;
    lobby.className = 'glass-modal';
    lobby.style.display = 'flex';

    lobby.innerHTML = `
      <div id="qr-container" style="max-width: 850px; width: 100%; display:flex; flex-direction:column; align-items:center;">
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; margin-bottom:12px;">
          <button class="btn-secondary" id="btn-back-mode" style="padding:8px 16px; font-size:14px;">← Change Format</button>
          <span style="font-size:14px; font-weight:700; color:#c7f36b; background:rgba(199,243,107,0.12); padding:6px 14px; border-radius:100px;">
            ${selectedMode === 'pvp' ? '👥 2P PLAYER VS PLAYER' : '👤 1P VS AI'} &nbsp;·&nbsp; ${targetRounds} ROUND${targetRounds > 1 ? 'S' : ''} (7 PTS EACH)
          </span>
          <div style="width:100px;"></div>
        </div>

        <h1 style="font-size: 36px; margin: 0 0 6px; font-weight: 800;">Turn Your Phone Into a Racket</h1>
        <p style="font-size: 17px; color: #c5e3d1; margin: 0 0 18px;">
          ${selectedMode === 'pvp' ? 'Both players scan this same QR code or enter code on their phone' : 'Scan to connect phone as Player 1'}
        </p>

        <div style="display:flex; gap:32px; align-items:center; justify-content:center; flex-wrap:wrap; margin-bottom: 20px;">
          <div style="background:#fff; padding:16px; border-radius:18px; box-shadow:0 12px 30px rgba(0,0,0,0.5);">
            <div id="qr"></div>
          </div>

          <div style="text-align:left; max-width:320px;">
            <div style="font-size:13px; text-transform:uppercase; letter-spacing:1px; color:#95bfa6;">Room Code</div>
            <div style="font-size: 50px; font-weight: 900; letter-spacing: 6px; color: #c7f36b; margin: 2px 0 10px;">${code}</div>
            <div style="font-size: 15px; color: #d0edd9; line-height: 1.4;">
              Open <strong style="color:#fff;">${location.host}/phone.html</strong><br>
              Enter code <strong>${code}</strong> & set your player name!
            </div>
          </div>
        </div>

        <!-- Connection indicators -->
        <div id="player-status-box" style="width:100%; max-width:580px; margin-top:6px;"></div>
      </div>
    `;

    document.getElementById('btn-back-mode').onclick = () => {
      renderSetupScreen();
    };

    // Generate QR
    const qrDiv = document.getElementById('qr');
    if (qrDiv) {
      qrDiv.innerHTML = '';
      new QRCode(qrDiv, { text: phoneUrl, width: 210, height: 210 });
    }

    updateLobbyUI();
  }

  // Update connection status indicators with custom names
  function updateLobbyUI() {
    const statusBox = document.getElementById('player-status-box');
    if (!statusBox) return;

    if (selectedMode === 'ai') {
      const p1Connected = connectedPlayers.has(1) || connectedPlayers.size > 0;
      statusBox.innerHTML = `
        <div style="background:rgba(255,255,255,0.07); border-radius:14px; padding:14px 20px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:18px; font-weight:600;">🎾 ${p1Name} (Player 1)</span>
          <span style="font-size:15px; font-weight:700; color:${p1Connected ? '#c7f36b' : '#f5fff888'};">
            ${p1Connected ? '✅ Ready & Registered' : '⏳ Waiting for phone scan...'}
          </span>
        </div>
      `;

      if (p1Connected) {
        statusBox.innerHTML += `<p style="color:#c7f36b; font-weight:700; margin-top:14px; font-size:20px;">${p1Name} ready! Starting Round 1 in 1s...</p>`;
        setTimeout(() => {
          startGame();
        }, 1200);
      }
    } else {
      // PvP mode
      const p1 = connectedPlayers.has(1);
      const p2 = connectedPlayers.has(2) || connectedPlayers.size >= 2;
      statusBox.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div style="background:rgba(255,255,255,0.07); border-radius:12px; padding:12px 16px;">
            <div style="font-size:16px; font-weight:700; color:#c7f36b;">🟢 ${p1Name}</div>
            <div style="font-size:14px; margin-top:4px; color:${p1 ? '#c7f36b' : '#9bbba7'};">
              ${p1 ? '✅ Ready!' : '⏳ Scan QR to join'}
            </div>
          </div>
          <div style="background:rgba(255,255,255,0.07); border-radius:12px; padding:12px 16px;">
            <div style="font-size:16px; font-weight:700; color:#f3a65a;">🟠 ${p2Name}</div>
            <div style="font-size:14px; margin-top:4px; color:${p2 ? '#c7f36b' : '#9bbba7'};">
              ${p2 ? '✅ Ready!' : '⏳ Scan SAME QR'}
            </div>
          </div>
        </div>
      `;

      if (connectedPlayers.size >= 2) {
        statusBox.innerHTML += `<p style="color:#c7f36b; font-weight:700; margin-top:14px; font-size:20px;">Both players ready! Match starting in 1s...</p>`;
        setTimeout(() => {
          startGame();
        }, 1500);
      }
    }
  }

  function startGame() {
    const lobby = document.getElementById('lobby');
    if (lobby) lobby.style.display = 'none';
    if (window.onGameStart) {
      window.onGameStart({
        mode: selectedMode,
        targetRounds: targetRounds,
        p1Name: p1Name,
        p2Name: selectedMode === 'pvp' ? p2Name : 'AI Nadal'
      });
    }
  }

  // Structured Multi-Round Results & Fitness Report Card
  window.showResults = function (report) {
    const r = document.getElementById('results');
    if (!r) return;
    injectStyles();

    r.className = 'glass-modal';
    r.style.display = 'flex';

    // Broadcast report to connected phones so their report card appears simultaneously!
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'report', report }));
    }

    const p1 = report.p1 || {};
    const p2 = report.p2 || {};
    const isPvp = report.mode === 'pvp';
    const nameP1 = p1.name || p1Name;
    const nameP2 = p2.name || (isPvp ? p2Name : 'AI Nadal');

    // Build Round-by-Round HTML table
    let roundsHtml = '';
    if (report.rounds && report.rounds.length > 0) {
      roundsHtml = `
        <table class="score-table">
          <thead>
            <tr>
              <th>Round</th>
              <th>${nameP1}</th>
              <th>${nameP2}</th>
              <th>Round Winner</th>
            </tr>
          </thead>
          <tbody>
            ${report.rounds.map(rd => `
              <tr>
                <td>Round ${rd.round}</td>
                <td><strong style="font-size:18px;">${rd.p1Score}</strong></td>
                <td><strong style="font-size:18px;">${rd.p2Score}</strong></td>
                <td style="color:#c7f36b; font-weight:700;">${rd.winner}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    r.innerHTML = `
      <div style="max-width: 960px; width: 100%;">
        <div style="font-size:40px; margin-bottom: 2px;">🏆</div>
        <h1 style="font-size: 40px; margin: 0 0 4px; font-weight: 900; color: #fff;">
          ${report.winner ? `${report.winner.toUpperCase()} WINS THE MATCH!` : 'MATCH COMPLETED!'}
        </h1>
        <p style="font-size: 20px; color: #c7f36b; font-weight: 700; margin: 0 0 10px;">
          SETS WON: ${nameP1} (${report.roundsWon?.p1 || 0}) — (${report.roundsWon?.p2 || 0}) ${nameP2}
        </p>

        <!-- Round by round table -->
        <div style="max-width:680px; margin:0 auto;">
          ${roundsHtml}
        </div>

        <p style="font-size: 14px; color: #a4ceb5; margin: 0 0 14px;">
          ⏱️ Match Duration: ${report.durationSeconds || 0}s &nbsp;·&nbsp; 🔥 Longest Rally: ${report.longestRally || 0} shots
        </p>

        <!-- Side by side player cards -->
        <div class="report-grid">
          <!-- Player 1 Card -->
          <div class="report-card" style="border-left: 4px solid #c7f36b;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h2 style="margin:0; font-size:20px; color:#c7f36b;">${nameP1} (Green)</h2>
              <span class="mode-badge" style="margin:0; background:rgba(199,243,107,0.18); color:#c7f36b;">${p1.intensity || 'Active'}</span>
            </div>
            <div class="metric-row"><span>🔥 Active Calories</span><span class="metric-val" style="color:#c7f36b;">~${p1.calories || 0} kcal</span></div>
            <div class="metric-row"><span>🎾 Total Swings</span><span class="metric-val">${p1.swings || 0} (${p1.forehands || 0}F / ${p1.backhands || 0}B)</span></div>
            <div class="metric-row"><span>🎯 Hit Accuracy</span><span class="metric-val">${p1.accuracy || 0}% (${p1.hits || 0} hits)</span></div>
            <div class="metric-row"><span>⚡ Peak Swing Speed</span><span class="metric-val">${p1.peakSpeedKmh || 0} km/h (${p1.peakPower || 0}%)</span></div>
            <div class="metric-row"><span>📊 Avg Swing Power</span><span class="metric-val">${p1.avgPower || 0}%</span></div>
          </div>

          <!-- Player 2 / AI Card -->
          <div class="report-card" style="border-left: 4px solid #f3a65a;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h2 style="margin:0; font-size:20px; color:#f3a65a;">${nameP2} (Orange)</h2>
              <span class="mode-badge" style="margin:0; background:rgba(243,166,90,0.18); color:#f3a65a;">${p2.intensity || 'Cardio'}</span>
            </div>
            <div class="metric-row"><span>🔥 Active Calories</span><span class="metric-val" style="color:#f3a65a;">~${p2.calories || 0} kcal</span></div>
            <div class="metric-row"><span>🎾 Total Swings</span><span class="metric-val">${p2.swings || 0} (${p2.forehands || 0}F / ${p2.backhands || 0}B)</span></div>
            <div class="metric-row"><span>🎯 Hit Accuracy</span><span class="metric-val">${p2.accuracy || 0}% (${p2.hits || 0} hits)</span></div>
            <div class="metric-row"><span>⚡ Peak Swing Speed</span><span class="metric-val">${p2.peakSpeedKmh || 0} km/h (${p2.peakPower || 0}%)</span></div>
            <div class="metric-row"><span>📊 Avg Swing Power</span><span class="metric-val">${p2.avgPower || 0}%</span></div>
          </div>
        </div>

        <!-- TV-ONLY ACTION BUTTONS -->
        <div style="display:flex; gap:16px; justify-content:center; align-items:center; margin-top:16px;">
          <button class="btn-primary" id="btn-play-again" style="font-size:18px; padding:14px 32px;">
            🔄 Play Again / Retry Match
          </button>
          <button class="btn-secondary" id="btn-change-mode" style="font-size:16px; padding:12px 24px;">
            🎮 Switch Mode & Rounds
          </button>
        </div>
        <p style="color:#8db79f; font-size:13px; margin-top:10px;">
          Official fitness certificates are downloadable as PDF on connected phones.
        </p>
      </div>
    `;

    document.getElementById('btn-play-again').onclick = () => {
      r.style.display = 'none';
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'restart' }));
      }
      if (window.onGameStart) {
        window.onGameStart({
          mode: selectedMode,
          targetRounds: targetRounds,
          p1Name: p1Name,
          p2Name: selectedMode === 'pvp' ? p2Name : 'AI Nadal'
        });
      }
    };

    document.getElementById('btn-change-mode').onclick = () => {
      r.style.display = 'none';
      renderSetupScreen();
    };

    window.onkeydown = e => {
      if (r.style.display !== 'none' && (e.key === 'Enter' || e.key === ' ')) {
        document.getElementById('btn-play-again').click();
      }
    };
  };

  // Boot up
  function init() {
    injectStyles();
    connectSocket();
    renderSetupScreen();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
