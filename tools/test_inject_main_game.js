const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({ executablePath: edge, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  console.log('Navigating to sudoku.com...');
  await page.goto('https://sudoku.com/vi/extreme/', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Let's create a test main_game object
  // Let's use a known puzzle:
  const mission = "300049000000600501752001000001000700500396000008150096003010060004000100000028000";
  const solution = "316549827489672531752831649691284753547396218238157496873415962924763185165928374";

  // Let's enter some numbers on the board:
  // cell 1 (index 1 in 0-indexed): let's put '1' (which is the correct solution number)
  // cell 2 (index 2): let's put '6'
  const missionArr = mission.split('').map(x => parseInt(x, 10));
  const solutionArr = solution.split('').map(x => parseInt(x, 10));
  const values = [];
  for (let i = 0; i < 81; i++) {
    const orig = missionArr[i];
    if (orig > 0) {
      values.push({ val: orig, editable: false });
    } else if (i === 1) {
      values.push({ val: 1, editable: true }); // user entered 1
    } else if (i === 2) {
      values.push({ val: 6, editable: true }); // user entered 6
    } else {
      values.push({ val: 0, editable: true });
    }
  }

  const mainGame = {
    id: 339,
    mode: "classic",
    difficulty: "extreme",
    loaded: true,
    mission: mission,
    solution: solutionArr,
    values: values,
    winRate: 30.51,
    showWinRate: true,
    timer: 25000,
    notes: Array.from({ length: 81 }, () => []),
    cages: null,
    score: 150,
    scoreHistory: [],
    baseScore: { val: 1000, lastGameTimer: 0 },
    countSmartHints: 0,
    placement: "game_start",
    emojisShown: [],
    bestMove: null,
    mistakes: 0,
    hints: 3,
    finished: false
  };

  console.log('Injecting main_game into localStorage...');
  await page.evaluate((game) => {
    localStorage.setItem('main_game', JSON.stringify(game));
    localStorage.setItem('difficulty', '"extreme"');
    localStorage.setItem('mode', '"classic"');
    localStorage.setItem('hideGameTip', 'true');
    localStorage.setItem('hideLoadGameDialog', 'true');
  }, mainGame);

  console.log('Reloading page...');
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));

  const pageInfo = await page.evaluate(() => {
    const title = document.title;
    const saved = localStorage.getItem('main_game');
    let parsed = null;
    try { parsed = JSON.parse(saved); } catch (e) {}
    const allKeys = Object.keys(localStorage);
    return {
      title,
      allKeys,
      savedSample: saved ? saved.substring(0, 300) : null,
      savedParsed: parsed,
      hasCanvas: !!document.querySelector('canvas')
    };
  });

  console.log('Page info after reload:', JSON.stringify(pageInfo, null, 2));

  await page.screenshot({ path: 'scratch/sudoku_com_injected.png' });
  console.log('Screenshot saved to scratch/sudoku_com_injected.png');

  await browser.close();
})();
