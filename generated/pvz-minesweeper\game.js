// ===== PvZ MINESWEEPER GAME ENGINE =====

'use strict';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const DIFFICULTIES = {
  beginner:     { rows: 9,  cols: 9,  mines: 10, label: '🌱 Seedling',  emoji: '🌱' },
  intermediate: { rows: 16, cols: 16, mines: 40, label: '🌻 Sunflower', emoji: '🌻' },
  expert:       { rows: 16, cols: 30, mines: 99, label: '🌵 Cactus',    emoji: '🌵' },
};

// Zombie emojis for mine cells revealed at game over
const ZOMBIE_EMOJIS = ['🧟', '🧟‍♂️', '🧟‍♀️'];
const ZOMBIE_MAIN = '🧟';

// Plant emojis for decoration (not used on board, just theming)
const FLAG_EMOJI   = '🚩';
const UNKNOWN_EMOJI = '❓';

// Adjacent number color classes
const NUM_CLASSES = ['', 'num-1', 'num-2', 'num-3', 'num-4', 'num-5', 'num-6', 'num-7', 'num-8'];

// ─── GAME STATE ──────────────────────────────────────────────────────────────

let state = {
  board: [],          // 2D array of Cell objects
  rows: 0,
  cols: 0,
  mines: 0,
  difficulty: 'beginner',
  status: 'idle',     // 'idle' | 'playing' | 'won' | 'lost'
  flagsLeft: 0,
  tilesRevealed: 0,
  startTime: null,
  timerInterval: null,
  flagModeOn: false,  // mobile flag toggle
  firstClick: true,
};

// ─── CELL FACTORY ────────────────────────────────────────────────────────────

function createCell(row, col) {
  return {
    row,
    col,
    isMine: false,
    isRevealed: false,
    isFlagged: false,
    adjacentMines: 0,
    element: null,
  };
}

// ─── BOARD GENERATION ────────────────────────────────────────────────────────

function createEmptyBoard(rows, cols) {
  const board = [];
  for (let r = 0; r < rows; r++) {
    board[r] = [];
    for (let c = 0; c < cols; c++) {
      board[r][c] = createCell(r, c);
    }
  }
  return board;
}

function placeMines(board, rows, cols, mineCount, safeRow, safeCol) {
  const safeCells = new Set();
  // Mark a 3x3 area around first click as safe
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = safeRow + dr;
      const nc = safeCol + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        safeCells.add(nr * cols + nc);
      }
    }
  }

  const allCells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!safeCells.has(r * cols + c)) {
        allCells.push([r, c]);
      }
    }
  }

  // Fisher-Yates shuffle and pick first mineCount
  for (let i = allCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCells[i], allCells[j]] = [allCells[j], allCells[i]];
  }

  const actual = Math.min(mineCount, allCells.length);
  for (let i = 0; i < actual; i++) {
    const [r, c] = allCells[i];
    board[r][c].isMine = true;
  }

  return board;
}

function calcAdjacent(board, rows, cols) {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!board[r][c].isMine) {
        let count = 0;
        forEachNeighbor(r, c, rows, cols, (nr, nc) => {
          if (board[nr][nc].isMine) count++;
        });
        board[r][c].adjacentMines = count;
      }
    }
  }
}

function forEachNeighbor(row, col, rows, cols, fn) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        fn(nr, nc);
      }
    }
  }
}

// ─── GAME INIT ───────────────────────────────────────────────────────────────

function initGame(difficulty) {
  const cfg = DIFFICULTIES[difficulty];
  if (!cfg) return;

  stopTimer();

  state.rows        = cfg.rows;
  state.cols        = cfg.cols;
  state.mines       = cfg.mines;
  state.difficulty  = difficulty;
  state.status      = 'idle';
  state.flagsLeft   = cfg.mines;
  state.tilesRevealed = 0;
  state.firstClick  = true;
  state.startTime   = null;
  state.flagModeOn  = false;
  state.board       = createEmptyBoard(cfg.rows, cfg.cols);

  renderBoard();
  updateHUD();
  updateResetBtn('idle');
  updateDiffBadge(cfg.label);
  updateFlagToggle(false);

  showScreen('game-screen');
}

// ─── REVEAL LOGIC ────────────────────────────────────────────────────────────

function revealCell(row, col) {
  const cell = state.board[row][col];

  if (cell.isRevealed || cell.isFlagged || state.status === 'won' || state.status === 'lost') return;

  // First click: place mines now, ensuring safety
  if (state.firstClick) {
    state.firstClick = false;
    placeMines(state.board, state.rows, state.cols, state.mines, row, col);
    calcAdjacent(state.board, state.rows, state.cols);
    state.status = 'playing';
    startTimer();
  }

  if (cell.isMine) {
    // Game over
    cell.isRevealed = true;
    state.status = 'lost';
    stopTimer();
    triggerGameOver(row, col);
    return;
  }

  // Flood fill reveal
  floodReveal(row, col);
  checkWin();
}

function floodReveal(row, col) {
  const stack = [[row, col]];
//continuing from where the response was cut off:

  while (stack.length > 0) {
    const [r, c] = stack.pop();
    const cell = state.board[r][c];

    if (cell.isRevealed || cell.isFlagged) continue;

    cell.isRevealed = true;
    state.tilesRevealed++;
    updateCellElement(cell);

    if (cell.adjacentMines === 0) {
      forEachNeighbor(r, c, state.rows, state.cols, (nr, nc) => {
        if (!state.board[nr][nc].isRevealed && !state.board[nr][nc].isFlagged) {
          stack.push([nr, nc]);
        }
      });
    }
  }
}

// ─── FLAG LOGIC ───────────────────────────────────────────────────────────────

function toggleFlag(row, col) {
  const cell = state.board[row][col];
  if (cell.isRevealed || state.status === 'won' || state.status === 'lost') return;
  if (state.status === 'idle') return; // can't flag before first reveal

  if (cell.isFlagged) {
    cell.isFlagged = false;
    state.flagsLeft++;
  } else {
    if (state.flagsLeft <= 0) return;
    cell.isFlagged = true;
    state.flagsLeft--;
  }

  updateCellElement(cell);
  updateHUD();
}

// ─── WIN CHECK ────────────────────────────────────────────────────────────────

function checkWin() {
  const totalSafe = state.rows * state.cols - state.mines;
  if (state.tilesRevealed >= totalSafe) {
    state.status = 'won';
    stopTimer();
    // Auto-flag remaining unflagged mines
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = state.board[r][c];
        if (cell.isMine && !cell.isFlagged) {
          cell.isFlagged = true;
          state.flagsLeft--;
          updateCellElement(cell);
        }
      }
    }
    state.flagsLeft = 0;
    updateHUD();
    updateResetBtn('won');
    setTimeout(() => showWinModal(), 600);
  }
}

// ─── GAME OVER ────────────────────────────────────────────────────────────────

function triggerGameOver(triggeredRow, triggeredCol) {
  updateResetBtn('lost');

  // Reveal all mines with slight delay cascade
  let delay = 0;
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = state.board[r][c];
      if (cell.isMine && !cell.isFlagged) {
        const isTriggered = (r === triggeredRow && c === triggeredCol);
        ;(function(cell, d, triggered) {
          setTimeout(() => {
            cell.isRevealed = true;
            updateCellElement(cell, triggered);
          }, d);
        })(cell, delay, isTriggered);
        delay += 20;
      } else if (!cell.isMine && cell.isFlagged) {
        // Wrong flag
        ;(function(cell, d) {
          setTimeout(() => {
            updateCellElementWrongFlag(cell);
          }, d);
        })(cell, delay);
        delay += 20;
      }
    }
  }

  setTimeout(() => showLoseModal(), delay + 500);
}

// ─── TIMER ────────────────────────────────────────────────────────────────────

function startTimer() {
  state.startTime = Date.now();
  state.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    const capped = Math.min(elapsed, 999);
    document.getElementById('timer').textContent = String(capped).padStart(3, '0');
  }, 200);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function getElapsedSeconds() {
  if (!state.startTime) return 0;
  return Math.floor((Date.now() - state.startTime) / 1000);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return m + 'm ' + String(s).padStart(2, '0') + 's';
  return s + 's';
}

// ─── RENDER ───────────────────────────────────────────────────────────────────

function renderBoard() {
  const boardEl = document.getElementById('game-board');
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;

  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = state.board[r][c];
      const el = document.createElement('div');
      el.className = 'cell unrevealed';
      el.dataset.row = r;
      el.dataset.col = c;

      // Left click
      el.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.flagModeOn) {
          toggleFlag(r, c);
        } else {
          revealCell(r, c);
        }
      });

      // Right click (flag)
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        toggleFlag(r, c);
      });

      // Touch long-press for flag (mobile)
      let pressTimer = null;
      el.addEventListener('touchstart', (e) => {
        pressTimer = setTimeout(() => {
          e.preventDefault();
          toggleFlag(r, c);
          pressTimer = null;
        }, 500);
      });
      el.addEventListener('touchend', () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      });
      el.addEventListener('touchmove', () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      });

      cell.element = el;
      boardEl.appendChild(el);
    }
  }
}

function updateCellElement(cell, isTriggered = false) {
  const el = cell.element;
  if (!el) return;

  el.className = 'cell';
  el.innerHTML = '';

  if (cell.isFlagged && !cell.isRevealed) {
    el.classList.add('unrevealed', 'flagged');
    el.textContent = FLAG_EMOJI;
    return;
  }

  if (!cell.isRevealed) {
    el.classList.add('unrevealed');
    if (state.flagModeOn) el.classList.add('flag-mode-on');
    return;
  }

  if (cell.isMine) {
    el.classList.add('mine-revealed');
    if (isTriggered) el.classList.add('triggered');
    el.textContent = ZOMBIE_MAIN;
    return;
  }

  el.classList.add('revealed');
  if (cell.adjacentMines > 0) {
    const span = document.createElement('span');
    span.className = 'cell-number ' + NUM_CLASSES[cell.adjacentMines];
    span.textContent = cell.adjacentMines;
    el.appendChild(span);
  }
}

function updateCellElementWrongFlag(cell) {
  const el = cell.element;
  if (!el) return;
  el.className = 'cell wrong-flag';
  el.textContent = '❌';
}

// ─── HUD ──────────────────────────────────────────────────────────────────────

function updateHUD() {
  const zombieEl = document.getElementById('zombie-count');
  if (zombieEl) {
    zombieEl.textContent = Math.max(0, state.flagsLeft);
  }
}

function updateResetBtn(status) {
  const btn = document.getElementById('reset-btn');
  if (!btn) return;
  btn.className = 'reset-btn';
  if (status === 'won') {
    btn.textContent = '😎';
    btn.classList.add('won');
  } else if (status === 'lost') {
    btn.textContent = '😵';
    btn.classList.add('lost');
  } else {
    btn.textContent = '🌻';
  }
}

function updateDiffBadge(label) {
  const el = document.getElementById('diff-badge');
  if (el) el.textContent = label;
}

function updateFlagToggle(active) {
  const btn = document.getElementById('flag-toggle');
  if (!btn) return;
  if (active) {
    btn.classList.add('active');
  } else {
    btn.classList.remove('active');
  }

  // Update all unrevealed cells for flag-mode cursor
  document.querySelectorAll('.cell.unrevealed').forEach(el => {
    if (active) {
      el.classList.add('flag-mode-on');
    } else {
      el.classList.remove('flag-mode-on');
    }
  });
}

// ─── SCREEN MANAGEMENT ───────────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function showModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function hideModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

// ─── MODALS ───────────────────────────────────────────────────────────────────

function showWinModal() {
  const elapsed = getElapsedSeconds();
  const diff = DIFFICULTIES[state.difficulty];
  document.getElementById('win-time').textContent = formatTime(elapsed);
  document.getElementById('win-diff').textContent = diff ? diff.label : state.difficulty;
  showModal('win-modal');
}

function showLoseModal() {
  const elapsed = getElapsedSeconds();
  const diff = DIFFICULTIES[state.difficulty];
  document.getElementById('lose-time').textContent = formatTime(elapsed);
  document.getElementById('lose-diff').textContent = diff ? diff.label : state.difficulty;
  showModal('lose-modal');
}

// ─── EVENT LISTENERS ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // Difficulty buttons on main menu
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const difficulty = btn.dataset.difficulty;
      initGame(difficulty);
    });
  });

  // Instructions
  document.getElementById('show-instructions').addEventListener('click', () => {
    showModal('instructions-modal');
  });

  document.getElementById('close-instructions').addEventListener('click', () => {
    hideModal('instructions-modal');
  });

  // Close modal on backdrop click
  document.getElementById('instructions-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('instructions-modal')) {
      hideModal('instructions-modal');
    }
  });

  // Back to menu
  document.getElementById('back-to-menu').addEventListener('click', () => {
    stopTimer();
    hideModal('win-modal');
    hideModal('lose-modal');
    showScreen('main-menu');
  });

  // Reset / New game button
  document.getElementById('reset-btn').addEventListener('click', () => {
    hideModal('win-modal');
    hideModal('lose-modal');
    initGame(state.difficulty);
  });

  // Flag mode toggle (mobile)
  document.getElementById('flag-toggle').addEventListener('click', () => {
    state.flagModeOn = !state.flagModeOn;
    updateFlagToggle(state.flagModeOn);
  });

  // Win modal buttons
  document.getElementById('win-new-game').addEventListener('click', () => {
    hideModal('win-modal');
    initGame(state.difficulty);
  });

  document.getElementById('win-menu').addEventListener('click', () => {
    hideModal('win-modal');
    stopTimer();
    showScreen('main-menu');
  });

  // Lose modal buttons
  document.getElementById('lose-new-game').addEventListener('click', () => {
    hideModal('lose-modal');
    initGame(state.difficulty);
  });

  document.getElementById('lose-menu').addEventListener('click', () => {
    hideModal('lose-modal');
    stopTimer();
    showScreen('main-menu');
  });

  // Prevent context menu on board
  document.getElementById('game-board').addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // Keyboard shortcut: F = toggle flag mode, R = reset, Escape = menu
  document.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') {
      if (document.getElementById('game-screen').classList.contains('active')) {
        state.flagModeOn = !state.flagModeOn;
        updateFlagToggle(state.flagModeOn);
      }
    }
    if (e.key === 'r' || e.key === 'R') {
      if (document.getElementById('game-screen').classList.contains('active')) {
        hideModal('win-modal');
        hideModal('lose-modal');
        initGame(state.difficulty);
      }
    }
    if (e.key === 'Escape') {
      hideModal('instructions-modal');
      hideModal('win-modal');
      hideModal('lose-modal');
    }
  });

  // Show main menu on load
  showScreen('main-menu');
});
