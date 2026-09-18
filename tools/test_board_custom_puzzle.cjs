const puppeteer = require('puppeteer-core');

async function testBoardButton() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({ executablePath: edgePath, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  
  console.log('1. Checking btn-open-custom-puzzle on board toolbar...');
  const btn = await page.$('#btn-open-custom-puzzle');
  const visible = await page.evaluate(el => el.offsetParent !== null, btn);
  console.log('Button visible?', visible);
  
  console.log('2. Clicking btn-open-custom-puzzle...');
  await btn.click();
  await new Promise(r => setTimeout(r, 400));
  
  const modalInfo = await page.evaluate(() => {
    const modal = document.getElementById('custom-puzzle-modal');
    const box = modal.getBoundingClientRect();
    const style = window.getComputedStyle(modal);
    return {
      active: modal.classList.contains('active'),
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      width: box.width,
      height: box.height,
      top: box.top,
      left: box.left
    };
  });
  console.log('Modal visible on screen:', modalInfo);
  
  console.log('3. Clicking random seed inside modal...');
  await page.click('#btn-custom-seed-random');
  const seed = await page.evaluate(() => document.getElementById('custom-puzzle-seed-input').value);
  console.log('Generated random seed:', seed);
  
  console.log('4. Selecting 10 mins countdown...');
  await page.click('.btn-custom-timer-choice[data-mins="10"]');
  
  console.log('5. Clicking "▶️ Bắt đầu chơi đề này"...');
  await page.click('#btn-start-custom-puzzle');
  await new Promise(r => setTimeout(r, 400));
  
  const result = await page.evaluate(() => {
    const modal = document.getElementById('custom-puzzle-modal');
    const statusText = document.getElementById('status-text').textContent;
    const timerBadge = document.getElementById('normal-timer-badge').textContent.trim();
    return {
      modalClosed: !modal.classList.contains('active'),
      statusText,
      timerBadge
    };
  });
  console.log('Game started result:', result);

  console.log('\n--- TESTING MOBILE VIEW (390x844) ---');
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.reload({ waitUntil: 'networkidle0' });
  const mobileBtn = await page.$('#btn-open-custom-puzzle');
  const mobileVisible = await page.evaluate(el => el.offsetParent !== null, mobileBtn);
  console.log('Mobile view - Button visible?', mobileVisible);
  await mobileBtn.click();
  await new Promise(r => setTimeout(r, 400));
  const mobileModalActive = await page.evaluate(() => document.getElementById('custom-puzzle-modal').classList.contains('active'));
  console.log('Mobile view - Modal opened?', mobileModalActive);
  
  await browser.close();
}

testBoardButton().catch(console.error);
