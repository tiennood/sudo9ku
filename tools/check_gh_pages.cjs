async function check() {
  const resp = await fetch('https://tiennood.github.io/sudo9ku/');
  const html = await resp.text();
  console.log('HTML length:', html.length);
  console.log('Has btn-open-custom-puzzle in HTML?', html.includes('btn-open-custom-puzzle'));
  const m = html.match(/<script type="module" src="([^"]+)">/);
  console.log('Script tag:', m ? m[1] : 'NONE');

  const jsResp = await fetch('https://tiennood.github.io/sudo9ku/js/app.js?v=12');
  console.log('js/app.js?v=12 status:', jsResp.status);
  const jsText = await jsResp.text();
  console.log('jsText length:', jsText.length);
  console.log('Has openCustomPuzzleModal in live js?', jsText.includes('openCustomPuzzleModal'));
}
check().catch(console.error);
