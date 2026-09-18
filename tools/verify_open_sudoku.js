const puppeteer = require('puppeteer-core');

(async () => {
  console.log('Connecting to browser CDP on port 9222...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  for (const p of pages) {
    try {
      const client = await p.target().createCDPSession();
      await client.send('Emulation.clearDeviceMetricsOverride');
      await p.setViewport(null).catch(() => {});
    } catch(e) {}
  }
  
  // Find localhost:3000 page
  let appPage = pages.find(p => p.url().includes('localhost:3000'));
  if (!appPage) {
    appPage = await browser.newPage();
    await appPage.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  } else {
    await appPage.bringToFront();
    await appPage.reload({ waitUntil: 'networkidle2' });
  }

  console.log('App page ready:', appPage.url());
  await new Promise(r => setTimeout(r, 1000));

  // Step 1: Click "⚡ Lấy đề mới"
  console.log('Clicking "⚡ Lấy đề mới"...');
  await appPage.evaluate(() => document.getElementById('btn-fetch-sudoku').click());
  
  // Wait until status bar has "Đã nạp thành công"
  await appPage.waitForFunction(() => {
    const status = document.getElementById('status-text');
    return status && status.textContent.includes('Đã nạp thành công');
  }, { timeout: 15000 });

  const statusText = await appPage.evaluate(() => document.getElementById('status-text').textContent);
  const fetchInfo = await appPage.evaluate(() => document.getElementById('fetch-status-info').textContent);
  console.log('Loaded puzzle status:', statusText);
  console.log('Fetch card info:', fetchInfo);

  // Step 2: Enter a number on an empty cell
  console.log('Finding an empty cell on the board to enter a number...');
  const userMoveResult = await appPage.evaluate(() => {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!window.app.isOriginalClue[r][c]) {
          window.app.selectCell(r, c);
          const solVal = window.app.officialSolution ? window.app.officialSolution[r][c] : 1;
          window.app.inputSelectedCellValue(solVal);
          return { row: r, col: c, value: solVal };
        }
      }
    }
    return null;
  });

  console.log('Entered user move:', userMoveResult);
  await new Promise(r => setTimeout(r, 1000));

  await appPage.screenshot({ path: 'scratch/app_before_click_sudoku_com.png' });
  console.log('Screenshot saved to scratch/app_before_click_sudoku_com.png');

  // Step 3: Click [Sudoku.com ↗]
  console.log('Clicking [Sudoku.com ↗] button...');
  await appPage.evaluate(() => document.getElementById('link-sudoku-web').click());

  // Wait for open-sudoku to finish
  console.log('Waiting for open-sudoku sync to finish...');
  await appPage.waitForFunction(() => {
    const status = document.getElementById('status-text');
    return status && status.textContent.includes('cờ đang giải!');
  }, { timeout: 30000 });

  const postClickStatus = await appPage.evaluate(() => document.getElementById('status-text').textContent);
  console.log('Status after clicking Sudoku.com ↗:', postClickStatus);

  await appPage.screenshot({ path: 'scratch/app_after_click_sudoku_com.png' });
  
  // Step 4: Verify the Sudoku.com tab
  await new Promise(r => setTimeout(r, 2500));
  const allPages = await browser.pages();
  const sudokuPage = allPages.find(p => {
    try {
      const u = new URL(p.url());
      return u.hostname === 'sudoku.com' || u.hostname === 'www.sudoku.com';
    } catch (e) { return false; }
  });
  if (sudokuPage) {
    console.log('Sudoku.com page found in browser! Checking storage...');
    const sudokuState = await sudokuPage.evaluate(() => {
      const mg = localStorage.getItem('main_game');
      const parsed = mg ? JSON.parse(mg) : null;
      return {
        id: parsed ? parsed.id : null,
        difficulty: parsed ? parsed.difficulty : null,
        winRate: parsed ? parsed.winRate : null,
        userFilledMoves: parsed ? parsed.values.filter(v => v.val > 0 && v.editable).map(v => v.val) : []
      };
    });

    console.log('=== SUDOKU.COM ENGINE STATE ===');
    console.log('Puzzle ID:', sudokuState.id);
    console.log('Difficulty:', sudokuState.difficulty);
    console.log('Win Rate:', sudokuState.winRate);
    console.log('User moves on Sudoku.com board:', sudokuState.userFilledMoves);

    await sudokuPage.bringToFront();
    await new Promise(r => setTimeout(r, 1000));
    await sudokuPage.screenshot({ path: 'scratch/sudoku_com_synced_final.png' });
    console.log('Screenshot saved to scratch/sudoku_com_synced_final.png');

    if (sudokuState.userFilledMoves.length > 0) {
      console.log('>>> SUCCESS: User moves were successfully transferred and rendered on Sudoku.com! <<<');
    } else {
      console.error('>>> FAIL: User moves were empty on Sudoku.com! <<<');
    }
  } else {
    console.error('Sudoku.com page not found in browser!');
  }

  browser.disconnect();
  console.log('Verification finished!');
})();
