const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function run() {
  const chromePaths = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ];
  let executablePath = chromePaths.find(p => fs.existsSync(p));

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 850 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  const testReport = await page.evaluate(async () => {
    const results = [];
    const app = window.app;
    if (!app) return { error: 'No window.app found' };

    // Wait for puzzle to load
    if (!app.solution) {
      document.getElementById('sample-preset-card')?.click();
      await new Promise(r => setTimeout(r, 1000));
    }

    // 1. Kiểm tra trạng thái mặc định (Bật xem trước tương lai)
    const initialAllow = app.allowForwardSteps;
    const initialTotalSteps = app.solveSteps.length - 1;
    const initialSliderMax = parseInt(app.dom.stepSlider.max, 10);
    results.push({
      test: 'Default allowForwardSteps is true',
      passed: initialAllow === true && initialSliderMax === initialTotalSteps,
      details: { initialAllow, initialSliderMax, initialTotalSteps }
    });

    // Mở sổ tay công thức khi đang BẬT -> phải có chip upcoming
    app.openFormulaModal();
    const upcomingChipsBefore = document.querySelectorAll('.btn-applied-step.upcoming').length;
    app.closeFormulaModal();
    results.push({
      test: 'Formula modal has upcoming steps when forward is enabled',
      passed: upcomingChipsBefore > 0,
      details: { upcomingChipsBefore }
    });

    // 2. Mở Cài đặt Hợp nhất -> Tab Tiến trình & Hướng dẫn
    app.openUnifiedSettingsModal('walkthrough');
    const walkthroughTabActive = document.getElementById('tab-pane-walkthrough')?.classList.contains('active');
    const toggleElem = document.getElementById('toggle-allow-forward-steps');
    const toggleCheckedBefore = toggleElem ? toggleElem.checked : null;
    const badgeTextBefore = document.getElementById('forward-steps-status-badge')?.textContent;

    results.push({
      test: 'Settings modal walkthrough tab is active and toggle is present',
      passed: walkthroughTabActive && toggleCheckedBefore === true && badgeTextBefore.includes('Đang bật'),
      details: { walkthroughTabActive, toggleCheckedBefore, badgeTextBefore }
    });

    // Giả lập người dùng tắt công tắc
    toggleElem.checked = false;
    toggleElem.dispatchEvent(new Event('change'));
    const badgeTextAfter = document.getElementById('forward-steps-status-badge')?.textContent;
    results.push({
      test: 'Badge changes to "Chỉ xem quá khứ" when unchecked',
      passed: badgeTextAfter.includes('Chỉ xem quá khứ'),
      details: { badgeTextAfter }
    });

    // Bấm Lưu & Áp dụng
    document.getElementById('btn-save-unified-settings')?.click();
    await new Promise(r => setTimeout(r, 200));

    // 3. Kiểm tra các ràng buộc bảo mật sau khi TẮT
    const allowAfterSave = app.allowForwardSteps;
    const savedInStorage = localStorage.getItem('sudoku_allow_forward_steps');
    const userMovesCount = app.userMovesHistory ? app.userMovesHistory.length : 0;
    const sliderMaxAfter = parseInt(app.dom.stepSlider.max, 10);
    const counterTextAfter = app.dom.stepCounter.textContent;
    const nextBtnDisabled = app.dom.btnStepNext.disabled;
    const endBtnDisabled = app.dom.btnStepEnd.disabled;

    results.push({
      test: 'allowForwardSteps is false and stored in localStorage',
      passed: allowAfterSave === false && savedInStorage === 'false',
      details: { allowAfterSave, savedInStorage }
    });

    results.push({
      test: 'stepSlider.max is capped at userMovesCount (K) and next/end buttons are disabled',
      passed: sliderMaxAfter === userMovesCount && nextBtnDisabled === true && endBtnDisabled === true,
      details: { sliderMaxAfter, userMovesCount, nextBtnDisabled, endBtnDisabled, counterTextAfter }
    });

    // Kiểm tra không thể tua quá K
    app.goToStep(userMovesCount + 10);
    results.push({
      test: 'goToStep(K + 10) is clamped to K and does not leak future steps',
      passed: app.currentStepIndex === userMovesCount && !app.dom.stepCounter.textContent.includes(String(initialTotalSteps)),
      details: { currentStep: app.currentStepIndex, userMovesCount, counterText: app.dom.stepCounter.textContent }
    });

    // 4. Kiểm tra Sổ tay công thức khi TẮT
    app.openFormulaModal();
    const upcomingChipsWhenDisabled = document.querySelectorAll('.btn-applied-step.upcoming').length;
    const modalContentText = document.getElementById('formula-modal')?.textContent;
    const hasSecurityNotice = modalContentText.includes('Đã tắt xem trước các gợi ý tương lai trong Tùy chỉnh');
    app.closeFormulaModal();

    results.push({
      test: 'Formula modal hides upcoming steps and shows security notice',
      passed: upcomingChipsWhenDisabled === 0 && hasSecurityNotice,
      details: { upcomingChipsWhenDisabled, hasSecurityNotice }
    });

    // 5. Kiểm tra previewNextStep bị chặn
    let alertMsg = null;
    const origAlert = window.alert;
    window.alert = (msg) => { alertMsg = msg; };
    app.previewNextStep();
    window.alert = origAlert;

    results.push({
      test: 'previewNextStep is blocked with alert/toast',
      passed: alertMsg !== null && alertMsg.includes('bảo mật'),
      details: { alertMsg }
    });

    // 6. Kiểm tra người dùng đánh 1 nước cờ (K -> K+1)
    let emptyR = -1, emptyC = -1;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (app.currentBoard[r][c] === 0) {
          emptyR = r; emptyC = c; break;
        }
      }
      if (emptyR !== -1) break;
    }
    if (emptyR !== -1) {
      const correctVal = app.solution[emptyR][emptyC];
      app.currentBoard[emptyR][emptyC] = correctVal;
      app.recordUserMove(emptyR, emptyC, correctVal);
      app.syncSolvingWalkthroughWithCurrentBoard();

      const newK = app.userMovesHistory.length;
      const newSliderMax = parseInt(app.dom.stepSlider.max, 10);
      results.push({
        test: 'When user plays a move, slider.max expands to new K while still blocking forward steps',
        passed: newSliderMax === newK && newK === userMovesCount + 1,
        details: { newSliderMax, newK }
      });
    }

    // 7. Mở Tùy chỉnh và BẬT LẠI
    app.openUnifiedSettingsModal('walkthrough');
    const toggleElem2 = document.getElementById('toggle-allow-forward-steps');
    toggleElem2.checked = true;
    document.getElementById('btn-save-unified-settings')?.click();
    await new Promise(r => setTimeout(r, 200));

    const restoredSliderMax = parseInt(app.dom.stepSlider.max, 10);
    app.openFormulaModal();
    const restoredUpcomingChips = document.querySelectorAll('.btn-applied-step.upcoming').length;
    app.closeFormulaModal();

    results.push({
      test: 'Restoring toggle back to true restores full slider and upcoming chips',
      passed: app.allowForwardSteps === true && restoredSliderMax === app.solveSteps.length - 1 && restoredUpcomingChips > 0,
      details: { restoredSliderMax, restoredUpcomingChips }
    });

    return results;
  });

  await page.screenshot({ path: 'tools/screenshot_forward_steps_test.png' });
  await browser.close();

  console.log(JSON.stringify(testReport, null, 2));
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
