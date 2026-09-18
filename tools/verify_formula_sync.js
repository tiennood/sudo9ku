const http = require('http');
const WebSocket = require('ws');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const pages = JSON.parse(data);
    const target = pages.find(p => p.url.includes('localhost:3000') && !p.url.includes('sw.js'));
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          awaitPromise: true,
          expression: `(async () => {
            const app = window.app;
            if (!app) return 'No app';
            if (!app.solution) {
              document.getElementById('sample-preset-card')?.click();
              await new Promise(r => setTimeout(r, 1200));
            }
            if (!app.solution) return 'Still no solution';

            // Find an empty cell to fill
            let rToFill = -1, cToFill = -1, vToFill = 0;
            for (let r = 0; r < 9; r++) {
              for (let c = 0; c < 9; c++) {
                if (app.initialBoard[r][c] === 0 && app.currentBoard[r][c] === 0) {
                  rToFill = r;
                  cToFill = c;
                  vToFill = app.solution[r][c];
                  break;
                }
              }
              if (rToFill !== -1) break;
            }

            // Fill 1 correct move
            app.selectCell(rToFill, cToFill);
            app.inputSelectedCellValue(vToFill);

            const userMovesCount = app.userMovesHistory ? app.userMovesHistory.length : 0;
            const sliderVal = parseInt(app.dom.stepSlider.value, 10);
            const sliderMax = parseInt(app.dom.stepSlider.max, 10);
            const counterText = app.dom.stepCounter.textContent;

            // Open formula modal
            app.openFormulaModal();

            // Inspect chips in modal
            const playedChips = Array.from(document.querySelectorAll('.btn-applied-step.played')).map(b => b.textContent.trim());
            const upcomingChips = Array.from(document.querySelectorAll('.btn-applied-step.upcoming')).map(b => b.textContent.trim());

            // Click the first upcoming chip
            const firstUpcoming = document.querySelector('.btn-applied-step.upcoming');
            let clickedStepIdx = null;
            if (firstUpcoming) {
              clickedStepIdx = parseInt(firstUpcoming.dataset.stepIndex, 10);
              firstUpcoming.click();
            }

            const afterClickSliderVal = parseInt(app.dom.stepSlider.value, 10);
            const afterClickCounter = app.dom.stepCounter.textContent;
            const syncBtnVisible = app.dom.btnSyncCurrentBoard && window.getComputedStyle(app.dom.btnSyncCurrentBoard).display !== 'none';

            // Click sync back to user current step
            if (app.dom.btnSyncCurrentBoard) {
              app.dom.btnSyncCurrentBoard.click();
            }
            const restoredSliderVal = parseInt(app.dom.stepSlider.value, 10);

            return JSON.stringify({
              userMovesCount,
              sliderVal,
              sliderMax,
              counterText,
              playedChips: playedChips.slice(0, 3),
              upcomingChips: upcomingChips.slice(0, 3),
              clickedStepIdx,
              afterClickSliderVal,
              afterClickCounter,
              syncBtnVisible,
              restoredSliderVal
            });
          })()`
        }
      }));
    });
    ws.on('message', (msg) => {
      const r = JSON.parse(msg);
      if (r.id === 1) {
        console.log('Formula & Timeline Sync Result:', r.result.result.value);
        process.exit(0);
      }
    });
  });
});
