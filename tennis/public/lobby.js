// tennis/public/lobby.js - TV-Optimized Lobby, D-Pad Remote Navigation, 1:1 QR Square, and Multi-Round Report Card
(() => {
  let selectedMode = 'ai'; // 'ai' or 'pvp'
  let targetRounds = 3;    // 1, 2, or 3 rounds (7 points per round)
  let p1Name = 'Player 1';
  let p2Name = 'Player 2';

  const urlParams = new URLSearchParams(window.location.search);
  const codeParam = urlParams.get('code');
  const code = (codeParam && codeParam.trim().length >= 2)
    ? codeParam.trim().toUpperCase().slice(0, 6)
    : Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');
  const wsUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  let ws = null;
  const phoneUrl = `${location.origin}/phone.html?code=${code}`;
  const connectedPlayers = new Set();
  const readyPlayers = new Set(); // Tracks players who have enabled motion sensor

  window.roomCode = code;
  window.gameMode = selectedMode;
  window.targetRounds = targetRounds;
  window.playerNames = { p1: p1Name, p2: p2Name };

  // D-Pad Navigation State
  let currentScreen = 'setup'; // 'setup' | 'qr' | 'results'
  let setupFocus = { row: 0, col: 0 }; // row 0: mode, row 1: rounds, row 2: button
  let resultsFocus = 0; // 0: play again, 1: change mode

  // Match start countdown timer
  let countdownTimer = null;
  let countdownRemaining = 3;

  function cancelLobbyCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    countdownRemaining = 3;
    const cdEl = document.getElementById('lobby-countdown-banner');
    if (cdEl) cdEl.innerHTML = '';
  }

  function startLobbyCountdown() {
    if (countdownTimer) return; // already running
    countdownRemaining = 3;
    renderCountdownOnTV(countdownRemaining);

    countdownTimer = setInterval(() => {
      countdownRemaining--;
      if (countdownRemaining > 0) {
        renderCountdownOnTV(countdownRemaining);
      } else {
        clearInterval(countdownTimer);
        countdownTimer = null;
        startGame();
      }
    }, 1000);
  }

  function renderCountdownOnTV(sec) {
    const cdEl = document.getElementById('lobby-countdown-banner');
    if (!cdEl) return;
    cdEl.innerHTML = `
      <div style="background: rgba(199,243,107,0.18); border: 2px solid #c7f36b; border-radius: 14px; padding: 12px 18px; margin-top: 10px; animation: pulse 0.8s infinite alternate;">
        <div style="font-size: 15px; font-weight: 800; color: #c7f36b; letter-spacing: 1.5px; text-transform: uppercase;">
          🎾 RACKET ACTIVE & READY! GET INTO POSITION!
        </div>
        <div style="font-size: 34px; font-weight: 900; color: #ffffff; margin-top: 2px;">
          Match Starting in ${sec}...
        </div>
      </div>
    `;
  }

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
        readyPlayers.delete(m.player);
        cancelLobbyCountdown();
        updateLobbyUI();
      } else if (m.type === 'player_name') {
        if (m.player === 1) p1Name = m.name || 'Player 1';
        if (m.player === 2) p2Name = m.name || 'Player 2';
        window.playerNames = { p1: p1Name, p2: p2Name };
        updateLobbyUI();
      } else if (m.type === 'player_ready') {
        readyPlayers.add(m.player);
        if (m.name) {
          if (m.player === 1) p1Name = m.name;
          if (m.player === 2) p2Name = m.name;
          window.playerNames = { p1: p1Name, p2: p2Name };
        }
        updateLobbyUI();
      } else if (m.type === 'swing' && typeof m.dir === 'string') {
        // Dual compatibility fallback for ready/name messages
        if (m.dir.startsWith('__ready__:')) {
          const rawName = m.dir.slice(10);
          try {
            const dec = decodeURIComponent(rawName);
            if (m.player === 1) p1Name = dec;
            if (m.player === 2) p2Name = dec;
          } catch (_) {}
          readyPlayers.add(m.player || 1);
          window.playerNames = { p1: p1Name, p2: p2Name };
          updateLobbyUI();
          return;
        }
        if (m.dir.startsWith('__name__:')) {
          const rawName = m.dir.slice(9);
          try {
            const dec = decodeURIComponent(rawName);
            if (m.player === 1) p1Name = dec || 'Player 1';
            if (m.player === 2) p2Name = dec || 'Player 2';
          } catch (_) {}
          window.playerNames = { p1: p1Name, p2: p2Name };
          updateLobbyUI();
          return;
        }
        if (typeof window.onTennisSwing === 'function') {
          window.onTennisSwing(m);
        }
      }
    });

    ws.onclose = () => {
      setTimeout(connectSocket, 2000);
    };
  }

  // Inject CSS optimized for TV screens with zero scrolling
  function injectStyles() {
    if (document.getElementById('lobby-styles')) return;
    const style = document.createElement('style');
    style.id = 'lobby-styles';
    style.textContent = `
      .glass-modal {
        position: fixed; inset: 0; z-index: 9999;
        width: 100vw; height: 100vh; max-height: 100vh;
        overflow: hidden; /* Strict no scroll on TV */
        background: radial-gradient(circle at 50% 35%, #153828 0%, #07160f 100%);
        color: #f5fff8; font-family: system-ui, -apple-system, sans-serif;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 12px 24px; box-sizing: border-box; text-align: center;
        user-select: none;
      }
      .mode-card {
        background: rgba(255,255,255,0.06); border: 2px solid rgba(199,243,107,0.25);
        border-radius: 16px; padding: 14px 20px; width: 280px; cursor: pointer;
        transition: all 0.15s ease; text-align: left; box-sizing: border-box;
      }
      .mode-card.selected {
        background: rgba(199,243,107,0.14); border-color: #c7f36b;
      }
      .round-pill {
        background: rgba(255,255,255,0.08); border: 2px solid rgba(199,243,107,0.25);
        border-radius: 12px; padding: 10px 18px; cursor: pointer; text-align: center;
        flex: 1; min-width: 120px; transition: all 0.15s; box-sizing: border-box;
      }
      .round-pill.selected {
        background: rgba(199,243,107,0.2); border-color: #c7f36b;
      }
      .mode-badge {
        display: inline-block; padding: 3px 8px; border-radius: 6px;
        font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
        background: #c7f36b; color: #0f271d; margin-bottom: 6px;
      }
      .btn-primary {
        background: #c7f36b; color: #0d251c; border: none; font-weight: 800;
        font-size: 16px; padding: 12px 30px; border-radius: 12px; cursor: pointer;
        transition: transform 0.15s, background 0.15s, outline 0.15s;
        box-sizing: border-box;
      }
      .btn-primary:hover { background: #b8ea57; }
      .btn-secondary {
        background: rgba(255,255,255,0.12); color: #f5fff8; border: 1px solid rgba(255,255,255,0.25);
        font-weight: 600; font-size: 14px; padding: 8px 16px; border-radius: 10px; cursor: pointer;
        transition: all 0.15s; box-sizing: border-box;
      }

      /* TV REMOTE D-PAD ACTIVE FOCUS RING */
      .dpad-focus {
        outline: 4px solid #c7f36b !important;
        outline-offset: 3px !important;
        transform: scale(1.04) !important;
        box-shadow: 0 0 24px rgba(199, 243, 107, 0.75) !important;
      }

      /* PERFECT SQUARE QR CONTAINER */
      .qr-card-box {
        background: #ffffff;
        padding: 12px;
        border-radius: 16px;
        box-shadow: 0 10px 28px rgba(0,0,0,0.5);
        width: 204px;
        height: 204px;
        min-width: 204px;
        min-height: 204px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-sizing: border-box;
        overflow: hidden;
      }
      #qr {
        width: 180px;
        height: 180px;
        min-width: 180px;
        min-height: 180px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        padding: 0;
        overflow: hidden;
      }
      #qr canvas {
        display: none; /* Hide canvas fallback once image is rendered */
        width: 180px;
        height: 180px;
      }
      #qr img {
        width: 180px !important;
        height: 180px !important;
        min-width: 180px !important;
        min-height: 180px !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
        object-fit: contain !important;
      }
      #qr canvas[style*="display: none"], #qr img[style*="display: none"] {
        display: none !important;
      }

      /* RESULTS SCREEN TV LAYOUT */
      .report-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 14px; max-width: 820px; width: 100%;
        margin: 10px 0; text-align: left;
      }
      .report-card {
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);
        border-radius: 14px; padding: 12px 18px;
      }
      .metric-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 13.5px;
      }
      .metric-val { font-weight: 700; font-variant-numeric: tabular-nums; }
      .score-table {
        width: 100%; border-collapse: collapse; margin: 8px 0 10px; font-size: 14px;
      }
      .score-table th, .score-table td {
        padding: 5px 12px; text-align: center; border: 1px solid rgba(255,255,255,0.14);
      }
      .score-table th { background: rgba(255,255,255,0.08); color: #c7f36b; font-weight: 700; }
    `;
    document.head.appendChild(style);
  }

  // Update visual focus rings for TV remote
  function updateFocusVisuals() {
    // Remove focus class from all elements
    document.querySelectorAll('.dpad-focus').forEach(el => el.classList.remove('dpad-focus'));

    if (currentScreen === 'setup') {
      let targetId = '';
      if (setupFocus.row === 0) {
        targetId = setupFocus.col === 0 ? 'mode-opt-ai' : 'mode-opt-pvp';
      } else if (setupFocus.row === 1) {
        if (setupFocus.col === 0) targetId = 'round-opt-1';
        else if (setupFocus.col === 1) targetId = 'round-opt-2';
        else targetId = 'round-opt-3';
      } else if (setupFocus.row === 2) {
        targetId = 'btn-confirm-setup';
      }
      const el = document.getElementById(targetId);
      if (el) el.classList.add('dpad-focus');
    } else if (currentScreen === 'qr') {
      const btn = document.getElementById('btn-back-mode');
      if (btn) btn.classList.add('dpad-focus');
    } else if (currentScreen === 'results') {
      const targetId = resultsFocus === 0 ? 'btn-play-again' : 'btn-change-mode';
      const el = document.getElementById(targetId);
      if (el) el.classList.add('dpad-focus');
    }
  }

  // Screen 1: Mode & Rounds Selection (Compact for TV)
  function renderSetupScreen() {
    currentScreen = 'setup';
    const lobby = document.getElementById('lobby');
    if (!lobby) return;
    lobby.className = 'glass-modal';
    lobby.style.display = 'flex';

    lobby.innerHTML = `
      <div style="max-width: 780px; width: 100%;">
        <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-size:30px;">🎾</span>
          <h1 style="font-size: 32px; margin: 0; font-weight: 900; letter-spacing: -0.5px;">PHONE TENNIS</h1>
        </div>
        <p style="font-size: 15px; color: #b7d6c5; margin: 0 0 16px;">Use TV Remote [D-Pad] to select options and press [OK/Select]</p>

        <!-- Mode Select Row -->
        <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; color: #97c2a9; margin-bottom: 8px; font-weight: 700;">
          Step 1: Choose Game Mode
        </div>
        <div style="display:flex; justify-content:center; gap:16px; flex-wrap:wrap; margin-bottom: 18px;">
          <div class="mode-card ${selectedMode === 'ai' ? 'selected' : ''}" id="mode-opt-ai" tabindex="0">
            <span class="mode-badge">1 PLAYER</span>
            <h2 style="margin: 0 0 4px; font-size: 20px;">Player vs AI</h2>
            <p style="margin: 0; color: #a9cfb8; font-size: 13px; line-height: 1.3;">
              1 Phone Racket. Practice & rally against tactical AI.
            </p>
          </div>

          <div class="mode-card ${selectedMode === 'pvp' ? 'selected' : ''}" id="mode-opt-pvp" tabindex="0">
            <span class="mode-badge" style="background:#f3a65a;color:#2b1402;">2 PLAYERS</span>
            <h2 style="margin: 0 0 4px; font-size: 20px;">Player vs Player (PvP)</h2>
            <p style="margin: 0; color: #a9cfb8; font-size: 13px; line-height: 1.3;">
              2 Phone Rackets. Scan same QR to battle head-to-head!
            </p>
          </div>
        </div>

        <!-- Rounds Select Row -->
        <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; color: #97c2a9; margin-bottom: 8px; font-weight: 700;">
          Step 2: Choose Number of Rounds (7 Points per Round)
        </div>
        <div style="display:flex; justify-content:center; gap:14px; max-width:620px; margin:0 auto 20px;">
          <div class="round-pill ${targetRounds === 1 ? 'selected' : ''}" id="round-opt-1" tabindex="0">
            <div style="font-size:18px; font-weight:800; color:#c7f36b;">1 Round</div>
            <div style="font-size:11px; color:#a2caa9; margin-top:2px;">Quick Match · 7 pts</div>
          </div>
          <div class="round-pill ${targetRounds === 2 ? 'selected' : ''}" id="round-opt-2" tabindex="0">
            <div style="font-size:18px; font-weight:800; color:#c7f36b;">2 Rounds</div>
            <div style="font-size:11px; color:#a2caa9; margin-top:2px;">Standard · 7 pts each</div>
          </div>
          <div class="round-pill ${targetRounds === 3 ? 'selected' : ''}" id="round-opt-3" tabindex="0">
            <div style="font-size:18px; font-weight:800; color:#c7f36b;">3 Rounds</div>
            <div style="font-size:11px; color:#a2caa9; margin-top:2px;">Championship · 7 pts each</div>
          </div>
        </div>

        <!-- Action Button -->
        <button class="btn-primary" id="btn-confirm-setup" tabindex="0">
          Continue to Lobby & QR Code →
        </button>
      </div>
    `;

    document.getElementById('mode-opt-ai').onclick = () => { selectedMode = 'ai'; setupFocus.row = 0; setupFocus.col = 0; renderSetupScreen(); };
    document.getElementById('mode-opt-pvp').onclick = () => { selectedMode = 'pvp'; setupFocus.row = 0; setupFocus.col = 1; renderSetupScreen(); };
    document.getElementById('round-opt-1').onclick = () => { targetRounds = 1; setupFocus.row = 1; setupFocus.col = 0; renderSetupScreen(); };
    document.getElementById('round-opt-2').onclick = () => { targetRounds = 2; setupFocus.row = 1; setupFocus.col = 1; renderSetupScreen(); };
    document.getElementById('round-opt-3').onclick = () => { targetRounds = 3; setupFocus.row = 1; setupFocus.col = 2; renderSetupScreen(); };

    document.getElementById('btn-confirm-setup').onclick = () => {
      window.gameMode = selectedMode;
      window.targetRounds = targetRounds;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'set_mode', mode: selectedMode, rounds: targetRounds }));
      }
      renderLobbyWithQR();
    };

    updateFocusVisuals();
  }

  // Screen 2: Lobby with Square QR Code (Compact for TV)
  function renderLobbyWithQR() {
    currentScreen = 'qr';
    const lobby = document.getElementById('lobby');
    if (!lobby) return;
    lobby.className = 'glass-modal';
    lobby.style.display = 'flex';

    lobby.innerHTML = `
      <div id="qr-container" style="max-width: 780px; width: 100%; display:flex; flex-direction:column; align-items:center;">
        <div style="display:grid; grid-template-columns: 1fr auto 1fr; align-items:center; width:100%; margin-bottom:10px;">
          <div style="text-align:left;">
            <button class="btn-secondary" id="btn-back-mode" tabindex="0">← Change Format [Press OK/Back]</button>
          </div>
          <span style="font-size:13px; font-weight:700; color:#c7f36b; background:rgba(199,243,107,0.12); padding:5px 14px; border-radius:100px;">
            ${selectedMode === 'pvp' ? '👥 2P PLAYER VS PLAYER' : '👤 1P VS AI'} &nbsp;·&nbsp; ${targetRounds} ROUND${targetRounds > 1 ? 'S' : ''}
          </span>
          <div></div>
        </div>

        <h1 style="font-size: 28px; margin: 0 0 4px; font-weight: 800;">Scan with Phone to Connect Racket</h1>
        <p style="font-size: 14px; color: #c5e3d1; margin: 0 0 14px;">
          ${selectedMode === 'pvp' ? 'Both players scan this same QR code on their phones' : 'Scan to connect phone as Player 1'}
        </p>

        <div style="display:flex; gap:32px; align-items:center; justify-content:center; flex-wrap:nowrap; margin-bottom: 12px;">
          <!-- 1:1 SQUARE QR CARD -->
          <div class="qr-card-box">
            <div id="qr"></div>
          </div>

          <div style="text-align:left; max-width:320px; flex-shrink:0;">
            <div style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#95bfa6;">Room Code</div>
            <div style="font-size: 46px; font-weight: 900; letter-spacing: 6px; color: #c7f36b; margin: 0 0 6px; line-height: 1;">${code}</div>
            <div style="font-size: 14px; color: #d0edd9; line-height: 1.4;">
              Or go to <strong style="color:#fff;">${location.host}/phone.html</strong><br>
              Enter room <strong style="color:#c7f36b;">${code}</strong> on phone
            </div>
          </div>
        </div>

        <!-- Connection indicators -->
        <div id="player-status-box" style="width:100%; max-width:560px; margin-top:4px;"></div>
      </div>
    `;

    document.getElementById('btn-back-mode').onclick = () => {
      cancelLobbyCountdown();
      renderSetupScreen();
    };

    // Render QR Code as exact square
    const qrDiv = document.getElementById('qr');
    if (qrDiv) {
      qrDiv.innerHTML = '';
      new QRCode(qrDiv, {
        text: phoneUrl,
        width: 180,
        height: 180,
        correctLevel: QRCode.CorrectLevel.M
      });
      // Safety check: ensure canvas and img are not both rendered simultaneously
      requestAnimationFrame(() => {
        const c = qrDiv.querySelector('canvas');
        const img = qrDiv.querySelector('img');
        if (img && img.src && img.src.length > 20) {
          if (c) c.style.setProperty('display', 'none', 'important');
          img.style.setProperty('display', 'block', 'important');
          img.style.setProperty('margin', '0 auto', 'important');
        } else if (c) {
          c.style.setProperty('display', 'block', 'important');
          c.style.setProperty('margin', '0 auto', 'important');
          if (img) img.style.setProperty('display', 'none', 'important');
        }
      });
    }

    updateLobbyUI();
    updateFocusVisuals();
  }

  // Update connection status indicators
  function updateLobbyUI() {
    const statusBox = document.getElementById('player-status-box');
    if (!statusBox) return;

    if (selectedMode === 'ai') {
      const p1Connected = connectedPlayers.has(1) || connectedPlayers.size > 0;
      const p1Ready = readyPlayers.has(1) || (connectedPlayers.size > 0 && readyPlayers.size > 0);

      statusBox.innerHTML = `
        <div style="background:rgba(255,255,255,0.07); border-radius:14px; padding:12px 18px; display:flex; justify-content:space-between; align-items:center;">
          <div style="text-align:left;">
            <div style="font-size:17px; font-weight:800; color:#c7f36b;">🎾 ${p1Name}</div>
            <div style="font-size:12px; color:#a3cca9;">Player 1 (Green Baseline)</div>
          </div>
          <span style="font-size:13.5px; font-weight:700; padding:6px 14px; border-radius:8px; background:${p1Ready ? 'rgba(199,243,107,0.18)' : (p1Connected ? 'rgba(255,224,102,0.18)' : 'rgba(255,255,255,0.06)')}; color:${p1Ready ? '#c7f36b' : (p1Connected ? '#ffe066' : '#94baa1')};">
            ${p1Ready ? '✅ Motion Ready & Active' : (p1Connected ? '⏳ Enter name & tap "Enable Motion"...' : '⏳ Waiting for phone scan...')}
          </span>
        </div>
        <div id="lobby-countdown-banner" style="margin-top:10px;"></div>
      `;

      if (p1Ready) {
        startLobbyCountdown();
      } else {
        cancelLobbyCountdown();
        const cdEl = document.getElementById('lobby-countdown-banner');
        if (cdEl) {
          if (p1Connected) {
            cdEl.innerHTML = `
              <div style="background:rgba(255,224,102,0.1); border:1px dashed #ffe066; border-radius:10px; padding:10px 14px; color:#ffe066; font-size:13px; font-weight:600;">
                📱 Phone connected! Please enter your name and tap <strong>"Tap to Enable Motion Racket"</strong> on your phone.
              </div>
            `;
          } else {
            cdEl.innerHTML = `
              <div style="color:#8bb698; font-size:12.5px;">
                Scan QR code with phone camera to connect as racket controller.
              </div>
            `;
          }
        }
      }
    } else {
      // PvP mode
      const p1Connected = connectedPlayers.has(1);
      const p1Ready = readyPlayers.has(1);
      const p2Connected = connectedPlayers.has(2) || connectedPlayers.size >= 2;
      const p2Ready = readyPlayers.has(2);

      statusBox.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <!-- Player 1 -->
          <div style="background:rgba(255,255,255,0.07); border-radius:12px; padding:12px 16px; text-align:left;">
            <div style="font-size:16px; font-weight:800; color:#c7f36b;">🟢 ${p1Name}</div>
            <div style="font-size:11.5px; color:#a3cca9; margin-bottom:6px;">Player 1 (Bottom Baseline)</div>
            <span style="font-size:12.5px; font-weight:700; color:${p1Ready ? '#c7f36b' : (p1Connected ? '#ffe066' : '#94baa1')};">
              ${p1Ready ? '✅ Motion Ready' : (p1Connected ? '⏳ Tap "Enable Motion"...' : '⏳ Scan QR to join')}
            </span>
          </div>

          <!-- Player 2 -->
          <div style="background:rgba(255,255,255,0.07); border-radius:12px; padding:12px 16px; text-align:left;">
            <div style="font-size:16px; font-weight:800; color:#f3a65a;">🟠 ${p2Name}</div>
            <div style="font-size:11.5px; color:#d4af86; margin-bottom:6px;">Player 2 (Top Baseline)</div>
            <span style="font-size:12.5px; font-weight:700; color:${p2Ready ? '#c7f36b' : (p2Connected ? '#ffe066' : '#94baa1')};">
              ${p2Ready ? '✅ Motion Ready' : (p2Connected ? '⏳ Tap "Enable Motion"...' : '⏳ Scan SAME QR')}
            </span>
          </div>
        </div>
        <div id="lobby-countdown-banner" style="margin-top:10px;"></div>
      `;

      if (p1Ready && p2Ready) {
        startLobbyCountdown();
      } else {
        cancelLobbyCountdown();
        const cdEl = document.getElementById('lobby-countdown-banner');
        if (cdEl) {
          if (!p1Connected && !p2Connected) {
            cdEl.innerHTML = `<div style="color:#8bb698; font-size:12.5px;">Both players scan the SAME QR code on TV with phone camera.</div>`;
          } else if (p1Ready && !p2Ready) {
            cdEl.innerHTML = `<div style="color:#ffe066; font-size:13px; font-weight:600;">🟢 ${p1Name} ready! Waiting for Player 2 to scan QR and enable motion sensor...</div>`;
          } else if (!p1Ready && p2Ready) {
            cdEl.innerHTML = `<div style="color:#ffe066; font-size:13px; font-weight:600;">🟠 ${p2Name} ready! Waiting for Player 1 to enable motion sensor...</div>`;
          } else {
            cdEl.innerHTML = `<div style="color:#ffe066; font-size:13px; font-weight:600;">⏳ Please enter names and tap "Enable Motion Racket" on both phones.</div>`;
          }
        }
      }
    }
  }

  function startGame() {
    currentScreen = 'game';
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

  // Screen 3: Results & Structured Multi-Round Report Card (Compact for TV)
  window.showResults = function (report) {
    currentScreen = 'results';
    resultsFocus = 0;
    const r = document.getElementById('results');
    if (!r) return;
    injectStyles();

    r.className = 'glass-modal';
    r.style.display = 'flex';

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'report', report }));
    }

    const p1 = report.p1 || {};
    const p2 = report.p2 || {};
    const isPvp = report.mode === 'pvp';
    const nameP1 = p1.name || p1Name;
    const nameP2 = p2.name || (isPvp ? p2Name : 'AI Nadal');

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
                <td><strong style="font-size:16px;">${rd.p1Score}</strong></td>
                <td><strong style="font-size:16px;">${rd.p2Score}</strong></td>
                <td style="color:#c7f36b; font-weight:700;">${rd.winner}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    r.innerHTML = `
      <div style="max-width: 860px; width: 100%;">
        <div style="font-size:32px; margin-bottom: 2px;">🏆</div>
        <h1 style="font-size: 30px; margin: 0 0 2px; font-weight: 900; color: #fff;">
          ${report.winner ? `${report.winner.toUpperCase()} WINS THE MATCH!` : 'MATCH COMPLETED!'}
        </h1>
        <p style="font-size: 17px; color: #c7f36b; font-weight: 700; margin: 0 0 8px;">
          SETS WON: ${nameP1} (${report.roundsWon?.p1 || 0}) — (${report.roundsWon?.p2 || 0}) ${nameP2}
        </p>

        <!-- Round by round table -->
        <div style="max-width:580px; margin:0 auto;">
          ${roundsHtml}
        </div>

        <!-- Side by side player cards -->
        <div class="report-grid">
          <!-- Player 1 Card -->
          <div class="report-card" style="border-left: 4px solid #c7f36b;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <h2 style="margin:0; font-size:17px; color:#c7f36b;">${nameP1} (Green)</h2>
              <span class="mode-badge" style="margin:0; background:rgba(199,243,107,0.18); color:#c7f36b;">${p1.intensity || 'Active'}</span>
            </div>
            <div class="metric-row"><span>🔥 Active Calories</span><span class="metric-val" style="color:#c7f36b;">~${p1.calories || 0} kcal</span></div>
            <div class="metric-row"><span>🎾 Total Swings</span><span class="metric-val">${p1.swings || 0} (${p1.forehands || 0}F / ${p1.backhands || 0}B)</span></div>
            <div class="metric-row"><span>🎯 Hit Accuracy</span><span class="metric-val">${p1.accuracy || 0}% (${p1.hits || 0} hits)</span></div>
            <div class="metric-row"><span>⚡ Peak Swing Speed</span><span class="metric-val">${p1.peakSpeedKmh || 0} km/h</span></div>
          </div>

          <!-- Player 2 / AI Card -->
          <div class="report-card" style="border-left: 4px solid #f3a65a;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <h2 style="margin:0; font-size:17px; color:#f3a65a;">${nameP2} (Orange)</h2>
              <span class="mode-badge" style="margin:0; background:rgba(243,166,90,0.18); color:#f3a65a;">${p2.intensity || 'Cardio'}</span>
            </div>
            <div class="metric-row"><span>🔥 Active Calories</span><span class="metric-val" style="color:#f3a65a;">~${p2.calories || 0} kcal</span></div>
            <div class="metric-row"><span>🎾 Total Swings</span><span class="metric-val">${p2.swings || 0} (${p2.forehands || 0}F / ${p2.backhands || 0}B)</span></div>
            <div class="metric-row"><span>🎯 Hit Accuracy</span><span class="metric-val">${p2.accuracy || 0}% (${p2.hits || 0} hits)</span></div>
            <div class="metric-row"><span>⚡ Peak Swing Speed</span><span class="metric-val">${p2.peakSpeedKmh || 0} km/h</span></div>
          </div>
        </div>

        <!-- TV-ONLY ACTION BUTTONS (D-PAD NAVIGABLE) -->
        <div style="display:flex; gap:16px; justify-content:center; align-items:center; margin-top:12px;">
          <button class="btn-primary" id="btn-play-again" tabindex="0">
            🔄 Play Again / Retry Match
          </button>
          <button class="btn-secondary" id="btn-change-mode" tabindex="0">
            🎮 Switch Mode & Rounds
          </button>
        </div>
        <p style="color:#8db79f; font-size:12px; margin-top:8px;">
          Use remote [Left/Right] and press [OK/Select] to choose action.
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
      cancelLobbyCountdown();
      r.style.display = 'none';
      renderSetupScreen();
    };

    updateFocusVisuals();
  };

  // FULL TV REMOTE D-PAD NAVIGATION HANDLER
  window.addEventListener('keydown', e => {
    const key = e.key;
    const code = e.keyCode;

    // Check if key is a navigation key
    const isUp = key === 'ArrowUp' || code === 38;
    const isDown = key === 'ArrowDown' || code === 40;
    const isLeft = key === 'ArrowLeft' || code === 37;
    const isRight = key === 'ArrowRight' || code === 39;
    const isEnter = key === 'Enter' || key === 'Select' || key === ' ' || code === 13 || code === 18 || code === 32;
    const isBack = key === 'Escape' || key === 'Backspace' || key === 'GoBack' || code === 27 || code === 8 || code === 461 || code === 10009;

    if (currentScreen === 'setup') {
      if (isDown) {
        e.preventDefault();
        setupFocus.row = Math.min(setupFocus.row + 1, 2);
        updateFocusVisuals();
      } else if (isUp) {
        e.preventDefault();
        setupFocus.row = Math.max(setupFocus.row - 1, 0);
        updateFocusVisuals();
      } else if (isLeft) {
        e.preventDefault();
        setupFocus.col = Math.max(setupFocus.col - 1, 0);
        updateFocusVisuals();
      } else if (isRight) {
        e.preventDefault();
        const maxCol = setupFocus.row === 0 ? 1 : (setupFocus.row === 1 ? 2 : 0);
        setupFocus.col = Math.min(setupFocus.col + 1, maxCol);
        updateFocusVisuals();
      } else if (isEnter) {
        e.preventDefault();
        // Activate focused element
        if (setupFocus.row === 0) {
          selectedMode = setupFocus.col === 0 ? 'ai' : 'pvp';
          renderSetupScreen();
        } else if (setupFocus.row === 1) {
          targetRounds = setupFocus.col + 1;
          renderSetupScreen();
        } else if (setupFocus.row === 2) {
          const btn = document.getElementById('btn-confirm-setup');
          if (btn) btn.click();
        }
      }
    } else if (currentScreen === 'qr') {
      if (isEnter || isBack) {
        e.preventDefault();
        const btn = document.getElementById('btn-back-mode');
        if (btn) btn.click();
      }
    } else if (currentScreen === 'results') {
      if (isLeft) {
        e.preventDefault();
        resultsFocus = 0;
        updateFocusVisuals();
      } else if (isRight) {
        e.preventDefault();
        resultsFocus = 1;
        updateFocusVisuals();
      } else if (isEnter) {
        e.preventDefault();
        if (resultsFocus === 0) {
          const btn = document.getElementById('btn-play-again');
          if (btn) btn.click();
        } else {
          const btn = document.getElementById('btn-change-mode');
          if (btn) btn.click();
        }
      }
    }
  });

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
