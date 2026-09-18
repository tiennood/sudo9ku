const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('--- STARTING CROSS-HATCHING & SAME DIGIT COLOR E2E TEST ---');
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
  await page.setViewport({ width: 1280, height: 900 });

  // Navigate to local dev server
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  });

  console.log('1. Setting up Sudoku board with multiple digit 6s...');
  await page.evaluate(() => {
    const app = window.app;
    // Set up a custom board with four 6s exactly like user's screenshot:
    // (1, 2)=6, (6, 4)=6, (7, 0)=6, (8, 6)=6
    const board = [
      [2, 1, 8, 0, 0, 5, 0, 0, 0],
      [4, 9, 6, 3, 8, 2, 0, 5, 0],
      [0, 0, 0, 9, 0, 0, 0, 0, 4],
      [0, 0, 4, 0, 0, 1, 0, 2, 0],
      [0, 8, 0, 0, 0, 9, 0, 0, 3],
      [0, 0, 2, 7, 0, 0, 4, 1, 5],
      [0, 0, 7, 1, 6, 3, 0, 0, 9],
      [6, 4, 9, 5, 2, 7, 8, 0, 0],
      [5, 0, 0, 8, 0, 0, 6, 0, 0]
    ];
    app.initialBoard = board.map(r => [...r]);
    app.currentBoard = board.map(r => [...r]);
    app.crosshatchMode = 'all';
    app.sameDigitMatchColor = true;
    app.renderBoard();
    app.updateCrosshatchBtnLabel();
  });

  console.log('2. Clicking cell (1, 2) which contains number 6...');
  await page.evaluate(() => {
    window.app.selectCell(1, 2);
  });
  await new Promise(r => setTimeout(r, 200));

  // Verify color matching
  const colorCheck = await page.evaluate(() => {
    const selCell = window.app.cellElements[1][2];
    const otherCell = window.app.cellElements[6][4];
    const selStyle = window.getComputedStyle(selCell);
    const otherStyle = window.getComputedStyle(otherCell);
    return {
      selHasClass: selCell.classList.contains('has-same-digit-active'),
      selBg: selStyle.backgroundColor,
      otherBg: otherStyle.backgroundColor,
      sameColor: selStyle.backgroundColor === otherStyle.backgroundColor,
      otherHasClass: otherCell.classList.contains('highlight-same-digit')
    };
  });

  console.log('Color check result:', colorCheck);
  if (!colorCheck.selHasClass) throw new Error('Selected cell does not have .has-same-digit-active class!');
  if (!colorCheck.sameColor) throw new Error(`Selected cell bg (${colorCheck.selBg}) and other 6 bg (${colorCheck.otherBg}) are NOT the same color!`);

  // Test mode: 'all'
  console.log('3. Testing mode: "all" (All 6s cast rays)...');
  const allRaysCheck = await page.evaluate(() => {
    const rayCasters = window.app.getCrosshatchRayCasters(6);
    // Rows of the 6s: 1, 6, 7, 8
    // Check cell (1, 6) in row 1, (6, 0) in row 6, (7, 5) in row 7, (8, 1) in row 8
    const c1_6 = window.app.cellElements[1][6];
    const c6_0 = window.app.cellElements[6][0];
    const c7_5 = window.app.cellElements[7][5];
    const c8_1 = window.app.cellElements[8][1];
    return {
      rayCount: rayCasters.length,
      c1_6_ray: c1_6.classList.contains('highlight-crosshatch-ray'),
      c6_0_ray: c6_0.classList.contains('highlight-crosshatch-ray'),
      c7_5_ray: c7_5.classList.contains('highlight-crosshatch-ray'),
      c8_1_ray: c8_1.classList.contains('highlight-crosshatch-ray')
    };
  });
  console.log('Mode "all" check:', allRaysCheck);
  if (allRaysCheck.rayCount !== 4) throw new Error(`Expected 4 ray casters in "all" mode, got ${allRaysCheck.rayCount}`);
  if (!allRaysCheck.c1_6_ray || !allRaysCheck.c6_0_ray || !allRaysCheck.c7_5_ray || !allRaysCheck.c8_1_ray) {
    throw new Error('Not all rows of 6s received crosshatch rays in "all" mode!');
  }
  await page.screenshot({ path: 'tools/screenshot_crosshatch_all.png' });
  console.log('Saved tools/screenshot_crosshatch_all.png');

  // Test cycling to '3'
  console.log('4. Cycling to mode "3"...');
  await page.click('#btn-crosshatch-toggle');
  await new Promise(r => setTimeout(r, 200));
  const mode3Check = await page.evaluate(() => {
    const app = window.app;
    const rayCasters = app.getCrosshatchRayCasters(6);
    const btnText = app.dom.crosshatchBtnLabel.textContent;
    return {
      mode: app.crosshatchMode,
      btnText,
      rayCount: rayCasters.length
    };
  });
  console.log('Mode "3" check:', mode3Check);
  if (mode3Check.mode !== '3' || mode3Check.rayCount !== 3) throw new Error('Mode 3 failed!');
  await page.screenshot({ path: 'tools/screenshot_crosshatch_3.png' });
  console.log('Saved tools/screenshot_crosshatch_3.png');

  // Test cycling to '2'
  console.log('5. Cycling to mode "2"...');
  await page.click('#btn-crosshatch-toggle');
  await new Promise(r => setTimeout(r, 200));
  const mode2Check = await page.evaluate(() => {
    const app = window.app;
    const rayCasters = app.getCrosshatchRayCasters(6);
    const btnText = app.dom.crosshatchBtnLabel.textContent;
    return {
      mode: app.crosshatchMode,
      btnText,
      rayCount: rayCasters.length
    };
  });
  console.log('Mode "2" check:', mode2Check);
  if (mode2Check.mode !== '2' || mode2Check.rayCount !== 2) throw new Error('Mode 2 failed!');
  await page.screenshot({ path: 'tools/screenshot_crosshatch_2.png' });
  console.log('Saved tools/screenshot_crosshatch_2.png');

  // Test cycling to '1'
  console.log('6. Cycling to mode "1"...');
  await page.click('#btn-crosshatch-toggle');
  await new Promise(r => setTimeout(r, 200));
  const mode1Check = await page.evaluate(() => {
    const app = window.app;
    const rayCasters = app.getCrosshatchRayCasters(6);
    const btnText = app.dom.crosshatchBtnLabel.textContent;
    return {
      mode: app.crosshatchMode,
      btnText,
      rayCount: rayCasters.length
    };
  });
  console.log('Mode "1" check:', mode1Check);
  if (mode1Check.mode !== '1' || mode1Check.rayCount !== 1) throw new Error('Mode 1 failed!');
  await page.screenshot({ path: 'tools/screenshot_crosshatch_1.png' });
  console.log('Saved tools/screenshot_crosshatch_1.png');

  // Test cycling to 'none'
  console.log('7. Cycling to mode "none"...');
  await page.click('#btn-crosshatch-toggle');
  await new Promise(r => setTimeout(r, 200));
  const modeNoneCheck = await page.evaluate(() => {
    const app = window.app;
    const btnText = app.dom.crosshatchBtnLabel.textContent;
    // Row 6 should NOT have crosshatch ray because mode is none
    const c6_0 = app.cellElements[6][0];
    return {
      mode: app.crosshatchMode,
      btnText,
      hasRay: c6_0.classList.contains('highlight-crosshatch-ray')
    };
  });
  console.log('Mode "none" check:', modeNoneCheck);
  if (modeNoneCheck.mode !== 'none' || modeNoneCheck.hasRay) throw new Error('Mode none failed!');
  await page.screenshot({ path: 'tools/screenshot_crosshatch_none.png' });
  console.log('Saved tools/screenshot_crosshatch_none.png');

  // Test Modal
  console.log('8. Testing Settings Modal and saving back to "all"...');
  await page.click('#btn-open-crosshatch-settings');
  await new Promise(r => setTimeout(r, 300));
  const modalOpen = await page.evaluate(() => {
    const modal = document.getElementById('crosshatch-settings-modal');
    return modal && modal.classList.contains('active');
  });
  if (!modalOpen) throw new Error('Crosshatch settings modal failed to open!');
  await page.screenshot({ path: 'tools/screenshot_crosshatch_modal.png' });
  console.log('Saved tools/screenshot_crosshatch_modal.png');

  // Select 'all' radio and save
  await page.evaluate(() => {
    const radio = document.querySelector('input[name="crosshatch-mode-type"][value="all"]');
    if (radio) radio.checked = true;
  });
  await page.click('#btn-save-crosshatch-settings');
  await new Promise(r => setTimeout(r, 300));

  const savedState = await page.evaluate(() => {
    return {
      mode: window.app.crosshatchMode,
      modalActive: document.getElementById('crosshatch-settings-modal').classList.contains('active'),
      inspectorHasBadge: !!document.querySelector('.crosshatch-inspector-badge')
    };
  });
  console.log('Saved state from modal:', savedState);
  if (savedState.mode !== 'all' || savedState.modalActive || !savedState.inspectorHasBadge) {
    throw new Error('Modal save verification failed!');
  }

  console.log('🎉 ALL CROSS-HATCHING AND SAME DIGIT COLOR TESTS PASSED 100%!');
  await browser.close();
})().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
