const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  console.log('--- STARTING UNIFIED SETTINGS MODAL E2E TEST ---');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new'
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  await page.goto('http://localhost:3000/?v=' + Date.now(), { waitUntil: 'networkidle0' });

  // 1. Verify Toolbar contains the unified button
  console.log('1. Checking Toolbar buttons...');
  const toolbarButtons = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.board-tools button'));
    return btns.filter(b => b.offsetWidth > 0 && b.offsetHeight > 0).map(b => ({
      id: b.id,
      text: b.textContent.trim().replace(/\s+/g, ' ')
    }));
  });
  console.log('Visible toolbar buttons:', toolbarButtons);

  const hasUnifiedBtn = toolbarButtons.some(b => b.id === 'btn-open-unified-settings');
  if (!hasUnifiedBtn) throw new Error('Missing unified settings button on toolbar!');

  await page.screenshot({ path: path.join(__dirname, 'screenshot_unified_toolbar.png') });
  console.log('Saved screenshot_unified_toolbar.png');

  // 2. Click Unified Settings Button to open modal
  console.log('2. Clicking "⚙️ Tùy chỉnh" (#btn-open-unified-settings)...');
  await page.click('#btn-open-unified-settings');
  await new Promise(r => setTimeout(r, 400));

  const modalActive = await page.evaluate(() => {
    const modal = document.getElementById('unified-settings-modal');
    return modal && modal.classList.contains('active');
  });
  if (!modalActive) throw new Error('Unified settings modal failed to open!');
  console.log('Modal opened successfully!');

  // 3. Test Tab 1: Tia gióng (Crosshatch)
  console.log('3. Testing Tab 1: Tia gióng...');
  await page.screenshot({ path: path.join(__dirname, 'screenshot_tab_crosshatch.png') });
  console.log('Saved screenshot_tab_crosshatch.png');

  // Select '2' mode in crosshatch
  await page.evaluate(() => {
    const radio2 = document.querySelector('input[name="crosshatch-mode-type"][value="2"]');
    if (radio2) radio2.checked = true;
  });

  // 4. Test Tab 2: Bút chì (Pencil)
  console.log('4. Switching to Tab 2: Bút chì...');
  await page.click('button.settings-tab-btn[data-tab="pencil"]');
  await new Promise(r => setTimeout(r, 300));

  const pencilTabActive = await page.evaluate(() => {
    const pane = document.getElementById('tab-pane-pencil');
    return pane && pane.classList.contains('active');
  });
  if (!pencilTabActive) throw new Error('Failed to switch to Pencil tab!');
  await page.screenshot({ path: path.join(__dirname, 'screenshot_tab_pencil.png') });
  console.log('Saved screenshot_tab_pencil.png');

  // 5. Test Tab 3: Số lượt lỗi (Mistakes)
  console.log('5. Switching to Tab 3: Số lượt lỗi...');
  await page.click('button.settings-tab-btn[data-tab="mistakes"]');
  await new Promise(r => setTimeout(r, 300));

  const mistakesTabActive = await page.evaluate(() => {
    const pane = document.getElementById('tab-pane-mistakes');
    return pane && pane.classList.contains('active');
  });
  if (!mistakesTabActive) throw new Error('Failed to switch to Mistakes tab!');
  await page.screenshot({ path: path.join(__dirname, 'screenshot_tab_mistakes.png') });
  console.log('Saved screenshot_tab_mistakes.png');

  // Select '5' mistakes
  await page.evaluate(() => {
    const r5 = document.querySelector('input[name="mistake-limit"][value="5"]');
    if (r5) r5.checked = true;
  });

  // 6. Click Unified Save button
  console.log('6. Clicking "✓ Lưu & Áp dụng" (#btn-save-unified-settings)...');
  await page.click('#btn-save-unified-settings');
  await new Promise(r => setTimeout(r, 400));

  const finalCheck = await page.evaluate(() => {
    const app = window.app;
    const modal = document.getElementById('unified-settings-modal');
    return {
      modalStillActive: modal.classList.contains('active'),
      crosshatchMode: app.crosshatchMode,
      maxMistakes: app.maxMistakes,
      crosshatchBtnLabel: app.dom.crosshatchBtnLabel.textContent,
      mistakeBadgeText: app.dom.mistakesBadge.textContent.trim()
    };
  });
  console.log('State after unified save:', finalCheck);

  if (finalCheck.modalStillActive) throw new Error('Modal did not close after save!');
  if (finalCheck.crosshatchMode !== '2') throw new Error('Crosshatch setting was not saved!');
  if (finalCheck.maxMistakes !== '5') throw new Error('Mistakes setting was not saved!');

  // Reset back to defaults (all, 3)
  await page.evaluate(() => {
    window.app.crosshatchMode = 'all';
    window.app.maxMistakes = '3';
    localStorage.setItem('sudoku_crosshatch_mode', 'all');
    localStorage.setItem('sudoku_max_mistakes', '3');
    window.app.updateCrosshatchBtnLabel();
    window.app.updateMistakeBadge();
  });

  console.log('🎉 UNIFIED SETTINGS MODAL E2E TEST PASSED 100%!');
  await browser.close();
})();
