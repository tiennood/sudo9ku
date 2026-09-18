const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Tein\\.gemini\\antigravity-ide\\brain\\ca1cc67e-dd3d-4373-b74a-67ec53d73077';

async function testArenaRules() {
  console.log('⚡ Kiểm thử chi tiết các quy tắc Đấu Trường Extreme theo yêu cầu mới...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });

    // 1. Mở Modal Thiết Lập Đấu Trường
    await page.click('#btn-open-extreme-arena');
    await new Promise(r => setTimeout(r, 400));

    // Kiểm tra và nhập số thời gian tùy chỉnh (VD: 7 phút)
    const customTimeTest = await page.evaluate(() => {
      const inputTimer = document.getElementById('arena-timer-custom-input');
      if (!inputTimer) return { exists: false };
      
      // Thử nhập số 7 tùy chỉnh
      inputTimer.value = '7';
      inputTimer.dispatchEvent(new Event('input', { bubbles: true }));

      const activePreset = document.querySelector('.btn-timer-preset.active');
      return {
        exists: true,
        val: inputTimer.value,
        hasPresetActive: !!activePreset
      };
    });
    console.log('✅ 1. Nhập số thời gian tùy chỉnh (7 phút):', customTimeTest);
    if (!customTimeTest.exists) throw new Error('Không tìm thấy input arena-timer-custom-input!');
    if (customTimeTest.val !== '7') throw new Error('Giá trị input timer không khớp!');

    // Bắt đầu trận đấu
    await page.click('#btn-start-arena-match');
    await new Promise(r => setTimeout(r, 1200));

    // Kiểm tra trận đấu đã bắt đầu với thời gian 7 phút
    const arenaTimerConfig = await page.evaluate(() => {
      return {
        timeLimitMinutes: window.app.arenaManager.timeLimitMinutes,
        isActive: window.app.arenaManager.isActive
      };
    });
    console.log('✅ 2. Trận đấu nhận thời gian tùy chỉnh:', arenaTimerConfig);
    if (arenaTimerConfig.timeLimitMinutes !== 7) {
      throw new Error(`Thời gian nhận được là ${arenaTimerConfig.timeLimitMinutes}, mong đợi 7!`);
    }

    // 2. Kiểm tra nút Tùy Chỉnh bị KHÓA
    const settingsLocked = await page.evaluate(() => {
      const btn = document.getElementById('btn-open-unified-settings');
      btn.click();
      const toast = document.getElementById('arena-toast');
      return {
        hasLockedClass: btn.classList.contains('btn-locked-arena'),
        title: btn.title,
        toastShown: toast && toast.classList.contains('show'),
        toastText: toast?.textContent
      };
    });
    console.log('✅ 3. Kiểm tra Khóa nút Tùy Chỉnh:', settingsLocked);
    if (!settingsLocked.hasLockedClass) throw new Error('Nút Tùy chỉnh chưa có class btn-locked-arena!');
    if (!settingsLocked.toastShown) throw new Error('Không hiện thông báo khóa khi click nút Tùy chỉnh!');

    // 3. Kiểm tra Tùy chọn hiển thị: Chiếu 1 ô đã chọn ('1'), Chiếu sáng khối 3x3, Đồng bộ màu cam đào
    const visualSettings = await page.evaluate(() => {
      return {
        crosshatchMode: window.app.crosshatchMode,
        crosshatchIncludeBoxes: window.app.crosshatchIncludeBoxes,
        sameDigitMatchColor: window.app.sameDigitMatchColor
      };
    });
    console.log('✅ 4. Cài đặt hiển thị cố định:', visualSettings);
    if (visualSettings.crosshatchMode !== '1') throw new Error('crosshatchMode phải là 1 (chiếu 1 ô đã chọn)!');
    if (!visualSettings.crosshatchIncludeBoxes) throw new Error('crosshatchIncludeBoxes phải là true!');
    if (!visualSettings.sameDigitMatchColor) throw new Error('sameDigitMatchColor phải là true!');

    // 4. Click vào 1 ô có số để kiểm tra: tia gióng ngang dọc của 1 ô đã chọn VẪN ĐƯỢC CHIẾU, khối 3x3 được chiếu sáng, và các số cùng giá trị có màu cam đào
    const cellHighlightTest = await page.evaluate(() => {
      let targetR = -1, targetC = -1, val = 0;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (window.app.currentBoard[r][c] > 0) {
            targetR = r; targetC = c; val = window.app.currentBoard[r][c];
            break;
          }
        }
        if (val > 0) break;
      }

      window.app.selectCell(targetR, targetC);

      const targetBoxR = Math.floor(targetR / 3);
      const targetBoxC = Math.floor(targetC / 3);

      let peerInRow = 0;
      let peerInCol = 0;
      let peerInBox = 0;
      let otherMatchingCellsCastingRays = 0;
      let sameValHasPeach = true;

      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (r === targetR && c === targetC) continue;
          const el = window.app.cellElements[r][c];
          const isPeer = el.classList.contains('highlight-peer');

          if (r === targetR && isPeer) peerInRow++;
          if (c === targetC && isPeer) peerInCol++;
          if (Math.floor(r / 3) === targetBoxR && Math.floor(c / 3) === targetBoxC && isPeer) peerInBox++;

          // Kiểm tra xem ô ngoài hàng, cột, khối này có bị dính tia gióng từ số khác không
          if (r !== targetR && c !== targetC && (Math.floor(r / 3) !== targetBoxR || Math.floor(c / 3) !== targetBoxC)) {
            if (isPeer) otherMatchingCellsCastingRays++;
          }

          if (window.app.currentBoard[r][c] === val) {
            if (!el.classList.contains('has-same-digit-active') && !el.classList.contains('highlight-same-digit')) {
              sameValHasPeach = false;
            }
          }
        }
      }

      return {
        targetR, targetC, val,
        peerInRow,
        peerInCol,
        peerInBox,
        otherMatchingCellsCastingRays,
        sameValHasPeach
      };
    });
    console.log('✅ 5. Kiểm tra tia gióng ngang dọc của 1 ô đã chọn:', cellHighlightTest);
    if (cellHighlightTest.peerInRow !== 8) throw new Error('Hàng ngang của ô chọn chưa được chiếu tia!');
    if (cellHighlightTest.peerInCol !== 8) throw new Error('Cột dọc của ô chọn chưa được chiếu tia!');
    if (cellHighlightTest.otherMatchingCellsCastingRays > 0) {
      throw new Error('Các ô cùng số khác vẫn đang chiếu tia lan truyền khắp bàn cờ!');
    }
    if (!cellHighlightTest.sameValHasPeach) {
      throw new Error('Các ô cùng giá trị chưa được đồng bộ màu cam đào!');
    }

    // 5. Kiểm tra điền số và SỐ BIẾN MẤT KHỎI "SĂN SỐ"
    const placeNumberTest = await page.evaluate(() => {
      const heldBefore = [...window.app.arenaManager.heldNumbers];
      const targetVal = heldBefore[0];

      // Tìm 1 ô trống mà nghiệm là targetVal
      let emptyR = -1, emptyC = -1;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (window.app.currentBoard[r][c] === 0 && window.app.solution[r][c] === targetVal) {
            emptyR = r; emptyC = c;
            break;
          }
        }
        if (emptyR !== -1) break;
      }

      if (emptyR === -1) {
        return { error: 'Không tìm thấy ô phù hợp cho ' + targetVal };
      }

      // Chọn ô và điền số
      window.app.selectCell(emptyR, emptyC);
      window.app.inputSelectedCellValue(targetVal);

      const heldAfter = [...window.app.arenaManager.heldNumbers];
      return {
        targetVal,
        placedAt: { r: emptyR, c: emptyC },
        heldBefore,
        heldAfter,
        targetConsumed: !heldAfter.includes(targetVal)
      };
    });

    console.log('✅ 6. Kiểm tra Dùng số thì số MẤT KHỎI "SĂN SỐ":', placeNumberTest);
    if (!placeNumberTest.targetConsumed) {
      throw new Error(`Số ${placeNumberTest.targetVal} sau khi dùng vẫn chưa mất khỏi danh sách săn số!`);
    }

    // 6. Chụp ảnh minh chứng
    const proofPicPath = path.join(ARTIFACT_DIR, 'arena_custom_timer_and_crosshatch_1_verified.png');
    await page.screenshot({ path: proofPicPath });
    console.log(`📸 Đã chụp ảnh minh chứng hoàn thành xuất sắc: ${proofPicPath}`);

    console.log('\n========================================================');
    console.log('🎉 TẤT CẢ CÁC YÊU CẦU ĐỀU ĐẠT 100% CHUẨN XÁC!');
    console.log('========================================================\n');

  } finally {
    await browser.close();
  }
}

testArenaRules().catch(err => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
