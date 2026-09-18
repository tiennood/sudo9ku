const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
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
  await page.setViewport({ width: 1280, height: 950 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  await page.waitForSelector('#sudoku-grid .sudoku-cell');
  await new Promise(r => setTimeout(r, 1200));

  console.log('--- TEST 1: Check initial pencil UI ---');
  const initialPencil = await page.evaluate(() => {
    const app = window.app;
    return {
      isPencilMode: app.isPencilMode,
      pencilType: app.pencilType,
      btnToolbarText: document.getElementById('pencil-btn-label').textContent,
      btnNumpadText: document.getElementById('numpad-pencil-text').textContent
    };
  });
  console.log('Initial Pencil State:', initialPencil);
  if (initialPencil.isPencilMode !== false) throw new Error('isPencilMode should start false');

  console.log('--- TEST 2: Toggle Pencil mode via "P" key ---');
  await page.keyboard.press('p');
  await new Promise(r => setTimeout(r, 300));
  const toggledPencil = await page.evaluate(() => {
    const app = window.app;
    const toolbarBtn = document.getElementById('btn-pencil-toggle');
    const numpadBtn = document.getElementById('btn-numpad-pencil');
    return {
      isPencilMode: app.isPencilMode,
      toolbarHasActive: toolbarBtn.classList.contains('btn-pencil-active'),
      numpadHasActive: numpadBtn.classList.contains('btn-pencil-active'),
      toolbarText: document.getElementById('pencil-btn-label').textContent,
      numpadText: document.getElementById('numpad-pencil-text').textContent
    };
  });
  console.log('After "P" key press:', toggledPencil);
  if (!toggledPencil.isPencilMode) throw new Error('Pencil mode did not activate!');
  if (!toggledPencil.toolbarHasActive || !toggledPencil.numpadHasActive) {
    throw new Error('Buttons missing active class!');
  }

  console.log('--- TEST 3: Add manual notes to an empty cell ---');
  // Find an empty cell
  const targetPos = await page.evaluate(() => {
    const app = window.app;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (app.initialBoard[r][c] === 0 && app.currentBoard[r][c] === 0) {
          app.selectCell(r, c);
          return { row: r, col: c };
        }
      }
    }
    return null;
  });
  console.log('Selected empty cell at:', targetPos);

  // Press 2, 5, 8
  await page.keyboard.press('2');
  await new Promise(r => setTimeout(r, 100));
  await page.keyboard.press('5');
  await new Promise(r => setTimeout(r, 100));
  await page.keyboard.press('8');
  await new Promise(r => setTimeout(r, 200));

  const notesState = await page.evaluate((pos) => {
    const app = window.app;
    const cellEl = app.cellElements[pos.row][pos.col];
    const activeSpans = Array.from(cellEl.querySelectorAll('.candidate-num.active')).map(s => s.textContent);
    return {
      notes: app.manualCandidates[pos.row][pos.col],
      activeSpans,
      mistakesCount: app.mistakesCount,
      boardVal: app.currentBoard[pos.row][pos.col]
    };
  }, targetPos);
  console.log('Notes added:', notesState);
  if (notesState.boardVal !== 0) throw new Error('Board cell should remain 0 in pencil mode!');
  if (notesState.mistakesCount !== 0) throw new Error('Pencil marks must not cause mistakes!');
  if (JSON.stringify(notesState.notes) !== JSON.stringify([2, 5, 8])) {
    throw new Error(`Expected notes [2, 5, 8], got ${JSON.stringify(notesState.notes)}`);
  }

  console.log('--- TEST 4: Toggle off note 5 ---');
  await page.keyboard.press('5');
  await new Promise(r => setTimeout(r, 200));
  const afterToggle5 = await page.evaluate((pos) => {
    const app = window.app;
    return app.manualCandidates[pos.row][pos.col];
  }, targetPos);
  console.log('Notes after toggling 5 off:', afterToggle5);
  if (JSON.stringify(afterToggle5) !== JSON.stringify([2, 8])) {
    throw new Error('Note 5 was not removed!');
  }

  console.log('--- TEST 5: Erase notes in cell ---');
  await page.click('.numpad-btn[data-val="0"]');
  await new Promise(r => setTimeout(r, 200));
  const afterErase = await page.evaluate((pos) => {
    const app = window.app;
    return app.manualCandidates[pos.row][pos.col];
  }, targetPos);
  console.log('Notes after erase:', afterErase);
  if (afterErase.length !== 0) throw new Error('Notes were not cleared by Erase!');

  console.log('--- TEST 6: Pencil Settings Modal & Auto-Fill ---');
  await page.click('#btn-open-pencil-settings');
  await new Promise(r => setTimeout(r, 400));
  const modalOpen = await page.evaluate(() => {
    const modal = document.getElementById('pencil-settings-modal');
    return modal && modal.classList.contains('active');
  });
  if (!modalOpen) throw new Error('Pencil settings modal did not open!');

  await page.screenshot({ path: 'tools/screenshot_pencil_modal.png' });
  console.log('Saved screenshot of pencil settings modal');

  // Click Auto-fill all notes
  await page.click('#btn-auto-fill-notes');
  await new Promise(r => setTimeout(r, 300));
  const filledNotesCheck = await page.evaluate(() => {
    const app = window.app;
    let totalEmptyWithNotes = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (app.currentBoard[r][c] === 0 && app.manualCandidates[r][c].length > 0) {
          totalEmptyWithNotes++;
        }
      }
    }
    return totalEmptyWithNotes;
  });
  console.log('Total empty cells with auto-filled notes:', filledNotesCheck);
  if (filledNotesCheck === 0) throw new Error('Auto fill notes did not populate any cells!');

  // Close modal
  await page.click('#btn-close-pencil-modal');
  await new Promise(r => setTimeout(r, 300));

  await page.screenshot({ path: 'tools/screenshot_board_autofill_notes.png' });
  console.log('Saved screenshot of board with auto-filled notes');

  // Test Auto-erase note when digit placed
  console.log('--- TEST 7: Auto-remove notes on digit placement ---');
  const peerTest = await page.evaluate(() => {
    const app = window.app;
    // Turn off pencil mode
    app.togglePencilMode(false);
    // Find an empty cell with known solution
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (app.initialBoard[r][c] === 0 && app.solution) {
          const val = app.solution[r][c];
          // Find a peer in the same row
          for (let pc = 0; pc < 9; pc++) {
            if (pc !== c && app.currentBoard[r][pc] === 0) {
              // Ensure peer has note = val
              if (!app.manualCandidates[r][pc].includes(val)) {
                app.manualCandidates[r][pc].push(val);
              }
              app.selectCell(r, c);
              app.inputSelectedCellValue(val);
              const peerStillHasVal = app.manualCandidates[r][pc].includes(val);
              return { row: r, col: c, peerCol: pc, val, peerStillHasVal };
            }
          }
        }
      }
    }
    return null;
  });
  console.log('Peer note removal test:', peerTest);
  if (peerTest && peerTest.peerStillHasVal) {
    throw new Error('Peer note was not automatically removed upon correct placement!');
  }

  console.log('--- TEST 8: Clear All Notes ---');
  await page.click('#btn-open-pencil-settings');
  await new Promise(r => setTimeout(r, 300));
  await page.click('#btn-clear-all-notes');
  await new Promise(r => setTimeout(r, 300));
  const remainingNotes = await page.evaluate(() => {
    const app = window.app;
    let count = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (app.manualCandidates[r][c].length > 0) count++;
      }
    }
    return count;
  });
  console.log('Remaining notes after Clear All:', remainingNotes);
  if (remainingNotes !== 0) throw new Error('Notes remained after clearAllNotes!');

  await page.click('#btn-close-pencil-modal');
  await new Promise(r => setTimeout(r, 300));

  console.log('🎉 ALL PENCIL E2E TESTS PASSED SUCCESSFULLY!');
  await browser.close();
})();
