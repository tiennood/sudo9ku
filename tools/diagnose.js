const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const args = process.argv.slice(2);
  const targetDigit = args[0] ? parseInt(args[0], 10) : null;

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/scratch/test_digits.html', { waitUntil: 'domcontentloaded' });

    // Inject diagnostic extractor function
    const diagnostics = await page.evaluate((filterDigit) => {
      const recognizer = new window.DigitRecognizer ? new window.DigitRecognizer() : null;
      // We can also run test and extract features for failed cases
      const results = window.__TEST_RESULTS__;
      if (!results || !results.synthetic) return null;

      const failures = results.synthetic.failures.filter(f => filterDigit ? f.expected === filterDigit : true);
      return failures.slice(0, 15);
    }, targetDigit);

    console.log('--- DIAGNOSTIC FAILURES ---');
    console.log(JSON.stringify(diagnostics, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
