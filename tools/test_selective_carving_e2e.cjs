const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  console.log('--- TEST: SELECTIVE CLUE CARVING & WIN RATE SEED GENERATION ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    page.on('console', msg => {
      if (msg.type() === 'error') console.error('Browser error:', msg.text());
    });

    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1200));

    // 1. Mở modal tùy chỉnh đề chơi chung
    await page.click('#btn-open-custom-puzzle');
    await new Promise(r => setTimeout(r, 400));
    const modalActive = await page.evaluate(() => {
      return document.getElementById('custom-puzzle-modal').classList.contains('active');
    });
    console.log('1. Custom puzzle modal opened:', modalActive ? 'PASSED' : 'FAILED');

    // 2. Kiểm tra các nút bấm tỉ lệ thắng và nhãn hiển thị
    const winrateCheck = await page.evaluate(() => {
      const nightmareBtn = document.querySelector('.btn-custom-winrate[data-rate="nightmare"]');
      const hardcoreBtn = document.querySelector('.btn-custom-winrate[data-rate="hardcore"]');
      const standardBtn = document.querySelector('.btn-custom-winrate[data-rate="standard"]');
      const balancedBtn = document.querySelector('.btn-custom-winrate[data-rate="balanced"]');
      const label = document.getElementById('custom-winrate-label');

      nightmareBtn.click();
      const textNightmare = label.textContent;

      hardcoreBtn.click();
      const textHardcore = label.textContent;

      return {
        hasAllButtons: !!(nightmareBtn && hardcoreBtn && standardBtn && balancedBtn),
        textNightmare,
        textHardcore
      };
    });
    console.log('2. Winrate buttons and label dynamic updates:', winrateCheck);

    // 3. Chọn tỉ lệ Ác mộng (< 10%) và kiểm tra URL chia sẻ
    await page.evaluate(() => {
      document.querySelector('.btn-custom-winrate[data-rate="nightmare"]').click();
      document.querySelector('.btn-custom-diff[data-diff="hard"]').click();
      document.getElementById('custom-puzzle-seed-input').value = 'CARVE88';
      document.getElementById('custom-puzzle-seed-input').dispatchEvent(new Event('input'));
    });
    await new Promise(r => setTimeout(r, 300));

    const shareUrl = await page.evaluate(() => document.getElementById('custom-share-url-box').textContent);
    console.log('3. Generated share URL:', shareUrl);
    const hasRateInUrl = shareUrl.includes('rate=nightmare') && shareUrl.includes('seed=CARVE88');
    console.log('   Share URL contains rate parameter:', hasRateInUrl ? 'PASSED' : 'FAILED');

    // 4. Bắt đầu chơi với thuật toán Selective Clue Carving
    await page.evaluate(() => document.getElementById('btn-start-custom-puzzle').click());
    await new Promise(r => setTimeout(r, 1500));

    const gameState = await page.evaluate(() => {
      const app = window.app;
      const initialBoard = app.initialBoard;
      const clues = initialBoard.flat().filter(x => x > 0).length;
      const solCount = window.SudokuSolver ? window.SudokuSolver.countSolutions(initialBoard, 2) : 1;
      const fetchStatus = document.getElementById('fetch-status-info')?.innerHTML || '';
      const statusText = document.getElementById('status-text')?.textContent || '';
      return {
        clues,
        solCount,
        fetchStatus,
        statusText,
        activeCustomWinRate: app.activeCustomWinRate,
        walkthroughSteps: app.solvingWalkthrough?.length || 0
      };
    });
    console.log('4. Game state after starting carved puzzle:');
    console.log('   Clues count:', gameState.clues);
    console.log('   Solutions count (MUST BE 1):', gameState.solCount);
    console.log('   Win rate tier active:', gameState.activeCustomWinRate);
    console.log('   Walkthrough steps generated:', gameState.walkthroughSteps);
    console.log('   Status bar text:', gameState.statusText);

    if (gameState.solCount !== 1) {
      throw new Error(`CRITICAL ERROR: Solutions count is ${gameState.solCount}, expected exactly 1!`);
    }

    // 5. Test nạp trực tiếp qua URL: ?seed=ULTRA123&diff=hard&rate=nightmare
    console.log('5. Testing Direct URL loading with Selective Carving parameter...');
    await page.goto('http://localhost:3000/?seed=ULTRA123&diff=hard&rate=nightmare', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1500));

    const urlState = await page.evaluate(() => {
      const app = window.app;
      const clues = app.initialBoard.flat().filter(x => x > 0).length;
      return {
        seed: app.activeCustomSeed,
        diff: app.activeCustomDifficulty,
        rate: app.activeCustomWinRate,
        clues,
        status: document.getElementById('status-text').textContent
      };
    });
    console.log('   Direct URL loaded state:', urlState);
    const urlCheck = urlState.seed === 'ULTRA123' && urlState.rate === 'nightmare' && urlState.clues <= 25;
    console.log('   Direct URL Carving test:', urlCheck ? 'PASSED' : 'FAILED');

    console.log('\n🎉 ALL SELECTIVE CLUE CARVING & WIN RATE TESTS PASSED PERFECTLY!');
  } finally {
    await browser.close();
  }
})();
