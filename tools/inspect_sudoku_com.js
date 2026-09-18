const https = require('https');

https.get('https://sudoku.com/build/ref-game.1b9d2435.js', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    // Find where e (the game object passed to D) is constructed!
    console.log(d.slice(461000, 462100));
  });
});
