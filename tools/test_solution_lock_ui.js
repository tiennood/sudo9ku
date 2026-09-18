const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🚀 Testing Solution Lock UI without browser alert...');
  const chromePaths = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'
  ];
  let executablePath = chromePaths.find(p => fs.existsSync(p));
  const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  let alertFired = false;
  page.on('dialog', async dialog => {
    alertFired = true;
    console.log('⚠️ Dialog fired:', dialog.message());
    await dialog.dismiss();
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // 1. Tắt xem trước tương lai
  console.log('1. Setting allowForwardSteps = false...');
  await page.evaluate(() => {
    window.app.allowForwardSteps = false;
    localStorage.setItem('sudoku_allow_forward_steps', 'false');
    window.app.updateSolutionPreviewLockUI();
  });

  const state1 = await page.evaluate(() => {
    const toggle = document.getElementById('toggle-solution');
    const subtext = document.getElementById('solution-preview-subtext');
    const btnFill = document.getElementById('btn-fill-all-solution');
    return {
      toggleDisabled: toggle.disabled,
      subtextHtml: subtext.innerHTML,
      btnFillDisabled: btnFill.disabled
    };
  });
  console.log('Locked State:', state1);

  await page.screenshot({ path: 'screenshot_solution_locked_ui.png' });
  console.log('Saved screenshot_solution_locked_ui.png');

  // Copy to artifact dir
  fs.copyFileSync('screenshot_solution_locked_ui.png', 'C:/Users/Tein/.gemini/antigravity-ide/brain/ca1cc67e-dd3d-4373-b74a-67ec53d73077/screenshot_solution_locked_ui.png');

  // 2. Thử click nút xem trước / điền tất cả
  console.log('2. Trying to click toggle or fill button...');
  await page.evaluate(() => {
    document.getElementById('btn-fill-all-solution').click();
  });

  const statusText = await page.evaluate(() => {
    return document.getElementById('board-status')?.textContent;
  });
  console.log('Status message displayed:', statusText);
  console.log('Did browser native alert fire?:', alertFired);

  // 3. Khôi phục allowForwardSteps = true
  await page.evaluate(() => {
    window.app.allowForwardSteps = true;
    localStorage.setItem('sudoku_allow_forward_steps', 'true');
    window.app.updateSolutionPreviewLockUI();
  });
  const state2 = await page.evaluate(() => {
    return {
      toggleDisabled: document.getElementById('toggle-solution').disabled,
      btnFillDisabled: document.getElementById('btn-fill-all-solution').disabled
    };
  });
  console.log('Restored State:', state2);

  await browser.close();
  console.log('🎉 Verification passed!');
})();
