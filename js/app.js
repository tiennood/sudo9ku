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

    // Cài đặt số lượt sai & Thống kê lịch sử ván cờ (Mặc định 10 lượt)
    this.maxMistakes = localStorage.getItem('sudoku_max_mistakes') || '10';
    if (this.maxMistakes === '3') {
      this.maxMistakes = '10';
      localStorage.setItem('sudoku_max_mistakes', '10');
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

    this.diagramViewer = new FormulaDiagramViewer();

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

    // Tự động kiểm tra tham số URL (đề chơi chung) hoặc nạp ảnh mẫu ban đầu
    this.checkInitialUrlParams();
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
      numpadBtns: document.querySelectorAll('.numpad-btn:not(.btn-pencil-numpad)'),
      btnNumpadPencil: document.getElementById('btn-numpad-pencil'),
      numpadPencilText: document.getElementById('numpad-pencil-text'),

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
      btnStartCustomPuzzle: document.getElementById('btn-start-custom-puzzle')
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

        for (let num = 1; num <= 9; num++) {
          const cand = document.createElement('span');
          cand.className = 'candidate-num';
          cand.dataset.candidate = num;
          cand.textContent = num;
          candGrid.appendChild(cand);
        }

        const valSpan = document.createElement('span');
        valSpan.className = 'cell-value';

        cell.appendChild(candGrid);
        cell.appendChild(valSpan);

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
    const customDiffBtns = document.querySelectorAll('.btn-custom-diff');
    customDiffBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        customDiffBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
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

        // Đảm bảo không trùng lặp với các bài vừa chơi gần đây
        this.playedPuzzlesHistory = this.playedPuzzlesHistory || new Set();
        let unplayed = list.filter(p => !this.playedPuzzlesHistory.has(String(p.id)));
        if (unplayed.length === 0) {
          this.playedPuzzlesHistory.clear();
          unplayed = list;
        }

        const p = unplayed[Math.floor(Math.random() * unplayed.length)];
        this.playedPuzzlesHistory.add(String(p.id));

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
      console.warn('Lỗi khi gọi /api/open-sudoku:', err.message);
      this.setStatus(`✓ Đã nạp thành công bài Sudoku.com #${puzzleId} (${validLevel.toUpperCase()}) • Tỉ lệ thắng: ${winRate}% • Kèm ${userMovesCount} cờ đang giải!`, 'solved');
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
   * Điền toàn bộ tất cả số đáp án đúng vào bàn cờ (hoàn thành 81/81 ô)
   */
  fillAllSolutionDigits() {
    if (!this.solution) {
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

    const candidates = (effectiveStep && effectiveStep.candidatesState)
      ? effectiveStep.candidatesState
      : SudokuSolver.getAllCandidates(this.currentBoard);

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
        const valSpan = cell.querySelector('.cell-value');
        const candGrid = cell.querySelector('.candidates-grid');

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

          // Hiển thị bút chì (candidates / manual notes) nếu bật
          if (this.showCandidates) {
            let cellCands = [];
            if (this.isPreviewMode && effectiveStep && effectiveStep.candidatesState) {
              cellCands = effectiveStep.candidatesState[r][c] || [];
            } else if (activeStep && activeStep.candidatesState) {
              cellCands = activeStep.candidatesState[r][c] || [];
            } else if (this.pencilType === 'auto') {
              cellCands = candidates[r][c] || [];
            } else {
              cellCands = (this.manualCandidates && this.manualCandidates[r]) ? (this.manualCandidates[r][c] || []) : [];
            }

            if (cellCands.length > 0) {
              candGrid.style.display = 'grid';
              const candSpans = candGrid.querySelectorAll('.candidate-num');
              candSpans.forEach(sp => {
                const num = parseInt(sp.dataset.candidate, 10);
                const hasCand = cellCands.includes(num);
                sp.classList.toggle('active', hasCand);
                sp.style.visibility = hasCand ? 'visible' : 'hidden';

                // Highlight số ứng viên trùng với số đang chọn
                if (hasCand && this.highlightMatchingNotes && selectedVal && selectedVal === num) {
                  sp.classList.add('highlight-match');
                } else {
                  sp.classList.remove('highlight-match');
                }
              });
            } else {
              candGrid.style.display = 'none';
              const candSpans = candGrid.querySelectorAll('.candidate-num');
              candSpans.forEach(sp => {
                sp.classList.remove('active', 'highlight-match');
                sp.style.visibility = 'hidden';
              });
            }
          } else {
            candGrid.style.display = 'none';
          }
        }
      }
    }

    this.updateInspector();
    this.updateNumpadStatus();
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
    this.playSound('select');
    this.renderBoard();
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
                   </div>
                   <button class="btn btn-secondary btn-sm" id="btn-jump-to-step">
                    ▶ Đi tới bước giải ô này (${stepIdx})
                   </button>`;
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

    // Trong chế độ bút chì: nếu ô có số nháp thì ưu tiên xóa sạch số nháp ở ô này
    if (this.isPencilMode && hasNotes) {
      this.manualCandidates[row][col] = [];
      this.renderBoard();
      this.updateInspector();
      this.playSound('step');
      this.setStatus(`Đã xóa toàn bộ số nháp tại (Hàng ${row + 1}, Cột ${col + 1})`, '');
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
    this.togglePencilMode(false);
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
    this.togglePencilMode(false);
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
    this.updateInspector();
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
   * Cập nhật trạng thái hiển thị của các nút Bút chì
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
      if (seedParam) {
        this.loadPuzzleBySeed(seedParam, diffParam || 'medium', timerParam);
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

    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?seed=${encodeURIComponent(seed)}&diff=${diff}&timer=${timerCfg.mins}`;
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

    this.closeCustomPuzzleModal();
    this.loadPuzzleBySeed(seed, diff, timerCfg.mins, timerCfg.mode);
  }

  loadPuzzleBySeed(seedStr, difficulty = 'medium', timerMinutes = null, timerMode = null) {
    const seed = String(seedStr).trim().toUpperCase();
    const diff = String(difficulty || 'medium').toLowerCase();

    // Sinh ma trận câu đố và nghiệm chuẩn dựa trên Seed
    const puzzle = this.generatePuzzleFromSeed(seed, diff);
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

    this.activeCustomSeed = seed;
    this.activeCustomDifficulty = diff;

    this.startNewGameRecord(`Đề #${seed} (${diffName})`);
    this.renderBoard();
    this.updateInspector();
    this.syncSolvingWalkthroughWithCurrentBoard();
    this.updateSolutionPreviewLockUI();

    this.playSound('step');
    this.setStatus(`🎮 Đã nạp Đề #${seed} • Cấp độ: ${diffName}! Hãy cùng so tài nào!`, 'valid');
  }

  generatePuzzleFromSeed(seedStr, difficulty = 'medium') {
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

    const base = basePuzzles[difficulty] || basePuzzles.medium;
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

    return { grid, sol };
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new SudokuApp();
});
