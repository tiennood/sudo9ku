const puppeteer = require('puppeteer-core');

async function debugClick() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({ executablePath: edgePath, headless: true });
  const page = await browser.newPage();
  
  // Set viewport to typical laptop/desktop
  await page.setViewport({ width: 1366, height: 768 });
  
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  for (const url of ['http://localhost:3000', 'https://tiennood.github.io/sudo9ku/']) {
    console.log('\n--- TESTING URL:', url);
    await page.goto(url, { waitUntil: 'networkidle0' });
  
  // Check if button is in DOM
  const btn = await page.$('#btn-open-custom-puzzle');
  console.log('Button exists in DOM?', !!btn);
  
  if (btn) {
    const box = await btn.boundingBox();
    console.log('Button bounding box:', box);
    
    // Check elementFromPoint to see if another element is on top of it!
    const topEl = await page.evaluate((x, y) => {
      const el = document.elementFromPoint(x, y);
      return el ? { tag: el.tagName, id: el.id, className: el.className } : null;
    }, box.x + box.width / 2, box.y + box.height / 2);
    console.log('Element at button center point:', topEl);
    
    // Click button
    await btn.click();
    
    // Check if modal has class 'active'
    const modalState = await page.evaluate(() => {
      const m = document.getElementById('custom-puzzle-modal');
      return {
        exists: !!m,
        classes: m ? m.className : null,
        display: m ? window.getComputedStyle(m).display : null,
        opacity: m ? window.getComputedStyle(m).opacity : null,
        visibility: m ? window.getComputedStyle(m).visibility : null,
        zIndex: m ? window.getComputedStyle(m).zIndex : null
      };
    });
    console.log('Modal state after click:', modalState);
  }
}
  
  await browser.close();
}

debugClick().catch(console.error);
