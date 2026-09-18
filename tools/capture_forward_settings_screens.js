const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function run() {
  const chromePaths = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ];
  let executablePath = chromePaths.find(p => fs.existsSync(p));

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // 1. Chụp màn hình Tab 4 trong Cài đặt Tùy chỉnh
  await page.evaluate(() => {
    window.app.openUnifiedSettingsModal('walkthrough');
  });
  await page.waitForTimeout ? page.waitForTimeout(400) : new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'tools/screenshot_tab_walkthrough.png' });

  // 2. Chụp màn hình khi TẮT công tắc
  await page.evaluate(() => {
    const toggle = document.getElementById('toggle-allow-forward-steps');
    if (toggle) {
      toggle.checked = false;
      toggle.dispatchEvent(new Event('change'));
    }
    document.getElementById('btn-save-unified-settings')?.click();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'tools/screenshot_timeline_capped_past_only.png' });

  // 3. Chụp màn hình Sổ tay công thức khi TẮT công tắc (hiển thị banner bảo mật)
  await page.evaluate(() => {
    window.app.openFormulaModal();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'tools/screenshot_formula_modal_past_only.png' });

  await browser.close();
  console.log('Screenshots captured successfully!');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
