const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');

const PORT = process.env.PORT || 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.apk': 'application/vnd.android.package-archive',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

let SUDOKU_PUZZLE_BANK = null;
try {
  SUDOKU_PUZZLE_BANK = require('./js/sudoku_puzzles.js');
} catch (e) {}

const OFFLINE_SUDOKU_TEMPLATES = (SUDOKU_PUZZLE_BANK && SUDOKU_PUZZLE_BANK.extreme) ? SUDOKU_PUZZLE_BANK : {
  extreme: [
    { id: 777, mission: "300049000000600501752001000001000700500396000008150096003010060004000100000028000", solution: "316549827489672531752831649691284753547396218238157496873415962924763185165928374", win_rate: 28.99 }
  ]
};

const NIGHTMARE_PUZZLES = [
  {
    id: "inkala-2012",
    name: "Everest (Khó nhất thế giới 2012)",
    author: "Arto Inkala",
    clues: 21,
    win_rate: 2.10,
    mission: "800000000003600000070090200050007000000045700000100030001000068008500010090000400",
    solution: "812753649943682175675491283154237896369845721287169534521974368438526917796318452",
    description: "Tuyệt tác 'Everest' của TS. Arto Inkala (2012). Đạt mức độ khó 11 sao với nhánh suy luận 8 tầng!"
  },
  {
    id: "inkala-2006",
    name: "AI Escargot (Huyền thoại Ốc sên)",
    author: "Arto Inkala",
    clues: 24,
    win_rate: 3.25,
    mission: "100007090030020008009600500005300900010080002600004000300000010041000007007000300",
    solution: "162857493534129678789643521475312986913586742628794135356478219241935867897261354",
    description: "Đề AI Escargot nổi tiếng năm 2006 từng làm chấn động giới Sudoku thế giới vì độ hiểm hóc vô tiền khoáng hậu."
  },
  {
    id: "royle-17-01",
    name: "Đề 17 ô Gordon Royle #1",
    author: "Gordon Royle",
    clues: 17,
    win_rate: 4.85,
    mission: "000000010400000000020000000000050407008000300001090000300400200050100000000806000",
    solution: "693784512487512936125963874932651487568247391741398625319475268856129743274836159",
    description: "Giới hạn tối thiểu toán học 17 ô. Đã chứng minh không thể tồn tại Sudoku 1 nghiệm nào với 16 ô."
  },
  {
    id: "royle-17-02",
    name: "Đề 17 ô Gordon Royle #2",
    author: "Gordon Royle",
    clues: 17,
    win_rate: 4.12,
    mission: "000000010400000000020000000000050604008000300001090000300400200050100000000807000",
    solution: "793684512486512937125973846932751684578246391641398725319465278857129463264837159",
    description: "Đề bài 17 ô tối giản với ma trận ứng viên phân bố rộng, loại bỏ hầu hết kỹ thuật đơn giản."
  },
  {
    id: "royle-17-03",
    name: "Đề 17 ô Gordon Royle #3",
    author: "Gordon Royle",
    clues: 17,
    win_rate: 4.50,
    mission: "000000012000035000000600070700000300000400800100000000000120000080000040050000600",
    solution: "673894512912735486845612973798261354526473891134589267469128735287356149351947628",
    description: "Cấu trúc 17 ô với các khối trung tâm trống rỗng, thử thách khả năng liên kết chuỗi."
  },
  {
    id: "royle-17-04",
    name: "Đề 17 ô Gordon Royle #4",
    author: "Gordon Royle",
    clues: 17,
    win_rate: 3.90,
    mission: "000000012003600000000007000410020000000500300700000600280000040000300500000000000",
    solution: "679835412123694758548217936416723895892561374735489621287956143961342587354178269",
    description: "Chỉ 17 số ban đầu, tỉ lệ thắng người chơi thực tế đo được chỉ đạt 3.90%!"
  },
  {
    id: "royle-17-05",
    name: "Đề 17 ô Gordon Royle #5",
    author: "Gordon Royle",
    clues: 17,
    win_rate: 4.20,
    mission: "000000012008030000000000040120500000000004700060000000507000300000620000000100000",
    solution: "346795812258431697971862543129576438835214769764389251517948326493627185682153974",
    description: "Đề 17 ô kinh điển với chuỗi suy luận phức hợp xích Forcing Chain."
  },
  {
    id: "royle-17-06",
    name: "Đề 17 ô Gordon Royle #6",
    author: "Gordon Royle",
    clues: 17,
    win_rate: 4.35,
    mission: "000000012040050000000009000070600400000100000000000050000087500601000300200000000",
    solution: "598463712742851639316729845175632498869145273423978156934287561681594327257316984",
    description: "Cấu trúc 17 ô đối xứng bán phần đặc biệt, tạo ra độ mông lung cực lớn khi giải."
  }
];

function stringToMatrix(str) {
  if (!str || str.length < 81) return null;
  const matrix = [];
  for (let r = 0; r < 9; r++) {
    const row = [];
    for (let c = 0; c < 9; c++) {
      const char = str[r * 9 + c];
      row.push(char >= '1' && char <= '9' ? parseInt(char, 10) : 0);
    }
    matrix.push(row);
  }
  return matrix;
}

function fetchSudokuFromWeb(level, huntLow = false) {
  // Nếu yêu cầu chế độ ÁC MỘNG (Nightmare) -> Lấy từ kho đề 17 ô & đề khó nhất hành tinh (< 5%)
  if (level === 'nightmare') {
    const pick = NIGHTMARE_PUZZLES[Math.floor(Math.random() * NIGHTMARE_PUZZLES.length)];
    return Promise.resolve({
      success: true,
      id: pick.id,
      level: 'nightmare',
      winRate: pick.win_rate,
      name: pick.name,
      author: pick.author,
      clues: pick.clues,
      description: pick.description,
      grid: stringToMatrix(pick.mission),
      solution: stringToMatrix(pick.solution),
      mission: pick.mission,
      solutionStr: pick.solution,
      source: 'nightmare_vault'
    });
  }

  const validLevel = ['easy', 'medium', 'hard', 'expert', 'evil', 'extreme'].includes(level) ? level : 'extreme';

  function fetchSingle() {
    return new Promise((resolve) => {
      const req = https.get(`https://sudoku.com/api/v2/level/${validLevel}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': `https://sudoku.com/vi/${validLevel}/`,
          'x-easy-locale': 'vi',
          'X-Requested-With': 'XMLHttpRequest',
          'Cache-Control': 'no-cache'
        },
        timeout: 8000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json && json.mission && json.mission.length >= 81) {
              resolve({
                success: true,
                id: json.id,
                level: validLevel,
                winRate: json.win_rate || 0,
                grid: stringToMatrix(json.mission),
                solution: stringToMatrix(json.solution),
                mission: json.mission,
                solutionStr: json.solution,
                source: 'sudoku.com'
              });
              return;
            }
          } catch (e) {
            console.warn('Lỗi phân tích JSON từ Sudoku.com:', e.message);
          }
          fallbackToOffline();
        });
      });

      req.on('error', (err) => {
        console.warn('Lỗi kết nối Sudoku.com:', err.message);
        fallbackToOffline();
      });

      req.on('timeout', () => {
        req.destroy();
        fallbackToOffline();
      });

      function fallbackToOffline() {
        const templates = OFFLINE_SUDOKU_TEMPLATES[validLevel] || OFFLINE_SUDOKU_TEMPLATES.extreme;
        const pick = templates[Math.floor(Math.random() * templates.length)];
        resolve({
          success: true,
          id: pick.id,
          level: validLevel,
          winRate: pick.win_rate,
          grid: stringToMatrix(pick.mission),
          solution: stringToMatrix(pick.solution),
          mission: pick.mission,
          solutionStr: pick.solution,
          source: 'offline_preset'
        });
      }
    });
  }

  // Nếu muốn săn đề cực hiếm (win rate thấp nhất có thể) trên Sudoku.com
  if (huntLow) {
    return (async () => {
      let best = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const res = await fetchSingle();
        if (res.success && res.source === 'sudoku.com') {
          if (!best || res.winRate < best.winRate) {
            best = res;
          }
          if (res.winRate < 26) break; // Đã đạt mức cực thấp dưới 26%
        }
      }
      return best || fetchSingle();
    })();
  }

  return fetchSingle();
}

const PUZZLE_SEED_CACHE = new Map();

// Helper to generate deterministic Extreme puzzle from integer seed
function getDeterministicExtremePuzzle(seedNum) {
  let s = (Math.abs(parseInt(seedNum, 10)) || 1367) % 2147483647;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  const base = OFFLINE_SUDOKU_TEMPLATES.extreme[0];
  const baseGrid = stringToMatrix(base.mission);
  const baseSol = stringToMatrix(base.solution);

  // 1. Digit permutation mapping
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  const digitMap = [0, ...digits];

  // 2. Row permutations within 3x3 blocks
  const rowPerm = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let b = 0; b < 3; b++) {
    const blockRows = [0, 1, 2];
    for (let i = 2; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [blockRows[i], blockRows[j]] = [blockRows[j], blockRows[i]];
    }
    rowPerm[b * 3 + 0] = b * 3 + blockRows[0];
    rowPerm[b * 3 + 1] = b * 3 + blockRows[1];
    rowPerm[b * 3 + 2] = b * 3 + blockRows[2];
  }

  // 3. Col permutations within 3x3 blocks
  const colPerm = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let b = 0; b < 3; b++) {
    const blockCols = [0, 1, 2];
    for (let i = 2; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [blockCols[i], blockCols[j]] = [blockCols[j], blockCols[i]];
    }
    colPerm[b * 3 + 0] = b * 3 + blockCols[0];
    colPerm[b * 3 + 1] = b * 3 + blockCols[1];
    colPerm[b * 3 + 2] = b * 3 + blockCols[2];
  }

  const newGrid = Array.from({ length: 9 }, () => Array(9).fill(0));
  const newSol = Array.from({ length: 9 }, () => Array(9).fill(0));
  let missionStr = '';
  let solStr = '';

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const origR = rowPerm[r];
      const origC = colPerm[c];
      const gVal = baseGrid[origR][origC];
      const sVal = baseSol[origR][origC];
      newGrid[r][c] = gVal === 0 ? 0 : digitMap[gVal];
      newSol[r][c] = sVal === 0 ? 0 : digitMap[sVal];
      missionStr += newGrid[r][c];
      solStr += newSol[r][c];
    }
  }

  const winRate = Number((20 + (rnd() * 40)).toFixed(2));

  return {
    success: true,
    id: String(seedNum),
    level: 'extreme',
    winRate,
    grid: newGrid,
    solution: newSol,
    mission: missionStr,
    solutionStr: solStr,
    source: 'seed_generator'
  };
}

let CURRENT_LATEST_GAME = null;

async function syncSudokuToBrowser(level, mainGame) {
  const targetUrl = `https://sudoku.com/vi/${level}/`;
  let browser = null;
  console.log(`[syncSudokuToBrowser] Starting sync for puzzle #${mainGame?.id} (${level}), moves: ${(mainGame?.values || []).filter(v => v.val > 0 && v.editable).length}`);

  // 1. Thử kết nối tới trình duyệt đang mở (Port 9222 CDP)
  try {
    const puppeteer = require('puppeteer-core');
    browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    console.log('[syncSudokuToBrowser] Connected to browser CDP on port 9222');
  } catch (e) {
    console.log('[syncSudokuToBrowser] Could not connect to port 9222:', e.message);
  }

  // 2. Nếu chưa có trình duyệt CDP mở, thử khởi chạy Edge hoặc Chrome
  if (!browser) {
    const edgePaths = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    const chromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe')
    ];
    const candidatePaths = [...edgePaths, ...chromePaths];
    const browserExe = candidatePaths.find(p => fs.existsSync(p));

    if (browserExe) {
      const { spawn } = require('child_process');
      const proc = spawn(browserExe, [
        '--remote-debugging-port=9222',
        '--start-maximized',
        targetUrl
      ], {
        detached: true,
        stdio: 'ignore'
      });
      proc.unref();

      const puppeteer = require('puppeteer-core');
      for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 500));
        try {
          browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
          if (browser) break;
        } catch (err) {}
      }
    }
  }

  // 3. Nạp dữ liệu câu đố và cờ đang giải vào Sudoku.com
  if (browser) {
    try {
      const pages = await browser.pages();
      // Đảm bảo không áp đặt viewport cố định (xóa hiện tượng viền trắng dưới đáy cửa sổ)
      for (const p of pages) {
        try {
          const client = await p.target().createCDPSession();
          await client.send('Emulation.clearDeviceMetricsOverride');
          await p.setViewport(null).catch(() => {});
        } catch (e) {}
      }
      let page = pages.find(p => {
        try {
          const u = new URL(p.url());
          return u.hostname === 'sudoku.com' || u.hostname === 'www.sudoku.com';
        } catch (e) {
          return false;
        }
      });
      console.log(`[syncSudokuToBrowser] Existing sudoku page found: ${page ? page.url() : 'None'}`);
      if (!page) {
        page = await browser.newPage();
        console.log(`[syncSudokuToBrowser] Created new page, navigating to ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      }

      console.log(`[syncSudokuToBrowser] Injecting main_game into localStorage for #${mainGame.id}...`);
      await page.evaluate((data) => {
        // Ngăn trình duyệt ghi đè ván đấu cũ từ bộ nhớ JS khi tab unload / reload
        window.onbeforeunload = null;
        window.onpagehide = null;
        window.onunload = null;

        localStorage.setItem('main_game', JSON.stringify(data.mainGame));
        localStorage.setItem('difficulty', JSON.stringify(data.level));
        localStorage.setItem('mode', JSON.stringify('classic'));
        localStorage.setItem('hideGameTip', 'true');
        localStorage.setItem('hideLoadGameDialog', 'true');
        sessionStorage.removeItem('dc-win-date');

        // Khóa không cho bất kỳ script ngầm nào ghi đè main_game trước khi tab tải lại xong
        const origSet = Storage.prototype.setItem;
        Storage.prototype.setItem = function(k, v) {
          if (k === 'main_game') return;
          return origSet.apply(this, arguments);
        };
      }, { mainGame, level });

      // Nếu đang ở đúng URL thì reload, nếu chưa thì chuyển trang tới đúng cấp độ
      if (page.url().includes(`/${level}/`)) {
        console.log(`[syncSudokuToBrowser] Reloading existing page ${page.url()}...`);
        await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
      } else {
        console.log(`[syncSudokuToBrowser] Navigating to ${targetUrl}...`);
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      }
      await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
      console.log(`[syncSudokuToBrowser] Done reloading, bringing page to front`);
      await page.bringToFront().catch(() => {});
      browser.disconnect();
      return { success: true, method: 'browser_active', url: targetUrl };
    } catch (err) {
      if (browser) {
        try { browser.disconnect(); } catch (e) {}
      }
      console.warn('Lỗi khi nạp vào trình duyệt qua CDP:', err.message);
    }
  }

  return { success: true, method: 'fallback_url', url: targetUrl };
}

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let reqPath = parsedUrl.pathname;

  // API lấy địa chỉ IP mạng nội bộ cho điện thoại kết nối
  if (reqPath === '/api/network-info') {
    const localIp = getLocalIp();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ ip: localIp, port: PORT, url: `http://${localIp}:${PORT}/` }));
    return;
  }

  // API tự động lấy bài trực tiếp từ Sudoku.com hoặc Kho Đề Ác Mộng
  if (reqPath === '/api/fetch-sudoku') {
    const level = (parsedUrl.query.level || 'extreme').toLowerCase();
    const huntLow = parsedUrl.query.hunt_low === 'true';
    try {
      const result = await fetchSudokuFromWeb(level, huntLow);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API Đồng bộ mã đề phòng đấu (Extreme Arena Seed Sync)
  if (reqPath === '/api/puzzle-seed') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          if (payload && payload.id) {
            PUZZLE_SEED_CACHE.set(String(payload.id), payload);
          }
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    const seedId = parsedUrl.query.id || '1367';
    if (PUZZLE_SEED_CACHE.has(String(seedId))) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(PUZZLE_SEED_CACHE.get(String(seedId))));
      return;
    }

    const generated = getDeterministicExtremePuzzle(seedId);
    PUZZLE_SEED_CACHE.set(String(seedId), generated);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(generated));
    return;
  }

  // API mở Sudoku.com kèm dữ liệu bàn cờ và số bài của chính nó
  if (reqPath === '/api/open-sudoku' && req.method === 'POST') {
    console.log('[API] /api/open-sudoku called!');
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const level = payload.level || 'extreme';
        const mainGame = payload.mainGame;
        console.log(`[API] Received open-sudoku request for #${mainGame?.id} (${level}) with ${mainGame?.values?.filter(v => v.val > 0 && v.editable).length || 0} moves`);
        CURRENT_LATEST_GAME = { level, mainGame, updatedAt: Date.now() };

        const syncResult = await syncSudokuToBrowser(level, mainGame);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          success: true,
          id: mainGame.id,
          level,
          winRate: mainGame.winRate,
          movesCount: (mainGame.values || []).filter(v => v.val > 0 && v.editable).length,
          ...syncResult
        }));
      } catch (err) {
        console.error('Lỗi khi mở Sudoku.com:', err);
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API lấy ván đấu hiện tại cho Bookmarklet / Userscript
  if (reqPath === '/api/current-game') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify(CURRENT_LATEST_GAME || {}));
    return;
  }

  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.join(__dirname, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`Sudoku Server running:`);
  console.log(`- Local:   http://localhost:${PORT}/`);
  console.log(`- Network: http://${localIp}:${PORT}/ (Mở trên điện thoại)`);
});
