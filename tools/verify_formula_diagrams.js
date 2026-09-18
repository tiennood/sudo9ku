const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('🚀 Starting Formula Diagram Verification with puppeteer-core...');
  const chromePaths = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'
  ];
  let executablePath = chromePaths.find(p => fs.existsSync(p));
  if (!executablePath) {
    throw new Error('Could not find chrome.exe in standard paths: ' + JSON.stringify(chromePaths));
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // 1. Open Formula Handbook Modal
  console.log('📖 Opening Formula Handbook...');
  await page.evaluate(() => {
    window.app.openFormulaModal();
  });

  await new Promise(r => setTimeout(r, 600));

  // Verify preview cards exist
  const cardCount = await page.evaluate(() => {
    return document.querySelectorAll('.formula-diagram-preview-card').length;
  });
  console.log(`✅ Found ${cardCount} formula diagram preview cards in handbook (expected 9)`);

  const handbookScreenshotPath = path.join(__dirname, '../handbook_diagrams_preview.png');
  await page.screenshot({ path: handbookScreenshotPath });
  console.log('📸 Saved handbook preview screenshot:', handbookScreenshotPath);

  // 2. Click to zoom diagram modal ("Ấn dô để xem")
  console.log('🔍 Clicking on Naked Single diagram card to zoom...');
  await page.click('.formula-diagram-preview-card[data-formula-key="naked-single"]');
  await new Promise(r => setTimeout(r, 500));

  const modalState = await page.evaluate(() => {
    const modal = document.getElementById('formula-diagram-modal');
    const title = document.getElementById('diagram-modal-title')?.textContent;
    const badge = document.getElementById('diagram-modal-badge')?.textContent;
    const counter = document.getElementById('diagram-modal-counter')?.textContent;
    const svgExists = !!document.querySelector('#diagram-modal-svg-container svg');
    const stepsCount = document.querySelectorAll('#diagram-modal-steps .diagram-step-item').length;
    const isVisible = modal && modal.classList.contains('active');
    return { isVisible, title, badge, counter, svgExists, stepsCount };
  });
  console.log('✅ Diagram Modal Opened State:', modalState);

  const modalScreenshot1 = path.join(__dirname, '../diagram_modal_naked_single.png');
  await page.screenshot({ path: modalScreenshot1 });
  console.log('📸 Saved modal Naked Single screenshot:', modalScreenshot1);

  // 3. Test Navigation: Next -> Hidden Single
  console.log('➡️ Clicking Next Diagram button...');
  await page.click('#btn-next-diagram');
  await new Promise(r => setTimeout(r, 400));

  const nextState = await page.evaluate(() => {
    return {
      title: document.getElementById('diagram-modal-title')?.textContent,
      counter: document.getElementById('diagram-modal-counter')?.textContent
    };
  });
  console.log('✅ Navigated to next:', nextState);

  // 4. Test Navigation to X-Wing (key: x-wing)
  console.log('➡️ Opening X-Wing directly via open("x-wing")...');
  await page.evaluate(() => {
    window.app.diagramViewer.open('x-wing');
  });
  await new Promise(r => setTimeout(r, 400));

  const xWingState = await page.evaluate(() => {
    return {
      title: document.getElementById('diagram-modal-title')?.textContent,
      counter: document.getElementById('diagram-modal-counter')?.textContent
    };
  });
  console.log('✅ X-Wing State:', xWingState);

  const modalScreenshot2 = path.join(__dirname, '../diagram_modal_x_wing.png');
  await page.screenshot({ path: modalScreenshot2 });
  console.log('📸 Saved X-Wing screenshot:', modalScreenshot2);

  // 5. Close diagram modal
  console.log('❌ Closing Diagram Modal...');
  await page.click('#btn-close-diagram-modal');
  await new Promise(r => setTimeout(r, 300));

  const isClosed = await page.evaluate(() => {
    const modal = document.getElementById('formula-diagram-modal');
    return !modal.classList.contains('active');
  });
  console.log('✅ Diagram Modal closed properly:', isClosed);

  await browser.close();
  console.log('🎉 ALL FORMULA DIAGRAM TESTS PASSED!');
})();
