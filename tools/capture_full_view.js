const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('localhost:3000')) || pages[0];
  await page.setViewport({ width: 1440, height: 950 });

  // Scroll to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 400));

  const screenshotPath = 'tools/walkthrough_full_board.png';
  await page.screenshot({ path: screenshotPath });
  console.log('Saved:', screenshotPath);

  const artifactDir = 'C:\\Users\\Tein\\.gemini\\antigravity-ide\\brain\\ca1cc67e-dd3d-4373-b74a-67ec53d73077';
  fs.copyFileSync(screenshotPath, path.join(artifactDir, 'walkthrough_full_board.png'));
})();
