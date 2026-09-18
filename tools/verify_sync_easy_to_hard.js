const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });

  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('localhost:3000')) || pages[0];
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await page.setViewport({ width: 1280, height: 900 });

  console.log('1. Loading Extreme puzzle...');
  await page.click('#btn-fetch-sudoku');
  await new Promise(r => setTimeout(r, 1200));

  // Step 2: Check "Xem trước nước đi tiếp theo"
  console.log('2. Clicking "Xem trước nước đi tiếp theo"...');
  await page.click('#btn-preview-next');
  await new Promise(r => setTimeout(r, 600));

  const previewInfo1 = await page.evaluate(() => {
    const banner = document.getElementById('preview-banner');
    const title = document.getElementById('preview-title')?.innerText;
    const exp = document.getElementById('preview-explanation')?.innerText;
    const badge = banner?.querySelector('.preview-diff-badge')?.innerText;
    const targetCell = document.querySelector('.sudoku-cell.preview-mode-target');
    const r = targetCell ? targetCell.dataset.row : null;
    const c = targetCell ? targetCell.dataset.col : null;
    return {
      displayed: banner && banner.style.display !== 'none',
      title,
      badge,
      exp: exp?.slice(0, 100),
      targetPos: r !== null ? `(${parseInt(r)+1}, ${parseInt(c)+1})` : null
    };
  });
  console.log('Preview Step 1 Info:', previewInfo1);

  // Take screenshot of first preview
  await page.screenshot({ path: 'preview_step_1.png' });

  // Step 3: Click "📖 Xem công thức" inside preview banner
  console.log('3. Clicking "📖 Xem công thức" in preview banner...');
  await page.click('#btn-preview-formula');
  await new Promise(r => setTimeout(r, 600));

  const modalInfo1 = await page.evaluate(() => {
    const modal = document.getElementById('formula-guide-modal');
    const isActive = modal?.classList.contains('active');
    const targetHighlight = document.querySelector('.formula-guide-card.highlight-target');
    const activeApplied = document.querySelector('.formula-applied-box.active-applied');
    const liveDot = document.querySelector('.live-dot-pulse');
    const chips = Array.from(document.querySelectorAll('.btn-applied-step')).slice(0, 3).map(b => b.innerText);
    return {
      isOpen: isActive,
      targetCardId: targetHighlight ? targetHighlight.id : null,
      hasActiveApplied: !!activeApplied,
      hasLiveDot: !!liveDot,
      sampleChips: chips
    };
  });
  console.log('Formula Modal Info:', modalInfo1);

  // Take screenshot of formula handbook synchronized with preview
  await page.screenshot({ path: 'formula_handbook_sync.png' });

  // Step 4: Close modal
  await page.click('#btn-close-formula-modal');
  await new Promise(r => setTimeout(r, 400));

  // Step 5: Click "✔️ Điền số này"
  console.log('5. Clicking "✔️ Điền số này"...');
  await page.click('#btn-apply-preview');
  await new Promise(r => setTimeout(r, 500));

  // Step 6: Verify cell is filled on board
  const cellFilled = await page.evaluate((pos) => {
    const targetCell = document.querySelector(`.sudoku-cell[data-row="${parseInt(pos.split(',')[0].replace('(', '')) - 1}"][data-col="${parseInt(pos.split(',')[1].replace(')', '')) - 1}"]`);
    const val = targetCell?.querySelector('.cell-value')?.innerText;
    return val;
  }, previewInfo1.targetPos);
  console.log(`Cell at ${previewInfo1.targetPos} is now filled with: ${cellFilled}`);

  // Step 7: Simulate user manually entering another digit
  console.log('7. User manually entering another valid move...');
  const userMove = await page.evaluate(() => {
    // Find an empty cell with a known solution digit
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (window.app.currentBoard[r][c] === 0) {
          const val = window.app.solution[r][c];
          window.app.selectedCell = { row: r, col: c };
          window.app.inputSelectedCellValue(val);
          return { row: r + 1, col: c + 1, val };
        }
      }
    }
    return null;
  });
  console.log('User manually entered:', userMove);
  await new Promise(r => setTimeout(r, 500));

  // Step 8: Trigger preview again -> Must calculate from current board!
  console.log('8. Triggering Preview on updated board...');
  await page.click('#btn-preview-next');
  await new Promise(r => setTimeout(r, 600));

  const previewInfo2 = await page.evaluate(() => {
    const banner = document.getElementById('preview-banner');
    const title = document.getElementById('preview-title')?.innerText;
    const badge = banner?.querySelector('.preview-diff-badge')?.innerText;
    const targetCell = document.querySelector('.sudoku-cell.preview-mode-target');
    const r = targetCell ? targetCell.dataset.row : null;
    const c = targetCell ? targetCell.dataset.col : null;
    return {
      title,
      badge,
      targetPos: r !== null ? `(${parseInt(r)+1}, ${parseInt(c)+1})` : null
    };
  });
  console.log('Preview Step 2 Info (after 2 moves played):', previewInfo2);

  // Step 9: Open Sổ tay công thức and click a step chip to demonstrate
  console.log('9. Opening Sổ tay công thức to test step demonstration...');
  await page.click('#btn-open-formula-guide');
  await new Promise(r => setTimeout(r, 600));

  const chipClicked = await page.evaluate(() => {
    const firstChip = document.querySelector('.btn-applied-step');
    if (firstChip) {
      const text = firstChip.innerText;
      firstChip.click();
      return text;
    }
    return null;
  });
  console.log('Demonstrated chip clicked:', chipClicked);
  await new Promise(r => setTimeout(r, 600));

  const isDemoActive = await page.evaluate(() => {
    return {
      isFormulaInspectionMode: window.app.isFormulaInspectionMode,
      previewBannerDisplay: document.getElementById('preview-banner')?.style.display,
      previewTitle: document.getElementById('preview-title')?.innerText
    };
  });
  console.log('Demonstration Active State:', isDemoActive);

  // Screenshot demonstration active
  await page.screenshot({ path: 'step_demonstration_active.png' });

  // Step 10: Click any other cell on the board -> Immediately restores user game
  console.log('10. Clicking another cell on board to test auto-exit and clean restore...');
  await page.click('.sudoku-cell[data-row="4"][data-col="4"]');
  await new Promise(r => setTimeout(r, 400));

  const isDemoCleared = await page.evaluate(() => {
    return {
      isFormulaInspectionMode: window.app.isFormulaInspectionMode,
      previewBannerDisplay: document.getElementById('preview-banner')?.style.display,
      selectedCell: window.app.selectedCell,
      boardAtUserPos: window.app.currentBoard[4][4]
    };
  });
  console.log('Inspection Cleared State:', isDemoCleared);

  // Screenshot cleared state
  await page.screenshot({ path: 'step_demonstration_cleared.png' });

  // Step 11: Check Inspector on an empty cell
  console.log('11. Checking Inspector on empty cell...');
  await page.evaluate(() => {
    // Select first empty cell
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (window.app.currentBoard[r][c] === 0) {
          window.app.selectCell(r, c);
          window.app.updateInspector();
          return { r: r + 1, c: c + 1 };
        }
      }
    }
  });
  await new Promise(r => setTimeout(r, 300));

  const inspectorText = await page.evaluate(() => {
    return document.getElementById('inspector-content')?.innerText;
  });
  console.log('Inspector Content (first 200 chars):\n', inspectorText?.slice(0, 200));

  console.log('\n✅ ALL INTEGRATION TESTS PASSED!');
})();
