const puppeteer = require('puppeteer-core');

(async () => {
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({ executablePath: edge, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  console.log('Navigating to sudoku.com...');
  await page.goto('https://sudoku.com/vi/extreme/', { waitUntil: 'networkidle2', timeout: 30000 });

  // wait until game is loaded (canvas or board is ready)
  await page.waitForSelector('#game canvas', { timeout: 15000 });
  console.log('Game canvas found!');

  // Click on canvas to trigger an interaction and save
  const canvas = await page.$('#game canvas');
  const box = await canvas.boundingBox();
  // click cell
  await page.mouse.click(box.x + 30, box.y + 30);
  await new Promise(r => setTimeout(r, 500));
  await page.keyboard.press('Digit1');
  await new Promise(r => setTimeout(r, 2000));

  const state = await page.evaluate(() => {
    return {
      localStorageKeys: Object.keys(localStorage),
      sessionStorageKeys: Object.keys(sessionStorage),
      allLocalStorage: Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k).substring(0, 200)])),
      main_game: localStorage.getItem('main_game')
    };
  });

  console.log('--- Storage keys ---', state.localStorageKeys);
  console.log('--- Storage values ---', state.allLocalStorage);

  await browser.close();
})();
