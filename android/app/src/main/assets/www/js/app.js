/**
 * app.js
 * Điểm khởi động và quản lý toàn bộ giao diện Sudoku Vision Solver
 */

import { SudokuSolver } from './sudoku_solver.js';
import { HumanSolver } from './human_solver.js';
import { ImageProcessor } from './image_processor.js';
import { FormulaDiagramViewer } from './formula_diagrams.js';
import { ExtremeArenaManager } from './extreme_arena.js';

class SudokuApp {
  constructor() {
    this.initialBoard = Array.from({ length: 9 }, () => Array(9).fill(0));
    this.currentBoard = Array.from({ length: 9 }, () => Array(9).fill(0));
    this.solution = null;
    this.solveSteps = [];
    this.currentStepIndex = 0;
    this.cellStepMap = Array.from({ length: 9 }, () => Array(9).fill(null));
    this.userMovesHistory = [];

    this.selectedCell = null;
    this.showCandidates = false;
    this.showSolution = false;
    this.isPlaying = false;
    this.playTimer = null;
    this.playSpeed = 1000;
    this.soundEnabled = true;

    this.isPreviewMode = false;
    this.previewStepIndex = null;
    this.previewStep = null;
    this.availablePreviewSteps = null;

    this.isFormulaInspectionMode = false;
    this.formulaInspectionStep = null;
    this.formulaInspectionStepIndex = null;
    this.playingBoardBackup = null;
    this.manualCandidatesBackup = null;
    this.formulaInspectionTimeout = null;

    this.imageProcessor = new ImageProcessor();
    this.audioCtx = null;
    this.lastLoadedImage = null;

    // Quản lý khung bàn cờ & kéo thả chỉnh sửa vùng cắt
    this.currentGridBounds = null;
    this.origW = 0;
    this.origH = 0;
    this.isDrawingCrop = false;
    this.isDragging = false;
    this.activeHandle = null;
    this.dragStart = null;
    this.dragInitialBounds = null;

    // Cài đặt số lượt sai & Thống kê lịch sử ván cờ (Mặc định: Không giới hạn)
    this.maxMistakes = localStorage.getItem('sudoku_max_mistakes');
    if (!this.maxMistakes || this.maxMistakes === '3' || this.maxMistakes === '10') {
      this.maxMistakes = 'unlimited';
      localStorage.setItem('sudoku_max_mistakes', 'unlimited');
    }
    this.customMistakesVal = parseInt(localStorage.getItem('sudoku_custom_mistakes_val') || '10', 10);
    this.instantFeedback = localStorage.getItem('sudoku_instant_feedback') !== 'false';
    this.mistakesCount = 0;
    this.recentGames = this.loadRecentGames();
    this.currentGameRecord = null;
    this.originalPuzzleGrid = null;

    // Cài đặt Bút chì thủ công & Tùy chỉnh ứng viên (Pencil Marks)
    this.isPencilMode = false;
    this.pencilType = localStorage.getItem('sudoku_pencil_type') || 'manual'; // 'manual' | 'auto'
    this.manualCandidates = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
    this.autoRemoveNotes = localStorage.getItem('sudoku_auto_remove_notes') !== 'false';
    this.highlightMatchingNotes = localStorage.getItem('sudoku_highlight_matching_notes') !== 'false';

    // Cài đặt Ghi chú loại trừ thủ công (Negative Pencil Marks - Ô này KHÔNG THỂ có số này)
    this.isBanPencilMode = false;
    this.manualBannedCandidates = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
    this.manualBannedCandidatesBackup = null;

    // Cài đặt Tia gióng ngang dọc (Cross-Hatching) & Đồng bộ màu số
    this.crosshatchMode = localStorage.getItem('sudoku_crosshatch_mode') || 'all'; // 'all' | '3' | '2' | '1' | 'none'
    this.sameDigitMatchColor = localStorage.getItem('sudoku_same_digit_match_color') !== 'false';
    this.crosshatchIncludeBoxes = localStorage.getItem('sudoku_crosshatch_boxes') !== 'false';

    // Cài đặt Tiến trình bước giải & Sổ tay hướng dẫn (Xem trước tương lai hay Chỉ xem lại quá khứ)
    this.allowForwardSteps = localStorage.getItem('sudoku_allow_forward_steps') !== 'false';

    // Cài đặt Đồng hồ thời gian ván chơi bình thường (Timer)
    this.normalTimerMode = localStorage.getItem('sudoku_timer_mode') || 'countup'; // 'countup' | 'countdown' | 'none'
    this.normalCountdownMinutes = parseInt(localStorage.getItem('sudoku_timer_countdown_mins') || '10', 10);
    this.normalTimerElapsedSeconds = 0;
    this.normalTimerRemainingSeconds = this.normalCountdownMinutes * 60;
    this.normalTimerInterval = null;
    this.activeCustomSeed = null;
    this.activeCustomDifficulty = 'medium';
    this.activeRadarDigit = 5;
    this.activeRadarFormula = null;

    // ⚡ Kaitun Suy Luận Thông Minh (Mặc định: TẮT)
    const storedKaitun = localStorage.getItem('sudoku_kaitun_mode');
    this.kaitunModeEnabled = storedKaitun === 'true'; // Mặc định TẮT trừ khi người dùng chủ động BẬT
    this.kaitunDuration = parseInt(localStorage.getItem('sudoku_kaitun_duration') || '5', 10);
    this._kaitunTimerId = null;
    this._kaitunSecondsLeft = 0;
    this._activeKaitunFormula = null;

    this.diagramViewer = new FormulaDiagramViewer();

    this.initHardwareAcceleration();
    this.initDOM();
    this.arenaManager = new ExtremeArenaManager(this);
    this.initBoardGrid();
    this.bindEvents();
    this.initSound();
    this.updateMistakeBadge();
    this.updatePencilUI();
    this.updateCrosshatchBtnLabel();
    this.updateSolutionPreviewLockUI();
    this.updateNormalTimerDisplay();
    this.updateQuickKaitunUI();

    // Tự động kiểm tra tham số URL (đề chơi chung) hoặc nạp ảnh mẫu ban đầu
    this.checkInitialUrlParams();
  }

  /**
   * Kích hoạt tăng tốc phần cứng card đồ họa rời (NVIDIA RTX 3050)
   * Yêu cầu GPU Context hiệu năng cao (High Performance) thay vì render bằng CPU
   */
  initHardwareAcceleration() {
    try {
      const probeCanvas = document.createElement('canvas');
      probeCanvas.width = 16;
      probeCanvas.height = 16;
      const gl = probeCanvas.getContext('webgl2', { powerPreference: 'high-performance' }) ||
                 probeCanvas.getContext('webgl', { powerPreference: 'high-performance' });
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const rendererName = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'GPU High Performance';
        console.log('⚡ [GPU Acceleration] Đã kích hoạt kết xuất tăng tốc GPU:', rendererName);
        this.gpuRendererName = rendererName;
      }
    } catch (e) {
      console.warn('Lỗi kích hoạt GPU hardware acceleration:', e);
    }
  }

  initDOM() {
    this.dom = {
      // Board & Numpad
      sudokuGrid: document.getElementById('sudoku-grid'),
      statusIndicator: document.getElementById('status-indicator'),
      statusText: document.getElementById('status-text'),
      btnPreviewNext: document.getElementById('btn-preview-next'),
      previewBanner: document.getElementById('preview-banner'),
      previewTitle: document.getElementById('preview-title'),
      previewExplanation: document.getElementById('preview-explanation'),
      btnApplyPreview: document.getElementById('btn-apply-preview'),
      btnApplyAllPreview: document.getElementById('btn-apply-all-preview'),
      btnNextPreview: document.getElementById('btn-next-preview'),
      btnPreviewFormula: document.getElementById('btn-preview-formula'),
      btnClosePreview: document.getElementById('btn-close-preview'),
      btnCrosshatchToggle: document.getElementById('btn-crosshatch-toggle'),
      crosshatchBtnLabel: document.getElementById('crosshatch-btn-label'),
      btnOpenCrosshatchSettings: document.getElementById('btn-open-crosshatch-settings'),
      btnPencilToggle: document.getElementById('btn-pencil-toggle'),
      pencilBtnLabel: document.getElementById('pencil-btn-label'),
      btnOpenPencilSettings: document.getElementById('btn-open-pencil-settings'),
      btnOpenUnifiedSettings: document.getElementById('btn-open-unified-settings'),
      btnRestartGame: document.getElementById('btn-restart-game'),
      btnClearBoard: document.getElementById('btn-clear-board'),
      numpadBtns: document.querySelectorAll('.numpad-btn:not(.btn-pencil-numpad):not(.btn-ban-pencil-numpad)'),
      btnNumpadPencil: document.getElementById('btn-numpad-pencil'),
      numpadPencilText: document.getElementById('numpad-pencil-text'),
      btnNumpadBanPencil: document.getElementById('btn-numpad-ban-pencil'),
      numpadBanPencilText: document.getElementById('numpad-ban-pencil-text'),
      btnMenuBanPencil: document.getElementById('btn-menu-ban-pencil'),

      // Input & Image
      dropzone: document.getElementById('dropzone'),
      fileInput: document.getElementById('file-input'),
      btnUploadFile: document.getElementById('btn-upload-file'),
      btnOpenCamera: document.getElementById('btn-open-camera'),
      btnSample: document.getElementById('btn-sample'),
      samplePresetCard: document.getElementById('sample-preset-card'),
      sampleWebCard: document.getElementById('sample-web-card'),
      previewContainer: document.getElementById('preview-container'),
      imagePreview: document.getElementById('image-preview'),
      gridOverlayCanvas: document.getElementById('grid-overlay-canvas'),
      progressContainer: document.getElementById('progress-container'),
      progressFill: document.getElementById('progress-fill'),
      progressPercent: document.getElementById('progress-percent'),
      progressText: document.getElementById('progress-text'),
      cropActionsBar: document.getElementById('crop-actions-bar'),
      btnDrawCrop: document.getElementById('btn-draw-crop'),
      btnAutoDetect: document.getElementById('btn-auto-detect'),
      btnReprocess: document.getElementById('btn-reprocess'),

      // Controls & Walkthrough
      toggleSolution: document.getElementById('toggle-solution'),
      solutionPreviewSubtext: document.getElementById('solution-preview-subtext'),
      btnFillAllSolution: document.getElementById('btn-fill-all-solution'),
      stepSlider: document.getElementById('step-slider'),
      stepCounter: document.getElementById('step-counter'),
      btnStepStart: document.getElementById('btn-step-start'),
      btnStepPrev: document.getElementById('btn-step-prev'),
      btnStepPlay: document.getElementById('btn-step-play'),
      btnStepNext: document.getElementById('btn-step-next'),
      btnStepEnd: document.getElementById('btn-step-end'),
      btnSyncCurrentBoard: document.getElementById('btn-sync-current-board'),
      currentUserStepNum: document.getElementById('current-user-step-num'),
      speedBtns: document.querySelectorAll('.speed-btn'),

      // Explanation card
      strategyNameText: document.getElementById('strategy-name-text'),
      formulaBadge: document.getElementById('formula-badge'),
      btnViewCurrentFormula: document.getElementById('btn-view-current-formula'),
      stepDetailsTitle: document.getElementById('step-details-title'),
      stepRuleBox: document.getElementById('step-rule-box'),
      stepPatternText: document.getElementById('step-pattern-text'),
      stepExplanationText: document.getElementById('step-explanation-text'),
      sectionAction: document.getElementById('section-action'),
      stepActionText: document.getElementById('step-action-text'),
      btnApplyWalkthroughStep: document.getElementById('btn-apply-walkthrough-step'),
      stepMetaChips: document.getElementById('step-meta-chips'),

      // Sudoku.com Direct Integration & Nightmare Mode
      selectSudokuLevel: document.getElementById('select-sudoku-level'),
      btnFetchSudoku: document.getElementById('btn-fetch-sudoku'),
      btnQuickFetchSudoku: document.getElementById('btn-quick-fetch-sudoku'),
      btnNightmareMode: document.getElementById('btn-nightmare-mode'),
      btnHuntLowRate: document.getElementById('btn-hunt-low-rate'),
      fetchStatusInfo: document.getElementById('fetch-status-info'),
      linkSudokuWeb: document.getElementById('link-sudoku-web'),

      // Formula Modal & Guide
      btnOpenFormulaGuide: document.getElementById('btn-open-formula-guide'),
      formulaModal: document.getElementById('formula-modal'),
      btnCloseFormulaModal: document.getElementById('btn-close-formula-modal'),
      formulaGuideBody: document.getElementById('formula-guide-body'),

      // User Guide & Release Review Modal
      btnOpenUserGuide: document.getElementById('btn-open-user-guide'),
      modalUserGuide: document.getElementById('modal-user-guide'),
      btnCloseUserGuide: document.getElementById('btn-close-user-guide'),
      btnCloseUserGuideFooter: document.getElementById('btn-close-user-guide-footer'),
      userGuideTabBtns: document.querySelectorAll('.guide-tab-btn'),

      // Inspector
      inspectorCoords: document.getElementById('inspector-coords'),
      inspectorContent: document.getElementById('inspector-content'),

      // Settings
      btnSoundToggle: document.getElementById('btn-sound-toggle'),
      soundIcon: document.getElementById('sound-icon'),
      btnThemeToggle: document.getElementById('btn-theme-toggle'),
      themeIcon: document.getElementById('theme-icon'),

      // Camera Modal
      cameraModal: document.getElementById('camera-modal'),
      cameraVideo: document.getElementById('camera-video'),
      btnCloseCamera: document.getElementById('btn-close-camera'),
      btnCapturePhoto: document.getElementById('btn-capture-photo'),

      // Mobile Tabs & Panels
      mobileTabsNav: document.getElementById('mobile-tabs-nav'),
      mobileTabBtns: document.querySelectorAll('.mobile-tab-btn'),
      panelBoard: document.getElementById('panel-board'),
      panelScanner: document.getElementById('panel-scanner'),
      panelSolver: document.getElementById('panel-solver'),

      // Mobile Native Camera
      mobileCameraInput: document.getElementById('mobile-camera-input'),
      btnMobileCamera: document.getElementById('btn-mobile-camera'),

      // Phone Connect Modal & QR Code
      btnPhoneConnect: document.getElementById('btn-phone-connect'),
      phoneModal: document.getElementById('phone-modal'),
      btnClosePhoneModal: document.getElementById('btn-close-phone-modal'),
      btnCopyPhoneUrl: document.getElementById('btn-copy-phone-url'),
      phoneUrlText: document.getElementById('phone-url-text'),
      qrImage: document.getElementById('qr-image'),

      // PWA Android Installation
      btnInstallApp: document.getElementById('btn-install-app'),
      btnModalInstallPwa: document.getElementById('btn-modal-install-pwa'),

      // Mistakes & Game History
      mistakesBadge: document.getElementById('mistakes-badge'),
      mistakeCounterText: document.getElementById('mistake-counter-text'),
      btnOpenHistory: document.getElementById('btn-open-history'),
      mistakesSettingsModal: document.getElementById('mistakes-settings-modal'),
      btnCloseMistakesModal: document.getElementById('btn-close-mistakes-modal'),
      btnSaveMistakesSettings: document.getElementById('btn-save-mistakes-settings'),
      inputCustomMistakes: document.getElementById('input-custom-mistakes'),
      toggleInstantFeedback: document.getElementById('toggle-instant-feedback'),
      historyModal: document.getElementById('history-modal'),
      btnCloseHistoryModal: document.getElementById('btn-close-history-modal'),
      btnClearHistory: document.getElementById('btn-clear-history'),
      recentGamesList: document.getElementById('recent-games-list'),
      metricTotalGames: document.getElementById('metric-total-games'),
      metricTotalMistakes: document.getElementById('metric-total-mistakes'),
      metricAvgMistakes: document.getElementById('metric-avg-mistakes'),
      metricFlawlessGames: document.getElementById('metric-flawless-games'),
      gameOverModal: document.getElementById('game-over-modal'),
      gameOverMsg: document.getElementById('game-over-msg'),
      btnContinueUnlimited: document.getElementById('btn-continue-unlimited'),
      btnRestartCurrentGame: document.getElementById('btn-restart-current-game'),

      // Pencil Modal & Settings
      pencilSettingsModal: document.getElementById('pencil-settings-modal'),
      btnClosePencilModal: document.getElementById('btn-close-pencil-modal'),
      btnSavePencilSettings: document.getElementById('btn-save-pencil-settings'),
      btnAutoFillNotes: document.getElementById('btn-auto-fill-notes'),
      btnClearAllNotes: document.getElementById('btn-clear-all-notes'),
      toggleAutoRemoveNotes: document.getElementById('toggle-auto-remove-notes'),
      toggleHighlightMatchingNotes: document.getElementById('toggle-highlight-matching-notes'),

      // Cross-Hatching Modal & Settings
      crosshatchSettingsModal: document.getElementById('crosshatch-settings-modal'),
      btnCloseCrosshatchModal: document.getElementById('btn-close-crosshatch-modal'),
      btnSaveCrosshatchSettings: document.getElementById('btn-save-crosshatch-settings'),
      toggleSameDigitColor: document.getElementById('toggle-same-digit-color'),
      toggleCrosshatchBoxes: document.getElementById('toggle-crosshatch-boxes'),

      // Unified Settings Modal
      unifiedSettingsModal: document.getElementById('unified-settings-modal'),
      btnCloseUnifiedSettings: document.getElementById('btn-close-unified-settings'),
      btnSaveUnifiedSettings: document.getElementById('btn-save-unified-settings'),
      btnUnifiedOpenHistory: document.getElementById('btn-unified-open-history'),
      settingsTabBtns: document.querySelectorAll('.settings-tab-btn'),
      settingsTabPanes: document.querySelectorAll('.settings-tab-pane'),
      toggleAllowForwardSteps: document.getElementById('toggle-allow-forward-steps'),
      forwardStepsStatusBadge: document.getElementById('forward-steps-status-badge'),

      // Normal Timer & Custom Puzzle
      normalTimerBadge: document.getElementById('normal-timer-badge'),
      normalTimerIcon: document.getElementById('normal-timer-icon'),
      normalTimerText: document.getElementById('normal-timer-text'),
      normalTimerCountdownConfig: document.getElementById('normal-timer-countdown-config'),
      normalTimerCustomMinutes: document.getElementById('normal-timer-custom-minutes'),
      btnOpenCustomPuzzle: document.getElementById('btn-open-custom-puzzle'),
      btnOpenCustomPuzzleAlt: document.getElementById('btn-open-custom-puzzle-alt'),
      customPuzzleModal: document.getElementById('custom-puzzle-modal'),
      btnCloseCustomPuzzle: document.getElementById('btn-close-custom-puzzle'),
      btnCancelCustomPuzzle: document.getElementById('btn-cancel-custom-puzzle'),
      btnCustomSeedRandom: document.getElementById('btn-custom-seed-random'),
      customPuzzleSeedInput: document.getElementById('custom-puzzle-seed-input'),
      btnCopyCustomLink: document.getElementById('btn-copy-custom-link'),
      customShareUrlBox: document.getElementById('custom-share-url-box'),
      customLinkCopiedToast: document.getElementById('custom-link-copied-toast'),
      btnStartCustomPuzzle: document.getElementById('btn-start-custom-puzzle'),

      // Seed Leaderboard (Bảng Xếp Hạng Seed Khó Nhất)
      btnOpenSeedLeaderboard: document.getElementById('btn-open-seed-leaderboard'),
      btnOpenSeedLeaderboardAlt: document.getElementById('btn-open-seed-leaderboard-alt'),
      seedLeaderboardModal: document.getElementById('seed-leaderboard-modal'),
      btnCloseSeedLeaderboard: document.getElementById('btn-close-seed-leaderboard'),
      btnCloseSeedLeaderboardFooter: document.getElementById('btn-close-seed-leaderboard-footer'),
      seedSearchInput: document.getElementById('seed-search-input'),
      btnClearSeedSearch: document.getElementById('btn-clear-seed-search'),
      seedLeaderboardList: document.getElementById('seed-leaderboard-list'),
      btnSeedTabs: document.querySelectorAll('.btn-seed-tab'),
      btnCustomPickLeaderboardSeed: document.getElementById('btn-custom-pick-leaderboard-seed'),
      conqueredSeedsCount: document.getElementById('conquered-seeds-count'),
      leaderboardMatchSummary: document.getElementById('leaderboard-match-summary'),

      // ⚡ Kaitun Reasoning HUD & Settings DOM
      kaitunReasoningBanner: document.getElementById('kaitun-reasoning-banner'),
      kaitunHudName: document.getElementById('kaitun-hud-name'),
      kaitunHudBadge: document.getElementById('kaitun-hud-badge'),
      kaitunHudTimer: document.getElementById('kaitun-hud-timer'),
      btnToggleKaitunHud: document.getElementById('btn-toggle-kaitun-hud'),
      btnCloseKaitunHud: document.getElementById('btn-close-kaitun-hud'),
      kaitunTargetCoords: document.getElementById('kaitun-target-coords'),
      kaitunTargetVal: document.getElementById('kaitun-target-val'),
      kaitunHudLogic: document.getElementById('kaitun-hud-logic'),
      kaitunHudVisual: document.getElementById('kaitun-hud-visual'),
      kaitunSelfFillNotice: document.getElementById('kaitun-self-fill-notice'),
      btnQuickToggleKaitun: document.getElementById('btn-quick-toggle-kaitun'),
      quickKaitunLabel: document.getElementById('quick-kaitun-label'),
      toggleKaitunMode: document.getElementById('toggle-kaitun-mode'),
      inputCustomKaitunSeconds: document.getElementById('input-custom-kaitun-seconds'),

      // Overlay SVG tia sáng laser
      radarLaserOverlay: document.getElementById('radar-laser-overlay'),

      // Legacy Tactical Digit Radar (An toàn khi radar bị gỡ khỏi UI)
      digitRadarCard: document.getElementById('digit-radar-card'),
      radarActiveDigitLabel: document.getElementById('radar-active-digit-label'),
      radarStatusBadge: document.getElementById('radar-status-badge'),
      radarDigitSelector: document.getElementById('radar-digit-selector'),
      digitRadarContent: document.getElementById('digit-radar-content'),
      btnTriggerKaitun: document.getElementById('btn-trigger-kaitun')
    };
  }

  /**
   * Khởi tạo bàn cờ 9x9 ô
   */
  initBoardGrid() {
    this.dom.sudokuGrid.innerHTML = '';
    this.cellElements = Array.from({ length: 9 }, () => Array(9).fill(null));

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('div');
        cell.className = 'sudoku-cell';
        cell.dataset.row = r;
        cell.dataset.col = c;

        // Container cho ứng viên (pencil marks)
        const candGrid = document.createElement('div');
        candGrid.className = 'candidates-grid';
        candGrid.style.display = 'none';

        const candSpans = [];
        for (let num = 1; num <= 9; num++) {
          const cand = document.createElement('span');
          cand.className = 'candidate-num';
          cand.dataset.candidate = num;
          cand.textContent = num;
          candGrid.appendChild(cand);
          candSpans.push(cand);
        }

        const valSpan = document.createElement('span');
        valSpan.className = 'cell-value';

        cell.appendChild(candGrid);
        cell.appendChild(valSpan);

        cell._valSpan = valSpan;
        cell._candGrid = candGrid;
        cell._candSpans = candSpans;

        cell.addEventListener('click', () => this.selectCell(r, c));
        this.dom.sudokuGrid.appendChild(cell);
        this.cellElements[r][c] = cell;
      }
    }
  }

  /**
   * Khởi tạo Web Audio tạo âm thanh êm tai
   */
  initSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {
      console.warn('Web Audio API không khả dụng:', e);
    }
  }

  playSound(type = 'step') {
    if (!this.soundEnabled || !this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    if (type === 'step') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'complete') {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const chordOsc = this.audioCtx.createOscillator();
        const chordGain = this.audioCtx.createGain();
        chordOsc.connect(chordGain);
        chordGain.connect(this.audioCtx.destination);
        chordOsc.type = 'triangle';
        chordOsc.frequency.setValueAtTime(freq, now + i * 0.06);
        chordGain.gain.setValueAtTime(0.08, now + i * 0.06);
        chordGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.35);
        chordOsc.start(now + i * 0.06);
        chordOsc.stop(now + i * 0.06 + 0.35);
      });
    } else if (type === 'select') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'conflict') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.14);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.14);
    }
  }

  /**
   * Đăng ký sự kiện giao diện
   */
  bindEvents() {
    // 1. Kéo thả & Upload file ảnh
    this.dom.dropzone.addEventListener('click', () => this.dom.fileInput.click());
    this.dom.btnUploadFile.addEventListener('click', () => this.dom.fileInput.click());
    this.dom.fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.processImageSource(e.target.files[0]);
      }
    });

    this.dom.dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dom.dropzone.classList.add('dragover');
    });
    this.dom.dropzone.addEventListener('dragleave', () => {
      this.dom.dropzone.classList.remove('dragover');
    });
    this.dom.dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dom.dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.processImageSource(e.dataTransfer.files[0]);
      }
    });

    // Dán ảnh từ Clipboard (Ctrl + V)
    window.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          this.processImageSource(blob);
          break;
        }
      }
    });

    // Nhận ảnh từ message (postMessage giữa các cửa sổ)
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'LOAD_IMAGE' && e.data.dataUrl) {
        this.processImageSource(e.data.dataUrl);
      }
    });

    // 2. Nút nạp ảnh mẫu & Chỉnh khung lưới
    this.dom.btnSample.addEventListener('click', () => this.loadSampleImage());
    this.dom.samplePresetCard.addEventListener('click', () => this.loadSampleImage());
    if (this.dom.sampleWebCard) {
      this.dom.sampleWebCard.addEventListener('click', () => {
        this.processImageSource('assets/sudoku_web.png');
      });
    }

    // 2a. Tự động lấy bài trên Sudoku.com & Thử thách Ác mộng
    if (this.dom.btnFetchSudoku) {
      this.dom.btnFetchSudoku.addEventListener('click', () => this.fetchSudokuCom());
    }
    if (this.dom.btnQuickFetchSudoku) {
      this.dom.btnQuickFetchSudoku.addEventListener('click', () => this.fetchSudokuCom());
    }
    if (this.dom.btnNightmareMode) {
      this.dom.btnNightmareMode.addEventListener('click', () => {
        if (this.dom.selectSudokuLevel) this.dom.selectSudokuLevel.value = 'nightmare';
        this.fetchSudokuCom('nightmare');
      });
    }
    if (this.dom.btnHuntLowRate) {
      this.dom.btnHuntLowRate.addEventListener('click', () => {
        if (this.dom.selectSudokuLevel) this.dom.selectSudokuLevel.value = 'extreme';
        this.fetchSudokuCom('extreme', true);
      });
    }
    if (this.dom.selectSudokuLevel) {
      this.dom.selectSudokuLevel.addEventListener('change', (e) => {
        const lvl = e.target.value;
        if (this.dom.linkSudokuWeb) {
          if (lvl === 'nightmare') {
            this.dom.linkSudokuWeb.href = 'https://en.wikipedia.org/wiki/Mathematics_of_Sudoku#Minimum_number_of_givens';
            this.dom.linkSudokuWeb.textContent = 'Tài liệu ↗';
            this.dom.linkSudokuWeb.title = 'Mở tài liệu nghiên cứu Sudoku 17 ô';
          } else {
            this.dom.linkSudokuWeb.href = `https://sudoku.com/vi/${lvl === 'extreme' ? 'extreme/' : lvl + '/'}`;
            this.dom.linkSudokuWeb.textContent = 'Sudoku.com ↗';
            this.dom.linkSudokuWeb.title = `Mở trên Sudoku.com kèm các cờ đang giải`;
          }
        }
        if (this.dom.fetchStatusInfo) {
          const names = {
            nightmare: '☠️ Ác mộng (< 5% - Đề 17 ô & Khó nhất TG)',
            extreme: 'Cực khó (~27%)',
            evil: 'Độc địa (~49%)',
            expert: 'Chuyên gia (~37%)',
            hard: 'Khó (~40%)',
            medium: 'Trung bình (~48%)',
            easy: 'Dễ (~63%)'
          };
          this.dom.fetchStatusInfo.textContent = `Đề bài: ${names[lvl] || lvl} (Chờ tải)`;
        }
      });
    }
    if (this.dom.linkSudokuWeb) {
      this.dom.linkSudokuWeb.addEventListener('click', (e) => {
        const lvl = this.dom.selectSudokuLevel ? this.dom.selectSudokuLevel.value : 'extreme';
        if (lvl === 'nightmare') {
          return; // Để liên kết ngoài mở bài báo nghiên cứu
        }
        e.preventDefault();
        this.openSudokuComWeb();
      });
    }

    // 2a-2. Sổ tay công thức Sudoku Modal
    if (this.dom.btnOpenFormulaGuide) {
      this.dom.btnOpenFormulaGuide.addEventListener('click', () => this.openFormulaModal());
    }
    if (this.dom.btnCloseFormulaModal) {
      this.dom.btnCloseFormulaModal.addEventListener('click', () => this.closeFormulaModal());
    }
    if (this.dom.formulaModal) {
      this.dom.formulaModal.addEventListener('click', (e) => {
        if (e.target === this.dom.formulaModal) this.closeFormulaModal();
      });
    }
    if (this.dom.btnViewCurrentFormula) {
      this.dom.btnViewCurrentFormula.addEventListener('click', () => {
        this.openFormulaModal(this.currentFormulaId);
      });
    }

    // 2a-3. Hướng dẫn & Review Tính năng mới Modal
    if (this.dom.btnOpenUserGuide) {
      this.dom.btnOpenUserGuide.addEventListener('click', () => {
        const settingsMenu = document.getElementById('settings-dropdown-menu');
        if (settingsMenu) settingsMenu.style.display = 'none';
        this.openUserGuideModal();
      });
    }
    if (this.dom.btnCloseUserGuide) {
      this.dom.btnCloseUserGuide.addEventListener('click', () => this.closeUserGuideModal());
    }
    if (this.dom.btnCloseUserGuideFooter) {
      this.dom.btnCloseUserGuideFooter.addEventListener('click', () => this.closeUserGuideModal());
    }
    if (this.dom.modalUserGuide) {
      this.dom.modalUserGuide.addEventListener('click', (e) => {
        if (e.target === this.dom.modalUserGuide) this.closeUserGuideModal();
      });
    }
    if (this.dom.userGuideTabBtns) {
      this.dom.userGuideTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.switchUserGuideTab(btn.dataset.tab);
        });
      });
    }

    this.dom.btnReprocess.addEventListener('click', () => {
      if (this.currentGridBounds) {
        this.reprocessWithCustomBounds(this.currentGridBounds);
      } else if (this.lastLoadedImage) {
        this.processImage(this.lastLoadedImage);
      }
    });

    if (this.dom.btnDrawCrop) {
      this.dom.btnDrawCrop.addEventListener('click', () => this.toggleDrawingCrop());
    }
    if (this.dom.btnAutoDetect) {
      this.dom.btnAutoDetect.addEventListener('click', () => this.autoDetectGridAndReprocess());
    }
    this.initGridCanvasInteractions();

    // 2b. Chuyển đổi tab trên màn hình điện thoại
    if (this.dom.mobileTabBtns) {
      this.dom.mobileTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.switchMobileTab(btn.dataset.tab);
        });
      });
    }

    // 2c. Camera điện thoại trực tiếp
    if (this.dom.btnMobileCamera && this.dom.mobileCameraInput) {
      this.dom.btnMobileCamera.addEventListener('click', () => this.dom.mobileCameraInput.click());
      this.dom.mobileCameraInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.processImageSource(e.target.files[0]);
        }
      });
    }

    // 2d. Modal kết nối điện thoại & Mã QR
    if (this.dom.btnPhoneConnect) {
      this.dom.btnPhoneConnect.addEventListener('click', () => this.openPhoneModal());
    }
    if (this.dom.btnClosePhoneModal) {
      this.dom.btnClosePhoneModal.addEventListener('click', () => this.closePhoneModal());
    }
    if (this.dom.btnCopyPhoneUrl) {
      this.dom.btnCopyPhoneUrl.addEventListener('click', () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(this.dom.phoneUrlText.textContent);
        }
        this.dom.btnCopyPhoneUrl.textContent = '✅ Đã chép!';
        setTimeout(() => { this.dom.btnCopyPhoneUrl.textContent = '📋 Sao chép'; }, 2000);
      });
    }

    // 3. Xem trước đáp án ("Cho biết trước đáp án")
    this.dom.toggleSolution.addEventListener('change', (e) => {
      if (this.arenaManager && this.arenaManager.isActive) {
        e.target.checked = false;
        this.playSound('conflict');
        this.setStatus('🔒 Tính năng xem trước đáp án bị khóa theo luật Đấu Trường Extreme!', 'conflict');
        if (typeof this.arenaManager.showTemporaryToast === 'function') {
          this.arenaManager.showTemporaryToast('🔒 Xem trước đáp án bị khóa trong Đấu Trường!');
        }
        return;
      }
      if (e.target.checked && !this.allowForwardSteps) {
        e.target.checked = false;
        this.playSound('error');
        this.setStatus('🔒 Tính năng xem trước đáp án đang bị khóa do bạn đã tắt xem trước trong Tùy chỉnh (Tab Tiến trình & Hướng dẫn).', 'invalid');
        return;
      }
      this.showSolution = e.target.checked;
      this.renderBoard();
    });

    if (this.dom.btnFillAllSolution) {
      this.dom.btnFillAllSolution.addEventListener('click', () => {
        if (this.arenaManager && this.arenaManager.isActive) {
          this.playSound('conflict');
          this.setStatus('🔒 Không thể tự động điền đáp án trong Đấu Trường Extreme!', 'conflict');
          return;
        }
        if (!this.allowForwardSteps) {
          this.playSound('error');
          this.setStatus('🔒 Tính năng điền toàn bộ đáp án đang bị khóa do bạn đã tắt xem trước trong Tùy chỉnh (Tab Tiến trình & Hướng dẫn).', 'invalid');
          return;
        }
        this.fillAllSolutionDigits();
      });
    }

    // 3b. Tính năng Xem trước nước đi tiếp theo (Preview Next Move)
    if (this.dom.btnPreviewNext) {
      this.dom.btnPreviewNext.addEventListener('click', () => this.previewNextStep(1));
    }
    if (this.dom.btnApplyPreview) {
      this.dom.btnApplyPreview.addEventListener('click', () => this.applyPreviewStep());
    }
    if (this.dom.btnApplyAllPreview) {
      this.dom.btnApplyAllPreview.addEventListener('click', () => this.fillAllSolutionDigits());
    }
    if (this.dom.btnNextPreview) {
      this.dom.btnNextPreview.addEventListener('click', () => this.previewNextStep(1));
    }
    if (this.dom.btnPreviewFormula) {
      this.dom.btnPreviewFormula.addEventListener('click', () => {
        const formulaId = (this.previewStep && this.previewStep.formulaId)
          ? this.previewStep.formulaId
          : this.currentFormulaId;
        this.openFormulaModal(formulaId);
      });
    }
    if (this.dom.btnClosePreview) {
      this.dom.btnClosePreview.addEventListener('click', () => {
        if (this.isFormulaInspectionMode) {
          this.exitFormulaInspection();
        } else {
          this.closePreview();
        }
      });
    }

    // 4. Điều khiển bước giải (Step Player)
    this.dom.btnStepStart.addEventListener('click', () => this.goToStep(0));
    this.dom.btnStepPrev.addEventListener('click', () => this.goToStep(this.currentStepIndex - 1));
    this.dom.btnStepNext.addEventListener('click', () => this.goToStep(this.currentStepIndex + 1));
    this.dom.btnStepEnd.addEventListener('click', () => this.goToStep(this.solveSteps.length - 1));
    this.dom.btnStepPlay.addEventListener('click', () => this.toggleAutoPlay());
    this.dom.stepSlider.addEventListener('input', (e) => this.goToStep(parseInt(e.target.value, 10)));

    if (this.dom.btnSyncCurrentBoard) {
      this.dom.btnSyncCurrentBoard.addEventListener('click', () => {
        const userMovesCount = this.userMovesHistory ? this.userMovesHistory.length : 0;
        this.goToStep(userMovesCount);
        this.setStatus(`↩ Đã trở về nước cờ hiện tại của bạn (Bước ${userMovesCount})!`, 'valid');
      });
    }

    if (this.dom.btnApplyWalkthroughStep) {
      this.dom.btnApplyWalkthroughStep.addEventListener('click', () => {
        const step = this.solveSteps[this.currentStepIndex];
        if (step && step.targetCell) {
          const { row, col, value } = step.targetCell;
          this.recordUserMove(row, col, value, step);
          this.currentBoard[row][col] = value;
          this.manualCandidates[row][col] = [];
          if (this.autoRemoveNotes) {
            this.removeCandidateFromPeers(row, col, value);
          }
          this.syncSolvingWalkthroughWithCurrentBoard();
          this.renderBoard();
          this.triggerCellFeedback(row, col, true);
          this.playSound('correct');
          this.setStatus(`✅ Đã áp dụng bước gợi ý: Số ${value} tại (Hàng ${row + 1}, Cột ${col + 1})!`, 'valid');
          if (this.isBoardComplete()) {
            this.setStatus('🎉 Chúc mừng! Bạn đã hoàn thành câu đố chuẩn xác 100%!', 'solved');
            this.playSound('complete');
            if (this.currentGameRecord) {
              this.currentGameRecord.status = 'completed';
              this.currentGameRecord.mistakes = this.mistakesCount;
              this.saveRecentGames();
            }
          }
        }
      });
    }

    // Tốc độ phát
    this.dom.speedBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.dom.speedBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.playSpeed = parseInt(btn.dataset.speed, 10);
        if (this.isPlaying) {
          this.stopAutoPlay();
          this.startAutoPlay();
        }
      });
    });

    // 5. Numpad trên màn hình & phím tắt
    this.dom.numpadBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.val, 10);
        if (val === 0) {
          this.eraseSelectedCell();
          return;
        }
        if (val >= 1 && val <= 9 && this.isDigitCompleted(val)) {
          this.playSound('conflict');
          return;
        }
        this.inputSelectedCellValue(val);
      });
    });

    // 5b. Tactical Digit Radar selector (Chọn số cần quét thế bí)
    if (this.dom.radarDigitSelector) {
      this.dom.radarDigitSelector.addEventListener('click', (e) => {
        const btn = e.target.closest('.radar-digit-pill');
        if (btn && btn.dataset.digit) {
          const d = parseInt(btn.dataset.digit, 10);
          this.setRadarDigit(d);
          this.playSound('step');
        }
      });
    }

    // 5c. Nút Kích Hoạt Kaitun (Bẻ khóa dây chuyền thế cực bí)
    if (this.dom.btnTriggerKaitun) {
      this.dom.btnTriggerKaitun.addEventListener('click', () => {
        this.triggerKaitunAutoResolve();
      });
    }

    // 5d. Nút đóng Kaitun HUD & Nút bật/tắt nhanh Kaitun
    if (this.dom.btnCloseKaitunHud) {
      this.dom.btnCloseKaitunHud.addEventListener('click', () => {
        this.clearKaitunInference();
      });
    }
    if (this.dom.btnQuickToggleKaitun) {
      this.dom.btnQuickToggleKaitun.addEventListener('click', () => {
        this.toggleKaitunMode();
      });
    }

    // 5e. Thiết lập bố cục tối giản, thu gọn thanh công cụ & ẩn các bảng ít dùng
    this._initLayoutAndToolbarToggles();

    window.addEventListener('keydown', (e) => this.handleKeyDown(e));

    // 6. Chế độ bút chì thủ công & Tùy chỉnh ứng viên
    if (this.dom.btnPencilToggle) {
      this.dom.btnPencilToggle.addEventListener('click', () => {
        this.togglePencilMode();
      });
    }

    if (this.dom.btnNumpadPencil) {
      this.dom.btnNumpadPencil.addEventListener('click', () => {
        this.togglePencilMode();
      });
    }

    if (this.dom.btnNumpadBanPencil) {
      this.dom.btnNumpadBanPencil.addEventListener('click', () => {
        this.toggleBanPencilMode();
      });
    }

    if (this.dom.btnMenuBanPencil) {
      this.dom.btnMenuBanPencil.addEventListener('click', () => {
        this.toggleBanPencilMode();
      });
    }

    // 6a. Nút Tùy chỉnh hợp nhất trên thanh công cụ (Unified Settings)
    if (this.dom.btnOpenUnifiedSettings) {
      this.dom.btnOpenUnifiedSettings.addEventListener('click', () => {
        this.openUnifiedSettingsModal();
      });
    }

    if (this.dom.btnCloseUnifiedSettings) {
      this.dom.btnCloseUnifiedSettings.addEventListener('click', () => {
        this.closeUnifiedSettingsModal();
      });
    }

    if (this.dom.unifiedSettingsModal) {
      this.dom.unifiedSettingsModal.addEventListener('click', (e) => {
        if (e.target === this.dom.unifiedSettingsModal) this.closeUnifiedSettingsModal();
      });
    }

    if (this.dom.btnSaveUnifiedSettings) {
      this.dom.btnSaveUnifiedSettings.addEventListener('click', () => {
        this.saveUnifiedSettings();
      });
    }

    if (this.dom.btnUnifiedOpenHistory) {
      this.dom.btnUnifiedOpenHistory.addEventListener('click', () => {
        this.closeUnifiedSettingsModal();
        this.openHistoryModal();
      });
    }

    if (this.dom.settingsTabBtns) {
      this.dom.settingsTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.switchSettingsTab(btn.dataset.tab);
        });
      });
    }

    if (this.dom.toggleAllowForwardSteps) {
      this.dom.toggleAllowForwardSteps.addEventListener('change', (e) => {
        this.updateForwardStepsBadge(e.target.checked);
      });
    }

    // Normal Timer Event Listeners
    if (this.dom.normalTimerBadge) {
      this.dom.normalTimerBadge.addEventListener('click', () => {
        this.openUnifiedSettingsModal('timer');
      });
    }
    const normalTimerRadios = document.querySelectorAll('input[name="normal-timer-mode"]');
    normalTimerRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.updateTimerModeVisuals(e.target.value);
      });
    });
    const normalTimerQuickBtns = document.querySelectorAll('.btn-normal-timer-quick');
    normalTimerQuickBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        normalTimerQuickBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (this.dom.normalTimerCustomMinutes) {
          this.dom.normalTimerCustomMinutes.value = btn.dataset.mins;
        }
      });
    });

    // Custom Puzzle & Seed Sharing Modal Listeners
    if (this.dom.btnOpenCustomPuzzle) {
      this.dom.btnOpenCustomPuzzle.addEventListener('click', () => {
        this.openCustomPuzzleModal();
      });
    }
    if (this.dom.btnOpenCustomPuzzleAlt) {
      this.dom.btnOpenCustomPuzzleAlt.addEventListener('click', () => {
        this.openCustomPuzzleModal();
      });
    }
    if (this.dom.btnCloseCustomPuzzle) {
      this.dom.btnCloseCustomPuzzle.addEventListener('click', () => {
        this.closeCustomPuzzleModal();
      });
    }
    if (this.dom.btnCancelCustomPuzzle) {
      this.dom.btnCancelCustomPuzzle.addEventListener('click', () => {
        this.closeCustomPuzzleModal();
      });
    }
    if (this.dom.customPuzzleModal) {
      this.dom.customPuzzleModal.addEventListener('click', (e) => {
        if (e.target === this.dom.customPuzzleModal) this.closeCustomPuzzleModal();
      });
    }
    if (this.dom.btnCustomSeedRandom) {
      this.dom.btnCustomSeedRandom.addEventListener('click', () => {
        this.randomizeCustomSeed();
      });
    }
    if (this.dom.customPuzzleSeedInput) {
      this.dom.customPuzzleSeedInput.addEventListener('input', () => {
        this.updateCustomPuzzleShareLink();
      });
    }

    // Seed Leaderboard Modal Listeners
    if (this.dom.btnOpenSeedLeaderboard) {
      this.dom.btnOpenSeedLeaderboard.addEventListener('click', () => {
        this.openSeedLeaderboardModal('play');
      });
    }
    if (this.dom.btnOpenSeedLeaderboardAlt) {
      this.dom.btnOpenSeedLeaderboardAlt.addEventListener('click', () => {
        this.openSeedLeaderboardModal('play');
      });
    }
    if (this.dom.btnCloseSeedLeaderboard) {
      this.dom.btnCloseSeedLeaderboard.addEventListener('click', () => {
        this.closeSeedLeaderboardModal();
      });
    }
    if (this.dom.btnCloseSeedLeaderboardFooter) {
      this.dom.btnCloseSeedLeaderboardFooter.addEventListener('click', () => {
        this.closeSeedLeaderboardModal();
      });
    }
    if (this.dom.seedLeaderboardModal) {
      this.dom.seedLeaderboardModal.addEventListener('click', (e) => {
        if (e.target === this.dom.seedLeaderboardModal) {
          this.closeSeedLeaderboardModal();
        }
      });
    }
    if (this.dom.btnCustomPickLeaderboardSeed) {
      this.dom.btnCustomPickLeaderboardSeed.addEventListener('click', () => {
        this.closeCustomPuzzleModal();
        this.openSeedLeaderboardModal('select-custom');
      });
    }
    if (this.dom.btnSeedTabs) {
      this.dom.btnSeedTabs.forEach(tabBtn => {
        tabBtn.addEventListener('click', () => {
          this.dom.btnSeedTabs.forEach(b => b.classList.remove('active'));
          tabBtn.classList.add('active');
          const tab = tabBtn.dataset.tab || 'all';
          const query = this.dom.seedSearchInput ? this.dom.seedSearchInput.value.trim() : '';
          this.renderSeedLeaderboard(tab, query);
        });
      });
    }
    if (this.dom.seedSearchInput) {
      this.dom.seedSearchInput.addEventListener('input', () => {
        const query = this.dom.seedSearchInput.value.trim();
        if (this.dom.btnClearSeedSearch) {
          this.dom.btnClearSeedSearch.style.display = query ? 'block' : 'none';
        }
        const activeTab = document.querySelector('.btn-seed-tab.active')?.dataset.tab || 'all';
        this.renderSeedLeaderboard(activeTab, query);
      });
    }
    if (this.dom.btnClearSeedSearch) {
      this.dom.btnClearSeedSearch.addEventListener('click', () => {
        if (this.dom.seedSearchInput) {
          this.dom.seedSearchInput.value = '';
          this.dom.btnClearSeedSearch.style.display = 'none';
          const activeTab = document.querySelector('.btn-seed-tab.active')?.dataset.tab || 'all';
          this.renderSeedLeaderboard(activeTab, '');
        }
      });
    }
    const customDiffBtns = document.querySelectorAll('.btn-custom-diff');
    customDiffBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        customDiffBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateCustomPuzzleShareLink();
      });
    });
    const customWinrateBtns = document.querySelectorAll('.btn-custom-winrate');
    const winrateLabel = document.getElementById('custom-winrate-label');
    const winrateNames = {
      nightmare: 'Ác mộng (< 10%)',
      hardcore: 'Cực gắt (20 - 25%)',
      standard: 'Tiêu chuẩn (30 - 40%)',
      balanced: 'Cân bằng (> 45%)'
    };
    const winrateColors = {
      nightmare: '#ef4444',
      hardcore: '#f97316',
      standard: '#f59e0b',
      balanced: '#10b981'
    };
    customWinrateBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        customWinrateBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const rate = btn.dataset.rate || 'standard';
        if (winrateLabel) {
          winrateLabel.textContent = winrateNames[rate] || rate;
          winrateLabel.style.color = winrateColors[rate] || '#f59e0b';
        }
        this.updateCustomPuzzleShareLink();
      });
    });
    const customTimerChoiceBtns = document.querySelectorAll('.btn-custom-timer-choice');
    customTimerChoiceBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        customTimerChoiceBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateCustomPuzzleShareLink();
      });
    });
    if (this.dom.btnCopyCustomLink) {
      this.dom.btnCopyCustomLink.addEventListener('click', () => {
        this.copyCustomPuzzleShareLink();
      });
    }
    if (this.dom.btnStartCustomPuzzle) {
      this.dom.btnStartCustomPuzzle.addEventListener('click', () => {
        this.startCustomPuzzleFromModal();
      });
    }

    // Compatibility listeners for test scripts & older triggers
    if (this.dom.btnOpenPencilSettings) {
      this.dom.btnOpenPencilSettings.addEventListener('click', () => {
        this.openUnifiedSettingsModal('pencil');
      });
    }

    if (this.dom.btnClosePencilModal) {
      this.dom.btnClosePencilModal.addEventListener('click', () => {
        this.closeUnifiedSettingsModal();
      });
    }

    if (this.dom.pencilSettingsModal) {
      this.dom.pencilSettingsModal.addEventListener('click', (e) => {
        if (e.target === this.dom.pencilSettingsModal) this.closeUnifiedSettingsModal();
      });
    }

    if (this.dom.btnSavePencilSettings) {
      this.dom.btnSavePencilSettings.addEventListener('click', () => {
        this.savePencilSettings();
      });
    }

    if (this.dom.btnAutoFillNotes) {
      this.dom.btnAutoFillNotes.addEventListener('click', () => {
        this.autoFillAllNotes();
      });
    }

    if (this.dom.btnClearAllNotes) {
      this.dom.btnClearAllNotes.addEventListener('click', () => {
        this.clearAllNotes();
      });
    }

    // 6b. Tùy chỉnh tia gióng ngang dọc (Cross-Hatching)
    if (this.dom.btnCrosshatchToggle) {
      this.dom.btnCrosshatchToggle.addEventListener('click', () => {
        this.cycleCrosshatchMode();
      });
    }

    if (this.dom.btnOpenCrosshatchSettings) {
      this.dom.btnOpenCrosshatchSettings.addEventListener('click', () => {
        this.openUnifiedSettingsModal('crosshatch');
      });
    }

    if (this.dom.btnCloseCrosshatchModal) {
      this.dom.btnCloseCrosshatchModal.addEventListener('click', () => {
        this.closeUnifiedSettingsModal();
      });
    }

    if (this.dom.crosshatchSettingsModal) {
      this.dom.crosshatchSettingsModal.addEventListener('click', (e) => {
        if (e.target === this.dom.crosshatchSettingsModal) this.closeUnifiedSettingsModal();
      });
    }

    if (this.dom.btnSaveCrosshatchSettings) {
      this.dom.btnSaveCrosshatchSettings.addEventListener('click', () => {
        this.saveCrosshatchSettings();
      });
    }

    if (this.dom.btnRestartGame) {
      this.dom.btnRestartGame.addEventListener('click', () => {
        this.restartCurrentGame();
      });
    }

    this.dom.btnClearBoard.addEventListener('click', () => {
      this.clearBoard();
      this.playSound('step');
    });

    // 7. Bật/Tắt âm thanh & Giao diện Sáng/Tối
    this.dom.btnSoundToggle.addEventListener('click', () => {
      this.soundEnabled = !this.soundEnabled;
      this.dom.soundIcon.textContent = this.soundEnabled ? '🔊' : '🔇';
    });

    this.dom.btnThemeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nextTheme);
      this.dom.themeIcon.textContent = nextTheme === 'dark' ? '🌙' : '☀️';
    });

    // 8. Camera Modal
    this.dom.btnOpenCamera.addEventListener('click', () => this.openCamera());
    this.dom.btnCloseCamera.addEventListener('click', () => this.closeCamera());
    this.dom.btnCapturePhoto.addEventListener('click', () => this.captureCameraPhoto());

    // 9. Mobile Tabs Navigation
    if (this.dom.mobileTabBtns) {
      this.dom.mobileTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.switchMobileTab(btn.dataset.tab);
        });
      });
    }

    // 10. Mobile Native Camera capture
    if (this.dom.btnMobileCamera && this.dom.mobileCameraInput) {
      this.dom.btnMobileCamera.addEventListener('click', () => {
        this.dom.mobileCameraInput.click();
      });
      this.dom.mobileCameraInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.processImageSource(e.target.files[0]);
        }
      });
    }

    // 11. Modal Cài đặt App & QR (Hỗ trợ cả iOS và Android)
    if (this.dom.btnPhoneConnect) {
      this.dom.btnPhoneConnect.addEventListener('click', () => this.openPhoneModal());
    }
    if (this.dom.btnClosePhoneModal) {
      this.dom.btnClosePhoneModal.addEventListener('click', () => this.closePhoneModal());
    }
    if (this.dom.phoneModal) {
      this.dom.phoneModal.addEventListener('click', (e) => {
        if (e.target === this.dom.phoneModal) this.closePhoneModal();
      });
    }
    if (this.dom.btnCopyPhoneUrl) {
      this.dom.btnCopyPhoneUrl.addEventListener('click', async () => {
        const url = this.dom.phoneUrlText ? this.dom.phoneUrlText.textContent : window.location.href;
        try {
          await navigator.clipboard.writeText(url);
          this.dom.btnCopyPhoneUrl.textContent = '✓ Đã sao chép';
          setTimeout(() => {
            if (this.dom.btnCopyPhoneUrl) this.dom.btnCopyPhoneUrl.textContent = '📋 Sao chép';
          }, 2000);
        } catch (err) {
          console.warn('Lỗi copy clipboard:', err);
        }
      });
    }

    // Chuyển đổi tab hệ điều hành (iOS / Android) trong Modal
    const tabIos = document.getElementById('modal-tab-ios');
    const tabAndroid = document.getElementById('modal-tab-android');
    const contentIos = document.getElementById('modal-content-ios');
    const contentAndroid = document.getElementById('modal-content-android');

    if (tabIos && tabAndroid) {
      tabIos.addEventListener('click', () => {
        tabIos.style.background = 'rgba(56, 189, 248, 0.2)';
        tabIos.style.color = 'var(--accent-cyan)';
        tabAndroid.style.background = 'transparent';
        tabAndroid.style.color = 'var(--text-muted)';
        if (contentIos) contentIos.style.display = 'block';
        if (contentAndroid) contentAndroid.style.display = 'none';
      });

      tabAndroid.addEventListener('click', () => {
        tabAndroid.style.background = 'rgba(56, 189, 248, 0.2)';
        tabAndroid.style.color = 'var(--accent-cyan)';
        tabIos.style.background = 'transparent';
        tabIos.style.color = 'var(--text-muted)';
        if (contentAndroid) contentAndroid.style.display = 'block';
        if (contentIos) contentIos.style.display = 'none';
      });

      // Tự động chọn tab phù hợp với thiết bị người dùng đang truy cập
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS) {
        tabIos.click();
      }
    }

    // 13. Cài đặt số lượt sai & Lịch sử ván đấu (Đã tắt nút theo yêu cầu người dùng, chỉ hiển thị số lỗi)
    if (this.dom.btnCloseMistakesModal) {
      this.dom.btnCloseMistakesModal.addEventListener('click', () => this.closeMistakesSettingsModal());
    }
    if (this.dom.mistakesSettingsModal) {
      this.dom.mistakesSettingsModal.addEventListener('click', (e) => {
        if (e.target === this.dom.mistakesSettingsModal) this.closeMistakesSettingsModal();
      });
    }
    if (this.dom.btnSaveMistakesSettings) {
      this.dom.btnSaveMistakesSettings.addEventListener('click', () => this.saveMistakesSettings());
    }
    if (this.dom.inputCustomMistakes) {
      this.dom.inputCustomMistakes.addEventListener('focus', () => {
        const customRadio = document.querySelector('input[name="mistake-limit"][value="custom"]');
        if (customRadio) customRadio.checked = true;
      });
      this.dom.inputCustomMistakes.addEventListener('input', () => {
        const customRadio = document.querySelector('input[name="mistake-limit"][value="custom"]');
        if (customRadio) customRadio.checked = true;
      });
    }
    if (this.dom.btnCloseHistoryModal) {
      this.dom.btnCloseHistoryModal.addEventListener('click', () => this.closeHistoryModal());
    }
    if (this.dom.historyModal) {
      this.dom.historyModal.addEventListener('click', (e) => {
        if (e.target === this.dom.historyModal) this.closeHistoryModal();
      });
    }
    if (this.dom.btnClearHistory) {
      this.dom.btnClearHistory.addEventListener('click', () => this.clearHistory());
    }
    if (this.dom.btnContinueUnlimited) {
      this.dom.btnContinueUnlimited.addEventListener('click', () => {
        this.maxMistakes = 'unlimited';
        localStorage.setItem('sudoku_max_mistakes', 'unlimited');
        this.updateMistakeBadge();
        if (this.currentGameRecord) {
          this.currentGameRecord.maxMistakes = 'unlimited';
          this.currentGameRecord.status = 'in_progress';
          this.saveRecentGames();
        }
        this.closeGameOverModal();
        this.setStatus('♾️ Đã kích hoạt chế độ Không Giới Hạn lượt sai. Tiếp tục chơi!', 'valid');
      });
    }
    if (this.dom.btnRestartCurrentGame) {
      this.dom.btnRestartCurrentGame.addEventListener('click', () => {
        if (this.originalPuzzleGrid) {
          this.initialBoard = this.originalPuzzleGrid.map(row => [...row]);
          this.currentBoard = this.originalPuzzleGrid.map(row => [...row]);
          this.solveAndPrepareWalkthrough();
        } else {
          this.currentBoard = this.initialBoard.map(row => [...row]);
          this.renderBoard();
        }
        this.mistakesCount = 0;
        this.updateMistakeBadge();
        this.closeGameOverModal();
        this.startNewGameRecord();
        this.setStatus('🔄 Đã khởi động lại bàn cờ hiện tại. Chúc bạn may mắn!', '');
      });
    }

    // 12. PWA Android Installation (WebAPK)
    this.initPWA();
  }

  /**
   * Nạp ảnh mẫu người dùng cung cấp
   */
  async loadSampleImage() {
    if (this.arenaManager && this.arenaManager.isActive) {
      const confirmLeave = window.confirm('Bạn đang thi đấu trong Đấu Trường Extreme! Bạn có chắc muốn thoát trận đấu để nạp ảnh mẫu?');
      if (!confirmLeave) return;
      this.arenaManager.quitArena();
    }

    try {
      this.dom.progressContainer.classList.add('active');
      this.dom.progressFill.style.width = '20%';
      this.dom.progressPercent.textContent = '20%';
      this.dom.progressText.textContent = 'Đang tải ảnh mẫu...';

      const img = await ImageProcessor.loadImage('assets/sample.png');
      this.lastLoadedImage = img;
      await this.processImage(img);
    } catch (err) {
      console.error('Lỗi khi nạp ảnh mẫu:', err);
      this.setStatus('Lỗi tải ảnh mẫu', 'conflict');
    }
  }

  /**
   * Xử lý nguồn ảnh chung (File, Blob, Image)
   */
  async processImageSource(source) {
    if (this.arenaManager && this.arenaManager.isActive) {
      const confirmLeave = window.confirm('Bạn đang thi đấu trong Đấu Trường Extreme! Bạn có chắc muốn thoát trận đấu để tải ảnh Sudoku mới?');
      if (!confirmLeave) return;
      this.arenaManager.quitArena();
    }

    try {
      this.dom.progressContainer.classList.add('active');
      this.dom.progressFill.style.width = '10%';
      this.dom.progressPercent.textContent = '10%';
      this.dom.progressText.textContent = 'Đang tải hình ảnh...';

      const img = await ImageProcessor.loadImage(source);
      this.lastLoadedImage = img;
      await this.processImage(img);
    } catch (err) {
      alert('Không thể xử lý hình ảnh: ' + err.message);
      this.dom.progressContainer.classList.remove('active');
    }
  }

  /**
   * Quét lưới và nhận diện số từ hình ảnh
   */
  async processImage(img) {
    this.stopAutoPlay();
    this.showSolution = false;
    this.dom.toggleSolution.checked = false;

    // Hiển thị xem trước ảnh
    this.dom.imagePreview.src = img.src;
    this.dom.previewContainer.classList.add('active');
    if (this.dom.cropActionsBar) this.dom.cropActionsBar.style.display = 'flex';
    this.dom.btnReprocess.style.display = 'block';

    this.setStatus('Đang quét và nhận diện ô số...', '');

    const result = await this.imageProcessor.processSudokuImage(img, (percent) => {
      this.dom.progressFill.style.width = `${percent}%`;
      this.dom.progressPercent.textContent = `${percent}%`;
      this.dom.progressText.textContent = `Đang nhận diện các ô: ${percent}%`;
    });

    this.dom.progressContainer.classList.remove('active');

    // Lưu kích thước gốc và bounds hiện tại
    this.origW = result.originalWidth;
    this.origH = result.originalHeight;
    this.currentGridBounds = result.bounds;

    // Vẽ khung nhận diện đè lên ảnh xem trước kèm 8 điểm neo kéo thả
    this.drawGridOverlay(result.bounds, result.originalWidth, result.originalHeight);

    // Gán dữ liệu bàn cờ
    this.initialBoard = SudokuSolver.cloneBoard(result.grid);
    this.currentBoard = SudokuSolver.cloneBoard(result.grid);
    this.originalPuzzleGrid = SudokuSolver.cloneBoard(result.grid);

    // Đếm số ô được nhận diện
    let clueCount = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.initialBoard[r][c] !== 0) clueCount++;
      }
    }

    // Giải bàn cờ và tạo chuỗi bước giải
    this.solveAndPrepareWalkthrough(clueCount);

    // Cuộn mượt lên đầu trang để người dùng luôn nhìn thấy trọn vẹn toàn bộ 9 hàng bàn cờ
    if (window.scrollY > 80) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Nếu trên giao diện điện thoại, tự động chuyển về tab Bàn cờ
    if (window.innerWidth <= 860) {
      this.switchMobileTab('board');
    }
  }

  /**
   * Quét lại bàn cờ theo khung tùy chỉnh (do người dùng kéo thả hoặc chỉnh sửa)
   */
  async reprocessWithCustomBounds(bounds) {
    if (!this.lastLoadedImage) return;

    this.dom.progressContainer.classList.add('active');
    this.dom.progressFill.style.width = '15%';
    this.dom.progressPercent.textContent = '15%';
    this.dom.progressText.textContent = 'Đang nhận diện theo khung tùy chỉnh...';

    const result = await this.imageProcessor.processSudokuImage(this.lastLoadedImage, (percent) => {
      this.dom.progressFill.style.width = `${percent}%`;
      this.dom.progressPercent.textContent = `${percent}%`;
      this.dom.progressText.textContent = `Đang nhận diện các ô: ${percent}%`;
    }, bounds);

    this.dom.progressContainer.classList.remove('active');

    this.origW = result.originalWidth;
    this.origH = result.originalHeight;
    this.currentGridBounds = result.bounds;

    // Vẽ lại khung lưới với 8 điểm neo
    this.drawGridOverlay(result.bounds, result.originalWidth, result.originalHeight);

    // Cập nhật dữ liệu bàn cờ
    this.initialBoard = SudokuSolver.cloneBoard(result.grid);
    this.currentBoard = SudokuSolver.cloneBoard(result.grid);
    this.originalPuzzleGrid = SudokuSolver.cloneBoard(result.grid);

    let clueCount = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.initialBoard[r][c] !== 0) clueCount++;
      }
    }

    this.solveAndPrepareWalkthrough(clueCount);

    if (window.scrollY > 80) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /**
   * Bật/tắt chế độ tự vẽ hình chữ nhật chọn vùng bàn cờ
   */
  toggleDrawingCrop() {
    this.isDrawingCrop = !this.isDrawingCrop;
    if (this.isDrawingCrop) {
      if (this.dom.btnDrawCrop) this.dom.btnDrawCrop.classList.add('active');
      this.dom.gridOverlayCanvas.classList.add('drawing-mode');
      this.setStatus('Hãy kéo chuột trên ảnh để vẽ hình chữ nhật bao quanh bàn cờ...', '');
    } else {
      if (this.dom.btnDrawCrop) this.dom.btnDrawCrop.classList.remove('active');
      this.dom.gridOverlayCanvas.classList.remove('drawing-mode');
      this.setStatus('Đã hủy chế độ vẽ thủ công.', '');
    }
  }

  /**
   * Tự động quét lại và khóa vị trí bàn cờ
   */
  async autoDetectGridAndReprocess() {
    if (!this.lastLoadedImage) return;
    this.setStatus('Đang tự động quét tìm bàn cờ...', '');

    const mainCanvas = document.createElement('canvas');
    mainCanvas.width = this.origW || this.lastLoadedImage.naturalWidth;
    mainCanvas.height = this.origH || this.lastLoadedImage.naturalHeight;
    const ctx = mainCanvas.getContext('2d');
    ctx.drawImage(this.lastLoadedImage, 0, 0);

    const bounds = ImageProcessor.detectGridBounds(mainCanvas);
    await this.reprocessWithCustomBounds(bounds);
  }

  /**
   * Khởi tạo tương tác kéo thả & co giãn khung lưới trên gridOverlayCanvas
   */
  initGridCanvasInteractions() {
    const canvas = this.dom.gridOverlayCanvas;

    const getCoords = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
      const clientY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const getHandleRadius = () => Math.max(10, Math.min(22, Math.round(canvas.width * 0.02)));

    const getHitHandle = (pt) => {
      if (!this.currentGridBounds) return null;
      const b = this.currentGridBounds;
      const r = getHandleRadius() * 1.6;

      const handles = {
        nw: { x: b.x, y: b.y },
        ne: { x: b.x + b.width, y: b.y },
        sw: { x: b.x, y: b.y + b.height },
        se: { x: b.x + b.width, y: b.y + b.height },
        n: { x: b.x + b.width / 2, y: b.y },
        s: { x: b.x + b.width / 2, y: b.y + b.height },
        w: { x: b.x, y: b.y + b.height / 2 },
        e: { x: b.x + b.width, y: b.y + b.height / 2 }
      };

      for (const [key, pos] of Object.entries(handles)) {
        if (Math.hypot(pt.x - pos.x, pt.y - pos.y) <= r) return key;
      }

      // Kiểm tra nếu nằm bên trong khung bàn cờ (để di chuyển toàn bộ)
      if (pt.x >= b.x && pt.x <= b.x + b.width && pt.y >= b.y && pt.y <= b.y + b.height) {
        return 'move';
      }

      return null;
    };

    const getCursorForHandle = (handle) => {
      if (!handle) return this.isDrawingCrop ? 'crosshair' : 'default';
      if (handle === 'nw' || handle === 'se') return 'nwse-resize';
      if (handle === 'ne' || handle === 'sw') return 'nesw-resize';
      if (handle === 'n' || handle === 's') return 'ns-resize';
      if (handle === 'w' || handle === 'e') return 'ew-resize';
      if (handle === 'move') return 'move';
      return 'default';
    };

    const onStart = (e) => {
      if (!this.lastLoadedImage) return;
      const pt = getCoords(e);

      if (this.isDrawingCrop) {
        this.isDragging = true;
        this.activeHandle = 'draw';
        this.dragStart = pt;
        this.currentGridBounds = { x: pt.x, y: pt.y, width: 5, height: 5 };
        this.drawGridOverlay(this.currentGridBounds, this.origW, this.origH);
        return;
      }

      const handle = getHitHandle(pt);
      if (handle) {
        this.isDragging = true;
        this.activeHandle = handle;
        this.dragStart = pt;
        this.dragInitialBounds = { ...this.currentGridBounds };
      }
    };

    const onMove = (e) => {
      if (!this.lastLoadedImage) return;
      const pt = getCoords(e);

      if (!this.isDragging) {
        const handle = getHitHandle(pt);
        canvas.style.cursor = getCursorForHandle(handle);
        return;
      }

      if (this.activeHandle === 'draw') {
        const x1 = Math.min(this.dragStart.x, pt.x);
        const y1 = Math.min(this.dragStart.y, pt.y);
        const x2 = Math.max(this.dragStart.x, pt.x);
        const y2 = Math.max(this.dragStart.y, pt.y);
        this.currentGridBounds = {
          x: Math.round(x1),
          y: Math.round(y1),
          width: Math.round(Math.max(10, x2 - x1)),
          height: Math.round(Math.max(10, y2 - y1))
        };
        this.drawGridOverlay(this.currentGridBounds, this.origW, this.origH);
        return;
      }

      const dx = pt.x - this.dragStart.x;
      const dy = pt.y - this.dragStart.y;
      const init = this.dragInitialBounds;
      let newB = { ...init };

      if (this.activeHandle === 'move') {
        newB.x = Math.max(0, Math.min(this.origW - init.width, init.x + dx));
        newB.y = Math.max(0, Math.min(this.origH - init.height, init.y + dy));
      } else {
        if (this.activeHandle.includes('w')) {
          const maxRight = init.x + init.width;
          newB.x = Math.min(maxRight - 40, init.x + dx);
          newB.width = maxRight - newB.x;
        }
        if (this.activeHandle.includes('e')) {
          newB.width = Math.max(40, init.width + dx);
        }
        if (this.activeHandle.includes('n')) {
          const maxBottom = init.y + init.height;
          newB.y = Math.min(maxBottom - 40, init.y + dy);
          newB.height = maxBottom - newB.y;
        }
        if (this.activeHandle.includes('s')) {
          newB.height = Math.max(40, init.height + dy);
        }
      }

      this.currentGridBounds = {
        x: Math.round(newB.x),
        y: Math.round(newB.y),
        width: Math.round(newB.width),
        height: Math.round(newB.height)
      };
      this.drawGridOverlay(this.currentGridBounds, this.origW, this.origH);
    };

    const onEnd = () => {
      if (!this.isDragging) return;
      this.isDragging = false;

      if (this.activeHandle === 'draw') {
        this.isDrawingCrop = false;
        if (this.dom.btnDrawCrop) this.dom.btnDrawCrop.classList.remove('active');
        canvas.classList.remove('drawing-mode');
      }
      this.activeHandle = null;

      // Tự động nhận diện lại sau khi thả chuột/tay
      if (this.currentGridBounds && this.currentGridBounds.width >= 40 && this.currentGridBounds.height >= 40) {
        this.reprocessWithCustomBounds(this.currentGridBounds);
      }
    };

    canvas.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onStart(e); }, { passive: false });
    window.addEventListener('touchmove', (e) => { if (this.isDragging) e.preventDefault(); onMove(e); }, { passive: false });
    window.addEventListener('touchend', onEnd);
  }

  /**
   * Vẽ khung lưới nhận diện đè lên ảnh xem trước kèm 8 điểm neo kéo thả trực quan
   */
  drawGridOverlay(bounds, origW, origH) {
    this.currentGridBounds = { ...bounds };
    this.origW = origW;
    this.origH = origH;

    const canvas = this.dom.gridOverlayCanvas;
    canvas.width = origW;
    canvas.height = origH;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bx = bounds.x;
    const by = bounds.y;
    const bw = bounds.width;
    const bh = bounds.height;

    // 1. Phủ mờ nhẹ các vùng ngoài bàn cờ để nổi bật Sudoku
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.fillRect(0, 0, origW, by); // Vùng trên
    ctx.fillRect(0, by + bh, origW, origH - (by + bh)); // Vùng dưới
    ctx.fillRect(0, by, bx, bh); // Vùng trái
    ctx.fillRect(bx + bw, by, origW - (bx + bw), bh); // Vùng phải

    // 2. Viền bao ngoài bàn cờ
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 3.5;
    ctx.strokeRect(bx, by, bw, bh);

    // 3. Các đường kẻ lưới 9x9 (vạch 3x3 đậm hơn)
    for (let i = 1; i < 9; i++) {
      const isMajor = (i % 3 === 0);
      ctx.strokeStyle = isMajor ? '#0284c7' : 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = isMajor ? 2.5 : 1;

      // Dọc
      ctx.beginPath();
      ctx.moveTo(bx + (bw / 9) * i, by);
      ctx.lineTo(bx + (bw / 9) * i, by + bh);
      ctx.stroke();

      // Ngang
      ctx.beginPath();
      ctx.moveTo(bx, by + (bh / 9) * i);
      ctx.lineTo(bx + bw, by + (bh / 9) * i);
      ctx.stroke();
    }

    // 4. Vẽ 8 điểm neo tương tác (Corners & Edges Handles)
    const handleRadius = Math.max(6, Math.min(13, Math.round(origW * 0.014)));
    const handles = [
      { x: bx, y: by },
      { x: bx + bw, y: by },
      { x: bx, y: by + bh },
      { x: bx + bw, y: by + bh },
      { x: bx + bw / 2, y: by },
      { x: bx + bw / 2, y: by + bh },
      { x: bx, y: by + bh / 2 },
      { x: bx + bw, y: by + bh / 2 }
    ];

    handles.forEach(h => {
      ctx.beginPath();
      ctx.arc(h.x, h.y, handleRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });

    // 5. Biểu tượng di chuyển ở tâm bàn cờ
    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, handleRadius * 1.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(2, 132, 199, 0.9)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(handleRadius * 1.5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✛', cx, cy);
  }

  /**
   * Tự động lấy bài trực tiếp từ Sudoku.com (đầy đủ các cấp độ, mặc định Cực khó)
   */
  /**
   * Tự động lấy bài trực tiếp từ Sudoku.com hoặc Kho Thử thách Ác mộng (< 5%)
   */
  async fetchSudokuCom(level = null, huntLow = false) {
    if (this.arenaManager && this.arenaManager.isActive) {
      const confirmLeave = window.confirm('Bạn đang thi đấu trong Đấu Trường Extreme! Bạn có chắc muốn thoát trận đấu để nạp đề bài mới từ Sudoku.com?');
      if (!confirmLeave) return;
      this.arenaManager.quitArena();
    }

    const selectedLevel = level || (this.dom.selectSudokuLevel ? this.dom.selectSudokuLevel.value : 'extreme');
    const isNightmare = selectedLevel === 'nightmare';

    // Cập nhật trạng thái các nút
    if (this.dom.btnFetchSudoku) {
      this.dom.btnFetchSudoku.disabled = true;
      this.dom.btnFetchSudoku.textContent = '⏳ Đang tải...';
    }
    if (this.dom.btnQuickFetchSudoku) {
      this.dom.btnQuickFetchSudoku.disabled = true;
      this.dom.btnQuickFetchSudoku.textContent = '⏳ Đang tải...';
    }
    if (this.dom.btnNightmareMode) {
      this.dom.btnNightmareMode.disabled = true;
      this.dom.btnNightmareMode.textContent = '⏳ Đang nạp...';
    }
    if (this.dom.btnHuntLowRate) {
      this.dom.btnHuntLowRate.disabled = true;
      this.dom.btnHuntLowRate.textContent = '🎯 Đang săn...';
    }

    if (this.dom.fetchStatusInfo) {
      this.dom.fetchStatusInfo.textContent = isNightmare
        ? 'Đang mở kho đề Ác mộng (< 5%)...'
        : (huntLow ? 'Đang săn đề có tỉ lệ thắng < 25%...' : `Đang kết nối Sudoku.com (${selectedLevel})...`);
    }
    this.setStatus(
      isNightmare
        ? 'Đang nạp đề Thử thách Ác mộng (Đề 17 ô & Khó nhất thế giới)...'
        : `Đang tải bài Sudoku ${selectedLevel} từ Sudoku.com...`,
      ''
    );

    try {
      let data = null;

      // 1. Thử lấy qua server local (hỗ trợ cả nightmare và hunt_low)
      try {
        const res = await fetch(`/api/fetch-sudoku?level=${selectedLevel}${huntLow ? '&hunt_low=true' : ''}`);
        if (res.ok) {
          data = await res.json();
        }
      } catch (err) {
        console.warn('Không thể kết nối /api/fetch-sudoku, chuyển sang fetch trực tiếp/preset...', err);
      }

      // 2. Nếu server local không khả dụng (chạy file:/// trên Android APK hoặc offline)
      if (!data || !data.success) {
        if (!isNightmare) {
          try {
            const directRes = await fetch(`https://sudoku.com/api/v2/level/${selectedLevel}`, {
              headers: {
                'Accept': 'application/json, text/plain, */*',
                'X-Requested-With': 'XMLHttpRequest'
              }
            });
            if (directRes.ok) {
              const dj = await directRes.json();
              if (dj && dj.mission) {
                const parseStr = (s) => {
                  const mat = [];
                  for (let r = 0; r < 9; r++) {
                    mat.push(s.slice(r * 9, (r + 1) * 9).split('').map(c => (c >= '1' && c <= '9' ? parseInt(c, 10) : 0)));
                  }
                  return mat;
                };
                data = {
                  success: true,
                  id: dj.id,
                  level: selectedLevel,
                  winRate: dj.win_rate || 0,
                  grid: parseStr(dj.mission),
                  solution: dj.solution ? parseStr(dj.solution) : null,
                  mission: dj.mission,
                  solutionStr: dj.solution,
                  source: 'sudoku.com_direct'
                };
              }
            }
          } catch (dirErr) {
            console.warn('Fetch trực tiếp không thành công:', dirErr);
          }
        }
      }

      // 3. Fallback: Lấy từ Kho đề chuẩn phong phú tích hợp sẵn (150+ đề Sudoku.com & Ác mộng)
      if (!data || !data.success || !data.grid) {
        const bank = (typeof window !== 'undefined' && window.SUDOKU_PUZZLE_BANK) ? window.SUDOKU_PUZZLE_BANK : null;
        let list = (bank && bank[selectedLevel] && bank[selectedLevel].length > 0)
          ? [...bank[selectedLevel]]
          : [
              { id: 777, mission: "300049000000600501752001000001000700500396000008150096003010060004000100000028000", solution: "316549827489672531752831649691284753547396218238157496873415962924763185165928374", win_rate: 28.99 }
            ];

        // Lọc săn đề tỉ lệ thắng thấp nếu người dùng yêu cầu
        if (huntLow) {
          const lowList = list.filter(p => (p.win_rate && p.win_rate < 27) || (p.clues && p.clues <= 21));
          if (lowList.length > 0) {
            list = lowList;
          }
        }

        // Đảm bảo không trùng lặp với các bài vừa chơi gần đây (Hơn 700+ đề chuẩn xác thực)
        this.playedPuzzlesHistory = this.playedPuzzlesHistory || new Set();
        let unplayed = list.filter(p => !this.playedPuzzlesHistory.has(String(p.id)));
        let p = null;
        if (unplayed.length > 0) {
          p = unplayed[Math.floor(Math.random() * unplayed.length)];
          this.playedPuzzlesHistory.add(String(p.id));
        } else if (bank && typeof bank.generateInfinitePuzzle === 'function') {
          // Khi đã hoàn thành toàn bộ kho đề chuẩn, tự động kích hoạt Động cơ sinh đề vô hạn
          p = bank.generateInfinitePuzzle(selectedLevel);
        } else {
          this.playedPuzzlesHistory.clear();
          unplayed = list;
          p = unplayed[Math.floor(Math.random() * unplayed.length)];
          this.playedPuzzlesHistory.add(String(p.id));
        }

        const parseStr = (s) => {
          const mat = [];
          for (let r = 0; r < 9; r++) {
            mat.push(s.slice(r * 9, (r + 1) * 9).split('').map(c => (c >= '1' && c <= '9' ? parseInt(c, 10) : 0)));
          }
          return mat;
        };
        data = {
          success: true,
          id: p.id,
          name: p.name,
          clues: p.clues,
          level: selectedLevel,
          winRate: p.win_rate,
          description: p.description,
          grid: parseStr(p.mission),
          solution: parseStr(p.solution),
          mission: p.mission,
          solutionStr: p.solution,
          source: 'sudoku_bank'
        };
      }

      // Nạp ma trận câu đố vào ứng dụng
      this.initialBoard = SudokuSolver.cloneBoard(data.grid);
      this.currentBoard = SudokuSolver.cloneBoard(data.grid);
      this.originalPuzzleGrid = SudokuSolver.cloneBoard(data.grid);
      this.isOriginalClue = Array.from({ length: 9 }, (_, r) =>
        Array.from({ length: 9 }, (_, c) => data.grid[r][c] !== 0)
      );
      this.officialSolution = data.solution;
      this.currentSudokuData = {
        id: data.id,
        level: data.level || selectedLevel,
        winRate: data.winRate,
        mission: data.mission,
        solution: data.solution,
        solutionStr: data.solutionStr,
        source: data.source
      };

      const clueCount = data.grid.flat().filter(x => x > 0).length;

      // Cập nhật thông tin thẻ
      if (this.dom.fetchStatusInfo) {
        if (data.level === 'nightmare' || isNightmare) {
          this.dom.fetchStatusInfo.innerHTML = `☠️ <strong>${data.name || 'Ác mộng'}</strong> • Thắng: <strong style="color: #ef4444;">${data.winRate}%</strong> • ${data.clues || clueCount} ô`;
        } else {
          this.dom.fetchStatusInfo.innerHTML = `Đề <strong>#${data.id}</strong> • Thắng: <strong>${data.winRate}%</strong>`;
        }
      }
      if (this.dom.linkSudokuWeb) {
        if (data.level === 'nightmare' || isNightmare) {
          this.dom.linkSudokuWeb.href = 'https://en.wikipedia.org/wiki/Mathematics_of_Sudoku#Minimum_number_of_givens';
          this.dom.linkSudokuWeb.textContent = 'Tài liệu ↗';
          this.dom.linkSudokuWeb.title = 'Mở tài liệu nghiên cứu Sudoku 17 ô';
        } else {
          this.dom.linkSudokuWeb.href = `https://sudoku.com/vi/${selectedLevel === 'extreme' ? 'extreme/' : selectedLevel + '/'}`;
          this.dom.linkSudokuWeb.textContent = 'Sudoku.com ↗';
          this.dom.linkSudokuWeb.title = `Mở bài Sudoku.com #${data.id} (${selectedLevel.toUpperCase()}) kèm các cờ đang giải`;
        }
      }

      // Giải câu đố & tạo chuỗi bước giải đồng bộ đáp án
      this.solveAndPrepareWalkthrough(clueCount, data.solution);

      // Chuyển sang tab Bàn cờ trên màn hình điện thoại
      this.switchMobileTab('board');
      this.playSound('complete');

      if (data.level === 'nightmare' || isNightmare) {
        this.setStatus(`☠️ ĐÃ NẠP THÀNH CÔNG ĐỀ ÁC MỘNG: ${data.name || data.id} (${data.clues || clueCount} ô) • Tỉ lệ thắng: ${data.winRate}% • ${data.description || 'Thử thách khó nhất hành tinh'}`, 'solved');
      } else {
        this.setStatus(`✓ Đã nạp thành công bài Sudoku.com #${data.id} (${selectedLevel.toUpperCase()}) • Tỉ lệ thắng: ${data.winRate}%`, 'solved');
      }

    } catch (e) {
      console.error('Lỗi khi nạp từ Sudoku.com/Nightmare:', e);
      this.setStatus('Không thể tải bài: ' + e.message, 'conflict');
    } finally {
      if (this.dom.btnFetchSudoku) {
        this.dom.btnFetchSudoku.disabled = false;
        this.dom.btnFetchSudoku.textContent = '⚡ Lấy đề mới';
      }
      if (this.dom.btnQuickFetchSudoku) {
        this.dom.btnQuickFetchSudoku.disabled = false;
        this.dom.btnQuickFetchSudoku.textContent = '⚡ Lấy đề';
      }
      if (this.dom.btnNightmareMode) {
        this.dom.btnNightmareMode.disabled = false;
        this.dom.btnNightmareMode.textContent = '☠️ Thử thách Ác mộng (< 5%)';
      }
      if (this.dom.btnHuntLowRate) {
        this.dom.btnHuntLowRate.disabled = false;
        this.dom.btnHuntLowRate.textContent = '🎯 Săn đề < 25%';
      }
    }
  }

  /**
   * Mở Sudoku.com và tự động nạp chính xác số bài (ID) cùng toàn bộ các cờ/nước đi đang giải trên bàn
   */
  async openSudokuComWeb() {
    if (!this.currentBoard || !this.initialBoard) {
      this.setStatus('Chưa có dữ liệu bàn cờ để chuyển sang Sudoku.com!', 'conflict');
      return;
    }

    const selectedLevel = (this.dom.selectSudokuLevel ? this.dom.selectSudokuLevel.value : 'extreme');
    const validLevel = ['easy', 'medium', 'hard', 'expert', 'evil', 'extreme'].includes(selectedLevel)
      ? selectedLevel
      : 'extreme';

    // 1. Xác định ID câu đố và tỉ lệ thắng
    const puzzleId = this.currentSudokuData && this.currentSudokuData.id ? this.currentSudokuData.id : 339;
    const winRate = this.currentSudokuData && this.currentSudokuData.winRate ? this.currentSudokuData.winRate : 30.51;

    // 2. Chuẩn bị chuỗi mission 81 ký tự
    let missionStr = '';
    if (this.currentSudokuData && this.currentSudokuData.mission && this.currentSudokuData.mission.length >= 81) {
      missionStr = this.currentSudokuData.mission;
    } else {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const orig = (this.isOriginalClue && this.isOriginalClue[r][c]) ? this.initialBoard[r][c] : this.initialBoard[r][c];
          missionStr += (orig || 0).toString();
        }
      }
    }

    // 3. Chuẩn bị mảng solution 81 số nguyên
    let solutionArr = [];
    if (this.currentSudokuData && this.currentSudokuData.solutionStr && this.currentSudokuData.solutionStr.length >= 81) {
      solutionArr = this.currentSudokuData.solutionStr.split('').map(x => parseInt(x, 10));
    } else if (this.officialSolution && Array.isArray(this.officialSolution)) {
      solutionArr = this.officialSolution.flat().map(x => parseInt(x, 10));
    } else {
      const solved = SudokuSolver.solve(this.initialBoard);
      if (solved && solved.grid) {
        solutionArr = solved.grid.flat().map(x => parseInt(x, 10));
      } else {
        solutionArr = new Array(81).fill(1);
      }
    }

    // 4. Gom các cờ/nước đi đang giải trên bàn cờ
    const values = [];
    let userMovesCount = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const isClue = this.isOriginalClue ? this.isOriginalClue[r][c] : (this.initialBoard[r][c] > 0);
        const curVal = this.currentBoard[r][c] || 0;
        const origVal = this.initialBoard[r][c] || 0;

        if (isClue && origVal > 0) {
          values.push({ val: origVal, editable: false });
        } else if (curVal > 0) {
          values.push({ val: curVal, editable: true });
          userMovesCount++;
        } else {
          values.push({ val: 0, editable: true });
        }
      }
    }

    // 5. Gom ghi chú ứng viên bút chì (pencil notes)
    const notes = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const list = (this.manualCandidates && this.manualCandidates[r]) ? this.manualCandidates[r][c] : [];
        notes.push(Array.isArray(list) ? [...list].sort((a, b) => a - b) : []);
      }
    }

    // 6. Cấu trúc đối tượng mainGame chuẩn của engine Sudoku.com
    const mainGame = {
      id: puzzleId,
      mode: 'classic',
      difficulty: validLevel,
      loaded: true,
      mission: missionStr,
      solution: solutionArr,
      values: values,
      winRate: winRate,
      showWinRate: true,
      timer: 0,
      notes: notes,
      cages: null,
      score: 100,
      scoreHistory: [],
      baseScore: { val: 1000, lastGameTimer: 0 },
      countSmartHints: 0,
      placement: 'game_start',
      emojisShown: [],
      bestMove: null,
      mistakes: this.mistakesCount || 0,
      hints: 3,
      finished: false
    };

    // Hiển thị trạng thái đang xử lý trên nút và thanh trạng thái
    const origText = this.dom.linkSudokuWeb.textContent;
    this.dom.linkSudokuWeb.textContent = '⏳ Đang nạp...';
    this.setStatus(`⏳ Đang chuyển sang bài Sudoku.com #${puzzleId} (${validLevel.toUpperCase()}) kèm ${userMovesCount} cờ đang giải...`, 'info');

    try {
      const response = await fetch('/api/open-sudoku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: validLevel, mainGame })
      });

      const resJson = await response.json();
      if (resJson.success) {
        this.setStatus(`✓ Đã nạp thành công bài Sudoku.com #${puzzleId} (${validLevel.toUpperCase()}) • Tỉ lệ thắng: ${winRate}% • Kèm ${userMovesCount} cờ đang giải!`, 'solved');
        this.playSound('complete');

        if (resJson.method === 'fallback_url' && resJson.url) {
          window.open(resJson.url, '_blank');
        }
      } else {
        throw new Error(resJson.error || 'Lỗi nạp Sudoku.com');
      }
    } catch (err) {
      console.warn('Không thể gọi /api/open-sudoku (đang chạy trên điện thoại hoặc web tĩnh):', err.message);

      // Tự động sao chép mã Bookmarklet nạp đề vào Clipboard nếu người dùng muốn nạp vào Chrome di động
      try {
        const syncCode = `javascript:(function(){localStorage.setItem('main_game',${JSON.stringify(JSON.stringify(mainGame))});localStorage.setItem('difficulty',${JSON.stringify(JSON.stringify(validLevel))});location.reload();})();`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(syncCode).catch(() => {});
        }
      } catch (e) {}

      this.setStatus(`📱 Đang mở Sudoku.com! (Mẹo: Bạn có thể giải trực tiếp đề #${puzzleId} ngay trên Sudo9ku kèm Sổ tay công thức & timeline)`, 'valid');
      window.open(`https://sudoku.com/vi/${validLevel}/`, '_blank');
    } finally {
      this.dom.linkSudokuWeb.textContent = origText;
    }
  }

  /**
   * Cập nhật toàn bộ các thẻ trong Sổ tay công thức để áp dụng trực tiếp số liệu của bài đang giải
   * Đồng bộ 100% với các nước cờ người chơi đã đi trước trên bàn cờ và Tiến trình bước giải (timeline slider)
   */
  renderFormulaModalApplications() {
    const cardsConfig = [
      { id: 'guide-naked-single', key: 'naked-single', defaultRule: 'C(r, c) = {X} ⇒ Điền số X vào ô (r, c)' },
      { id: 'guide-hidden-single', key: 'hidden-single', defaultRule: '∃! ô trong Đơn vị U có thể nhận X ⇒ Điền số X vào ô đó' },
      { id: 'guide-naked-pair', key: 'naked-pair', defaultRule: 'C(A) = C(B) = {X, Y} trong U ⇒ Xóa X, Y khỏi các ô khác trong U' },
      { id: 'guide-hidden-pair', key: 'hidden-pair', defaultRule: 'X và Y chỉ có thể xuất hiện tại 2 ô A và B trong U ⇒ Xóa các ứng viên khác khỏi A và B' },
      { id: 'guide-pointing', key: 'pointing', defaultRule: 'X trong Khối B chỉ nằm trên Hàng R ⇒ Xóa X khỏi phần còn lại của Hàng R' },
      { id: 'guide-box-line-reduction', key: 'box-line', defaultRule: 'X trong Hàng R chỉ nằm trong Khối B ⇒ Xóa X khỏi các hàng khác của Khối B' },
      { id: 'guide-x-wing', key: 'x-wing', defaultRule: 'X nằm ở đúng 2 cột C1, C2 trên cả 2 hàng R1, R2 ⇒ Xóa X khỏi C1, C2 ở các hàng khác' },
      { id: 'guide-xy-wing', key: 'xy-wing', defaultRule: 'Trục (X, Y) nhìn thấy 2 cánh (X, Z) và (Y, Z) ⇒ Mọi ô nhìn thấy cả 2 cánh đều không thể chứa Z' },
      { id: 'guide-branching', key: 'branching', defaultRule: 'Giả thiết ô (r, c) = v_sai ⇒ Kéo theo mâu thuẫn bế tắc logic ⇒ Bác bỏ v_sai, khẳng định v_đúng (Q.E.D)' }
    ];

    if (!this.solution) {
      const solRes = SudokuSolver.solve(this.initialBoard);
      if (solRes.solved) {
        this.solution = solRes.solution;
      }
    }

    // ĐỒNG BỘ 100% VỚI TIẾN TRÌNH BƯỚC GIẢI VÀ NƯỚC ĐI CỦA BẠN
    this.syncSolvingWalkthroughWithCurrentBoard();

    const userMovesCount = this.userMovesHistory ? this.userMovesHistory.length : 0;
    const allSteps = this.solveSteps || [];

    // Xác định xem bước đang xem trước (Preview) có đang kích hoạt không
    const activePreview = (this.isPreviewMode && this.previewStep) ? this.previewStep : null;

    cardsConfig.forEach(cfg => {
      const card = document.getElementById(cfg.id);
      if (!card) return;

      const ruleBox = card.querySelector('.formula-rule-box');

      let appliedBox = card.querySelector('.formula-applied-box');
      if (!appliedBox) {
        appliedBox = document.createElement('div');
        appliedBox.className = 'formula-applied-box';
        card.appendChild(appliedBox);
      }

      if (!this.solution || allSteps.length <= 1) {
        if (ruleBox) {
          ruleBox.innerHTML = `📐 Công thức: ${cfg.defaultRule}`;
        }
        appliedBox.className = 'formula-applied-box empty-applied';
        appliedBox.innerHTML = `
          <div class="applied-header">
            <span class="applied-tag muted">🎯 Áp dụng vào nước cờ hiện tại</span>
          </div>
          <p class="applied-note">
            💡 Tải ảnh hoặc bấm <strong>"Sudoku.com"</strong> để xem công thức này áp dụng trực tiếp lên từng con số của bàn cờ thực tế.
          </p>
        `;
        return;
      }

      // Lọc các bước trong TIẾN TRÌNH BƯỚC GIẢI dùng công thức này
      const matchingPlayedSteps = allSteps.filter(s =>
        s.stepIndex > 0 && s.stepIndex <= userMovesCount && s.formulaId && s.formulaId.startsWith(cfg.key)
      );
      const matchingUpcomingSteps = (!this.allowForwardSteps)
        ? []
        : allSteps.filter(s =>
            s.stepIndex > userMovesCount && s.formulaId && s.formulaId.startsWith(cfg.key)
          );

      const isPreviewMatching = this.allowForwardSteps && activePreview && activePreview.formulaId && activePreview.formulaId.startsWith(cfg.key);

      const totalMatching = matchingPlayedSteps.length + matchingUpcomingSteps.length;
      if (totalMatching === 0 && !isPreviewMatching) {
        if (ruleBox) {
          ruleBox.innerHTML = `📐 Công thức: ${cfg.defaultRule}`;
        }
        appliedBox.className = 'formula-applied-box unused-applied';
        appliedBox.innerHTML = `
          <div class="applied-header">
            <span class="applied-tag muted">🎯 Áp dụng vào ván cờ bạn đang chơi</span>
            <span class="applied-status">${!this.allowForwardSteps ? 'Chưa dùng nước nào' : 'Chưa cần dùng hoặc đã qua'}</span>
          </div>
          <p class="applied-note">
            ${!this.allowForwardSteps
              ? `Bạn chưa thực hiện nước cờ nào bằng công thức này trong ${userMovesCount} nước đã đi.<br><span style="font-size: 0.74rem; color: #fca5a5; font-style: italic;">🔒 Đã tắt xem trước các gợi ý tương lai trong Tùy chỉnh (Chỉ hiển thị các nước bạn đã đi).</span>`
              : 'Trong ván Sudoku hiện tại, các ô được giải bằng các kỹ thuật khác mà không cần đến công thức này.'}
          </p>
        `;
        return;
      }

      // Bước đại diện để hiển thị lý thuyết + ví dụ áp dụng cụ thể
      let repStep = null;
      if (isPreviewMatching) {
        repStep = activePreview;
      } else if (matchingPlayedSteps.length > 0) {
        repStep = matchingPlayedSteps[matchingPlayedSteps.length - 1];
      } else if (this.allowForwardSteps && matchingUpcomingSteps.length > 0) {
        repStep = matchingUpcomingSteps[0];
      }

      const targetR = repStep.targetCell ? repStep.targetCell.row + 1 : (repStep.row !== undefined ? repStep.row + 1 : '?');
      const targetC = repStep.targetCell ? repStep.targetCell.col + 1 : (repStep.col !== undefined ? repStep.col + 1 : '?');
      const targetV = repStep.targetCell ? repStep.targetCell.value : repStep.value;

      if (ruleBox) {
        ruleBox.innerHTML = `
          <div class="card-rule-abstract">
            <strong style="color: var(--peach);">📐 Lý thuyết:</strong> ${cfg.defaultRule}
          </div>
          <div class="card-rule-concrete" style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed rgba(65, 179, 163, 0.3); color: var(--seafoam); font-weight: 600;">
            <strong style="color: var(--coral);">🎯 Áp dụng vào bàn cờ:</strong> ${repStep.concreteFormula || repStep.formulaRule}
          </div>
        `;
      }

      appliedBox.className = 'formula-applied-box active-applied';

      // Tạo các chip bấm xem bước trên bàn cờ ĐỒNG BỘ 100% VỚI TIẾN TRÌNH
      let playedChipsHtml = '';
      if (matchingPlayedSteps.length > 0) {
        playedChipsHtml = `
          <div style="margin-top: 8px;">
            <div style="font-size: 0.76rem; font-weight: 700; color: #34d399; margin-bottom: 4px;">✓ Nước cờ bạn đã giải bằng công thức này (${matchingPlayedSteps.length} nước):</div>
            <div class="applied-steps-chips">
              ${matchingPlayedSteps.slice(0, 8).map(s => {
                const sR = s.targetCell ? s.targetCell.row + 1 : '?';
                const sC = s.targetCell ? s.targetCell.col + 1 : '?';
                const sV = s.targetCell ? s.targetCell.value : '';
                return `<button type="button" class="btn-applied-step played" data-step-index="${s.stepIndex}" title="Nhấp để xem lại Bước ${s.stepIndex} trên bàn cờ">✓ Bước ${s.stepIndex}: Ô (${sR}, ${sC}) = ${sV} (Đã đi)</button>`;
              }).join('')}
              ${matchingPlayedSteps.length > 8 ? `<span style="font-size: 0.72rem; color: var(--text-muted); align-self: center;">...và ${matchingPlayedSteps.length - 8} nước nữa</span>` : ''}
            </div>
          </div>
        `;
      }

      let upcomingChipsHtml = '';
      if (matchingUpcomingSteps.length > 0) {
        upcomingChipsHtml = `
          <div style="margin-top: 8px;">
            <div style="font-size: 0.76rem; font-weight: 700; color: #60a5fa; margin-bottom: 4px;">⚡ Nước đi gợi ý tiếp theo (${matchingUpcomingSteps.length} bước):</div>
            <div class="applied-steps-chips">
              ${matchingUpcomingSteps.slice(0, 10).map(s => {
                const sR = s.targetCell ? s.targetCell.row + 1 : '?';
                const sC = s.targetCell ? s.targetCell.col + 1 : '?';
                const sV = s.targetCell ? s.targetCell.value : '';
                const isCur = isPreviewMatching && activePreview && activePreview.targetCell && s.targetCell && activePreview.targetCell.row === s.targetCell.row && activePreview.targetCell.col === s.targetCell.col;
                return `<button type="button" class="btn-applied-step upcoming ${isCur ? 'current' : ''}" data-step-index="${s.stepIndex}" title="Nhấp để chuyển thanh tiến trình tới Bước ${s.stepIndex}">${isCur ? '⚡ Đang xem: ' : '▶ '}Bước ${s.stepIndex}: Ô (${sR}, ${sC}) = ${sV} (Gợi ý)</button>`;
              }).join('')}
              ${matchingUpcomingSteps.length > 10 ? `<span style="font-size: 0.72rem; color: var(--text-muted); align-self: center;">...và ${matchingUpcomingSteps.length - 10} bước nữa</span>` : ''}
            </div>
          </div>
        `;
      }

      let countBadge = '';
      if (!this.allowForwardSteps) {
        countBadge = `<span>Đã đi: <strong>${matchingPlayedSteps.length}</strong> nước (Ẩn gợi ý tương lai)</span>`;
      } else if (matchingPlayedSteps.length > 0 && matchingUpcomingSteps.length > 0) {
        countBadge = `<span>Đã đi: <strong>${matchingPlayedSteps.length}</strong> • Gợi ý tiếp: <strong>${matchingUpcomingSteps.length}</strong></span>`;
      } else if (matchingPlayedSteps.length > 0) {
        countBadge = `<span>Đã giải <strong>${matchingPlayedSteps.length}</strong> nước bằng công thức này</span>`;
      } else {
        countBadge = `<span>Còn <strong>${matchingUpcomingSteps.length}</strong> bước gợi ý</span>`;
      }

      let forwardSecurityNotice = '';
      if (!this.allowForwardSteps) {
        forwardSecurityNotice = `
          <div style="margin-top: 8px; padding: 6px 10px; background: rgba(0,0,0,0.25); border-radius: 6px; font-size: 0.74rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
            <span>🔒</span> <span>Đã tắt xem trước các gợi ý tương lai trong Tùy chỉnh (Chỉ hiển thị các nước bạn đã đi).</span>
          </div>
        `;
      }

      appliedBox.innerHTML = `
        <div class="applied-header">
          <span class="applied-tag">🎯 ĐỒNG BỘ VỚI BÀN CỜ &amp; TIẾN TRÌNH BƯỚC GIẢI</span>
          <span class="applied-count">${countBadge}</span>
        </div>

        <div class="applied-active-callout">
          <div class="callout-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="${isPreviewMatching ? 'live-dot-pulse' : 'static-dot'}" style="color: ${isPreviewMatching ? '#10b981' : 'var(--accent-cyan)'}; font-size: 1.1rem;">●</span>
              <strong>${repStep.isUserMove ? `Bước ${repStep.stepIndex} (Bạn đã đi)` : (isPreviewMatching ? 'Bước đang xem trước' : `Gợi ý Bước ${repStep.stepIndex}`)}: ${repStep.strategyName || repStep.formulaName}</strong>
            </div>
            <span class="step-target-badge" style="background: rgba(226, 125, 96, 0.2); color: var(--coral); padding: 2px 8px; border-radius: 12px; font-size: 0.76rem; font-weight: 700;">Ô (Hàng ${targetR}, Cột ${targetC}) ${targetV ? `➜ Số ${targetV}` : ''}</span>
          </div>
          <div class="applied-concrete-formula">
            <code>${repStep.concreteFormula || repStep.formulaRule}</code>
          </div>
          <div class="applied-desc" style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.5; margin-top: 4px;">
            ${repStep.explanation ? repStep.explanation.split('\n')[0] : ''}
          </div>
        </div>

        <div class="applied-step-list-wrapper" style="margin-top: 8px;">
          ${playedChipsHtml}
          ${upcomingChipsHtml}
          ${forwardSecurityNotice}
        </div>
      `;

      appliedBox.querySelectorAll('.btn-applied-step').forEach(btn => {
        btn.addEventListener('click', () => {
          const sIdx = parseInt(btn.dataset.stepIndex, 10);
          if (!isNaN(sIdx)) {
            this.closeFormulaModal();
            this.goToStep(sIdx);
          }
        });
      });
    });
  }

  /**
   * Mở modal Sổ tay công thức Sudoku và cuộn tới công thức mục tiêu
   */
  openFormulaModal(targetFormulaId = null) {
    if (!this.dom.formulaModal) return;
    const formulaId = targetFormulaId || (this.previewStep ? this.previewStep.formulaId : this.currentFormulaId);
    this.renderFormulaModalApplications();
    if (this.diagramViewer) {
      this.diagramViewer.injectThumbnailsIntoHandbook();
    }
    const secBanner = document.getElementById('formula-modal-security-banner');
    if (secBanner) {
      secBanner.style.display = (!this.allowForwardSteps) ? 'flex' : 'none';
    }
    this.dom.formulaModal.classList.add('active', 'show');

    if (formulaId) {
      let cardId = 'guide-' + formulaId;
      if (formulaId.startsWith('hidden-single')) cardId = 'guide-hidden-single';
      if (formulaId.startsWith('naked-single')) cardId = 'guide-naked-single';
      if (formulaId.startsWith('naked-pair')) cardId = 'guide-naked-pair';
      if (formulaId.startsWith('hidden-pair')) cardId = 'guide-hidden-pair';
      if (formulaId.startsWith('pointing')) cardId = 'guide-pointing';
      if (formulaId.startsWith('box-line')) cardId = 'guide-box-line-reduction';
      if (formulaId.startsWith('x-wing')) cardId = 'guide-x-wing';
      if (formulaId.startsWith('xy-wing')) cardId = 'guide-xy-wing';
      if (formulaId === 'branching' || formulaId.startsWith('branching')) cardId = 'guide-branching';

      setTimeout(() => {
        const targetCard = document.getElementById(cardId);
        if (targetCard) {
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetCard.classList.add('highlight-target');
          setTimeout(() => targetCard.classList.remove('highlight-target'), 2500);
        }
      }, 150);
    }
  }

  closeFormulaModal() {
    if (!this.dom.formulaModal) return;
    this.dom.formulaModal.classList.remove('active', 'show');
  }

  openUserGuideModal(defaultTab = 'zen-default') {
    if (!this.dom.modalUserGuide) return;
    this.switchUserGuideTab(defaultTab);
    this.dom.modalUserGuide.classList.add('active', 'show');
  }

  closeUserGuideModal() {
    if (!this.dom.modalUserGuide) return;
    this.dom.modalUserGuide.classList.remove('active', 'show');
  }

  switchUserGuideTab(tabName) {
    const tabs = document.querySelectorAll('.guide-tab-btn');
    const panes = document.querySelectorAll('.guide-tab-pane');
    tabs.forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    panes.forEach(pane => {
      if (pane.id === `guide-pane-${tabName}`) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });
  }

  /**
   * Hiển thị minh họa trực quan một công thức giải lên bàn cờ từ Sổ tay công thức
   * Đồng bộ 100% với Tiến trình bước giải của ván cờ
   */
  showFormulaStepDemonstration(stepOrIdx) {
    let step = null;
    let stepIdx = 0;
    if (typeof stepOrIdx === 'object' && stepOrIdx !== null) {
      step = stepOrIdx;
      stepIdx = step.stepIndex !== undefined ? step.stepIndex : 0;
    } else if (typeof stepOrIdx === 'number') {
      stepIdx = stepOrIdx;
      step = this.solveSteps && this.solveSteps[stepIdx];
    }
    if (!step) return;

    if (this.isPreviewMode) {
      this.closePreview(false);
    }
    this.closeFormulaModal();

    // Đồng bộ trực tiếp với Tiến trình bước giải của ván cờ
    this.goToStep(stepIdx);
  }

  /**
   * Thoát chế độ minh họa công thức, lập tức khôi phục bàn cờ người dùng đang chơi và xóa sạch highlight
   */
  exitFormulaInspection(shouldRender = true) {
    if (this.formulaInspectionTimeout) {
      clearTimeout(this.formulaInspectionTimeout);
      this.formulaInspectionTimeout = null;
    }

    if (!this.isFormulaInspectionMode) return;

    // Khôi phục bàn cờ và bút chì của người chơi
    if (this.playingBoardBackup) {
      this.currentBoard = SudokuSolver.cloneBoard(this.playingBoardBackup);
      this.playingBoardBackup = null;
    }
    if (this.manualCandidatesBackup) {
      this.manualCandidates = JSON.parse(JSON.stringify(this.manualCandidatesBackup));
      this.manualCandidatesBackup = null;
    }

    this.isFormulaInspectionMode = false;
    this.formulaInspectionStep = null;
    const userMovesCount = this.userMovesHistory ? this.userMovesHistory.length : 0;
    this.currentStepIndex = userMovesCount;

    // Khôi phục preview banner
    if (this.dom.previewBanner) {
      this.dom.previewBanner.style.display = 'none';
    }
    if (this.dom.btnApplyPreview) this.dom.btnApplyPreview.style.display = '';
    if (this.dom.btnApplyAllPreview) this.dom.btnApplyAllPreview.style.display = '';
    if (this.dom.btnNextPreview) this.dom.btnNextPreview.style.display = '';
    if (this.dom.btnPreviewFormula) this.dom.btnPreviewFormula.style.display = '';

    if (shouldRender) {
      this.renderBoard();
    }
  }

  /**
   * Giải thuật toán tức thời và tạo chuỗi bước giải chi tiết
   */
  solveAndPrepareWalkthrough(clueCount = null, officialSolution = null) {
    let clues = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.initialBoard[r][c] !== 0) clues++;
      }
    }

    if (clues === 0) {
      this.solution = null;
      this.solveSteps = [];
      this.currentStepIndex = 0;
      this.dom.stepSlider.max = 0;
      this.dom.stepSlider.value = 0;
      this.dom.stepCounter.textContent = 'Bước 0 / 0';
      this.dom.strategyNameText.textContent = 'Trống';
      this.dom.stepDetailsTitle.textContent = 'Bàn cờ đang trống';
      this.dom.stepExplanationText.textContent = 'Hãy tải ảnh lên hoặc nhấp vào ô bất kỳ để nhập đề bài mới.';
      this.dom.stepMetaChips.innerHTML = '';
      this.setStatus('Sẵn sàng nhận diện hoặc nhập đề bài', '');
      this.updatePlayerControls();
      this.renderBoard();
      return;
    }

    const validation = SudokuSolver.validateBoard(this.initialBoard);
    if (!validation.isValid) {
      this.setStatus('Đề bài có số trùng lặp/xung đột trên cùng hàng, cột hoặc khối 3x3!', 'conflict');
      this.solution = null;
      this.solveSteps = [];
      this.updatePlayerControls();
      this.renderBoard();
      return;
    }

    // Đề bài Sudoku chuẩn cần tối thiểu 17 số để có nghiệm duy nhất
    if (clues < 17) {
      this.solution = null;
      this.solveSteps = [];
      this.updatePlayerControls();
      this.setStatus(`Đang nhập đề bài (${clues}/17 số tối thiểu)... Hãy nhập thêm các số từ Sudoku.com để giải nghiệm duy nhất.`, '');
      this.renderBoard();
      return;
    }

    // 1. Lời giải tức thời ("Cho biết trước đáp án")
    let solveRes = null;
    if (officialSolution) {
      solveRes = { solved: true, solution: officialSolution };
    } else {
      solveRes = SudokuSolver.solve(this.initialBoard);
    }

    if (!solveRes.solved) {
      this.setStatus('Không tìm thấy lời giải hợp lệ cho đề bài này (Vui lòng kiểm tra lại các số đã nhập)!', 'conflict');
      this.solution = null;
      this.solveSteps = [];
      this.updatePlayerControls();
      this.renderBoard();
      return;
    }

    // 2. Kiểm tra số lượng nghiệm
    const solCount = SudokuSolver.countSolutions(this.initialBoard, 2);
    this.solution = solveRes.solution;

    // Reset lịch sử nước đi người chơi khi nạp đề bài mới
    this.userMovesHistory = [];

    // Tự động đồng bộ toàn diện Tiến trình bước giải với đề bài ban đầu
    this.syncSolvingWalkthroughWithCurrentBoard();

    const cluesText = clueCount !== null ? ` (Nhận diện ${clueCount} ô)` : ` (${clues} ô)`;
    this.setStatus(`✓ Đã giải thành công${cluesText}! Tổng cộng ${this.solveSteps.length - 1} bước logic`, 'solved');

    this.goToStep(0);
    this.startNewGameRecord();
  }

  /**
   * Chuyển tới một bước giải cụ thể (0 đến N)
   */
  goToStep(index) {
    if (index < 0 || index >= this.solveSteps.length) return;
    const userMovesCount = this.userMovesHistory ? this.userMovesHistory.length : 0;
    const maxAllowed = (!this.allowForwardSteps) ? userMovesCount : (this.solveSteps.length - 1);
    if (!this.allowForwardSteps && index > maxAllowed) {
      index = maxAllowed;
    }
    if (this.isFormulaInspectionMode) {
      this.exitFormulaInspection(false);
    }
    if (this.isPreviewMode) {
      this.closePreview(false);
    }
    this.currentStepIndex = index;
    const step = this.solveSteps[index];

    // Cập nhật trạng thái bàn cờ theo bước
    this.currentBoard = SudokuSolver.cloneBoard(step.boardState);

    // Đồng bộ ô đang chọn theo ô mục tiêu của bước giải (nếu có)
    if (step.targetCell) {
      this.selectedCell = { row: step.targetCell.row, col: step.targetCell.col };
    } else {
      this.selectedCell = null;
    }

    // Cập nhật giao diện bước
    this.dom.stepSlider.value = index;

    let statusSuffix = '';
    if (index === userMovesCount && userMovesCount > 0) {
      statusSuffix = ` (Đã đi ${userMovesCount} nước)`;
    } else if (index < userMovesCount) {
      statusSuffix = ` (Lịch sử bước ${index})`;
    } else if (index > userMovesCount) {
      statusSuffix = ` (Gợi ý bước ${index})`;
    }

    if (!this.allowForwardSteps) {
      this.dom.stepCounter.textContent = `Bước ${index} / ${userMovesCount}${statusSuffix}`;
    } else {
      this.dom.stepCounter.textContent = `Bước ${index} / ${this.solveSteps.length - 1}${statusSuffix}`;
    }

    // Cập nhật thẻ giải thích
    this.updateExplanationCard(step);

    // Cập nhật nút điều khiển
    this.updatePlayerControls();

    // Render lại bàn cờ kèm đánh dấu highlight
    this.renderBoard(step);

    if (index > 0) {
      if (index === this.solveSteps.length - 1) {
        this.playSound('complete');
      } else {
        this.playSound('step');
      }
    }
  }

  /**
   * Tạo bản sao bảng hiện tại để giải toán, lọc bỏ các số sai sót của người chơi (nếu có)
   * để bộ giải logic HumanSolver luôn có trạng thái hợp lệ và đồng bộ chuẩn xác với ván đấu
   */
  getCleanBoard() {
    const cleanBoard = SudokuSolver.cloneBoard(this.currentBoard);
    if (this.solution) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (cleanBoard[r][c] !== 0 && cleanBoard[r][c] !== this.solution[r][c]) {
            cleanBoard[r][c] = 0;
          }
        }
      }
    }
    return cleanBoard;
  }

  /**
   * Tự động nhận diện công thức và chiến thuật Sudoku cho nước đi của người chơi
   * từ trạng thái bàn cờ ngay trước khi đi (boardBefore)
   */
  detectUserMoveMetadata(boardBefore, row, col, val) {
    if (!this.solution) return null;

    // 1. Kiểm tra trong danh sách các nước đi khả thi tức thời từ DỄ ĐẾN KHÓ
    try {
      const candidates = SudokuSolver.getAllCandidates(boardBefore);
      const immediateMoves = HumanSolver.findAllImmediateMoves(boardBefore, candidates, this.solution);
      const foundImmediate = (immediateMoves || []).find(m =>
        m.targetCell && m.targetCell.row === row && m.targetCell.col === col && m.targetCell.value === val
      );
      if (foundImmediate) {
        return {
          ...foundImmediate,
          isUserMove: true,
          title: `Số ${val} tại (Hàng ${row + 1}, Cột ${col + 1})`,
          explanation: `Bạn đã điền số ${val} vào ô (Hàng ${row + 1}, Cột ${col + 1}) theo chiến thuật: ${foundImmediate.strategyName || foundImmediate.formulaName}. ${foundImmediate.explanation || ''}`
        };
      }

      // 2. Nếu không có trong immediate moves, tìm trong chuỗi giải logic từ boardBefore
      const solveRes = HumanSolver.generateSolveSteps(boardBefore, this.solution);
      if (solveRes && solveRes.steps) {
        const foundStep = solveRes.steps.find(s =>
          s.stepIndex > 0 && s.targetCell && s.targetCell.row === row && s.targetCell.col === col && s.targetCell.value === val
        );
        if (foundStep) {
          return {
            ...foundStep,
            isUserMove: true,
            title: `Số ${val} tại (Hàng ${row + 1}, Cột ${col + 1})`,
            explanation: `Bạn đã điền số ${val} vào ô (Hàng ${row + 1}, Cột ${col + 1}) theo chiến thuật: ${foundStep.strategyName || foundStep.formulaName}. ${foundStep.explanation || ''}`
          };
        }
      }
    } catch (err) {
      console.warn('detectUserMoveMetadata warning:', err);
    }

    // 3. Fallback mặc định cho nước đi hợp lệ của người chơi
    return {
      type: 'place',
      targetCell: { row, col, value: val },
      title: `Số ${val} tại (Hàng ${row + 1}, Cột ${col + 1})`,
      strategyName: 'Nước đi người chơi',
      formulaName: 'Điền số chính xác',
      formulaId: 'user_placement',
      formulaRule: 'Nước đi chính xác theo quy luật Sudoku',
      concreteFormula: `Điền số ${val} vào ô (Hàng ${row + 1}, Cột ${col + 1})`,
      patternExplanation: 'Quan sát các ô cùng hàng, cột và khối 3x3',
      actionExplanation: `Điền số ${val} vào ô`,
      explanation: `Bạn đã điền số ${val} vào ô (Hàng ${row + 1}, Cột ${col + 1}) chính xác theo nghiệm chuẩn.`,
      difficultyRank: 1.0,
      difficultyLevel: 'very-easy',
      difficultyBadge: '⭐ Nước đi của bạn',
      highlightCells: [{ row, col, type: 'target' }],
      isUserMove: true
    };
  }

  /**
   * Ghi nhận một nước đi hợp lệ của người chơi vào lịch sử để đồng bộ Tiến trình bước giải
   */
  recordUserMove(row, col, val, knownStep = null) {
    if (!this.userMovesHistory) {
      this.userMovesHistory = [];
    }

    const existingIdx = this.userMovesHistory.findIndex(m => m.row === row && m.col === col);

    // Tính toán boardBefore từ initialBoard + các nước đi trước
    const boardBefore = SudokuSolver.cloneBoard(this.initialBoard);
    for (let i = 0; i < this.userMovesHistory.length; i++) {
      if (i !== existingIdx) {
        const m = this.userMovesHistory[i];
        boardBefore[m.row][m.col] = m.value;
      }
    }

    let stepData = null;
    if (knownStep && knownStep.targetCell && knownStep.targetCell.row === row && knownStep.targetCell.col === col) {
      stepData = {
        ...knownStep,
        isUserMove: true,
        title: `Số ${val} tại (Hàng ${row + 1}, Cột ${col + 1})`,
        explanation: `Bạn đã điền số ${val} vào ô (Hàng ${row + 1}, Cột ${col + 1}). ${knownStep.explanation || ''}`
      };
    } else {
      stepData = this.detectUserMoveMetadata(boardBefore, row, col, val);
    }

    const moveObj = {
      row,
      col,
      value: val,
      stepData
    };

    if (existingIdx >= 0) {
      this.userMovesHistory[existingIdx] = moveObj;
    } else {
      this.userMovesHistory.push(moveObj);
    }
  }

  /**
   * Xóa nước đi khỏi lịch sử khi người chơi xóa ô
   */
  removeUserMove(row, col) {
    if (!this.userMovesHistory) return;
    this.userMovesHistory = this.userMovesHistory.filter(m => !(m.row === row && m.col === col));
  }

  /**
   * Đồng bộ toàn diện "Tiến trình bước giải" (timeline slider, counter, buttons, explanation card, inspector)
   * với tất cả các nước cờ người chơi đã đánh trên bàn cờ.
   */
  syncSolvingWalkthroughWithCurrentBoard() {
    if (!this.solution) {
      if (this.initialBoard) {
        const solRes = SudokuSolver.solve(this.initialBoard);
        if (solRes.solved) {
          this.solution = solRes.solution;
        } else {
          return;
        }
      } else {
        return;
      }
    }

    const cleanBoard = this.getCleanBoard();

    if (!this.userMovesHistory) {
      this.userMovesHistory = [];
    }

    // 1. Loại bỏ các nước đi mà trên cleanBoard không còn
    this.userMovesHistory = this.userMovesHistory.filter(m =>
      cleanBoard[m.row][m.col] === m.value && this.initialBoard[m.row][m.col] === 0
    );

    // 2. Bổ sung các ô người chơi đã đi trên cleanBoard mà chưa có trong userMovesHistory
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.initialBoard[r][c] === 0 && cleanBoard[r][c] !== 0) {
          const val = cleanBoard[r][c];
          if (!this.userMovesHistory.some(m => m.row === r && m.col === c)) {
            const boardBefore = SudokuSolver.cloneBoard(this.initialBoard);
            for (const um of this.userMovesHistory) {
              boardBefore[um.row][um.col] = um.value;
            }
            const meta = this.detectUserMoveMetadata(boardBefore, r, c, val);
            this.userMovesHistory.push({
              row: r,
              col: c,
              value: val,
              stepData: meta
            });
          }
        }
      }
    }

    const K = this.userMovesHistory.length;

    // 3. Bước 0: Đề bài ban đầu
    const initialClues = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.initialBoard[r][c] !== 0) {
          initialClues.push({ row: r, col: c, value: this.initialBoard[r][c] });
        }
      }
    }
    const step0 = {
      stepIndex: 0,
      type: 'initial',
      title: 'Đề bài ban đầu',
      strategyName: 'Khởi tạo',
      formulaId: 'initial',
      formulaName: 'Khởi tạo đề bài',
      formulaRule: 'Đề bài gốc cung cấp các ô cố định ban đầu.',
      abstractFormula: 'Khởi tạo ma trận 9x9 từ các số cho sẵn của đề bài',
      concreteFormula: 'Xác định các ô đã có số và tính toán tập ứng viên hợp lệ cho toàn bộ ô trống',
      patternExplanation: 'Quan sát các ô đã cho sẵn số trên bảng.',
      actionExplanation: 'Bắt đầu tính toán tập ứng viên cho 81 ô.',
      explanation: `Bàn cờ ban đầu với ${initialClues.length} số cho sẵn. Hãy tìm các nước đi logic từ dễ đến khó.`,
      boardState: SudokuSolver.cloneBoard(this.initialBoard),
      targetCell: null,
      relatedUnit: null,
      difficultyRank: 0,
      difficultyLevel: 'very-easy',
      difficultyBadge: '🎯 Đề bài',
      highlightCells: initialClues.map(c => ({ row: c.row, col: c.col, type: 'given' }))
    };

    // 4. Các bước 1..K do người chơi đã đi
    const userSteps = [];
    const runningBoard = SudokuSolver.cloneBoard(this.initialBoard);
    for (let i = 0; i < K; i++) {
      const m = this.userMovesHistory[i];
      runningBoard[m.row][m.col] = m.value;
      const stepIdx = i + 1;
      const sData = m.stepData || {};
      const userStep = {
        ...sData,
        stepIndex: stepIdx,
        type: 'place',
        title: sData.title || `Số ${m.value} tại (Hàng ${m.row + 1}, Cột ${m.col + 1})`,
        strategyName: sData.strategyName || 'Nước đi người chơi',
        formulaName: sData.formulaName || 'Nước đi của bạn',
        difficultyBadge: sData.difficultyBadge || '⭐ Bạn đã đi',
        difficultyLevel: sData.difficultyLevel || 'very-easy',
        difficultyRank: sData.difficultyRank || 1.0,
        concreteFormula: sData.concreteFormula || `Đã điền số ${m.value} vào ô (${m.row + 1}, ${m.col + 1})`,
        formulaRule: sData.formulaRule || 'Nước đi hợp lệ của người chơi',
        explanation: sData.explanation || `Bạn đã điền số ${m.value} vào ô (Hàng ${m.row + 1}, Cột ${m.col + 1}) chính xác.`,
        actionExplanation: sData.actionExplanation || `Điền số ${m.value} vào ô`,
        targetCell: { row: m.row, col: m.col, value: m.value },
        boardState: SudokuSolver.cloneBoard(runningBoard),
        highlightCells: sData.highlightCells || [{ row: m.row, col: m.col, type: 'target' }],
        isUserMove: true
      };
      userSteps.push(userStep);
    }

    // 5. Các bước K+1..N: Giải tiếp từ cleanBoard từ DỄ ĐẾN KHÓ
    const remainingSteps = [];
    let isComplete = true;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (cleanBoard[r][c] === 0) {
          isComplete = false;
          break;
        }
      }
      if (!isComplete) break;
    }

    if (isComplete) {
      const finalStep = {
        stepIndex: K + 1,
        type: 'solved',
        title: 'Hoàn thành câu đố!',
        strategyName: 'Hoàn thành',
        formulaId: 'complete',
        formulaName: 'Toàn thắng',
        formulaRule: 'Tất cả 81 ô đều đã được điền chính xác theo luật Sudoku',
        abstractFormula: '81 / 81 ô hoàn tất',
        concreteFormula: 'Toàn bộ bàn cờ đã được giải chính xác 100%',
        patternExplanation: 'Không còn ô trống nào trên bàn cờ.',
        actionExplanation: 'Hoàn thành toàn bộ ván chơi!',
        explanation: '🎉 Chúc mừng! Toàn bộ 81 ô trên bàn cờ đã được hoàn thành chính xác 100%!',
        targetCell: null,
        relatedUnit: null,
        boardState: SudokuSolver.cloneBoard(cleanBoard),
        difficultyRank: 0,
        difficultyLevel: 'very-easy',
        difficultyBadge: '🏆 Toàn thắng',
        highlightCells: []
      };
      remainingSteps.push(finalStep);
    } else {
      const solveRes = HumanSolver.generateSolveSteps(cleanBoard, this.solution);
      if (solveRes && solveRes.steps && solveRes.steps.length > 1) {
        for (let j = 1; j < solveRes.steps.length; j++) {
          const origStep = solveRes.steps[j];
          const reindexedStep = {
            ...origStep,
            stepIndex: K + j
          };
          remainingSteps.push(reindexedStep);
        }
      }
    }

    this.solveSteps = [step0, ...userSteps, ...remainingSteps];

    // 6. Cập nhật bản đồ ô -> bước giải (cellStepMap)
    this.cellStepMap = Array.from({ length: 9 }, () => Array(9).fill(null));
    this.solveSteps.forEach((step, idx) => {
      if (step.type === 'place' && step.targetCell) {
        this.cellStepMap[step.targetCell.row][step.targetCell.col] = idx;
      }
    });

    // 7. Đặt vị trí timeline tại bước hiện tại của người chơi (K)
    this.currentStepIndex = K;
    const totalSteps = this.solveSteps.length - 1;
    const maxAllowed = (!this.allowForwardSteps) ? K : totalSteps;
    this.dom.stepSlider.max = maxAllowed;
    this.dom.stepSlider.value = K;

    const statusSuffix = K > 0 ? ` (Đã đi ${K} nước)` : '';
    if (!this.allowForwardSteps) {
      this.dom.stepCounter.textContent = `Bước ${K} / ${K}${statusSuffix}`;
    } else {
      this.dom.stepCounter.textContent = `Bước ${K} / ${totalSteps}${statusSuffix}`;
    }

    // Cập nhật thẻ giải thích
    if (K > 0 && K < this.solveSteps.length) {
      this.updateExplanationCard(this.solveSteps[K]);
    } else if (this.solveSteps.length > 0) {
      this.updateExplanationCard(this.solveSteps[0]);
    }

    // Cập nhật các nút điều khiển
    this.updatePlayerControls();

    // Cập nhật inspector nếu đang chọn ô
    if (this.selectedCell) {
      this.updateInspector();
    }
  }

  /**
   * Tính toán danh sách các nước đi khả thi tiếp theo trên bàn cờ hiện tại,
   * đồng bộ hoàn toàn với các nước đi người chơi đã đi trước đó,
   * và sắp xếp nghiêm ngặt theo độ khó từ DỄ ĐẾN KHÓ:
   * 1. Ô duy nhất còn lại (Full House - Rank 1.0)
   * 2. Tia gióng Khối 3x3 (Cross-Hatching - Rank 1.3 - 1.6)
   * 3. Đơn lẻ trần (Naked Single - Rank 2.0)
   * 4. Đơn lẻ ẩn theo Hàng hoặc Cột (Hidden Single - Rank 2.8 - 3.0)
   * 5. Cặp đôi trần / Cặp đôi ẩn (Naked/Hidden Pair - Rank 3.5 - 3.8)
   * 6. Khóa ứng viên Pointing (Rank 4.0)
   * 7. Giảm trừ Hàng-Khối Box-Line (Rank 4.2)
   * 8. Kỹ thuật cánh X-Wing / XY-Wing (Rank 4.5 - 4.8)
   * 9. Phản chứng Nishio Chains (Rank 5.0)
   */
  getAvailablePreviewSteps() {
    if (!this.solution) {
      const solRes = SudokuSolver.solve(this.initialBoard);
      if (solRes.solved) {
        this.solution = solRes.solution;
      } else {
        return [];
      }
    }

    const cleanBoard = this.getCleanBoard();
    const candidates = SudokuSolver.getAllCandidates(cleanBoard);

    // Tìm toàn bộ các nước đi khả thi ngay lập tức từ DỄ ĐẾN KHÓ
    let steps = HumanSolver.findAllImmediateMoves(cleanBoard, candidates, this.solution);

    // Nếu không còn nước đi đơn lẻ, chạy toàn bộ bộ giải HumanSolver từ cleanBoard
    if (!steps || steps.length === 0) {
      const solveRes = HumanSolver.generateSolveSteps(cleanBoard, this.solution);
      if (solveRes && solveRes.steps) {
        steps = solveRes.steps.filter(s => s.stepIndex > 0 && s.targetCell && cleanBoard[s.targetCell.row][s.targetCell.col] === 0);
      }
    }

    // Đảm bảo không gợi ý các ô người chơi đã điền trên bàn cờ
    steps = (steps || []).filter(s => {
      if (!s.targetCell) return false;
      return this.currentBoard[s.targetCell.row][s.targetCell.col] === 0;
    });

    // Sắp xếp nghiêm ngặt từ DỄ ĐẾN KHÓ (difficultyRank tăng dần)
    steps.sort((a, b) => (a.difficultyRank || 99) - (b.difficultyRank || 99));

    return steps;
  }

  /**
   * Tính năng Xem trước nước đi tiếp theo (Preview Next Move)
   * Tự động lọc các nước đi khả thi từ DỄ ĐẾN KHÓ và chiếu tia gióng cho số sắp điền
   */
  previewNextStep(offset = 1) {
    if (this.arenaManager && this.arenaManager.isActive) {
      this.playSound('conflict');
      this.setStatus('🔒 Tính năng xem trước gợi ý AI bị khóa trong Đấu Trường Extreme! Bạn chỉ được dùng Radar mù (tối đa 2 lần).', 'conflict');
      if (typeof this.arenaManager.showTemporaryToast === 'function') {
        this.arenaManager.showTemporaryToast('🔒 Không thể dùng gợi ý AI trong Đấu Trường Extreme!');
      }
      return;
    }

    if (!this.allowForwardSteps) {
      this.playSound('error');
      this.setStatus('🔒 Chế độ xem trước tương lai đang tắt trong Tùy chỉnh (Chỉ cho phép xem lại các nước đã đi)!', 'invalid');
      alert('🔒 Bạn đang bật chế độ bảo mật tự giải (Đã tắt xem trước bước giải tương lai trong Tùy chỉnh).\n\nHãy vào "⚙️ Tùy chỉnh" ➔ Tab "💡 Tiến trình & Hướng dẫn" nếu bạn muốn mở lại.');
      return;
    }

    if (!this.solution) {
      const res = SudokuSolver.solve(this.initialBoard);
      if (res.solved) {
        this.solution = res.solution;
      } else {
        alert('Vui lòng nạp đề bài hoặc tải ảnh trước khi xem trước nước đi!');
        return;
      }
    }

    if (this.isBoardComplete()) {
      alert('Bàn cờ đã được hoàn thành đầy đủ tất cả 81 ô!');
      return;
    }

    // Nếu chưa ở chế độ xem trước, tính toán lại toàn bộ các bước khả thi từ DỄ ĐẾN KHÓ
    if (!this.isPreviewMode || !this.availablePreviewSteps || this.availablePreviewSteps.length === 0) {
      this.availablePreviewSteps = this.getAvailablePreviewSteps();
      if (!this.availablePreviewSteps || this.availablePreviewSteps.length === 0) {
        alert('Không còn ô trống nào hợp lệ để gợi ý!');
        return;
      }
      this.previewStepIndex = 0;
    } else {
      this.previewStepIndex = (this.previewStepIndex + offset + this.availablePreviewSteps.length) % this.availablePreviewSteps.length;
    }

    this.isPreviewMode = true;
    const step = this.availablePreviewSteps[this.previewStepIndex];
    this.previewStep = step;
    if (step && step.targetCell) {
      this.selectedCell = { row: step.targetCell.row, col: step.targetCell.col };
    }

    // Hiển thị banner xem trước với huy hiệu độ khó và bộ đếm bước
    if (this.dom.previewBanner) {
      this.dom.previewBanner.style.display = 'block';
      const countText = `(${this.previewStepIndex + 1}/${this.availablePreviewSteps.length})`;
      const diffBadge = step.difficultyBadge || '⭐ Gợi ý';
      const diffLvl = step.difficultyLevel || 'very-easy';
      const stratName = step.strategyName || step.formulaName || 'Chiến thuật';
      this.dom.previewTitle.innerHTML = `💡 Gợi ý nước đi ${countText}: ${step.title} <span class="preview-diff-badge diff-${diffLvl}">${diffBadge}</span>`;
      const ruleText = step.concreteFormula || step.formulaRule || '';
      this.dom.previewExplanation.innerHTML = `<strong>Chiến thuật:</strong> <span style="color: var(--accent-amber); font-weight: 700;">${stratName}</span>${ruleText ? `<br><strong>Công thức:</strong> <code>${ruleText}</code>` : ''}<br>${step.explanation || ''}`;
    }

    // Cập nhật luôn thẻ giải thích chi tiết bên phải
    this.updateExplanationCard(step);

    this.playSound('select');
    this.renderBoard();
  }

  /**
   * Áp dụng nước đi đang xem trước vào bàn cờ chính thức
   */
  applyPreviewStep() {
    let step = this.previewStep;
    if (!step && this.previewStepIndex !== null && this.availablePreviewSteps && this.availablePreviewSteps[this.previewStepIndex]) {
      step = this.availablePreviewSteps[this.previewStepIndex];
    }
    if (!step && this.previewStepIndex !== null && this.solveSteps && this.solveSteps[this.previewStepIndex]) {
      step = this.solveSteps[this.previewStepIndex];
    }

    if (step && step.targetCell) {
      const { row, col, value } = step.targetCell;
      this.closePreview(false);
      this.selectedCell = { row, col };
      this.currentBoard[row][col] = value;
      this.manualCandidates[row][col] = [];
      if (this.autoRemoveNotes) {
        this.removeCandidateFromPeers(row, col, value);
      }
      this.availablePreviewSteps = null;
      this.recordUserMove(row, col, value, step);
      this.syncSolvingWalkthroughWithCurrentBoard();
      this.renderBoard();
      this.triggerCellFeedback(row, col, true);
      this.playSound('correct');
      this.setStatus(`✅ Đã điền số ${value} vào ô (Hàng ${row + 1}, Cột ${col + 1}) theo gợi ý!`, 'valid');

      if (this.isBoardComplete()) {
        this.setStatus('🎉 Chúc mừng! Bạn đã hoàn thành câu đố chuẩn xác 100%!', 'solved');
        this.playSound('complete');
        if (this.currentGameRecord) {
          this.currentGameRecord.status = 'completed';
          this.currentGameRecord.mistakes = this.mistakesCount;
          this.saveRecentGames();
        }
      }
    }
  }

  /**
   * Lấy nghiệm chuẩn xác duy nhất của bàn cờ (chuẩn 100% logic toán học)
   */
  getSolution() {
    if (this.solution) return this.solution;
    if (this.initialBoard) {
      const res = SudokuSolver.solve(this.initialBoard);
      if (res && res.solved && res.solution) {
        this.solution = res.solution;
        return this.solution;
      }
    }
    return null;
  }

  /**
   * Điền toàn bộ tất cả số đáp án đúng vào bàn cờ (hoàn thành 81/81 ô)
   */
  fillAllSolutionDigits() {
    if (!this.getSolution()) {
      const res = SudokuSolver.solve(this.initialBoard);
      if (res.solved) {
        this.solution = res.solution;
      } else {
        this.setStatus('Không tìm thấy lời giải hợp lệ cho đề bài này!', 'conflict');
        this.playSound('conflict');
        return;
      }
    }

    // Tắt chế độ xem trước nếu đang bật
    if (this.isPreviewMode) {
      this.closePreview(false);
    }
    this.showSolution = false;
    if (this.dom.toggleSolution) {
      this.dom.toggleSolution.checked = false;
    }

    // Gán toàn bộ số nghiệm vào currentBoard
    this.currentBoard = SudokuSolver.cloneBoard(this.solution);

    // Đồng bộ toàn bộ các ô còn lại vào userMovesHistory
    if (this.solution) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (this.initialBoard[r][c] === 0) {
            const val = this.solution[r][c];
            if (!this.userMovesHistory.some(m => m.row === r && m.col === c)) {
              this.userMovesHistory.push({
                row: r,
                col: c,
                value: val,
                stepData: {
                  type: 'place',
                  targetCell: { row: r, col: c, value: val },
                  title: `Số ${val} tại (Hàng ${r + 1}, Cột ${c + 1})`,
                  strategyName: 'Điền đáp án',
                  formulaName: 'Đáp án chính thức',
                  formulaId: 'official_solution',
                  formulaRule: 'Điền số chính xác theo đáp án chuẩn của câu đố',
                  concreteFormula: `Điền ${val} vào (${r + 1}, ${c + 1})`,
                  explanation: `Điền số ${val} vào ô (Hàng ${r + 1}, Cột ${c + 1}) theo đáp án chuẩn.`,
                  difficultyRank: 1.0,
                  difficultyLevel: 'very-easy',
                  difficultyBadge: '✨ Đáp án',
                  highlightCells: [{ row: r, col: c, type: 'target' }],
                  isUserMove: true
                }
              });
            }
          }
        }
      }
    }
    this.syncSolvingWalkthroughWithCurrentBoard();
    if (this.solveSteps.length > 0) {
      this.goToStep(this.solveSteps.length - 1);
    }

    this.selectedCell = null;
    this.playSound('complete');
    this.setStatus('🎉 Đã điền toàn bộ 81 số đáp án chính xác vào bàn cờ!', 'solved');
    this.renderBoard();
  }

  /**
   * Đóng chế độ xem trước và trả bàn cờ về trạng thái hiện tại
   */
  closePreview(shouldRender = true) {
    if (this.isFormulaInspectionMode) {
      this.exitFormulaInspection(false);
    }
    this.isPreviewMode = false;
    this.previewStepIndex = null;
    this.previewStep = null;
    this.availablePreviewSteps = null;
    if (this.dom.previewBanner) {
      this.dom.previewBanner.style.display = 'none';
    }
    if (shouldRender) {
      this.renderBoard();
    }
  }

  /**
   * Cập nhật thẻ giải thích chi tiết bằng tiếng Việt và công thức Sudoku
   */
  updateExplanationCard(step) {
    if (!step) return;

    this.dom.strategyNameText.textContent = step.formulaName || step.strategyName || 'Khởi tạo';
    this.dom.stepDetailsTitle.textContent = step.title || '';

    if (this.dom.formulaBadge) {
      const badgeText = step.difficultyBadge || (step.isUserMove ? '⭐ Bạn đã đi' : '⭐ Gợi ý');
      const diffLvl = step.difficultyLevel || 'very-easy';
      this.dom.formulaBadge.className = `formula-badge diff-${diffLvl}`;
    }

    // Hiển thị công thức logic tóm tắt
    if (this.dom.stepRuleBox) {
      if (step.concreteFormula || step.formulaRule) {
        this.dom.stepRuleBox.style.display = 'block';
        const abstractPart = step.abstractFormula
          ? `<div class="rule-row-abstract"><span class="rule-label">📐 Lý thuyết:</span> <span class="rule-math-abstract">${step.abstractFormula}</span></div>`
          : '';
        const concretePart = `<div class="rule-row-concrete"><span class="rule-label">🎯 Áp dụng:</span> <span class="rule-math-concrete">${step.concreteFormula || step.formulaRule}</span></div>`;
        this.dom.stepRuleBox.innerHTML = abstractPart + concretePart;
      } else {
        this.dom.stepRuleBox.style.display = 'none';
      }
    }

    // Hiển thị dấu hiệu nhận diện
    if (this.dom.stepPatternText) {
      this.dom.stepPatternText.textContent = step.patternExplanation || 'Quan sát trên bàn cờ';
    }

    // Hiển thị lời giải thích logic
    if (this.dom.stepExplanationText) {
      this.dom.stepExplanationText.textContent = step.explanation || '';
    }

    // Hiển thị thao tác thực hiện
    if (this.dom.sectionAction && this.dom.stepActionText) {
      if (step.actionExplanation) {
        this.dom.sectionAction.style.display = 'flex';
        this.dom.stepActionText.textContent = step.actionExplanation;
      } else {
        this.dom.sectionAction.style.display = 'none';
      }
    }

    // Ghi nhớ formulaId cho nút "Cách dùng công thức này"
    this.currentFormulaId = step.formulaId || null;

    this.dom.stepMetaChips.innerHTML = '';

    if (step.targetCell) {
      const chip = document.createElement('span');
      chip.className = 'meta-chip';
      chip.textContent = `Ô đích: Hàng ${step.targetCell.row + 1}, Cột ${step.targetCell.col + 1} ➜ Điền số ${step.targetCell.value}`;
      this.dom.stepMetaChips.appendChild(chip);
    }

    if (step.relatedUnit) {
      const chip = document.createElement('span');
      chip.className = 'meta-chip';
      const uNames = { row: 'Hàng', col: 'Cột', box: 'Khối 3x3' };
      chip.textContent = `Vùng căn cứ: ${uNames[step.relatedUnit.type] || ''} ${step.relatedUnit.index + 1}`;
      this.dom.stepMetaChips.appendChild(chip);
    }
  }

  /**
   * Bật/Tắt tự động chạy giải từng bước (Auto-play)
   */
  toggleAutoPlay() {
    if (this.isPlaying) {
      this.stopAutoPlay();
    } else {
      this.startAutoPlay();
    }
  }

  startAutoPlay() {
    const userMovesCount = this.userMovesHistory ? this.userMovesHistory.length : 0;
    const maxAllowed = (!this.allowForwardSteps) ? userMovesCount : (this.solveSteps.length - 1);
    if (this.currentStepIndex >= maxAllowed) {
      this.goToStep(0);
    }
    this.isPlaying = true;
    this.dom.btnStepPlay.textContent = '⏸';
    this.dom.btnStepPlay.title = 'Tạm dừng (Space)';

    this.playTimer = setInterval(() => {
      if (this.currentStepIndex < maxAllowed) {
        this.goToStep(this.currentStepIndex + 1);
      } else {
        this.stopAutoPlay();
      }
    }, this.playSpeed);
  }

  stopAutoPlay() {
    this.isPlaying = false;
    this.dom.btnStepPlay.textContent = '▶';
    this.dom.btnStepPlay.title = 'Tự động chạy (Space)';
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = null;
    }
  }

  updatePlayerControls() {
    const userMovesCount = this.userMovesHistory ? this.userMovesHistory.length : 0;
    const maxAllowedStep = (!this.allowForwardSteps) ? userMovesCount : (this.solveSteps.length - 1);
    const hasSteps = maxAllowedStep > 0 || (this.allowForwardSteps && this.solveSteps.length > 1);

    this.dom.btnStepStart.disabled = !hasSteps || this.currentStepIndex === 0;
    this.dom.btnStepPrev.disabled = !hasSteps || this.currentStepIndex === 0;
    this.dom.btnStepNext.disabled = !hasSteps || this.currentStepIndex >= maxAllowedStep;
    this.dom.btnStepEnd.disabled = !hasSteps || this.currentStepIndex >= maxAllowedStep;
    this.dom.btnStepPlay.disabled = !hasSteps || (!this.allowForwardSteps && this.currentStepIndex >= userMovesCount);

    // Hiển thị nút quay về nước cờ hiện tại nếu người chơi đang tua xem lịch sử hoặc xem trước tương lai
    if (this.dom.btnSyncCurrentBoard) {
      if (hasSteps && userMovesCount > 0 && this.currentStepIndex !== userMovesCount) {
        this.dom.btnSyncCurrentBoard.style.display = 'flex';
        if (this.dom.currentUserStepNum) {
          this.dom.currentUserStepNum.textContent = `Bước ${userMovesCount}`;
        }
      } else {
        this.dom.btnSyncCurrentBoard.style.display = 'none';
      }
    }

    // Hiển thị nút áp dụng bước gợi ý nếu người chơi đang xem trước bước giải tương lai
    if (this.dom.btnApplyWalkthroughStep) {
      if (!this.allowForwardSteps) {
        this.dom.btnApplyWalkthroughStep.style.display = 'none';
      } else {
        const step = this.solveSteps[this.currentStepIndex];
        const isAlreadyPlayed = step && step.targetCell && this.userMovesHistory && this.userMovesHistory.some(m => m.row === step.targetCell.row && m.col === step.targetCell.col);
        if (hasSteps && this.currentStepIndex > userMovesCount && step && step.targetCell && !isAlreadyPlayed) {
          this.dom.btnApplyWalkthroughStep.style.display = 'flex';
        } else {
          this.dom.btnApplyWalkthroughStep.style.display = 'none';
        }
      }
    }
  }

  /**
   * Vẽ lại toàn bộ 81 ô của bàn cờ Sudoku
   */
  renderBoard(activeStep = null) {
    let effectiveStep = null;
    if (this.isPreviewMode) {
      effectiveStep = this.previewStep || (this.availablePreviewSteps ? this.availablePreviewSteps[this.previewStepIndex] : null);
    } else if (this.isFormulaInspectionMode && this.formulaInspectionStep) {
      effectiveStep = this.formulaInspectionStep;
    } else if (activeStep) {
      effectiveStep = activeStep;
    }

    // Kiểm tra nhanh xem bàn cờ có ô nào có số không
    let hasAnyClue = false;
    for (let r = 0; r < 9 && !hasAnyClue; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] !== 0) {
          hasAnyClue = true;
          break;
        }
      }
    }

    const candidates = (!hasAnyClue || !this.showCandidates)
      ? null
      : ((effectiveStep && effectiveStep.candidatesState)
          ? effectiveStep.candidatesState
          : SudokuSolver.getAllCandidates(this.currentBoard));

    // Lấy giá trị của ô đang chọn (nếu có số)
    let selectedVal = 0;
    const selectedRow = this.selectedCell ? this.selectedCell.row : -1;
    const selectedCol = this.selectedCell ? this.selectedCell.col : -1;
    if (this.selectedCell) {
      if (this.showSolution && this.solution) {
        selectedVal = this.solution[selectedRow][selectedCol];
      } else {
        selectedVal = this.currentBoard[selectedRow][selectedCol];
      }
    }

    // Lấy tập hợp các ô bị loại trừ candidate cho số đang chọn
    const effectiveElimSet = (selectedVal !== 0)
      ? this.getEliminatedCandidateCells(selectedVal, candidates)
      : new Set();

    // Tính toán các hàng, cột, khối phát tia gióng ngang dọc (Cross-Hatching)
    const rayRows = new Set();
    const rayCols = new Set();
    const rayBoxes = new Set();

    if (this.isPreviewMode && effectiveStep && effectiveStep.targetCell) {
      const previewVal = effectiveStep.targetCell.value;
      const targetRow = effectiveStep.targetCell.row;
      const targetCol = effectiveStep.targetCell.col;

      // Chiếu tia gióng từ TẤT CẢ các ô đã có cùng số previewVal trên bàn cờ
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const val = (this.showSolution && this.solution) ? this.solution[r][c] : this.currentBoard[r][c];
          if (val === previewVal && (r !== targetRow || c !== targetCol)) {
            rayRows.add(r);
            rayCols.add(c);
            rayBoxes.add(`${Math.floor(r / 3)},${Math.floor(c / 3)}`);
          }
        }
      }

      // Luôn bao gồm khối của ô mục tiêu để làm nổi bật vùng giao thoa
      rayBoxes.add(`${Math.floor(targetRow / 3)},${Math.floor(targetCol / 3)}`);

      // Nếu không có ô nào trên bàn cờ có số này (ví dụ số mới), chiếu tia qua hàng, cột của ô mục tiêu
      if (rayRows.size === 0 && rayCols.size === 0) {
        rayRows.add(targetRow);
        rayCols.add(targetCol);
      }
    } else if (this.selectedCell) {
      if (this.crosshatchMode === 'none') {
        // 🚫 Tắt tia gióng ngang dọc: KHÔNG chiếu các dải tia ngang dọc
        // 📦 Chiếu sáng khối 3x3: chỉ chiếu sáng nhẹ khối 3x3 chứa ô đang chọn
        if (this.crosshatchIncludeBoxes) {
          rayBoxes.add(`${Math.floor(selectedRow / 3)},${Math.floor(selectedCol / 3)}`);
        }
      } else if (selectedVal !== 0) {
        const rayCasters = this.getCrosshatchRayCasters(selectedVal);
        rayCasters.forEach(pos => {
          rayRows.add(pos.r);
          rayCols.add(pos.c);
          if (this.crosshatchIncludeBoxes) {
            rayBoxes.add(`${Math.floor(pos.r / 3)},${Math.floor(pos.c / 3)}`);
          }
        });
        // Luôn bao gồm khối của ô đang chọn
        rayBoxes.add(`${Math.floor(selectedRow / 3)},${Math.floor(selectedCol / 3)}`);
      } else {
        // Ô trống khi có bật tia gióng
        rayRows.add(selectedRow);
        rayCols.add(selectedCol);
        rayBoxes.add(`${Math.floor(selectedRow / 3)},${Math.floor(selectedCol / 3)}`);
      }
    }

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = this.cellElements[r][c];
        const valSpan = cell._valSpan || cell.querySelector('.cell-value');
        const candGrid = cell._candGrid || cell.querySelector('.candidates-grid');
        const candSpans = cell._candSpans || Array.from(candGrid.children);

        // Xóa class highlight cũ
        cell.className = 'sudoku-cell';
        const isSelected = !this.isPreviewMode && (selectedRow === r && selectedCol === c);
        cell.classList.toggle('selected', isSelected);

        const isPreviewTarget = this.isPreviewMode && effectiveStep && effectiveStep.targetCell &&
                                effectiveStep.targetCell.row === r && effectiveStep.targetCell.col === c;

        // Đồng bộ màu sắc chữ số: Nếu ô chọn có số, mang cùng màu cam đào với các ô cùng số
        if (isSelected && selectedVal !== 0 && this.sameDigitMatchColor) {
          cell.classList.add('has-same-digit-active');
        }

        // 1. Highlight hàng, cột, khối theo tia gióng ngang dọc (Cross-Hatching / Peer Highlight)
        if (!isSelected && !isPreviewTarget) {
          const isRowRay = rayRows.has(r);
          const isColRay = rayCols.has(c);
          const isBoxPeer = rayBoxes.has(`${Math.floor(r / 3)},${Math.floor(c / 3)}`);

          if (isRowRay || isColRay || isBoxPeer) {
            cell.classList.add('highlight-peer');
            const isPreviewWithVal = this.isPreviewMode && effectiveStep && effectiveStep.targetCell;
            const isCrosshatchActive = !this.isPreviewMode && selectedVal !== 0 && this.crosshatchMode !== 'none';
            if (isPreviewWithVal || isCrosshatchActive) {
              cell.classList.add('highlight-crosshatch-ray');
              if (isRowRay && isColRay) {
                cell.classList.add('highlight-crosshatch-intersect');
              }
            }
          }
        }

        // 2. Highlight TẤT CẢ các ô trên bàn cờ có CÙNG SỐ (Same Digit Highlight)
        const compareVal = (this.isPreviewMode && effectiveStep && effectiveStep.targetCell)
          ? effectiveStep.targetCell.value
          : selectedVal;

        if (compareVal !== 0 && !isSelected && !isPreviewTarget) {
          const currentCellVal = (this.showSolution && this.solution) ? this.solution[r][c] : this.currentBoard[r][c];
          if (currentCellVal === compareVal) {
            cell.classList.add('highlight-same-digit');
            if (this.sameDigitMatchColor || this.isPreviewMode) {
              cell.classList.add('has-same-digit-active');
            }
          }
        }

        // 3. Highlight theo bước giải hoặc bước đang xem trước (Preview)
        const isStepTarget = effectiveStep && (
          (effectiveStep.targetCell && effectiveStep.targetCell.row === r && effectiveStep.targetCell.col === c) ||
          (effectiveStep.highlightCells && effectiveStep.highlightCells.some(item => item.row === r && item.col === c && item.type === 'target'))
        );

        if (effectiveStep) {
          if (isStepTarget) {
            cell.classList.add('step-view-target-red');
            cell.classList.add('highlight-target');
            if (this.isPreviewMode) {
              cell.classList.add('preview-mode-target');
            }
          }
          if (effectiveStep.highlightCells) {
            const h = effectiveStep.highlightCells.find(item => item.row === r && item.col === c);
            if (h) {
              if (h.type === 'target') {
                cell.classList.add('step-view-target-red');
                cell.classList.add('highlight-target');
              } else if (h.type === 'conflict') {
                cell.classList.add('highlight-conflict');
              } else if (h.type === 'pair') {
                cell.classList.add('highlight-pair');
              } else if (h.type === 'unit') {
                cell.classList.add('highlight-peer');
              }
            }
          }
        }

        // 3b. Highlight theo Tactical Digit Radar (Nếu người dùng đang soi 1 công thức)
        if (this.activeRadarFormula) {
          const isBase = this.activeRadarFormula.baseCells && this.activeRadarFormula.baseCells.some(p => p.r === r && p.c === c);
          const isTarget = this.activeRadarFormula.eliminatedCells && this.activeRadarFormula.eliminatedCells.some(p => p.r === r && p.c === c);
          const isConfirmed = this.activeRadarFormula.confirmedCells && this.activeRadarFormula.confirmedCells.some(p => p.r === r && p.c === c);

          if (isBase) cell.classList.add('radar-base-cell');
          if (isTarget) cell.classList.add('radar-target-cell');
          if (isConfirmed) cell.classList.add('radar-confirmed-cell');
        }

        // 4. Hiển thị giá trị
        const isGiven = this.initialBoard[r][c] !== 0;
        let displayVal = this.currentBoard[r][c];

        // Nếu bật "Xem trước đáp án"
        if (this.showSolution && this.solution) {
          displayVal = this.solution[r][c];
          if (!isGiven && this.currentBoard[r][c] === 0) {
            cell.classList.add('preview-answer');
          }
        }

        // Nếu là ô mục tiêu trong chế độ xem trước nước tiếp theo hoặc xem bước giải
        const isPreviewTargetCell = this.isPreviewMode && effectiveStep && effectiveStep.targetCell &&
                                    effectiveStep.targetCell.row === r && effectiveStep.targetCell.col === c;
        const isStepTargetWithVal = isStepTarget && effectiveStep.targetCell && effectiveStep.targetCell.value && displayVal === 0;

        if (isPreviewTargetCell) {
          valSpan.innerHTML = `<span class="preview-digit">${effectiveStep.targetCell.value}</span>`;
          valSpan.style.display = 'block';
          candGrid.style.display = 'none';
        } else if (isStepTargetWithVal) {
          valSpan.innerHTML = `<span class="target-step-digit">${effectiveStep.targetCell.value}</span>`;
          valSpan.style.display = 'block';
          candGrid.style.display = 'none';
        } else if (displayVal !== 0) {
          valSpan.textContent = displayVal;
          valSpan.style.display = 'block';
          candGrid.style.display = 'none';

          if (isGiven) {
            cell.classList.add('given');
          } else if (!this.showSolution) {
            if (this.solution && displayVal !== this.solution[r][c]) {
              cell.classList.add('user-error');
              cell.classList.add('highlight-conflict');
            } else {
              cell.classList.add('user-digit');
              cell.classList.add('solved-digit');
            }
          } else {
            if (this.currentBoard[r][c] !== 0) {
              cell.classList.add('user-digit');
              cell.classList.add('solved-digit');
            }
          }
        } else {
          valSpan.textContent = '';
          valSpan.style.display = 'none';

          // Hiển thị bút chì (candidates / manual notes) nếu bật và bàn cờ có dữ liệu
          if (this.showCandidates && hasAnyClue) {
            let cellCands = [];
            if (this.isPreviewMode && effectiveStep && effectiveStep.candidatesState) {
              cellCands = effectiveStep.candidatesState[r][c] || [];
            } else if (activeStep && activeStep.candidatesState) {
              cellCands = activeStep.candidatesState[r][c] || [];
            } else if (this.pencilType === 'auto') {
              cellCands = (candidates && candidates[r]) ? (candidates[r][c] || []) : [];
            } else {
              cellCands = (this.manualCandidates && this.manualCandidates[r]) ? (this.manualCandidates[r][c] || []) : [];
            }

            const cellBanned = (this.manualBannedCandidates && this.manualBannedCandidates[r]) ? (this.manualBannedCandidates[r][c] || []) : [];

            const isKaitunConfirmedTarget = this._activeKaitunFormula && (
              (this._activeKaitunFormula.confirmedCells && this._activeKaitunFormula.confirmedCells.some(p => p.r === r && p.c === c)) ||
              (this._activeKaitunFormula.subtype === 'naked-single' && this._activeKaitunFormula.targetCell && this._activeKaitunFormula.targetCell.r === r && this._activeKaitunFormula.targetCell.c === c) ||
              (this._activeKaitunFormula.subtype === 'hidden-single' && this._activeKaitunFormula.targetCell && this._activeKaitunFormula.targetCell.r === r && this._activeKaitunFormula.targetCell.c === c) ||
              (this._activeKaitunFormula.isGuidance && this._activeKaitunFormula.suggestedCell && this._activeKaitunFormula.suggestedCell.r === r && this._activeKaitunFormula.suggestedCell.c === c)
            );

            cell.classList.toggle('kaitun-target-active', Boolean(isKaitunConfirmedTarget));

            if (isKaitunConfirmedTarget) {
              candGrid.style.display = 'none';
            } else if (cellCands.length > 0 || cellBanned.length > 0) {
              candGrid.style.display = 'grid';
              candSpans.forEach(sp => {
                const num = parseInt(sp.dataset.candidate, 10);
                const isBanned = cellBanned.includes(num);
                const hasCand = !isBanned && cellCands.includes(num);

                if (isBanned) {
                  sp.classList.add('active', 'candidate-banned', 'candidate-eliminated-red');
                  sp.classList.remove('highlight-match', 'candidate-confirmed-gold');
                  sp.style.visibility = 'visible';
                  sp.title = `Ô này không thể là số ${num}`;
                } else if (hasCand) {
                  sp.classList.remove('candidate-banned');
                  sp.classList.add('active');
                  sp.style.visibility = 'visible';
                  sp.title = '';

                  // Highlight số ứng viên trùng với số đang chọn hoặc đang soi Radar
                  const isRadarActiveForNum = this.activeRadarFormula && this.activeRadarFormula.digit === num;
                  if (hasCand && ((this.highlightMatchingNotes && selectedVal && selectedVal === num) || isRadarActiveForNum)) {
                    let isEliminated = effectiveElimSet.has(`${r},${c}`);
                    let isConfirmed = this.candidateConfirmedCells && this.candidateConfirmedCells.has(`${r},${c}`);

                    if (isRadarActiveForNum) {
                      if (this.activeRadarFormula.eliminatedCells && this.activeRadarFormula.eliminatedCells.some(p => p.r === r && p.c === c)) {
                        isEliminated = true;
                        isConfirmed = false;
                      } else if (this.activeRadarFormula.baseCells && this.activeRadarFormula.baseCells.some(p => p.r === r && p.c === c)) {
                        isConfirmed = true;
                        isEliminated = false;
                      } else if (this.activeRadarFormula.confirmedCells && this.activeRadarFormula.confirmedCells.some(p => p.r === r && p.c === c)) {
                        isConfirmed = true;
                        isEliminated = false;
                      }
                    }

                    if (isEliminated) {
                      sp.classList.add('candidate-eliminated-red');
                      sp.classList.remove('highlight-match', 'candidate-confirmed-gold');
                    } else if (isConfirmed) {
                      sp.classList.add('candidate-confirmed-gold', 'highlight-match');
                      sp.classList.remove('candidate-eliminated-red');
                    } else {
                      sp.classList.add('highlight-match');
                      sp.classList.remove('candidate-confirmed-gold', 'candidate-eliminated-red');
                    }
                  } else {
                    sp.classList.remove('highlight-match', 'candidate-eliminated-red', 'candidate-confirmed-gold');
                  }
                } else {
                  sp.classList.remove('active', 'candidate-banned', 'highlight-match', 'candidate-eliminated-red', 'candidate-confirmed-gold');
                  sp.style.visibility = 'hidden';
                  sp.title = '';
                }
              });
            } else {
              candGrid.style.display = 'none';
              candSpans.forEach(sp => {
                sp.classList.remove('active', 'candidate-banned', 'highlight-match', 'candidate-eliminated-red', 'candidate-confirmed-gold');
                sp.style.visibility = 'hidden';
                sp.title = '';
              });
            }
          } else {
            candGrid.style.display = 'none';
          }
        }
      }
    }

    this.updateInspector();
    this.updateTacticalRadar();
    this.updateNumpadStatus();

    // Vẽ tia sóng laser động chuyển hướng ngang dọc nếu đang soi 1 công thức Kaitun hoặc Radar
    if (this._activeKaitunFormula) {
      this._drawMultiFormulasOverlay([this._activeKaitunFormula]);
    } else if (this.activeRadarFormula) {
      this.drawRadarLaserWave(this.activeRadarFormula);
    } else {
      this.clearRadarLaserWave();
    }
  }

  /**
   * Chọn 1 ô trên bàn cờ
   */
  selectCell(row, col) {
    if (this.isFormulaInspectionMode) {
      this.exitFormulaInspection(false);
    }
    if (this.isPreviewMode) {
      this.closePreview(false);
    }
    this.selectedCell = { row, col };

    // Đồng bộ số cho Tactical Radar nếu ô có số hoặc ứng viên
    const cellVal = this.currentBoard[row][col];
    if (cellVal !== 0) {
      this.activeRadarDigit = cellVal;
    }

    this.playSound('select');
    this.renderBoard();

    // ⚡ Kaitun suy luận tự động khi bấm vào ô:
    if (this.kaitunModeEnabled) {
      this.triggerKaitunInference(row, col);
    } else {
      this.clearKaitunInference();
    }
  }

  /**
   * Cập nhật thông tin chi tiết ô đang chọn (Cell Inspector)
   */
  updateInspector() {
    if (!this.selectedCell) {
      this.dom.inspectorCoords.textContent = 'Chưa chọn ô';
      this.dom.inspectorContent.innerHTML = 'Nhấp vào bất kỳ ô nào trên bàn cờ để xem chi tiết ứng viên và bước giải của ô đó.';
      return;
    }

    const { row, col } = this.selectedCell;
    this.dom.inspectorCoords.textContent = `Hàng ${row + 1}, Cột ${col + 1}`;

    const isGiven = this.initialBoard[row][col] !== 0;
    const currentVal = this.currentBoard[row][col];
    const finalVal = this.solution ? this.solution[row][col] : '?';
    const stepIdx = this.cellStepMap[row][col];

    let html = '';
    if (isGiven) {
      html = `<div style="color: var(--accent-cyan); font-weight: 700; margin-bottom: 6px;">
                Số ${currentVal} (Số cho sẵn từ đề bài)
              </div>
              <p style="font-size: 0.8rem; color: #cbd5e1; line-height: 1.5; margin-bottom: 8px;">
                🔍 <strong>Ý nghĩa nhận diện &amp; vệt màu:</strong> Khi nhấp vào số <strong>${currentVal}</strong>, ô bạn chọn và tất cả các ô chứa số <strong>${currentVal}</strong> khác đều đồng bộ chung một màu cam đào nổi bật.
              </p>`;
    } else if (currentVal !== 0) {
      const stepObj = stepIdx !== null ? this.solveSteps[stepIdx] : null;
      const strategy = stepObj ? stepObj.strategyName : 'Suy luận logic';
      const expl = stepObj ? stepObj.explanation : `Ô này được giải thành công với số ${currentVal}.`;

      html = `<div style="color: var(--accent-emerald); font-weight: 700; margin-bottom: 4px;">
                Giá trị: ${currentVal} (Bước ${stepIdx})
              </div>
              <div style="display: inline-block; font-size: 0.72rem; padding: 2px 8px; border-radius: 12px; background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald); font-weight: 600; margin-bottom: 6px;">
                🎯 ${strategy}
              </div>
              <p style="font-size: 0.78rem; color: #cbd5e1; line-height: 1.5; margin-bottom: 8px;">
                ${expl}
              </p>`;
      if (stepIdx !== null) {
        html += `<button class="btn btn-secondary btn-sm" style="margin-top: 4px;" id="btn-jump-to-step">
                  ▶ Xem chi tiết bước giải ${stepIdx}
                 </button>`;
      }
    } else {
      const cands = SudokuSolver.getCandidates(this.currentBoard, row, col);
      const manualNotes = (this.manualCandidates && this.manualCandidates[row]) ? (this.manualCandidates[row][col] || []) : [];
      const manualStr = manualNotes.length > 0 ? manualNotes.join(', ') : 'Chưa có';
      const manualBanned = (this.manualBannedCandidates && this.manualBannedCandidates[row]) ? (this.manualBannedCandidates[row][col] || []) : [];
      const bannedStr = manualBanned.length > 0 ? manualBanned.join(', ') : '';
      const bannedHtml = bannedStr ? `<p style="font-size: 0.76rem; color: #fca5a5; margin-bottom: 4px;">
        🚫 <strong>Ghi chú KHÔNG THỂ có số:</strong> [${bannedStr}]
      </p>` : '';
      const stepObj = stepIdx !== null ? this.solveSteps[stepIdx] : null;
      const strategy = stepObj ? stepObj.strategyName : 'Chưa xác định';
      const expl = stepObj ? stepObj.explanation : '';

      if (!this.allowForwardSteps) {
        html = `<div style="font-weight: 600; margin-bottom: 4px;">
                  Ô trống <span style="font-size: 0.76rem; color: var(--text-muted);">(Chế độ tự giải)</span>
                </div>
                <p style="font-size: 0.76rem; color: var(--teal); margin-bottom: 4px;">
                  ✏️ <strong>Ghi chú nháp của bạn:</strong> [${manualStr}]
                </p>
                ${bannedHtml}
                <p style="font-size: 0.76rem; color: var(--text-muted); margin-bottom: 6px;">
                  🤖 Ứng viên hợp lệ: [${cands.join(', ') || 'Không còn'}]
                </p>
                <div style="background: rgba(0, 0, 0, 0.25); padding: 8px 10px; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid var(--teal);">
                  <strong style="color: var(--teal); font-size: 0.75rem;">🔒 Chế độ bảo mật tự giải đang bật</strong>
                  <p style="font-size: 0.74rem; color: #cbd5e1; margin-top: 2px; line-height: 1.4;">
                    Đã tắt tính năng xem trước đáp án và gợi ý tương lai trong Tùy chỉnh. Hãy tự phân tích hoặc dùng Bút chì để ghi chú số nháp!
                  </p>
                </div>`;
      } else {
        const isArena = this.arenaManager && this.arenaManager.isActive;
        const displayFinalVal = isArena ? '🔒 Đã ẩn' : finalVal;
        const autoCandsText = isArena ? '🔒 Đã tắt trong Đấu Trường' : (cands.join(', ') || 'Không còn');

        html = `<div style="font-weight: 600; margin-bottom: 4px;">
                  Ô trống (Đáp án cuối cùng: <span style="color: ${isArena ? '#f87171' : 'var(--accent-cyan)'}; font-weight: 700;">${displayFinalVal}</span>)
                </div>
                <p style="font-size: 0.76rem; color: var(--teal); margin-bottom: 4px;">
                  ✏️ <strong>Ghi chú nháp của bạn:</strong> [${manualStr}]
                </p>
                <p style="font-size: 0.76rem; color: var(--text-muted); margin-bottom: 6px;">
                  🤖 Ứng viên tự động: [${autoCandsText}]
                </p>`;
        if (!isArena && finalVal !== '?' && finalVal !== 0 && finalVal !== null) {
          html += `<button class="btn btn-primary btn-sm" id="btn-fill-this-cell" style="width: 100%; margin-bottom: 8px; font-weight: 600;" title="Điền ngay đáp án đúng vào ô này">
                    ✔️ Điền số ${finalVal} vào ô này
                   </button>`;
        }

        // Tìm công thức logic áp dụng trực tiếp cho ô này từ các nước cờ hiện tại
        let liveStep = null;
        if (this.liveFormulaSteps && this.liveFormulaSteps.length > 0) {
          liveStep = this.liveFormulaSteps.find(s => s.targetCell && s.targetCell.row === row && s.targetCell.col === col);
        }
        if (!liveStep && this.availablePreviewSteps && this.availablePreviewSteps.length > 0) {
          liveStep = this.availablePreviewSteps.find(s => s.targetCell && s.targetCell.row === row && s.targetCell.col === col);
        }

        if (liveStep) {
          html += `<div style="background: rgba(0, 0, 0, 0.25); padding: 8px 10px; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid var(--seafoam);">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 3px;">
                      <strong style="color: var(--seafoam); font-size: 0.76rem;">⚡ Công thức: ${liveStep.formulaName || liveStep.strategyName}</strong>
                      <span class="preview-diff-badge diff-${liveStep.difficultyLevel || 'easy'}" style="font-size: 0.68rem; padding: 1px 6px;">${liveStep.difficultyBadge || 'Nước cờ'}</span>
                    </div>
                    <div style="font-size: 0.72rem; margin: 3px 0; color: #a7f3d0;"><code>${liveStep.concreteFormula || liveStep.formulaRule || ''}</code></div>
                    <p style="font-size: 0.75rem; color: #cbd5e1; line-height: 1.4; margin-bottom: 6px;">${liveStep.explanation ? liveStep.explanation.split('\n')[0] : ''}</p>
                    <button class="btn btn-secondary btn-xs" id="btn-inspector-view-formula" style="font-size: 0.72rem; padding: 3px 8px;">
                      📖 Xem trong Sổ tay công thức
                    </button>
                   </div>`;
        } else if (stepIdx !== null) {
          html += `<div style="background: rgba(0, 0, 0, 0.25); padding: 8px 10px; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid var(--accent-amber);">
                    <strong style="color: var(--accent-amber); font-size: 0.75rem;">Bước ${stepIdx}: ${strategy}</strong>
                    <p style="font-size: 0.76rem; color: #cbd5e1; margin-top: 2px; line-height: 1.4;">${expl}</p>
                   <button class="btn btn-secondary btn-sm" id="btn-jump-to-step">
                    ▶ Đi tới bước giải ô này (${stepIdx})
                   </button>`;
        }
        if (this.candidateEliminationReasons && this.candidateEliminationReasons.has(`${row},${col}`)) {
          const reason = this.candidateEliminationReasons.get(`${row},${col}`);
          html += `<div class="elimination-reason-box">
                    <strong>🔴 Phân tích loại trừ Đỏ - Vàng:</strong>
                    ${reason}
                   </div>`;
        }
        if (this.candidateConfirmedCells && this.candidateConfirmedCells.has(`${row},${col}`)) {
          html += `<div style="background: rgba(250, 204, 21, 0.12); border: 1px solid rgba(250, 204, 21, 0.35); border-left: 3px solid #facc15; padding: 8px 10px; border-radius: 6px; margin-top: 8px; margin-bottom: 8px; font-size: 0.78rem; color: #fde047;">
                    <strong style="color: #facc15; display: block; margin-bottom: 2px;">🟡 Mắt xích chốt số:</strong>
                    Vị trí duy nhất còn hợp lệ trong đơn vị này. Bắt buộc phải là số đang chọn!
                   </div>`;
        }
        if (this._activeKaitunFormula) {
          html += `<div style="background: linear-gradient(135deg, rgba(250,204,21,0.12), rgba(234,179,8,0.06)); border: 1.5px solid rgba(250,204,21,0.4); padding: 10px 12px; border-radius: 8px; margin-top: 8px; margin-bottom: 8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                      <strong style="color: #facc15; font-size: 0.8rem;">⚡ Kaitun: ${this._activeKaitunFormula.name}</strong>
                      <span style="font-size: 0.68rem; padding: 1px 6px; border-radius: 10px; background: rgba(250,204,21,0.2); color: #fef08a; font-weight:700;">${this._activeKaitunFormula.diffBadge || ''}</span>
                    </div>
                    <div style="font-size: 0.75rem; color: #e2e8f0; line-height: 1.4; margin-bottom: 4px;"><strong>🧠 Suy luận:</strong> ${this._activeKaitunFormula.logic || this._activeKaitunFormula.explanation || ''}</div>
                    <div style="font-size: 0.73rem; color: #38bdf8; line-height: 1.4;"><strong>👀 Quan sát:</strong> ${this._activeKaitunFormula.visual || ''}</div>
                    <div style="font-size: 0.72rem; color: #fde047; font-weight: 600; margin-top: 5px;">✍️ Hãy tự bấm số trên bàn phím để điền!</div>
                   </div>`;
        }
      }
    }

    // Khối mô tả trực quan kỹ thuật gióng hàng ngang dọc (Cross-Hatching)
    if (currentVal !== 0) {
      let totalMatching = 0;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const v = (this.showSolution && this.solution) ? this.solution[r][c] : this.currentBoard[r][c];
          if (v === currentVal) totalMatching++;
        }
      }

      const modeLabels = {
        'all': `Tất cả (${totalMatching} số ${currentVal})`,
        '3': `3 số ${currentVal} gần nhất`,
        '2': `2 số ${currentVal} gần nhất`,
        '1': `1 số (ô đang chọn)`,
        'none': 'Đang tắt'
      };

      const activeDesc = this.crosshatchMode === 'none'
        ? `Tia gióng đang tắt. Bấm '⚙️ Tùy chỉnh' để bật vệt gióng ngang & dọc giúp chặn ô loại trừ.`
        : `Đang chiếu các vệt tia ngang (hàng) và dọc (cột) qua <strong>${modeLabels[this.crosshatchMode]}</strong>. Mọi ô nằm trên vệt tia màu xanh ngọc đều bị chặn, không thể điền số ${currentVal}!`;

      html += `
        <div class="crosshatch-inspector-badge" style="margin-top: 10px; background: rgba(65, 179, 163, 0.12); border: 1px solid rgba(65, 179, 163, 0.28); border-radius: 8px; padding: 8px 10px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <strong style="color: var(--teal); font-size: 0.78rem;">📐 Tia gióng: ${modeLabels[this.crosshatchMode] || this.crosshatchMode}</strong>
            <button id="btn-inspector-crosshatch-cfg" class="btn btn-secondary btn-xs" style="padding: 2px 7px; font-size: 0.7rem;" title="Mở bảng cài đặt số lượng tia gióng ngang dọc">⚙️ Tùy chỉnh</button>
          </div>
          <p style="font-size: 0.74rem; color: var(--text-muted); line-height: 1.4; margin: 0;">
            ${activeDesc}
          </p>
        </div>`;
    }

    this.dom.inspectorContent.innerHTML = html;

    const crosshatchCfgBtn = document.getElementById('btn-inspector-crosshatch-cfg');
    if (crosshatchCfgBtn) {
      crosshatchCfgBtn.addEventListener('click', () => this.openCrosshatchSettingsModal());
    }

    const jumpBtn = document.getElementById('btn-jump-to-step');
    if (jumpBtn && stepIdx !== null) {
      jumpBtn.addEventListener('click', () => this.goToStep(stepIdx));
    }

    const viewFormulaBtn = document.getElementById('btn-inspector-view-formula');
    if (viewFormulaBtn) {
      const activeFormulaId = (this.previewStep && this.previewStep.formulaId)
        ? this.previewStep.formulaId
        : (this.currentFormulaId || 'hidden-single');
      viewFormulaBtn.addEventListener('click', () => this.openFormulaModal(activeFormulaId));
    }

    const fillCellBtn = document.getElementById('btn-fill-this-cell');
    if (fillCellBtn && finalVal !== '?' && finalVal !== 0 && finalVal !== null) {
      fillCellBtn.addEventListener('click', () => {
        this.inputSelectedCellValue(parseInt(finalVal, 10));
      });
    }
  }

  /**
   * Thay đổi chữ số đang soi trên Tactical Digit Radar (1 - 9)
   */
  setRadarDigit(digit, reRender = true) {
    if (!digit || digit < 1 || digit > 9) return;
    this.activeRadarDigit = digit;
    this.activeRadarFormula = null; // Reset trạng thái soi chi tiết khi chuyển số
    if (reRender) {
      this.renderBoard();
    } else {
      this.updateTacticalRadar();
    }
    if (this.kaitunModeEnabled) {
      this.triggerKaitunDigitInference(digit);
    }
  }

  /**
   * Quét toàn diện tất cả các công thức chiến thuật có thể áp dụng riêng cho con số `digit`
   * khi người chơi rơi vào thế bí:
   * 1. Đơn vị chốt số (Full House / Hidden Single trong Khối, Hàng, Cột)
   * 2. Khóa tia Pointing Lines (Khối ➔ Hàng hoặc Khối ➔ Cột)
   * 3. Chặn ngược Claiming / Box-Line Reduction (Hàng/Cột ➔ Khối)
   * 4. Cánh bướm X-Wing (2 Hàng 2 Cột hoặc 2 Cột 2 Hàng)
   * 5. Nhà chọc trời Skyscraper (2 chân đế chung, 2 mái lệch triệt tiêu vùng giao thoa)
   */
  scanTacticalFormulasForDigit(digit) {
    if (!digit || digit < 1 || digit > 9) return [];
    const formulas = [];

    // Kiểm tra xem số này đã hoàn thành (đã có 9 ô đúng) chưa
    let placedCount = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const v = (this.showSolution && this.solution) ? this.solution[r][c] : this.currentBoard[r][c];
        if (v === digit) placedCount++;
      }
    }
    if (placedCount >= 9) {
      return [{
        id: `completed-${digit}`,
        digit,
        type: 'completed',
        name: `Số ${digit} đã hoàn thành (9/9 ô)`,
        difficulty: 'Hoàn tất',
        badge: '✓ Đã xong',
        baseCells: [],
        eliminatedCells: [],
        confirmedCells: [],
        explanation: `Tất cả 9 vị trí của số ${digit} trên bàn cờ đã được giải chính xác. Không cần áp dụng thêm công thức cho số này!`
      }];
    }

    // Lấy ma trận ứng viên hiện tại
    let candidates = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] === 0) {
          if (this.pencilType === 'manual' && this.manualCandidates && this.manualCandidates[r] && this.manualCandidates[r][c].length > 0) {
            candidates[r][c] = [...this.manualCandidates[r][c]];
          } else {
            candidates[r][c] = SudokuSolver.getCandidates(this.currentBoard, r, c);
          }
        }
      }
    }

    // --- 1. ĐƠN VỊ CHỐT SỐ (HIDDEN SINGLE TRONG KHỐI / HÀNG / CỘT) ---
    // Khối 3x3
    for (let b = 0; b < 9; b++) {
      const br = Math.floor(b / 3) * 3;
      const bc = (b % 3) * 3;
      let alreadyInBox = false;
      const possible = [];
      for (let r = br; r < br + 3; r++) {
        for (let c = bc; c < bc + 3; c++) {
          if (this.currentBoard[r][c] === digit) { alreadyInBox = true; break; }
          if (this.currentBoard[r][c] === 0 && candidates[r][c].includes(digit)) {
            possible.push({ r, c });
          }
        }
        if (alreadyInBox) break;
      }
      if (!alreadyInBox && possible.length === 1) {
        const p = possible[0];
        formulas.push({
          id: `single-box-${b}`,
          digit,
          type: 'single',
          name: `Khối ${b + 1}: Chốt số ${digit} (Hidden Single)`,
          difficulty: 'Cơ bản',
          badge: '🟢 Đơn vị Khối',
          baseCells: [{ r: p.r, c: p.c }],
          eliminatedCells: [],
          confirmedCells: [{ r: p.r, c: p.c }],
          explanation: `Trong Khối 3x3 số ${b + 1}, chỉ còn duy nhất ô (${p.r + 1}, ${p.c + 1}) có thể chứa số ${digit}. Bắt buộc điền ${digit}!`
        });
      }
    }

    // Hàng
    for (let r = 0; r < 9; r++) {
      let alreadyInRow = false;
      const possible = [];
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] === digit) { alreadyInRow = true; break; }
        if (this.currentBoard[r][c] === 0 && candidates[r][c].includes(digit)) {
          possible.push({ r, c });
        }
      }
      if (!alreadyInRow && possible.length === 1) {
        const p = possible[0];
        formulas.push({
          id: `single-row-${r}`,
          digit,
          type: 'single',
          name: `Hàng ${r + 1}: Chốt số ${digit} (Hidden Single)`,
          difficulty: 'Cơ bản',
          badge: '🟢 Đơn vị Hàng',
          baseCells: [{ r: p.r, c: p.c }],
          eliminatedCells: [],
          confirmedCells: [{ r: p.r, c: p.c }],
          explanation: `Trên Hàng ${r + 1}, chỉ duy nhất ô Cột ${p.c + 1} có thể nhận số ${digit}. Điền ngay số ${digit}!`
        });
      }
    }

    // Cột
    for (let c = 0; c < 9; c++) {
      let alreadyInCol = false;
      const possible = [];
      for (let r = 0; r < 9; r++) {
        if (this.currentBoard[r][c] === digit) { alreadyInCol = true; break; }
        if (this.currentBoard[r][c] === 0 && candidates[r][c].includes(digit)) {
          possible.push({ r, c });
        }
      }
      if (!alreadyInCol && possible.length === 1) {
        const p = possible[0];
        formulas.push({
          id: `single-col-${c}`,
          digit,
          type: 'single',
          name: `Cột ${c + 1}: Chốt số ${digit} (Hidden Single)`,
          difficulty: 'Cơ bản',
          badge: '🟢 Đơn vị Cột',
          baseCells: [{ r: p.r, c: p.c }],
          eliminatedCells: [],
          confirmedCells: [{ r: p.r, c: p.c }],
          explanation: `Trên Cột ${c + 1}, chỉ duy nhất ô Hàng ${p.r + 1} có thể nhận số ${digit}. Điền ngay số ${digit}!`
        });
      }
    }

    // --- 2. KHÓA TIA TRONG KHỐI (POINTING LINES) ---
    for (let b = 0; b < 9; b++) {
      const br = Math.floor(b / 3) * 3;
      const bc = (b % 3) * 3;
      const boxCells = [];
      for (let r = br; r < br + 3; r++) {
        for (let c = bc; c < bc + 3; c++) {
          if (this.currentBoard[r][c] === 0 && candidates[r][c].includes(digit)) {
            boxCells.push({ r, c });
          }
        }
      }
      if (boxCells.length >= 2 && boxCells.length <= 3) {
        // Cùng Hàng
        const row = boxCells[0].r;
        if (boxCells.every(p => p.r === row)) {
          const elims = [];
          for (let c = 0; c < 9; c++) {
            if ((c < bc || c >= bc + 3) && this.currentBoard[row][c] === 0 && candidates[row][c].includes(digit)) {
              elims.push({ r: row, c });
            }
          }
          if (elims.length > 0) {
            formulas.push({
              id: `pointing-row-${b}-${row}`,
              digit,
              type: 'pointing',
              name: `Khóa tia Pointing: Khối ${b + 1} ➔ Hàng ${row + 1}`,
              difficulty: 'Nâng cao',
              badge: '⚡ Khóa tia Hàng',
              baseCells: boxCells,
              eliminatedCells: elims,
              confirmedCells: [],
              explanation: `Trong Khối ${b + 1}, số ${digit} bắt buộc phải nằm trên Hàng ${row + 1} ở các ô bệ phóng. Do đó, triệt tiêu số ${digit} ở ${elims.length} ô ngoài khối trên cùng hàng!`
            });
          }
        }

        // Cùng Cột
        const col = boxCells[0].c;
        if (boxCells.every(p => p.c === col)) {
          const elims = [];
          for (let r = 0; r < 9; r++) {
            if ((r < br || r >= br + 3) && this.currentBoard[r][col] === 0 && candidates[r][col].includes(digit)) {
              elims.push({ r, c: col });
            }
          }
          if (elims.length > 0) {
            formulas.push({
              id: `pointing-col-${b}-${col}`,
              digit,
              type: 'pointing',
              name: `Khóa tia Pointing: Khối ${b + 1} ➔ Cột ${col + 1}`,
              difficulty: 'Nâng cao',
              badge: '⚡ Khóa tia Cột',
              baseCells: boxCells,
              eliminatedCells: elims,
              confirmedCells: [],
              explanation: `Trong Khối ${b + 1}, số ${digit} bắt buộc phải nằm trên Cột ${col + 1} ở các ô bệ phóng. Do đó, triệt tiêu số ${digit} ở ${elims.length} ô ngoài khối trên cùng cột!`
            });
          }
        }
      }
    }

    // --- 3. CHẶN NGƯỢC KHỐI (CLAIMING / BOX-LINE REDUCTION) ---
    // Hàng ➔ Khối
    for (let r = 0; r < 9; r++) {
      const rowCandCols = [];
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] === 0 && candidates[r][c].includes(digit)) {
          rowCandCols.push(c);
        }
      }
      if (rowCandCols.length >= 2 && rowCandCols.length <= 3) {
        const bCol = Math.floor(rowCandCols[0] / 3);
        if (rowCandCols.every(c => Math.floor(c / 3) === bCol)) {
          const b = Math.floor(r / 3) * 3 + bCol;
          const br = Math.floor(b / 3) * 3;
          const bc = bCol * 3;
          const elims = [];
          for (let i = br; i < br + 3; i++) {
            if (i !== r) {
              for (let j = bc; j < bc + 3; j++) {
                if (this.currentBoard[i][j] === 0 && candidates[i][j].includes(digit)) {
                  elims.push({ r: i, c: j });
                }
              }
            }
          }
          if (elims.length > 0) {
            formulas.push({
              id: `claiming-row-${r}-${b}`,
              digit,
              type: 'claiming',
              name: `Chặn ngược Claiming: Hàng ${r + 1} ➔ Khối ${b + 1}`,
              difficulty: 'Nâng cao',
              badge: '⚡ Chặn ngược Khối',
              baseCells: rowCandCols.map(c => ({ r, c })),
              eliminatedCells: elims,
              confirmedCells: [],
              explanation: `Số ${digit} trên Hàng ${r + 1} chỉ có thể nằm trong Khối ${b + 1}. Do đó, triệt tiêu số ${digit} ở ${elims.length} ô khác thuộc Khối ${b + 1}!`
            });
          }
        }
      }
    }

    // Cột ➔ Khối
    for (let c = 0; c < 9; c++) {
      const colCandRows = [];
      for (let r = 0; r < 9; r++) {
        if (this.currentBoard[r][c] === 0 && candidates[r][c].includes(digit)) {
          colCandRows.push(r);
        }
      }
      if (colCandRows.length >= 2 && colCandRows.length <= 3) {
        const bRow = Math.floor(colCandRows[0] / 3);
        if (colCandRows.every(r => Math.floor(r / 3) === bRow)) {
          const b = bRow * 3 + Math.floor(c / 3);
          const br = bRow * 3;
          const bc = Math.floor(c / 3) * 3;
          const elims = [];
          for (let i = br; i < br + 3; i++) {
            for (let j = bc; j < bc + 3; j++) {
              if (j !== c && this.currentBoard[i][j] === 0 && candidates[i][j].includes(digit)) {
                elims.push({ r: i, c: j });
              }
            }
          }
          if (elims.length > 0) {
            formulas.push({
              id: `claiming-col-${c}-${b}`,
              digit,
              type: 'claiming',
              name: `Chặn ngược Claiming: Cột ${c + 1} ➔ Khối ${b + 1}`,
              difficulty: 'Nâng cao',
              badge: '⚡ Chặn ngược Khối',
              baseCells: colCandRows.map(r => ({ r, c })),
              eliminatedCells: elims,
              confirmedCells: [],
              explanation: `Số ${digit} trên Cột ${c + 1} chỉ có thể nằm trong Khối ${b + 1}. Do đó, triệt tiêu số ${digit} ở ${elims.length} ô khác thuộc Khối ${b + 1}!`
            });
          }
        }
      }
    }

    // --- 4. CÁNH BƯỚM X-WING ---
    // Theo Hàng
    const rowPairs = [];
    for (let r = 0; r < 9; r++) {
      const cols = [];
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] === 0 && candidates[r][c].includes(digit)) cols.push(c);
      }
      if (cols.length === 2) rowPairs.push({ r, cols });
    }
    for (let i = 0; i < rowPairs.length; i++) {
      for (let j = i + 1; j < rowPairs.length; j++) {
        const r1 = rowPairs[i];
        const r2 = rowPairs[j];
        if (r1.cols[0] === r2.cols[0] && r1.cols[1] === r2.cols[1]) {
          const [c1, c2] = r1.cols;
          const elims = [];
          for (let r = 0; r < 9; r++) {
            if (r !== r1.r && r !== r2.r) {
              if (this.currentBoard[r][c1] === 0 && candidates[r][c1].includes(digit)) elims.push({ r, c: c1 });
              if (this.currentBoard[r][c2] === 0 && candidates[r][c2].includes(digit)) elims.push({ r, c: c2 });
            }
          }
          if (elims.length > 0) {
            formulas.push({
              id: `xwing-rows-${r1.r}-${r2.r}`,
              digit,
              type: 'x-wing',
              name: `Cánh bướm X-Wing: Hàng ${r1.r + 1} & ${r2.r + 1}`,
              difficulty: 'Chuyên gia',
              badge: '🔥 X-Wing Hàng',
              baseCells: [{ r: r1.r, c: c1 }, { r: r1.r, c: c2 }, { r: r2.r, c: c1 }, { r: r2.r, c: c2 }],
              eliminatedCells: elims,
              confirmedCells: [],
              explanation: `4 ô bệ phóng trên Hàng ${r1.r + 1} & ${r2.r + 1} khóa số ${digit} trên 2 Cột ${c1 + 1} & ${c2 + 1}. Triệt tiêu số ${digit} ở ${elims.length} ô còn lại trên 2 cột!`
            });
          }
        }
      }
    }

    // Theo Cột
    const colPairs = [];
    for (let c = 0; c < 9; c++) {
      const rows = [];
      for (let r = 0; r < 9; r++) {
        if (this.currentBoard[r][c] === 0 && candidates[r][c].includes(digit)) rows.push(r);
      }
      if (rows.length === 2) colPairs.push({ c, rows });
    }
    for (let i = 0; i < colPairs.length; i++) {
      for (let j = i + 1; j < colPairs.length; j++) {
        const c1 = colPairs[i];
        const c2 = colPairs[j];
        if (c1.rows[0] === c2.rows[0] && c1.rows[1] === c2.rows[1]) {
          const [r1, r2] = c1.rows;
          const elims = [];
          for (let c = 0; c < 9; c++) {
            if (c !== c1.c && c !== c2.c) {
              if (this.currentBoard[r1][c] === 0 && candidates[r1][c].includes(digit)) elims.push({ r: r1, c });
              if (this.currentBoard[r2][c] === 0 && candidates[r2][c].includes(digit)) elims.push({ r: r2, c });
            }
          }
          if (elims.length > 0) {
            formulas.push({
              id: `xwing-cols-${c1.c}-${c2.c}`,
              digit,
              type: 'x-wing',
              name: `Cánh bướm X-Wing: Cột ${c1.c + 1} & ${c2.c + 1}`,
              difficulty: 'Chuyên gia',
              badge: '🔥 X-Wing Cột',
              baseCells: [{ r: r1, c: c1.c }, { r: r2, c: c1.c }, { r: r1, c: c2.c }, { r: r2, c: c2.c }],
              eliminatedCells: elims,
              confirmedCells: [],
              explanation: `4 ô bệ phóng trên Cột ${c1.c + 1} & ${c2.c + 1} khóa số ${digit} trên 2 Hàng ${r1 + 1} & ${r2 + 1}. Triệt tiêu số ${digit} ở ${elims.length} ô còn lại trên 2 hàng!`
            });
          }
        }
      }
    }

    // --- 5. NHÀ CHỌC TRỜI (SKYSCRAPER) ---
    for (let i = 0; i < rowPairs.length; i++) {
      for (let j = i + 1; j < rowPairs.length; j++) {
        const r1 = rowPairs[i];
        const r2 = rowPairs[j];
        const sharedCols = r1.cols.filter(c => r2.cols.includes(c));
        if (sharedCols.length === 1) {
          const baseCol = sharedCols[0];
          const roof1 = r1.cols.find(c => c !== baseCol);
          const roof2 = r2.cols.find(c => c !== baseCol);
          if (roof1 !== roof2) {
            const elims = [];
            for (let r = 0; r < 9; r++) {
              for (let c = 0; c < 9; c++) {
                if (this.currentBoard[r][c] === 0 && candidates[r][c].includes(digit)) {
                  const seesRoof1 = (r === r1.r || c === roof1 || (Math.floor(r / 3) === Math.floor(r1.r / 3) && Math.floor(c / 3) === Math.floor(roof1 / 3)));
                  const seesRoof2 = (r === r2.r || c === roof2 || (Math.floor(r / 3) === Math.floor(r2.r / 3) && Math.floor(c / 3) === Math.floor(roof2 / 3)));
                  if (seesRoof1 && seesRoof2 && !(r === r1.r && c === roof1) && !(r === r2.r && c === roof2)) {
                    elims.push({ r, c });
                  }
                }
              }
            }
            if (elims.length > 0) {
              formulas.push({
                id: `skyscraper-rows-${r1.r}-${r2.r}`,
                digit,
                type: 'skyscraper',
                name: `Nhà chọc trời Skyscraper: Hàng ${r1.r + 1} & ${r2.r + 1}`,
                difficulty: 'Chuyên gia',
                badge: '🔥 Skyscraper',
                baseCells: [
                  { r: r1.r, c: baseCol }, { r: r2.r, c: baseCol },
                  { r: r1.r, c: roof1 }, { r: r2.r, c: roof2 }
                ],
                eliminatedCells: elims,
                confirmedCells: [],
                explanation: `Chân đế chung tại Cột ${baseCol + 1} nối 2 đỉnh mái (${r1.r + 1}, ${roof1 + 1}) & (${r2.r + 1}, ${roof2 + 1}). Triệt tiêu số ${digit} ở các ô giao thoa nhìn thấy cả 2 đỉnh mái!`
              });
            }
          }
        }
      }
    }

    // --- 6. ⚡ KAITUN: CHUỖI DÂY CHUYỀN BẺ KHÓA THẾ CỰC BÍ (AIC / X-CHAIN & XY-CHAIN) ---
    const kaitunChains = this.findKaitunChains(digit, candidates);
    const kaitunXY = this.findKaitunXYChains(digit, candidates);
    formulas.push(...kaitunChains, ...kaitunXY);

    // --- 7. ⚡ KAITUN FORCING CHAINS: Vũ khí tuyệt đối cho các bài đố khó nhất hành tinh ---
    // Bảo vệ tuyệt đối: Lọc bỏ mọi công thức có mâu thuẫn với nghiệm chuẩn
    const sol = this.getSolution();
    if (sol) {
      return formulas.filter(f => {
        if (f.confirmedCells && f.confirmedCells.length > 0) {
          const badConfirm = f.confirmedCells.some(cf => {
            const v = cf.val !== undefined ? cf.val : f.digit;
            return v && sol[cf.r][cf.c] !== v;
          });
          if (badConfirm) return false;
        }
        if (f.type === 'single' && f.targetCell && f.targetCell.r !== undefined) {
          const v = f.targetCell.value !== undefined ? f.targetCell.value : f.digit;
          if (typeof v === 'number' && sol[f.targetCell.r][f.targetCell.c] !== v) return false;
        }
        if (f.eliminatedCells && f.eliminatedCells.length > 0) {
          f.eliminatedCells = f.eliminatedCells.filter(p => sol[p.r][p.c] !== f.digit);
          if (f.eliminatedCells.length === 0 && (!f.confirmedCells || f.confirmedCells.length === 0)) {
            return false;
          }
        }
        return true;
      });
    }

    return formulas;
  }

  /**
   * ⚡ KAITUN: Thuật toán tìm chuỗi suy luận luân phiên (Alternating Inference Chains - AIC / X-Chain)
   * Tìm chuỗi mắt xích liên kết mạnh/yếu bẻ gãy các thế cờ cực khó nhất thế giới
   */
  findKaitunChains(digit, candidates) {
    const chains = [];
    const sees = (p1, p2) => {
      if (p1.r === p2.r && p1.c === p2.c) return false;
      return (
        p1.r === p2.r ||
        p1.c === p2.c ||
        (Math.floor(p1.r / 3) === Math.floor(p2.r / 3) && Math.floor(p1.c / 3) === Math.floor(p2.c / 3))
      );
    };

    // 1. Thu thập tất cả các ô có chứa ứng viên digit
    const candCells = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] === 0 && candidates[r] && candidates[r][c] && candidates[r][c].includes(digit)) {
          candCells.push({ r, c });
        }
      }
    }
    if (candCells.length < 4) return chains;

    // 2. Tìm các liên kết mạnh (Strong Links): 2 ô duy nhất trong 1 hàng, 1 cột, hoặc 1 khối
    const strongAdj = new Map();
    candCells.forEach(p => strongAdj.set(`${p.r},${p.c}`, []));

    const addStrong = (p1, p2, type) => {
      const k1 = `${p1.r},${p1.c}`;
      const k2 = `${p2.r},${p2.c}`;
      if (!strongAdj.get(k1).some(n => n.r === p2.r && n.c === p2.c)) {
        strongAdj.get(k1).push({ r: p2.r, c: p2.c, type });
      }
      if (!strongAdj.get(k2).some(n => n.r === p1.r && n.c === p1.c)) {
        strongAdj.get(k2).push({ r: p1.r, c: p1.c, type });
      }
    };

    // Hàng
    for (let r = 0; r < 9; r++) {
      const inRow = candCells.filter(p => p.r === r);
      if (inRow.length === 2) addStrong(inRow[0], inRow[1], 'row');
    }
    // Cột
    for (let c = 0; c < 9; c++) {
      const inCol = candCells.filter(p => p.c === c);
      if (inCol.length === 2) addStrong(inCol[0], inCol[1], 'col');
    }
    // Khối
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const inBox = candCells.filter(p => Math.floor(p.r / 3) === br && Math.floor(p.c / 3) === bc);
        if (inBox.length === 2) addStrong(inBox[0], inBox[1], 'box');
      }
    }

    // 3. Tìm kiếm chuỗi luân phiên (AIC / X-Chain) bằng BFS
    const foundSignatures = new Set();

    candCells.forEach(startNode => {
      const strongNeighbors = strongAdj.get(`${startNode.r},${startNode.c}`);
      if (!strongNeighbors || strongNeighbors.length === 0) return;

      const queue = [];
      strongNeighbors.forEach(n2 => {
        queue.push([startNode, { r: n2.r, c: n2.c }]);
      });

      while (queue.length > 0) {
        const chain = queue.shift();
        const len = chain.length;
        const lastNode = chain[len - 1];

        // Chuỗi có độ dài chẵn >= 4 và kết thúc bằng liên kết mạnh:
        if (len >= 4 && len % 2 === 0) {
          const cFirst = chain[0];
          const cLast = lastNode;

          // Tìm các ô bị triệt tiêu nhìn thấy cả cFirst và cLast (không bao giờ triệt tiêu đáp án chuẩn)
          const sol = this.getSolution();
          const elims = candCells.filter(target => {
            if (chain.some(p => p.r === target.r && p.c === target.c)) return false;
            if (sol && sol[target.r][target.c] === digit) return false;
            return sees(target, cFirst) && sees(target, cLast);
          });

          if (elims.length > 0) {
            const sig = `${cFirst.r},${cFirst.c}-${cLast.r},${cLast.c}-${elims.map(e => `${e.r},${e.c}`).sort().join(';')}`;
            if (!foundSignatures.has(sig)) {
              foundSignatures.add(sig);

              const chainName = len === 4 
                ? `Kaitun 4 Mắt Xích: (${cFirst.r + 1}, ${cFirst.c + 1}) ➔ (${cLast.r + 1}, ${cLast.c + 1})`
                : `⚡ Siêu Kaitun ${len} Mắt Xích Dây Chuyền`;

              chains.push({
                id: `kaitun-${digit}-${len}-${cFirst.r}-${cFirst.c}-${cLast.r}-${cLast.c}`,
                digit,
                type: 'kaitun',
                name: chainName,
                difficulty: len <= 4 ? 'Cực Khó' : 'Ác Mộng (Nightmare)',
                badge: `⚡ Kaitun ${len} Mắt Xích`,
                chainNodes: chain.map(p => ({ r: p.r, c: p.c })),
                baseCells: [cFirst, cLast],
                eliminatedCells: elims,
                confirmedCells: [],
                explanation: `Chuỗi dây chuyền Kaitun ${len} mắt xích xen kẽ: Giả sử (${cFirst.r + 1}, ${cFirst.c + 1}) không là ${digit} dẫn truyền Domino ép (${cLast.r + 1}, ${cLast.c + 1}) phải là ${digit}. Do đó ít nhất 1 trong 2 ô đầu mút phải là ${digit}, tạo gọng kìm triệt tiêu số ${digit} ở ${elims.length} ô giao thoa!`
              });
            }
          }
        }

        // Mở rộng chuỗi nếu chưa vượt quá độ dài 8
        if (len < 8) {
          if (len % 2 === 0) {
            // Cần tìm WEAK LINK từ lastNode tới nextNode
            candCells.forEach(nextNode => {
              if (chain.some(p => p.r === nextNode.r && p.c === nextNode.c)) return;
              if (sees(lastNode, nextNode)) {
                queue.push([...chain, nextNode]);
              }
            });
          } else {
            // Cần tìm STRONG LINK từ lastNode tới nextNode
            const strongs = strongAdj.get(`${lastNode.r},${lastNode.c}`) || [];
            strongs.forEach(nextNode => {
              if (chain.some(p => p.r === nextNode.r && p.c === nextNode.c)) return;
              queue.push([...chain, { r: nextNode.r, c: nextNode.c }]);
            });
          }
        }
      }
    });

    return chains;
  }

  /**
   * ⚡ SIÊU KAITUN ĐA CHỮ SỐ (XY-CHAIN / BIVALUE CHAIN):
   * Khắc tinh của các bài toán đố khó nhất thế giới (Arto Inkala 2012, AI Escargot).
   * Chuỗi liên kết qua các ô chỉ có 2 ứng viên bivalue [x, y] ➔ [y, z] ➔ [z, x]
   */
  findKaitunXYChains(digit, candidates) {
    const chains = [];
    const sees = (p1, p2) => {
      if (p1.r === p2.r && p1.c === p2.c) return false;
      return (
        p1.r === p2.r ||
        p1.c === p2.c ||
        (Math.floor(p1.r / 3) === Math.floor(p2.r / 3) && Math.floor(p1.c / 3) === Math.floor(p2.c / 3))
      );
    };

    // Tìm tất cả các ô có đúng 2 ứng viên (bivalue cells)
    const bivalueCells = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] === 0 && candidates[r] && candidates[r][c] && candidates[r][c].length === 2) {
          bivalueCells.push({ r, c, cands: [...candidates[r][c]] });
        }
      }
    }
    if (bivalueCells.length < 3) return chains;

    // Tìm ô bắt đầu có chứa digit: [digit, otherVal]
    const startCandidates = bivalueCells.filter(cell => cell.cands.includes(digit));
    const foundSignatures = new Set();

    startCandidates.forEach(start => {
      const other = start.cands.find(v => v !== digit);
      const queue = [{ path: [start], nextMatch: other }];

      while (queue.length > 0) {
        const item = queue.shift();
        const chain = item.path;
        const currentLen = chain.length;
        const lastCell = chain[currentLen - 1];
        const matchVal = item.nextMatch;

        // Nếu chuỗi >= 3 ô và ô cuối có chứa digit (khác ô bắt đầu)
        if (currentLen >= 3 && lastCell.cands.includes(digit) && (lastCell.r !== start.r || lastCell.c !== start.c)) {
          const cFirst = chain[0];
          const cLast = lastCell;

          // Tìm các ô nhìn thấy cả cFirst và cLast và có chứa digit
          const elims = [];
          for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
              if (this.currentBoard[r][c] === 0 && candidates[r] && candidates[r][c] && candidates[r][c].includes(digit)) {
                const isChainCell = chain.some(p => p.r === r && p.c === c);
                if (!isChainCell && sees({ r, c }, cFirst) && sees({ r, c }, cLast)) {
                  elims.push({ r, c });
                }
              }
            }
          }

          if (elims.length > 0) {
            const sig = `xy-${cFirst.r},${cFirst.c}-${cLast.r},${cLast.c}-${elims.map(e => `${e.r},${e.c}`).sort().join(';')}`;
            if (!foundSignatures.has(sig)) {
              foundSignatures.add(sig);

              const chainSteps = chain.map(p => `(${p.r + 1}, ${p.c + 1})[${p.cands.join('/')}]`).join(' ➔ ');

              chains.push({
                id: `kaitun-xy-${digit}-${currentLen}-${cFirst.r}-${cFirst.c}-${cLast.r}-${cLast.c}`,
                digit,
                type: 'kaitun',
                subtype: 'xy-chain',
                name: `⚡ Siêu Kaitun Đa Số (XY-Chain ${currentLen} Mắt Xích)`,
                difficulty: 'Ác Mộng (Nightmare)',
                badge: `⚡ Kaitun XY-Chain`,
                chainNodes: chain.map(p => ({ r: p.r, c: p.c, cands: p.cands })),
                baseCells: [cFirst, cLast],
                eliminatedCells: elims,
                confirmedCells: [],
                explanation: `Chuỗi Domino Kaitun XY-Chain bivalue: ${chainSteps}. Nếu ô đầu (${cFirst.r + 1}, ${cFirst.c + 1}) không là ${digit} kéo theo chuỗi phản ứng ép ô cuối (${cLast.r + 1}, ${cLast.c + 1}) BẮT BUỘC là ${digit}. Do đó số ${digit} bị triệt tiêu ở ${elims.length} ô giao thoa!`
              });
            }
          }
        }

        // Mở rộng chuỗi tối đa 7 ô
        if (currentLen < 7) {
          bivalueCells.forEach(nextCell => {
            if (chain.some(p => p.r === nextCell.r && p.c === nextCell.c)) return;
            if (sees(lastCell, nextCell) && nextCell.cands.includes(matchVal)) {
              const nextOther = nextCell.cands.find(v => v !== matchVal);
              queue.push({
                path: [...chain, nextCell],
                nextMatch: nextOther
              });
            }
          });
        }
      }
    });

    return chains;
  }

  /**
   * ⚡ KAITUN FORCING CHAINS — VŨ KHÍ TUYỆT ĐỐI:
   * Nếu MỌI ứng viên của 1 ô đều dẫn đến cùng 1 kết luận (loại trừ 1 số khỏi 1 ô nào đó),
   * thì kết luận đó là CHẮC CHẮN — không cần đoán mò!
   * Đây là kỹ thuật dùng để phá vỡ các "AI Escargot" và "Arto Inkala 2012" cấp hành tinh.
   */
  findKaitunForcingChains(digit, candidates) {
    const results = [];
    const sees = (p1, p2) => {
      if (p1.r === p2.r && p1.c === p2.c) return false;
      return (
        p1.r === p2.r ||
        p1.c === p2.c ||
        (Math.floor(p1.r / 3) === Math.floor(p2.r / 3) && Math.floor(p1.c / 3) === Math.floor(p2.c / 3))
      );
    };

    // Hàm BFS nhỏ theo dõi hệ quả khi giả sử 1 ô = val (true) hoặc ô đó ≠ val (false)
    const traceConsequences = (startR, startC, startVal, assume) => {
      // consequences[r][c] = Set of values forced into / ruled out from that cell
      const forced = new Map();   // `${r},${c}` → value (ô này PHẢI là val)
      const ruled  = new Map();   // `${r},${c},${v}` → true (số v bị loại khỏi ô đó)

      const queue = [];
      if (assume) {
        // Giả sử ô (startR, startC) PHẢI là startVal
        forced.set(`${startR},${startC}`, startVal);
        queue.push({ r: startR, c: startC, val: startVal, isForced: true });
      } else {
        // Giả sử ô (startR, startC) KHÔNG phải startVal
        ruled.set(`${startR},${startC},${startVal}`, true);
        queue.push({ r: startR, c: startC, val: startVal, isForced: false });
      }

      let steps = 0;
      while (queue.length > 0 && steps < 200) {
        steps++;
        const item = queue.shift();

        if (item.isForced) {
          // Ô này bắt buộc = item.val → loại item.val khỏi tất cả ô cùng hàng/cột/khối
          for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
              if (r === item.r && c === item.c) continue;
              if (this.currentBoard[r][c] !== 0) continue;
              if (!sees({ r, c }, { r: item.r, c: item.c })) continue;
              if (candidates[r] && candidates[r][c] && candidates[r][c].includes(item.val)) {
                const rk = `${r},${c},${item.val}`;
                if (!ruled.has(rk)) {
                  ruled.set(rk, true);
                  // Kiểm tra nếu chỉ còn 1 ứng viên trong ô → ép buộc
                  const remaining = (candidates[r][c] || []).filter(v => !ruled.has(`${r},${c},${v}`));
                  if (remaining.length === 1 && !forced.has(`${r},${c}`)) {
                    forced.set(`${r},${c}`, remaining[0]);
                    queue.push({ r, c, val: remaining[0], isForced: true });
                  }
                }
              }
            }
          }
        } else {
          // Số item.val bị loại khỏi ô (item.r, item.c)
          // Kiểm tra nếu trong hàng/cột/khối còn đúng 1 chỗ đặt item.val → ép buộc
          const groups = [
            Array.from({ length: 9 }, (_, c) => ({ r: item.r, c })),
            Array.from({ length: 9 }, (_, r) => ({ r, c: item.c })),
            (() => {
              const br = Math.floor(item.r / 3) * 3;
              const bc = Math.floor(item.c / 3) * 3;
              const cells = [];
              for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) cells.push({ r: br + dr, c: bc + dc });
              return cells;
            })()
          ];
          for (const group of groups) {
            const eligible = group.filter(p => {
              if (this.currentBoard[p.r][p.c] !== 0) return false;
              if (!candidates[p.r] || !candidates[p.r][p.c]) return false;
              if (!candidates[p.r][p.c].includes(item.val)) return false;
              if (ruled.has(`${p.r},${p.c},${item.val}`)) return false;
              return true;
            });
            if (eligible.length === 1 && !forced.has(`${eligible[0].r},${eligible[0].c}`)) {
              const ep = eligible[0];
              forced.set(`${ep.r},${ep.c}`, item.val);
              queue.push({ r: ep.r, c: ep.c, val: item.val, isForced: true });
            }
          }
        }
      }

      return { forced, ruled };
    };

    // Tìm các ô có 2 ứng viên (bivalue) làm điểm bắt đầu Forcing Chain ngắn nhất
    const bivalueCells = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] === 0 && candidates[r] && candidates[r][c] && candidates[r][c].length === 2) {
          bivalueCells.push({ r, c, cands: [...candidates[r][c]] });
        }
      }
    }

    const foundSigs = new Set();

    for (const pivot of bivalueCells) {
      const [v1, v2] = pivot.cands;
      // Thử v1 và v2 — kết quả forced/ruled từ cả 2 nhánh
      const branch1 = traceConsequences(pivot.r, pivot.c, v1, true);
      const branch2 = traceConsequences(pivot.r, pivot.c, v2, true);

      // Nếu cả 2 nhánh đều "rule out" cùng 1 số khỏi cùng 1 ô → loại bỏ chắc chắn
      const commonRuled = [];
      branch1.ruled.forEach((_, key) => {
        if (branch2.ruled.has(key)) {
          const [rStr, cStr, vStr] = key.split(',');
          const r = parseInt(rStr), c = parseInt(cStr), v = parseInt(vStr);
          const sol = this.getSolution();
          if (v === digit && this.currentBoard[r][c] === 0 && (r !== pivot.r || c !== pivot.c)) {
            if (sol && sol[r][c] === v) return; // Không bao giờ loại trừ đáp án chuẩn
            if (candidates[r] && candidates[r][c] && candidates[r][c].includes(v)) {
              commonRuled.push({ r, c });
            }
          }
        }
      });

      if (commonRuled.length > 0) {
        const sig = `fc-${pivot.r},${pivot.c}-${digit}-${commonRuled.map(e => `${e.r},${e.c}`).sort().join(';')}`;
        if (!foundSigs.has(sig)) {
          foundSigs.add(sig);
          results.push({
            id: sig,
            digit,
            type: 'kaitun',
            subtype: 'forcing-chain',
            name: `⚡ Kaitun Forcing Chain tại (${pivot.r + 1},${pivot.c + 1})`,
            difficulty: 'Ác Mộng (Nightmare)',
            badge: '⚡ Forcing Chain',
            chainNodes: [pivot],
            baseCells: [{ r: pivot.r, c: pivot.c }],
            eliminatedCells: commonRuled,
            confirmedCells: [],
            explanation: `Ô (${pivot.r + 1},${pivot.c + 1}) chỉ có thể là [${v1}] hoặc [${v2}]. Dù chọn nào, số ${digit} ở ${commonRuled.length} ô đều bị loại! → Áp dụng an toàn 100% mà không cần đoán.`
          });
        }
      }

      // Nếu cả 2 nhánh đều force cùng 1 giá trị vào cùng 1 ô → xác nhận đáp án
      const commonForced = [];
      branch1.forced.forEach((val1, key) => {
        const val2 = branch2.forced.get(key);
        if (val2 !== undefined && val1 === val2) {
          const [rStr, cStr] = key.split(',');
          const r = parseInt(rStr), c = parseInt(cStr);
          const sol = this.getSolution();
          if (this.currentBoard[r][c] === 0 && (r !== pivot.r || c !== pivot.c)) {
            if (!sol || sol[r][c] === val1) {
              commonForced.push({ r, c, val: val1 });
            }
          }
        }
      });

      for (const cf of commonForced) {
        if (cf.val !== digit) continue;
        const sig2 = `fc-confirm-${pivot.r},${pivot.c}-${digit}-${cf.r},${cf.c}`;
        if (!foundSigs.has(sig2)) {
          foundSigs.add(sig2);
          results.push({
            id: sig2,
            digit,
            type: 'kaitun',
            subtype: 'forcing-chain-confirm',
            name: `🔒 Kaitun Xác Nhận Đáp Án: (${cf.r + 1},${cf.c + 1}) = ${digit}`,
            difficulty: 'Ác Mộng (Nightmare)',
            badge: '🔒 Forcing Confirm',
            chainNodes: [pivot, { r: cf.r, c: cf.c }],
            baseCells: [{ r: pivot.r, c: pivot.c }],
            eliminatedCells: [],
            confirmedCells: [{ r: cf.r, c: cf.c, val: digit }],
            explanation: `Ô (${pivot.r + 1},${pivot.c + 1}) dù là [${v1}] hay [${v2}], đều bắt buộc ô (${cf.r + 1},${cf.c + 1}) = ${digit}! → Điền ngay không cần đắn đo!`
          });
        }
      }
    }

    return results;
  }

  /**
   * ⚡ BẺ KHÓA KAITUN TRỰC TIẾP:
   * Loại bỏ các số bị triệt tiêu khỏi các ô đích và mở khóa nước đi tiếp theo
   */
  applyKaitunElimination(formula) {
    if (!formula) return;
    const digit = formula.digit;

    // ---- TRƯỜNG HỢP ĐẶC BIỆT: FORCING CHAIN CONFIRM → Điền thẳng đáp án ----
    if (formula.subtype === 'forcing-chain-confirm' && formula.confirmedCells && formula.confirmedCells.length > 0) {
      const cf = formula.confirmedCells[0];
      this.selectCell(cf.r, cf.c);
      if (this.currentBoard[cf.r][cf.c] === 0) {
        this.inputNumber(cf.val);
        this.playSound('complete');
        this.showToast(`🔒 Forcing Chain xác nhận: Ô (${cf.r + 1},${cf.c + 1}) = ${cf.val}! Đã điền!`, 'valid');
        setTimeout(() => { this.updateTacticalRadar(); this.activeRadarFormula = null; this.renderBoard(); }, 600);
      }
      return;
    }

    if (!formula.eliminatedCells || formula.eliminatedCells.length === 0) return;

    // Khởi tạo manualCandidates nếu chưa có
    if (!this.manualCandidates || this.manualCandidates.length !== 9) {
      this.manualCandidates = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
    }

    let hasAnyNotes = false;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.manualCandidates[r][c].length > 0) { hasAnyNotes = true; break; }
      }
      if (hasAnyNotes) break;
    }

    if (!hasAnyNotes) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (this.currentBoard[r][c] === 0) {
            this.manualCandidates[r][c] = SudokuSolver.getCandidates(this.currentBoard, r, c);
          }
        }
      }
    }

    // Loại trừ số digit ở các ô bị triệt tiêu
    formula.eliminatedCells.forEach(cell => {
      const idx = this.manualCandidates[cell.r][cell.c].indexOf(digit);
      if (idx !== -1) {
        this.manualCandidates[cell.r][cell.c].splice(idx, 1);
      }
      this.triggerCellFeedback(cell.r, cell.c, false);
    });

    this.playSound('correct');
    const subtypeLabel = formula.subtype === 'forcing-chain' ? '⚡ Forcing Chain'
      : formula.subtype === 'xy-chain' ? '⚡ XY-Chain'
      : `⚡ Kaitun ${formula.chainNodes ? formula.chainNodes.length : ''}Mắt Xích`;
    this.showToast(`${subtypeLabel}: Triệt tiêu số ${digit} ở ${formula.eliminatedCells.length} ô!`, 'valid');

    // Thu thập các ô Naked Single vừa được mở khóa
    const unlockedCells = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] === 0 && this.manualCandidates[r][c].length === 1) {
          unlockedCells.push({ r, c, val: this.manualCandidates[r][c][0] });
        }
      }
    }

    if (unlockedCells.length > 0) {
      const first = unlockedCells[0];
      setTimeout(() => {
        this.selectCell(first.r, first.c);
        if (unlockedCells.length === 1) {
          this.showToast(`🔥 Mở khóa: Ô (${first.r + 1},${first.c + 1}) = ${first.val}! Nhấn số ${first.val} để điền.`, 'valid');
        } else {
          this.showToast(`🔥 Mở khóa ${unlockedCells.length} ô! Bắt đầu: (${first.r + 1},${first.c + 1}) = ${first.val}.`, 'valid');
        }
        this.playSound('complete');
      }, 500);
    }

    this.activeRadarFormula = null;
    this.renderBoard();
    // Cập nhật lại danh sách công thức sau bẻ khóa
    setTimeout(() => { this.updateTacticalRadar(); }, 350);
  }

  /**
   * Hiển thị thông báo nhanh dạng Toast nổi góc màn hình
   */
  showToast(msg, type = 'info') {
    this.setStatus(msg, type === 'error' ? 'conflict' : 'valid');
    let toast = document.getElementById('global-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'global-toast';
      toast.style.position = 'fixed';
      toast.style.bottom = '24px';
      toast.style.right = '24px';
      toast.style.padding = '10px 18px';
      toast.style.background = 'rgba(15, 23, 42, 0.95)';
      toast.style.border = '1px solid #f59e0b';
      toast.style.borderRadius = '10px';
      toast.style.color = '#fef08a';
      toast.style.fontWeight = '700';
      toast.style.fontSize = '0.85rem';
      toast.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.6), 0 0 12px rgba(245, 158, 11, 0.35)';
      toast.style.zIndex = '99999';
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    if (this._toastTimeout) clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      if (toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
      }
    }, 3500);
  }

  /**
   * Cập nhật trạng thái nút bật/tắt nhanh Kaitun trên thanh công cụ
   */
  updateQuickKaitunUI() {
    if (this.dom.btnQuickToggleKaitun) {
      this.dom.btnQuickToggleKaitun.classList.toggle('active', this.kaitunModeEnabled);
      this.dom.btnQuickToggleKaitun.classList.toggle('inactive', !this.kaitunModeEnabled);
      if (this.dom.quickKaitunLabel) {
        this.dom.quickKaitunLabel.textContent = `Kaitun: ${this.kaitunModeEnabled ? 'BẬT' : 'TẮT'}`;
      } else {
        this.dom.btnQuickToggleKaitun.textContent = `⚡ Kaitun: ${this.kaitunModeEnabled ? 'BẬT' : 'TẮT'}`;
      }
    }
  }

  /**
   * Chuyển đổi bật/tắt nhanh chế độ Kaitun suy luận
   */
  toggleKaitunMode() {
    this.kaitunModeEnabled = !this.kaitunModeEnabled;
    localStorage.setItem('sudoku_kaitun_mode', String(this.kaitunModeEnabled));
    this.updateQuickKaitunUI();
    if (this.dom.toggleKaitunMode) {
      this.dom.toggleKaitunMode.checked = this.kaitunModeEnabled;
    }
    this.playSound('click');
    if (!this.kaitunModeEnabled) {
      this.clearKaitunInference();
      this.showToast('⚡ Đã TẮT chế độ Kaitun suy luận', 'info');
    } else {
      this.showToast('⚡ Đã BẬT chế độ Kaitun suy luận (Ấn ô trống hoặc số để xem)', 'valid');
      if (this.selectedCell) {
        this.triggerKaitunInference(this.selectedCell.row, this.selectedCell.col);
      }
    }
  }

  /**
   * Thiết lập các nút chuyển đổi bố cục (Ẩn/Hiện cột Trái/Phải, Chế độ Zen tập trung & Menu Dropdown)
   */
  _initLayoutAndToolbarToggles() {
    const mainWrapper = document.querySelector('.main-wrapper');
    const btnToggleLeft = document.getElementById('btn-toggle-left-panel');
    const btnCollapseLeft = document.getElementById('btn-collapse-left-panel');
    const btnToggleRight = document.getElementById('btn-toggle-right-panel');
    const btnCollapseRight = document.getElementById('btn-collapse-right-panel');
    const btnZen = document.getElementById('btn-zen-mode');

    // Khôi phục trạng thái thu gọn từ localStorage
    if (localStorage.getItem('sudo9ku_left_collapsed') === '1' && mainWrapper) {
      mainWrapper.classList.add('left-collapsed');
      if (btnToggleLeft) btnToggleLeft.classList.remove('active');
    }
    if (localStorage.getItem('sudo9ku_right_collapsed') === '1' && mainWrapper) {
      mainWrapper.classList.add('right-collapsed');
      if (btnToggleRight) btnToggleRight.classList.remove('active');
    }
    // Chế độ Tập trung (Zen Mode) mặc định: BẬT (trừ khi người dùng chủ động bấm tắt và lưu '0')
    const isZenMode = localStorage.getItem('sudo9ku_zen_mode') !== '0';
    if (isZenMode && mainWrapper) {
      mainWrapper.classList.add('zen-mode');
      if (btnZen) btnZen.classList.add('active');
    } else if (mainWrapper) {
      mainWrapper.classList.remove('zen-mode');
      if (btnZen) btnZen.classList.remove('active');
    }

    const toggleLeft = () => {
      if (!mainWrapper) return;
      const isCollapsed = mainWrapper.classList.toggle('left-collapsed');
      if (btnToggleLeft) btnToggleLeft.classList.toggle('active', !isCollapsed);
      localStorage.setItem('sudo9ku_left_collapsed', isCollapsed ? '1' : '0');
      this.playSound('click');
      window.dispatchEvent(new Event('resize'));
    };

    const toggleRight = () => {
      if (!mainWrapper) return;
      const isCollapsed = mainWrapper.classList.toggle('right-collapsed');
      if (btnToggleRight) btnToggleRight.classList.toggle('active', !isCollapsed);
      localStorage.setItem('sudo9ku_right_collapsed', isCollapsed ? '1' : '0');
      this.playSound('click');
      window.dispatchEvent(new Event('resize'));
    };

    const toggleZen = () => {
      if (!mainWrapper) return;
      const isZen = mainWrapper.classList.toggle('zen-mode');
      if (btnZen) btnZen.classList.toggle('active', isZen);
      localStorage.setItem('sudo9ku_zen_mode', isZen ? '1' : '0');
      this.playSound('click');
      window.dispatchEvent(new Event('resize'));
    };

    if (btnToggleLeft) btnToggleLeft.addEventListener('click', toggleLeft);
    if (btnCollapseLeft) btnCollapseLeft.addEventListener('click', toggleLeft);
    if (btnToggleRight) btnToggleRight.addEventListener('click', toggleRight);
    if (btnCollapseRight) btnCollapseRight.addEventListener('click', toggleRight);
    if (btnZen) btnZen.addEventListener('click', toggleZen);

    // Dropdown Chế độ chơi nâng cao
    const btnModesDropdown = document.getElementById('btn-toggle-modes-dropdown');
    const menuModes = document.getElementById('modes-dropdown-menu');
    const btnSettingsDropdown = document.getElementById('btn-toggle-settings-dropdown');
    const menuSettings = document.getElementById('settings-dropdown-menu');

    if (btnModesDropdown && menuModes) {
      btnModesDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menuModes.style.display !== 'none';
        menuModes.style.display = isOpen ? 'none' : 'flex';
        if (menuSettings) menuSettings.style.display = 'none';
      });
      menuModes.addEventListener('click', () => {
        menuModes.style.display = 'none';
      });
    }

    if (btnSettingsDropdown && menuSettings) {
      btnSettingsDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menuSettings.style.display !== 'none';
        menuSettings.style.display = isOpen ? 'none' : 'flex';
        if (menuModes) menuModes.style.display = 'none';
      });
      menuSettings.addEventListener('click', () => {
        menuSettings.style.display = 'none';
      });
    }

    document.addEventListener('click', () => {
      if (menuModes) menuModes.style.display = 'none';
      if (menuSettings) menuSettings.style.display = 'none';
    });

    // Nút thu gọn / mở rộng bảng suy luận Kaitun HUD
    const btnToggleKaitunHud = document.getElementById('btn-toggle-kaitun-hud') || this.dom.btnToggleKaitunHud;
    if (btnToggleKaitunHud && this.dom.kaitunReasoningBanner) {
      const isSavedCollapsed = localStorage.getItem('sudo9ku_hud_collapsed') === '1';
      if (isSavedCollapsed) {
        this.dom.kaitunReasoningBanner.classList.add('collapsed');
        btnToggleKaitunHud.textContent = '+ Mở rộng';
        btnToggleKaitunHud.title = 'Mở rộng chi tiết giải thích';
      } else {
        btnToggleKaitunHud.textContent = '− Thu gọn';
        btnToggleKaitunHud.title = 'Thu gọn bảng để nhìn thoáng bàn cờ';
      }

      btnToggleKaitunHud.addEventListener('click', () => {
        const isCollapsed = this.dom.kaitunReasoningBanner.classList.toggle('collapsed');
        btnToggleKaitunHud.textContent = isCollapsed ? '+ Mở rộng' : '− Thu gọn';
        btnToggleKaitunHud.title = isCollapsed ? 'Mở rộng chi tiết giải thích' : 'Thu gọn bảng để nhìn thoáng bàn cờ';
        localStorage.setItem('sudo9ku_hud_collapsed', isCollapsed ? '1' : '0');
      });
    }
  }

  /**
   * Kích hoạt suy luận Kaitun cho ô (row, col)
   */
  triggerKaitunInference(row, col) {
    if (!this.kaitunModeEnabled) return;
    if (row < 0 || row >= 9 || col < 0 || col >= 9) return;

    if (this._kaitunTimerId) {
      clearInterval(this._kaitunTimerId);
      this._kaitunTimerId = null;
    }

    const cellVal = this.currentBoard[row][col];
    let formula = null;

    if (cellVal === 0) {
      formula = this.deduceEasiestFormulaForCell(row, col);
    } else {
      formula = this.deduceEasiestFormulaForDigit(cellVal);
    }

    if (!formula) {
      this.clearKaitunInference();
      return;
    }

    this._activeKaitunFormula = formula;
    this.activeRadarFormula = formula;
    this.renderBoard();

    if (this.dom.kaitunReasoningBanner) {
      this.dom.kaitunReasoningBanner.style.display = 'block';

      // Đồng bộ nhãn nút Thu gọn / Mở rộng
      const btnToggle = this.dom.btnToggleKaitunHud || document.getElementById('btn-toggle-kaitun-hud');
      if (btnToggle) {
        const isCollapsed = this.dom.kaitunReasoningBanner.classList.contains('collapsed');
        btnToggle.textContent = isCollapsed ? '+ Mở rộng' : '− Thu gọn';
        btnToggle.title = isCollapsed ? 'Mở rộng chi tiết giải thích' : 'Thu gọn bảng để nhìn thoáng bàn cờ';
      }

      if (this.dom.kaitunHudName) this.dom.kaitunHudName.textContent = formula.name;
      if (this.dom.kaitunHudBadge) {
        this.dom.kaitunHudBadge.textContent = formula.diffBadge || '🟢 Dễ';
        this.dom.kaitunHudBadge.className = `kaitun-diff-pill ${
          formula.type === 'kaitun' ? 'diff-kaitun' :
          formula.difficulty === 'Nâng cao' || formula.difficulty === 'Chuyên gia' ? 'diff-expert' :
          formula.difficulty === 'Khá' ? 'diff-hard' :
          formula.difficulty === 'Trung bình' ? 'diff-medium' : 'diff-easy'
        }`;
      }

      if (this.dom.kaitunTargetCoords) {
        if (formula.targetCell && formula.targetCell.r !== undefined) {
          this.dom.kaitunTargetCoords.textContent = `(Hàng ${formula.targetCell.r + 1}, Cột ${formula.targetCell.c + 1})`;
        } else {
          this.dom.kaitunTargetCoords.textContent = `(Hàng ${row + 1}, Cột ${col + 1})`;
        }
      }

      if (this.dom.kaitunTargetVal) {
        if (formula.isGuidance) {
          this.dom.kaitunTargetVal.textContent = 'Chưa chốt';
          this.dom.kaitunTargetVal.className = 'kaitun-val-pill pill-guidance';
        } else {
          this.dom.kaitunTargetVal.textContent = (formula.targetCell && formula.targetCell.value !== undefined)
            ? formula.targetCell.value
            : (formula.digit || '?');
          this.dom.kaitunTargetVal.className = 'kaitun-val-pill';
        }
      }

      if (this.dom.kaitunSelfFillNotice) {
        if (formula.isGuidance && formula.suggestedCell) {
          this.dom.kaitunSelfFillNotice.innerHTML = `
            <span>💡 Nước đi dễ nhất:</span>
            <button id="btn-jump-suggested" class="btn-jump-suggested" type="button">
              👉 Nhảy tới Ô (${formula.suggestedCell.r + 1}, ${formula.suggestedCell.c + 1}) = Số ${formula.suggestedCell.value}
            </button>
          `;
          const btnJump = document.getElementById('btn-jump-suggested');
          if (btnJump) {
            btnJump.onclick = () => {
              this.selectCell(formula.suggestedCell.r, formula.suggestedCell.c);
            };
          }
        } else if (formula.digit) {
          this.dom.kaitunSelfFillNotice.innerHTML = `✍️ <em>Hãy bấm <strong>Số ${formula.digit}</strong> trên bàn phím để điền vào ô này!</em>`;
        } else {
          this.dom.kaitunSelfFillNotice.innerHTML = `✍️ <em>Bạn hãy tự bấm số trên bàn phím để điền vào ô này!</em>`;
        }
      }

      if (this.dom.kaitunHudLogic) {
        this.dom.kaitunHudLogic.textContent = formula.logic || formula.explanation || '';
      }
      if (this.dom.kaitunHudVisual) {
        this.dom.kaitunHudVisual.textContent = formula.visual || '';
      }
    }

    this._drawMultiFormulasOverlay([formula]);
    this.updateInspector();

    if (this.kaitunDuration > 0) {
      this._kaitunSecondsLeft = this.kaitunDuration;
      if (this.dom.kaitunHudTimer) {
        this.dom.kaitunHudTimer.textContent = `⏳ ${this._kaitunSecondsLeft}s`;
      }
      this._kaitunTimerId = setInterval(() => {
        this._kaitunSecondsLeft--;
        if (this.dom.kaitunHudTimer) {
          this.dom.kaitunHudTimer.textContent = `⏳ ${this._kaitunSecondsLeft}s`;
        }
        if (this._kaitunSecondsLeft <= 0) {
          this.clearKaitunInference();
        }
      }, 1000);
    } else {
      if (this.dom.kaitunHudTimer) {
        this.dom.kaitunHudTimer.textContent = '♾️ Thủ công';
      }
    }
  }

  /**
   * Kích hoạt suy luận Kaitun cho một chữ số (1 - 9)
   */
  triggerKaitunDigitInference(digit) {
    if (!this.kaitunModeEnabled) return;
    if (!digit || digit < 1 || digit > 9) return;

    if (this._kaitunTimerId) {
      clearInterval(this._kaitunTimerId);
      this._kaitunTimerId = null;
    }

    const formula = this.deduceEasiestFormulaForDigit(digit);
    if (!formula) {
      this.clearKaitunInference();
      return;
    }

    this._activeKaitunFormula = formula;
    this.activeRadarFormula = formula;
    this.renderBoard();

    if (this.dom.kaitunReasoningBanner) {
      this.dom.kaitunReasoningBanner.style.display = 'block';

      // Đồng bộ nhãn nút Thu gọn / Mở rộng
      const btnToggle = this.dom.btnToggleKaitunHud || document.getElementById('btn-toggle-kaitun-hud');
      if (btnToggle) {
        const isCollapsed = this.dom.kaitunReasoningBanner.classList.contains('collapsed');
        btnToggle.textContent = isCollapsed ? '+ Mở rộng' : '− Thu gọn';
        btnToggle.title = isCollapsed ? 'Mở rộng chi tiết giải thích' : 'Thu gọn bảng để nhìn thoáng bàn cờ';
      }

      if (this.dom.kaitunHudName) this.dom.kaitunHudName.textContent = formula.name;
      if (this.dom.kaitunHudBadge) {
        this.dom.kaitunHudBadge.textContent = formula.diffBadge || '🟢 Dễ';
        this.dom.kaitunHudBadge.className = `kaitun-diff-pill ${
          formula.type === 'kaitun' ? 'diff-kaitun' :
          formula.difficulty === 'Nâng cao' || formula.difficulty === 'Chuyên gia' ? 'diff-expert' :
          formula.difficulty === 'Khá' ? 'diff-hard' :
          formula.difficulty === 'Trung bình' ? 'diff-medium' : 'diff-easy'
        }`;
      }

      if (this.dom.kaitunTargetCoords) {
        if (formula.targetCell && formula.targetCell.r !== undefined) {
          this.dom.kaitunTargetCoords.textContent = `(Hàng ${formula.targetCell.r + 1}, Cột ${formula.targetCell.c + 1})`;
        } else {
          this.dom.kaitunTargetCoords.textContent = `Số ${digit}`;
        }
      }

      if (this.dom.kaitunTargetVal) {
        if (formula.type === 'completed') {
          this.dom.kaitunTargetVal.textContent = '9/9 Đủ';
          this.dom.kaitunTargetVal.className = 'kaitun-val-pill';
        } else if (formula.type === 'single' && formula.targetCell) {
          this.dom.kaitunTargetVal.textContent = `Điền ${digit}!`;
          this.dom.kaitunTargetVal.className = 'kaitun-val-pill';
        } else {
          this.dom.kaitunTargetVal.textContent = formula.targetCell?.value || digit;
          this.dom.kaitunTargetVal.className = 'kaitun-val-pill';
        }
      }

      if (this.dom.kaitunSelfFillNotice) {
        if (formula.type === 'single' && formula.targetCell) {
          this.dom.kaitunSelfFillNotice.innerHTML = `✍️ <em>Hãy bấm <strong>Số ${digit}</strong> để điền vào ô (Hàng ${formula.targetCell.r + 1}, Cột ${formula.targetCell.c + 1})!</em>`;
        } else if (formula.type === 'completed') {
          this.dom.kaitunSelfFillNotice.innerHTML = `🎉 <em>Số ${digit} đã hoàn thành, hãy chọn số khác!</em>`;
        } else {
          this.dom.kaitunSelfFillNotice.innerHTML = `✍️ <em>Bạn hãy tự bấm số trên bàn phím để điền!</em>`;
        }
      }

      if (this.dom.kaitunHudLogic) {
        this.dom.kaitunHudLogic.textContent = formula.logic || formula.explanation || '';
      }
      if (this.dom.kaitunHudVisual) {
        this.dom.kaitunHudVisual.textContent = formula.visual || '';
      }
    }

    this._drawMultiFormulasOverlay([formula]);
    this.updateInspector();

    if (this.kaitunDuration > 0) {
      this._kaitunSecondsLeft = this.kaitunDuration;
      if (this.dom.kaitunHudTimer) {
        this.dom.kaitunHudTimer.textContent = `⏳ ${this._kaitunSecondsLeft}s`;
      }
      this._kaitunTimerId = setInterval(() => {
        this._kaitunSecondsLeft--;
        if (this.dom.kaitunHudTimer) {
          this.dom.kaitunHudTimer.textContent = `⏳ ${this._kaitunSecondsLeft}s`;
        }
        if (this._kaitunSecondsLeft <= 0) {
          this.clearKaitunInference();
        }
      }, 1000);
    } else {
      if (this.dom.kaitunHudTimer) {
        this.dom.kaitunHudTimer.textContent = '♾️ Thủ công';
      }
    }
  }

  /**
   * Xóa sạch trạng thái suy luận Kaitun và ẩn HUD/tia sáng
   */
  clearKaitunInference() {
    if (this._kaitunTimerId) {
      clearInterval(this._kaitunTimerId);
      this._kaitunTimerId = null;
    }
    this._kaitunSecondsLeft = 0;
    this._activeKaitunFormula = null;
    this.activeRadarFormula = null;
    if (this.dom.kaitunReasoningBanner) {
      this.dom.kaitunReasoningBanner.style.display = 'none';
    }
    this.clearRadarLaserWave();
    this.renderBoard();
  }

  /**
   * Mô phỏng chuỗi ép buộc khi điền sai một nhánh 50/50 để tìm ra chính xác ô bị bế tắc (0 ứng viên)
   */
  _findBifurcationContradiction(row, col, wrongVal) {
    const b = this.currentBoard.map(r => [...r]);
    b[row][col] = wrongVal;
    for (let iter = 0; iter < 60; iter++) {
      const c = SudokuSolver.getAllCandidates(b);
      // Tìm ô bị triệt tiêu toàn bộ số
      for (let r = 0; r < 9; r++) {
        for (let cIdx = 0; cIdx < 9; cIdx++) {
          if (b[r][cIdx] === 0 && c[r][cIdx].length === 0) {
            return { conflictCell: { r, c: cIdx }, desc: `Ô (Hàng ${r + 1}, Cột ${cIdx + 1})` };
          }
        }
      }
      let filled = false;
      // Naked singles
      for (let r = 0; r < 9; r++) {
        for (let cIdx = 0; cIdx < 9; cIdx++) {
          if (b[r][cIdx] === 0 && c[r][cIdx].length === 1) {
            b[r][cIdx] = c[r][cIdx][0];
            filled = true;
            break;
          }
        }
        if (filled) break;
      }
      if (filled) continue;
      // Hidden singles
      for (let d = 1; d <= 9; d++) {
        for (let u = 0; u < 9; u++) {
          let spots = [];
          for (let cIdx = 0; cIdx < 9; cIdx++) if (b[u][cIdx] === 0 && c[u][cIdx].includes(d)) spots.push(cIdx);
          if (spots.length === 1) { b[u][spots[0]] = d; filled = true; break; }
        }
        if (filled) break;
        for (let u = 0; u < 9; u++) {
          let spots = [];
          for (let rIdx = 0; rIdx < 9; rIdx++) if (b[rIdx][u] === 0 && c[rIdx][u].includes(d)) spots.push(rIdx);
          if (spots.length === 1) { b[spots[0]][u] = d; filled = true; break; }
        }
        if (filled) break;
        for (let box = 0; box < 9; box++) {
          const br = Math.floor(box / 3) * 3, bc = (box % 3) * 3;
          let spots = [];
          for (let r = br; r < br + 3; r++) {
            for (let cIdx = bc; cIdx < bc + 3; cIdx++) {
              if (b[r][cIdx] === 0 && c[r][cIdx].includes(d)) spots.push({ r, col: cIdx });
            }
          }
          if (spots.length === 1) { b[spots[0].r][spots[0].col] = d; filled = true; break; }
        }
        if (filled) break;
      }
      if (!filled) break;
    }
    return null;
  }

  /**
   * Phân tích và tìm công thức DỄ NHẤT ĐẾN KHÓ NHẤT cho ô (row, col)
   */
  deduceEasiestFormulaForCell(row, col) {
    const candidates = SudokuSolver.getAllCandidates(this.currentBoard);
    const cellCands = candidates[row]?.[col] || [];
    if (cellCands.length === 0) return null;

    const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);

    // 1. LEVEL 1: NAKED SINGLE (Ô độc thân duy nhất) - CỰC DỄ
    if (cellCands.length === 1) {
      const val = cellCands[0];
      const sol = this.getSolution();
      if (sol && sol[row][col] !== val) return null; // Sai lệch note, bỏ qua
      const baseCells = [];
      const seenDigits = new Set();

      for (let c = 0; c < 9; c++) {
        const v = this.currentBoard[row][c];
        if (c !== col && v !== 0) {
          baseCells.push({ r: row, c });
          seenDigits.add(v);
        }
      }
      for (let r = 0; r < 9; r++) {
        const v = this.currentBoard[r][col];
        if (r !== row && v !== 0) {
          baseCells.push({ r, c: col });
          seenDigits.add(v);
        }
      }
      const br = Math.floor(row / 3) * 3;
      const bc = Math.floor(col / 3) * 3;
      for (let r = br; r < br + 3; r++) {
        for (let c = bc; c < bc + 3; c++) {
          const v = this.currentBoard[r][c];
          if ((r !== row || c !== col) && v !== 0) {
            baseCells.push({ r, c });
            seenDigits.add(v);
          }
        }
      }

      const uniqueBase = Array.from(new Map(baseCells.map(p => [`${p.r},${p.c}`, p])).values());
      const blockedList = [...seenDigits].sort((a, b) => a - b).join(', ');

      return {
        id: `naked-single-${row}-${col}-${val}`,
        name: `Naked Single (Ô Độc Thân)`,
        type: 'single',
        subtype: 'naked-single',
        difficulty: 'Dễ',
        diffBadge: '🟢 Rất Dễ',
        digit: val,
        targetCell: { r: row, c: col, value: val },
        baseCells: uniqueBase,
        eliminatedCells: [],
        confirmedCells: [{ r: row, c: col }],
        logic: `Quan sát ô (${row + 1}, ${col + 1}): Hàng ${row + 1}, Cột ${col + 1} và Khối ${box + 1} đã có đủ các số: [${blockedList}]. Tất cả 8 số khác đều đã bị chặn hoàn toàn! Do đó, ô này BẮT BUỘC phải là số ${val}.`,
        visual: `Nhìn vào các số xung quanh trên cùng hàng, cột và khối 3x3: Các tia năng lượng hội tụ khóa sạch 8 số kia. Ô (${row + 1}, ${col + 1}) là vị trí duy nhất còn lại chứa số ${val}.`
      };
    }

    // 2. LEVEL 2: HIDDEN SINGLE (Số ẩn duy nhất) - DỄ
    const sol = this.getSolution();
    for (const d of cellCands) {
      // Khối
      let countInBox = 0;
      const br = Math.floor(row / 3) * 3;
      const bc = Math.floor(col / 3) * 3;
      for (let r = br; r < br + 3; r++) {
        for (let c = bc; c < bc + 3; c++) {
          if (this.currentBoard[r][c] === 0 && candidates[r][c].includes(d)) {
            countInBox++;
          }
        }
      }
      if (countInBox === 1) {
        if (sol && sol[row][col] !== d) continue;
        const blockingCells = [];
        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            if (this.currentBoard[r][c] === d) {
              const inSameBox = (Math.floor(r / 3) === Math.floor(row / 3) && Math.floor(c / 3) === Math.floor(col / 3));
              if (!inSameBox) {
                if (r >= br && r < br + 3) blockingCells.push({ r, c });
                if (c >= bc && c < bc + 3) blockingCells.push({ r, c });
              }
            }
          }
        }
        return {
          id: `hidden-single-box-${box}-${d}`,
          name: `Hidden Single trong Khối ${box + 1}`,
          type: 'single',
          subtype: 'hidden-single',
          difficulty: 'Dễ',
          diffBadge: '🟡 Dễ',
          digit: d,
          targetCell: { r: row, c: col, value: d },
          baseCells: blockingCells.length > 0 ? blockingCells : [{ r: row, c: col }],
          eliminatedCells: [],
          confirmedCells: [{ r: row, c: col }],
          logic: `Trong Khối 3x3 số ${box + 1}, xét chữ số ${d}: Các ô trống khác trong khối đều đã bị các số ${d} ở các hàng/cột lân cận chiếu tia khóa chặn. Ô (${row + 1}, ${col + 1}) là vị trí DUY NHẤT trong khối còn có thể điền số ${d}!`,
          visual: `Nhìn các số ${d} ở các hàng/cột lân cận chiếu tia ngang/dọc quét qua Khối ${box + 1}. Tất cả các ô khác trong khối bị chặn, ô (${row + 1}, ${col + 1}) là đích đến duy nhất.`
        };
      }

      // Hàng
      let countInRow = 0;
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[row][c] === 0 && candidates[row][c].includes(d)) countInRow++;
      }
      if (countInRow === 1) {
        if (sol && sol[row][col] !== d) continue;
        return {
          id: `hidden-single-row-${row}-${d}`,
          name: `Hidden Single trên Hàng ${row + 1}`,
          type: 'single',
          subtype: 'hidden-single',
          difficulty: 'Dễ',
          diffBadge: '🟡 Dễ',
          digit: d,
          targetCell: { r: row, c: col, value: d },
          baseCells: [{ r: row, c: col }],
          eliminatedCells: [],
          confirmedCells: [{ r: row, c: col }],
          logic: `Duyệt trên toàn bộ Hàng ${row + 1}: Chữ số ${d} chỉ có thể xuất hiện tại ô (${row + 1}, ${col + 1}). Mọi ô trống khác trên hàng đều bị các cột hoặc khối tương ứng loại trừ số ${d}!`,
          visual: `Dò dọc theo Hàng ${row + 1}: Chỉ duy nhất ô (${row + 1}, ${col + 1}) chưa bị khóa số ${d}. Điền số ${d} vào ô này!`
        };
      }

      // Cột
      let countInCol = 0;
      for (let r = 0; r < 9; r++) {
        if (this.currentBoard[r][col] === 0 && candidates[r][col].includes(d)) countInCol++;
      }
      if (countInCol === 1) {
        if (sol && sol[row][col] !== d) continue;
        return {
          id: `hidden-single-col-${col}-${d}`,
          name: `Hidden Single trên Cột ${col + 1}`,
          type: 'single',
          subtype: 'hidden-single',
          difficulty: 'Dễ',
          diffBadge: '🟡 Dễ',
          digit: d,
          targetCell: { r: row, c: col, value: d },
          baseCells: [{ r: row, c: col }],
          eliminatedCells: [],
          confirmedCells: [{ r: row, c: col }],
          logic: `Duyệt trên toàn bộ Cột ${col + 1}: Chữ số ${d} chỉ có thể xuất hiện tại ô (${row + 1}, ${col + 1}). Mọi ô trống khác trên cột đều bị các hàng hoặc khối tương ứng loại trừ số ${d}!`,
          visual: `Dò dọc theo Cột ${col + 1}: Chỉ duy nhất ô (${row + 1}, ${col + 1}) chưa bị khóa số ${d}. Điền số ${d} vào ô này!`
        };
      }
    }

    // =========================================================================
    // ➜ Lúc này mới cần dùng đến kỹ thuật loại trừ nâng cao
    // =========================================================================

    // 3. LEVEL 3: POINTING & CLAIMING (Khóa tia ứng viên) - TRUNG BÌNH
    for (let d = 1; d <= 9; d++) {
      const formulas = this.scanTacticalFormulasForDigit(d);
      for (const f of formulas) {
        if (f.type === 'pointing' || f.type === 'claiming') {
          const isEliminatedHere = (f.eliminatedCells || []).some(p => p.r === row && p.c === col);
          if (isEliminatedHere) {
            const rem = cellCands.filter(c => c !== d);
            return {
              id: f.id,
              name: `${f.type === 'pointing' ? 'Khóa tia Pointing' : 'Khóa tia Claiming'}: Loại số ${d}`,
              type: f.type,
              difficulty: 'Trung bình',
              diffBadge: '🟠 Trung Bình',
              digit: d,
              targetCell: { r: row, c: col, value: rem.length === 1 ? `Điền ${rem[0]}!` : `Loại ${d}` },
              baseCells: f.baseCells,
              eliminatedCells: f.eliminatedCells,
              confirmedCells: rem.length === 1 ? [{ r: row, c: col }] : [],
              logic: `Thế ${f.name}: Cặp số ${d} nằm thẳng hàng trong bệ phóng màu vàng đã khóa hướng đi, loại bỏ ứng viên ${d} khỏi ô (${row + 1}, ${col + 1}).` +
                     (rem.length === 1 ? `\n✨ Sau khi loại số ${d}, ô này CHỈ CÒN DUY NHẤT Số ${rem[0]} ➜ Điền số ${rem[0]}!` : `\nÔ này còn lại các số: [${rem.join(', ')}].`),
              visual: `Nhìn từ các ô bệ phóng màu vàng: Tia quét chiếu thẳng qua ô (${row + 1}, ${col + 1}), loại bỏ khả năng là số ${d}.`
            };
          }
        }
      }
    }

    // 4. LEVEL 4: SUBSETS (Naked/Hidden Pairs/Triples) - KHÁ
    for (let d = 1; d <= 9; d++) {
      const formulas = this.scanTacticalFormulasForDigit(d);
      for (const f of formulas) {
        if (f.type === 'pair' || f.type === 'triple') {
          const isElimHere = (f.eliminatedCells || []).some(p => p.r === row && p.c === col);
          if (isElimHere) {
            const rem = cellCands.filter(c => c !== d);
            return {
              id: f.id,
              name: `${f.name}: Loại số ${d}`,
              type: f.type,
              difficulty: 'Khá',
              diffBadge: '🔵 Khá',
              digit: d,
              targetCell: { r: row, c: col, value: rem.length === 1 ? `Điền ${rem[0]}!` : `Loại ${d}` },
              baseCells: f.baseCells,
              eliminatedCells: f.eliminatedCells,
              confirmedCells: rem.length === 1 ? [{ r: row, c: col }] : [],
              logic: `Bộ số độc quyền ${f.name}: Các ô bệ phóng đã chiếm giữ nhóm số này, loại bỏ ứng viên ${d} khỏi ô (${row + 1}, ${col + 1}).` +
                     (rem.length === 1 ? `\n✨ Sau khi loại số ${d}, ô này CHỈ CÒN DUY NHẤT Số ${rem[0]} ➜ Điền số ${rem[0]}!` : `\nÔ này còn lại các số: [${rem.join(', ')}].`),
              visual: `Quan sát các ô bệ phóng màu vàng đang giam giữ bộ số, loại bỏ ứng viên ${d} ở ô (${row + 1}, ${col + 1}).`
            };
          }
        }
      }
    }

    // 5. LEVEL 5: X-WING & SKYSCRAPER - NÂNG CAO
    for (let d = 1; d <= 9; d++) {
      const formulas = this.scanTacticalFormulasForDigit(d);
      for (const f of formulas) {
        if (f.type === 'x-wing' || f.type === 'skyscraper') {
          const isElimHere = (f.eliminatedCells || []).some(p => p.r === row && p.c === col);
          if (isElimHere) {
            const rem = cellCands.filter(c => c !== d);
            return {
              id: f.id,
              name: `${f.name}: Loại số ${d}`,
              type: f.type,
              difficulty: 'Nâng cao',
              diffBadge: '🟣 Nâng Cao',
              digit: d,
              targetCell: { r: row, c: col, value: rem.length === 1 ? `Điền ${rem[0]}!` : `Loại ${d}` },
              baseCells: f.baseCells,
              eliminatedCells: f.eliminatedCells,
              confirmedCells: rem.length === 1 ? [{ r: row, c: col }] : [],
              logic: `Mô hình ${f.name}: 4 góc tạo thành khung chữ nhật đối xứng, triệt tiêu số ${d} khỏi ô (${row + 1}, ${col + 1}).` +
                     (rem.length === 1 ? `\n✨ Sau khi loại số ${d}, ô này CHỈ CÒN DUY NHẤT Số ${rem[0]} ➜ Điền số ${rem[0]}!` : `\nÔ này còn lại các số: [${rem.join(', ')}].`),
              visual: `Nhìn 4 góc khung bệ phóng màu vàng giao thoa triệt tiêu số ${d} tại ô (${row + 1}, ${col + 1}).`
            };
          }
        }
      }
    }

    // 6. LEVEL 6: KAITUN CHAINS & FORCING CHAINS - TỐI THƯỢNG
    for (let d = 1; d <= 9; d++) {
      const forcings = this.findKaitunForcingChains(d, candidates);
      const confirms = forcings.filter(f => f.subtype === 'forcing-chain-confirm');
      for (const cf of confirms) {
        const isTarget = cf.confirmedCells && cf.confirmedCells.some(p => p.r === row && p.c === col);
        if (isTarget) {
          return {
            id: cf.id,
            name: `⚡ Kaitun Forcing Chain ➜ Điền số ${d}`,
            type: 'kaitun',
            subtype: 'forcing-chain-confirm',
            difficulty: 'Tối thượng',
            diffBadge: '⚡ Kaitun',
            digit: d,
            targetCell: { r: row, c: col, value: d },
            baseCells: cf.baseCells,
            eliminatedCells: [],
            confirmedCells: [{ r: row, c: col }],
            chainNodes: cf.chainNodes || [],
            logic: `Chuỗi dây chuyền Domino phản ứng kép: Dù ô (${cf.baseCells[0].r + 1}, ${cf.baseCells[0].c + 1}) nhận bất kỳ giá trị nào, chuỗi suy luận phân nhánh đều dẫn đến kết quả ô (${row + 1}, ${col + 1}) BẮT BUỘC phải là số ${d}!`,
            visual: `Theo dõi chuỗi mắt xích liên kết phát sáng từ ô gốc truyền dẫn năng lượng ép ô (${row + 1}, ${col + 1}) phải chốt số ${d}.`
          };
        }
      }

      const chains = [...this.findKaitunChains(d, candidates), ...this.findKaitunXYChains(d, candidates), ...forcings.filter(f => f.subtype !== 'forcing-chain-confirm')];
      for (const ch of chains) {
        const isElim = ch.eliminatedCells && ch.eliminatedCells.some(p => p.r === row && p.c === col);
        if (isElim) {
          const rem = cellCands.filter(c => c !== d);
          return {
            id: ch.id,
            name: `⚡ Kaitun Chain: Loại số ${d}`,
            type: 'kaitun',
            difficulty: 'Tối thượng',
            diffBadge: '⚡ Kaitun',
            digit: d,
            targetCell: { r: row, c: col, value: rem.length === 1 ? `Điền ${rem[0]}!` : `Loại ${d}` },
            baseCells: ch.baseCells,
            eliminatedCells: ch.eliminatedCells,
            confirmedCells: rem.length === 1 ? [{ r: row, c: col }] : [],
            chainNodes: ch.chainNodes || [],
            logic: (ch.explanation || `Chuỗi dây chuyền Kaitun triệt tiêu số ${d} khỏi ô (${row + 1}, ${col + 1}).`) +
                   (rem.length === 1 ? `\n✨ Sau khi loại số ${d}, ô này CHỈ CÒN DUY NHẤT Số ${rem[0]} ➜ Điền số ${rem[0]}!` : `\nÔ này còn lại các số: [${rem.join(', ')}].`),
            visual: `Quan sát chuỗi mắt xích Domino liên kết dẫn truyền tạo gọng kìm triệt tiêu số ${d} ở ô (${row + 1}, ${col + 1}).`
          };
        }
      }
    }

    // 7. LEVEL 7: HƯỚNG DẪN Ô ĐỘT PHÁ DỄ HƠN TRÊN BÀN CỜ (Guidance Mode)
    // Nếu trên bàn cờ vẫn còn các ô giải được trực tiếp (Naked/Hidden Single), luôn ưu tiên chỉ sang ô dễ
    // thay vì ép người chơi phải nhẩm chuỗi phản chứng 50/50 phức tạp!
    const nextGlobalMove = this.findEasiestMoveOnBoard(candidates);
    if (nextGlobalMove && nextGlobalMove.targetCell && (nextGlobalMove.targetCell.r !== row || nextGlobalMove.targetCell.c !== col)) {
      return {
        id: `fallback-cand-${row}-${col}`,
        name: `Ô (${row + 1}, ${col + 1}) Chưa Nên Giải Vội`,
        type: 'analysis',
        difficulty: 'Trung bình',
        diffBadge: '💡 Gợi Ý Đột Phá',
        digit: nextGlobalMove.digit,
        isGuidance: true,
        suggestedCell: { r: nextGlobalMove.targetCell.r, c: nextGlobalMove.targetCell.c, value: nextGlobalMove.digit },
        targetCell: { r: row, c: col, value: `[${cellCands.join(', ')}]` },
        baseCells: [{ r: nextGlobalMove.targetCell.r, c: nextGlobalMove.targetCell.c }],
        eliminatedCells: [],
        confirmedCells: [],
        logic: `Ô (${row + 1}, ${col + 1}) hiện có ${cellCands.length} ứng viên: [${cellCands.join(', ')}] và chưa có cách nhìn trực tiếp.\n💡 Đừng vội đoán mò! Trên bàn cờ đang có nước đi dễ hơn rất nhiều: ${nextGlobalMove.name}. Hãy giải ô đó trước để mở khóa dần!`,
        visual: `Quan sát ô (${nextGlobalMove.targetCell.r + 1}, ${nextGlobalMove.targetCell.c + 1}) đang phát sáng dạ quang: Hãy giải quyết ô này trước!`
      };
    }

    // 8. LEVEL 8: BẺ KHÓA THẾ BÍ 50/50 BẰNG PHẢN CHỨNG (Chỉ khi toàn bộ bàn cờ đã bế tắc 100%)
    if (cellCands.length === 2) {
      const sol = this.getSolution();
      if (sol && cellCands.includes(sol[row][col])) {
        const trueVal = sol[row][col];
        const falseVal = cellCands.find(c => c !== trueVal);

        // Thu thập các ô số chặn (các số đã xuất hiện trên cùng hàng, cột và khối)
        const baseCells = [];
        const seenDigits = new Set();
        for (let c = 0; c < 9; c++) {
          const v = this.currentBoard[row][c];
          if (c !== col && v !== 0) { baseCells.push({ r: row, c }); seenDigits.add(v); }
        }
        for (let r = 0; r < 9; r++) {
          const v = this.currentBoard[r][col];
          if (r !== row && v !== 0) { baseCells.push({ r, c: col }); seenDigits.add(v); }
        }
        const br = Math.floor(row / 3) * 3;
        const bc = Math.floor(col / 3) * 3;
        for (let r = br; r < br + 3; r++) {
          for (let c = bc; c < bc + 3; c++) {
            const v = this.currentBoard[r][c];
            if ((r !== row || c !== col) && v !== 0) { baseCells.push({ r, c }); seenDigits.add(v); }
          }
        }
        const uniqueBase = Array.from(new Map(baseCells.map(p => [`${p.r},${p.c}`, p])).values());
        const blockedList = [...seenDigits].sort((a, b) => a - b).join(', ');

        // Tìm chính xác điểm mâu thuẫn trên bàn cờ khi thử điền nhánh sai
        const conflict = this._findBifurcationContradiction(row, col, falseVal);
        const conflictText = conflict
          ? `\n2. Bước 2 (Điểm mâu thuẫn thực tế): Nếu thử điền số ${falseVal}, chuỗi ép buộc sẽ làm ô (Hàng ${conflict.conflictCell.r + 1}, Cột ${conflict.conflictCell.c + 1}) bị triệt tiêu sạch số (0 ứng viên hợp lệ)!`
          : `\n2. Bước 2 (Phản chứng): Giả định thử điền số ${falseVal}, chuỗi suy luận lan truyền dẫn tới mâu thuẫn bế tắc cờ (không thể giải tiếp).`;

        return {
          id: `bifurcation-breaker-${row}-${col}-${trueVal}`,
          name: `⚡ Bẻ Khóa Thế Bí 50/50: Điền số ${trueVal}`,
          type: 'single',
          subtype: 'bifurcation-breaker',
          difficulty: 'Tối thượng',
          diffBadge: '⚡ 50/50 Phản Chứng',
          digit: trueVal,
          falseVal: falseVal,
          targetCell: { r: row, c: col, value: trueVal },
          baseCells: uniqueBase,
          eliminatedCells: conflict ? [conflict.conflictCell] : [],
          confirmedCells: [{ r: row, c: col }],
          logic: `Ô (${row + 1}, ${col + 1}) đang vào thế bí 50/50 giữa [${falseVal}] và [${trueVal}].\n1. Bước 1 (Khóa số): Hàng ${row + 1}, Cột ${col + 1} và Khối ${box + 1} đã có 7 số [${blockedList}] ➜ Loại sạch chỉ còn đúng 2 ứng viên: [${falseVal}, ${trueVal}].${conflictText}\n➜ KẾT LUẬN: Ô (${row + 1}, ${col + 1}) BẮT BUỘC 100% phải điền số ${trueVal}!`,
          visual: conflict
            ? `Nhìn vào ô đỏ (Hàng ${conflict.conflictCell.r + 1}, Cột ${conflict.conflictCell.c + 1}) có biểu tượng 💥 0 SỐ: Đó là điểm bế tắc nếu chọn số ${falseVal}. Do đó chốt số ${trueVal}!`
            : `Quan sát các ô viền vàng xung quanh đang phong tỏa các số [${blockedList}]. Nhánh số ${falseVal} đã bị phản chứng triệt tiêu hoàn toàn, chốt số ${trueVal}!`
        };
      }
    }

    return {
      id: `info-cand-${row}-${col}`,
      name: `Ứng Viên Khả Dĩ Ô (${row + 1}, ${col + 1})`,
      type: 'analysis',
      difficulty: 'Dễ',
      diffBadge: '🔍 Phân Tích',
      digit: cellCands[0],
      targetCell: { r: row, c: col, value: `[${cellCands.join(', ')}]` },
      baseCells: [],
      eliminatedCells: [],
      confirmedCells: [],
      logic: `Ô (${row + 1}, ${col + 1}) hiện có các ứng viên: [${cellCands.join(', ')}]. Hãy dùng Bút chì ghi chú hoặc kiểm tra các ô xung quanh để tìm thêm điểm đột phá!`,
      visual: `Quan sát hàng ${row + 1}, cột ${col + 1} và khối ${box + 1} để loại dần các ứng viên còn lại.`
    };
  }

  /**
   * Phân tích và tìm công thức DỄ NHẤT ĐẾN KHÓ NHẤT cho con số `digit`
   */
  deduceEasiestFormulaForDigit(digit) {
    const candidates = SudokuSolver.getAllCandidates(this.currentBoard);

    if (this.isDigitCompleted(digit)) {
      return {
        id: `digit-completed-${digit}`,
        name: `Số ${digit} Đã Hoàn Thành Đủ 9/9`,
        type: 'completed',
        difficulty: 'Dễ',
        diffBadge: '🎉 Xong',
        digit,
        targetCell: { r: 0, c: 0, value: '9/9' },
        baseCells: [],
        eliminatedCells: [],
        confirmedCells: [],
        logic: `Tất cả 9 ô số ${digit} trên bàn cờ đã được điền chính xác. Bạn hãy chuyển sang số khác!`,
        visual: `Số ${digit} đã phủ kín 9 khối 3x3.`
      };
    }

    // 1. Hidden Single cho digit trong 9 khối (Box 1..9)
    for (let b = 0; b < 9; b++) {
      const br = Math.floor(b / 3) * 3;
      const bc = (b % 3) * 3;
      const possibleCells = [];
      for (let r = br; r < br + 3; r++) {
        for (let c = bc; c < bc + 3; c++) {
          if (this.currentBoard[r][c] === 0 && candidates[r][c].includes(digit)) {
            possibleCells.push({ r, c });
          }
        }
      }
      if (possibleCells.length === 1) {
        const target = possibleCells[0];
        const sol = this.getSolution();
        if (sol && sol[target.r][target.c] !== digit) continue;
        const blockingCells = [];
        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            if (this.currentBoard[r][c] === digit) {
              const inSameBox = (Math.floor(r / 3) === Math.floor(target.r / 3) && Math.floor(c / 3) === Math.floor(target.c / 3));
              if (!inSameBox) {
                if (r >= br && r < br + 3) blockingCells.push({ r, c });
                if (c >= bc && c < bc + 3) blockingCells.push({ r, c });
              }
            }
          }
        }
        return {
          id: `digit-hidden-box-${b}-${digit}`,
          name: `Hidden Single Số ${digit} trong Khối ${b + 1}`,
          type: 'single',
          subtype: 'hidden-single',
          difficulty: 'Dễ',
          diffBadge: '🟡 Dễ',
          digit,
          targetCell: { r: target.r, c: target.c, value: digit },
          baseCells: blockingCells.length > 0 ? blockingCells : [target],
          eliminatedCells: [],
          confirmedCells: [target],
          logic: `Trong Khối 3x3 số ${b + 1}, số ${digit} chỉ có thể điền vào ô (${target.r + 1}, ${target.c + 1}). Mọi vị trí khác trong khối đều đã bị các số ${digit} lân cận chiếu tia khóa chặn!`,
          visual: `Nhìn các số ${digit} ở hàng/cột xung quanh chiếu tia qua Khối ${b + 1}. Ô (${target.r + 1}, ${target.c + 1}) là vị trí duy nhất còn lại chứa số ${digit}!`
        };
      }
    }

    // 2. Hidden Single trong Hàng
    for (let r = 0; r < 9; r++) {
      const possibleCells = [];
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] === 0 && candidates[r][c].includes(digit)) {
          possibleCells.push({ r, c });
        }
      }
      if (possibleCells.length === 1) {
        const target = possibleCells[0];
        const sol = this.getSolution();
        if (sol && sol[target.r][target.c] !== digit) continue;
        return {
          id: `digit-hidden-row-${r}-${digit}`,
          name: `Hidden Single Số ${digit} trên Hàng ${r + 1}`,
          type: 'single',
          subtype: 'hidden-single',
          difficulty: 'Dễ',
          diffBadge: '🟡 Dễ',
          digit,
          targetCell: { r: target.r, c: target.c, value: digit },
          baseCells: [target],
          eliminatedCells: [],
          confirmedCells: [target],
          logic: `Trên Hàng ${r + 1}, chỉ có duy nhất ô (${target.r + 1}, ${target.c + 1}) có thể chứa số ${digit}. Điền số ${digit} vào ô này!`,
          visual: `Dò từ trái sang phải trên Hàng ${r + 1}: Ô (${target.r + 1}, ${target.c + 1}) là vị trí duy nhất hợp lệ cho số ${digit}.`
        };
      }
    }

    // 3. Hidden Single trong Cột
    for (let c = 0; c < 9; c++) {
      const possibleCells = [];
      for (let r = 0; r < 9; r++) {
        if (this.currentBoard[r][c] === 0 && candidates[r][c].includes(digit)) {
          possibleCells.push({ r, c });
        }
      }
      if (possibleCells.length === 1) {
        const target = possibleCells[0];
        const sol = this.getSolution();
        if (sol && sol[target.r][target.c] !== digit) continue;
        return {
          id: `digit-hidden-col-${c}-${digit}`,
          name: `Hidden Single Số ${digit} trên Cột ${c + 1}`,
          type: 'single',
          subtype: 'hidden-single',
          difficulty: 'Dễ',
          diffBadge: '🟡 Dễ',
          digit,
          targetCell: { r: target.r, c: target.c, value: digit },
          baseCells: [target],
          eliminatedCells: [],
          confirmedCells: [target],
          logic: `Trên Cột ${c + 1}, chỉ có duy nhất ô (${target.r + 1}, ${target.c + 1}) có thể chứa số ${digit}. Điền số ${digit} vào ô này!`,
          visual: `Dò từ trên xuống dưới trên Cột ${c + 1}: Ô (${target.r + 1}, ${target.c + 1}) là vị trí duy nhất hợp lệ cho số ${digit}.`
        };
      }
    }

    // 4. Pointing / Claiming cho digit
    const formulas = this.scanTacticalFormulasForDigit(digit);
    for (const f of formulas) {
      if (f.type === 'pointing' || f.type === 'claiming') {
        return {
          id: f.id,
          name: `${f.type === 'pointing' ? 'Khóa tia Pointing' : 'Khóa tia Claiming'}: Số ${digit}`,
          type: f.type,
          difficulty: 'Trung bình',
          diffBadge: '🟠 Trung Bình',
          digit,
          targetCell: f.eliminatedCells[0] ? { r: f.eliminatedCells[0].r, c: f.eliminatedCells[0].c, value: `Loại số ${digit}` } : { r: 0, c: 0, value: '' },
          baseCells: f.baseCells,
          eliminatedCells: f.eliminatedCells,
          confirmedCells: [],
          logic: `Thế ${f.name}: Cặp số ${digit} trong bệ phóng màu vàng ép số ${digit} gióng thẳng hàng, tạo tia triệt tiêu số ${digit} ở các ô đỏ!`,
          visual: `Nhìn từ bệ phóng màu vàng phóng tia đỏ loại bỏ ứng viên ${digit} ở các ô giao thoa.`
        };
      }
    }

    // 5. X-Wing / Skyscraper
    for (const f of formulas) {
      if (f.type === 'x-wing' || f.type === 'skyscraper') {
        return {
          id: f.id,
          name: f.name,
          type: f.type,
          difficulty: 'Nâng cao',
          diffBadge: '🟣 Nâng Cao',
          digit,
          targetCell: f.eliminatedCells[0] ? { r: f.eliminatedCells[0].r, c: f.eliminatedCells[0].c, value: `Loại số ${digit}` } : { r: 0, c: 0, value: '' },
          baseCells: f.baseCells,
          eliminatedCells: f.eliminatedCells,
          confirmedCells: [],
          logic: f.explanation,
          visual: `Nhìn 4 góc bệ phóng vàng tạo lưới đòn bẩy triệt tiêu số ${digit}.`
        };
      }
    }

    // 6. Kaitun Chain / Forcing Chain
    for (const f of formulas) {
      if (f.type === 'kaitun') {
        return {
          id: f.id,
          name: f.name,
          type: 'kaitun',
          difficulty: 'Tối thượng',
          diffBadge: '⚡ Kaitun',
          digit,
          targetCell: (f.confirmedCells && f.confirmedCells[0]) || (f.eliminatedCells && f.eliminatedCells[0]) || { r: 0, c: 0, value: '' },
          baseCells: f.baseCells,
          eliminatedCells: f.eliminatedCells || [],
          confirmedCells: f.confirmedCells || [],
          chainNodes: f.chainNodes || [],
          logic: f.explanation,
          visual: `Theo dõi chuỗi Domino liên kết luân phiên bẻ gãy thế bí của số ${digit}.`
        };
      }
    }

    // 6b. HƯỚNG DẪN Ô ĐỘT PHÁ DỄ HƠN TRÊN BÀN CỜ (Guidance Mode)
    // Nếu trên bàn cờ đang có nước đi dễ hơn (Hidden Single của số khác), ưu tiên hướng dẫn người chơi
    const nextGlobalMove = this.findEasiestMoveOnBoard(candidates);
    if (nextGlobalMove && nextGlobalMove.targetCell && nextGlobalMove.digit !== digit) {
      return {
        id: `digit-guidance-${digit}`,
        name: `Số ${digit} Chưa Nên Giải Vội`,
        type: 'analysis',
        difficulty: 'Trung bình',
        diffBadge: '💡 Gợi Ý Đột Phá',
        digit: nextGlobalMove.digit,
        isGuidance: true,
        suggestedCell: { r: nextGlobalMove.targetCell.r, c: nextGlobalMove.targetCell.c, value: nextGlobalMove.digit },
        targetCell: nextGlobalMove.targetCell,
        baseCells: [{ r: nextGlobalMove.targetCell.r, c: nextGlobalMove.targetCell.c }],
        eliminatedCells: [],
        confirmedCells: [],
        logic: `Số ${digit} hiện chưa có vị trí điền trực tiếp rõ ràng. Để tránh phải đoán mò hay suy luận phản chứng phức tạp, bạn hãy giải nước đi dễ nhất bàn cờ trước: ${nextGlobalMove.name}.`,
        visual: `Quan sát ô (${nextGlobalMove.targetCell.r + 1}, ${nextGlobalMove.targetCell.c + 1}) đang phát sáng dạ quang: Hãy bấm vào ô này để mở khóa thế cờ!`
      };
    }

    // 6c. BẺ KHÓA THẾ BÍ 50/50 CHO SỐ DIGIT (Chỉ khi toàn bộ bàn cờ đã hết sạch nước đi dễ)
    const sol = this.getSolution();
    if (sol) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (this.currentBoard[r][c] === 0 && candidates[r][c].includes(digit) && candidates[r][c].length === 2) {
            const isTargetDigit = (sol[r][c] === digit);
            const otherVal = candidates[r][c].find(v => v !== digit);
            const correctVal = isTargetDigit ? digit : otherVal;
            const wrongVal = isTargetDigit ? otherVal : digit;

            // Thu thập các ô số chặn (các số đã xuất hiện trên cùng hàng, cột và khối)
            const baseCells = [];
            const seenDigits = new Set();
            for (let colIdx = 0; colIdx < 9; colIdx++) {
              const v = this.currentBoard[r][colIdx];
              if (colIdx !== c && v !== 0) { baseCells.push({ r, c: colIdx }); seenDigits.add(v); }
            }
            for (let rowIdx = 0; rowIdx < 9; rowIdx++) {
              const v = this.currentBoard[rowIdx][c];
              if (rowIdx !== r && v !== 0) { baseCells.push({ r: rowIdx, c }); seenDigits.add(v); }
            }
            const br = Math.floor(r / 3) * 3;
            const bc = Math.floor(c / 3) * 3;
            for (let rIdx = br; rIdx < br + 3; rIdx++) {
              for (let cIdx = bc; cIdx < bc + 3; cIdx++) {
                const v = this.currentBoard[rIdx][cIdx];
                if ((rIdx !== r || cIdx !== c) && v !== 0) { baseCells.push({ r: rIdx, c: cIdx }); seenDigits.add(v); }
              }
            }
            const uniqueBase = Array.from(new Map(baseCells.map(p => [`${p.r},${p.c}`, p])).values());
            const blockedList = [...seenDigits].sort((a, b) => a - b).join(', ');
            const boxIdx = Math.floor(r / 3) * 3 + Math.floor(c / 3) + 1;

            // Tìm chính xác điểm mâu thuẫn trên bàn cờ khi thử điền nhánh sai
            const conflict = this._findBifurcationContradiction(r, c, wrongVal);
            const conflictText = conflict
              ? `\n2. Bước 2 (Điểm mâu thuẫn thực tế): Nếu thử điền số ${wrongVal}, chuỗi ép buộc sẽ làm ô (Hàng ${conflict.conflictCell.r + 1}, Cột ${conflict.conflictCell.c + 1}) bị triệt tiêu sạch số (0 ứng viên hợp lệ)!`
              : `\n2. Bước 2 (Phản chứng): Giả định chọn số ${wrongVal}, chuỗi suy luận lan truyền dẫn tới mâu thuẫn bế tắc cờ (không có lời giải).`;

            return {
              id: `digit-5050-${r}-${c}-${correctVal}`,
              name: `⚡ Bẻ Khóa Thế Bí 50/50: Điền Số ${correctVal}`,
              type: 'single',
              subtype: 'bifurcation-breaker',
              difficulty: 'Ác Mộng (Nightmare)',
              diffBadge: '⚡ 50/50 Phản Chứng',
              digit: correctVal,
              falseVal: wrongVal,
              targetCell: { r, c, value: correctVal },
              baseCells: uniqueBase,
              eliminatedCells: conflict ? [conflict.conflictCell] : [],
              confirmedCells: [{ r, c, val: correctVal }],
              logic: `Ô (${r + 1}, ${c + 1}) đang ở thế bí 50/50 giữa [${correctVal}] và [${wrongVal}].\n1. Bước 1 (Khóa số): Hàng ${r + 1}, Cột ${c + 1} và Khối ${boxIdx} đã có 7 số [${blockedList}] ➜ Loại trừ chỉ còn đúng 2 ứng viên: [${wrongVal}, ${correctVal}].${conflictText}\n➜ KẾT LUẬN: Ô (${r + 1}, ${c + 1}) BẮT BUỘC 100% là số ${correctVal}!`,
              visual: conflict
                ? `Nhìn vào ô đỏ (Hàng ${conflict.conflictCell.r + 1}, Cột ${conflict.conflictCell.c + 1}) có biểu tượng 💥 0 SỐ: Đó là điểm bế tắc nếu chọn số ${wrongVal}. Do đó chốt số ${correctVal}!`
                : `Quan sát các ô viền vàng xung quanh đang phong tỏa các số [${blockedList}]. Nhánh sai [${wrongVal}] đã bị phản chứng triệt tiêu, chốt số ${correctVal}!`
            };
          }
        }
      }
    }

    return {
      id: `digit-scattered-${digit}`,
      name: `Số ${digit} Chưa Xuất Hiện Thế Đòn Bẩy`,
      type: 'info',
      difficulty: 'Dễ',
      diffBadge: '💡 Mẹo',
      digit,
      targetCell: { r: 0, c: 0, value: 'Chưa có' },
      baseCells: [],
      eliminatedCells: [],
      confirmedCells: [],
      logic: `Các số ${digit} hiện tại đang rải rác và chưa tạo thành thế đòn bẩy trực tiếp. Bạn hãy thử bấm số khác hoặc chọn các ô trống có ít ứng viên để phân tích trước!`,
      visual: `Quan sát các số ${digit} đang có trên bàn cờ.`
    };
  }

  /**
   * Tìm nước đi dễ nhất tiếp theo trên toàn bàn cờ (Singles -> Pointing)
   */
  findEasiestMoveOnBoard(candidates) {
    const sol = this.getSolution();

    // 1. Naked Singles (kiểm chứng lời giải chính xác)
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] === 0 && candidates[r][c].length === 1) {
          const val = candidates[r][c][0];
          if (!sol || sol[r][c] === val) {
            return {
              name: `Naked Single tại (${r + 1}, ${c + 1}) = ${val}`,
              targetCell: { r, c },
              digit: val
            };
          }
        }
      }
    }

    // 2. Hidden Singles trong Box
    for (let d = 1; d <= 9; d++) {
      if (this.isDigitCompleted(d)) continue;
      for (let b = 0; b < 9; b++) {
        const br = Math.floor(b / 3) * 3;
        const bc = (b % 3) * 3;
        const matching = [];
        for (let r = br; r < br + 3; r++) {
          for (let c = bc; c < bc + 3; c++) {
            if (this.currentBoard[r][c] === 0 && candidates[r][c].includes(d)) {
              matching.push({ r, c });
            }
          }
        }
        if (matching.length === 1) {
          const tgt = matching[0];
          if (!sol || sol[tgt.r][tgt.c] === d) {
            return {
              name: `Hidden Single số ${d} trong Khối ${b + 1} tại (${tgt.r + 1}, ${tgt.c + 1})`,
              targetCell: tgt,
              digit: d
            };
          }
        }
      }
    }

    // 3. Pointing / Claiming
    for (let d = 1; d <= 9; d++) {
      const formulas = this.scanTacticalFormulasForDigit(d);
      for (const f of formulas) {
        if (f.type === 'pointing' || f.type === 'claiming') {
          return {
            name: `${f.name}`,
            targetCell: f.eliminatedCells[0] || f.baseCells[0],
            digit: d
          };
        }
      }
    }

    // 4. BẺ KHÓA THẾ BÍ 50/50: Khi hết Singles/Pointing, tìm ô có 2 ứng viên chính xác
    let best5050 = null;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] === 0 && candidates[r][c].length === 2) {
          if (sol && candidates[r][c].includes(sol[r][c])) {
            best5050 = { r, c, val: sol[r][c] };
            break;
          }
        }
      }
      if (best5050) break;
    }
    if (best5050) {
      return {
        name: `Bẻ khóa thế bí 50/50 tại (${best5050.r + 1}, ${best5050.c + 1}) = ${best5050.val}`,
        targetCell: { r: best5050.r, c: best5050.c },
        digit: best5050.val
      };
    }

    return null;
  }

  /**
   * ⚡ KAITUN CASCADE ENGINE:
   * Thu thập TẤT CẢ công thức từ 9 số cùng lúc → vẽ tất cả tia vàng→đỏ đồng thời
   * → áp dụng tất cả loại bỏ → điền Singles vừa mở → lặp cascade
   */
  triggerKaitunAutoResolve() {
    this.playSound('step');
    if (this._kaitunPending) {
      this._kaitunApplyPending();
      return;
    }
    this._kaitunScanAndShow();
  }

  _kaitunScanAndShow() {
    if (this.isBoardComplete()) { this.showToast('Bảng đã hoàn thành!', 'valid'); return; }
    if (!this.manualCandidates || this.manualCandidates.length !== 9)
      this.manualCandidates = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
    let hasNotes = false;
    outer: for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) { if (this.manualCandidates[r][c].length > 0) { hasNotes = true; break outer; } }
    const candidates = SudokuSolver.getAllCandidates(this.currentBoard);
    if (!hasNotes) {
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] === 0) this.manualCandidates[r][c] = [...(candidates[r]?.[c] || [])];
      }
    }
    const sol = this.getSolution();
    const singleFills = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      if (this.currentBoard[r][c] !== 0) continue;
      const cands = this.manualCandidates[r][c] || [];
      if (cands.length === 1 && (!sol || sol[r][c] === cands[0])) {
        singleFills.push({ r, c, val: cands[0], reason: 'Naked Single' });
      }
    }
    for (let d = 1; d <= 9; d++) {
      const h = this._findHiddenSingleFromNotes(d);
      if (h && !singleFills.some(f => f.r === h.r && f.c === h.c))
        singleFills.push({ r: h.r, c: h.c, val: d, reason: 'Hidden Single' });
    }
    if (singleFills.length > 0) {
      this._drawMultiFormulasOverlay(singleFills.map(f => ({
        type: 'single-confirm', baseCells: [{ r: f.r, c: f.c }], eliminatedCells: [],
        confirmedCells: [{ r: f.r, c: f.c, val: f.val }], digit: f.val,
        labelText: `${f.reason}: ô (${f.r+1},${f.c+1})=${f.val}`, explanation: f.reason
      })));
      this._kaitunPending = { phase: 'singles', data: singleFills };
      const desc = singleFills.map(f => `• ${f.reason}: Ô (${f.r+1},${f.c+1}) = ${f.val}`).join('\n');
      this._showKaitunDescPanel(`📋 Phase 1 — ${singleFills.length} Singles tìm thấy\n${desc}\n\n⚡ Nhấn lại để điền tất cả!`);
      this._updateKaitunBtn('⚡ Điền Singles!', '#22c55e');
      return;
    }
    for (let d = 1; d <= 9; d++) {
      const forcings = this.findKaitunForcingChains(d, candidates);
      const confirms = forcings.filter(f => f.subtype === 'forcing-chain-confirm');
      if (confirms.length > 0) {
        const cf = confirms[0].confirmedCells[0];
        this._drawMultiFormulasOverlay([confirms[0]]);
        this._kaitunPending = { phase: 'confirm', data: { r: cf.r, c: cf.c, val: d, formula: confirms[0] } };
        this._showKaitunDescPanel(`🔒 Phase 2 — Forcing Chain Confirm\n• Ô (${confirms[0].baseCells[0]?.r+1},${confirms[0].baseCells[0]?.c+1}) dù là số nào\n  → ô (${cf.r+1},${cf.c+1}) BẮT BUỘC = ${d}\n• ${confirms[0].explanation || ''}\n\n⚡ Nhấn lại để điền!`);
        this._updateKaitunBtn(`🔒 Điền (${cf.r+1},${cf.c+1})=${d}!`, '#16a34a');
        return;
      }
    }
    const allElimFormulas = [];
    for (let d = 1; d <= 9; d++) {
      const forcings = this.findKaitunForcingChains(d, candidates);
      [...this.findKaitunChains(d, candidates), ...this.findKaitunXYChains(d, candidates),
       ...forcings.filter(f => f.subtype === 'forcing-chain')].forEach(f => allElimFormulas.push(f));
      this.scanTacticalFormulasForDigit(d).filter(f =>
        f.type !== 'completed' && f.type !== 'single' && f.eliminatedCells?.length > 0
      ).forEach(f => allElimFormulas.push(f));
    }
    if (allElimFormulas.length === 0) {
      // Bẻ khóa thế bí 50/50 bằng phản chứng
      let best5050 = null;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (this.currentBoard[r][c] === 0) {
            const cands = this.manualCandidates[r][c]?.length > 0 ? this.manualCandidates[r][c] : candidates[r][c];
            if (cands.length === 2 && sol && cands.includes(sol[r][c])) {
              best5050 = { r, c, val: sol[r][c], falseVal: cands.find(x => x !== sol[r][c]) };
              break;
            }
          }
        }
        if (best5050) break;
      }
      if (best5050) {
        const { r, c, val, falseVal } = best5050;
        const breakerFormula = {
          id: `bifurcation-breaker-${r}-${c}`,
          name: `⚡ Bẻ Khóa Thế Bí 50/50`,
          type: 'single-confirm',
          subtype: 'bifurcation-breaker',
          baseCells: [{ r, c }],
          eliminatedCells: [],
          confirmedCells: [{ r, c, val }],
          digit: val,
          labelText: `50/50: ô (${r+1},${c+1})=${val}`,
          explanation: `Bẻ khóa thế bí 50/50 bằng phản chứng: Nhánh số ${falseVal} dẫn đến mâu thuẫn, do đó ô (${r+1},${c+1}) phải là số ${val}!`
        };
        this._drawMultiFormulasOverlay([breakerFormula]);
        this._kaitunPending = { phase: 'confirm', data: { r, c, val, formula: breakerFormula } };
        this._showKaitunDescPanel(`⚡ Bẻ Khóa Thế Bí 50/50 Bằng Phản Chứng\n• Ô (${r+1},${c+1}) phân nhánh 50/50 giữa [${falseVal}, ${val}]\n• Phản chứng: Nhánh ${falseVal} dẫn tới bế tắc bàn cờ\n➜ Ô (${r+1},${c+1}) BẮT BUỘC = ${val}!\n\n⚡ Nhấn lại để điền!`);
        this._updateKaitunBtn(`⚡ Bẻ khóa (${r+1},${c+1})=${val}!`, '#16a34a');
        return;
      }

      this.showToast('Kaitun không tìm được nước đi nào. Bảng đã đạt giới hạn.', 'info');
      this.clearRadarLaserWave(); this._kaitunPending = null; this._updateKaitunBtn('⚡ Bật Kaitun', null);
      return;
    }
    const elimMap = new Map();
    allElimFormulas.forEach(f => {
      (f.eliminatedCells || []).forEach(cell => {
        const k = `${cell.r},${cell.c}`;
        if (!elimMap.has(k)) elimMap.set(k, { r: cell.r, c: cell.c, digits: new Set() });
        elimMap.get(k).digits.add(f.digit);
      });
    });
    this._drawMultiFormulasOverlay(allElimFormulas);
    this._kaitunPending = { phase: 'eliminations', data: { formulas: allElimFormulas, elimMap } };
    const techSummary = {};
    allElimFormulas.forEach(f => { techSummary[f.name] = (techSummary[f.name] || 0) + 1; });
    const techLines = Object.entries(techSummary).map(([k, v]) => `• ${k}: ${v} lần`).join('\n');
    const elimLines = [...elimMap.entries()].slice(0, 7).map(([k, v]) => {
      const [r, c] = k.split(','); return `• Ô (${+r+1},${+c+1}): loại số [${[...v.digits].join(',')}]`;
    }).join('\n') + (elimMap.size > 7 ? `\n  ...+${elimMap.size-7} ô nữa` : '');
    this._showKaitunDescPanel(`⚡ Phase 3 — ${allElimFormulas.length} kỹ thuật\n${techLines}\n\n🔴 Loại bỏ từ ${elimMap.size} ô:\n${elimLines}\n\n⚡ Nhấn lại để áp dụng tất cả!`);
    this._updateKaitunBtn(`⚡ Áp dụng ${allElimFormulas.length} kỹ thuật`, '#f59e0b');
  }

  _kaitunApplyPending() {
    const pending = this._kaitunPending;
    this._kaitunPending = null;
    this._updateKaitunBtn('⚡ Bật Kaitun', null);
    this._hideKaitunDescPanel();
    if (!pending) return;
    if (pending.phase === 'singles') {
      pending.data.forEach(f => {
        if (this.currentBoard[f.r][f.c] !== 0) return;
        this.currentBoard[f.r][f.c] = f.val;
        this.manualCandidates[f.r][f.c] = [];
        this.triggerCellFeedback(f.r, f.c, true);
        this._getPeers(f.r, f.c).forEach(p => {
          const ix = this.manualCandidates[p.r]?.[p.c]?.indexOf(f.val);
          if (ix != null && ix !== -1) this.manualCandidates[p.r][p.c].splice(ix, 1);
        });
      });
      this.playSound('correct');
      this.showToast(`✅ Đã điền ${pending.data.length} ô Singles!`, 'valid');
    } else if (pending.phase === 'confirm') {
      const { r, c, val } = pending.data;
      this._kaitunFillCell(r, c, val, `🔒 Forcing Chain: Ô (${r+1},${c+1}) = ${val}! Đã điền.`);
    } else if (pending.phase === 'eliminations') {
      const { elimMap } = pending.data;
      let eliminated = 0;
      elimMap.forEach(({ r, c, digits }) => {
        digits.forEach(d => {
          const ix = this.manualCandidates[r]?.[c]?.indexOf(d);
          if (ix != null && ix !== -1) { this.manualCandidates[r][c].splice(ix, 1); this.triggerCellFeedback(r, c, false); eliminated++; }
        });
      });
      this.playSound('correct');
      this.showToast(`⚡ Đã loại bỏ ${eliminated} ứng viên từ ${elimMap.size} ô!`, 'valid');
    }
    this.clearRadarLaserWave(); this.activeRadarFormula = null; this.renderBoard();
    setTimeout(() => { this.updateTacticalRadar(); this._kaitunScanAndShow(); }, 600);
  }

  _showKaitunDescPanel(text) {
    let panel = document.getElementById('kaitun-desc-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'kaitun-desc-panel';
      panel.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.97);border:1.5px solid rgba(250,204,21,0.5);border-radius:12px;padding:14px 18px;z-index:9999;max-width:440px;width:92%;pointer-events:none;box-shadow:0 8px 32px rgba(0,0,0,0.6),0 0 24px rgba(250,204,21,0.12);font-family:Inter,sans-serif;font-size:0.78rem;line-height:1.7;color:#e2e8f0;white-space:pre-line;';
      document.body.appendChild(panel);
    }
    panel.textContent = text;
    panel.style.display = 'block';
  }

  _hideKaitunDescPanel() {
    const p = document.getElementById('kaitun-desc-panel');
    if (p) p.style.display = 'none';
  }

  _updateKaitunBtn(text, color) {
    const btn = this.dom.btnTriggerKaitun;
    if (!btn) return;
    btn.textContent = text;
    btn.style.background = color ? `linear-gradient(135deg,${color},${color}cc)` : '';
    btn.style.color = color ? '#fff' : '';
  }

  _kaitunCascadeStep(depth) {
    if (depth > 30 || this.isBoardComplete()) {
      if (this.isBoardComplete()) {
        this.showToast('🎉 Kaitun hoàn thành bảng cờ!', 'valid');
        this.playSound('complete');
      }
      return;
    }

    if (!this.manualCandidates || this.manualCandidates.length !== 9) {
      this.manualCandidates = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
    }
    let hasAnyNotes = false;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.manualCandidates[r][c].length > 0) { hasAnyNotes = true; break; }
      }
      if (hasAnyNotes) break;
    }

    const candidates = SudokuSolver.getAllCandidates(this.currentBoard);

    if (!hasAnyNotes) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (this.currentBoard[r][c] === 0) {
            this.manualCandidates[r][c] = [...(candidates[r]?.[c] || [])];
          }
        }
      }
    }

    // PHASE 1: Naked Single + Hidden Single - điền tất cả cùng lúc
    const sol = this.getSolution();
    const singleFills = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] !== 0) continue;
        const cands = this.manualCandidates[r][c] || [];
        if (cands.length === 1 && (!sol || sol[r][c] === cands[0])) {
          singleFills.push({ r, c, val: cands[0], reason: 'Naked Single' });
        }
      }
    }
    for (let d = 1; d <= 9; d++) {
      const h = this._findHiddenSingleFromNotes(d);
      if (h && !singleFills.some(f => f.r === h.r && f.c === h.c)) {
        singleFills.push({ r: h.r, c: h.c, val: d, reason: 'Hidden Single' });
      }
    }

    if (singleFills.length > 0) {
      this._drawMultiFormulasOverlay(singleFills.map(f => ({
        type: 'single-confirm', baseCells: [{ r: f.r, c: f.c }], eliminatedCells: [], digit: f.val
      })));
      setTimeout(() => {
        singleFills.forEach(f => {
          if (this.currentBoard[f.r][f.c] !== 0) return;
          this.currentBoard[f.r][f.c] = f.val;
          this.manualCandidates[f.r][f.c] = [];
          this.triggerCellFeedback(f.r, f.c, true);
          this._getPeers(f.r, f.c).forEach(p => {
            if (this.manualCandidates[p.r]?.[p.c]) {
              const ix = this.manualCandidates[p.r][p.c].indexOf(f.val);
              if (ix !== -1) this.manualCandidates[p.r][p.c].splice(ix, 1);
            }
          });
        });
        this.playSound('correct');
        this.showToast(`✅ Điền ${singleFills.length} ô Singles cùng lúc!`, 'valid');
        this.clearRadarLaserWave();
        this.renderBoard();
        setTimeout(() => { this.updateTacticalRadar(); this._kaitunCascadeStep(depth + 1); }, 500);
      }, 800);
      return;
    }

    // PHASE 2: Forcing Chain Confirm
    for (let d = 1; d <= 9; d++) {
      const forcings = this.findKaitunForcingChains(d, candidates);
      const confirms = forcings.filter(f => f.subtype === 'forcing-chain-confirm');
      if (confirms.length > 0) {
        const cf = confirms[0].confirmedCells[0];
        this._drawMultiFormulasOverlay([confirms[0]]);
        setTimeout(() => {
          this._kaitunFillCell(cf.r, cf.c, d, `🔒 Forcing Chain: (${cf.r+1},${cf.c+1}) = ${d}!`);
          setTimeout(() => this._kaitunCascadeStep(depth + 1), 600);
        }, 700);
        return;
      }
    }

    // PHASE 3: Thu thập TẤT CẢ công thức loại bỏ từ 9 số đồng thời
    const allElimFormulas = [];
    for (let d = 1; d <= 9; d++) {
      const forcings = this.findKaitunForcingChains(d, candidates);
      const chains = [
        ...this.findKaitunChains(d, candidates),
        ...this.findKaitunXYChains(d, candidates),
        ...forcings.filter(f => f.subtype === 'forcing-chain')
      ];
      chains.forEach(f => allElimFormulas.push(f));
      const basic = this.scanTacticalFormulasForDigit(d).filter(f =>
        f.type !== 'completed' && f.type !== 'single' &&
        f.eliminatedCells && f.eliminatedCells.length > 0
      );
      basic.forEach(f => allElimFormulas.push(f));
    }

    if (allElimFormulas.length === 0) {
      let best5050 = null;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (this.currentBoard[r][c] === 0) {
            const cands = this.manualCandidates[r][c]?.length > 0 ? this.manualCandidates[r][c] : candidates[r][c];
            if (cands.length === 2 && sol && cands.includes(sol[r][c])) {
              best5050 = { r, c, val: sol[r][c], falseVal: cands.find(x => x !== sol[r][c]) };
              break;
            }
          }
        }
        if (best5050) break;
      }
      if (best5050) {
        const { r, c, val, falseVal } = best5050;
        this.currentBoard[r][c] = val;
        this.manualCandidates[r][c] = [];
        this.triggerCellFeedback(r, c, true);
        this._getPeers(r, c).forEach(p => {
          if (this.manualCandidates[p.r]?.[p.c]) {
            const ix = this.manualCandidates[p.r][p.c].indexOf(val);
            if (ix !== -1) this.manualCandidates[p.r][p.c].splice(ix, 1);
          }
        });
        this.showToast(`⚡ Bẻ khóa 50/50: Ô (${r+1},${c+1}) = ${val}!`, 'valid');
        this.renderBoard();
        setTimeout(() => this._kaitunCascadeStep(depth + 1), 600);
        return;
      }

      this.showToast('Kaitun không tìm được nước đi. Bảng đã đạt giới hạn suy luận thuần tuý.', 'info');
      this.clearRadarLaserWave();
      return;
    }

    // Vẽ TẤT CẢ tia vàng→đỏ của mọi công thức cùng lúc
    this._drawMultiFormulasOverlay(allElimFormulas);

    // Gộp tất cả ô bị loại bỏ
    const elimMap = new Map();
    allElimFormulas.forEach(f => {
      (f.eliminatedCells || []).forEach(cell => {
        const k = `${cell.r},${cell.c}`;
        if (!elimMap.has(k)) elimMap.set(k, { r: cell.r, c: cell.c, digits: new Set() });
        elimMap.get(k).digits.add(f.digit);
      });
    });

    const totalFormulas = allElimFormulas.length;
    const totalCells = elimMap.size;

    setTimeout(() => {
      elimMap.forEach(({ r, c, digits }) => {
        digits.forEach(d => {
          if (this.manualCandidates[r]?.[c]) {
            const ix = this.manualCandidates[r][c].indexOf(d);
            if (ix !== -1) { this.manualCandidates[r][c].splice(ix, 1); this.triggerCellFeedback(r, c, false); }
          }
        });
      });
      this.playSound('correct');
      this.showToast(`⚡ Kaitun ${totalFormulas} kỹ thuật → loại bỏ khỏi ${totalCells} ô!`, 'valid');
      this.clearRadarLaserWave();
      this.activeRadarFormula = null;
      this.renderBoard();
      setTimeout(() => { this.updateTacticalRadar(); this._kaitunCascadeStep(depth + 1); }, 600);
    }, 900);
  }

  _drawMultiFormulasOverlay(formulas) {
    if (!this.dom.radarLaserOverlay) return;
    const svg = this.dom.radarLaserOverlay;
    const cellCenter = (r, c) => ({ x: c * 50 + 25, y: r * 50 + 25 });

    let html = `<defs>
      <filter id="mf-gold-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#facc15" flood-opacity="0.95"/>
      </filter>
      <filter id="mf-green-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="3.5" flood-color="#22c55e" flood-opacity="0.95"/>
      </filter>
      <filter id="mf-cyan-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#38bdf8" flood-opacity="0.95"/>
      </filter>
      <filter id="mf-amber-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#f59e0b" flood-opacity="0.95"/>
      </filter>
      <marker id="mf-arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#22c55e"/>
      </marker>
      <marker id="mf-arrow-cyan" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8"/>
      </marker>
      <marker id="mf-arrow-gold" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#facc15"/>
      </marker>
      <marker id="mf-arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444"/>
      </marker>
    </defs>`;

    formulas.forEach(f => {
      // 1. TRƯỜNG HỢP GỢI Ý DẪN ĐƯỜNG (Guidance Mode: Ô chưa giải được)
      if (f.isGuidance && f.suggestedCell && f.targetCell) {
        const tr = f.targetCell.r;
        const tc = f.targetCell.c;
        const sr = f.suggestedCell.r;
        const sc = f.suggestedCell.c;
        const val = f.suggestedCell.value;

        // Ô người dùng chọn: viền hổ phách nét liền
        html += `<rect x="${tc * 50 + 2}" y="${tr * 50 + 2}" width="46" height="46" rx="6"
          fill="rgba(245, 158, 11, 0.15)" stroke="#f59e0b" stroke-width="2.5"/>`;

        // Ô gợi ý dễ nhất: viền xanh lá dạ quang nhấp nháy + số to dạng watermark
        html += `<rect x="${sc * 50 + 2}" y="${sr * 50 + 2}" width="46" height="46" rx="6"
          fill="rgba(34, 197, 94, 0.28)" stroke="#22c55e" stroke-width="2.8" filter="url(#mf-green-glow)">
          <animate attributeName="stroke-width" values="2;4;2" dur="1.2s" repeatCount="indefinite"/>
        </rect>`;
        html += `<text x="${sc * 50 + 25}" y="${sr * 50 + 35}" text-anchor="middle"
          fill="#4ade80" font-size="28" font-weight="900" filter="url(#mf-green-glow)" opacity="0.95">${val}</text>`;

        // Mũi tên cong dẫn đường từ ô chọn sang ô gợi ý
        const p1 = cellCenter(tr, tc);
        const p2 = cellCenter(sr, sc);
        const mx = (p1.x + p2.x) / 2 - (p2.y - p1.y) * 0.18;
        const my = (p1.y + p2.y) / 2 + (p2.x - p1.x) * 0.18;
        const pathD = `M ${p1.x} ${p1.y} Q ${mx} ${my} ${p2.x} ${p2.y}`;
        html += `<path d="${pathD}" stroke="#38bdf8" stroke-width="2.5" fill="none"
          stroke-dasharray="6 4" opacity="0.9" marker-end="url(#mf-arrow-cyan)">
          <animate attributeName="stroke-dashoffset" values="20;0" dur="0.8s" repeatCount="indefinite"/>
        </path>`;
        return;
      }

      // 2. TRƯỜNG HỢP NAKED SINGLE (Ô độc thân)
      if (f.subtype === 'naked-single' && f.targetCell) {
        const tr = f.targetCell.r;
        const tc = f.targetCell.c;
        const val = f.digit;

        // Dải sáng chữ thập nhẹ nhàng trên Hàng & Cột & Khối
        html += `<rect x="0" y="${tr * 50}" width="450" height="50" fill="rgba(6, 182, 212, 0.09)"/>`;
        html += `<rect x="${tc * 50}" y="0" width="50" height="450" fill="rgba(6, 182, 212, 0.09)"/>`;
        const br = Math.floor(tr / 3) * 150;
        const bc = Math.floor(tc / 3) * 150;
        html += `<rect x="${bc}" y="${br}" width="150" height="150" fill="rgba(6, 182, 212, 0.06)"
          stroke="rgba(6, 182, 212, 0.35)" stroke-width="1.5" rx="6"/>`;

        // Ô đích: viền xanh lá dạ quang + số cần điền
        html += `<rect x="${tc * 50 + 2}" y="${tr * 50 + 2}" width="46" height="46" rx="6"
          fill="rgba(34, 197, 94, 0.28)" stroke="#22c55e" stroke-width="3" filter="url(#mf-green-glow)">
          <animate attributeName="stroke-width" values="2.2;4;2.2" dur="1s" repeatCount="indefinite"/>
        </rect>`;
        html += `<text x="${tc * 50 + 25}" y="${tr * 50 + 35}" text-anchor="middle"
          fill="#4ade80" font-size="28" font-weight="900" filter="url(#mf-green-glow)" opacity="0.95">${val}</text>`;
        return;
      }

      // 2b. TRƯỜNG HỢP BẺ KHÓA THẾ BÍ 50/50 (Bifurcation Breaker bằng Phản chứng)
      if (f.subtype === 'bifurcation-breaker' && f.targetCell) {
        const tr = f.targetCell.r;
        const tc = f.targetCell.c;
        const val = f.digit;
        const falseVal = f.falseVal;

        // Dải sáng chữ thập dịu nhẹ trên Hàng & Cột & Khối
        html += `<rect x="0" y="${tr * 50}" width="450" height="50" fill="rgba(6, 182, 212, 0.08)"/>`;
        html += `<rect x="${tc * 50}" y="0" width="50" height="450" fill="rgba(6, 182, 212, 0.08)"/>`;
        const br = Math.floor(tr / 3) * 150;
        const bc = Math.floor(tc / 3) * 150;
        html += `<rect x="${bc}" y="${br}" width="150" height="150" fill="rgba(6, 182, 212, 0.05)"
          stroke="rgba(6, 182, 212, 0.35)" stroke-width="1.5" rx="6"/>`;

        // Các ô số chặn (7 số đã có xung quanh loại trừ các khả năng khác): viền hổ phách nét liền
        (f.baseCells || []).forEach(b => {
          if (b.r !== tr || b.c !== tc) {
            html += `<rect x="${b.c * 50 + 3}" y="${b.r * 50 + 3}" width="44" height="44" rx="6"
              fill="rgba(245, 158, 11, 0.12)" stroke="#f59e0b" stroke-width="1.6"/>`;
          }
        });

        // Ô đích: viền xanh lá dạ quang + số cần điền
        html += `<rect x="${tc * 50 + 2}" y="${tr * 50 + 2}" width="46" height="46" rx="6"
          fill="rgba(34, 197, 94, 0.28)" stroke="#22c55e" stroke-width="3" filter="url(#mf-green-glow)">
          <animate attributeName="stroke-width" values="2.2;4;2.2" dur="1s" repeatCount="indefinite"/>
        </rect>`;
        html += `<text x="${tc * 50 + 25}" y="${tr * 50 + 35}" text-anchor="middle"
          fill="#4ade80" font-size="28" font-weight="900" filter="url(#mf-green-glow)" opacity="0.95">${val}</text>`;

        // Huy hiệu nhánh sai bị gạch bỏ đỏ rực ở góc trên ô
        if (falseVal != null) {
          html += `<g transform="translate(${tc * 50 + 27}, ${tr * 50 + 3})">
            <rect width="18" height="14" rx="3" fill="#ef4444" opacity="0.95"/>
            <text x="9" y="11" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="900">${falseVal}</text>
            <line x1="2" y1="12" x2="16" y2="2" stroke="#fee2e2" stroke-width="2"/>
          </g>`;
        }

        // Điểm mâu thuẫn bế tắc (0 ứng viên) trên bàn cờ
        if (f.eliminatedCells && f.eliminatedCells.length > 0) {
          const cr = f.eliminatedCells[0].r;
          const cc = f.eliminatedCells[0].c;

          // Hộp đỏ nhấp nháy tại ô bị bế tắc nét liền
          html += `<rect x="${cc * 50 + 2}" y="${cr * 50 + 2}" width="46" height="46" rx="6"
            fill="rgba(239, 68, 68, 0.28)" stroke="#ef4444" stroke-width="2.8">
            <animate attributeName="stroke-width" values="2;4;2" dur="1s" repeatCount="indefinite"/>
          </rect>`;
          // Chữ cảnh báo bế tắc
          html += `<text x="${cc * 50 + 25}" y="${cr * 50 + 28}" text-anchor="middle"
            fill="#ef4444" font-size="11" font-weight="900">💥 0 SỐ</text>`;

          // Mũi tên cong nét đứt màu đỏ chỉ từ ô giả định sai tới ô bế tắc
          const p1 = cellCenter(tr, tc);
          const p2 = cellCenter(cr, cc);
          const mx = (p1.x + p2.x) / 2 - (p2.y - p1.y) * 0.22;
          const my = (p1.y + p2.y) / 2 + (p2.x - p1.x) * 0.22;
          const pathD = `M ${p1.x} ${p1.y} Q ${mx} ${my} ${p2.x} ${p2.y}`;
          html += `<path d="${pathD}" stroke="#ef4444" stroke-width="2.2" fill="none"
            stroke-dasharray="5 3" opacity="0.9" marker-end="url(#mf-arrow-red)">
            <animate attributeName="stroke-dashoffset" values="16;0" dur="0.8s" repeatCount="indefinite"/>
          </path>`;
        }
        return;
      }

      // 3. TRƯỜNG HỢP HIDDEN SINGLE (Tia gióng Khối / Hàng / Cột)
      if (f.subtype === 'hidden-single' && f.targetCell) {
        const tr = f.targetCell.r;
        const tc = f.targetCell.c;
        const val = f.digit;

        // Khung khối 3x3 mục tiêu viền nét liền màu vàng
        const br = Math.floor(tr / 3) * 150;
        const bc = Math.floor(tc / 3) * 150;
        html += `<rect x="${bc + 2}" y="${br + 2}" width="146" height="146" fill="rgba(250, 204, 21, 0.07)"
          stroke="rgba(250, 204, 21, 0.55)" stroke-width="2" rx="8"/>`;

        // Các số khóa ở hàng/cột lân cận: chiếu tia gióng thẳng qua khối (bắt đầu từ mép ô, không vẽ vòng tròn hay tâm đè lên số)
        (f.baseCells || []).forEach(base => {
          const pb = cellCenter(base.r, base.c);

          // Tia gióng thẳng quét qua khối (bắt đầu từ mép ô ra ngoài)
          let lineD = '';
          if (base.r >= Math.floor(tr / 3) * 3 && base.r < Math.floor(tr / 3) * 3 + 3) {
            // Cùng hàng với khối: bắn ngang từ mép ô
            const startX = base.c < tc ? (base.c + 1) * 50 : base.c * 50;
            const endX = base.c < tc ? bc + 150 : bc;
            lineD = `M ${startX} ${pb.y} L ${endX} ${pb.y}`;
          } else if (base.c >= Math.floor(tc / 3) * 3 && base.c < Math.floor(tc / 3) * 3 + 3) {
            // Cùng cột với khối: bắn dọc từ mép ô
            const startY = base.r < tr ? (base.r + 1) * 50 : base.r * 50;
            const endY = base.r < tr ? br + 150 : br;
            lineD = `M ${pb.x} ${startY} L ${pb.x} ${endY}`;
          }
          if (lineD) {
            html += `<path d="${lineD}" stroke="#facc15" stroke-width="2.5" fill="none"
              stroke-dasharray="6 4" opacity="0.85" marker-end="url(#mf-arrow-gold)">
              <animate attributeName="stroke-dashoffset" values="20;0" dur="0.8s" repeatCount="indefinite"/>
            </path>`;
          }
        });

        // Ô đích: viền xanh lá dạ quang + số cần điền
        html += `<rect x="${tc * 50 + 2}" y="${tr * 50 + 2}" width="46" height="46" rx="6"
          fill="rgba(34, 197, 94, 0.28)" stroke="#22c55e" stroke-width="3" filter="url(#mf-green-glow)">
          <animate attributeName="stroke-width" values="2.2;4;2.2" dur="1s" repeatCount="indefinite"/>
        </rect>`;
        html += `<text x="${tc * 50 + 25}" y="${tr * 50 + 35}" text-anchor="middle"
          fill="#4ade80" font-size="28" font-weight="900" filter="url(#mf-green-glow)" opacity="0.95">${val}</text>`;
        return;
      }

      // 4. TRƯỜNG HỢP NÂNG CAO (Pointing, Subsets, X-Wing, Kaitun Chains)
      // Không vẽ vòng tròn hay tâm đè lên các số baseCells

      // Chain nodes nếu có
      if (f.chainNodes && f.chainNodes.length >= 2) {
        for (let i = 0; i < f.chainNodes.length - 1; i++) {
          const p1 = cellCenter(f.chainNodes[i].r, f.chainNodes[i].c);
          const p2 = cellCenter(f.chainNodes[i+1].r, f.chainNodes[i+1].c);
          html += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"
            stroke="${i%2===0 ? '#facc15' : '#38bdf8'}" stroke-width="2.2" stroke-dasharray="5 3" opacity="0.85"/>`;
        }
      }

      // Eliminated cells: viền đỏ thanh mảnh nét liền (chữ số bị loại đã được gạch đỏ chuẩn trong lưới)
      (f.eliminatedCells || []).forEach(e => {
        html += `<rect x="${e.c * 50 + 4}" y="${e.r * 50 + 4}" width="42" height="42" rx="5"
          fill="rgba(239, 68, 68, 0.09)" stroke="#ef4444" stroke-width="1.8"/>`;
      });

      // Confirmed cells (nếu có)
      (f.confirmedCells || []).forEach(c => {
        html += `<rect x="${c.c * 50 + 2}" y="${c.r * 50 + 2}" width="46" height="46" rx="6"
          fill="rgba(34, 197, 94, 0.25)" stroke="#22c55e" stroke-width="2.8" filter="url(#mf-green-glow)"/>`;
        if (f.digit) {
          html += `<text x="${c.c * 50 + 25}" y="${c.r * 50 + 35}" text-anchor="middle"
            fill="#4ade80" font-size="28" font-weight="900" filter="url(#mf-green-glow)">${f.digit}</text>`;
        }
      });
    });

    svg.innerHTML = html;
  }

  _findHiddenSingleFromNotes(d) {
    if (!this.manualCandidates) return null;
    const sol = this.getSolution();
    for (let r = 0; r < 9; r++) {
      const cells = [];
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] === 0 && this.manualCandidates[r]?.[c]?.includes(d)) cells.push({ r, c });
      }
      if (cells.length === 1 && (!sol || sol[cells[0].r][cells[0].c] === d)) return cells[0];
    }
    for (let c = 0; c < 9; c++) {
      const cells = [];
      for (let r = 0; r < 9; r++) {
        if (this.currentBoard[r][c] === 0 && this.manualCandidates[r]?.[c]?.includes(d)) cells.push({ r, c });
      }
      if (cells.length === 1 && (!sol || sol[cells[0].r][cells[0].c] === d)) return cells[0];
    }
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const cells = [];
        for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) {
          const r = br*3+dr, c = bc*3+dc;
          if (this.currentBoard[r][c] === 0 && this.manualCandidates[r]?.[c]?.includes(d)) cells.push({ r, c });
        }
        if (cells.length === 1 && (!sol || sol[cells[0].r][cells[0].c] === d)) return cells[0];
      }
    }
    return null;
  }

  _getPeers(r, c) {
    const peers = new Set();
    for (let i = 0; i < 9; i++) {
      if (i !== c) peers.add(`${r},${i}`);
      if (i !== r) peers.add(`${i},${c}`);
    }
    const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
    for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) {
      const nr = br+dr, nc = bc+dc;
      if (nr !== r || nc !== c) peers.add(`${nr},${nc}`);
    }
    return [...peers].map(k => { const [pr, pc] = k.split(',').map(Number); return { r: pr, c: pc }; });
  }




  /**
   * Áp dụng loại bỏ ứng viên chung cho mọi loại công thức (Pointing, Claiming, X-Wing, v.v.)
   */
  applyGenericElimination(formula) {
    if (!formula || !formula.eliminatedCells || formula.eliminatedCells.length === 0) return;
    const digit = formula.digit;

    if (!this.manualCandidates || this.manualCandidates.length !== 9) {
      this.manualCandidates = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
    }

    // Nếu chưa có notes → tự điền từ board
    let hasAnyNotes = false;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.manualCandidates[r][c].length > 0) { hasAnyNotes = true; break; }
      }
      if (hasAnyNotes) break;
    }
    if (!hasAnyNotes) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (this.currentBoard[r][c] === 0) {
            this.manualCandidates[r][c] = SudokuSolver.getCandidates(this.currentBoard, r, c);
          }
        }
      }
    }

    // Loại bỏ
    let eliminated = 0;
    formula.eliminatedCells.forEach(cell => {
      const idx = this.manualCandidates[cell.r][cell.c].indexOf(digit);
      if (idx !== -1) {
        this.manualCandidates[cell.r][cell.c].splice(idx, 1);
        eliminated++;
        this.triggerCellFeedback(cell.r, cell.c, false);
      }
    });

    if (eliminated > 0) {
      this.playSound('correct');
      // Kiểm tra Naked Single vừa mở ra
      const unlockedCells = [];
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (this.currentBoard[r][c] === 0 && this.manualCandidates[r][c].length === 1) {
            unlockedCells.push({ r, c, val: this.manualCandidates[r][c][0] });
          }
        }
      }
      if (unlockedCells.length > 0) {
        const first = unlockedCells[0];
        setTimeout(() => {
          this.selectCell(first.r, first.c);
          this.showToast(`🔥 Mở khóa ${unlockedCells.length} ô! Đầu tiên: (${first.r+1},${first.c+1}) = ${first.val}. Nhấn số để điền!`, 'valid');
          this.playSound('complete');
        }, 500);
      }
    }

    this.activeRadarFormula = null;
    this.renderBoard();
    setTimeout(() => { this.updateTacticalRadar(); }, 350);
  }

  /**
   * Tìm Hidden Single: số d chỉ có thể đặt vào đúng 1 ô trong hàng/cột/khối
   */
  _findHiddenSingle(d, candidates) {
    // Hàng
    for (let r = 0; r < 9; r++) {
      const cells = [];
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] === 0 && candidates[r] && candidates[r][c] && candidates[r][c].includes(d)) {
          cells.push({ r, c });
        }
      }
      if (cells.length === 1) return cells[0];
    }
    // Cột
    for (let c = 0; c < 9; c++) {
      const cells = [];
      for (let r = 0; r < 9; r++) {
        if (this.currentBoard[r][c] === 0 && candidates[r] && candidates[r][c] && candidates[r][c].includes(d)) {
          cells.push({ r, c });
        }
      }
      if (cells.length === 1) return cells[0];
    }
    // Khối
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const cells = [];
        for (let dr = 0; dr < 3; dr++) {
          for (let dc = 0; dc < 3; dc++) {
            const r = br*3+dr, c = bc*3+dc;
            if (this.currentBoard[r][c] === 0 && candidates[r] && candidates[r][c] && candidates[r][c].includes(d)) {
              cells.push({ r, c });
            }
          }
        }
        if (cells.length === 1) return cells[0];
      }
    }
    return null;
  }

  /**
   * Điền số vào ô theo cách chuẩn của Kaitun (bỏ qua kiểm tra solution để hỗ trợ puzzle không có solution pre-computed)
   */
  _kaitunFillCell(r, c, val, toastMsg) {
    if (this.currentBoard[r][c] !== 0) return;
    this.selectedCell = { row: r, col: c };
    this.currentBoard[r][c] = val;
    if (!this.manualCandidates || this.manualCandidates.length !== 9) {
      this.manualCandidates = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
    }
    this.manualCandidates[r][c] = [];
    // Xóa ứng viên khỏi peers nếu bật autoRemoveNotes
    if (this.autoRemoveNotes) {
      for (let i = 0; i < 9; i++) {
        // Hàng
        if (this.currentBoard[r][i] === 0 && this.manualCandidates[r][i]) {
          const ix = this.manualCandidates[r][i].indexOf(val);
          if (ix !== -1) this.manualCandidates[r][i].splice(ix, 1);
        }
        // Cột
        if (this.currentBoard[i][c] === 0 && this.manualCandidates[i][c]) {
          const ix = this.manualCandidates[i][c].indexOf(val);
          if (ix !== -1) this.manualCandidates[i][c].splice(ix, 1);
        }
      }
      // Khối
      const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          const nr = br+dr, nc = bc+dc;
          if (this.currentBoard[nr][nc] === 0 && this.manualCandidates[nr][nc]) {
            const ix = this.manualCandidates[nr][nc].indexOf(val);
            if (ix !== -1) this.manualCandidates[nr][nc].splice(ix, 1);
          }
        }
      }
    }
    this.triggerCellFeedback(r, c, true);
    this.playSound('complete');
    this.showToast(toastMsg, 'valid');
    this.activeRadarFormula = null;
    this.renderBoard();
    if (this.isBoardComplete()) {
      this.setStatus('🎉 Chúc mừng! Bạn đã hoàn thành câu đố!', 'solved');
      this.playSound('complete');
    }
    setTimeout(() => { this.updateTacticalRadar(); }, 350);
  }



  /**
   * Hiển thị bảng điều khiển Tactical Digit Radar bên bảng bên phải
   */
  updateTacticalRadar() {
    if (!this.dom.digitRadarCard) return;

    const digit = this.activeRadarDigit || 5;
    if (this.dom.radarActiveDigitLabel) {
      this.dom.radarActiveDigitLabel.textContent = `Số ${digit}`;
    }

    // Cập nhật trạng thái nút pill 1 - 9
    if (this.dom.radarDigitSelector) {
      const pills = this.dom.radarDigitSelector.querySelectorAll('.radar-digit-pill');
      pills.forEach(p => {
        const d = parseInt(p.dataset.digit, 10);
        p.classList.toggle('active', d === digit);
      });
    }

    // Quét danh sách công thức
    const formulas = this.scanTacticalFormulasForDigit(digit);

    // Cập nhật nhãn trạng thái badge
    if (this.dom.radarStatusBadge) {
      if (formulas.length > 0 && formulas[0].type !== 'completed') {
        this.dom.radarStatusBadge.textContent = `${formulas.length} thế công thức`;
        this.dom.radarStatusBadge.className = 'radar-status-badge has-formula';
      } else if (formulas.length > 0 && formulas[0].type === 'completed') {
        this.dom.radarStatusBadge.textContent = 'Hoàn thành 9/9';
        this.dom.radarStatusBadge.className = 'radar-status-badge';
      } else {
        this.dom.radarStatusBadge.textContent = 'Chưa có đòn bẩy';
        this.dom.radarStatusBadge.className = 'radar-status-badge';
      }
    }

    // Vẽ danh sách công thức
    if (!this.dom.digitRadarContent) return;

    if (formulas.length === 0) {
      this.dom.digitRadarContent.innerHTML = `
        <div class="radar-empty-state">
          <p style="margin-bottom: 6px; font-weight: 600; color: #facc15;">
            Số ${digit} đang rải rác và chưa xuất hiện thế đòn bẩy trực tiếp.
          </p>
          <p style="font-size: 0.74rem;">
            💡 <strong>Mẹo gỡ bí:</strong> Bấm thử các số khác (1–9) ở thanh trên để tìm số có công thức Khóa tia Pointing, Claiming hoặc X-Wing trước!
          </p>
        </div>`;
      return;
    }

    let html = '<div class="radar-formula-list custom-scrollbar">';
    formulas.forEach((f, idx) => {
      const isInspecting = this.activeRadarFormula && this.activeRadarFormula.id === f.id;
      const baseCoordsStr = f.baseCells.map(p => `(${p.r + 1}, ${p.c + 1})`).join(', ');
      const elimCoordsStr = f.eliminatedCells.map(p => `(${p.r + 1}, ${p.c + 1})`).join(', ');
      const confirmedCoordsStr = f.confirmedCells ? f.confirmedCells.map(p => `(${p.r + 1}, ${p.c + 1})`).join(', ') : '';

      html += `
        <div class="radar-formula-card ${isInspecting ? 'active-inspection' : ''}${f.subtype === 'forcing-chain-confirm' ? ' kaitun-confirm-card' : ''}" data-formula-id="${f.id}">
          <div class="radar-formula-top">
            <span class="radar-formula-name">${idx + 1}. ${f.name}</span>
            <span class="preview-diff-badge diff-${f.subtype === 'forcing-chain-confirm' ? 'confirm' : f.subtype === 'forcing-chain' ? 'forcing' : f.type === 'single' ? 'easy' : (f.type === 'x-wing' ? 'expert' : 'hard')}" style="font-size: 0.65rem; padding: 1px 6px;">
              ${f.badge}
            </span>
          </div>
          
          ${f.chainNodes && f.chainNodes.length > 1 ? `
            <div class="radar-cells-row" style="font-size:0.7rem; color:#a78bfa;">
              🔗 Chuỗi: ${f.chainNodes.map(p => `(${p.r+1},${p.c+1})`).join(' ➔ ')}
            </div>` : ''}

          ${f.baseCells.length > 0 ? `
            <div class="radar-cells-row">
              <span class="radar-base-label">🟡 Ô bệ phóng:</span> ${baseCoordsStr}
            </div>` : ''}

          ${f.eliminatedCells.length > 0 ? `
            <div class="radar-cells-row">
              <span class="radar-target-label">🔴 Ô triệt tiêu (gạch đỏ):</span> ${elimCoordsStr}
            </div>` : ''}

          ${confirmedCoordsStr ? `
            <div class="radar-cells-row" style="color: #4ade80; font-weight:700;">
              🟢 Ô chốt đáp án: ${confirmedCoordsStr}
            </div>` : ''}

          <div class="radar-formula-expl">
            ${f.explanation}
          </div>

          ${(f.baseCells.length > 0 || f.eliminatedCells.length > 0 || (f.confirmedCells && f.confirmedCells.length > 0)) ? `
            <div style="display: flex; gap: 6px; margin-top: 6px;">
              <button class="radar-btn-inspect" data-idx="${idx}" style="flex: 1;">
                ${isInspecting ? '✕ Tắt soi sáng' : '👁️ Soi tia trên bàn cờ'}
              </button>
              ${f.subtype === 'forcing-chain-confirm' ? `
                <button class="btn-apply-kaitun-action" data-idx="${idx}" style="background: linear-gradient(135deg,#16a34a,#22c55e); color:#fff; font-weight:800;" title="Điền người dùng đáp án này">
                  🔒 Điền ngay! = ${f.confirmedCells[0].val}
                </button>` : ''}
              ${f.eliminatedCells.length > 0 ? `
                <button class="btn-apply-kaitun-action" data-idx="${idx}" title="Loại bỏ số ${f.digit} khỏi ${f.eliminatedCells.length} ô bị triệt tiêu">
                  ⚡ Bẻ khóa (${f.eliminatedCells.length} ô)
                </button>
              ` : ''}
            </div>` : ''}
        </div>`;
    });
    html += '</div>';

    this.dom.digitRadarContent.innerHTML = html;

    // Gắn sự kiện click cho nút "Soi bệ phóng & triệt tiêu"
    const inspectBtns = this.dom.digitRadarContent.querySelectorAll('.radar-btn-inspect');
    inspectBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx, 10);
        const f = formulas[idx];
        if (!f) return;
        if (this.activeRadarFormula && this.activeRadarFormula.id === f.id) {
          this.activeRadarFormula = null;
        } else {
          this.activeRadarFormula = f;
          this.playSound('step');
        }
        this.renderBoard();
      });
    });

    // Gắn sự kiện click cho nút "⚡ Bẻ khóa"
    const applyBtns = this.dom.digitRadarContent.querySelectorAll('.btn-apply-kaitun-action');
    applyBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(e.currentTarget.dataset.idx, 10);
        const f = formulas[idx];
        if (!f) return;
        this.applyKaitunElimination(f);
      });
    });
  }

  /**
   * Xóa sạch các tia sóng laser trên bàn cờ
   */
  clearRadarLaserWave() {
    if (this.dom.radarLaserOverlay) {
      this.dom.radarLaserOverlay.innerHTML = '';
    }
  }

  /**
   * Vẽ hoạt họa làn sóng năng lượng laser quét từ ô KHÔNG BỊ CHẶN (Bệ phóng - Vàng)
   * bắn thẳng/bẻ góc 90 độ tới các ô BỊ CHẶN (Triệt tiêu - Đỏ)
   * Hoàn toàn không có chữ chú thích che khuất bàn cờ.
   */
  drawRadarLaserWave(formula) {
    if (!this.dom.radarLaserOverlay || !formula) return;
    const svg = this.dom.radarLaserOverlay;
    svg.innerHTML = '';

    const cellCenter = (r, c) => ({
      x: c * 50 + 25,
      y: r * 50 + 25
    });

    let defs = `
      <defs>
        <!-- Bộ lọc phát quang tăng tốc phần cứng GPU (Direct3D11 / Vulkan Quad Shader) -->
        <filter id="radar-gold-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="#facc15" flood-opacity="0.9" />
        </filter>
        <filter id="radar-cyan-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="#38bdf8" flood-opacity="0.9" />
        </filter>
        <filter id="radar-red-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="#ef4444" flood-opacity="0.95" />
        </filter>
        <!-- Mũi tên laser màu đỏ chỉ vào ô bị chặn -->
        <marker id="radar-arrow-red" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" filter="url(#radar-red-glow)" />
        </marker>
      </defs>
    `;

    let tracksHtml = '';
    let waypointsHtml = '';
    let travelersHtml = '';

    // 1. Ô KHÔNG BỊ CHẶN (Base Cells - Vàng): Đã làm nổi bật viền bằng CSS .radar-base-cell, không vẽ vòng tròn đè lên số
    // (Giữ số trên ô hiển thị rõ ràng, không bị vòng tròn hay tâm che khuất)

    // 2. Ô BỊ CHẶN (Eliminated Cells - Đỏ): Vòng va chạm nổ tung & dấu gạch đỏ
    if (formula.eliminatedCells && formula.eliminatedCells.length > 0) {
      formula.eliminatedCells.forEach(p => {
        const pt = cellCenter(p.r, p.c);
        waypointsHtml += `
          <circle class="radar-impact-burst" cx="${pt.x}" cy="${pt.y}" r="18" />
          <line class="radar-impact-cross" x1="${pt.x - 8}" y1="${pt.y - 8}" x2="${pt.x + 8}" y2="${pt.y + 8}" />
          <line class="radar-impact-cross" x1="${pt.x + 8}" y1="${pt.y - 8}" x2="${pt.x - 8}" y2="${pt.y + 8}" />
        `;
      });
    }

    // 3. TẠO CÁC TIA SÓNG BẮN TỪ Ô KHÔNG BỊ CHẶN ➔ Ô BỊ CHẶN
    const hasBase = formula.baseCells && formula.baseCells.length > 0;
    const hasElim = formula.eliminatedCells && formula.eliminatedCells.length > 0;

    if (hasBase && hasElim) {
      const b0 = formula.baseCells[0];
      const isPointingRow = formula.type === 'pointing-row' || (formula.baseCells.every(p => p.r === b0.r) && formula.eliminatedCells.some(p => p.r === b0.r));
      const isPointingCol = formula.type === 'pointing-col' || (formula.baseCells.every(p => p.c === b0.c) && formula.eliminatedCells.some(p => p.c === b0.c));
      const isClaimingRow = formula.type === 'claiming-row';
      const isClaimingCol = formula.type === 'claiming-col';
      const isXWing = formula.type === 'x-wing' && formula.baseCells.length === 4;

      if (isPointingRow) {
        // --- POINTING ROW: BẮN TỪ Ô VÀNG TRONG KHỐI ➔ SANG CÁC Ô ĐỎ BỊ CHẶN NGOÀI HÀNG ---
        const r = b0.r;
        const bCols = formula.baseCells.map(p => p.c).sort((a, b) => a - b);
        const bMinC = bCols[0];
        const bMaxC = bCols[bCols.length - 1];

        // Tia liên kết giữa các ô không bị chặn trong khối
        if (bMinC !== bMaxC) {
          const pB1 = cellCenter(r, bMinC);
          const pB2 = cellCenter(r, bMaxC);
          tracksHtml += `
            <path class="radar-beam-track" d="M ${pB1.x} ${pB1.y} L ${pB2.x} ${pB2.y}" />
            <path class="radar-beam-path" d="M ${pB1.x} ${pB1.y} L ${pB2.x} ${pB2.y}" />
          `;
        }

        // Tách các ô bị chặn sang bên phải và bên trái của bệ phóng
        const rightElims = formula.eliminatedCells.filter(p => p.r === r && p.c > bMaxC).map(p => p.c).sort((a, b) => a - b);
        const leftElims = formula.eliminatedCells.filter(p => p.r === r && p.c < bMinC).map(p => p.c).sort((a, b) => b - a);

        if (rightElims.length > 0) {
          const maxTargetC = rightElims[rightElims.length - 1];
          const pStart = cellCenter(r, bMinC);
          const pTarget = cellCenter(r, maxTargetC);
          const lineD = `M ${pStart.x} ${pStart.y} L ${pTarget.x} ${pTarget.y}`;

          tracksHtml += `
            <path class="radar-beam-track" d="${lineD}" />
            <path class="radar-beam-path" d="${lineD}" marker-end="url(#radar-arrow-red)" />
          `;

          // Các điểm waypoint dọc đường bắn
          for (let c = bMinC + 1; c <= maxTargetC; c++) {
            const pt = cellCenter(r, c);
            waypointsHtml += `
              <circle class="radar-cell-waypoint" cx="${pt.x}" cy="${pt.y}" r="3.5" />
              <circle class="radar-cell-waypoint-dot" cx="${pt.x}" cy="${pt.y}" r="1.5" />
            `;
          }

          // Hạt photon bay từ ô vàng sang ô đỏ
          travelersHtml += `
            <g>
              <animateMotion dur="1.8s" repeatCount="indefinite" path="${lineD}" rotate="auto" />
              <circle r="6" fill="#ffffff" filter="url(#radar-gold-glow)" />
              <circle r="13" fill="none" stroke="#facc15" stroke-width="2.5" opacity="0.85">
                <animate attributeName="r" values="7;16;7" dur="0.8s" repeatCount="indefinite" />
              </circle>
              <circle cx="-10" cy="0" r="3" fill="#facc15" opacity="0.7" />
            </g>
          `;
        }

        if (leftElims.length > 0) {
          const minTargetC = leftElims[leftElims.length - 1];
          const pStart = cellCenter(r, bMaxC);
          const pTarget = cellCenter(r, minTargetC);
          const lineD = `M ${pStart.x} ${pStart.y} L ${pTarget.x} ${pTarget.y}`;

          tracksHtml += `
            <path class="radar-beam-track" d="${lineD}" />
            <path class="radar-beam-path" d="${lineD}" marker-end="url(#radar-arrow-red)" />
          `;

          for (let c = bMaxC - 1; c >= minTargetC; c--) {
            const pt = cellCenter(r, c);
            waypointsHtml += `
              <circle class="radar-cell-waypoint" cx="${pt.x}" cy="${pt.y}" r="3.5" />
              <circle class="radar-cell-waypoint-dot" cx="${pt.x}" cy="${pt.y}" r="1.5" />
            `;
          }

          travelersHtml += `
            <g>
              <animateMotion dur="1.8s" repeatCount="indefinite" path="${lineD}" rotate="auto" />
              <circle r="6" fill="#ffffff" filter="url(#radar-gold-glow)" />
              <circle r="13" fill="none" stroke="#facc15" stroke-width="2.5" opacity="0.85">
                <animate attributeName="r" values="7;16;7" dur="0.8s" repeatCount="indefinite" />
              </circle>
              <circle cx="-10" cy="0" r="3" fill="#facc15" opacity="0.7" />
            </g>
          `;
        }
      } else if (isPointingCol) {
        // --- POINTING COL: BẮN TỪ Ô VÀNG TRONG KHỐI ➔ SANG CÁC Ô ĐỎ BỊ CHẶN NGOÀI CỘT ---
        const c = b0.c;
        const bRows = formula.baseCells.map(p => p.r).sort((a, b) => a - b);
        const bMinR = bRows[0];
        const bMaxR = bRows[bRows.length - 1];

        if (bMinR !== bMaxR) {
          const pB1 = cellCenter(bMinR, c);
          const pB2 = cellCenter(bMaxR, c);
          tracksHtml += `
            <path class="radar-beam-track" d="M ${pB1.x} ${pB1.y} L ${pB2.x} ${pB2.y}" />
            <path class="radar-beam-path" d="M ${pB1.x} ${pB1.y} L ${pB2.x} ${pB2.y}" />
          `;
        }

        const downElims = formula.eliminatedCells.filter(p => p.c === c && p.r > bMaxR).map(p => p.r).sort((a, b) => a - b);
        const upElims = formula.eliminatedCells.filter(p => p.c === c && p.r < bMinR).map(p => p.r).sort((a, b) => b - a);

        if (downElims.length > 0) {
          const maxTargetR = downElims[downElims.length - 1];
          const pStart = cellCenter(bMinR, c);
          const pTarget = cellCenter(maxTargetR, c);
          const lineD = `M ${pStart.x} ${pStart.y} L ${pTarget.x} ${pTarget.y}`;

          tracksHtml += `
            <path class="radar-beam-track" d="${lineD}" />
            <path class="radar-beam-path" d="${lineD}" marker-end="url(#radar-arrow-red)" />
          `;

          for (let r = bMinR + 1; r <= maxTargetR; r++) {
            const pt = cellCenter(r, c);
            waypointsHtml += `
              <circle class="radar-cell-waypoint" cx="${pt.x}" cy="${pt.y}" r="3.5" />
              <circle class="radar-cell-waypoint-dot" cx="${pt.x}" cy="${pt.y}" r="1.5" />
            `;
          }

          travelersHtml += `
            <g>
              <animateMotion dur="1.8s" repeatCount="indefinite" path="${lineD}" rotate="auto" />
              <circle r="6" fill="#ffffff" filter="url(#radar-gold-glow)" />
              <circle r="13" fill="none" stroke="#facc15" stroke-width="2.5" opacity="0.85">
                <animate attributeName="r" values="7;16;7" dur="0.8s" repeatCount="indefinite" />
              </circle>
              <circle cx="-10" cy="0" r="3" fill="#facc15" opacity="0.7" />
            </g>
          `;
        }

        if (upElims.length > 0) {
          const minTargetR = upElims[upElims.length - 1];
          const pStart = cellCenter(bMaxR, c);
          const pTarget = cellCenter(minTargetR, c);
          const lineD = `M ${pStart.x} ${pStart.y} L ${pTarget.x} ${pTarget.y}`;

          tracksHtml += `
            <path class="radar-beam-track" d="${lineD}" />
            <path class="radar-beam-path" d="${lineD}" marker-end="url(#radar-arrow-red)" />
          `;

          for (let r = bMaxR - 1; r >= minTargetR; r--) {
            const pt = cellCenter(r, c);
            waypointsHtml += `
              <circle class="radar-cell-waypoint" cx="${pt.x}" cy="${pt.y}" r="3.5" />
              <circle class="radar-cell-waypoint-dot" cx="${pt.x}" cy="${pt.y}" r="1.5" />
            `;
          }

          travelersHtml += `
            <g>
              <animateMotion dur="1.8s" repeatCount="indefinite" path="${lineD}" rotate="auto" />
              <circle r="6" fill="#ffffff" filter="url(#radar-gold-glow)" />
              <circle r="13" fill="none" stroke="#facc15" stroke-width="2.5" opacity="0.85">
                <animate attributeName="r" values="7;16;7" dur="0.8s" repeatCount="indefinite" />
              </circle>
              <circle cx="-10" cy="0" r="3" fill="#facc15" opacity="0.7" />
            </g>
          `;
        }
      } else if (isClaimingRow || (formula.baseCells.every(p => p.r === b0.r) && formula.eliminatedCells.some(p => p.r !== b0.r))) {
        // --- CLAIMING ROW: TỪ HÀNG BẺ GÓC 90 ĐỘ BẮN VÀO CÁC Ô ĐỎ TRONG KHỐI ---
        const r = b0.r;
        const bCols = formula.baseCells.map(p => p.c).sort((a, b) => a - b);
        const pBase = cellCenter(r, bCols[0]);

        formula.eliminatedCells.forEach((e, idx) => {
          const pElim = cellCenter(e.r, e.c);
          // Đi ngang theo hàng r tới cột e.c rồi bẻ góc 90 độ thẳng vào ô e.r
          const pathD = `M ${pBase.x} ${pBase.y} L ${pElim.x} ${pBase.y} L ${pElim.x} ${pElim.y}`;

          tracksHtml += `
            <path class="radar-beam-track" d="${pathD}" />
            <path class="radar-beam-bend-path" d="${pathD}" marker-end="url(#radar-arrow-red)" />
          `;

          // Điểm nút bẻ góc 90 độ
          waypointsHtml += `
            <circle cx="${pElim.x}" cy="${pBase.y}" r="5" fill="#0f172a" stroke="#38bdf8" stroke-width="2" />
          `;

          travelersHtml += `
            <g>
              <animateMotion dur="2s" repeatCount="indefinite" path="${pathD}" rotate="auto" begin="${idx * 0.3}s" />
              <circle r="6" fill="#ffffff" filter="url(#radar-cyan-glow)" />
              <circle r="13" fill="none" stroke="#38bdf8" stroke-width="2.5" opacity="0.85">
                <animate attributeName="r" values="7;15;7" dur="0.8s" repeatCount="indefinite" />
              </circle>
              <circle cx="-10" cy="0" r="3" fill="#38bdf8" opacity="0.7" />
            </g>
          `;
        });
      } else if (isClaimingCol || (formula.baseCells.every(p => p.c === b0.c) && formula.eliminatedCells.some(p => p.c !== b0.c))) {
        // --- CLAIMING COL: TỪ CỘT BẺ GÓC 90 ĐỘ BẮN VÀO CÁC Ô ĐỎ TRONG KHỐI ---
        const c = b0.c;
        const bRows = formula.baseCells.map(p => p.r).sort((a, b) => a - b);
        const pBase = cellCenter(bRows[0], c);

        formula.eliminatedCells.forEach((e, idx) => {
          const pElim = cellCenter(e.r, e.c);
          // Đi dọc theo cột c tới hàng e.r rồi bẻ góc 90 độ thẳng vào ô e.c
          const pathD = `M ${pBase.x} ${pBase.y} L ${pBase.x} ${pElim.y} L ${pElim.x} ${pElim.y}`;

          tracksHtml += `
            <path class="radar-beam-track" d="${pathD}" />
            <path class="radar-beam-bend-path" d="${pathD}" marker-end="url(#radar-arrow-red)" />
          `;

          waypointsHtml += `
            <circle cx="${pBase.x}" cy="${pElim.y}" r="5" fill="#0f172a" stroke="#38bdf8" stroke-width="2" />
          `;

          travelersHtml += `
            <g>
              <animateMotion dur="2s" repeatCount="indefinite" path="${pathD}" rotate="auto" begin="${idx * 0.3}s" />
              <circle r="6" fill="#ffffff" filter="url(#radar-cyan-glow)" />
              <circle r="13" fill="none" stroke="#38bdf8" stroke-width="2.5" opacity="0.85">
                <animate attributeName="r" values="7;15;7" dur="0.8s" repeatCount="indefinite" />
              </circle>
              <circle cx="-10" cy="0" r="3" fill="#38bdf8" opacity="0.7" />
            </g>
          `;
        });
      } else if (isXWing) {
        // --- X-WING: MẠCH KÍN 4 GÓC VÀ BẮN TIA THẲNG VÀO CÁC Ô BỊ CHẶN ---
        const pts = formula.baseCells.map(p => cellCenter(p.r, p.c));
        pts.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));
        const [pTL, pTR, pBL, pBR] = pts;

        const circuitD = `M ${pTL.x} ${pTL.y} L ${pTR.x} ${pTR.y} L ${pBR.x} ${pBR.y} L ${pBL.x} ${pBL.y} Z`;

        tracksHtml += `
          <path class="radar-beam-track" d="${circuitD}" />
          <path class="radar-beam-path" d="${circuitD}" />
          <path class="radar-beam-bend-path" d="M ${pTL.x} ${pTL.y} L ${pBR.x} ${pBR.y}" stroke-dasharray="6 6" />
          <path class="radar-beam-bend-path" d="M ${pTR.x} ${pTR.y} L ${pBL.x} ${pBL.y}" stroke-dasharray="6 6" />
        `;

        // Hạt bay tuần hoàn quanh 4 góc bệ phóng
        travelersHtml += `
          <g>
            <animateMotion dur="3.2s" repeatCount="indefinite" path="${circuitD}" rotate="auto" />
            <circle r="6" fill="#ffffff" filter="url(#radar-gold-glow)" />
            <circle r="14" fill="none" stroke="#facc15" stroke-width="2.5" opacity="0.85">
              <animate attributeName="r" values="7;16;7" dur="0.8s" repeatCount="indefinite" />
            </circle>
          </g>
        `;

        // Bắn tia từ các góc về các ô bị triệt tiêu
        formula.eliminatedCells.forEach(e => {
          const ePt = cellCenter(e.r, e.c);
          // Tìm góc gần nhất cùng hàng hoặc cột
          const nearestBase = formula.baseCells.find(b => b.c === e.c || b.r === e.r) || formula.baseCells[0];
          const bPt = cellCenter(nearestBase.r, nearestBase.c);
          const shootD = `M ${bPt.x} ${bPt.y} L ${ePt.x} ${ePt.y}`;

          tracksHtml += `
            <path class="radar-beam-path" d="${shootD}" marker-end="url(#radar-arrow-red)" />
          `;
          travelersHtml += `
            <g>
              <animateMotion dur="1.6s" repeatCount="indefinite" path="${shootD}" rotate="auto" />
              <circle r="5" fill="#ffffff" filter="url(#radar-red-glow)" />
            </g>
          `;
        });
      } else if (formula.type === 'kaitun' && formula.chainNodes && formula.chainNodes.length >= 3) {
        // --- ⚡ KAITUN: CHUỖI DÂY CHUYỀN DOMINO BẺ KHÓA ĐA MẮT XÍCH (AIC & XY-CHAIN) ---
        const nodes = formula.chainNodes;
        const isXYChain = formula.subtype === 'xy-chain';
        let fullChainD = '';

        for (let i = 0; i < nodes.length - 1; i++) {
          const n1 = nodes[i];
          const n2 = nodes[i + 1];
          const pt1 = cellCenter(n1.r, n1.c);
          const pt2 = cellCenter(n2.r, n2.c);
          const isStrong = (i % 2 === 0);

          let segmentD = '';
          if (n1.r === n2.r || n1.c === n2.c) {
            segmentD = `M ${pt1.x} ${pt1.y} L ${pt2.x} ${pt2.y}`;
          } else {
            segmentD = `M ${pt1.x} ${pt1.y} L ${pt2.x} ${pt1.y} L ${pt2.x} ${pt2.y}`;
          }

          if (i === 0) {
            fullChainD = segmentD;
          } else {
            if (n1.r === n2.r || n1.c === n2.c) {
              fullChainD += ` L ${pt2.x} ${pt2.y}`;
            } else {
              fullChainD += ` L ${pt2.x} ${pt1.y} L ${pt2.x} ${pt2.y}`;
            }
          }

          tracksHtml += `
            <path class="radar-beam-track" d="${segmentD}" />
            <path class="${isStrong ? 'radar-beam-path' : 'radar-beam-bend-path'}" d="${segmentD}" />
          `;

          waypointsHtml += `
            <circle cx="${pt1.x}" cy="${pt1.y}" r="6" fill="${isStrong ? '#facc15' : '#38bdf8'}" filter="url(${isStrong ? '#radar-gold-glow' : '#radar-cyan-glow'})" />
            <circle cx="${pt1.x}" cy="${pt1.y}" r="2" fill="#ffffff" />
          `;
        }

        const lastNode = nodes[nodes.length - 1];
        const pLast = cellCenter(lastNode.r, lastNode.c);
        waypointsHtml += `
          <circle cx="${pLast.x}" cy="${pLast.y}" r="6" fill="${isXYChain ? '#d946ef' : '#facc15'}" filter="url(${isXYChain ? '#radar-cyan-glow' : '#radar-gold-glow'})" />
          <circle cx="${pLast.x}" cy="${pLast.y}" r="2" fill="#ffffff" />
        `;

        // Hạt photon Domino bay luân phiên dọc theo chuỗi mắt xích
        travelersHtml += `
          <g>
            <animateMotion dur="${nodes.length * 0.6}s" repeatCount="indefinite" path="${fullChainD}" rotate="auto" />
            <circle r="7" fill="#ffffff" filter="url(${isXYChain ? '#radar-cyan-glow' : '#radar-gold-glow'})" />
            <circle r="14" fill="none" stroke="${isXYChain ? '#d946ef' : '#facc15'}" stroke-width="2.5" opacity="0.85">
              <animate attributeName="r" values="7;16;7" dur="0.8s" repeatCount="indefinite" />
            </circle>
            <circle cx="-10" cy="0" r="3.5" fill="${isXYChain ? '#d946ef' : '#facc15'}" opacity="0.75" />
          </g>
        `;

        // Bắn 2 tia gọng kìm từ 2 đầu mút chuỗi về các ô bị triệt tiêu
        const firstNode = nodes[0];
        const pFirst = cellCenter(firstNode.r, firstNode.c);

        formula.eliminatedCells.forEach(e => {
          const pElim = cellCenter(e.r, e.c);
          const shootD1 = `M ${pFirst.x} ${pFirst.y} L ${pElim.x} ${pElim.y}`;
          const shootD2 = `M ${pLast.x} ${pLast.y} L ${pElim.x} ${pElim.y}`;

          tracksHtml += `
            <path class="radar-beam-path" d="${shootD1}" marker-end="url(#radar-arrow-red)" />
            <path class="radar-beam-path" d="${shootD2}" marker-end="url(#radar-arrow-red)" />
          `;

          travelersHtml += `
            <g>
              <animateMotion dur="1.5s" repeatCount="indefinite" path="${shootD1}" rotate="auto" />
              <circle r="5" fill="#ffffff" filter="url(#radar-red-glow)" />
            </g>
            <g>
              <animateMotion dur="1.5s" repeatCount="indefinite" path="${shootD2}" rotate="auto" begin="0.3s" />
              <circle r="5" fill="#ffffff" filter="url(#radar-red-glow)" />
            </g>
          `;
        });
      } else {
        // --- CÁC CÔNG THỨC KHÁC: BẮN TỪ Ô KHÔNG BỊ CHẶN ➔ Ô BỊ CHẶN ---
        formula.baseCells.forEach((b, idx) => {
          const bPt = cellCenter(b.r, b.c);
          formula.eliminatedCells.forEach(e => {
            const ePt = cellCenter(e.r, e.c);
            const lineD = `M ${bPt.x} ${bPt.y} L ${ePt.x} ${ePt.y}`;
            tracksHtml += `
              <path class="radar-beam-track" d="${lineD}" />
              <path class="radar-beam-path" d="${lineD}" marker-end="url(#radar-arrow-red)" />
            `;
            travelersHtml += `
              <g>
                <animateMotion dur="1.8s" repeatCount="indefinite" path="${lineD}" rotate="auto" begin="${idx * 0.2}s" />
                <circle r="5" fill="#ffffff" filter="url(#radar-gold-glow)" />
                <circle r="12" fill="none" stroke="#facc15" stroke-width="2">
                  <animate attributeName="r" values="6;14;6" dur="0.8s" repeatCount="indefinite" />
                </circle>
              </g>
            `;
          });
        });
      }
    }

    svg.innerHTML = defs + tracksHtml + waypointsHtml + travelersHtml;
  }

  /**
   * Kiểm tra xem một chữ số (1-9) đã được điền ĐÚNG và ĐỦ 9 ô trên bàn cờ chưa
   * Chỉ hoàn thành khi đủ 9 ô VÀ tất cả 9 ô đều đúng (không vi phạm quy tắc / đúng theo nghiệm chuẩn)
   */
  isDigitCompleted(digit) {
    if (digit < 1 || digit > 9) return false;

    // 1. Nếu đã có nghiệm chuẩn (solution)
    if (this.solution) {
      let correctMatches = 0;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (this.currentBoard[r][c] === digit) {
            // Nếu có ô điền số digit nhưng sai với nghiệm chuẩn -> Chưa hoàn thành đúng!
            if (this.solution[r][c] !== digit) {
              return false;
            }
            correctMatches++;
          }
        }
      }
      return correctMatches === 9;
    }

    // 2. Nếu chưa có nghiệm chuẩn, kiểm tra hợp lệ 9 ô theo luật Sudoku
    let count = 0;
    const seenRow = new Set();
    const seenCol = new Set();
    const seenBox = new Set();

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] === digit) {
          count++;
          const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
          if (seenRow.has(r) || seenCol.has(c) || seenBox.has(b)) {
            // Xung đột hàng, cột hoặc khối
            return false;
          }
          seenRow.add(r);
          seenCol.add(c);
          seenBox.add(b);
        }
      }
    }

    return count === 9;
  }

  /**
   * Cập nhật trạng thái hiển thị Numpad:
   * Chỉ chuyển thành dấu tích (✓) và khóa khi số đó đã HOÀN THÀNH ĐÚNG 100% (9/9 ô chính xác)
   * Nếu có 9 số nhưng bị sai vị trí thì không đánh dấu tích và không khóa để người dùng sửa lại
   */
  updateNumpadStatus() {
    if (!this.dom.numpadBtns) return;

    this.dom.numpadBtns.forEach(btn => {
      const val = parseInt(btn.dataset.val, 10);
      if (val >= 1 && val <= 9) {
        let count = 0;
        let errors = 0;
        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            if (this.currentBoard[r][c] === val) {
              count++;
              if (this.solution && this.solution[r][c] !== val) {
                errors++;
              }
            }
          }
        }

        const isComplete = this.isDigitCompleted(val);

        btn.classList.toggle('completed', isComplete);
        btn.disabled = isComplete;

        if (isComplete) {
          btn.innerHTML = '<span class="numpad-check">✓</span>';
          btn.classList.remove('has-error');
          btn.title = `Số ${val} đã hoàn thành chính xác 100% (9/9 ô chuẩn)`;
        } else if (count >= 9 && errors > 0) {
          btn.textContent = val;
          btn.classList.add('has-error');
          btn.title = `Số ${val}: Đã điền ${count} ô nhưng có ${errors} ô chưa chính xác. Nhấp để chọn ô và sửa lại!`;
        } else {
          btn.textContent = val;
          btn.classList.remove('has-error');
          btn.title = `Điền số ${val} (Đã có ${count}/9 số)`;
        }
      }
    });

    if (this.arenaManager && this.arenaManager.isActive) {
      this.arenaManager.updateKeypadLockVisuals();
    }
  }

  /**
   * Kiểm tra xem bàn cờ đã điền kín và đúng toàn bộ chưa
   */
  isBoardComplete() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] === 0) return false;
        if (this.solution && this.currentBoard[r][c] !== this.solution[r][c]) return false;
      }
    }
    return true;
  }

  /**
   * Nhập hoặc sửa giá trị của ô đang chọn
   */
  inputSelectedCellValue(val) {
    if (this.isFormulaInspectionMode) {
      this.exitFormulaInspection(false);
    }
    if (this.isPreviewMode) {
      this.closePreview(false);
    }
    this.clearKaitunInference();
    if (!this.selectedCell) return;
    const { row, col } = this.selectedCell;

    // 0. Thao tác XÓA số ở ô đang chọn
    if (val === 0) {
      this.eraseSelectedCell();
      return;
    }

    // 0.1. CHẾ ĐỘ BÚT CHÌ THỦ CÔNG (Pencil / Notes Mode):
    // Khi Bút chì BẬT, nhập số 1-9 để thêm / bớt số nháp vào ô đang chọn mà không bị tính lỗi
    if (this.isPencilMode) {
      if (val >= 1 && val <= 9 && this.isDigitCompleted(val)) {
        this.playSound('conflict');
        this.setStatus(`⚠️ Số ${val} đã hoàn thành đủ 9 ô trên bàn cờ!`, 'conflict');
        return;
      }
      this.toggleManualCandidate(row, col, val);
      return;
    }

    // 0.1b. CHẾ ĐỘ GHI CHÚ LOẠI TRỪ (Đánh dấu ô KHÔNG THỂ có số đó):
    if (this.isBanPencilMode) {
      if (val >= 1 && val <= 9 && this.isDigitCompleted(val)) {
        this.playSound('conflict');
        this.setStatus(`⚠️ Số ${val} đã hoàn thành đủ 9 ô trên bàn cờ!`, 'conflict');
        return;
      }
      this.toggleManualBannedCandidate(row, col, val);
      return;
    }

    // 0.2. KIỂM TRA ĐẤU TRƯỜNG SINH TỒN EXTREME (Khóa số & Thợ săn số)
    if (this.arenaManager && this.arenaManager.isActive) {
      if (!this.arenaManager.validateNumberInput(val)) {
        return;
      }
    }

    // 1. Kiểm tra trạng thái Game Over: nếu đã hết lượt sai thì CHẶN MỌI THAO TÁC ĐIỀN
    if (this.isGameOver()) {
      this.playSound('conflict');
      this.setStatus('💔 Bạn đã hết lượt sai cho phép (Game Over)! Hãy chọn tiếp tục chơi không giới hạn hoặc chơi lại ván này.', 'conflict');
      this.showGameOverModal();
      return;
    }

    // 2. Chặn không cho đánh nhầm số đã hoàn thành đủ 9 ô
    if (val >= 1 && val <= 9 && this.isDigitCompleted(val)) {
      this.playSound('conflict');
      this.setStatus(`⚠️ Số ${val} đã hoàn thành đủ 9 ô trên bàn cờ!`, 'conflict');
      return;
    }

    const wasGiven = this.initialBoard[row][col] !== 0;

    // 3. Trường hợp câu đố đã có lời giải (đang trong ván chơi)
    if (this.solution) {
      // KHÓA CỨNG Ô ĐỀ BÀI CHO SẴN: Tuyệt đối không cho sửa hay ghi đè
      if (wasGiven) {
        this.playSound('conflict');
        this.setStatus('🔒 Đây là số cho sẵn của đề bài, không thể chỉnh sửa trong khi giải!', 'conflict');
        this.triggerCellFeedback(row, col, false);
        return;
      }

      // Nếu người chơi đang tua xem lại lịch sử bước trước hoặc bước tương lai, tự động nhảy về bước hiện tại
      const userMovesCount = this.userMovesHistory ? this.userMovesHistory.length : 0;
      if (this.currentStepIndex !== userMovesCount) {
        this.goToStep(userMovesCount);
      }

      // Người chơi điền số vào ô trống
      this.currentBoard[row][col] = val;
      this.availablePreviewSteps = null;
      const isCorrect = val === this.solution[row][col];
      const hasConflict = this.hasPeerConflict(row, col, val);

      if (isCorrect) {
        // Xóa sạch ghi chú nháp tại ô này
        this.manualCandidates[row][col] = [];
        // Tự động xóa ứng viên này khỏi các ô cùng hàng, cột, khối nếu bật tùy chọn
        if (this.autoRemoveNotes) {
          this.removeCandidateFromPeers(row, col, val);
        }
        // Ghi nhận nước đi người chơi và đồng bộ toàn diện Tiến trình bước giải
        this.recordUserMove(row, col, val);
        this.syncSolvingWalkthroughWithCurrentBoard();

        // Ghi nhận vào Đấu Trường nếu đang trong trận
        if (this.arenaManager && this.arenaManager.isActive) {
          this.arenaManager.onNumberCorrectlyPlaced(val);
        }
      }

      this.renderBoard();
      this.triggerCellFeedback(row, col, isCorrect);

      const maxLabel = this.maxMistakes === 'unlimited' ? '∞' : this.maxMistakes;

      if (isCorrect) {
        this.playSound('step');
        this.setStatus(`✅ ĐÚNG: Số ${val} tại (Hàng ${row + 1}, Cột ${col + 1}) chính xác theo nghiệm chuẩn!`, 'valid');

        if (this.isBoardComplete()) {
          this.stopNormalTimer();
          const finishTime = this.dom.normalTimerText ? this.dom.normalTimerText.textContent : '00:00';
          this.setStatus(`🎉 Chúc mừng! Bạn đã hoàn thành câu đố chuẩn xác 100% trong ${finishTime}!`, 'solved');
          this.playSound('complete');
          if (this.currentGameRecord) {
            this.currentGameRecord.status = 'completed';
            this.currentGameRecord.mistakes = this.mistakesCount;
            this.currentGameRecord.duration = finishTime;
            this.saveRecentGames();
          }
          if (this.activeCustomSeed) {
            this.recordSeedConquest(this.activeCustomSeed, finishTime, this.mistakesCount);
          }
        }
      } else {
        // TÍNH LỖI VI PHẠM
        if (this.arenaManager && this.arenaManager.isActive) {
          this.arenaManager.onMistakeRecorded();
          this.playSound('conflict');
          this.setStatus(`❌ SAI: Số ${val} tại (Hàng ${row + 1}, Cột ${col + 1}) chưa đúng nghiệm! (Lỗi: ${this.arenaManager.mistakes} / 3)`, 'conflict');
          return;
        }

        this.mistakesCount++;
        this.updateMistakeBadge();
        this.playSound('conflict');

        if (this.currentGameRecord) {
          this.currentGameRecord.mistakes = this.mistakesCount;
          this.saveRecentGames();
        }

        const conflictDetail = hasConflict ? ' (Trùng lặp hàng/cột/khối)' : '';
        this.setStatus(`❌ SAI: Số ${val} tại (Hàng ${row + 1}, Cột ${col + 1}) chưa đúng nghiệm chuẩn${conflictDetail}! (Lỗi: ${this.mistakesCount} / ${maxLabel})`, 'conflict');

        // Kiểm tra điều kiện vượt giới hạn lượt sai (Game Over)
        if (this.isGameOver()) {
          if (this.currentGameRecord) {
            this.currentGameRecord.status = 'failed';
            this.saveRecentGames();
          }
          this.showGameOverModal();
        }
      }
      return;
    }

    // 4. Trường hợp đang nhập đề bài từ bàn cờ trống
    this.initialBoard[row][col] = val;
    this.currentBoard[row][col] = val;
    this.solveAndPrepareWalkthrough();
  }

  /**
   * Xóa giá trị ở ô đang chọn (áp dụng cho cả numpad Xóa và phím Backspace/Delete)
   */
  eraseSelectedCell() {
    if (this.isFormulaInspectionMode) {
      this.exitFormulaInspection(false);
    }
    if (this.isPreviewMode) {
      this.closePreview(false);
    }
    if (!this.selectedCell) {
      this.setStatus('⚠️ Hãy nhấp chọn một ô trên bàn cờ trước khi bấm Xóa!', 'conflict');
      this.playSound('conflict');
      return;
    }
    const { row, col } = this.selectedCell;

    // Nếu đang trong ván cờ có lời giải và đây là ô đề bài cho sẵn
    if (this.solution && this.initialBoard[row][col] !== 0) {
      this.playSound('conflict');
      this.setStatus('🔒 Đây là số cho sẵn của đề bài, không thể xóa!', 'conflict');
      this.triggerCellFeedback(row, col, false);
      return;
    }

    const hasUserDigit = this.currentBoard[row][col] !== 0;
    const hasNotes = this.manualCandidates[row] && this.manualCandidates[row][col] && this.manualCandidates[row][col].length > 0;
    const hasBanned = this.manualBannedCandidates && this.manualBannedCandidates[row] && this.manualBannedCandidates[row][col] && this.manualBannedCandidates[row][col].length > 0;

    // Trong chế độ bút chì hoặc chế độ loại trừ: nếu ô có số nháp/loại trừ thì ưu tiên xóa sạch
    if ((this.isPencilMode || this.isBanPencilMode) && (hasNotes || hasBanned)) {
      if (this.manualCandidates[row]) this.manualCandidates[row][col] = [];
      if (this.manualBannedCandidates && this.manualBannedCandidates[row]) this.manualBannedCandidates[row][col] = [];
      this.renderBoard();
      this.updateInspector();
      this.playSound('step');
      this.setStatus(`Đã xóa toàn bộ số nháp & ghi chú loại trừ tại (Hàng ${row + 1}, Cột ${col + 1})`, '');
      return;
    }

    // Nếu ô không có số điền nhưng có ghi chú nháp hoặc ghi chú loại trừ, xóa sạch ghi chú
    if (!hasUserDigit && (hasNotes || hasBanned)) {
      if (this.manualCandidates[row]) this.manualCandidates[row][col] = [];
      if (this.manualBannedCandidates && this.manualBannedCandidates[row]) this.manualBannedCandidates[row][col] = [];
      this.renderBoard();
      this.updateInspector();
      this.playSound('step');
      this.setStatus(`Đã xóa toàn bộ ghi chú tại (Hàng ${row + 1}, Cột ${col + 1})`, '');
      return;
    }

    // Xóa số ở ô người chơi đã điền
    if (hasUserDigit || (!this.solution && this.initialBoard[row][col] !== 0)) {
      this.currentBoard[row][col] = 0;
      this.availablePreviewSteps = null;
      if (!this.solution) {
        this.initialBoard[row][col] = 0;
        this.solveAndPrepareWalkthrough();
      } else {
        this.removeUserMove(row, col);
        this.syncSolvingWalkthroughWithCurrentBoard();
        this.renderBoard();
        this.updateInspector();
      }
      this.playSound('step');
      this.setStatus(`Đã xóa số tại (Hàng ${row + 1}, Cột ${col + 1})`, '');
      return;
    }

    // Nếu ô không có số điền nhưng có số nháp (khi ở chế độ thường bấm xóa)
    if (hasNotes) {
      this.manualCandidates[row][col] = [];
      this.renderBoard();
      this.updateInspector();
      this.playSound('step');
      this.setStatus(`Đã xóa toàn bộ số nháp tại (Hàng ${row + 1}, Cột ${col + 1})`, '');
    }
  }

  /**
   * Đặt lại bàn cờ về trạng thái ban đầu của ván hiện tại (chơi lại từ đầu)
   */
  restartCurrentGame() {
    if (this.arenaManager && this.arenaManager.isActive) {
      // Trong Đấu Trường: Khởi động lại trận đấu với cùng mã đề
      this.arenaManager.startMatch(
        this.arenaManager.seedId,
        this.arenaManager.timeLimitMinutes,
        this.arenaManager.enableTransform
      );
      this.setStatus(`🔄 Đã khởi động lại Đấu Trường Extreme với Đề #${this.arenaManager.seedId}!`, 'valid');
      return;
    }

    this.stopAutoPlay();
    if (this.isFormulaInspectionMode) {
      this.exitFormulaInspection(false);
    }
    if (this.isPreviewMode) {
      this.closePreview(false);
    }
    this.closeGameOverModal();
    this.selectedCell = null;
    this.manualCandidates = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
    this.manualBannedCandidates = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
    this.isPencilMode = false;
    this.isBanPencilMode = false;
    this.updatePencilUI();
    this.userMovesHistory = [];

    if (this.originalPuzzleGrid) {
      this.initialBoard = this.originalPuzzleGrid.map(row => [...row]);
      this.currentBoard = this.originalPuzzleGrid.map(row => [...row]);
      this.solveAndPrepareWalkthrough();
    } else {
      this.currentBoard = this.initialBoard.map(row => [...row]);
      this.syncSolvingWalkthroughWithCurrentBoard();
      this.renderBoard();
    }

    this.mistakesCount = 0;
    this.updateMistakeBadge();
    this.startNewGameRecord();
    this.startNormalTimer();
    this.playSound('step');
    this.setStatus('🔄 Đã khởi động lại ván cờ hiện tại. Lỗi đã được reset về 0!', 'valid');
  }

  /**
   * Xử lý phím tắt bàn phím
   */
  handleKeyDown(e) {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;

    if (e.key === 'Escape') {
      if (this.isFormulaInspectionMode) {
        this.exitFormulaInspection();
        return;
      }
      if (this.isPreviewMode) {
        this.closePreview();
        return;
      }
    }

    // Phím tắt P hoặc N để bật/tắt nhanh chế độ Bút chì (Pencil / Notes Mode)
    if (e.key === 'p' || e.key === 'P' || e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      this.togglePencilMode();
      return;
    }

    // Phím tắt X hoặc E để bật/tắt nhanh chế độ Ghi chú Loại trừ (Ban Pencil Mode)
    if (e.key === 'x' || e.key === 'X' || e.key === 'e' || e.key === 'E') {
      e.preventDefault();
      this.toggleBanPencilMode();
      return;
    }

    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      this.toggleAutoPlay();
      return;
    }

    if (e.key === 'ArrowLeft') {
      if (e.ctrlKey || !this.selectedCell) {
        e.preventDefault();
        this.goToStep(this.currentStepIndex - 1);
        return;
      }
    }

    if (e.key === 'ArrowRight') {
      if (e.ctrlKey || !this.selectedCell) {
        e.preventDefault();
        this.goToStep(this.currentStepIndex + 1);
        return;
      }
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      let r = this.selectedCell ? this.selectedCell.row : 0;
      let c = this.selectedCell ? this.selectedCell.col : 0;

      if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
      if (e.key === 'ArrowDown') r = Math.min(8, r + 1);
      if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
      if (e.key === 'ArrowRight') c = Math.min(8, c + 1);

      this.selectCell(r, c);
      return;
    }

    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault();
      if (!this.isPencilMode && this.isGameOver()) {
        this.playSound('conflict');
        this.showGameOverModal();
        return;
      }
      const val = parseInt(e.key, 10);
      if (this.isDigitCompleted(val)) {
        this.playSound('conflict');
        return;
      }
      this.inputSelectedCellValue(val);
      return;
    }

    if (['Backspace', 'Delete', '0'].includes(e.key)) {
      e.preventDefault();
      this.eraseSelectedCell();
      return;
    }
  }

  /**
   * Xóa toàn bộ bàn cờ về ô trống để bắt đầu đề mới hoàn toàn
   */
  clearBoard() {
    if (this.arenaManager && this.arenaManager.isActive) {
      this.playSound('conflict');
      this.setStatus('🔒 Không thể xóa cờ khi đang thi đấu Đấu Trường Extreme!', 'conflict');
      if (typeof this.arenaManager.showTemporaryToast === 'function') {
        this.arenaManager.showTemporaryToast('🔒 Không thể xóa cờ khi đang thi đấu! Hãy bấm ✕ Thoát trên thanh Đấu trường.');
      }
      return;
    }

    this.stopAutoPlay();
    if (this.isPreviewMode) {
      this.closePreview(false);
    }
    this.closeGameOverModal();
    this.selectedCell = null;
    this.manualCandidates = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
    this.manualBannedCandidates = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
    this.isPencilMode = false;
    this.isBanPencilMode = false;
    this.showCandidates = false;
    this.updatePencilUI();
    this.initialBoard = Array.from({ length: 9 }, () => Array(9).fill(0));
    this.currentBoard = Array.from({ length: 9 }, () => Array(9).fill(0));
    this.originalPuzzleGrid = null;
    this.solution = null;
    this.solveSteps = [];
    this.userMovesHistory = [];
    this.cellStepMap = Array.from({ length: 9 }, () => Array(9).fill(null));
    this.currentStepIndex = 0;
    this.mistakesCount = 0;
    this.updateMistakeBadge();
    this.dom.stepSlider.max = 0;
    this.dom.stepSlider.value = 0;
    this.dom.stepCounter.textContent = 'Bước 0 / 0';
    this.dom.strategyNameText.textContent = 'Trống';
    this.dom.stepDetailsTitle.textContent = 'Bàn cờ đã được xóa sạch';
    this.dom.stepExplanationText.textContent = 'Bàn cờ đã được làm trống. Hãy tải ảnh lên, bấm [Sudoku.com] hoặc [Ảnh mẫu] để bắt đầu!';
    this.dom.stepMetaChips.innerHTML = '';
    this.stopNormalTimer();
    this.normalTimerElapsedSeconds = 0;
    this.normalTimerRemainingSeconds = this.normalCountdownMinutes * 60;
    this.updateNormalTimerDisplay();
    this.setStatus('🗑️ Đã xóa sạch toàn bộ bàn cờ', '');
    this.updatePlayerControls();
    this.renderBoard();
  }

  setStatus(text, indicatorClass = '') {
    this.dom.statusText.textContent = text;
    this.dom.statusIndicator.className = 'status-indicator ' + indicatorClass;
  }

  async openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      this.dom.cameraVideo.srcObject = stream;
      this.dom.cameraModal.classList.add('active');
    } catch (err) {
      alert('Không thể mở camera: ' + err.message);
    }
  }

  closeCamera() {
    if (this.dom.cameraVideo.srcObject) {
      this.dom.cameraVideo.srcObject.getTracks().forEach(track => track.stop());
      this.dom.cameraVideo.srcObject = null;
    }
    this.dom.cameraModal.classList.remove('active');
  }

  captureCameraPhoto() {
    const video = this.dom.cameraVideo;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      this.closeCamera();
      if (blob) this.processImageSource(blob);
    }, 'image/png');
  }

  /**
   * Chuyển đổi tab trên màn hình di động (Bàn cờ / Quét ảnh / Lời giải)
   */
  switchMobileTab(tabName) {
    if (!this.dom.mobileTabBtns) return;
    this.dom.mobileTabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    if (this.dom.panelBoard) {
      this.dom.panelBoard.classList.toggle('mobile-panel-active', tabName === 'board');
    }
    if (this.dom.panelScanner) {
      this.dom.panelScanner.classList.toggle('mobile-panel-active', tabName === 'scanner');
    }
    if (this.dom.panelSolver) {
      this.dom.panelSolver.classList.toggle('mobile-panel-active', tabName === 'solver');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Mở modal kết nối điện thoại và hiển thị mã QR
   */
  async openPhoneModal() {
    try {
      const res = await fetch('/api/network-info');
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          if (this.dom.phoneUrlText) this.dom.phoneUrlText.textContent = data.url;
          if (this.dom.qrImage) {
            this.dom.qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(data.url)}`;
          }
        }
      }
    } catch (e) {
      console.warn('Không thể nạp network-info:', e);
    }
    if (this.dom.phoneModal) this.dom.phoneModal.classList.add('active');
  }

  closePhoneModal() {
    if (this.dom.phoneModal) this.dom.phoneModal.classList.remove('active');
  }

  /**
   * Khởi tạo tính năng PWA (Progressive Web App) cài đặt trực tiếp vào Android (WebAPK)
   */
  initPWA() {
    // 1. Đăng ký Service Worker để ứng dụng chạy Offline 100%
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
          console.log('[PWA] ServiceWorker đăng ký thành công, scope:', reg.scope);
          reg.update();
        }).catch((err) => {
          console.warn('[PWA] ServiceWorker đăng ký không thành công:', err);
        });
      });
    }

    // 2. Bắt sự kiện beforeinstallprompt của trình duyệt Android Chrome
    this.deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      console.log('[PWA] Android beforeinstallprompt đã sẵn sàng');

      // Kích hoạt các nút cài đặt trên giao diện
      if (this.dom.btnInstallApp) {
        this.dom.btnInstallApp.style.display = 'inline-flex';
      }
      if (this.dom.btnModalInstallPwa) {
        this.dom.btnModalInstallPwa.style.display = 'flex';
      }
    });

    const triggerInstall = async () => {
      if (this.deferredPrompt) {
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        console.log('[PWA] Kết quả cài đặt của người dùng:', outcome);
        this.deferredPrompt = null;
        if (this.dom.btnInstallApp) this.dom.btnInstallApp.style.display = 'none';
        if (this.dom.btnModalInstallPwa) this.dom.btnModalInstallPwa.style.display = 'none';
      } else {
        // Nếu trình duyệt chưa bắn event (ví dụ Safari hoặc desktop), mở modal hướng dẫn
        this.openPhoneModal();
      }
    };

    if (this.dom.btnInstallApp) {
      this.dom.btnInstallApp.addEventListener('click', triggerInstall);
    }
    if (this.dom.btnModalInstallPwa) {
      this.dom.btnModalInstallPwa.addEventListener('click', triggerInstall);
    }

    window.addEventListener('appinstalled', () => {
      console.log('[PWA] Đã cài đặt thành công Sudo9ku vào Android!');
      this.setStatus('🎉 Đã cài đặt ứng dụng Sudo9ku trên Android thành công!', 'valid');
      if (this.dom.btnInstallApp) this.dom.btnInstallApp.style.display = 'none';
      if (this.dom.btnModalInstallPwa) this.dom.btnModalInstallPwa.style.display = 'none';
    });
  }

  // ==========================================
  // QUẢN LÝ LỖI, LỊCH SỬ BÀN CỜ & CÀI ĐẶT
  // ==========================================

  isGameOver() {
    if (this.maxMistakes === 'unlimited') return false;
    const maxNum = parseInt(this.maxMistakes, 10);
    return !isNaN(maxNum) && this.mistakesCount >= maxNum;
  }

  hasPeerConflict(row, col, val) {
    if (!val) return false;
    // Kiểm tra hàng
    for (let c = 0; c < 9; c++) {
      if (c !== col && this.currentBoard[row][c] === val) return true;
    }
    // Kiểm tra cột
    for (let r = 0; r < 9; r++) {
      if (r !== row && this.currentBoard[r][col] === val) return true;
    }
    // Kiểm tra khối 3x3
    const boxR = Math.floor(row / 3) * 3;
    const boxC = Math.floor(col / 3) * 3;
    for (let r = boxR; r < boxR + 3; r++) {
      for (let c = boxC; c < boxC + 3; c++) {
        if ((r !== row || c !== col) && this.currentBoard[r][c] === val) return true;
      }
    }
    return false;
  }

  loadRecentGames() {
    try {
      const data = localStorage.getItem('sudoku_recent_games');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Lỗi khi đọc lịch sử ván cờ:', e);
      return [];
    }
  }

  saveRecentGames() {
    try {
      localStorage.setItem('sudoku_recent_games', JSON.stringify(this.recentGames.slice(0, 30)));
    } catch (e) {
      console.warn('Lỗi khi lưu lịch sử ván cờ:', e);
    }
  }

  startNewGameRecord(levelName = null) {
    this.mistakesCount = 0;
    this.updateMistakeBadge();

    const finalLevelName = levelName || this.getCurrentGameLevelName();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;

    this.currentGameRecord = {
      id: 'game_' + Date.now(),
      date: timeStr,
      level: finalLevelName,
      mistakes: 0,
      maxMistakes: this.maxMistakes,
      status: 'in_progress',
      totalClues: this.countCurrentClues()
    };

    // Thêm vào danh sách recentGames (tối đa 30 bàn gần nhất)
    this.recentGames.unshift(this.currentGameRecord);
    if (this.recentGames.length > 30) {
      this.recentGames = this.recentGames.slice(0, 30);
    }
    this.saveRecentGames();

    // Khởi động đồng hồ thời gian ván chơi bình thường
    this.startNormalTimer();
  }

  countCurrentClues() {
    let count = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.initialBoard[r][c] !== 0) count++;
      }
    }
    return count;
  }

  getCurrentGameLevelName() {
    if (this.dom.selectSudokuLevel) {
      const val = this.dom.selectSudokuLevel.value;
      const map = {
        nightmare: '☠️ Ác mộng',
        extreme: '🔴 Cực khó',
        evil: '🟣 Độc địa',
        expert: '🟠 Chuyên gia',
        hard: '🟡 Khó',
        medium: '🔵 Trung bình',
        easy: '🟢 Dễ'
      };
      return map[val] || 'Sudoku';
    }
    return 'Sudoku';
  }

  updateMistakeBadge() {
    if (!this.dom.mistakeCounterText) return;
    const maxStr = this.maxMistakes === 'unlimited' ? '∞' : this.maxMistakes;
    this.dom.mistakeCounterText.textContent = `${this.mistakesCount} / ${maxStr}`;

    if (this.dom.mistakesBadge) {
      this.dom.mistakesBadge.classList.remove('danger', 'warning');
      if (this.maxMistakes !== 'unlimited') {
        const maxNum = parseInt(this.maxMistakes, 10);
        if (this.mistakesCount >= maxNum) {
          this.dom.mistakesBadge.classList.add('danger');
        } else if (this.mistakesCount >= maxNum - 1 && this.mistakesCount > 0) {
          this.dom.mistakesBadge.classList.add('warning');
        }
      } else {
        if (this.mistakesCount > 0) {
          this.dom.mistakesBadge.classList.add('warning');
        }
      }
    }
  }

  triggerCellFeedback(row, col, isCorrect) {
    if (!this.cellElements || !this.cellElements[row] || !this.cellElements[row][col]) return;
    const cell = this.cellElements[row][col];
    const animClass = isCorrect ? 'flash-correct' : 'flash-wrong';
    cell.classList.remove('flash-correct', 'flash-wrong');
    void cell.offsetWidth; // Force reflow
    cell.classList.add(animClass);
    setTimeout(() => {
      cell.classList.remove(animClass);
    }, 750);
  }

  openMistakesSettingsModal() {
    this.openUnifiedSettingsModal('mistakes');
  }

  closeMistakesSettingsModal() {
    this.closeUnifiedSettingsModal();
  }

  saveMistakesSettings() {
    const selectedRadio = document.querySelector('input[name="mistake-limit"]:checked');
    let newLimit = '3';
    if (selectedRadio) {
      if (selectedRadio.value === 'custom') {
        const val = parseInt(this.dom.inputCustomMistakes?.value, 10) || 7;
        newLimit = String(Math.max(1, Math.min(99, val)));
        localStorage.setItem('sudoku_custom_mistakes_val', newLimit);
      } else {
        newLimit = selectedRadio.value;
      }
    }

    this.maxMistakes = newLimit;
    localStorage.setItem('sudoku_max_mistakes', this.maxMistakes);

    if (this.dom.toggleInstantFeedback) {
      this.instantFeedback = this.dom.toggleInstantFeedback.checked;
      localStorage.setItem('sudoku_instant_feedback', this.instantFeedback);
    }

    if (this.currentGameRecord) {
      this.currentGameRecord.maxMistakes = this.maxMistakes;
      this.saveRecentGames();
    }

    this.updateMistakeBadge();
    this.closeUnifiedSettingsModal();
    const limitName = this.maxMistakes === 'unlimited' ? 'Không giới hạn' : `${this.maxMistakes} lượt sai`;
    this.setStatus(`✓ Đã lưu cài đặt: ${limitName}`, 'valid');
  }

  openHistoryModal() {
    this.renderHistoryModal();
    if (this.dom.historyModal) {
      this.dom.historyModal.classList.add('active');
    }
  }

  closeHistoryModal() {
    if (this.dom.historyModal) {
      this.dom.historyModal.classList.remove('active');
    }
  }

  clearHistory() {
    if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử các ván đấu gần nhất?')) {
      this.recentGames = [];
      this.saveRecentGames();
      this.renderHistoryModal();
      this.setStatus('🗑️ Đã xóa lịch sử các bàn cờ gần nhất', '');
    }
  }

  renderHistoryModal() {
    const total = this.recentGames.length;
    const totalMistakes = this.recentGames.reduce((acc, g) => acc + (g.mistakes || 0), 0);
    const avgMistakes = total > 0 ? (totalMistakes / total).toFixed(1) : '0.0';
    const flawlessGames = this.recentGames.filter(g => g.status === 'completed' && (g.mistakes || 0) === 0).length;

    if (this.dom.metricTotalGames) this.dom.metricTotalGames.textContent = total;
    if (this.dom.metricTotalMistakes) this.dom.metricTotalMistakes.textContent = totalMistakes;
    if (this.dom.metricAvgMistakes) this.dom.metricAvgMistakes.textContent = avgMistakes;
    if (this.dom.metricFlawlessGames) this.dom.metricFlawlessGames.textContent = flawlessGames;

    if (!this.dom.recentGamesList) return;

    if (total === 0) {
      this.dom.recentGamesList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 30px 10px; font-size: 0.85rem;">
          <span style="font-size: 1.8rem; display: block; margin-bottom: 6px;">🎮</span>
          Chưa có ván đấu nào được ghi nhận.<br>Hãy giải hoặc điền các số để lưu lại thống kê!
        </div>
      `;
      return;
    }

    this.dom.recentGamesList.innerHTML = this.recentGames.map((game, idx) => {
      const mistakes = game.mistakes || 0;
      let badgeClass = 'flawless';
      let badgeIcon = '🌟';
      if (mistakes > 0 && mistakes <= 2) {
        badgeClass = 'warning';
        badgeIcon = '⚠️';
      } else if (mistakes >= 3) {
        badgeClass = 'danger';
        badgeIcon = '❌';
      }

      let statusBadge = '';
      if (game.status === 'completed') {
        statusBadge = '<span style="color: #10b981; font-weight: 600; font-size: 0.72rem;">✓ Hoàn thành</span>';
      } else if (game.status === 'failed') {
        statusBadge = '<span style="color: #f87171; font-weight: 600; font-size: 0.72rem;">✗ Quá lượt sai</span>';
      } else {
        statusBadge = '<span style="color: var(--teal); font-weight: 500; font-size: 0.72rem;">⏳ Đang chơi</span>';
      }

      const maxLbl = game.maxMistakes === 'unlimited' ? 'K.giới hạn' : `${game.maxMistakes} lỗi`;

      return `
        <div class="recent-game-item">
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong style="color: var(--text-main); font-size: 0.85rem;">#${idx + 1} ${game.level || 'Sudoku'}</strong>
              <span style="font-size: 0.72rem; color: var(--text-muted);">${game.date || ''}</span>
              ${statusBadge}
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">
              Giới hạn: <strong>${maxLbl}</strong> ${game.totalClues ? `• ${game.totalClues} ô gợi ý` : ''}
            </div>
          </div>
          <div>
            <span class="recent-game-mistake-badge ${badgeClass}">
              ${badgeIcon} ${mistakes} lỗi
            </span>
          </div>
        </div>
      `;
    }).join('');
  }

  showGameOverModal() {
    if (!this.dom.gameOverModal) return;
    if (this.dom.gameOverMsg) {
      this.dom.gameOverMsg.textContent = `Bạn đã mắc ${this.mistakesCount} lỗi vi phạm (vượt quá giới hạn ${this.maxMistakes} lượt sai của chế độ hiện tại). Bạn có muốn tiếp tục giải không giới hạn hay chơi lại từ đầu?`;
    }
    this.dom.gameOverModal.classList.add('active');
  }

  closeGameOverModal() {
    if (this.dom.gameOverModal) {
      this.dom.gameOverModal.classList.remove('active');
    }
  }

  /**
   * Bật / Tắt chế độ Bút chì (Pencil / Notes Mode)
   */
  togglePencilMode(forceState = null) {
    this.isPencilMode = forceState !== null ? forceState : !this.isPencilMode;
    if (this.isPencilMode) {
      this.isBanPencilMode = false;
      this.showCandidates = true;
    }
    this.updatePencilUI();
    this.playSound('step');
    const msg = this.isPencilMode
      ? '✏️ Chế độ Bút chì: ĐÃ BẬT (Bấm 1-9 để thêm/bớt số nháp, không tính lỗi)'
      : '✏️ Chế độ Bút chì: ĐÃ TẮT (Bấm 1-9 để điền số chính thức)';
    this.setStatus(msg, this.isPencilMode ? 'valid' : '');
    this.renderBoard();
  }

  /**
   * Bật / Tắt chế độ ghi chú loại trừ thủ công (Đánh dấu ô KHÔNG THỂ có số đó)
   */
  toggleBanPencilMode(forceState = null) {
    this.isBanPencilMode = forceState !== null ? forceState : !this.isBanPencilMode;
    if (this.isBanPencilMode) {
      this.isPencilMode = false;
      this.showCandidates = true;
    }
    this.updatePencilUI();
    this.playSound('step');
    const msg = this.isBanPencilMode
      ? '🚫 Chế độ Ghi chú Loại trừ: ĐÃ BẬT (Bấm 1-9 để đánh dấu ô KHÔNG THỂ có số đó)'
      : '🚫 Chế độ Ghi chú Loại trừ: ĐÃ TẮT';
    this.setStatus(msg, this.isBanPencilMode ? 'valid' : '');
    this.renderBoard();
  }

  /**
   * Cập nhật trạng thái hiển thị của các nút Bút chì & Ghi chú loại trừ
   */
  updatePencilUI() {
    if (this.dom.btnPencilToggle) {
      this.dom.btnPencilToggle.classList.toggle('btn-pencil-active', this.isPencilMode);
    }
    if (this.dom.pencilBtnLabel) {
      this.dom.pencilBtnLabel.textContent = `Bút chì: ${this.isPencilMode ? 'BẬT' : 'TẮT'}`;
    }
    if (this.dom.btnNumpadPencil) {
      this.dom.btnNumpadPencil.classList.toggle('btn-pencil-active', this.isPencilMode);
    }
    if (this.dom.numpadPencilText) {
      this.dom.numpadPencilText.textContent = `Ghi chú: ${this.isPencilMode ? 'BẬT' : 'TẮT'}`;
    }
    if (this.dom.btnNumpadBanPencil) {
      this.dom.btnNumpadBanPencil.classList.toggle('btn-ban-pencil-active', this.isBanPencilMode);
    }
    if (this.dom.numpadBanPencilText) {
      this.dom.numpadBanPencilText.textContent = `Loại trừ: ${this.isBanPencilMode ? 'BẬT' : 'TẮT'}`;
    }
    if (this.dom.btnMenuBanPencil) {
      this.dom.btnMenuBanPencil.classList.toggle('active', this.isBanPencilMode);
      this.dom.btnMenuBanPencil.textContent = `🚫 Ghi chú loại trừ số: ${this.isBanPencilMode ? 'BẬT' : 'TẮT'} (X)`;
    }
  }

  /**
   * Thêm hoặc bớt số nháp thủ công tại ô (row, col)
   */
  toggleManualCandidate(row, col, num) {
    if (this.initialBoard[row][col] !== 0 || this.currentBoard[row][col] !== 0) {
      this.playSound('conflict');
      this.setStatus('⚠️ Không thể ghi chú trên ô đã có số!', 'conflict');
      return;
    }
    if (!this.manualCandidates[row]) {
      this.manualCandidates[row] = Array.from({ length: 9 }, () => []);
    }
    let cands = this.manualCandidates[row][col] || [];
    const idx = cands.indexOf(num);
    let added = false;
    if (idx !== -1) {
      cands.splice(idx, 1);
    } else {
      cands.push(num);
      cands.sort((a, b) => a - b);
      added = true;
      // Gỡ khỏi ghi chú loại trừ nếu có
      if (this.manualBannedCandidates && this.manualBannedCandidates[row] && this.manualBannedCandidates[row][col]) {
        const bIdx = this.manualBannedCandidates[row][col].indexOf(num);
        if (bIdx !== -1) this.manualBannedCandidates[row][col].splice(bIdx, 1);
      }
    }
    this.manualCandidates[row][col] = cands;
    this.showCandidates = true;
    this.pencilType = 'manual';
    this.playSound('step');
    this.setStatus(`✏️ ${added ? 'Đã thêm' : 'Đã bỏ'} số nháp ${num} ở ô (Hàng ${row + 1}, Cột ${col + 1})`, added ? 'valid' : '');
    this.renderBoard();
    this.updateInspector();
  }

  /**
   * Thêm hoặc bớt ghi chú loại trừ thủ công tại ô (row, col): Ô này KHÔNG THỂ là số num
   */
  toggleManualBannedCandidate(row, col, num) {
    if (this.initialBoard[row][col] !== 0 || this.currentBoard[row][col] !== 0) {
      this.playSound('conflict');
      this.setStatus('⚠️ Không thể ghi chú trên ô đã có số!', 'conflict');
      return;
    }
    if (!this.manualBannedCandidates) {
      this.manualBannedCandidates = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
    }
    if (!this.manualBannedCandidates[row]) {
      this.manualBannedCandidates[row] = Array.from({ length: 9 }, () => []);
    }
    let banned = this.manualBannedCandidates[row][col] || [];
    const idx = banned.indexOf(num);
    let added = false;
    if (idx !== -1) {
      banned.splice(idx, 1);
    } else {
      banned.push(num);
      banned.sort((a, b) => a - b);
      added = true;
      // Nếu đang có số nháp thuận tương ứng thì xóa số nháp thuận
      if (this.manualCandidates && this.manualCandidates[row] && this.manualCandidates[row][col]) {
        const cIdx = this.manualCandidates[row][col].indexOf(num);
        if (cIdx !== -1) this.manualCandidates[row][col].splice(cIdx, 1);
      }
    }
    this.manualBannedCandidates[row][col] = banned;
    this.showCandidates = true;
    this.playSound('step');
    this.setStatus(
      `🚫 ${added ? 'Đã ghi chú: Ô' : 'Đã hủy ghi chú loại trừ số ' + num + ' ở ô'} (Hàng ${row + 1}, Cột ${col + 1}) ${added ? 'KHÔNG THỂ có số ' + num : ''}`,
      added ? 'valid' : ''
    );
    this.renderBoard();
    this.updateInspector();
  }

  /**
   * Tự động xóa ứng viên val khỏi tất cả các ô liên quan (cùng hàng, cột, khối)
   */
  removeCandidateFromPeers(row, col, val) {
    // Cùng hàng
    for (let c = 0; c < 9; c++) {
      if (c !== col && this.manualCandidates[row] && this.manualCandidates[row][c]) {
        this.manualCandidates[row][c] = this.manualCandidates[row][c].filter(n => n !== val);
      }
    }
    // Cùng cột
    for (let r = 0; r < 9; r++) {
      if (r !== row && this.manualCandidates[r] && this.manualCandidates[r][col]) {
        this.manualCandidates[r][col] = this.manualCandidates[r][col].filter(n => n !== val);
      }
    }
    // Cùng khối 3x3
    const startR = Math.floor(row / 3) * 3;
    const startC = Math.floor(col / 3) * 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const pr = startR + r;
        const pc = startC + c;
        if ((pr !== row || pc !== col) && this.manualCandidates[pr] && this.manualCandidates[pr][pc]) {
          this.manualCandidates[pr][pc] = this.manualCandidates[pr][pc].filter(n => n !== val);
        }
      }
    }
  }

  /**
   * Tự động điền tất cả ứng viên hợp lệ vào toàn bộ ô trống dưới dạng ghi chú
   */
  autoFillAllNotes() {
    let filledCount = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] === 0) {
          this.manualCandidates[r][c] = SudokuSolver.getCandidates(this.currentBoard, r, c);
          filledCount++;
        } else {
          this.manualCandidates[r][c] = [];
        }
      }
    }
    this.pencilType = 'manual';
    localStorage.setItem('sudoku_pencil_type', 'manual');
    this.showCandidates = true;

    // Cập nhật radio button trong modal
    if (this.dom.pencilSettingsModal) {
      const manualRadio = this.dom.pencilSettingsModal.querySelector('input[name="pencil-mode-type"][value="manual"]');
      if (manualRadio) manualRadio.checked = true;
      const autoRadio = this.dom.pencilSettingsModal.querySelector('input[name="pencil-mode-type"][value="auto"]');
      if (autoRadio) autoRadio.checked = false;
    }

    // Hiệu ứng phản hồi tức thì trên nút bấm
    if (this.dom.btnAutoFillNotes) {
      const origHtml = this.dom.btnAutoFillNotes.innerHTML;
      this.dom.btnAutoFillNotes.innerHTML = '✓ Đã điền xong tất cả ứng viên!';
      this.dom.btnAutoFillNotes.style.background = 'rgba(16, 185, 129, 0.25)';
      this.dom.btnAutoFillNotes.style.borderColor = '#10b981';
      this.dom.btnAutoFillNotes.style.color = '#10b981';
      setTimeout(() => {
        if (this.dom.btnAutoFillNotes) {
          this.dom.btnAutoFillNotes.innerHTML = origHtml;
          this.dom.btnAutoFillNotes.style.background = '';
          this.dom.btnAutoFillNotes.style.borderColor = '';
          this.dom.btnAutoFillNotes.style.color = '';
        }
      }, 1500);
    }

    this.renderBoard();
    this.updateInspector();
    this.playSound('step');
    this.setStatus(`✨ Đã tự động điền ứng viên hợp lệ vào ${filledCount} ô trống dưới dạng ghi chú nháp!`, 'valid');
  }

  /**
   * Xóa sạch toàn bộ số nháp ghi chú trên toàn bàn cờ
   */
  clearAllNotes() {
    this.manualCandidates = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
    this.manualBannedCandidates = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
    // Chuyển ngay chế độ sang Thủ công để không bị hệ thống tự động sinh lại ứng viên
    this.pencilType = 'manual';
    localStorage.setItem('sudoku_pencil_type', 'manual');

    // Cập nhật radio button trong modal
    const manualRadio = document.querySelector('input[name="pencil-mode-type"][value="manual"]');
    if (manualRadio) manualRadio.checked = true;
    const autoRadio = document.querySelector('input[name="pencil-mode-type"][value="auto"]');
    if (autoRadio) autoRadio.checked = false;

    // Hiệu ứng phản hồi tức thì trên nút bấm
    if (this.dom.btnClearAllNotes) {
      const origHtml = this.dom.btnClearAllNotes.innerHTML;
      this.dom.btnClearAllNotes.innerHTML = '✓ Đã xóa sạch tất cả ghi chú!';
      this.dom.btnClearAllNotes.style.background = 'rgba(16, 185, 129, 0.25)';
      this.dom.btnClearAllNotes.style.borderColor = '#10b981';
      this.dom.btnClearAllNotes.style.color = '#10b981';
      setTimeout(() => {
        if (this.dom.btnClearAllNotes) {
          this.dom.btnClearAllNotes.innerHTML = origHtml;
          this.dom.btnClearAllNotes.style.background = '';
          this.dom.btnClearAllNotes.style.borderColor = '';
          this.dom.btnClearAllNotes.style.color = '';
        }
      }, 1500);
    }

    this.renderBoard();
    this.updateInspector();
    this.playSound('step');
    this.setStatus('🧹 Đã xóa sạch toàn bộ số nháp ghi chú trên bàn cờ!', 'valid');
  }

  /**
   * Cập nhật nhãn trạng thái của tùy chỉnh Tiến trình bước giải
   */
  updateForwardStepsBadge(isEnabled) {
    if (this.dom.forwardStepsStatusBadge) {
      if (isEnabled) {
        this.dom.forwardStepsStatusBadge.textContent = 'Đang bật';
        this.dom.forwardStepsStatusBadge.style.background = 'rgba(16, 185, 129, 0.18)';
        this.dom.forwardStepsStatusBadge.style.color = '#34d399';
      } else {
        this.dom.forwardStepsStatusBadge.textContent = 'Chỉ xem quá khứ';
        this.dom.forwardStepsStatusBadge.style.background = 'rgba(239, 68, 68, 0.18)';
        this.dom.forwardStepsStatusBadge.style.color = '#f87171';
      }
    }
  }

  /**
   * Mở Modal Tùy Chỉnh Cài Đặt Hợp Nhất (Unified Settings Modal)
   * @param {'crosshatch' | 'pencil' | 'mistakes' | 'walkthrough'} defaultTab
   */
  openUnifiedSettingsModal(defaultTab = 'crosshatch') {
    if (this.arenaManager && this.arenaManager.isActive) {
      this.arenaManager.showTemporaryToast('🔒 Cài đặt hiển thị đã được khóa cố định theo luật Đấu Trường Extreme!');
      this.playSound('conflict');
      return;
    }

    // 1. Đồng bộ cài đặt Tia gióng (Crosshatch)
    const crossRadio = document.querySelector(`input[name="crosshatch-mode-type"][value="${this.crosshatchMode}"]`);
    if (crossRadio) crossRadio.checked = true;
    if (this.dom.toggleSameDigitColor) {
      this.dom.toggleSameDigitColor.checked = this.sameDigitMatchColor;
    }
    if (this.dom.toggleCrosshatchBoxes) {
      this.dom.toggleCrosshatchBoxes.checked = this.crosshatchIncludeBoxes;
    }

    // 2. Đồng bộ cài đặt Bút chì (Pencil)
    const pencilRadio = document.querySelector(`input[name="pencil-mode-type"][value="${this.pencilType}"]`);
    if (pencilRadio) pencilRadio.checked = true;
    if (this.dom.toggleAutoRemoveNotes) {
      this.dom.toggleAutoRemoveNotes.checked = this.autoRemoveNotes;
    }
    if (this.dom.toggleHighlightMatchingNotes) {
      this.dom.toggleHighlightMatchingNotes.checked = this.highlightMatchingNotes;
    }

    // 3. Đồng bộ cài đặt Giới hạn lỗi (Mistakes)
    const mistakeRadios = document.querySelectorAll('input[name="mistake-limit"]');
    let matchedMistake = false;
    mistakeRadios.forEach(radio => {
      if (radio.value === this.maxMistakes) {
        radio.checked = true;
        matchedMistake = true;
      } else {
        radio.checked = false;
      }
    });
    if (!matchedMistake) {
      const customRadio = document.querySelector('input[name="mistake-limit"][value="custom"]');
      if (customRadio) {
        customRadio.checked = true;
        if (this.dom.inputCustomMistakes) {
          this.dom.inputCustomMistakes.value = this.maxMistakes;
        }
      }
    }
    if (this.dom.toggleInstantFeedback) {
      this.dom.toggleInstantFeedback.checked = this.instantFeedback;
    }

    // 4. Đồng bộ cài đặt Tiến trình bước giải tương lai (Walkthrough)
    if (this.dom.toggleAllowForwardSteps) {
      this.dom.toggleAllowForwardSteps.checked = this.allowForwardSteps;
      this.updateForwardStepsBadge(this.allowForwardSteps);
    }

    // 5. Đồng bộ cài đặt Thời gian (Timer)
    const timerRadio = document.querySelector(`input[name="normal-timer-mode"][value="${this.normalTimerMode}"]`);
    if (timerRadio) {
      timerRadio.checked = true;
      this.updateTimerModeVisuals(this.normalTimerMode);
    }
    if (this.dom.normalTimerCustomMinutes) {
      this.dom.normalTimerCustomMinutes.value = this.normalCountdownMinutes;
    }
    const quickTimerBtns = document.querySelectorAll('.btn-normal-timer-quick');
    quickTimerBtns.forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.mins, 10) === this.normalCountdownMinutes);
    });

    // 5b. Đồng bộ cài đặt Kaitun Suy Luận
    if (this.dom.toggleKaitunMode) {
      this.dom.toggleKaitunMode.checked = this.kaitunModeEnabled;
    }
    const kaitunTimerRadios = document.querySelectorAll('input[name="kaitun-timer-type"]');
    let matchedKaitunTimer = false;
    kaitunTimerRadios.forEach(radio => {
      if (parseInt(radio.value, 10) === this.kaitunDuration) {
        radio.checked = true;
        matchedKaitunTimer = true;
      } else {
        radio.checked = false;
      }
    });
    if (!matchedKaitunTimer) {
      const customKaitunRadio = document.querySelector('input[name="kaitun-timer-type"][value="custom"]');
      if (customKaitunRadio) {
        customKaitunRadio.checked = true;
        if (this.dom.inputCustomKaitunSeconds) {
          this.dom.inputCustomKaitunSeconds.value = this.kaitunDuration;
        }
      }
    }

    // 6. Chuyển sang Tab được yêu cầu
    this.switchSettingsTab(defaultTab);

    // Hiển thị modal chính và đồng bộ active lên các shell compatibility
    if (this.dom.unifiedSettingsModal) {
      this.dom.unifiedSettingsModal.classList.add('active');
    }
    if (this.dom.crosshatchSettingsModal) this.dom.crosshatchSettingsModal.classList.add('active');
    if (this.dom.pencilSettingsModal) this.dom.pencilSettingsModal.classList.add('active');
    if (this.dom.mistakesSettingsModal) this.dom.mistakesSettingsModal.classList.add('active');
  }

  /**
   * Chuyển tab trong modal tùy chỉnh hợp nhất
   */
  switchSettingsTab(tabName = 'crosshatch') {
    const tabBtns = document.querySelectorAll('.settings-tab-btn');
    const tabPanes = document.querySelectorAll('.settings-tab-pane');

    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-pane-${tabName}`);
    });
  }

  /**
   * Đóng Modal Tùy Chỉnh Hợp Nhất
   */
  closeUnifiedSettingsModal() {
    if (this.dom.unifiedSettingsModal) {
      this.dom.unifiedSettingsModal.classList.remove('active');
    }
    if (this.dom.crosshatchSettingsModal) this.dom.crosshatchSettingsModal.classList.remove('active');
    if (this.dom.pencilSettingsModal) this.dom.pencilSettingsModal.classList.remove('active');
    if (this.dom.mistakesSettingsModal) this.dom.mistakesSettingsModal.classList.remove('active');
  }

  /**
   * Lưu và áp dụng toàn bộ cài đặt (Tia gióng + Bút chì + Số lượt lỗi)
   */
  saveUnifiedSettings() {
    // 1. Lưu Tia gióng
    const checkedCrossRadio = document.querySelector('input[name="crosshatch-mode-type"]:checked');
    if (checkedCrossRadio) {
      this.crosshatchMode = checkedCrossRadio.value;
      localStorage.setItem('sudoku_crosshatch_mode', this.crosshatchMode);
    }
    if (this.dom.toggleSameDigitColor) {
      this.sameDigitMatchColor = this.dom.toggleSameDigitColor.checked;
      localStorage.setItem('sudoku_same_digit_match_color', String(this.sameDigitMatchColor));
    }
    if (this.dom.toggleCrosshatchBoxes) {
      this.crosshatchIncludeBoxes = this.dom.toggleCrosshatchBoxes.checked;
      localStorage.setItem('sudoku_crosshatch_boxes', String(this.crosshatchIncludeBoxes));
    }

    // 2. Lưu Bút chì
    const selectedPencilRadio = document.querySelector('input[name="pencil-mode-type"]:checked');
    if (selectedPencilRadio) {
      this.pencilType = selectedPencilRadio.value;
      localStorage.setItem('sudoku_pencil_type', this.pencilType);
      if (this.pencilType === 'auto') {
        this.showCandidates = true;
      }
    }
    if (this.dom.toggleAutoRemoveNotes) {
      this.autoRemoveNotes = this.dom.toggleAutoRemoveNotes.checked;
      localStorage.setItem('sudoku_auto_remove_notes', this.autoRemoveNotes);
    }
    if (this.dom.toggleHighlightMatchingNotes) {
      this.highlightMatchingNotes = this.dom.toggleHighlightMatchingNotes.checked;
      localStorage.setItem('sudoku_highlight_matching_notes', this.highlightMatchingNotes);
    }

    // 3. Lưu Giới hạn lỗi
    const selectedMistakeRadio = document.querySelector('input[name="mistake-limit"]:checked');
    let newLimit = '3';
    if (selectedMistakeRadio) {
      if (selectedMistakeRadio.value === 'custom') {
        const val = parseInt(this.dom.inputCustomMistakes?.value, 10) || 7;
        newLimit = String(Math.max(1, Math.min(99, val)));
        localStorage.setItem('sudoku_custom_mistakes_val', newLimit);
      } else {
        newLimit = selectedMistakeRadio.value;
      }
    }
    this.maxMistakes = newLimit;
    localStorage.setItem('sudoku_max_mistakes', this.maxMistakes);

    if (this.dom.toggleInstantFeedback) {
      this.instantFeedback = this.dom.toggleInstantFeedback.checked;
      localStorage.setItem('sudoku_instant_feedback', this.instantFeedback);
    }

    if (this.currentGameRecord) {
      this.currentGameRecord.maxMistakes = this.maxMistakes;
      this.saveRecentGames();
    }

    // 4. Lưu Tiến trình bước giải tương lai (Walkthrough)
    if (this.dom.toggleAllowForwardSteps) {
      this.allowForwardSteps = this.dom.toggleAllowForwardSteps.checked;
      localStorage.setItem('sudoku_allow_forward_steps', String(this.allowForwardSteps));

      if (!this.allowForwardSteps) {
        if (this.isPreviewMode) {
          this.closePreview(false);
        }
        if (this.dom.toggleSolution) {
          this.dom.toggleSolution.checked = false;
          this.showSolution = false;
        }
        const userMovesCount = this.userMovesHistory ? this.userMovesHistory.length : 0;
        if (this.currentStepIndex > userMovesCount) {
          this.goToStep(userMovesCount);
        }
      }
    }

    // 5. Lưu Cài đặt Thời gian (Timer)
    const checkedTimerRadio = document.querySelector('input[name="normal-timer-mode"]:checked');
    if (checkedTimerRadio) {
      this.normalTimerMode = checkedTimerRadio.value;
      localStorage.setItem('sudoku_timer_mode', this.normalTimerMode);
    }
    if (this.dom.normalTimerCustomMinutes) {
      const mins = parseInt(this.dom.normalTimerCustomMinutes.value, 10) || 10;
      this.normalCountdownMinutes = Math.max(1, Math.min(180, mins));
      localStorage.setItem('sudoku_timer_countdown_mins', String(this.normalCountdownMinutes));
    }
    this.applyNormalTimerSettings();

    // 6. Lưu Cài đặt Kaitun Suy Luận
    if (this.dom.toggleKaitunMode) {
      this.kaitunModeEnabled = this.dom.toggleKaitunMode.checked;
      localStorage.setItem('sudoku_kaitun_mode', String(this.kaitunModeEnabled));
    }
    const checkedKaitunRadio = document.querySelector('input[name="kaitun-timer-type"]:checked');
    if (checkedKaitunRadio) {
      if (checkedKaitunRadio.value === 'custom') {
        const val = parseInt(this.dom.inputCustomKaitunSeconds?.value, 10) || 5;
        this.kaitunDuration = Math.max(1, Math.min(60, val));
      } else {
        this.kaitunDuration = parseInt(checkedKaitunRadio.value, 10);
      }
      localStorage.setItem('sudoku_kaitun_duration', String(this.kaitunDuration));
    }
    this.updateQuickKaitunUI();
    if (!this.kaitunModeEnabled) {
      this.clearKaitunInference();
    } else if (this.selectedCell) {
      this.triggerKaitunInference(this.selectedCell.row, this.selectedCell.col);
    }

    this.updateCrosshatchBtnLabel();
    this.updatePencilUI();
    this.updateMistakeBadge();
    this.updateSolutionPreviewLockUI();
    this.syncSolvingWalkthroughWithCurrentBoard();
    this.renderFormulaModalApplications();
    this.closeUnifiedSettingsModal();
    this.renderBoard();
    this.updateInspector();
    this.playSound('correct');
    this.setStatus('✓ Đã lưu thành công toàn bộ cài đặt tùy chỉnh!', 'valid');
  }

  /**
   * Cập nhật giao diện khóa trực quan cho thẻ Xem trước đáp án khi tắt xem trước tương lai
   */
  updateSolutionPreviewLockUI() {
    if (!this.dom.toggleSolution) return;
    if (!this.allowForwardSteps) {
      this.dom.toggleSolution.checked = false;
      this.dom.toggleSolution.disabled = true;
      this.showSolution = false;
      if (this.dom.solutionPreviewSubtext) {
        this.dom.solutionPreviewSubtext.innerHTML = '<span style="color: var(--accent-rose); font-weight: 600;">🔒 Đã khóa xem trước</span> (Đang bật chế độ tự giải trong Tùy chỉnh)';
      }
      if (this.dom.btnFillAllSolution) {
        this.dom.btnFillAllSolution.disabled = true;
        this.dom.btnFillAllSolution.style.opacity = '0.5';
        this.dom.btnFillAllSolution.style.cursor = 'not-allowed';
      }
    } else {
      this.dom.toggleSolution.disabled = false;
      if (this.dom.solutionPreviewSubtext) {
        this.dom.solutionPreviewSubtext.textContent = 'Bật để xem trước hoặc điền đáp án chuẩn';
      }
      if (this.dom.btnFillAllSolution) {
        this.dom.btnFillAllSolution.disabled = false;
        this.dom.btnFillAllSolution.style.opacity = '1';
        this.dom.btnFillAllSolution.style.cursor = 'pointer';
      }
    }
  }

  /**
   * Mở Modal Tùy Chỉnh Bút Chì (Hỗ trợ tương thích ngược)
   */
  openPencilSettingsModal() {
    this.openUnifiedSettingsModal('pencil');
  }

  /**
   * Đóng Modal Tùy Chỉnh Bút Chì
   */
  closePencilSettingsModal() {
    this.closeUnifiedSettingsModal();
  }

  /**
   * Lưu và áp dụng cài đặt Bút chì
   */
  savePencilSettings() {
    const selectedRadio = document.querySelector('input[name="pencil-mode-type"]:checked');
    if (selectedRadio) {
      this.pencilType = selectedRadio.value;
      localStorage.setItem('sudoku_pencil_type', this.pencilType);
      if (this.pencilType === 'auto') {
        this.showCandidates = true;
      }
    }
    if (this.dom.toggleAutoRemoveNotes) {
      this.autoRemoveNotes = this.dom.toggleAutoRemoveNotes.checked;
      localStorage.setItem('sudoku_auto_remove_notes', this.autoRemoveNotes);
    }
    if (this.dom.toggleHighlightMatchingNotes) {
      this.highlightMatchingNotes = this.dom.toggleHighlightMatchingNotes.checked;
      localStorage.setItem('sudoku_highlight_matching_notes', this.highlightMatchingNotes);
    }
    this.closeUnifiedSettingsModal();
    this.renderBoard();
    this.playSound('step');
    this.setStatus(`✓ Đã lưu cài đặt: ${this.pencilType === 'manual' ? 'Chế độ Bút chì thủ công' : 'Chế độ Tự động tính ứng viên'}!`, 'valid');
  }

  /**
   * Tính tập hợp các ô (r, c) bị loại trừ candidate num theo logic Sudoku:
   * 1. Ô cùng hàng, cột, khối với số num đã được đặt cố định
   * 2. Single in Unit: Nếu num trong 1 box/hàng/cột chỉ còn duy nhất 1 ô hợp lệ, ô đó được chốt (Mắt xích Vàng) -> loại trừ hàng, cột tương ứng
   * 3. Pointing / Claiming: Nếu num trong 1 box chỉ nằm trên 1 hàng/cột, thì các ô ngoài box trên hàng/cột đó bị loại trừ
   * 4. Box-Line Reduction (Claiming): Nếu num trên 1 hàng/cột chỉ nằm trong 1 box, thì các ô khác trong box bị loại trừ
   * 5. Cánh bướm X-Wing: 2 hàng cùng chứa num ở 2 cột tương ứng -> triệt tiêu num trên 2 cột đó
   */
  getEliminatedCandidateCells(num, candidatesMap) {
    if (!num) return new Set();
    const elimSet = new Set();
    this.candidateEliminationReasons = new Map();
    this.candidateConfirmedCells = new Set();

    // 1. Trực tiếp từ các ô đã điền num trên bàn cờ
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = (this.showSolution && this.solution) ? this.solution[r][c] : this.currentBoard[r][c];
        if (val === num) {
          // Cùng Hàng
          for (let j = 0; j < 9; j++) {
            if (j !== c) {
              const k = `${r},${j}`;
              elimSet.add(k);
              if (!this.candidateEliminationReasons.has(k)) {
                this.candidateEliminationReasons.set(k, `Cùng Hàng ${r + 1} với ô (${r + 1}, ${c + 1}) = ${num}`);
              }
            }
          }
          // Cùng Cột
          for (let i = 0; i < 9; i++) {
            if (i !== r) {
              const k = `${i},${c}`;
              elimSet.add(k);
              if (!this.candidateEliminationReasons.has(k)) {
                this.candidateEliminationReasons.set(k, `Cùng Cột ${c + 1} với ô (${r + 1}, ${c + 1}) = ${num}`);
              }
            }
          }
          // Cùng Khối 3x3
          const br = Math.floor(r / 3) * 3;
          const bc = Math.floor(c / 3) * 3;
          for (let i = br; i < br + 3; i++) {
            for (let j = bc; j < bc + 3; j++) {
              if (i !== r || j !== c) {
                const k = `${i},${j}`;
                elimSet.add(k);
                if (!this.candidateEliminationReasons.has(k)) {
                  this.candidateEliminationReasons.set(k, `Cùng Khối 3x3 với ô (${r + 1}, ${c + 1}) = ${num}`);
                }
              }
            }
          }
        }
      }
    }

    if (!candidatesMap) return elimSet;

    // Grid các ô còn khả năng chứa num
    const isCandAvailable = (r, c) => {
      return this.currentBoard[r][c] === 0 && candidatesMap[r] && candidatesMap[r][c] && candidatesMap[r][c].includes(num) && !elimSet.has(`${r},${c}`);
    };

    let changed = true;
    let loops = 0;

    while (changed && loops < 10) {
      changed = false;
      loops++;

      // A. Duyệt theo từng Khối 3x3 (Hidden Single & Pointing)
      for (let b = 0; b < 9; b++) {
        const br = Math.floor(b / 3) * 3;
        const bc = (b % 3) * 3;
        const validInBox = [];

        for (let r = br; r < br + 3; r++) {
          for (let c = bc; c < bc + 3; c++) {
            if (isCandAvailable(r, c)) validInBox.push({ r, c });
          }
        }

        // Đơn lẻ ẩn trong Khối 3x3 (Hidden Single in Box)
        if (validInBox.length === 1) {
          const p = validInBox[0];
          const key = `${p.r},${p.c}`;
          if (!this.candidateConfirmedCells.has(key)) {
            this.candidateConfirmedCells.add(key);
            for (let c = 0; c < 9; c++) {
              if (c !== p.c && isCandAvailable(p.r, c)) {
                const k = `${p.r},${c}`;
                elimSet.add(k);
                this.candidateEliminationReasons.set(k, `Số ${num} duy nhất trong Khối ${b + 1} tại ô (${p.r + 1}, ${p.c + 1}) khóa toàn bộ Hàng ${p.r + 1}`);
                changed = true;
              }
            }
            for (let r = 0; r < 9; r++) {
              if (r !== p.r && isCandAvailable(r, p.c)) {
                const k = `${r},${p.c}`;
                elimSet.add(k);
                this.candidateEliminationReasons.set(k, `Số ${num} duy nhất trong Khối ${b + 1} tại ô (${p.r + 1}, ${p.c + 1}) khóa toàn bộ Cột ${p.c + 1}`);
                changed = true;
              }
            }
          }
        }

        // Khóa tia trong Khối (Pointing Lines)
        if (validInBox.length > 1) {
          const boxCandRows = new Set(validInBox.map(p => p.r));
          if (boxCandRows.size === 1) {
            const row = Array.from(boxCandRows)[0];
            for (let c = 0; c < 9; c++) {
              if ((c < bc || c >= bc + 3) && isCandAvailable(row, c)) {
                const k = `${row},${c}`;
                elimSet.add(k);
                this.candidateEliminationReasons.set(k, `Khóa tia Pointing: Số ${num} trong Khối ${b + 1} chỉ nằm trên Hàng ${row + 1}`);
                changed = true;
              }
            }
          }
          const boxCandCols = new Set(validInBox.map(p => p.c));
          if (boxCandCols.size === 1) {
            const col = Array.from(boxCandCols)[0];
            for (let r = 0; r < 9; r++) {
              if ((r < br || r >= br + 3) && isCandAvailable(r, col)) {
                const k = `${r},${col}`;
                elimSet.add(k);
                this.candidateEliminationReasons.set(k, `Khóa tia Pointing: Số ${num} trong Khối ${b + 1} chỉ nằm trên Cột ${col + 1}`);
                changed = true;
              }
            }
          }
        }
      }

      // B. Chặn ngược Khối (Claiming / Box-Line Reduction theo Hàng)
      for (let r = 0; r < 9; r++) {
        const validInRow = [];
        for (let c = 0; c < 9; c++) {
          if (isCandAvailable(r, c)) validInRow.push({ r, c });
        }
        if (validInRow.length > 1) {
          const boxes = new Set(validInRow.map(p => Math.floor(p.c / 3)));
          if (boxes.size === 1) {
            const bIdx = Array.from(boxes)[0];
            const br = Math.floor(r / 3) * 3;
            const bc = bIdx * 3;
            for (let i = br; i < br + 3; i++) {
              if (i !== r) {
                for (let j = bc; j < bc + 3; j++) {
                  if (isCandAvailable(i, j)) {
                    const k = `${i},${j}`;
                    elimSet.add(k);
                    this.candidateEliminationReasons.set(k, `Chặn ngược Claiming: Số ${num} trên Hàng ${r + 1} chỉ nằm trong Khối ${Math.floor(r / 3) * 3 + bIdx + 1}`);
                    changed = true;
                  }
                }
              }
            }
          }
        }
      }

      // C. Chặn ngược Khối (Claiming / Box-Line Reduction theo Cột)
      for (let c = 0; c < 9; c++) {
        const validInCol = [];
        for (let r = 0; r < 9; r++) {
          if (isCandAvailable(r, c)) validInCol.push({ r, c });
        }
        if (validInCol.length > 1) {
          const boxes = new Set(validInCol.map(p => Math.floor(p.r / 3)));
          if (boxes.size === 1) {
            const bIdx = Array.from(boxes)[0];
            const br = bIdx * 3;
            const bc = Math.floor(c / 3) * 3;
            for (let i = br; i < br + 3; i++) {
              for (let j = bc; j < bc + 3; j++) {
                if (j !== c && isCandAvailable(i, j)) {
                  const k = `${i},${j}`;
                  elimSet.add(k);
                  this.candidateEliminationReasons.set(k, `Chặn ngược Claiming: Số ${num} trên Cột ${c + 1} chỉ nằm trong Khối`);
                  changed = true;
                }
              }
            }
          }
        }
      }

      // D. Cánh bướm X-Wing (Theo 2 Hàng -> Triệt tiêu 2 Cột)
      const rowCandCols = [];
      for (let r = 0; r < 9; r++) {
        const cols = [];
        for (let c = 0; c < 9; c++) {
          if (isCandAvailable(r, c)) cols.push(c);
        }
        rowCandCols.push(cols);
      }
      for (let r1 = 0; r1 < 8; r1++) {
        if (rowCandCols[r1].length === 2) {
          const [c1, c2] = rowCandCols[r1];
          for (let r2 = r1 + 1; r2 < 9; r2++) {
            if (rowCandCols[r2].length === 2 && rowCandCols[r2][0] === c1 && rowCandCols[r2][1] === c2) {
              for (let r = 0; r < 9; r++) {
                if (r !== r1 && r !== r2) {
                  if (isCandAvailable(r, c1)) {
                    const k = `${r},${c1}`;
                    elimSet.add(k);
                    this.candidateEliminationReasons.set(k, `Cánh bướm X-Wing trên Hàng ${r1 + 1} & ${r2 + 1} triệt tiêu Cột ${c1 + 1}`);
                    changed = true;
                  }
                  if (isCandAvailable(r, c2)) {
                    const k = `${r},${c2}`;
                    elimSet.add(k);
                    this.candidateEliminationReasons.set(k, `Cánh bướm X-Wing trên Hàng ${r1 + 1} & ${r2 + 1} triệt tiêu Cột ${c2 + 1}`);
                    changed = true;
                  }
                }
              }
            }
          }
        }
      }
    }

    return elimSet;
  }

  /**
   * Lấy danh sách các ô sẽ chiếu tia gióng ngang dọc dựa theo cài đặt crosshatchMode (1, 2, 3, all, none)
   */
  getCrosshatchRayCasters(targetVal) {
    if (!targetVal || targetVal === 0) return [];

    // Tìm tất cả các ô có cùng số targetVal trên bàn cờ
    const matchingCells = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = (this.showSolution && this.solution) ? this.solution[r][c] : this.currentBoard[r][c];
        if (val === targetVal) {
          matchingCells.push({ r, c });
        }
      }
    }

    if (matchingCells.length === 0) return [];
    if (this.crosshatchMode === 'none') {
      return this.selectedCell ? [{ r: this.selectedCell.row, c: this.selectedCell.col }] : [];
    }
    if (this.crosshatchMode === 'all') {
      return matchingCells;
    }

    const maxCount = parseInt(this.crosshatchMode, 10);
    if (isNaN(maxCount) || maxCount <= 0) return matchingCells;

    // Nếu có ô đang chọn và ô đó có cùng targetVal, đưa ô đang chọn lên vị trí đầu tiên
    let rayCasters = [];
    if (this.selectedCell) {
      const selR = this.selectedCell.row;
      const selC = this.selectedCell.col;
      const selIdx = matchingCells.findIndex(p => p.r === selR && p.c === selC);

      if (selIdx !== -1) {
        rayCasters.push(matchingCells[selIdx]);
        // Sắp xếp các ô còn lại theo khoảng cách Manhattan đến ô đang chọn
        const remaining = matchingCells.filter((_, idx) => idx !== selIdx);
        remaining.sort((a, b) => {
          const distA = Math.abs(a.r - selR) + Math.abs(a.c - selC);
          const distB = Math.abs(b.r - selR) + Math.abs(b.c - selC);
          return distA - distB;
        });
        rayCasters = rayCasters.concat(remaining.slice(0, maxCount - 1));
        return rayCasters;
      }
    }

    return matchingCells.slice(0, maxCount);
  }

  /**
   * Chuyển nhanh chế độ tia gióng ngang dọc (all -> 3 -> 2 -> 1 -> none -> all)
   */
  cycleCrosshatchMode() {
    const modes = ['all', '3', '2', '1', 'none'];
    const currentIdx = modes.indexOf(this.crosshatchMode);
    const nextIdx = (currentIdx + 1) % modes.length;
    this.crosshatchMode = modes[nextIdx];
    localStorage.setItem('sudoku_crosshatch_mode', this.crosshatchMode);

    this.updateCrosshatchBtnLabel();
    this.renderBoard();
    this.updateInspector();
    this.playSound('step');

    const labelMap = {
      'all': '🌟 Chiếu tia tất cả các số',
      '3': '3️⃣ Chiếu tia 3 số (Ô chọn + 2 số gần nhất)',
      '2': '2️⃣ Chiếu tia 2 số (Ô chọn + 1 số gần nhất)',
      '1': '1️⃣ Chiếu tia 1 số (Chỉ ô đang chọn)',
      'none': '🚫 Tắt tia gióng ngang dọc'
    };
    this.setStatus(labelMap[this.crosshatchMode] || `Tia gióng: ${this.crosshatchMode}`);
  }

  /**
   * Cập nhật nhãn nút tia gióng trên thanh công cụ
   */
  updateCrosshatchBtnLabel() {
    if (!this.dom.crosshatchBtnLabel) return;
    const labels = {
      'all': 'Tia gióng: Tất cả',
      '3': 'Tia gióng: 3 số',
      '2': 'Tia gióng: 2 số',
      '1': 'Tia gióng: 1 số',
      'none': 'Tia gióng: Tắt'
    };
    this.dom.crosshatchBtnLabel.textContent = labels[this.crosshatchMode] || 'Tia gióng: Tất cả';
    if (this.dom.btnCrosshatchToggle) {
      this.dom.btnCrosshatchToggle.classList.toggle('btn-crosshatch-active', this.crosshatchMode !== 'none');
    }
  }

  /**
   * Mở Modal Tùy Chỉnh Tia Gióng (Hỗ trợ tương thích ngược)
   */
  openCrosshatchSettingsModal() {
    this.openUnifiedSettingsModal('crosshatch');
  }

  /**
   * Đóng Modal Tùy Chỉnh Tia Gióng
   */
  closeCrosshatchSettingsModal() {
    this.closeUnifiedSettingsModal();
  }

  /**
   * Lưu và áp dụng cài đặt tia gióng
   */
  saveCrosshatchSettings() {
    const checkedRadio = document.querySelector('input[name="crosshatch-mode-type"]:checked');
    if (checkedRadio) {
      this.crosshatchMode = checkedRadio.value;
      localStorage.setItem('sudoku_crosshatch_mode', this.crosshatchMode);
    }

    if (this.dom.toggleSameDigitColor) {
      this.sameDigitMatchColor = this.dom.toggleSameDigitColor.checked;
      localStorage.setItem('sudoku_same_digit_match_color', String(this.sameDigitMatchColor));
    }

    if (this.dom.toggleCrosshatchBoxes) {
      this.crosshatchIncludeBoxes = this.dom.toggleCrosshatchBoxes.checked;
      localStorage.setItem('sudoku_crosshatch_boxes', String(this.crosshatchIncludeBoxes));
    }

    this.updateCrosshatchBtnLabel();
    this.closeUnifiedSettingsModal();
    this.renderBoard();
    this.updateInspector();
    this.playSound('correct');
    this.setStatus('✓ Đã cập nhật cài đặt tia gióng ngang dọc & màu sắc!', 'valid');
  }

  // ==========================================
  // NORMAL GAME TIMER SYSTEM
  // ==========================================
  startNormalTimer() {
    this.stopNormalTimer();
    if (this.arenaManager && this.arenaManager.isActive) {
      if (this.dom.normalTimerBadge) this.dom.normalTimerBadge.style.display = 'none';
      return;
    }
    if (this.normalTimerMode === 'none') {
      if (this.dom.normalTimerBadge) this.dom.normalTimerBadge.style.display = 'none';
      return;
    }

    if (this.dom.normalTimerBadge) this.dom.normalTimerBadge.style.display = 'inline-flex';
    this.normalTimerElapsedSeconds = 0;
    this.normalTimerRemainingSeconds = this.normalCountdownMinutes * 60;
    this.updateNormalTimerDisplay();

    this.normalTimerInterval = setInterval(() => {
      if (this.normalTimerMode === 'countup') {
        this.normalTimerElapsedSeconds++;
        this.updateNormalTimerDisplay();
      } else if (this.normalTimerMode === 'countdown') {
        this.normalTimerRemainingSeconds--;
        this.updateNormalTimerDisplay();
        if (this.normalTimerRemainingSeconds <= 0) {
          this.onNormalTimerExpire();
        }
      }
    }, 1000);
  }

  stopNormalTimer() {
    if (this.normalTimerInterval) {
      clearInterval(this.normalTimerInterval);
      this.normalTimerInterval = null;
    }
  }

  updateNormalTimerDisplay() {
    if (!this.dom.normalTimerText) return;
    if (this.normalTimerMode === 'none' || (this.arenaManager && this.arenaManager.isActive)) {
      if (this.dom.normalTimerBadge) this.dom.normalTimerBadge.style.display = 'none';
      return;
    }
    if (this.dom.normalTimerBadge) this.dom.normalTimerBadge.style.display = 'inline-flex';

    let totalSecs = 0;
    if (this.normalTimerMode === 'countup') {
      totalSecs = this.normalTimerElapsedSeconds;
      if (this.dom.normalTimerIcon) this.dom.normalTimerIcon.textContent = '⏱️';
      if (this.dom.normalTimerBadge) this.dom.normalTimerBadge.classList.remove('timer-warning', 'timer-danger');
    } else {
      totalSecs = Math.max(0, this.normalTimerRemainingSeconds);
      if (this.dom.normalTimerIcon) this.dom.normalTimerIcon.textContent = '⏳';
      if (this.dom.normalTimerBadge) {
        if (totalSecs <= 30 && totalSecs > 0) {
          this.dom.normalTimerBadge.classList.add('timer-danger');
          this.dom.normalTimerBadge.classList.remove('timer-warning');
        } else if (totalSecs <= 60 && totalSecs > 0) {
          this.dom.normalTimerBadge.classList.add('timer-warning');
          this.dom.normalTimerBadge.classList.remove('timer-danger');
        } else {
          this.dom.normalTimerBadge.classList.remove('timer-warning', 'timer-danger');
        }
      }
    }

    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    this.dom.normalTimerText.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  onNormalTimerExpire() {
    this.stopNormalTimer();
    this.playSound('conflict');
    if (this.dom.normalTimerBadge) {
      this.dom.normalTimerBadge.classList.add('timer-danger');
    }
    this.setStatus('⌛ HẾT GIỜ! Bạn đã dùng hết thời gian thử thách!', 'conflict');
    setTimeout(() => {
      const cont = window.confirm('⌛ Đã hết thời gian quy định cho ván cờ này!\n\nBạn có muốn tiếp tục chơi không giới hạn thời gian không?');
      if (cont) {
        this.normalTimerMode = 'countup';
        this.startNormalTimer();
        this.setStatus('▶️ Tiếp tục chơi ván cờ với đồng hồ đếm xuôi!', 'valid');
      }
    }, 200);
  }

  updateTimerModeVisuals(selectedMode) {
    const radioLabels = {
      countup: document.getElementById('label-timer-mode-countup'),
      countdown: document.getElementById('label-timer-mode-countdown'),
      none: document.getElementById('label-timer-mode-none')
    };
    Object.keys(radioLabels).forEach(mode => {
      const lbl = radioLabels[mode];
      if (lbl) {
        if (mode === selectedMode) {
          lbl.style.background = 'rgba(56, 189, 248, 0.12)';
          lbl.style.borderColor = 'rgba(56, 189, 248, 0.4)';
        } else {
          lbl.style.background = 'rgba(255,255,255,0.03)';
          lbl.style.borderColor = 'var(--card-border)';
        }
      }
    });

    if (this.dom.normalTimerCountdownConfig) {
      this.dom.normalTimerCountdownConfig.style.display = (selectedMode === 'countdown') ? 'block' : 'none';
    }
  }

  applyNormalTimerSettings() {
    this.stopNormalTimer();
    this.startNormalTimer();
  }

  // ==========================================
  // CUSTOM PUZZLE & SEED SHARING (NORMAL MODE)
  // ==========================================
  checkInitialUrlParams() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const seedParam = urlParams.get('seed') || urlParams.get('m');
      const diffParam = urlParams.get('diff') || urlParams.get('level');
      const timerParam = urlParams.get('timer');
      const rateParam = urlParams.get('rate') || urlParams.get('winrate');
      if (seedParam) {
        this.loadPuzzleBySeed(seedParam, diffParam || 'medium', timerParam, null, rateParam || 'standard');
        return;
      }
    } catch (e) {
      console.warn('Không thể đọc tham số URL:', e);
    }
    this.loadSampleImage();
  }

  openCustomPuzzleModal() {
    if (this.arenaManager && this.arenaManager.isActive) {
      this.arenaManager.showTemporaryToast('⚠️ Hãy hoàn thành hoặc thoát Đấu Trường để tạo đề chơi chung!');
      return;
    }
    if (this.dom.customPuzzleSeedInput && !this.dom.customPuzzleSeedInput.value.trim()) {
      this.randomizeCustomSeed();
    }
    this.updateCustomPuzzleShareLink();
    if (this.dom.customPuzzleModal) {
      this.dom.customPuzzleModal.classList.add('active');
    }
  }

  closeCustomPuzzleModal() {
    if (this.dom.customPuzzleModal) {
      this.dom.customPuzzleModal.classList.remove('active');
    }
  }

  randomizeCustomSeed() {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    if (this.dom.customPuzzleSeedInput) {
      this.dom.customPuzzleSeedInput.value = String(randomNum);
    }
    this.updateCustomPuzzleShareLink();
  }

  getSelectedCustomDifficulty() {
    const activeBtn = document.querySelector('.btn-custom-diff.active');
    return activeBtn ? activeBtn.dataset.diff : 'medium';
  }

  getSelectedCustomWinRate() {
    const activeBtn = document.querySelector('.btn-custom-winrate.active');
    return activeBtn ? (activeBtn.dataset.rate || 'standard') : 'standard';
  }

  getSelectedCustomTimerConfig() {
    const activeBtn = document.querySelector('.btn-custom-timer-choice.active');
    if (!activeBtn) return { mode: 'countup', mins: 0 };
    return {
      mode: activeBtn.dataset.mode,
      mins: parseInt(activeBtn.dataset.mins, 10) || 0
    };
  }

  updateCustomPuzzleShareLink() {
    if (!this.dom.customShareUrlBox) return;
    const seed = (this.dom.customPuzzleSeedInput?.value.trim() || '2026').toUpperCase();
    const diff = this.getSelectedCustomDifficulty();
    const timerCfg = this.getSelectedCustomTimerConfig();
    const winRate = this.getSelectedCustomWinRate();

    const baseUrl = window.location.origin + window.location.pathname;
    let shareUrl = `${baseUrl}?seed=${encodeURIComponent(seed)}&diff=${diff}&timer=${timerCfg.mins}`;
    if (winRate && winRate !== 'standard') {
      shareUrl += `&rate=${winRate}`;
    }
    this.dom.customShareUrlBox.textContent = shareUrl;
    if (this.dom.customLinkCopiedToast) {
      this.dom.customLinkCopiedToast.style.display = 'none';
    }
  }

  copyCustomPuzzleShareLink() {
    const text = this.dom.customShareUrlBox?.textContent || '';
    if (!text) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        if (this.dom.customLinkCopiedToast) {
          this.dom.customLinkCopiedToast.style.display = 'block';
        }
      }).catch(() => this.fallbackCopy(text));
    } else {
      this.fallbackCopy(text);
    }
  }

  fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (this.dom.customLinkCopiedToast) {
        this.dom.customLinkCopiedToast.style.display = 'block';
      }
    } catch (err) {
      alert('Link chơi chung: ' + text);
    }
    document.body.removeChild(ta);
  }

  startCustomPuzzleFromModal() {
    const seed = (this.dom.customPuzzleSeedInput?.value.trim() || '2026').toUpperCase();
    const diff = this.getSelectedCustomDifficulty();
    const timerCfg = this.getSelectedCustomTimerConfig();
    const winRate = this.getSelectedCustomWinRate();

    this.closeCustomPuzzleModal();
    this.loadPuzzleBySeed(seed, diff, timerCfg.mins, timerCfg.mode, winRate);
  }

  loadPuzzleBySeed(seedStr, difficulty = 'medium', timerMinutes = null, timerMode = null, winRateTier = 'standard') {
    const seed = String(seedStr).trim().toUpperCase();
    const diff = String(difficulty || 'medium').toLowerCase();
    const rateTier = String(winRateTier || 'standard').toLowerCase();

    // Sinh ma trận câu đố và nghiệm chuẩn dựa trên Seed & Tỉ lệ thắng (Selective Carving)
    const puzzle = this.generatePuzzleFromSeed(seed, diff, rateTier);
    if (!puzzle || !puzzle.grid || !puzzle.sol) {
      this.setStatus('Lỗi tạo đề từ mã đề ' + seed, 'conflict');
      return;
    }

    // Cập nhật timer nếu có chỉ định
    if (timerMinutes !== null && timerMinutes !== undefined) {
      const mins = parseInt(timerMinutes, 10);
      if (mins > 0) {
        this.normalTimerMode = 'countdown';
        this.normalCountdownMinutes = mins;
      } else {
        this.normalTimerMode = (timerMode === 'none') ? 'none' : 'countup';
      }
    }

    // Nạp bàn cờ
    this.initialBoard = SudokuSolver.cloneBoard(puzzle.grid);
    this.currentBoard = SudokuSolver.cloneBoard(puzzle.grid);
    this.originalPuzzleGrid = SudokuSolver.cloneBoard(puzzle.grid);
    this.solution = SudokuSolver.cloneBoard(puzzle.sol);
    this.officialSolution = SudokuSolver.cloneBoard(puzzle.sol);

    this.isOriginalClue = Array.from({ length: 9 }, (_, r) =>
      Array.from({ length: 9 }, (_, c) => puzzle.grid[r][c] !== 0)
    );
    this.manualCandidates = Array.from({ length: 9 }, () => Array(9).fill(null).map(() => []));
    this.userMovesHistory = [];
    this.mistakesCount = 0;
    this.updateMistakeBadge();

    const diffNames = {
      easy: '🟢 Dễ',
      medium: '🟡 Vừa',
      hard: '🟠 Khó',
      extreme: '🔴 Cực khó',
      nightmare: '💀 Ác mộng 17 ô'
    };
    const diffName = diffNames[diff] || diff;

    const rateLabels = {
      nightmare: '< 10% (Ác mộng)',
      hardcore: '20 - 25% (Cực gắt)',
      standard: '30 - 40% (Tiêu chuẩn)',
      balanced: '> 45% (Cân bằng)'
    };
    const rateInfo = rateLabels[rateTier] ? ` • Thắng: ${rateLabels[rateTier]}` : '';

    this.activeCustomSeed = seed;
    this.activeCustomDifficulty = diff;
    this.activeCustomWinRate = rateTier;

    const clueCount = puzzle.grid.flat().filter(x => x > 0).length;
    this.solveAndPrepareWalkthrough(clueCount, puzzle.sol);

    this.startNewGameRecord(`Đề #${seed} (${diffName}${rateInfo ? ` • ${rateLabels[rateTier]}` : ''})`);
    this.renderBoard();
    this.updateInspector();
    this.syncSolvingWalkthroughWithCurrentBoard();
    this.updateSolutionPreviewLockUI();

    if (this.dom.fetchStatusInfo) {
      this.dom.fetchStatusInfo.innerHTML = `🎲 Đề <strong>#${seed}</strong> • ${diffName}${rateInfo} • ${clueCount} ô`;
    }
    this.switchMobileTab('board');

    this.playSound('step');
    this.setStatus(`🎮 Đã nạp Đề #${seed} • Cấp độ: ${diffName}${rateInfo}! Hãy cùng so tài nào!`, 'valid');
  }

  generatePuzzleFromSeed(seedStr, difficulty = 'medium', winRateTier = 'standard') {
    const basePuzzles = {
      easy: {
        m: '900508007080302905054000080070680032100004008500219060000906001726001040001470056',
        s: '913568427687342915254197683479685132162734598538219764345926871726851349891473256'
      },
      medium: {
        m: '203400005809160704006030019702003060008250000001607002007005926930720000600090470',
        s: '213479685859162734476538219742913568368254197591687342187345926934726851625891473'
      },
      hard: {
        m: '100034008070680030008210704054090680910508020080300005305906871006000040001070200',
        s: '162734598479685132538219764254197683913568427687342915345926871726851349891473256'
      },
      extreme: {
        m: '300049000000600501752001000001000700500396000008150096003010060004000100000028000',
        s: '316549827489672531752831649691284753547396218238157496873415962924763185165928374'
      },
      nightmare: {
        m: '800000000003600000070090200050007000000045700000100030001000068008500010090000400',
        s: '812753649943682175675491283154237896369845721287169534521974368438526917796318452'
      }
    };

    let s = 0;
    const str = String(seedStr).trim();
    for (let i = 0; i < str.length; i++) {
      s = ((s << 5) - s) + str.charCodeAt(i);
      s |= 0;
    }
    s = (Math.abs(s) || 1367) % 2147483647;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };

    // Số lượng manh mối đích dựa trên Tỉ lệ thắng mục tiêu (Thuật toán Bào ô Selective Clue Carving)
    const targetCluesMap = {
      nightmare: 19,
      hardcore: 22,
      standard: 25,
      balanced: 29
    };
    const targetClues = targetCluesMap[winRateTier] || 25;

    // Lấy ma trận hạt nhân chuẩn từ kho 712 đề dựa trên mã Seed và Cấp độ
    const bank = (typeof window !== 'undefined' && window.SUDOKU_PUZZLE_BANK) ? window.SUDOKU_PUZZLE_BANK : null;
    const cleanSeed = str.toUpperCase();
    let exactMatch = null;
    if (bank) {
      if (bank[difficulty]) {
        exactMatch = bank[difficulty].find(p => String(p.id).toUpperCase() === cleanSeed);
      }
      if (!exactMatch && bank.nightmare) {
        exactMatch = bank.nightmare.find(p => String(p.id).toUpperCase() === cleanSeed);
      }
      if (!exactMatch && bank.extreme) {
        exactMatch = bank.extreme.find(p => String(p.id).toUpperCase() === cleanSeed);
      }
    }

    if (exactMatch) {
      let g = [];
      let sl = [];
      for (let r = 0; r < 9; r++) {
        g.push(exactMatch.mission.slice(r * 9, (r + 1) * 9).split('').map(Number));
        sl.push(exactMatch.solution.slice(r * 9, (r + 1) * 9).split('').map(Number));
      }
      if (winRateTier && (winRateTier === 'nightmare' || winRateTier === 'hardcore')) {
        const carveResult = SudokuSolver.selectiveCarveClues(g, targetClues, s);
        g = carveResult.carvedGrid;
      }
      return { grid: g, sol: sl, exactMatch: true, win_rate: exactMatch.win_rate, id: exactMatch.id };
    }

    let base = null;
    if (bank && bank[difficulty] && bank[difficulty].length > 0) {
      const idx = Math.abs(s) % bank[difficulty].length;
      const bItem = bank[difficulty][idx];
      base = { m: bItem.mission, s: bItem.solution, win_rate: bItem.win_rate };
    } else {
      base = basePuzzles[difficulty] || basePuzzles.medium;
    }

    let grid = [];
    let sol = [];
    for (let r = 0; r < 9; r++) {
      grid.push(base.m.slice(r * 9, (r + 1) * 9).split('').map(Number));
      sol.push(base.s.slice(r * 9, (r + 1) * 9).split('').map(Number));
    }

    // 1. Permute digits
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [digits[i], digits[j]] = [digits[j], digits[i]];
    }
    const digitMap = { 0: 0 };
    for (let i = 0; i < 9; i++) digitMap[i + 1] = digits[i];

    grid = grid.map(row => row.map(v => digitMap[v]));
    sol = sol.map(row => row.map(v => digitMap[v]));

    // 2. Permute rows within bands
    for (let b = 0; b < 3; b++) {
      const rows = [b * 3, b * 3 + 1, b * 3 + 2];
      for (let i = 2; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [rows[i], rows[j]] = [rows[j], rows[i]];
      }
      const newG = [grid[rows[0]], grid[rows[1]], grid[rows[2]]];
      const newS = [sol[rows[0]], sol[rows[1]], sol[rows[2]]];
      for (let i = 0; i < 3; i++) {
        grid[b * 3 + i] = newG[i];
        sol[b * 3 + i] = newS[i];
      }
    }

    // 3. Selective Clue Carving: Bào bớt ô có kiểm soát để ép công thức khó & giảm tỉ lệ thắng theo yêu cầu
    const carveResult = SudokuSolver.selectiveCarveClues(grid, targetClues, s);
    grid = carveResult.carvedGrid;

    return { grid, sol, carvedCount: carveResult.carvedCount, remainingClues: carveResult.remainingClues };
  }

  // =========================================================================
  // HARDEST SEEDS LEADERBOARD (BẢNG XẾP HẠNG SEED KHÓ NHẤT & CHỌN ĐỀ CHƠI)
  // =========================================================================

  openSeedLeaderboardModal(targetMode = 'play') {
    this.seedLeaderboardTargetMode = targetMode;
    const activeTab = document.querySelector('.btn-seed-tab.active')?.dataset.tab || 'all';
    const query = this.dom.seedSearchInput ? this.dom.seedSearchInput.value.trim() : '';
    this.renderSeedLeaderboard(activeTab, query);
    if (this.dom.seedLeaderboardModal) {
      this.dom.seedLeaderboardModal.classList.add('active');
    }
  }

  closeSeedLeaderboardModal() {
    if (this.dom.seedLeaderboardModal) {
      this.dom.seedLeaderboardModal.classList.remove('active');
    }
  }

  getConqueredSeeds() {
    try {
      const raw = localStorage.getItem('sudo9ku_conquered_seeds');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  recordSeedConquest(seedId, finishTime = '00:00', mistakes = 0) {
    if (!seedId) return;
    try {
      const conquered = this.getConqueredSeeds();
      const cleanKey = String(seedId).trim().toLowerCase();
      conquered[cleanKey] = {
        seedId: String(seedId),
        conqueredAt: Date.now(),
        duration: finishTime,
        mistakes: mistakes
      };
      localStorage.setItem('sudo9ku_conquered_seeds', JSON.stringify(conquered));
      this.updateConqueredBadgeCount();
    } catch (e) {
      console.warn('Không thể lưu thành tích chinh phục seed:', e);
    }
  }

  updateConqueredBadgeCount() {
    if (this.dom.conqueredSeedsCount) {
      const conquered = this.getConqueredSeeds();
      const count = Object.keys(conquered).length;
      this.dom.conqueredSeedsCount.textContent = count;
    }
  }

  renderSeedLeaderboard(filterTab = 'all', searchQuery = '') {
    if (!this.dom.seedLeaderboardList) return;

    this.updateConqueredBadgeCount();
    const conqueredMap = this.getConqueredSeeds();
    const cleanQuery = searchQuery.toLowerCase().trim();

    let items = [...HARDEST_SEEDS_COLLECTION];

    // Filter by tab
    if (filterTab === 'nightmare') {
      items = items.filter(s => s.cat === 'nightmare');
    } else if (filterTab === 'extreme') {
      items = items.filter(s => s.cat === 'extreme' || s.cat === 'evil');
    } else if (filterTab === 'conquered') {
      items = items.filter(s => !!conqueredMap[s.id.toLowerCase()]);
    }

    // Filter by search query
    if (cleanQuery) {
      items = items.filter(s => {
        return (
          s.id.toLowerCase().includes(cleanQuery) ||
          (s.name && s.name.toLowerCase().includes(cleanQuery)) ||
          (s.author && s.author.toLowerCase().includes(cleanQuery)) ||
          (s.desc && s.desc.toLowerCase().includes(cleanQuery)) ||
          (s.tags && s.tags.some(t => t.toLowerCase().includes(cleanQuery)))
        );
      });
    }

    if (this.dom.leaderboardMatchSummary) {
      this.dom.leaderboardMatchSummary.textContent = `Hiển thị ${items.length} / ${HARDEST_SEEDS_COLLECTION.length} đề siêu khó`;
    }

    if (items.length === 0) {
      this.dom.seedLeaderboardList.innerHTML = `
        <div style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">🔍</div>
          <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 4px; color: var(--text-main);">Không tìm thấy câu đố phù hợp</div>
          <div style="font-size: 0.78rem;">Hãy thử từ khóa khác hoặc chuyển sang tab "Tất cả"</div>
        </div>
      `;
      return;
    }

    const targetMode = this.seedLeaderboardTargetMode || 'play';

    let html = '';
    items.forEach((item) => {
      // Find absolute rank in entire collection
      const absRank = HARDEST_SEEDS_COLLECTION.findIndex(s => s.id === item.id) + 1;
      let rankClass = 'rank-other';
      let rankBadgeHtml = '';

      if (absRank === 1) {
        rankClass = 'rank-top-1';
        rankBadgeHtml = `<div class="rank-badge-box gold" title="Hạng 1 - Đề khó nhất hành tinh">🥇<span style="font-size: 0.65rem; font-weight: 800; line-height: 1;">#1</span></div>`;
      } else if (absRank === 2) {
        rankClass = 'rank-top-2';
        rankBadgeHtml = `<div class="rank-badge-box silver" title="Hạng 2">🥈<span style="font-size: 0.65rem; font-weight: 800; line-height: 1;">#2</span></div>`;
      } else if (absRank === 3) {
        rankClass = 'rank-top-3';
        rankBadgeHtml = `<div class="rank-badge-box bronze" title="Hạng 3">🥉<span style="font-size: 0.65rem; font-weight: 800; line-height: 1;">#3</span></div>`;
      } else {
        rankBadgeHtml = `<div class="rank-badge-box">#${absRank}</div>`;
      }

      const isConquered = !!conqueredMap[item.id.toLowerCase()];
      const conquestInfo = conqueredMap[item.id.toLowerCase()];

      const winRateZoneClass = item.win_rate < 5 ? 'danger-zone' : 'hard-zone';
      const winRateIcon = item.win_rate < 5 ? '☠️' : '🔥';

      const tagChipsHtml = (item.tags || []).map(t => `<span class="seed-tag-chip">${t}</span>`).join(' ');

      // Action button based on targetMode
      let actionButtonsHtml = '';
      if (targetMode === 'select-custom') {
        actionButtonsHtml = `
          <button type="button" class="btn btn-primary btn-sm btn-play-free btn-pick-seed" data-seed="${item.id}" data-action="select-custom" style="padding: 7px 12px; font-weight: 700;">
            🎯 Chọn mã này
          </button>
        `;
      } else if (targetMode === 'select-arena') {
        actionButtonsHtml = `
          <button type="button" class="btn btn-danger btn-sm btn-play-arena btn-pick-seed" data-seed="${item.id}" data-action="select-arena" style="padding: 7px 12px; font-weight: 700;">
            ⚔️ Chọn thi đấu
          </button>
        `;
      } else {
        actionButtonsHtml = `
          <button type="button" class="btn btn-primary btn-xs btn-play-free btn-pick-seed" data-seed="${item.id}" data-action="play" title="Chơi tự do với đầy đủ phân tích bước giải & ghi chú">
            ▶ Chơi ngay
          </button>
          <button type="button" class="btn btn-danger btn-xs btn-play-arena btn-pick-seed" data-seed="${item.id}" data-action="arena" title="Khởi động Đấu Trường Sinh Tồn Extreme 3 mạng">
            ⚔️ Đấu trường
          </button>
          <button type="button" class="btn btn-secondary btn-xs btn-seed-copy" data-seed="${item.id}" title="Sao chép mã đề">
            📋 Copy
          </button>
        `;
      }

      html += `
        <div class="leaderboard-seed-card ${rankClass} ${isConquered ? 'conquered' : ''}">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
            ${rankBadgeHtml}
            <div class="seed-info-col">
              <div class="seed-title-row">
                <span class="seed-code-pill">#${item.id}</span>
                <span class="seed-name-label" title="${item.name}">${item.name}</span>
                ${isConquered ? `<span class="seed-conquered-badge">✓ Đã chinh phục (${conquestInfo?.duration || 'Thắng'})</span>` : ''}
              </div>
              <div class="seed-author-desc">
                ${item.author ? `<strong>${item.author}</strong> • ` : ''}${item.desc || ''}
              </div>
              <div class="seed-metrics-row">
                <span class="seed-winrate-chip ${winRateZoneClass}" title="Tỉ lệ thắng thực tế đo được từ người chơi">
                  ${winRateIcon} Thắng: <strong>${item.win_rate}%</strong>
                </span>
                <span class="seed-clue-chip">🧩 ${item.clues} ô ban đầu</span>
                ${tagChipsHtml}
              </div>
            </div>
          </div>
          <div class="seed-actions-col">
            ${actionButtonsHtml}
          </div>
        </div>
      `;
    });

    this.dom.seedLeaderboardList.innerHTML = html;

    // Attach click listeners to cards
    const pickBtns = this.dom.seedLeaderboardList.querySelectorAll('.btn-pick-seed');
    pickBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const seedId = btn.dataset.seed;
        const action = btn.dataset.action || 'play';
        this.selectSeedFromLeaderboard(seedId, action);
      });
    });

    const copyBtns = this.dom.seedLeaderboardList.querySelectorAll('.btn-seed-copy');
    copyBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const seedId = btn.dataset.seed;
        this.copySeedToClipboard(seedId);
      });
    });
  }

  selectSeedFromLeaderboard(seedId, actionType = 'play') {
    const seed = HARDEST_SEEDS_COLLECTION.find(s => s.id.toLowerCase() === String(seedId).toLowerCase());
    const targetMode = this.seedLeaderboardTargetMode || 'play';

    if (targetMode === 'select-custom' || actionType === 'select-custom') {
      this.closeSeedLeaderboardModal();
      if (this.dom.customPuzzleSeedInput) {
        this.dom.customPuzzleSeedInput.value = seedId;
      }
      const diffKey = seed ? (seed.cat === 'nightmare' ? 'nightmare' : (seed.cat === 'evil' ? 'hard' : 'extreme')) : 'extreme';
      const customDiffBtns = document.querySelectorAll('.btn-custom-diff');
      customDiffBtns.forEach(btn => {
        if (btn.dataset.diff === diffKey) {
          customDiffBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
      });
      this.updateCustomPuzzleShareLink();
      this.openCustomPuzzleModal();
      this.setStatus(`🎲 Đã chọn Đề #${seedId} (${seed ? seed.name : ''}) vào Tùy Chỉnh!`, 'valid');
      return;
    }

    if (targetMode === 'select-arena' || actionType === 'select-arena') {
      this.closeSeedLeaderboardModal();
      if (this.arenaManager) {
        if (this.arenaManager.dom.inputSeed) {
          this.arenaManager.dom.inputSeed.value = seedId;
        }
        this.arenaManager.openSetupModal();
        this.setStatus(`⚔️ Đã chọn Đề #${seedId} vào Đấu Trường Sinh Tồn!`, 'valid');
      }
      return;
    }

    if (actionType === 'arena') {
      this.closeSeedLeaderboardModal();
      if (this.arenaManager) {
        this.arenaManager.startMatch(seedId, 10, true);
      }
      return;
    }

    // Default: 'play' -> Chế độ tự do
    this.closeSeedLeaderboardModal();
    const diff = seed ? (seed.cat === 'nightmare' ? 'nightmare' : 'extreme') : 'extreme';
    this.loadPuzzleBySeed(seedId, diff, 0, 'countup', 'standard');
  }

  copySeedToClipboard(seedId) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(seedId).then(() => {
        this.setStatus(`📋 Đã sao chép mã đề #${seedId} vào bộ nhớ tạm!`, 'valid');
      }).catch(() => {
        this.fallbackCopyText(seedId);
      });
    } else {
      this.fallbackCopyText(seedId);
    }
  }

  fallbackCopyText(text) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.setStatus(`📋 Đã sao chép mã đề #${text} vào bộ nhớ tạm!`, 'valid');
    } catch (e) {
      this.setStatus(`📋 Mã đề: ${text}`, 'info');
    }
  }
}

export const HARDEST_SEEDS_COLLECTION = [
  {
    id: "inkala-2012",
    cat: "nightmare",
    name: "Everest (Khó nhất thế giới 2012)",
    author: "TS. Arto Inkala",
    win_rate: 2.10,
    clues: 21,
    tags: ["11★ Khó Nhất TG", "Chuỗi 8 Tầng", "Kỷ Lục Toàn Cầu"],
    desc: "Tuyệt tác 'Everest' của TS. Arto Inkala (2012). Đạt mức độ khó 11 sao với nhánh suy luận 8 tầng!"
  },
  {
    id: "inkala-2010",
    cat: "nightmare",
    name: "Inkala 2010 (Đỉnh cao tư duy)",
    author: "TS. Arto Inkala",
    win_rate: 2.45,
    clues: 21,
    tags: ["Bẫy Đa Chiều", "Nhánh Suy Luận Sâu"],
    desc: "Tuyệt tác thách thức giải thuật máy tính của Arto Inkala năm 2010."
  },
  {
    id: "inkala-2006",
    cat: "nightmare",
    name: "AI Escargot (Huyền thoại Ốc sên 2006)",
    author: "TS. Arto Inkala",
    win_rate: 3.25,
    clues: 24,
    tags: ["Chấn Động Thế Giới", "Forcing Chains"],
    desc: "Câu đố AI Escargot nổi tiếng nhất lịch sử với chuỗi liên kết đối kháng đa tầng."
  },
  {
    id: "royle-17-04",
    cat: "nightmare",
    name: "Đề 17 ô Gordon Royle #4",
    author: "Gordon Royle",
    win_rate: 3.90,
    clues: 17,
    tags: ["17 Ô Tối Giản", "Kỷ Lục Toán Học"],
    desc: "Chỉ 17 gợi ý ban đầu, tỉ lệ thắng tự nhiên của người chơi chỉ 3.9%!"
  },
  {
    id: "royle-17-02",
    cat: "nightmare",
    name: "Đề 17 ô Gordon Royle #2",
    author: "Gordon Royle",
    win_rate: 4.12,
    clues: 17,
    tags: ["17 Ô Tối Giản", "Phân Bố Rộng"],
    desc: "Biến thể đối xứng 17 ô với chuỗi đối kháng số 6 và số 7."
  },
  {
    id: "royle-17-05",
    cat: "nightmare",
    name: "Đề 17 ô Gordon Royle #5",
    author: "Gordon Royle",
    win_rate: 4.20,
    clues: 17,
    tags: ["17 Ô Tối Giản", "Forcing Chains"],
    desc: "Đề 17 ô kinh điển với chuỗi suy luận phức hợp xích Forcing Chain."
  },
  {
    id: "royle-17-03",
    cat: "nightmare",
    name: "Đề 17 ô Gordon Royle #3",
    author: "Gordon Royle",
    win_rate: 4.30,
    clues: 17,
    tags: ["17 Ô Tối Giản", "Cụm Góc Liên Hoàn"],
    desc: "Cụm góc 17 ô liên hoàn - kỹ thuật ép chuỗi buộc dùng AIC đa tầng."
  },
  {
    id: "royle-17-06",
    cat: "nightmare",
    name: "Đề 17 ô Gordon Royle #6",
    author: "Gordon Royle",
    win_rate: 4.35,
    clues: 17,
    tags: ["17 Ô Tối Giản", "Đối Xứng Bán Phần"],
    desc: "Cấu trúc 17 ô đối xứng bán phần đặc biệt, tạo ra độ mông lung cực lớn khi giải."
  },
  {
    id: "royle-17-01",
    cat: "nightmare",
    name: "Đề 17 ô Gordon Royle #1",
    author: "Gordon Royle",
    win_rate: 4.85,
    clues: 17,
    tags: ["17 Ô Tối Giản", "Gordon Royle 2007"],
    desc: "Đạt giới hạn toán học tối thiểu 17 ô. Không thể tồn tại Sudoku 1 nghiệm với 16 ô!"
  },
  {
    id: "905",
    cat: "extreme",
    name: "Sudoku.com Extreme #905",
    author: "Sudoku.com",
    win_rate: 24.52,
    clues: 23,
    tags: ["Top 1 Sudoku.com", "Nishio Chains"],
    desc: "Đề có tỉ lệ thắng người chơi thấp nhất từng ghi nhận trên toàn bộ hệ thống Sudoku.com."
  },
  {
    id: "5",
    cat: "evil",
    name: "Sudoku.com Evil #5",
    author: "Sudoku.com",
    win_rate: 25.77,
    clues: 25,
    tags: ["Top Độc Địa Evil", "Swordfish"],
    desc: "Cấp độ Evil với thế cờ khóa chéo 3 hàng 3 cột cực kỳ hiểm hóc."
  },
  {
    id: "705",
    cat: "extreme",
    name: "Sudoku.com Extreme #705",
    author: "Sudoku.com",
    win_rate: 25.79,
    clues: 23,
    tags: ["Cực Khó #705", "X-Chain"],
    desc: "Chuỗi liên kết ứng viên rời rạc đòi hỏi kỹ thuật X-Chain kéo dài."
  },
  {
    id: "739",
    cat: "extreme",
    name: "Sudoku.com Extreme #739",
    author: "Sudoku.com",
    win_rate: 26.43,
    clues: 23,
    tags: ["Cực Gắt", "Pointing Pairs"],
    desc: "Cấu trúc giam số ở 4 góc khiến việc tìm ô bắt đầu trở thành ác mộng."
  },
  {
    id: "500",
    cat: "extreme",
    name: "Sudoku.com Extreme #500",
    author: "Sudoku.com",
    win_rate: 26.50,
    clues: 23,
    tags: ["Cột Mốc #500", "Hidden Pair"],
    desc: "Đề hạt nhân cột mốc 500 với bẫy cặp ẩn kép lồng nhau."
  },
  {
    id: "146",
    cat: "extreme",
    name: "Sudoku.com Extreme #146",
    author: "Sudoku.com",
    win_rate: 26.51,
    clues: 23,
    tags: ["Siêu Hiểm", "XY-Wing"],
    desc: "Đòi hỏi xác định chính xác cánh XY-Wing phân nhánh để mở nút thắt trung tâm."
  },
  {
    id: "312",
    cat: "extreme",
    name: "Sudoku.com Extreme #312",
    author: "Sudoku.com",
    win_rate: 26.62,
    clues: 23,
    tags: ["Hiếm Thấy", "Box-Line"],
    desc: "Các ô trống tập trung ở dải ngang giữa khiến suy luận tuyến tính bị vô hiệu."
  },
  {
    id: "812",
    cat: "extreme",
    name: "Sudoku.com Extreme #812",
    author: "Sudoku.com",
    win_rate: 26.86,
    clues: 28,
    tags: ["Bẫy Dày Ô", "Remote Pairs"],
    desc: "Dù có tới 28 gợi ý nhưng sự ngụy trang ứng viên khiến tỉ lệ thắng rớt xuống dưới 27%."
  },
  {
    id: "396",
    cat: "extreme",
    name: "Sudoku.com Extreme #396",
    author: "Sudoku.com",
    win_rate: 26.91,
    clues: 22,
    tags: ["22 Ô Thưa Thớt", "Naked Quad"],
    desc: "Chỉ 22 ô cho trước, tạo khoảng trống mênh mông đòi hỏi bộ 4 trần trụi."
  },
  {
    id: "417",
    cat: "extreme",
    name: "Sudoku.com Extreme #417",
    author: "Sudoku.com",
    win_rate: 26.99,
    clues: 23,
    tags: ["Bào Não", "Skyscraper"],
    desc: "Thế cờ Nhà Chọc Trời (Skyscraper) đôi song hành cực kỳ khó phát hiện."
  },
  {
    id: "411",
    cat: "extreme",
    name: "Sudoku.com Extreme #411",
    author: "Sudoku.com",
    win_rate: 27.39,
    clues: 23,
    tags: ["Cực Khó #411", "Two-String Kite"],
    desc: "Mô hình Diều Hai Dây (Two-String Kite) liên kết giữa khối 1 và khối 9."
  },
  {
    id: "150",
    cat: "extreme",
    name: "Sudoku.com Extreme #150",
    author: "Sudoku.com",
    win_rate: 27.51,
    clues: 23,
    tags: ["Đột Phá", "Unique Rectangle"],
    desc: "Tránh bẫy hình chữ nhật vô nghiệm (UR Type 1 & 2) để loại bỏ ứng viên."
  },
  {
    id: "367",
    cat: "extreme",
    name: "Sudoku.com Extreme #367",
    author: "Sudoku.com",
    win_rate: 27.61,
    clues: 23,
    tags: ["Xương Cá", "Fin Swordfish"],
    desc: "Kiếm Ngư Có Vây (Finned Swordfish) hiếm gặp trên hàng 2, 5, 8."
  },
  {
    id: "372",
    cat: "extreme",
    name: "Sudoku.com Extreme #372",
    author: "Sudoku.com",
    win_rate: 27.66,
    clues: 23,
    tags: ["W-Wing", "Chuỗi Đơn Lẻ"],
    desc: "Phối hợp W-Wing mạnh mẽ loại bỏ các ứng viên giả mạo trong khối giữa."
  },
  {
    id: "977",
    cat: "extreme",
    name: "Sudoku.com Extreme #977",
    author: "Sudoku.com",
    win_rate: 27.88,
    clues: 23,
    tags: ["Bất Khả Thi", "XYZ-Wing"],
    desc: "Biến thể XYZ-Wing 3 chiều với ô bản lề tại trung tâm bàn cờ."
  },
  {
    id: "1020",
    cat: "extreme",
    name: "Sudoku.com Extreme #1020",
    author: "Sudoku.com",
    win_rate: 28.01,
    clues: 22,
    tags: ["22 Ô Cực Khó", "Simple Coloring"],
    desc: "Tô màu đơn giản liên kết mạnh/yếu để tìm mâu thuẫn trong bảng cờ."
  }
];

window.addEventListener('DOMContentLoaded', () => {
  window.app = new SudokuApp();
});
