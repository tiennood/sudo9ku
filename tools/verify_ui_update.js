const http = require('http');
const WebSocket = require('ws');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const pages = JSON.parse(data);
    const target = pages.find(p => p.url.includes('localhost:3000') && !p.url.includes('sw.js'));
    if (!target) {
      console.log('No active page found');
      process.exit(1);
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Page.reload',
        params: {}
      }));
    });
    ws.on('message', (msg) => {
      const r = JSON.parse(msg);
      if (r.id === 1) {
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 2,
            method: 'Runtime.evaluate',
            params: {
              expression: `(() => {
                const mText = document.getElementById("mistake-counter-text")?.textContent;
                const historyBtn = document.getElementById("btn-open-history");
                const historyVisible = historyBtn && window.getComputedStyle(historyBtn).display !== "none";
                const gearIcon = document.querySelector(".mistake-gear-icon");
                const gearVisible = gearIcon && window.getComputedStyle(gearIcon).display !== "none";
                const badge = document.getElementById("mistakes-badge");
                const badgeCursor = badge ? window.getComputedStyle(badge).cursor : null;
                const toolbarTop = document.querySelector(".board-toolbar-top");
                const toolbarWrap = toolbarTop ? window.getComputedStyle(toolbarTop).flexWrap : null;
                return JSON.stringify({ mText, historyVisible, gearVisible, badgeCursor, toolbarWrap });
              })()`
            }
          }));
        }, 1500);
      }
      if (r.id === 2) {
        console.log('UI Verification Result:', r.result.result.value);
        process.exit(0);
      }
    });
  });
});
