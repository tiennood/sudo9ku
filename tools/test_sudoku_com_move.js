const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({ executablePath: edge, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  await page.goto('https://sudoku.com/vi/extreme/', { waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise(r => setTimeout(r, 3000));

  // Click on the game canvas to select a cell
  const canvas = await page.$('#game canvas');
  if (canvas) {
    const box = await canvas.boundingBox();
    // click top-left cell
    await page.mouse.click(box.x + 30, box.y + 30);
    await new Promise(r => setTimeout(r, 500));
    // press key '1'
    await page.keyboard.press('Digit1');
    await new Promise(r => setTimeout(r, 1000));
  }

  const mainGame = await page.evaluate(() => {
    return {
      main_game: localStorage.getItem('main_game'),
      allStorage: Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]))
    };
  });

  console.log('MAIN GAME FROM SUDOKU.COM:');
  console.log(mainGame.main_game);
  await browser.close();
})();
