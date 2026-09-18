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
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // Wait for board and sample image to load
  await page.waitForSelector('#sudoku-grid .sudoku-cell');
  await new Promise(r => setTimeout(r, 1200));

  // 1. Test clicking "Xóa cờ" (#btn-clear-board) - must work immediately without any confirm prompt
  console.log('--- TEST 1: Click "Xóa cờ" ---');
  await page.click('#btn-clear-board');
  await new Promise(r => setTimeout(r, 300));
  const boardAfterClear = await page.evaluate(() => {
    const app = window.app;
    let nonZero = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (app.currentBoard[r][c] !== 0) nonZero++;
      }
    }
    return {
      nonZero,
      status: document.getElementById('status-text').textContent,
      mistakesText: document.getElementById('mistake-counter-text').textContent
    };
  });
  console.log('Board state after "Xóa cờ":', boardAfterClear);
  if (boardAfterClear.nonZero !== 0) throw new Error('Board was not completely cleared!');

  // 2. Reload sample image to test "Chơi lại" and "⌫ Xóa"
  console.log('--- TEST 2: Reload Sample & Test "⌫ Xóa" ---');
  await page.click('#btn-sample');
  await new Promise(r => setTimeout(r, 1500));

  // Find an empty cell, fill it with a number
  const emptyCell = await page.evaluate(() => {
    const app = window.app;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (app.initialBoard[r][c] === 0 && app.solution) {
          return { row: r, col: c, val: app.solution[r][c] };
        }
      }
    }
    return null;
  });
  console.log('Test cell for fill and erase:', emptyCell);

  await page.evaluate((r, c) => window.app.selectCell(r, c), emptyCell.row, emptyCell.col);
  await page.evaluate((v) => window.app.inputSelectedCellValue(v), emptyCell.val);
  
  let filledVal = await page.evaluate((r, c) => window.app.currentBoard[r][c], emptyCell.row, emptyCell.col);
  console.log('Filled cell value before erase:', filledVal);

  // Now click numpad "⌫ Xóa"
  await page.evaluate(() => {
    const eraseBtn = document.querySelector('.numpad-btn.action-btn[data-val="0"]');
    eraseBtn.click();
  });
  await new Promise(r => setTimeout(r, 300));

  let erasedVal = await page.evaluate((r, c) => window.app.currentBoard[r][c], emptyCell.row, emptyCell.col);
  console.log('Cell value after clicking "⌫ Xóa":', erasedVal);
  if (erasedVal !== 0) throw new Error('Cell was not erased by "⌫ Xóa"!');

  // 3. Test "🔄 Chơi lại" (#btn-restart-game)
  console.log('--- TEST 3: Test "🔄 Chơi lại" button ---');
  // Fill wrong number to create a mistake
  await page.evaluate((r, c) => {
    window.app.selectCell(r, c);
    const correct = window.app.solution[r][c];
    window.app.inputSelectedCellValue(correct === 9 ? 1 : correct + 1);
  }, emptyCell.row, emptyCell.col);

  let mistakesBeforeRestart = await page.evaluate(() => window.app.mistakesCount);
  console.log('Mistakes count before restart:', mistakesBeforeRestart);

  // Click "🔄 Chơi lại"
  await page.click('#btn-restart-game');
  await new Promise(r => setTimeout(r, 400));

  const stateAfterRestart = await page.evaluate((r, c) => ({
    mistakes: window.app.mistakesCount,
    cellVal: window.app.currentBoard[r][c],
    status: document.getElementById('status-text').textContent
  }), emptyCell.row, emptyCell.col);
  console.log('State after "🔄 Chơi lại":', stateAfterRestart);

  if (stateAfterRestart.mistakes !== 0) throw new Error('Mistakes were not reset!');
  if (stateAfterRestart.cellVal !== 0) throw new Error('Cell was not reset to original!');

  // 4. Test locked given clue when trying to erase
  console.log('--- TEST 4: Locked given clue ---');
  const givenCell = await page.evaluate(() => {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (window.app.initialBoard[r][c] !== 0) {
          return { row: r, col: c, val: window.app.initialBoard[r][c] };
        }
      }
    }
  });

  await page.evaluate((r, c) => {
    window.app.selectCell(r, c);
    window.app.eraseSelectedCell();
  }, givenCell.row, givenCell.col);

  const givenAfterErase = await page.evaluate((r, c) => ({
    initial: window.app.initialBoard[r][c],
    current: window.app.currentBoard[r][c],
    status: document.getElementById('status-text').textContent
  }), givenCell.row, givenCell.col);
  console.log('Given cell state after attempting erase:', givenAfterErase);

  if (givenAfterErase.initial !== givenCell.val) throw new Error('Given cell initialBoard was modified!');
  if (givenAfterErase.current !== givenCell.val) throw new Error('Given cell currentBoard was modified!');

  await page.screenshot({ path: 'C:/Users/Tein/.gemini/antigravity-ide/brain/ca1cc67e-dd3d-4373-b74a-67ec53d73077/clear_board_verified.png' });

  await browser.close();
  console.log('ALL CLEAR & ERASE TESTS PASSED 100%!');
})();
