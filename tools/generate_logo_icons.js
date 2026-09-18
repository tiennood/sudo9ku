const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🎨 Generating new Sudo9ku logo icons offline...');
  const chromePaths = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'
  ];
  let executablePath = chromePaths.find(p => fs.existsSync(p));
  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // HTML template for generating size x size icon (100% offline, pure CSS & SVG)
  const generateHtml = (size) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          width: ${size}px;
          height: ${size}px;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .icon-container {
          width: ${Math.round(size * 0.88)}px;
          height: ${Math.round(size * 0.88)}px;
          border-radius: ${Math.round(size * 0.22)}px;
          background: linear-gradient(135deg, #E27D60 0%, #E8A87C 35%, #53BDB0 80%, #41B3A3 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 ${Math.round(size * 0.05)}px ${Math.round(size * 0.12)}px rgba(0, 0, 0, 0.45),
                      0 ${Math.round(size * 0.02)}px ${Math.round(size * 0.06)}px rgba(226, 125, 96, 0.35);
          position: relative;
        }
        .icon-container::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.35),
                      inset 0 -2px 4px rgba(0, 0, 0, 0.2);
          pointer-events: none;
        }
        .icon-digit {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          font-weight: 800;
          font-size: ${Math.round(size * 0.52)}px;
          color: #FFFFFF;
          line-height: 1;
          display: block;
          margin-top: ${Math.round(-size * 0.02)}px;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          user-select: none;
        }
      </style>
    </head>
    <body>
      <div class="icon-container">
        <span class="icon-digit">9</span>
      </div>
    </body>
    </html>
  `;

  // 1. Generate 512x512 icon
  await page.setViewport({ width: 512, height: 512 });
  await page.setContent(generateHtml(512), { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 150));
  const buf512 = await page.screenshot({ omitBackground: true });

  // 2. Generate 192x192 icon
  await page.setViewport({ width: 192, height: 192 });
  await page.setContent(generateHtml(192), { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 150));
  const buf192 = await page.screenshot({ omitBackground: true });

  // Save to icons/
  const iconsDir = path.join(__dirname, '../icons');
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

  fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), buf512);
  fs.writeFileSync(path.join(iconsDir, 'icon.png'), buf512);
  fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), buf192);
  console.log('✓ Saved icon-512.png, icon.png, icon-192.png in icons/');

  // Save to Android res/mipmap-xxxhdpi
  const androidResDir = path.join(__dirname, '../android/app/src/main/res/mipmap-xxxhdpi');
  if (fs.existsSync(androidResDir)) {
    fs.writeFileSync(path.join(androidResDir, 'ic_launcher.png'), buf192);
    fs.writeFileSync(path.join(androidResDir, 'ic_launcher_round.png'), buf192);
    console.log('✓ Saved ic_launcher.png and ic_launcher_round.png in Android mipmap-xxxhdpi/');
  }

  // Save to artifact directory for verification & display
  const artifactDir = 'C:/Users/Tein/.gemini/antigravity-ide/brain/ca1cc67e-dd3d-4373-b74a-67ec53d73077';
  fs.writeFileSync(path.join(artifactDir, 'new_sudo9ku_logo_512.png'), buf512);
  fs.writeFileSync(path.join(artifactDir, 'new_sudo9ku_logo_192.png'), buf192);
  console.log('✓ Saved preview icons in artifact directory');

  await browser.close();
  console.log('🎉 Logo generation complete!');
})();
