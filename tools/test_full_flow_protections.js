const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Tein\\.gemini\\antigravity-ide\\brain\\ca1cc67e-dd3d-4373-b74a-67ec53d73077';

async function testFullFlowProtections() {
  console.log('⚡ Bắt đầu kiểm thử toàn diện Flow bật/tắt tính năng theo chế độ...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });

    // 1. Kiểm tra trạng thái bình thường ban đầu
    const normalState = await page.evaluate(() => {
      const btnPreview = document.getElementById('btn-preview-next');
      const btnSettings = document.getElementById('btn-open-unified-settings');
      const btnClear = document.getElementById('btn-clear-board');
      const toggleSol = document.getElementById('toggle-solution');
      const btnFillAll = document.getElementById('btn-fill-all-solution');

      return {
        btnPreviewDisabled: btnPreview?.disabled,
        btnSettingsLocked: btnSettings?.classList.contains('btn-locked-arena'),
        btnClearDisabled: btnClear?.disabled,
        toggleSolDisabled: toggleSol?.disabled,
        btnFillAllDisabled: btnFillAll?.disabled
      };
    });
    console.log('✅ 1. Trạng thái bình thường:', normalState);
    if (normalState.btnPreviewDisabled || normalState.btnSettingsLocked || normalState.btnClearDisabled) {
      throw new Error('Các nút ở chế độ bình thường không được phép bị khóa!');
    }

    // 2. Mở Đấu Trường Extreme và bắt đầu trận đấu
    await page.click('#btn-open-extreme-arena');
    await new Promise(r => setTimeout(r, 400));
    await page.click('#btn-start-arena-match');
    await new Promise(r => setTimeout(r, 1000));

    // 3. Kiểm tra KHÓA CỨNG các tính năng trong Đấu Trường Extreme
    const arenaLockedState = await page.evaluate(() => {
      const btnPreview = document.getElementById('btn-preview-next');
      const btnSettings = document.getElementById('btn-open-unified-settings');
      const btnClear = document.getElementById('btn-clear-board');
      const toggleSol = document.getElementById('toggle-solution');
      const btnFillAll = document.getElementById('btn-fill-all-solution');

      return {
        btnPreviewDisabled: btnPreview?.disabled,
        btnPreviewLocked: btnPreview?.classList.contains('btn-locked-arena'),
        btnSettingsLocked: btnSettings?.classList.contains('btn-locked-arena'),
        btnClearDisabled: btnClear?.disabled,
        btnClearLocked: btnClear?.classList.contains('btn-locked-arena'),
        toggleSolDisabled: toggleSol?.disabled,
        toggleSolChecked: toggleSol?.checked,
        btnFillAllDisabled: btnFillAll?.disabled,
        pencilType: window.app.pencilType,
        crosshatchMode: window.app.crosshatchMode
      };
    });
    console.log('✅ 2. Kiểm tra KHÓA TÍNH NĂNG trong Đấu Trường Extreme:', arenaLockedState);
    if (!arenaLockedState.btnPreviewDisabled || !arenaLockedState.btnPreviewLocked) {
      throw new Error('Nút Xem trước nước tiếp chưa bị khóa trong Đấu trường!');
    }
    if (!arenaLockedState.btnSettingsLocked) {
      throw new Error('Nút Tùy chỉnh chưa bị khóa trong Đấu trường!');
    }
    if (!arenaLockedState.btnClearDisabled || !arenaLockedState.btnClearLocked) {
      throw new Error('Nút Xóa cờ chưa bị khóa trong Đấu trường!');
    }
    if (!arenaLockedState.toggleSolDisabled || arenaLockedState.toggleSolChecked) {
      throw new Error('Xem trước đáp án chưa bị khóa vô hiệu hóa trong Đấu trường!');
    }
    if (!arenaLockedState.btnFillAllDisabled) {
      throw new Error('Nút Điền tất cả đáp án chưa bị khóa trong Đấu trường!');
    }
    if (arenaLockedState.pencilType !== 'manual') {
      throw new Error('Bút chì chưa được ép về thủ công (manual) trong Đấu trường!');
    }
    if (arenaLockedState.crosshatchMode !== '1') {
      throw new Error('Tia gióng chưa được cố định về 1 trong Đấu trường!');
    }

    // 4. Thử kích hoạt các hành động gian lận và kiểm tra chặn
    const cheatAttempt = await page.evaluate(() => {
      // Bấm nút Xem trước nước tiếp
      window.app.previewNextStep(1);
      const isPreviewOpened = window.app.isPreviewMode;

      // Bấm Xóa cờ
      window.app.clearBoard();
      const isBoardStillIntact = window.app.currentBoard.some(row => row.some(cell => cell > 0));

      return {
        isPreviewOpened,
        isBoardStillIntact
      };
    });
    console.log('✅ 3. Thử gian lận (Xem trước & Xóa cờ) bị chặn thành công:', cheatAttempt);
    if (cheatAttempt.isPreviewOpened) {
      throw new Error('Preview mode vẫn mở được trong Đấu trường!');
    }
    if (!cheatAttempt.isBoardStillIntact) {
      throw new Error('Bàn cờ bị xóa sạch trong Đấu trường!');
    }

    // 5. Kiểm tra Inspector không có nút Điền số và ẩn đáp án cuối cùng
    const inspectorCheck = await page.evaluate(() => {
      // Tìm 1 ô trống
      let emptyR = -1, emptyC = -1;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (window.app.currentBoard[r][c] === 0) {
            emptyR = r; emptyC = c; break;
          }
        }
        if (emptyR !== -1) break;
      }
      window.app.selectCell(emptyR, emptyC);
      const btnFillThisCell = document.getElementById('btn-fill-this-cell');
      const inspectorText = document.getElementById('inspector-content')?.textContent || '';

      return {
        btnFillThisCellExists: !!btnFillThisCell,
        hasHiddenAnswerNotice: inspectorText.includes('Đã ẩn')
      };
    });
    console.log('✅ 4. Kiểm tra Thanh Phân Tích (Inspector) bảo mật:', inspectorCheck);
    if (inspectorCheck.btnFillThisCellExists) {
      throw new Error('Vẫn tồn tại nút [Điền số vào ô này] trong Inspector Đấu trường!');
    }
    if (!inspectorCheck.hasHiddenAnswerNotice) {
      throw new Error('Inspector chưa ẩn đáp án cuối cùng trong Đấu trường!');
    }

    // 6. Thoát Đấu trường và kiểm tra HOÀN NGUYÊN tính năng (Unlocking & Restoring)
    await page.evaluate(() => {
      window.app.arenaManager.quitArena();
    });
    await new Promise(r => setTimeout(r, 600));

    const restoredState = await page.evaluate(() => {
      const btnPreview = document.getElementById('btn-preview-next');
      const btnSettings = document.getElementById('btn-open-unified-settings');
      const btnClear = document.getElementById('btn-clear-board');
      const toggleSol = document.getElementById('toggle-solution');
      const btnFillAll = document.getElementById('btn-fill-all-solution');

      return {
        isActive: window.app.arenaManager.isActive,
        btnPreviewDisabled: btnPreview?.disabled,
        btnPreviewLocked: btnPreview?.classList.contains('btn-locked-arena'),
        btnSettingsLocked: btnSettings?.classList.contains('btn-locked-arena'),
        btnClearDisabled: btnClear?.disabled,
        btnClearLocked: btnClear?.classList.contains('btn-locked-arena'),
        toggleSolDisabled: toggleSol?.disabled,
        btnFillAllDisabled: btnFillAll?.disabled
      };
    });
    console.log('✅ 5. Kiểm tra HOÀN NGUYÊN tính năng sau khi thoát Đấu trường:', restoredState);
    if (restoredState.isActive) throw new Error('Đấu trường vẫn còn active sau khi quit!');
    if (restoredState.btnPreviewDisabled || restoredState.btnPreviewLocked) {
      throw new Error('Nút Xem trước nước tiếp chưa được mở lại sau khi thoát Đấu trường!');
    }
    if (restoredState.btnSettingsLocked) {
      throw new Error('Nút Tùy chỉnh chưa được mở lại sau khi thoát Đấu trường!');
    }
    if (restoredState.btnClearDisabled || restoredState.btnClearLocked) {
      throw new Error('Nút Xóa cờ chưa được mở lại sau khi thoát Đấu trường!');
    }
    if (restoredState.toggleSolDisabled) {
      throw new Error('Xem trước đáp án chưa được mở lại sau khi thoát Đấu trường!');
    }

    // 7. Chụp ảnh minh chứng
    const screenshotPath = path.join(ARTIFACT_DIR, 'flow_protections_verified.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`📸 Đã lưu ảnh minh chứng: ${screenshotPath}`);

    console.log('\n========================================================');
    console.log('🎉 TẤT CẢ CÁC FLOW BẬT/TẮT TÍNH NĂNG ĐÃ HOÀN THIỆN 100%!');
    console.log('========================================================\n');

  } finally {
    await browser.close();
  }
}

testFullFlowProtections().catch(err => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
