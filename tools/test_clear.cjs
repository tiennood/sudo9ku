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
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // Dialog listener
  let dialogShown = false;
  page.on('dialog', async d => {
    console.log('Dialog prompt message:', d.message());
    dialogShown = true;
    await d.accept();
  });

  await page.click('#btn-clear-board');
  await new Promise(r => setTimeout(r, 500));
  console.log('Dialog shown:', dialogShown);

  const status = await page.$eval('#status-text', el => el.textContent);
  console.log('Status after clear:', status);
  await browser.close();
})();
