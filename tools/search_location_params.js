const https = require('https');

https.get('https://sudoku.com/build/ref-game.1b9d2435.js', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    // Find where D( is called
    const regex = /D\([a-zA-Z0-9_.]+,[a-zA-Z0-9_.]+\)/g;
    let m;
    while ((m = regex.exec(d)) !== null) {
      console.log('Call to D at', m.index, ':', d.slice(Math.max(0, m.index - 50), m.index + 150));
    }
  });
});
