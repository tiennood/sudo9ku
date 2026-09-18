const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');

const PORT = 3000;
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

const OFFLINE_SUDOKU_TEMPLATES = {
  extreme: [
    { id: 777, mission: "300049000000600501752001000001000700500396000008150096003010060004000100000028000", solution: "316549827489672531752831649691284753547396218238157496873415962924763185165928374", win_rate: 28.99 },
    { id: 935, mission: "050000000090001008004059000000000591420000080700000040000800100603200000000040003", solution: "157482639296371458834659217368724591425193786719568342942837165683215974571946823", win_rate: 33.75 }
  ],
  evil: [
    { id: 293, mission: "009586000000020000400000683900650032060700098030200704003000000620015040000400050", solution: "319586427786324915452179683974658132261743598835291764543962871627815349198437256", win_rate: 49.50 }
  ],
  expert: [
    { id: 638, mission: "150082000300070010000000753000527609000000500040063807400008000703040100008600300", solution: "157382496396475218284916753831527649672894531549163827415738962763249185928651374", win_rate: 37.95 }
  ],
  hard: [
    { id: 79, mission: "100034008070680030008210704054090680910508020080300005305906871006000040001070200", solution: "162734598479685132538219764254197683913568427687342915345926871726851349891473256", win_rate: 40.25 }
  ],
  medium: [
    { id: 358, mission: "203400005809160704006030019702003060008250000001607002007005926930720000600090470", solution: "213479685859162734476538219742913568368254197591687342187345926934726851625891473", win_rate: 48.91 }
  ],
  easy: [
    { id: 433, mission: "900508007080302905054000080070680032100004008500219060000906001726001040001470056", solution: "913568427687342915254197683479685132162734598538219764345926871726851349891473256", win_rate: 63.26 }
  ]
};

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

function fetchSudokuFromWeb(level) {
  const validLevel = ['easy', 'medium', 'hard', 'expert', 'evil', 'extreme'].includes(level) ? level : 'extreme';
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

  // API tự động lấy bài trực tiếp từ Sudoku.com
  if (reqPath === '/api/fetch-sudoku') {
    const level = (parsedUrl.query.level || 'extreme').toLowerCase();
    try {
      const result = await fetchSudokuFromWeb(level);
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
