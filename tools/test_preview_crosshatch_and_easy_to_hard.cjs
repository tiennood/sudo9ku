const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  console.log('🚀 Starting E2E test for toolbar cleanup, easy-to-hard move preview, and crosshatch ray visualization...');
  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];
  let exe = [...edgePaths, ...chromePaths].find(p => fs.existsSync(p));
  const browser = await puppeteer.launch({ executablePath: exe, headless: 'new' });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // 1. Verify visible toolbar does not show old crosshatch and pencil buttons
  const visibleToolbarButtons = await page.$$eval('.board-tools > button:not([style*="display: none"]):not([style*="opacity: 0.001"])', btns =>
    btns.map(b => ({ id: b.id, text: b.innerText.trim() }))
  );
  console.log('Visible toolbar buttons:', visibleToolbarButtons);

  const hasVisibleCrosshatchToggle = visibleToolbarButtons.some(b => b.id === 'btn-crosshatch-toggle');
  const hasVisiblePencilToggle = visibleToolbarButtons.some(b => b.id === 'btn-pencil-toggle');

  if (hasVisibleCrosshatchToggle || hasVisiblePencilToggle) {
    throw new Error('❌ FAIL: btn-crosshatch-toggle or btn-pencil-toggle is still visible in the main toolbar!');
  }
  console.log('✅ PASS: Crosshatch and pencil buttons are cleanly removed from the visible outer toolbar.');

  // 2. Click "Xem trước nước tiếp"
  console.log('Clicking #btn-preview-next...');
  await page.click('#btn-preview-next');
  await new Promise(r => setTimeout(r, 600));

  // Check preview banner is displayed
  const bannerDisplay = await page.$eval('#preview-banner', el => window.getComputedStyle(el).display);
  if (bannerDisplay === 'none') {
    throw new Error('❌ FAIL: Preview banner is not visible after clicking #btn-preview-next!');
  }
  console.log('✅ PASS: Preview banner is displayed.');

  // Verify first step title, difficulty badge, and explanation
  const previewTitle = await page.$eval('#preview-title', el => el.innerText.trim());
  const diffBadge = await page.$eval('.preview-diff-badge', el => el.innerText.trim());
  const explanation = await page.$eval('#preview-explanation', el => el.innerText.trim());

  console.log('Preview Title:', previewTitle);
  console.log('Difficulty Badge:', diffBadge);
  console.log('Explanation:', explanation);

  if (!diffBadge.includes('Rất dễ') && !diffBadge.includes('Dễ')) {
    throw new Error(`❌ FAIL: Expected easiest step first (Rất dễ / Dễ), got: ${diffBadge}`);
  }
  console.log('✅ PASS: Step 1 is sorted as easiest (Rất dễ / Dễ)!');

  // 3. Check for crosshatch rays on the board during preview mode!
  const rayCellCount = await page.$$eval('.sudoku-cell.highlight-crosshatch-ray', cells => cells.length);
  const sameDigitCount = await page.$$eval('.sudoku-cell.highlight-same-digit', cells => cells.length);
  const targetCellCount = await page.$$eval('.sudoku-cell.preview-mode-target', cells => cells.length);
  const previewDigitCount = await page.$$eval('.preview-digit', cells => cells.length);

  console.log(`Crosshatch Ray Cells: ${rayCellCount}`);
  console.log(`Same Digit Cells: ${sameDigitCount}`);
  console.log(`Preview Target Cells: ${targetCellCount}`);
  console.log(`Preview Digit Elements: ${previewDigitCount}`);

  if (rayCellCount === 0) {
    throw new Error('❌ FAIL: No crosshatch rays (.highlight-crosshatch-ray) found during move preview!');
  }
  if (targetCellCount !== 1) {
    throw new Error(`❌ FAIL: Expected 1 preview target cell, found ${targetCellCount}`);
  }
  if (previewDigitCount !== 1) {
    throw new Error(`❌ FAIL: Expected 1 preview digit, found ${previewDigitCount}`);
  }
  console.log('✅ PASS: Crosshatch rays and preview target are beautifully cast and rendered during move preview!');

  // Take screenshot of move preview with crosshatch rays
  await page.screenshot({ path: 'preview_with_crosshatch_rays.png' });
  console.log('📸 Saved preview_with_crosshatch_rays.png');

  // 4. Test "Xem tiếp bước nữa" (cycle to next moves in difficulty order)
  console.log('Clicking #btn-next-preview to view next move...');
  await page.click('#btn-next-preview');
  await new Promise(r => setTimeout(r, 400));

  const previewTitle2 = await page.$eval('#preview-title', el => el.innerText.trim());
  const diffBadge2 = await page.$eval('.preview-diff-badge', el => el.innerText.trim());
  console.log('Step 2 Title:', previewTitle2);
  console.log('Step 2 Difficulty Badge:', diffBadge2);

  if (!previewTitle2.includes('(2/')) {
    throw new Error(`❌ FAIL: Expected (2/N) in preview title, got: ${previewTitle2}`);
  }
  console.log('✅ PASS: Cycled to step 2/N in difficulty order!');

  // 5. Test "Điền số này"
  console.log('Clicking #btn-apply-preview to apply the move...');
  await page.click('#btn-apply-preview');
  await new Promise(r => setTimeout(r, 600));

  const bannerDisplayAfterApply = await page.$eval('#preview-banner', el => window.getComputedStyle(el).display);
  if (bannerDisplayAfterApply !== 'none') {
    throw new Error('❌ FAIL: Preview banner should be hidden after applying the move!');
  }

  const userOrSolvedDigits = await page.$$eval('.sudoku-cell.user-digit, .sudoku-cell.solved-digit', cells => cells.length);
  console.log(`Board has ${userOrSolvedDigits} filled user/solved digits.`);
  if (userOrSolvedDigits === 0) {
    throw new Error('❌ FAIL: No digit placed on board after clicking Điền số này!');
  }
  console.log('✅ PASS: Move was successfully placed onto the board!');

  // Take screenshot after applying
  await page.screenshot({ path: 'after_apply_preview_move.png' });
  console.log('📸 Saved after_apply_preview_move.png');

  await browser.close();
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
})();
