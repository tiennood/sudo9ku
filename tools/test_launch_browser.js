const puppeteer = require('puppeteer-core');

async function openSudokuCom(gameData) {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();

  const level = gameData.level || 'extreme';
  const targetUrl = `https://sudoku.com/vi/${level}/`;

  console.log('Navigating to', targetUrl);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.log('Injecting game state into localStorage...');
  await page.evaluate((data) => {
    localStorage.setItem('main_game', JSON.stringify(data.mainGame));
    localStorage.setItem('difficulty', JSON.stringify(data.level));
    localStorage.setItem('mode', JSON.stringify('classic'));
    localStorage.setItem('hideGameTip', 'true');
    localStorage.setItem('hideLoadGameDialog', 'true');
  }, { mainGame: gameData.mainGame, level });

  console.log('Reloading to display game...');
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  console.log('Done!');
}

// Test with dummy data
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

openSudokuCom({ level: 'extreme', mainGame });
