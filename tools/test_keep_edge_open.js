const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');

async function testKeepOpen() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  
  // Launch edge with remote-debugging-port so we can connect, inject, and disconnect!
  const port = 9222;
  const edgeProc = spawn(edgePath, [
    `--remote-debugging-port=${port}`,
    '--start-maximized',
    'https://sudoku.com/vi/extreme/'
  ], {
    detached: true,
    stdio: 'ignore'
  });
  edgeProc.unref();

  console.log('Spawned Edge with PID:', edgeProc.pid);

  // Wait a moment for Edge to initialize debugging port
  await new Promise(r => setTimeout(r, 2000));

  let browser;
  for (let i = 0; i < 10; i++) {
    try {
      browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
      break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  if (!browser) {
    console.error('Failed to connect to Edge via CDP');
    return;
  }

  console.log('Connected to Edge via CDP!');
  let page = (await browser.pages()).find(p => p.url().includes('sudoku.com'));
  if (!page) {
    page = await browser.newPage();
    await page.goto('https://sudoku.com/vi/extreme/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  } else {
    await page.bringToFront();
  }

  console.log('Target page URL:', page.url());

  const mission = "300049000000600501752001000001000700500396000008150096003010060004000100000028000";
  const solution = "316549827489672531752831649691284753547396218238157496873415962924763185165928374";
  const missionArr = mission.split('').map(x => parseInt(x, 10));
  const solutionArr = solution.split('').map(x => parseInt(x, 10));
  const values = [];
  for (let i = 0; i < 81; i++) {
    const orig = missionArr[i];
    if (orig > 0) {
      values.push({ val: orig, editable: false });
    } else if (i === 1) {
      values.push({ val: 1, editable: true });
    } else if (i === 2) {
      values.push({ val: 6, editable: true });
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
    timer: 0,
    notes: Array.from({ length: 81 }, () => []),
    cages: null,
    score: 100,
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

  await page.evaluate((game) => {
    localStorage.setItem('main_game', JSON.stringify(game));
    localStorage.setItem('difficulty', '"extreme"');
    localStorage.setItem('mode', '"classic"');
    localStorage.setItem('hideGameTip', 'true');
    localStorage.setItem('hideLoadGameDialog', 'true');
  }, mainGame);

  console.log('Injected game state! Reloading...');
  await page.reload({ waitUntil: 'networkidle2', timeout: 20000 });
  console.log('Reload complete!');

  // Now disconnect Puppeteer CDP, leaving Edge OPEN for user!
  browser.disconnect();
  console.log('Disconnected Puppeteer! Edge stays open!');
}

testKeepOpen();
