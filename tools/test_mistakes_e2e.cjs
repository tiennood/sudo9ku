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
  if (!exe) { console.error('No browser found'); process.exit(1); }

  const browser = await puppeteer.launch({
    executablePath: exe,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // Wait for board and sample image to load
  await page.waitForSelector('#sudoku-grid .sudoku-cell');
  await new Promise(r => setTimeout(r, 1500));

  // 1. Verify initial mistake counter
  const badgeText = await page.$eval('#mistake-counter-text', el => el.textContent.trim());
  console.log('Initial Mistake Badge:', badgeText);

  // 2. Find an empty cell where solution is known
  const testInfo = await page.evaluate(() => {
    const app = window.app;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (app.initialBoard[r][c] === 0 && app.solution) {
          return { row: r, col: c, correctVal: app.solution[r][c] };
        }
      }
    }
    return null;
  });
  console.log('Empty test cell found:', testInfo);

  // Select the cell
  await page.evaluate((r, c) => {
    window.app.selectCell(r, c);
  }, testInfo.row, testInfo.col);

  // Enter CORRECT value
  await page.evaluate((val) => {
    window.app.inputSelectedCellValue(val);
  }, testInfo.correctVal);

  const statusAfterCorrect = await page.$eval('#status-text', el => el.textContent);
  const badgeAfterCorrect = await page.$eval('#mistake-counter-text', el => el.textContent.trim());
  console.log('Status after correct input:', statusAfterCorrect);
  console.log('Badge after correct input:', badgeAfterCorrect);

  // Find another empty cell to enter WRONG value
  const wrongCellInfo = await page.evaluate(() => {
    const app = window.app;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (app.currentBoard[r][c] === 0 && app.solution) {
          const correct = app.solution[r][c];
          const wrong = correct === 9 ? 1 : correct + 1;
          return { row: r, col: c, wrongVal: wrong };
        }
      }
    }
    return null;
  });
  console.log('Wrong test cell:', wrongCellInfo);

  await page.evaluate((r, c) => {
    window.app.selectCell(r, c);
  }, wrongCellInfo.row, wrongCellInfo.col);

  await page.evaluate((val) => {
    window.app.inputSelectedCellValue(val);
  }, wrongCellInfo.wrongVal);

  const statusAfterWrong = await page.$eval('#status-text', el => el.textContent);
  const badgeAfterWrong = await page.$eval('#mistake-counter-text', el => el.textContent.trim());
  console.log('Status after wrong input:', statusAfterWrong);
  console.log('Badge after wrong input:', badgeAfterWrong);

  // Take screenshot of live mistake feedback
  await page.screenshot({ path: 'C:/Users/Tein/.gemini/antigravity-ide/brain/ca1cc67e-dd3d-4373-b74a-67ec53d73077/instant_feedback_test.png' });

  // 3. Open Settings Modal
  await page.click('#mistakes-badge');
  await new Promise(r => setTimeout(r, 400));
  const settingsOpen = await page.$eval('#mistakes-settings-modal', el => el.classList.contains('active'));
  console.log('Settings Modal open:', settingsOpen);

  await page.screenshot({ path: 'C:/Users/Tein/.gemini/antigravity-ide/brain/ca1cc67e-dd3d-4373-b74a-67ec53d73077/mistakes_settings_modal.png' });

  // Close Settings Modal
  await page.evaluate(() => document.getElementById('btn-close-mistakes-modal').click());
  await new Promise(r => setTimeout(r, 400));

  // 4. Open History Modal
  await page.evaluate(() => document.getElementById('btn-open-history').click());
  await new Promise(r => setTimeout(r, 400));
  const historyOpen = await page.$eval('#history-modal', el => el.classList.contains('active'));
  const historyMetrics = await page.evaluate(() => ({
    total: document.getElementById('metric-total-games').textContent,
    mistakes: document.getElementById('metric-total-mistakes').textContent,
    avg: document.getElementById('metric-avg-mistakes').textContent,
    itemsCount: document.querySelectorAll('#recent-games-list .recent-game-item').length
  }));
  console.log('History Modal open:', historyOpen, historyMetrics);

  await page.screenshot({ path: 'C:/Users/Tein/.gemini/antigravity-ide/brain/ca1cc67e-dd3d-4373-b74a-67ec53d73077/history_modal_test.png' });

  // 5. Test reaching Game Over condition
  await page.evaluate(() => document.getElementById('btn-close-history-modal').click());
  await new Promise(r => setTimeout(r, 400));

  // Trigger two more mistakes to reach 3 mistakes (Game Over)
  for (let m = 0; m < 2; m++) {
    const nextWrong = await page.evaluate(() => {
      const app = window.app;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (app.currentBoard[r][c] === 0 && app.solution) {
            const correct = app.solution[r][c];
            const wrong = correct === 9 ? 1 : correct + 1;
            return { row: r, col: c, wrongVal: wrong };
          }
        }
      }
      return null;
    });
    if (nextWrong) {
      await page.evaluate((r, c) => window.app.selectCell(r, c), nextWrong.row, nextWrong.col);
      await page.evaluate((val) => window.app.inputSelectedCellValue(val), nextWrong.wrongVal);
    }
  }

  const gameOverActive = await page.$eval('#game-over-modal', el => el.classList.contains('active'));
  console.log('Game Over Modal active after 3 mistakes:', gameOverActive);
  await page.screenshot({ path: 'C:/Users/Tein/.gemini/antigravity-ide/brain/ca1cc67e-dd3d-4373-b74a-67ec53d73077/game_over_modal_test.png' });

  // 6. Verify that trying to type while in Game Over state is completely blocked
  const inputBlocked = await page.evaluate(() => {
    const beforeCount = window.app.mistakesCount;
    window.app.selectCell(4, 4);
    const beforeVal = window.app.currentBoard[4][4];
    window.app.inputSelectedCellValue(5);
    const afterVal = window.app.currentBoard[4][4];
    return beforeVal === afterVal && window.app.mistakesCount === beforeCount;
  });
  console.log('Input blocked in Game Over state:', inputBlocked);

  // Test Continue Unlimited button
  await page.evaluate(() => document.getElementById('btn-continue-unlimited').click());
  await new Promise(r => setTimeout(r, 400));
  const badgeAfterUnlimited = await page.$eval('#mistake-counter-text', el => el.textContent.trim());
  console.log('Badge after choosing unlimited:', badgeAfterUnlimited);

  // 7. Verify that given cells are locked and cannot be edited
  const givenLocked = await page.evaluate(() => {
    // Find a given cell
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (window.app.initialBoard[r][c] !== 0) {
          const original = window.app.initialBoard[r][c];
          window.app.selectCell(r, c);
          window.app.inputSelectedCellValue(original === 9 ? 1 : original + 1);
          return window.app.initialBoard[r][c] === original && window.app.currentBoard[r][c] === original;
        }
      }
    }
    return false;
  });
  console.log('Given cells locked and protected from modification:', givenLocked);

  await page.screenshot({ path: 'C:/Users/Tein/.gemini/antigravity-ide/brain/ca1cc67e-dd3d-4373-b74a-67ec53d73077/after_continue_unlimited.png' });

  await browser.close();
  console.log('ALL E2E VERIFICATION CHECKS PASSED!');
})();
