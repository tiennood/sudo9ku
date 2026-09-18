const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function run() {
  // Find Chrome path
  const chromePaths = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ];
  let executablePath = chromePaths.find(p => fs.existsSync(p));

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 850 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

    const result = await page.evaluate(async () => {
      const app = window.app;
      if (!app) return { error: 'No app' };

      // Make sure puzzle is loaded
      if (!app.solution) {
        document.getElementById('sample-preset-card')?.click();
        await new Promise(r => setTimeout(r, 1000));
      }

      // 1. Go to Step 1
      app.goToStep(1);
      const step1 = app.solveSteps[1];
      const target1 = step1 ? step1.targetCell : null;
      const cell1 = target1 ? app.cellElements[target1.row][target1.col] : null;
      const cell1IsRedAtStep1 = cell1 ? cell1.classList.contains('step-view-target-red') : false;

      // 2. Go to Step 2
      app.goToStep(2);
      const step2 = app.solveSteps[2];
      const target2 = step2 ? step2.targetCell : null;
      const cell2 = target2 ? app.cellElements[target2.row][target2.col] : null;
      const cell1IsRedAtStep2 = cell1 ? cell1.classList.contains('step-view-target-red') : false;
      const cell2IsRedAtStep2 = cell2 ? cell2.classList.contains('step-view-target-red') : false;

      // 3. Open Formula Modal and click an upcoming step chip
      app.openFormulaModal();
      const chip = document.querySelector('.btn-applied-step.upcoming');
      let chipTargetRed = false;
      let chipStepIdx = null;
      if (chip) {
        chipStepIdx = parseInt(chip.dataset.stepIndex, 10);
        chip.click();
        const chipStep = app.solveSteps[chipStepIdx];
        if (chipStep && chipStep.targetCell) {
          const cElem = app.cellElements[chipStep.targetCell.row][chipStep.targetCell.col];
          chipTargetRed = cElem ? cElem.classList.contains('step-view-target-red') : false;
        }
      }

      return {
        step1Target: target1,
        cell1IsRedAtStep1,
        step2Target: target2,
        cell1IsRedAtStep2,
        cell2IsRedAtStep2,
        chipStepIdx,
        chipTargetRed
      };
    });

    console.log('Red Target Highlight Test Result:', JSON.stringify(result, null, 2));

    // Capture screenshot of the red target highlight
    await page.screenshot({ path: 'C:/Users/Tein/.gemini/antigravity-ide/brain/ca1cc67e-dd3d-4373-b74a-67ec53d73077/red_target_highlight_demo.png' });
    console.log('Saved red_target_highlight_demo.png');
    await browser.close();
    process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
