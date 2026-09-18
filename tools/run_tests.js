const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runTest(showDiagnose = false) {
  console.log('⚡ Đang khởi chạy kiểm thử siêu tốc qua Headless Chrome...');
  const startTime = Date.now();

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/scratch/test_digits.html', { waitUntil: 'domcontentloaded' });

    // Đợi bài test hoàn thành
    await page.waitForFunction(() => window.__TEST_RESULTS__ && window.__TEST_RESULTS__.done === true, {
      timeout: 10000
    });

    const results = await page.evaluate(() => window.__TEST_RESULTS__);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n========================================================`);
    console.log(`⏱️  Thời gian kiểm thử: ${duration}s`);
    console.log(`========================================================`);

    // 1. KẾT QUẢ ẢNH THỰC TẾ test_cell_clicked.png
    console.log(`\n📸 [1] ẢNH THỰC TẾ: test_cell_clicked.png`);
    if (results.realImage) {
      const { success, r2c1, r3c1, conflicts } = results.realImage;
      if (success) {
        console.log(`   ✅ PASSED: R2C1=${r2c1}, R3C1=${r3c1}, Xung đột: ${conflicts.length}`);
      } else {
        console.log(`   ❌ FAILED: R2C1=${r2c1}, R3C1=${r3c1} (kỳ vọng 3), Xung đột: ${conflicts.length}`);
      }
    }

    // 2. KẾT QUẢ BENCHMARK CHỮ SỐ 1-9
    console.log(`\n🧪 [2] BENCHMARK TỔNG HỢP (Chữ số 1-9 x 6 nền x 3 mức blur x 3 font)`);
    if (results.synthetic) {
      const { total, passed, failures, passRate } = results.synthetic;
      const statusIcon = passRate >= 95 ? '🎉' : (passRate >= 80 ? '⚠️' : '❌');
      console.log(`   ${statusIcon} Tỉ lệ chính xác: ${passRate}% (${passed}/${total} test cases)`);
      console.log(`   Số test case thất bại: ${failures.length}`);

      if (failures.length > 0) {
        console.log(`\n   Chi tiết các lỗi còn lại:`);
        const grouped = {};
        for (const f of failures) {
          const key = `Số ${f.expected} -> Nhận nhầm thành ${f.actual}`;
          grouped[key] = (grouped[key] || 0) + 1;
        }
        for (const [key, count] of Object.entries(grouped)) {
          console.log(`     - ${key}: ${count} lần`);
        }

        console.log(`\n   Top các trường hợp thất bại:`);
        const showCount = showDiagnose ? failures.length : Math.min(10, failures.length);
        failures.slice(0, showCount).forEach((f, i) => {
          console.log(`     ${i + 1}. Kỳ vọng: ${f.expected} | Nhận: ${f.actual} | Nền: ${f.bg} | Blur: ${f.blur}px | Font: ${f.font}`);
          if (showDiagnose && f.debug) {
            console.log(`        [Debug] holes=${f.debug.holeCount}, raw=${JSON.stringify(f.debug.rawHoles)}, qTL=${f.debug.qTL}, qTR=${f.debug.qTR}, qBL=${f.debug.qBL}, qBR=${f.debug.qBR}`);
            console.log(`                bars: top=${f.debug.topBar}, mid=${f.debug.midBar}, bot=${f.debug.botBar} | stems: lU=${f.debug.leftUpperStem}, lL=${f.debug.leftLowerStem}, rU=${f.debug.rightUpperStem}, rL=${f.debug.rightLowerStem}`);
          }
        });
      }
    }
    console.log(`========================================================\n`);

    return results;
  } finally {
    await browser.close();
  }
}

async function main() {
  const isWatch = process.argv.includes('--watch') || process.argv.includes('-w');
  const isDiagnose = process.argv.includes('--diagnose') || process.argv.includes('-d');

  if (isWatch) {
    console.log('👀 Chế độ Watch Mode đang bật: Tự động chạy test khi có file thay đổi...');
    const watchFiles = [
      path.resolve(__dirname, '../js/digit_recognizer.js'),
      path.resolve(__dirname, '../scratch/test_digits.html')
    ];
    let isRunning = false;
    const trigger = async () => {
      if (isRunning) return;
      isRunning = true;
      try {
        await runTest(isDiagnose);
      } catch (e) {
        console.error('Test error:', e);
      } finally {
        isRunning = false;
      }
    };
    await trigger();
    watchFiles.forEach(f => {
      fs.watchFile(f, { interval: 300 }, trigger);
    });
  } else {
    await runTest(isDiagnose);
  }
}

main().catch(err => {
  console.error('Lỗi khi chạy test runner:', err);
  process.exit(1);
});
