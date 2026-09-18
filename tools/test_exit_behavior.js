const puppeteer = require('puppeteer-core');

(async () => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = (await browser.pages())[0];
  await page.goto('https://sudoku.com/vi/extreme/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => console.log('hello'));
  
  browser.disconnect();
  console.log('Exiting node process now...');
  process.exit(0);
})();
