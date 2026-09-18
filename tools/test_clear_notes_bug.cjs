const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];
  let exe = [...edgePaths, ...chromePaths].find(p => fs.existsSync(p));
  const browser = await puppeteer.launch({ executablePath: exe, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 950 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  await page.waitForSelector('#sudoku-grid .sudoku-cell');
  await new Promise(r => setTimeout(r, 1200));

  console.log('--- REPRODUCING USER SCENARIO ---');
  // 1. Open pencil settings modal
  await page.click('#btn-open-pencil-settings');
  await new Promise(r => setTimeout(r, 400));

  // 2. Select "Tự động hiển thị tất cả ứng viên" (auto candidates) - exactly as shown in user screenshot
  await page.evaluate(() => {
    const autoRadio = document.querySelector('input[name="pencil-mode-type"][value="auto"]');
    autoRadio.checked = true;
  });
  await page.click('#btn-save-pencil-settings');
  await new Promise(r => setTimeout(r, 400));

  // Check that candidates are indeed showing
  const countBeforeClear = await page.evaluate(() => {
    const activeCandSpans = document.querySelectorAll('.candidate-num.active');
    return {
      activeCount: activeCandSpans.length,
      pencilType: window.app.pencilType,
      showCandidates: window.app.showCandidates
    };
  });
  console.log('State in auto mode before clear:', countBeforeClear);
  if (countBeforeClear.activeCount === 0) {
    throw new Error('Auto mode should have rendered active candidate spans!');
  }

  // 3. Open modal again and click "Xóa tất cả ghi chú"
  await page.click('#btn-open-pencil-settings');
  await new Promise(r => setTimeout(r, 400));

  console.log('Clicking "Xóa tất cả ghi chú" (#btn-clear-all-notes)...');
  await page.click('#btn-clear-all-notes');
  await new Promise(r => setTimeout(r, 300));

  // 4. Verify that board has ZERO visible candidates now!
  const stateAfterClear = await page.evaluate(() => {
    const app = window.app;
    const activeCandSpans = document.querySelectorAll('.candidate-num.active');
    const visibleGrids = Array.from(document.querySelectorAll('.candidates-grid')).filter(g => g.style.display !== 'none');
    const manualRadio = document.querySelector('input[name="pencil-mode-type"][value="manual"]');
    const autoRadio = document.querySelector('input[name="pencil-mode-type"][value="auto"]');
    const btnText = document.getElementById('btn-clear-all-notes').textContent;

    return {
      activeSpansCount: activeCandSpans.length,
      visibleGridsCount: visibleGrids.length,
      pencilType: app.pencilType,
      manualRadioChecked: manualRadio ? manualRadio.checked : false,
      autoRadioChecked: autoRadio ? autoRadio.checked : false,
      btnText: btnText.trim()
    };
  });

  console.log('State immediately after clear:', stateAfterClear);
  if (stateAfterClear.activeSpansCount !== 0) {
    throw new Error(`Expected 0 active spans after clear, got ${stateAfterClear.activeSpansCount}!`);
  }
  if (stateAfterClear.visibleGridsCount !== 0) {
    throw new Error(`Expected 0 visible candidate grids after clear, got ${stateAfterClear.visibleGridsCount}!`);
  }
  if (stateAfterClear.pencilType !== 'manual') {
    throw new Error(`Expected pencilType to be "manual", got ${stateAfterClear.pencilType}!`);
  }
  if (!stateAfterClear.manualRadioChecked || stateAfterClear.autoRadioChecked) {
    throw new Error('Radio buttons were not properly updated to manual!');
  }

  // 5. Close modal and take screenshot
  await page.click('#btn-close-pencil-modal');
  await new Promise(r => setTimeout(r, 400));

  const afterModalClose = await page.evaluate(() => {
    return document.querySelectorAll('.candidate-num.active').length;
  });
  console.log('Active candidate spans after closing modal:', afterModalClose);
  if (afterModalClose !== 0) {
    throw new Error('Candidates reappeared after closing modal!');
  }

  await page.screenshot({ path: 'tools/screenshot_cleared_notes.png' });
  console.log('Saved screenshot tools/screenshot_cleared_notes.png');

  console.log('✅ TEST PASSED: Clear all notes works 100% even from auto candidates mode!');
  await browser.close();
})();
