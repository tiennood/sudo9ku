const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Tein\\.gemini\\antigravity-ide\\brain\\ca1cc67e-dd3d-4373-b74a-67ec53d73077';

async function testExtremeArena() {
  console.log('⚔️ [KIỂM THỬ] Đấu Trường Sinh Tồn Extreme: Thợ Săn Số 9...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('Arena') || msg.text().includes('Đấu')) {
      console.log(`[Browser ${msg.type()}]:`, msg.text());
    }
  });

  try {
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
    console.log('✅ Đã tải trang chủ http://localhost:3000/');

    // 1. Kiểm tra sự hiện diện của các nút mở Đấu trường
    const btnOpen = await page.$('#btn-open-extreme-arena');
    const btnOpenAlt = await page.$('#btn-open-extreme-arena-alt');
    if (!btnOpen || !btnOpenAlt) {
      throw new Error('Nút mở Đấu trường không tìm thấy trên trang!');
    }
    console.log('✅ Nút mở Đấu trường Extreme đã xuất hiện ở cả 2 vị trí (Fetch card & Board toolbar)!');

    // 2. Click mở Modal Thiết lập
    await page.click('#btn-open-extreme-arena');
    await new Promise(r => setTimeout(r, 400));

    const isModalActive = await page.evaluate(() => {
      const m = document.getElementById('extreme-arena-setup-modal');
      return m && m.classList.contains('active');
    });
    if (!isModalActive) throw new Error('Modal thiết lập không mở sau khi click!');
    console.log('✅ Modal thiết lập Đấu trường Extreme đã mở thành công!');

    // Chụp ảnh Modal thiết lập
    const setupPicPath = path.join(ARTIFACT_DIR, 'arena_setup_modal.png');
    await page.screenshot({ path: setupPicPath });
    console.log(`📸 Đã chụp ảnh Modal thiết lập: ${setupPicPath}`);

    // 3. Nhập mã đề 1367 và click Bắt đầu thi đấu
    await page.evaluate(() => {
      const input = document.getElementById('arena-seed-input');
      if (input) input.value = '1367';
    });
    await page.click('#btn-start-arena-match');
    await new Promise(r => setTimeout(r, 1200));

    // 4. Kiểm tra HUD bar và các thành phần
    const hudState = await page.evaluate(() => {
      const hud = document.getElementById('arena-hud-bar');
      const isVisible = hud && window.getComputedStyle(hud).display !== 'none';
      const seedText = document.getElementById('arena-hud-seed')?.textContent;
      const winRateText = document.getElementById('arena-hud-winrate')?.textContent;
      const timerText = document.getElementById('arena-hud-timer')?.textContent;
      const livesText = document.getElementById('arena-hud-lives')?.textContent;
      const heldBadges = Array.from(document.querySelectorAll('.held-number-badge')).map(b => b.textContent);
      
      const lockedKeys = document.querySelectorAll('.numpad-btn.arena-key-locked').length;
      const activeKeys = document.querySelectorAll('.numpad-btn.arena-key-active').length;

      return {
        isVisible,
        seedText,
        winRateText,
        timerText,
        livesText,
        heldBadges,
        lockedKeys,
        activeKeys
      };
    });

    console.log('✅ Trạng thái HUD Đấu trường:', hudState);
    if (!hudState.isVisible) throw new Error('HUD bar không hiển thị!');
    if (!hudState.seedText.includes('1367')) throw new Error('Mã đề HUD không đúng!');
    if (hudState.heldBadges.length === 0) throw new Error('Không có số thợ săn nào được cấp phát!');
    if (hudState.activeKeys === 0 || hudState.lockedKeys === 0) throw new Error('Keypad lock visuals chưa hoạt động đúng!');

    console.log(`🎯 Số đang săn ban đầu: [ ${hudState.heldBadges.join(', ')} ]`);

    // 5. Thử nghiệm Đổi 1 lỗi lấy số (+1 lỗi -> mở thêm 1 số)
    console.log('👉 Thử nghiệm bấm nút "Đổi 1 lỗi lấy số"...');
    await page.click('#btn-arena-sacrifice-life');
    await new Promise(r => setTimeout(r, 600));

    const afterTrade = await page.evaluate(() => {
      const livesText = document.getElementById('arena-hud-lives')?.textContent;
      const heldBadges = Array.from(document.querySelectorAll('.held-number-badge')).map(b => b.textContent);
      return { livesText, heldBadges };
    });
    console.log('✅ Sau khi đổi lỗi lấy số:', afterTrade);
    if (afterTrade.heldBadges.length !== 2) throw new Error('Số lượng số đang giữ chưa tăng lên 2 sau khi đổi lỗi!');
    if (!afterTrade.livesText.includes('1/3')) throw new Error('Số lỗi chưa tăng lên 1/3 sau khi đổi mạng!');

    // 6. Thử nghiệm Radar gợi ý mù
    console.log('👉 Thử nghiệm bấm nút "Radar gợi ý mù"...');
    await page.click('#btn-arena-radar');
    await new Promise(r => setTimeout(r, 600));

    const radarTest = await page.evaluate(() => {
      const radarBtnText = document.getElementById('btn-arena-radar')?.textContent;
      const pulsedCell = document.querySelector('.sudoku-cell.arena-radar-pulse');
      return {
        radarBtnText,
        hasPulsedCell: !!pulsedCell,
        pulseRow: pulsedCell?.dataset?.row,
        pulseCol: pulsedCell?.dataset?.col
      };
    });
    console.log('✅ Kết quả Radar:', radarTest);
    if (!radarTest.hasPulsedCell) throw new Error('Không có ô nào phát sáng viền radar!');
    if (!radarTest.radarBtnText.includes('1')) throw new Error('Lượt dùng radar chưa giảm xuống 1!');

    // Chụp ảnh bàn cờ đang trong trận đấu kèm Radar & Numpad khóa
    const matchPicPath = path.join(ARTIFACT_DIR, 'arena_live_match.png');
    await page.screenshot({ path: matchPicPath });
    console.log(`📸 Đã chụp ảnh ván đấu live kèm Radar: ${matchPicPath}`);

    // 7. Thử nghiệm chặn nhập số bị khóa
    const testBlockedInput = await page.evaluate(() => {
      const lockedBtn = document.querySelector('.numpad-btn.arena-key-locked');
      const val = lockedBtn ? parseInt(lockedBtn.dataset.val, 10) : 0;
      if (lockedBtn) lockedBtn.click();
      const toast = document.getElementById('arena-toast');
      return {
        lockedVal: val,
        toastVisible: toast && toast.classList.contains('show'),
        toastText: toast?.textContent
      };
    });
    console.log('✅ Kiểm tra chặn số bị khóa:', testBlockedInput);
    if (!testBlockedInput.toastVisible) throw new Error('Không hiện cảnh báo khi bấm số bị khóa!');

    // 8. Thử nghiệm Hoàn nguyên bàn cờ và Modal Showdown
    console.log('👉 Thử nghiệm Bỏ cuộc / Kết thúc ván để kiểm tra hoàn nguyên hệ quy chiếu...');
    await page.evaluate(() => {
      // Gọi trực tiếp handleGameOver để kiểm tra modal tổng kết và hoàn nguyên
      if (window.app && window.app.arenaManager) {
        window.app.arenaManager.handleGameOver('mistakes');
      }
    });
    await new Promise(r => setTimeout(r, 1200));

    const summaryState = await page.evaluate(() => {
      const modal = document.getElementById('arena-summary-modal');
      const isVisible = modal && modal.classList.contains('active');
      const title = document.getElementById('arena-summary-title')?.textContent;
      const seed = document.getElementById('arena-summary-seed')?.textContent;
      const winRate = document.getElementById('arena-summary-winrate')?.textContent;
      const progress = document.getElementById('arena-summary-progress')?.textContent;

      return {
        isVisible,
        title,
        seed,
        winRate,
        progress
      };
    });
    console.log('✅ Modal Tổng kết Showdown:', summaryState);
    if (!summaryState.isVisible) throw new Error('Modal tổng kết không hiển thị sau khi kết thúc!');
    if (!summaryState.seed.includes('1367')) throw new Error('Mã đề trong modal tổng kết không khớp!');

    const summaryPicPath = path.join(ARTIFACT_DIR, 'arena_summary_modal.png');
    await page.screenshot({ path: summaryPicPath });
    console.log(`📸 Đã chụp ảnh Modal tổng kết: ${summaryPicPath}`);

    console.log('\n========================================================');
    console.log('🎉 TẤT CẢ CÁC TÍNH NĂNG ĐẤU TRƯỜNG EXTREME ĐỀU ĐẠT 100%!');
    console.log('========================================================\n');

  } finally {
    await browser.close();
  }
}

testExtremeArena().catch(err => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
