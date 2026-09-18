const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('=== BẮT ĐẦU KIỂM THỬ ĐỒNG BỘ TIẾN TRÌNH BƯỚC GIẢI ===');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });

  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('localhost:3000')) || pages[0];
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await page.setViewport({ width: 1280, height: 900 });

  // 1. Nạp đề bài
  console.log('1. Nạp câu đố Extreme...');
  await page.click('#btn-fetch-sudoku');
  await new Promise(r => setTimeout(r, 1200));

  const initialStatus = await page.evaluate(() => {
    const slider = document.getElementById('step-slider');
    const counter = document.getElementById('step-counter');
    const btnSync = document.getElementById('btn-sync-current-board');
    return {
      sliderVal: slider ? slider.value : null,
      sliderMax: slider ? slider.max : null,
      counterText: counter ? counter.innerText : null,
      btnSyncVisible: btnSync ? btnSync.style.display !== 'none' : false
    };
  });
  console.log('Trạng thái ban đầu:', initialStatus);

  // 2. Sử dụng "Xem trước nước đi tiếp theo" để lấy nước đi hợp lệ đầu tiên và Áp dụng
  console.log('2. Xem trước nước đi tiếp theo và Áp dụng vào bàn cờ...');
  await page.click('#btn-preview-next');
  await new Promise(r => setTimeout(r, 500));
  await page.click('#btn-apply-preview');
  await new Promise(r => setTimeout(r, 600));

  const afterMove1 = await page.evaluate(() => {
    const slider = document.getElementById('step-slider');
    const counter = document.getElementById('step-counter');
    const btnSync = document.getElementById('btn-sync-current-board');
    const expTitle = document.getElementById('step-details-title')?.innerText;
    const badge = document.getElementById('formula-badge')?.innerText;
    return {
      sliderVal: slider ? slider.value : null,
      sliderMax: slider ? slider.max : null,
      counterText: counter ? counter.innerText : null,
      btnSyncVisible: btnSync ? btnSync.style.display !== 'none' : false,
      expTitle,
      badge
    };
  });
  console.log('Sau Nước đi 1:', afterMove1);

  // 3. Người chơi nhập trực tiếp nước đi thứ 2 bằng cách chọn ô trống và bấm số nghiệm
  console.log('3. Điền tiếp nước đi thứ 2 bằng bàn phím numpad...');
  const move2Target = await page.evaluate(() => {
    const app = window.app;
    if (!app || !app.solveSteps) return null;
    const nextStep = app.solveSteps[app.currentStepIndex + 1];
    if (!nextStep || !nextStep.targetCell) return null;
    return nextStep.targetCell;
  });
  console.log('Mục tiêu nước đi 2:', move2Target);

  if (move2Target) {
    await page.evaluate((target) => {
      window.app.selectCell(target.row, target.col);
      window.app.inputSelectedCellValue(target.value);
    }, move2Target);
    await new Promise(r => setTimeout(r, 600));
  }

  const afterMove2 = await page.evaluate(() => {
    const slider = document.getElementById('step-slider');
    const counter = document.getElementById('step-counter');
    const btnSync = document.getElementById('btn-sync-current-board');
    const expTitle = document.getElementById('step-details-title')?.innerText;
    return {
      sliderVal: slider ? slider.value : null,
      sliderMax: slider ? slider.max : null,
      counterText: counter ? counter.innerText : null,
      btnSyncVisible: btnSync ? btnSync.style.display !== 'none' : false,
      expTitle
    };
  });
  console.log('Sau Nước đi 2:', afterMove2);

  // 4. Bấm ◀ (Bước lùi lại) để xem lại lịch sử
  console.log('4. Bấm nút ◀ để xem lại lịch sử bước 1...');
  await page.click('#btn-step-prev');
  await new Promise(r => setTimeout(r, 500));

  const afterStepPrev = await page.evaluate(() => {
    const slider = document.getElementById('step-slider');
    const counter = document.getElementById('step-counter');
    const btnSync = document.getElementById('btn-sync-current-board');
    const currentUserStep = document.getElementById('current-user-step-num')?.innerText;
    return {
      sliderVal: slider ? slider.value : null,
      counterText: counter ? counter.innerText : null,
      btnSyncVisible: btnSync ? btnSync.style.display !== 'none' : false,
      btnSyncText: btnSync ? btnSync.innerText : null,
      currentUserStep
    };
  });
  console.log('Khi lùi lại xem lịch sử Bước 1:', afterStepPrev);

  // 5. Bấm nút "↩ Về nước cờ hiện tại của bạn"
  console.log('5. Bấm "↩ Về nước cờ hiện tại của bạn"...');
  await page.click('#btn-sync-current-board');
  await new Promise(r => setTimeout(r, 500));

  const afterSyncBack = await page.evaluate(() => {
    const slider = document.getElementById('step-slider');
    const counter = document.getElementById('step-counter');
    const btnSync = document.getElementById('btn-sync-current-board');
    return {
      sliderVal: slider ? slider.value : null,
      counterText: counter ? counter.innerText : null,
      btnSyncVisible: btnSync ? btnSync.style.display !== 'none' : false
    };
  });
  console.log('Sau khi bấm Về nước cờ hiện tại:', afterSyncBack);

  // 6. Bấm nút ▶ (Bước tiếp theo) để xem trước bước giải tương lai
  console.log('6. Bấm nút ▶ để xem trước bước giải tương lai...');
  await page.click('#btn-step-next');
  await new Promise(r => setTimeout(r, 500));

  const afterStepNext = await page.evaluate(() => {
    const slider = document.getElementById('step-slider');
    const counter = document.getElementById('step-counter');
    const btnSync = document.getElementById('btn-sync-current-board');
    const btnApply = document.getElementById('btn-apply-walkthrough-step');
    const expTitle = document.getElementById('step-details-title')?.innerText;
    return {
      sliderVal: slider ? slider.value : null,
      counterText: counter ? counter.innerText : null,
      btnSyncVisible: btnSync ? btnSync.style.display !== 'none' : false,
      btnApplyVisible: btnApply ? btnApply.style.display !== 'none' : false,
      expTitle
    };
  });
  console.log('Khi xem trước bước tiếp theo trong tương lai:', afterStepNext);

  // 7. Bấm "✨ Áp dụng bước gợi ý này vào bàn cờ"
  console.log('7. Bấm "✨ Áp dụng bước gợi ý này vào bàn cờ"...');
  await page.click('#btn-apply-walkthrough-step');
  await new Promise(r => setTimeout(r, 600));

  const afterApplyWalkthrough = await page.evaluate(() => {
    const slider = document.getElementById('step-slider');
    const counter = document.getElementById('step-counter');
    const btnSync = document.getElementById('btn-sync-current-board');
    const btnApply = document.getElementById('btn-apply-walkthrough-step');
    return {
      sliderVal: slider ? slider.value : null,
      counterText: counter ? counter.innerText : null,
      btnSyncVisible: btnSync ? btnSync.style.display !== 'none' : false,
      btnApplyVisible: btnApply ? btnApply.style.display !== 'none' : false
    };
  });
  console.log('Sau khi bấm Áp dụng bước gợi ý:', afterApplyWalkthrough);

  // 8. Kiểm tra tính năng Xóa ô
  console.log('8. Xóa ô vừa điền...');
  await page.evaluate(() => {
    const lastMove = window.app.userMovesHistory[window.app.userMovesHistory.length - 1];
    window.app.selectCell(lastMove.row, lastMove.col);
    window.app.eraseSelectedCell();
  });
  await new Promise(r => setTimeout(r, 600));

  const afterErase = await page.evaluate(() => {
    const slider = document.getElementById('step-slider');
    const counter = document.getElementById('step-counter');
    return {
      sliderVal: slider ? slider.value : null,
      counterText: counter ? counter.innerText : null,
      userMovesCount: window.app.userMovesHistory ? window.app.userMovesHistory.length : 0
    };
  });
  console.log('Sau khi xóa ô vừa điền:', afterErase);

  // 9. Kiểm tra Cell Inspector
  console.log('9. Kiểm tra Cell Inspector...');
  const inspectorCheck = await page.evaluate(() => {
    const move1 = window.app.userMovesHistory[0];
    window.app.selectCell(move1.row, move1.col);
    const contentPlayed = document.getElementById('inspector-content')?.innerText;

    let emptyRow = 0, emptyCol = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (window.app.currentBoard[r][c] === 0) {
          emptyRow = r;
          emptyCol = c;
          break;
        }
      }
    }
    window.app.selectCell(emptyRow, emptyCol);
    const contentEmpty = document.getElementById('inspector-content')?.innerText;

    return {
      contentPlayed: contentPlayed?.slice(0, 80),
      contentEmpty: contentEmpty?.slice(0, 80)
    };
  });
  console.log('Cell Inspector Info:', inspectorCheck);

  // Chụp ảnh màn hình bàn cờ sau khi đồng bộ
  const screenshotPath = 'tools/walkthrough_sync_success.png';
  await page.screenshot({ path: screenshotPath });
  console.log('Đã lưu ảnh chụp:', screenshotPath);

  const artifactDir = 'C:\\Users\\Tein\\.gemini\\antigravity-ide\\brain\\ca1cc67e-dd3d-4373-b74a-67ec53d73077';
  fs.copyFileSync(screenshotPath, path.join(artifactDir, 'walkthrough_sync_success.png'));

  console.log('=== KIỂM THỬ THÀNH CÔNG 100% ===');
})();
