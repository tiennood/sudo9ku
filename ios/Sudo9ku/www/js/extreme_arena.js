/**
 * Sudo9ku - Extreme Survival Arena (Đấu Trường Sinh Tồn Extreme: Thợ Săn Số 9)
 * 
 * Tính năng:
 * 1. Mã đề đồng bộ (Seed Sync): Hai đấu thủ cùng nhập mã đề (VD: #1367) sẽ nhận cùng 1 bàn cờ Extreme.
 * 2. Ngẫu nhiên hệ quy chiếu (Random Perspective Transform): Tự động xoay/lật bàn cờ khi bắt đầu để chống nhìn trộm màn hình; tự động hoàn nguyên về hướng chuẩn ban đầu khi kết thúc.
 * 3. Thợ săn 1 số (Active Single-Number Lock): Chỉ được điền 1 số duy nhất tại một thời điểm, lấy ngẫu nhiên từ các nước đi giải được của bàn cờ.
 * 4. Kinh tế Đổi lỗi lấy số (Life-Number Trade): Cố định 3 lỗi. Có thể đổi 1 lỗi để mở khóa thêm 1 số (tối đa giữ 3 số cùng lúc).
 * 5. Radar gợi ý mù (Blind Radar Hint): Tối đa 2 lần/ván. Rọi sáng viền ô mục tiêu, không tiết lộ đáp án.
 * 6. Giới hạn thời gian (Blitz 5p / Tiêu chuẩn 10p / 15p / Vô hạn).
 */

import { SudokuSolver } from './sudoku_solver.js';
import { HumanSolver } from './human_solver.js';

export const PERSPECTIVE_TRANSFORMS = {
  none: {
    id: 'none',
    name: 'Góc chuẩn ban đầu (0°)',
    shortName: 'Chuẩn',
    map: (r, c) => [r, c],
    inv: (r, c) => [r, c]
  },
  rot90: {
    id: 'rot90',
    name: 'Xoay 90° xuôi',
    shortName: 'Xoay 90°',
    map: (r, c) => [c, 8 - r],
    inv: (r, c) => [8 - c, r]
  },
  rot180: {
    id: 'rot180',
    name: 'Xoay 180° đảo ngược',
    shortName: 'Xoay 180°',
    map: (r, c) => [8 - r, 8 - c],
    inv: (r, c) => [8 - r, 8 - c]
  },
  rot270: {
    id: 'rot270',
    name: 'Xoay 270°',
    shortName: 'Xoay 270°',
    map: (r, c) => [8 - c, r],
    inv: (r, c) => [c, 8 - r]
  },
  flipH: {
    id: 'flipH',
    name: 'Lật ngang (Trái ↔ Phải)',
    shortName: 'Lật ngang',
    map: (r, c) => [r, 8 - c],
    inv: (r, c) => [r, 8 - c]
  },
  flipV: {
    id: 'flipV',
    name: 'Lật dọc (Trên ↕ Dưới)',
    shortName: 'Lật dọc',
    map: (r, c) => [8 - r, c],
    inv: (r, c) => [8 - r, c]
  }
};

export class ExtremeArenaManager {
  constructor(app) {
    this.app = app;
    this.isActive = false;

    // Ván đấu hiện tại
    this.seedId = '1367';
    this.winRate = 48.13;
    this.timeLimitMinutes = 10; // 0 = unlimited
    this.remainingSeconds = 600;
    this.timerInterval = null;

    // Hệ quy chiếu & biến đổi
    this.transformType = 'none';
    this.enableTransform = true;
    this.rawInitialGrid = null; // Ma trận gốc chưa biến đổi
    this.rawSolutionGrid = null;

    // Thợ săn số & Sinh tồn
    this.mistakes = 0;
    this.maxMistakes = 3;
    this.heldNumbers = []; // Tập số đang được phép điền (1 -> 3 số)
    this.radarUsesRemaining = 2;
    this.maxRadars = 2;
    this.tradesCount = 0;
    this.startTime = 0;
    this.endTime = 0;
    this.isEnding = false;

    this.initDOMElements();
    this.bindEvents();
  }

  initDOMElements() {
    this.dom = {
      // Nút mở modal thiết lập đấu trường
      btnOpenArena: document.getElementById('btn-open-extreme-arena'),
      btnOpenArenaAlt: document.getElementById('btn-open-extreme-arena-alt'),

      // Modal thiết lập
      modalSetup: document.getElementById('extreme-arena-setup-modal'),
      btnCloseSetup: document.getElementById('btn-close-arena-setup'),
      btnCancelSetup: document.getElementById('btn-cancel-arena-setup'),
      btnStartMatch: document.getElementById('btn-start-arena-match'),
      inputSeed: document.getElementById('arena-seed-input'),
      btnRandomSeed: document.getElementById('btn-arena-random-seed'),
      btnPickLeaderboardSeed: document.getElementById('btn-arena-pick-leaderboard-seed'),
      inputTimer: document.getElementById('arena-timer-custom-input'),
      timerPresets: document.querySelectorAll('.btn-timer-preset'),
      chkTransform: document.getElementById('arena-transform-chk'),

      // HUD thanh điều khiển trận đấu
      hudBar: document.getElementById('arena-hud-bar'),
      hudSeedBadge: document.getElementById('arena-hud-seed'),
      hudWinRateBadge: document.getElementById('arena-hud-winrate'),
      hudTransformBadge: document.getElementById('arena-hud-transform'),
      hudTimer: document.getElementById('arena-hud-timer'),
      hudLives: document.getElementById('arena-hud-lives'),
      hudHeldNumbers: document.getElementById('arena-hud-held-numbers'),
      btnSacrificeLife: document.getElementById('btn-arena-sacrifice-life'),
      btnRadar: document.getElementById('btn-arena-radar'),
      btnQuit: document.getElementById('btn-arena-quit'),

      // Modal kết thúc trận đấu (Showdown / Summary)
      modalSummary: document.getElementById('arena-summary-modal'),
      btnCloseSummary: document.getElementById('btn-close-arena-summary'),
      summaryTitle: document.getElementById('arena-summary-title'),
      summarySubtitle: document.getElementById('arena-summary-subtitle'),
      summarySeed: document.getElementById('arena-summary-seed'),
      summaryWinRate: document.getElementById('arena-summary-winrate'),
      summaryTime: document.getElementById('arena-summary-time'),
      summaryMistakes: document.getElementById('arena-summary-mistakes'),
      summaryTrades: document.getElementById('arena-summary-trades'),
      summaryRadars: document.getElementById('arena-summary-radars'),
      summaryProgress: document.getElementById('arena-summary-progress'),
      btnReplaySeed: document.getElementById('btn-arena-replay-seed'),
      btnShareResult: document.getElementById('btn-arena-share-result'),
      btnNewMatch: document.getElementById('btn-arena-new-match')
    };
  }

  bindEvents() {
    if (this.dom.btnOpenArena) {
      this.dom.btnOpenArena.addEventListener('click', () => this.openSetupModal());
    }
    if (this.dom.btnOpenArenaAlt) {
      this.dom.btnOpenArenaAlt.addEventListener('click', () => this.openSetupModal());
    }
    if (this.dom.btnCloseSetup) {
      this.dom.btnCloseSetup.addEventListener('click', () => this.closeSetupModal());
    }
    if (this.dom.btnCancelSetup) {
      this.dom.btnCancelSetup.addEventListener('click', () => this.closeSetupModal());
    }
    if (this.dom.btnRandomSeed) {
      this.dom.btnRandomSeed.addEventListener('click', () => {
        const rand = Math.floor(1000 + Math.random() * 9000);
        if (this.dom.inputSeed) this.dom.inputSeed.value = rand;
      });
    }
    if (this.dom.btnPickLeaderboardSeed) {
      this.dom.btnPickLeaderboardSeed.addEventListener('click', () => {
        this.closeSetupModal();
        if (typeof this.app.openSeedLeaderboardModal === 'function') {
          this.app.openSeedLeaderboardModal('select-arena');
        }
      });
    }
    if (this.dom.btnStartMatch) {
      this.dom.btnStartMatch.addEventListener('click', () => this.onStartMatchClick());
    }

    // Timer Presets & Custom Input
    if (this.dom.timerPresets) {
      this.dom.timerPresets.forEach(btn => {
        btn.addEventListener('click', () => {
          const mins = btn.dataset.mins;
          if (this.dom.inputTimer) {
            this.dom.inputTimer.value = mins;
          }
          this.dom.timerPresets.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });
    }
    if (this.dom.inputTimer) {
      this.dom.inputTimer.addEventListener('input', () => {
        const val = this.dom.inputTimer.value.trim();
        if (this.dom.timerPresets) {
          this.dom.timerPresets.forEach(b => {
            b.classList.toggle('active', b.dataset.mins === val);
          });
        }
      });
    }

    // HUD Actions
    if (this.dom.btnSacrificeLife) {
      this.dom.btnSacrificeLife.addEventListener('click', () => this.sacrificeMistakeForNumber());
    }
    if (this.dom.btnRadar) {
      this.dom.btnRadar.addEventListener('click', () => this.triggerBlindRadar());
    }
    if (this.dom.btnQuit) {
      this.dom.btnQuit.addEventListener('click', () => this.confirmQuitArena());
    }

    // Summary Actions
    if (this.dom.btnCloseSummary) {
      this.dom.btnCloseSummary.addEventListener('click', () => this.closeSummaryModal());
    }
    if (this.dom.btnReplaySeed) {
      this.dom.btnReplaySeed.addEventListener('click', () => {
        this.closeSummaryModal();
        this.startMatch(this.seedId, this.timeLimitMinutes, this.enableTransform);
      });
    }
    if (this.dom.btnNewMatch) {
      this.dom.btnNewMatch.addEventListener('click', () => {
        this.closeSummaryModal();
        this.openSetupModal();
      });
    }
    if (this.dom.btnShareResult) {
      this.dom.btnShareResult.addEventListener('click', () => this.copyShareCard());
    }
  }

  openSetupModal() {
    if (this.dom.modalSetup) {
      this.dom.modalSetup.classList.add('active');
    }
  }

  closeSetupModal() {
    if (this.dom.modalSetup) {
      this.dom.modalSetup.classList.remove('active');
    }
  }

  closeSummaryModal() {
    if (this.dom.modalSummary) {
      this.dom.modalSummary.classList.remove('active');
    }
  }

  async onStartMatchClick() {
    let seed = this.dom.inputSeed ? this.dom.inputSeed.value.trim() : '1367';
    if (!seed) seed = '1367';

    let timerVal = 10;
    if (this.dom.inputTimer) {
      const parsed = parseInt(this.dom.inputTimer.value, 10);
      timerVal = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    }
    const transformVal = this.dom.chkTransform ? this.dom.chkTransform.checked : true;

    this.closeSetupModal();
    await this.startMatch(seed, timerVal, transformVal);
  }

  /**
   * Khởi chạy trận đấu Đấu Trường Extreme
   */
  async startMatch(seedId, timeLimitMinutes, enableTransform) {
    this.seedId = String(seedId);
    this.timeLimitMinutes = timeLimitMinutes;
    this.enableTransform = enableTransform;
    this.isActive = true;
    this.isEnding = false;
    this.mistakes = 0;
    this.radarUsesRemaining = this.maxRadars;
    this.tradesCount = 0;
    this.heldNumbers = [];
    this.startTime = Date.now();
    this.endTime = 0;

    this.app.setStatus('⏳ Đang đồng bộ mã đề và thiết lập trận đấu...', 'loading');

    // 1. Tải bài Extreme theo mã đề từ server
    let puzzleData = null;
    try {
      const resp = await fetch(`/api/puzzle-seed?id=${encodeURIComponent(this.seedId)}`);
      if (resp.ok) {
        puzzleData = await resp.json();
      }
    } catch (e) {
      console.warn('Lỗi kết nối /api/puzzle-seed:', e);
    }

    if (!puzzleData || !puzzleData.grid || !puzzleData.solution) {
      // Fallback cục bộ nếu mất mạng
      puzzleData = this.generateFallbackSeedPuzzle(this.seedId);
    }

    this.winRate = puzzleData.winRate || 48.13;
    this.rawInitialGrid = SudokuSolver.cloneBoard(puzzleData.grid);
    this.rawSolutionGrid = SudokuSolver.cloneBoard(puzzleData.solution);

    // Lưu lại cài đặt cá nhân của người chơi để hoàn nguyên khi thoát
    this.savedSettings = {
      crosshatchMode: this.app.crosshatchMode,
      crosshatchIncludeBoxes: this.app.crosshatchIncludeBoxes,
      sameDigitMatchColor: this.app.sameDigitMatchColor,
      pencilType: this.app.pencilType,
      showCandidates: this.app.showCandidates
    };

    // Áp dụng Cài đặt Cố định theo luật Đấu Trường Extreme:
    // 1. 📐 Chiếu tia gióng ngang dọc cho đúng 1 ô đang chọn (tránh rối mắt từ các ô cùng số khác)
    this.app.crosshatchMode = '1';
    // 2. 📦 Chiếu sáng khối 3x3 (chiếu sáng nhẹ cả khối 3x3 chứa các ô gióng hàng)
    this.app.crosshatchIncludeBoxes = true;
    // 3. 🎨 Đồng bộ màu sắc chữ số (Khi ấn vào số, ô chọn và tất cả số cùng giá trị đều cùng màu cam đào)
    this.app.sameDigitMatchColor = true;
    // 4. ✏️ Ép chế độ Bút chì về Thủ công (cấm tự động điền ứng viên để bảo đảm công bằng)
    this.app.pencilType = 'manual';
    this.app.showCandidates = false;
    this.app.togglePencilMode(false);
    if (typeof this.app.updatePencilUI === 'function') {
      this.app.updatePencilUI();
    }
    if (typeof this.app.updateCrosshatchBtnLabel === 'function') {
      this.app.updateCrosshatchBtnLabel();
    }

    // Đóng preview nếu đang mở
    if (this.app.isPreviewMode) {
      this.app.closePreview(false);
    }

    // Khóa các tính năng gian lận & nút xung đột trong Đấu trường:
    // 1. Khóa nút Tùy chỉnh
    if (this.app.dom.btnOpenUnifiedSettings) {
      this.app.dom.btnOpenUnifiedSettings.classList.add('btn-locked-arena');
      this.app.dom.btnOpenUnifiedSettings.title = '🔒 Cài đặt hiển thị đã được khóa cố định theo luật Đấu Trường Extreme!';
    }
    // 2. Khóa Xem trước nước tiếp (chặn gian lận gợi ý AI)
    if (this.app.dom.btnPreviewNext) {
      this.app.dom.btnPreviewNext.classList.add('btn-locked-arena');
      this.app.dom.btnPreviewNext.disabled = true;
      this.app.dom.btnPreviewNext.title = '🔒 Tính năng xem trước gợi ý AI bị khóa trong Đấu Trường Extreme!';
    }
    // 3. Khóa Xóa cờ (chặn phá vỡ bàn cờ thi đấu)
    if (this.app.dom.btnClearBoard) {
      this.app.dom.btnClearBoard.classList.add('btn-locked-arena');
      this.app.dom.btnClearBoard.disabled = true;
      this.app.dom.btnClearBoard.title = '🔒 Không thể xóa cờ khi đang thi đấu Đấu Trường!';
    }
    // 4. Khóa Xem trước đáp án & Điền tất cả
    if (this.app.dom.toggleSolution) {
      this.app.dom.toggleSolution.checked = false;
      this.app.dom.toggleSolution.disabled = true;
      this.app.showSolution = false;
    }
    if (this.app.dom.btnFillAllSolution) {
      this.app.dom.btnFillAllSolution.disabled = true;
      this.app.dom.btnFillAllSolution.classList.add('btn-locked-arena');
    }

    // 2. Chọn ngẫu nhiên hệ quy chiếu (nếu bật)
    if (this.enableTransform) {
      const keys = ['none', 'rot90', 'rot180', 'rot270', 'flipH', 'flipV'];
      // Random dựa trên seed + thời điểm hoặc random trực tiếp để 2 máy có thể khác góc nhìn chống nhìn trộm
      const pick = keys[Math.floor(Math.random() * keys.length)];
      this.transformType = pick;
    } else {
      this.transformType = 'none';
    }

    // 3. Biến đổi ma trận ban đầu theo hệ quy chiếu
    const transformedGrid = this.applyTransform(this.rawInitialGrid, this.transformType);
    const transformedSol = this.applyTransform(this.rawSolutionGrid, this.transformType);

    // Nạp vào ứng dụng Sudoku chính
    this.app.initialBoard = SudokuSolver.cloneBoard(transformedGrid);
    this.app.currentBoard = SudokuSolver.cloneBoard(transformedGrid);
    this.app.originalPuzzleGrid = SudokuSolver.cloneBoard(transformedGrid);
    this.app.solution = SudokuSolver.cloneBoard(transformedSol);
    this.app.userMovesHistory = [];
    this.app.manualCandidates = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
    this.app.selectedCell = null;
    this.app.mistakesCount = 0;
    this.app.maxMistakes = 3;

    // 4. Chọn số đầu tiên cho thợ săn (Active Single-Number Lock)
    this.advanceActiveNumber(true);

    // 5. Cấu hình Timer
    if (typeof this.app.stopNormalTimer === 'function') {
      this.app.stopNormalTimer();
    }
    if (this.app.dom.normalTimerBadge) {
      this.app.dom.normalTimerBadge.style.display = 'none';
    }
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.timeLimitMinutes > 0) {
      this.remainingSeconds = this.timeLimitMinutes * 60;
      this.timerInterval = setInterval(() => this.onTimerTick(), 1000);
    } else {
      this.remainingSeconds = 0;
    }

    // 6. Hiển thị HUD
    this.showHUD();
    this.updateHUD();
    this.updateKeypadLockVisuals();

    // 7. Render lại bàn cờ và thông báo
    this.app.renderBoard();
    const tInfo = PERSPECTIVE_TRANSFORMS[this.transformType];
    this.app.setStatus(
      `⚔️ ĐẤU TRƯỜNG EXTREME: Đề #${this.seedId} • Góc nhìn: ${tInfo.shortName} • Hãy săn số [ ${this.heldNumbers.join(', ')} ]!`,
      'valid'
    );
    this.app.playSound('scan');
  }

  /**
   * Biến đổi ma trận theo hệ quy chiếu
   */
  applyTransform(grid, type) {
    const t = PERSPECTIVE_TRANSFORMS[type] || PERSPECTIVE_TRANSFORMS.none;
    const res = Array.from({ length: 9 }, () => Array(9).fill(0));
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const [tr, tc] = t.map(r, c);
        res[tr][tc] = grid[r][c];
      }
    }
    return res;
  }

  /**
   * Hoàn nguyên ma trận về góc chuẩn ban đầu
   */
  applyInverseTransform(grid, type) {
    const t = PERSPECTIVE_TRANSFORMS[type] || PERSPECTIVE_TRANSFORMS.none;
    const res = Array.from({ length: 9 }, () => Array(9).fill(0));
    for (let tr = 0; tr < 9; tr++) {
      for (let tc = 0; tc < 9; tc++) {
        const [r, c] = t.inv(tr, tc);
        res[r][c] = grid[tr][tc];
      }
    }
    return res;
  }

  /**
   * Tìm danh sách các số chưa hoàn thành trên bàn cờ có thể giải được theo logic
   */
  getAllocatableNumbers() {
    const board = this.app.currentBoard;
    const sol = this.app.solution;
    if (!board || !sol) return [1, 2, 3, 4, 5, 6, 7, 8, 9];

    // Đếm số lượng ô đã điền của từng số 1..9
    const countMap = {};
    for (let val = 1; val <= 9; val++) countMap[val] = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const v = board[r][c];
        if (v >= 1 && v <= 9) countMap[v]++;
      }
    }

    // Các số còn thiếu chưa đủ 9 ô và chưa nằm trong heldNumbers
    const remainingDigits = [];
    for (let val = 1; val <= 9; val++) {
      if (countMap[val] < 9 && !this.heldNumbers.includes(val)) {
        remainingDigits.push(val);
      }
    }

    if (remainingDigits.length === 0) return [];

    // Tìm các số có nước đi giải ngay được (Immediate Moves)
    try {
      const candidates = SudokuSolver.getAllCandidates(board);
      const moves = HumanSolver.findAllImmediateMoves(board, candidates, sol);
      const immediateDigits = new Set();
      for (const m of moves) {
        if (remainingDigits.includes(m.value)) {
          immediateDigits.add(m.value);
        }
      }
      if (immediateDigits.size > 0) {
        return Array.from(immediateDigits);
      }
    } catch (e) {
      console.warn('Lỗi tính toán logic immediate moves:', e);
    }

    // Nếu không có immediate moves (nước đi nâng cao), tìm các số có ô trống với số ứng viên ít nhất
    const digitCandidateScore = {};
    for (const d of remainingDigits) {
      let minCands = 9;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (board[r][c] === 0 && sol[r][c] === d) {
            const cands = SudokuSolver.getCandidates(board, r, c);
            if (cands.length < minCands) minCands = cands.length;
          }
        }
      }
      digitCandidateScore[d] = minCands;
    }

    remainingDigits.sort((a, b) => digitCandidateScore[a] - digitCandidateScore[b]);
    return remainingDigits;
  }

  /**
   * Cấp phát số tiếp theo cho người chơi
   */
  advanceActiveNumber(isInitial = false) {
    const allocatable = this.getAllocatableNumbers();
    if (allocatable.length === 0) {
      if (this.app.isBoardComplete()) {
        this.handleVictory();
      }
      return;
    }

    // Chọn ngẫu nhiên 1 số từ các số giải được
    const pick = allocatable[Math.floor(Math.random() * allocatable.length)];
    this.heldNumbers = [pick];

    if (!isInitial) {
      this.app.playSound('step');
      this.showTemporaryToast(`🎯 MỤC TIÊU MỚI: SỐ [ ${pick} ]!`);
    }

    this.updateHUD();
    this.updateKeypadLockVisuals();
  }

  /**
   * Đổi 1 lỗi lấy thêm 1 số ngẫu nhiên (tối đa 3 số)
   */
  sacrificeMistakeForNumber() {
    if (!this.isActive || this.isEnding) return;

    if (this.heldNumbers.length >= 3) {
      this.showTemporaryToast('⚠️ Bạn đã giữ tối đa 3 số cùng lúc! Hãy hoàn thành bớt số trước.');
      this.app.playSound('conflict');
      return;
    }

    const allocatable = this.getAllocatableNumbers();
    if (allocatable.length === 0) {
      this.showTemporaryToast('⚠️ Không còn số nào khác để mở khóa!');
      return;
    }

    // Cảnh báo nếu đổi lần này sẽ chạm mốc 3 lỗi (Thua)
    if (this.mistakes === 2) {
      const confirmed = window.confirm(
        '⚠️ BẠN CHỈ CÒN 1 MẠNG DUY NHẤT!\n\nNếu bạn đổi 1 lỗi lúc này, bạn sẽ nhận lỗi thứ 3 và bị XỬ THUA NGAY LẬP TỨC (Game Over)!\n\nBạn có chắc chắn muốn hy sinh mạng để mở số không?'
      );
      if (!confirmed) return;
    }

    // Tăng 1 lỗi vi phạm
    this.mistakes++;
    this.tradesCount++;
    this.app.mistakesCount = this.mistakes;

    // Chọn 1 số mới bổ sung
    const pick = allocatable[Math.floor(Math.random() * allocatable.length)];
    this.heldNumbers.push(pick);

    this.updateHUD();
    this.updateKeypadLockVisuals();

    if (this.mistakes >= this.maxMistakes) {
      this.handleGameOver('mistakes');
      return;
    }

    this.app.playSound('valid');
    this.showTemporaryToast(`💔 ĐÃ ĐỔI 1 LỖI! Mở khóa thêm số [ ${pick} ] (Đang giữ: ${this.heldNumbers.join(', ')})`);
    this.app.setStatus(
      `💔 Đổi 1 lỗi lấy số: Mở khóa thêm số [ ${pick} ]! Lỗi hiện tại: ${this.mistakes}/3`,
      'warning'
    );
  }

  /**
   * Radar gợi ý mù: Rọi sáng viền ô mục tiêu, tuyệt đối không lộ số
   */
  triggerBlindRadar() {
    if (!this.isActive || this.isEnding) return;

    if (this.radarUsesRemaining <= 0) {
      this.showTemporaryToast('⚠️ Bạn đã dùng hết 2 lượt Radar của ván đấu!');
      this.app.playSound('conflict');
      return;
    }

    const board = this.app.currentBoard;
    const sol = this.app.solution;
    if (!board || !sol) return;

    // Tìm ô trống có đáp án thuộc heldNumbers
    const candidates = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0 && this.heldNumbers.includes(sol[r][c])) {
          candidates.push({ r, c, val: sol[r][c] });
        }
      }
    }

    if (candidates.length === 0) {
      this.showTemporaryToast('⚠️ Không tìm thấy ô nào phù hợp với các số bạn đang cầm!');
      return;
    }

    // Ưu tiên ô có logic đơn giản hoặc ngẫu nhiên
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    this.radarUsesRemaining--;
    this.updateHUD();

    // Rọi sáng viền ô bằng hiệu ứng CSS pulse
    this.highlightRadarCell(target.r, target.c);
    this.app.playSound('hint');
    this.showTemporaryToast(`📡 RADAR ĐÃ ĐỊNH VỊ 1 Ô CHO SỐ ĐANG SĂN! (Còn ${this.radarUsesRemaining} lần)`);
    this.app.setStatus(
      `📡 Radar đã kích hoạt! Hãy quan sát ô viền xung điện tại (Hàng ${target.r + 1}, Cột ${target.c + 1}).`,
      'hint'
    );
  }

  highlightRadarCell(r, c) {
    const cellEl = document.querySelector(`.sudoku-cell[data-row="${r}"][data-col="${c}"]`);
    if (cellEl) {
      cellEl.classList.add('arena-radar-pulse');
      cellEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => {
        cellEl.classList.remove('arena-radar-pulse');
      }, 4000);
    }
  }

  /**
   * Xử lý khi người chơi nhập một số vào ô
   * Return true nếu cho phép nhập tiếp, false nếu bị chặn
   */
  validateNumberInput(val) {
    if (!this.isActive) return true;

    if (val < 1 || val > 9) return true; // Cho phép xóa (0)

    if (!this.heldNumbers.includes(val)) {
      this.app.playSound('conflict');
      this.showTemporaryToast(
        `🔒 SỐ [ ${val} ] ĐANG KHÓA! Bạn chỉ được điền các số đang săn: [ ${this.heldNumbers.join(', ')} ].`
      );
      this.app.setStatus(
        `🔒 Bị chặn: Số ${val} chưa mở khóa! Hãy đổi 1 lỗi để mở thêm số.`,
        'conflict'
      );
      // Rung nút numpad tương ứng
      const btn = document.querySelector(`.numpad-btn[data-val="${val}"]`);
      if (btn) {
        btn.classList.add('key-shake');
        setTimeout(() => btn.classList.remove('key-shake'), 400);
      }
      return false;
    }

    return true;
  }

  /**
   * Gọi sau khi điền đúng một số
   */
  onNumberCorrectlyPlaced(val) {
    if (!this.isActive) return;

    // Người chơi đã dùng số này -> Số này biến mất khỏi danh sách đang săn!
    this.heldNumbers = this.heldNumbers.filter(n => n !== val);

    if (this.heldNumbers.length === 0) {
      // Đã dùng hết số -> Tự động cấp phát số giải được tiếp theo
      this.advanceActiveNumber(false);
    } else {
      this.showTemporaryToast(`✅ Đã dùng số [ ${val} ]! Tiếp tục săn: [ ${this.heldNumbers.join(', ')} ]`);
      this.updateHUD();
      this.updateKeypadLockVisuals();
    }

    if (this.app.isBoardComplete()) {
      this.handleVictory();
    }
  }

  /**
   * Khôi phục lại cài đặt hiển thị của người chơi khi rời đấu trường
   */
  restoreUserSettings() {
    if (this.app.dom.btnOpenUnifiedSettings) {
      this.app.dom.btnOpenUnifiedSettings.classList.remove('btn-locked-arena');
      this.app.dom.btnOpenUnifiedSettings.title = 'Tùy chỉnh cài đặt Sudoku (Tia gióng, Bút chì, Số lượt lỗi)';
    }
    if (this.app.dom.btnPreviewNext) {
      this.app.dom.btnPreviewNext.classList.remove('btn-locked-arena');
      this.app.dom.btnPreviewNext.disabled = false;
      this.app.dom.btnPreviewNext.title = 'Xem trước nước đi tiếp theo (hiển thị ô đích và các ô chặn xung quanh)';
    }
    if (this.app.dom.btnClearBoard) {
      this.app.dom.btnClearBoard.classList.remove('btn-locked-arena');
      this.app.dom.btnClearBoard.disabled = false;
      this.app.dom.btnClearBoard.title = 'Xóa toàn bộ bàn cờ';
    }
    if (this.app.dom.toggleSolution) {
      this.app.dom.toggleSolution.disabled = false;
    }
    if (this.app.dom.btnFillAllSolution) {
      this.app.dom.btnFillAllSolution.disabled = false;
      this.app.dom.btnFillAllSolution.classList.remove('btn-locked-arena');
    }

    if (this.savedSettings) {
      this.app.crosshatchMode = this.savedSettings.crosshatchMode;
      this.app.crosshatchIncludeBoxes = this.savedSettings.crosshatchIncludeBoxes;
      this.app.sameDigitMatchColor = this.savedSettings.sameDigitMatchColor;
      this.app.pencilType = this.savedSettings.pencilType || 'manual';
      this.app.showCandidates = this.savedSettings.showCandidates || false;

      if (typeof this.app.updateCrosshatchBtnLabel === 'function') {
        this.app.updateCrosshatchBtnLabel();
      }
      if (typeof this.app.updatePencilUI === 'function') {
        this.app.updatePencilUI();
      }
      if (typeof this.app.updateSolutionPreviewLockUI === 'function') {
        this.app.updateSolutionPreviewLockUI();
      }
    }
  }

  /**
   * Gọi khi mắc lỗi điền sai
   */
  onMistakeRecorded() {
    if (!this.isActive) return;

    this.mistakes++;
    this.updateHUD();

    if (this.mistakes >= this.maxMistakes) {
      this.handleGameOver('mistakes');
    }
  }

  /**
   * Đếm lùi thời gian
   */
  onTimerTick() {
    if (!this.isActive || this.timeLimitMinutes === 0) return;

    this.remainingSeconds--;
    this.updateTimerDisplay();

    if (this.remainingSeconds <= 0) {
      this.handleGameOver('timeout');
    }
  }

  updateTimerDisplay() {
    if (!this.dom.hudTimer) return;
    if (this.timeLimitMinutes === 0) {
      this.dom.hudTimer.textContent = '⏳ ∞';
      return;
    }

    const mins = Math.floor(Math.max(0, this.remainingSeconds) / 60);
    const secs = Math.max(0, this.remainingSeconds) % 60;
    const str = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    this.dom.hudTimer.textContent = `⏳ ${str}`;

    if (this.remainingSeconds <= 60) {
      this.dom.hudTimer.classList.add('timer-danger');
    } else {
      this.dom.hudTimer.classList.remove('timer-danger');
    }
  }

  /**
   * Xử lý Thua cuộc (Hết mạng hoặc Hết giờ)
   */
  async handleGameOver(reason) {
    if (this.isEnding) return;
    this.isEnding = true;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.endTime = Date.now();

    this.app.playSound('gameover');

    // 1. Hoàn nguyên hệ quy chiếu về góc chuẩn ban đầu với hiệu ứng xoay lật mượt mà
    await this.restoreBoardOrientationAnimated();

    // 2. Mở Modal tổng kết thất bại
    const reasonText = reason === 'timeout' ? 'HẾT THỜI GIAN THI ĐẤU' : 'BẠN ĐÃ MẮC ĐỦ 3 LỖI (HẾT MẠNG)';
    if (this.dom.summaryTitle) this.dom.summaryTitle.innerHTML = '💀 BẠN ĐÃ THẤT THỦ';
    if (this.dom.summarySubtitle) {
      this.dom.summarySubtitle.textContent = `${reasonText} • Bàn cờ đã được hoàn nguyên về góc chuẩn để đối chiếu!`;
    }

    this.restoreUserSettings();
    this.populateSummaryData(false);
    if (this.dom.modalSummary) this.dom.modalSummary.classList.add('active');
  }

  /**
   * Xử lý Chiến thắng
   */
  async handleVictory() {
    if (this.isEnding) return;
    this.isEnding = true;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.endTime = Date.now();

    this.app.playSound('complete');

    // Hoàn nguyên bàn cờ về góc chuẩn ban đầu
    await this.restoreBoardOrientationAnimated();

    this.restoreUserSettings();

    if (this.dom.summaryTitle) this.dom.summaryTitle.innerHTML = '🏆 CHIẾN THẮNG HUY HOÀNG!';
    if (this.dom.summarySubtitle) {
      this.dom.summarySubtitle.textContent =
        'Bạn đã giải thành công câu đố Extreme! Bàn cờ đã được hoàn nguyên về góc chuẩn ban đầu.';
    }

    this.populateSummaryData(true);
    if (typeof this.app.recordSeedConquest === 'function') {
      const finishTime = this.dom.summaryTime ? this.dom.summaryTime.textContent : '00:00';
      this.app.recordSeedConquest(this.seedId, finishTime, this.mistakes);
    }
    if (this.dom.modalSummary) this.dom.modalSummary.classList.add('active');
  }

  /**
   * Hoàn nguyên ma trận bàn cờ về hướng chuẩn ban đầu với hiệu ứng mượt mà
   */
  async restoreBoardOrientationAnimated() {
    const boardWrap = document.querySelector('.board-grid-wrapper') || document.querySelector('.sudoku-board');
    if (boardWrap) {
      boardWrap.classList.add('arena-board-restoring');
    }

    await new Promise(r => setTimeout(r, 400));

    // Nghịch đảo bàn cờ hiện tại
    const restoredCurrent = this.applyInverseTransform(this.app.currentBoard, this.transformType);
    const restoredInitial = this.applyInverseTransform(this.app.initialBoard, this.transformType);
    const restoredSolution = this.applyInverseTransform(this.app.solution, this.transformType);

    this.app.currentBoard = restoredCurrent;
    this.app.initialBoard = restoredInitial;
    this.app.solution = restoredSolution;
    this.transformType = 'none';

    this.app.renderBoard();

    await new Promise(r => setTimeout(r, 400));
    if (boardWrap) {
      boardWrap.classList.remove('arena-board-restoring');
    }
  }

  /**
   * Điền dữ liệu vào bảng tổng kết kết quả
   */
  populateSummaryData(isVictory) {
    const elapsedSecs = Math.floor((this.endTime - this.startTime) / 1000);
    const m = Math.floor(elapsedSecs / 60);
    const s = elapsedSecs % 60;
    const timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    // Đếm tỉ lệ hoàn thành
    let filled = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.app.currentBoard[r][c] !== 0) filled++;
      }
    }
    const percent = Math.min(100, Math.round((filled / 81) * 100));

    if (this.dom.summarySeed) this.dom.summarySeed.textContent = `#${this.seedId}`;
    if (this.dom.summaryWinRate) this.dom.summaryWinRate.textContent = `${this.winRate}%`;
    if (this.dom.summaryTime) this.dom.summaryTime.textContent = timeStr;
    if (this.dom.summaryMistakes) this.dom.summaryMistakes.textContent = `${this.mistakes} / 3`;
    if (this.dom.summaryTrades) this.dom.summaryTrades.textContent = `${this.tradesCount} lần`;
    if (this.dom.summaryRadars) this.dom.summaryRadars.textContent = `${this.maxRadars - this.radarUsesRemaining} / ${this.maxRadars}`;
    if (this.dom.summaryProgress) this.dom.summaryProgress.textContent = `${percent}%`;
  }

  /**
   * Sao chép thẻ kết quả trận đấu để gửi cho bạn bè so tài
   */
  async copyShareCard() {
    const elapsedSecs = Math.floor((this.endTime - this.startTime) / 1000);
    const m = Math.floor(elapsedSecs / 60);
    const s = elapsedSecs % 60;
    const timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    let filled = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.app.currentBoard[r][c] !== 0) filled++;
      }
    }
    const percent = Math.min(100, Math.round((filled / 81) * 100));
    const status = percent === 100 ? '🏆 CHIẾN THẮNG' : '💀 THẤT THỦ';

    const text = [
      `⚔️ [Sudo9ku] ĐẤU TRƯỜNG EXTREME - KẾT QUẢ SO TÀI ⚔️`,
      `Trạng thái: ${status}`,
      `Mã đề thi đấu: #${this.seedId} (Tỉ lệ thắng: ${this.winRate}%)`,
      `Thời gian hoàn thành: ${timeStr}`,
      `Lỗi vi phạm: ${this.mistakes}/3`,
      `Đổi lỗi lấy số: ${this.tradesCount} lần`,
      `Dùng Radar mù: ${this.maxRadars - this.radarUsesRemaining}/${this.maxRadars}`,
      `Tiến độ bàn cờ: ${percent}%`,
      `👉 Hãy nhập mã đề #${this.seedId} trên Sudo9ku để cùng so tài nào!`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      this.showTemporaryToast('📋 Đã sao chép kết quả so tài vào bộ nhớ tạm!');
    } catch (e) {
      window.prompt('Sao chép kết quả so tài:', text);
    }
  }

  /**
   * Xác nhận thoát Đấu trường
   */
  confirmQuitArena() {
    const confirmed = window.confirm('Bạn có chắc chắn muốn bỏ cuộc và thoát khỏi Đấu Trường Extreme?');
    if (!confirmed) return;

    this.quitArena();
  }

  /**
   * Thoát Đấu trường về chế độ thông thường
   */
  quitArena() {
    this.isActive = false;
    this.isEnding = true;
    if (this.timerInterval) clearInterval(this.timerInterval);

    // Hoàn nguyên góc nhìn nếu đang biến đổi
    if (this.transformType !== 'none') {
      const restoredCurrent = this.applyInverseTransform(this.app.currentBoard, this.transformType);
      const restoredInitial = this.applyInverseTransform(this.app.initialBoard, this.transformType);
      const restoredSolution = this.applyInverseTransform(this.app.solution, this.transformType);
      this.app.currentBoard = restoredCurrent;
      this.app.initialBoard = restoredInitial;
      this.app.solution = restoredSolution;
      this.transformType = 'none';
      this.app.renderBoard();
    }

    this.restoreUserSettings();
    this.hideHUD();
    this.resetKeypadLockVisuals();
    if (this.app.dom.normalTimerBadge && this.app.normalTimerMode !== 'none') {
      this.app.dom.normalTimerBadge.style.display = 'inline-flex';
      this.app.startNormalTimer();
    }
    this.app.setStatus('Đã thoát Đấu Trường Extreme. Bàn cờ trở về chế độ bình thường.', 'valid');
  }

  showHUD() {
    if (this.dom.hudBar) {
      this.dom.hudBar.style.display = 'flex';
    }
  }

  hideHUD() {
    if (this.dom.hudBar) {
      this.dom.hudBar.style.display = 'none';
    }
  }

  updateHUD() {
    if (!this.dom.hudBar) return;

    if (this.dom.hudSeedBadge) this.dom.hudSeedBadge.textContent = `Đề #${this.seedId}`;
    if (this.dom.hudWinRateBadge) this.dom.hudWinRateBadge.textContent = `${this.winRate}%`;

    const tInfo = PERSPECTIVE_TRANSFORMS[this.transformType] || PERSPECTIVE_TRANSFORMS.none;
    if (this.dom.hudTransformBadge) this.dom.hudTransformBadge.textContent = `📐 ${tInfo.shortName}`;

    // Cập nhật biểu tượng 3 mạng (❤️❤️❤️)
    if (this.dom.hudLives) {
      let hearts = '';
      for (let i = 0; i < this.maxMistakes; i++) {
        if (i < this.mistakes) {
          hearts += '<span class="life-lost">❌</span>';
        } else {
          hearts += '<span class="life-active">❤️</span>';
        }
      }
      this.dom.hudLives.innerHTML = `${hearts} <span class="life-num">(${this.mistakes}/${this.maxMistakes})</span>`;
    }

    // Cập nhật các số đang săn
    if (this.dom.hudHeldNumbers) {
      if (this.heldNumbers.length === 0) {
        this.dom.hudHeldNumbers.innerHTML = '<span class="no-number">Hết số</span>';
      } else {
        const badges = this.heldNumbers.map(n => `<span class="held-number-badge">${n}</span>`).join(' ');
        this.dom.hudHeldNumbers.innerHTML = badges;
      }
    }

    // Cập nhật nút Radar
    if (this.dom.btnRadar) {
      this.dom.btnRadar.innerHTML = `📡 Radar (${this.radarUsesRemaining})`;
      this.dom.btnRadar.disabled = this.radarUsesRemaining <= 0;
    }

    // Cập nhật nút Đổi lỗi lấy số
    if (this.dom.btnSacrificeLife) {
      this.dom.btnSacrificeLife.disabled = this.heldNumbers.length >= 3 || this.mistakes >= 3;
    }

    this.updateTimerDisplay();
  }

  /**
   * Khóa hoặc mở các phím trên numpad tương ứng với các số đang săn
   */
  updateKeypadLockVisuals() {
    const numpadBtns = document.querySelectorAll('.numpad-btn');
    numpadBtns.forEach(btn => {
      const val = parseInt(btn.dataset.val, 10);
      if (val >= 1 && val <= 9) {
        if (this.heldNumbers.includes(val)) {
          btn.classList.add('arena-key-active');
          btn.classList.remove('arena-key-locked');
        } else {
          btn.classList.remove('arena-key-active');
          btn.classList.add('arena-key-locked');
        }
      }
    });
  }

  resetKeypadLockVisuals() {
    const numpadBtns = document.querySelectorAll('.numpad-btn');
    numpadBtns.forEach(btn => {
      btn.classList.remove('arena-key-active', 'arena-key-locked');
    });
  }

  showTemporaryToast(msg) {
    let toast = document.getElementById('arena-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'arena-toast';
      toast.className = 'arena-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  /**
   * Tạo đề fallback ngoại tuyến nếu máy offline
   */
  generateFallbackSeedPuzzle(seedNum) {
    const bank = (typeof window !== 'undefined' && window.SUDOKU_PUZZLE_BANK) ? window.SUDOKU_PUZZLE_BANK : null;
    const cleanSeed = String(seedNum).trim().toUpperCase();
    if (bank) {
      let exactMatch = null;
      for (const cat of ['nightmare', 'extreme', 'evil']) {
        if (Array.isArray(bank[cat])) {
          exactMatch = bank[cat].find(p => String(p.id).toUpperCase() === cleanSeed);
          if (exactMatch) break;
        }
      }
      if (exactMatch) {
        const baseGrid = [];
        const baseSol = [];
        for (let r = 0; r < 9; r++) {
          baseGrid.push(exactMatch.mission.slice(r * 9, (r + 1) * 9).split('').map(Number));
          baseSol.push(exactMatch.solution.slice(r * 9, (r + 1) * 9).split('').map(Number));
        }
        return {
          success: true,
          id: String(exactMatch.id),
          winRate: exactMatch.win_rate || 25,
          grid: baseGrid,
          solution: baseSol
        };
      }
    }

    let s = (Math.abs(parseInt(seedNum, 10)) || 1367) % 2147483647;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };

    const baseMission = "300049000000600501752001000001000700500396000008150096003010060004000100000028000";
    const baseSolution = "316549827489672531752831649691284753547396218238157496873415962924763185165928374";

    const baseGrid = [];
    const baseSol = [];
    for (let r = 0; r < 9; r++) {
      baseGrid.push(baseMission.slice(r * 9, (r + 1) * 9).split('').map(Number));
      baseSol.push(baseSolution.slice(r * 9, (r + 1) * 9).split('').map(Number));
    }

    // Permutation logic
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [digits[i], digits[j]] = [digits[j], digits[i]];
    }
    const digitMap = { 0: 0 };
    for (let i = 1; i <= 9; i++) digitMap[i] = digits[i - 1];

    const newGrid = Array.from({ length: 9 }, () => Array(9).fill(0));
    const newSol = Array.from({ length: 9 }, () => Array(9).fill(0));
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        newGrid[r][c] = digitMap[baseGrid[r][c]];
        newSol[r][c] = digitMap[baseSol[r][c]];
      }
    }

    const winRate = Number((20 + (rnd() * 40)).toFixed(2));
    return {
      success: true,
      id: String(seedNum),
      winRate,
      grid: newGrid,
      solution: newSol
    };
  }
}
