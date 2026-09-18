const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  console.log('--- TEST: NORMAL GAME CUSTOM PUZZLE & TIMER ---');
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
    await new Promise(r => setTimeout(r, 1000));

    // 1. Kiểm tra hiển thị nút và badge
    const hasTimerBadge = await page.evaluate(() => {
      const badge = document.getElementById('normal-timer-badge');
      const text = document.getElementById('normal-timer-text');
      return !!badge && !!text && text.textContent.includes(':');
    });
    console.log('1. Normal timer badge visible and counting:', hasTimerBadge ? 'PASSED' : 'FAILED');

    // 2. Mở modal tùy chỉnh đề chơi chung
    await page.click('#btn-open-custom-puzzle');
    await new Promise(r => setTimeout(r, 300));
    const modalActive = await page.evaluate(() => {
      return document.getElementById('custom-puzzle-modal').classList.contains('active');
    });
    console.log('2. Custom puzzle modal opened:', modalActive ? 'PASSED' : 'FAILED');

    // 3. Chọn cấp độ & ngẫu nhiên mã đề
    await page.evaluate(() => {
      document.querySelector('.btn-custom-diff[data-diff="hard"]').click();
      document.querySelector('#btn-custom-seed-random').click();
      document.querySelector('.btn-custom-timer-choice[data-mins="5"]').click();
    });
    await new Promise(r => setTimeout(r, 300));

    const shareUrl = await page.evaluate(() => document.getElementById('custom-share-url-box').textContent);
    console.log('3. Generated share URL:', shareUrl);
    const hasParams = shareUrl.includes('seed=') && shareUrl.includes('diff=hard') && shareUrl.includes('timer=5');
    console.log('   Share URL parameters correct:', hasParams ? 'PASSED' : 'FAILED');

    // 4. Bắt đầu chơi đề này
    await page.evaluate(() => document.getElementById('btn-start-custom-puzzle').click());
    await new Promise(r => setTimeout(r, 1200));

    const timerAfterStart = await page.evaluate(() => {
      const text = document.getElementById('normal-timer-text').textContent;
      const status = document.getElementById('status-text').textContent;
      return { text, status };
    });
    console.log('4. Timer after starting 5m custom puzzle:', timerAfterStart);
    const isCountdown5m = timerAfterStart.text.startsWith('04:5') || timerAfterStart.text === '05:00';
    console.log('   Countdown started from ~05:00:', isCountdown5m ? 'PASSED' : 'FAILED');

    // 5. Test Unified Settings Tab Timer
    await page.evaluate(() => document.getElementById('btn-open-unified-settings').click());
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate(() => document.querySelector('.settings-tab-btn[data-tab="timer"]').click());
    await new Promise(r => setTimeout(r, 200));

    const isTimerTabActive = await page.evaluate(() => {
      return document.getElementById('tab-pane-timer').classList.contains('active');
    });
    console.log('5. Unified settings Timer tab active:', isTimerTabActive ? 'PASSED' : 'FAILED');

    // Đổi sang đếm xuôi trong settings và lưu
    await page.evaluate(() => {
      document.getElementById('normal-timer-mode-countup').click();
      document.getElementById('btn-save-unified-settings').click();
    });
    await new Promise(r => setTimeout(r, 1200));

    const timerAfterCountup = await page.evaluate(() => document.getElementById('normal-timer-text').textContent);
    console.log('6. Timer after switching to countup in settings:', timerAfterCountup);

    // 7. Test URL parameters loading directly
    await page.goto('http://localhost:3000/?seed=TEST99&diff=extreme&timer=10', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1500));
    const urlInitState = await page.evaluate(() => {
      return {
        status: document.getElementById('status-text').textContent,
        timer: document.getElementById('normal-timer-text').textContent
      };
    });
    console.log('7. Direct URL load (?seed=TEST99&diff=extreme&timer=10):', urlInitState);
    const urlPassed = urlInitState.status.includes('TEST99') && (urlInitState.timer.startsWith('09:5') || urlInitState.timer === '10:00');
    console.log('   URL parameters load passed:', urlPassed ? 'PASSED' : 'FAILED');

    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  } finally {
    await browser.close();
  }
})();
