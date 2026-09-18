/**
 * digit_recognizer.js
 * Nhận diện chữ số Sudoku thông minh với độ chính xác cao:
 * Phân tích cấu trúc hình thái học & tô pô học (Morphological & Topological Multi-Feature Classifier):
 * - Thích ứng với tất cả các trạng thái ô trên Sudoku.com:
 *   + Ô bình thường (Normal white)
 *   + Ô đang ấn/chọn (Clicked / Active: #bbdefb)
 *   + Ô cùng số (Same-number highlight: #c3d7ea)
 *   + Ô cùng hàng/cột (Shaded: #e2ebf3)
 *   + Chế độ tối (Dark mode)
 *   + Chữ số bị mờ / nhòe nét do chụp camera hoặc nén ảnh (Blur 0..2px)
 * - Tách nền bằng trung vị viền đa điểm (Border Median Sampling).
 * - Lọc bỏ nhiễu viền trước khi trích xuất bounding box.
 * - Phân loại chính xác tất cả chữ số 1-9:
 *   + 1: Cột dọc hẹp, Q_BL rỗng, không có thanh ngang.
 *   + 2: Thanh đế ngang phẳng rộng ở đáy (botBar >= 0.68), góc đáy trái vuông vức, không có vòm phải dưới.
 *   + 3: Hai vòm cong tròn bên phải (Q_TR & Q_BR đều cao), bên trái mở, mấu giữa.
 *   + 4: Nét dọc phải xuống đáy, đáy trái trống (bottomLeftPixels <= 1), thanh ngang giữa.
 *   + 5: Thanh ngang đỉnh, nét đứng trên bên trái, thanh giữa ngang rộng, góc trên phải mở.
 *   + 6: 1 lỗ đáy (centerY >= 0.45) hoặc bụng đáy tròn dày, góc trên phải mở (qTR < 0.35).
 *   + 7: Thanh đỉnh phẳng rộng, nét chéo xuống đáy trái, góc dưới phải Q_BR hoàn toàn trống.
 *   + 8: 2 lỗ kín rõ rệt (hoặc cấu trúc thắt eo đối xứng 4 góc đầy đặn).
 *   + 9: 1 lỗ đỉnh (centerY < 0.45), vòm trên tròn khép kín, góc trên phải có nét dọc, thân cong về tâm đáy.
 */

export class DigitRecognizer {
  constructor() {}

  /**
   * Đếm số lỗ kín (holes) và tọa độ tâm lỗ (chuẩn hóa 0..1 theo bw, bh)
   */
  countHoles(mat, w, h) {
    const visited = Array.from({ length: h }, () => Array(w).fill(false));
    const queue = [];

    // Flood fill từ 4 cạnh ngoài cùng để tìm nền ngoài (pixel 0)
    for (let x = 0; x < w; x++) {
      if (mat[0][x] === 0) { visited[0][x] = true; queue.push([0, x]); }
      if (mat[h - 1][x] === 0) { visited[h - 1][x] = true; queue.push([h - 1, x]); }
    }
    for (let y = 0; y < h; y++) {
      if (mat[y][0] === 0) { visited[y][0] = true; queue.push([y, 0]); }
      if (mat[y][w - 1] === 0) { visited[y][w - 1] = true; queue.push([y, w - 1]); }
    }

    while (queue.length > 0) {
      const [cy, cx] = queue.shift();
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dy, dx] of dirs) {
        const ny = cy + dy;
        const nx = cx + dx;
        if (ny >= 0 && ny < h && nx >= 0 && nx < w && !visited[ny][nx] && mat[ny][nx] === 0) {
          visited[ny][nx] = true;
          queue.push([ny, nx]);
        }
      }
    }

    // Đếm các vùng pixel 0 chưa được đánh dấu (lỗ kín bên trong nét chữ)
    const holes = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (mat[y][x] === 0 && !visited[y][x]) {
          let size = 0;
          let sumY = 0;
          let sumX = 0;
          const q = [[y, x]];
          visited[y][x] = true;

          while (q.length > 0) {
            const [hy, hx] = q.shift();
            size++;
            sumY += hy;
            sumX += hx;
            for (const [dy, dx] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
              const ny = hy + dy;
              const nx = hx + dx;
              if (ny >= 0 && ny < h && nx >= 0 && nx < w && !visited[ny][nx] && mat[ny][nx] === 0) {
                visited[ny][nx] = true;
                q.push([ny, nx]);
              }
            }
          }

          if (size >= 3) {
            holes.push({
              size,
              centerY: sumY / size / h,
              centerX: sumX / size / w
            });
          }
        }
      }
    }
    return holes;
  }

  /**
   * Nhận diện chữ số từ một canvas ô Sudoku đã cắt
   * @param {HTMLCanvasElement} cellCanvas
   * @returns {{ digit: number, confidence: number }}
   */
  recognizeCell(cellCanvas) {
    const ctx = cellCanvas.getContext('2d', { willReadFrequently: true });
    const w = cellCanvas.width;
    const h = cellCanvas.height;
    if (w < 10 || h < 10) return { digit: 0, confidence: 1.0 };

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Tính độ sáng pixel tại tọa độ (x, y)
    const getLum = (x, y) => {
      const idx = (y * w + x) * 4;
      return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    };

    // 1. Lấy mẫu trung vị nền (Border Median Sampling) từ các cạnh ngoài
    const borderLums = [];
    for (let x = 2; x < w - 2; x += 3) {
      borderLums.push(getLum(x, 2));
      borderLums.push(getLum(x, h - 3));
    }
    for (let y = 2; y < h - 2; y += 3) {
      borderLums.push(getLum(2, y));
      borderLums.push(getLum(w - 3, y));
    }
    borderLums.sort((a, b) => a - b);
    const bgLum = borderLums[Math.floor(borderLums.length / 2)] || 255;
    const isDarkCell = bgLum < 120;

    // 2. Tìm độ tương phản cực trị trong vùng lõi ô (chừa lề 3px)
    let minLum = 255;
    let maxLum = 0;
    for (let y = 3; y < h - 3; y++) {
      for (let x = 3; x < w - 3; x++) {
        const l = getLum(x, y);
        if (l < minLum) minLum = l;
        if (l > maxLum) maxLum = l;
      }
    }

    const contrast = isDarkCell ? (maxLum - bgLum) : (bgLum - minLum);
    // Nếu ô không có tương phản rõ rệt (dưới 22 đơn vị) -> Ô trống
    if (contrast < 22) {
      return { digit: 0, confidence: 1.0 };
    }

    // Ngưỡng phân tách nhị phân thích ứng theo độ tương phản động (0.54 giúp giữ nét mảnh và không bít lỗ khi bị mờ)
    const threshold = isDarkCell
      ? bgLum + Math.max(18, contrast * 0.54)
      : bgLum - Math.max(18, contrast * 0.54);

    const isDigitPixel = (x, y) => isDarkCell ? getLum(x, y) > threshold : getLum(x, y) < threshold;

    // 3. Quét bounding box nét chữ có lọc nhiễu viền
    const rowCounts = Array(h).fill(0);
    const colCounts = Array(w).fill(0);
    let digitPixelCount = 0;

    for (let y = 3; y < h - 3; y++) {
      for (let x = 3; x < w - 3; x++) {
        if (isDigitPixel(x, y)) {
          digitPixelCount++;
          rowCounts[y]++;
          colCounts[x]++;
        }
      }
    }

    if (digitPixelCount < 15) {
      return { digit: 0, confidence: 1.0 };
    }

    // Lọc các hàng/cột biên chỉ có 1 điểm nhiễu lẻ
    let minY = 3; while (minY < h - 3 && rowCounts[minY] < 2) minY++;
    let maxY = h - 4; while (maxY >= 3 && rowCounts[maxY] < 2) maxY--;
    let minX = 3; while (minX < w - 3 && colCounts[minX] < 2) minX++;
    let maxX = w - 4; while (maxX >= 3 && colCounts[maxX] < 2) maxX--;

    if (minX >= maxX || minY >= maxY) {
      return { digit: 0, confidence: 1.0 };
    }

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;

    // Nét chữ trong ô Sudoku luôn chiếm ít nhất 35% chiều cao ô (loại bỏ con trỏ, icon chọn ô ⊕, nhiễu viền)
    const minDigitHeight = Math.max(14, Math.round(h * 0.35));
    if (bh < minDigitHeight || bw < 3 || digitPixelCount < 22) {
      return { digit: 0, confidence: 1.0 };
    }

    const aspectRatio = bw / bh;

    // Trích xuất ma trận nhị phân chặt khít của chữ số
    const mat = [];
    let totalPixels = 0;
    for (let y = minY; y <= maxY; y++) {
      const row = [];
      for (let x = minX; x <= maxX; x++) {
        const v = isDigitPixel(x, y) ? 1 : 0;
        row.push(v);
        if (v) totalPixels++;
      }
      mat.push(row);
    }

    // 4. Trích xuất đặc trưng hình thái học chi tiết
    // a. Phân bố 4 góc (Quadrant Densities)
    const midX = Math.floor(bw / 2);
    const midY = Math.floor(bh / 2);
    let qTLCount = 0, qTRCount = 0, qBLCount = 0, qBRCount = 0;
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        if (mat[y][x]) {
          if (y < midY && x < midX) qTLCount++;
          else if (y < midY && x >= midX) qTRCount++;
          else if (y >= midY && x < midX) qBLCount++;
          else qBRCount++;
        }
      }
    }
    const areaTL = Math.max(1, midX * midY);
    const areaTR = Math.max(1, (bw - midX) * midY);
    const areaBL = Math.max(1, midX * (bh - midY));
    const areaBR = Math.max(1, (bw - midX) * (bh - midY));

    const qTL = qTLCount / areaTL;
    const qTR = qTRCount / areaTR;
    const qBL = qBLCount / areaBL;
    const qBR = qBRCount / areaBR;

    // b. Các thanh ngang (Top bar, Mid bar, Bottom bar)
    let topBarW = 0;
    for (let y = 0; y <= Math.min(2, bh - 1); y++) {
      let count = 0; for (let x = 0; x < bw; x++) if (mat[y][x]) count++;
      if (count > topBarW) topBarW = count;
    }
    const topBar = topBarW / bw;

    let botBarW = 0;
    for (let y = Math.max(0, bh - 3); y < bh; y++) {
      let count = 0; for (let x = 0; x < bw; x++) if (mat[y][x]) count++;
      if (count > botBarW) botBarW = count;
    }
    const botBar = botBarW / bw;

    let midBarW = 0;
    for (let y = Math.round(bh * 0.40); y <= Math.round(bh * 0.65); y++) {
      let count = 0; for (let x = 0; x < bw; x++) if (mat[y][x]) count++;
      if (count > midBarW) midBarW = count;
    }
    const midBar = midBarW / bw;

    // c. Các nét dọc biên (Stems) có dung sai bề ngang tương đối (scale-invariant)
    const leftMargin = Math.max(1, Math.floor(bw * 0.22));
    const rightMargin = Math.min(bw - 2, Math.ceil(bw * 0.78));

    let leftUpperStemCount = 0;
    const stemUStart = Math.round(bh * 0.30), stemUEnd = Math.round(bh * 0.48);
    for (let y = stemUStart; y < stemUEnd; y++) {
      let has = false;
      for (let x = 0; x <= leftMargin; x++) if (mat[y][x]) { has = true; break; }
      if (has) leftUpperStemCount++;
    }
    const leftUpperStem = leftUpperStemCount / Math.max(1, stemUEnd - stemUStart);

    let leftLowerStemCount = 0;
    const stemLStart = Math.round(bh * 0.55), stemLEnd = Math.round(bh * 0.85);
    for (let y = stemLStart; y < stemLEnd; y++) {
      let has = false;
      for (let x = 0; x <= leftMargin; x++) if (mat[y][x]) { has = true; break; }
      if (has) leftLowerStemCount++;
    }
    const leftLowerStem = leftLowerStemCount / Math.max(1, stemLEnd - stemLStart);

    let rightUpperStemCount = 0;
    for (let y = stemUStart; y < stemUEnd; y++) {
      let has = false;
      for (let x = rightMargin; x < bw; x++) if (mat[y][x]) { has = true; break; }
      if (has) rightUpperStemCount++;
    }
    const rightUpperStem = rightUpperStemCount / Math.max(1, stemUEnd - stemUStart);

    let rightLowerStemCount = 0;
    const stemRLStart = Math.round(bh * 0.55), stemRLEnd = Math.round(bh * 0.90);
    for (let y = stemRLStart; y < stemRLEnd; y++) {
      let has = false;
      for (let x = rightMargin; x < bw; x++) if (mat[y][x]) { has = true; break; }
      if (has) rightLowerStemCount++;
    }
    const rightLowerStem = rightLowerStemCount / Math.max(1, stemRLEnd - stemRLStart);

    // d. Điểm góc và hàng đáy
    const hasBottomLeft = !!(
      (mat[bh - 1] && (mat[bh - 1][0] || (bw > 1 && mat[bh - 1][1]))) ||
      (mat[bh - 2] && (mat[bh - 2][0] || (bw > 1 && mat[bh - 2][1])))
    );

    let bottomLeftPixels = 0;
    let bottomRightPixels = 0;
    if (mat[bh - 1]) {
      for (let x = 0; x < bw; x++) {
        if (mat[bh - 1][x]) {
          if (x < bw * 0.4) bottomLeftPixels++;
          if (x >= bw * 0.6) bottomRightPixels++;
        }
      }
    }

    // e. Đếm lỗ kín (Holes)
    const padded = [Array(bw + 2).fill(0)];
    for (let y = 0; y < bh; y++) padded.push([0, ...mat[y], 0]);
    padded.push(Array(bw + 2).fill(0));
    const allHoles = this.countHoles(padded, bw + 2, bh + 2);
    const minHoleSize = Math.max(5, Math.round(bw * bh * 0.02));
    const holes = allHoles.filter(h => h.size >= minHoleSize);

    const debugInfo = {
      bw, bh, aspectRatio: +aspectRatio.toFixed(2),
      holeCount: holes.length,
      rawHoles: allHoles.map(h => h.size),
      holes: holes.map(h => ({ size: h.size, cx: +(h.centerX).toFixed(2), cy: +(h.centerY).toFixed(2) })),
      qTL: +qTL.toFixed(2), qTR: +qTR.toFixed(2), qBL: +qBL.toFixed(2), qBR: +qBR.toFixed(2),
      topBar: +topBar.toFixed(2), midBar: +midBar.toFixed(2), botBar: +botBar.toFixed(2),
      leftUpperStem: +leftUpperStem.toFixed(2), leftLowerStem: +leftLowerStem.toFixed(2),
      rightUpperStem: +rightUpperStem.toFixed(2), rightLowerStem: +rightLowerStem.toFixed(2)
    };
    const makeRes = (digit, confidence) => ({ digit, confidence, debug: debugInfo });

    // 5. Phân loại cấu trúc phân tầng (Hierarchical Structural Classification)

    // TRƯỜNG HỢP A: Có từ 2 lỗ kín trở lên -> Số 8 (hoặc Số 6 bị mờ tạo cầu nối giả ở trên)
    if (holes.length >= 2) {
      // Số 6: Nếu góc trên phải hoàn toàn mở (qTR < 0.35) và không có nét trên phải -> Số 6
      if (qTR < 0.35 && rightUpperStem < 0.25) {
        return makeRes(6, 0.96);
      }
      return makeRes(8, 0.99);
    }

    // TRƯỜNG HỢP B: Có đúng 1 lỗ kín
    if (holes.length === 1) {
      const hole = holes[0];
      // Kiểm tra Số 4 trước (tam giác kín): Đáy chỉ có 1 chân đứng đơn lẻ (botBar <= 0.38), đỉnh nhọn (topBar <= 0.50)
      if (botBar <= 0.38 && topBar <= 0.50) {
        return makeRes(4, 0.99);
      }
      if (botBar <= 0.45 && midBar >= 0.60 && topBar <= 0.48 && bottomLeftPixels <= 1) {
        return makeRes(4, 0.98);
      }
      // Phân biệt Số 6 vs Số 9 vs Số 8 (bị bít 1 lỗ do blur)
      if (hole.centerY >= 0.45) {
        // Nếu góc trên phải hoàn toàn kín đặc nét dọc -> Là Số 8 bị mờ bít lỗ trên
        if (rightUpperStem >= 0.60 && qTR >= 0.60) {
          return makeRes(8, 0.98);
        }
        // Nếu góc dưới trái trống rỗng -> Số 4
        if (leftLowerStem < 0.35 && qBL < 0.38) {
          return makeRes(4, 0.98);
        }
        // Lỗ ở nửa dưới, sống lưng trái và đáy tròn đầy đặn -> Số 6
        return makeRes(6, 0.99);
      } else {
        // Lỗ ở nửa trên -> Số 9 (hoặc 8 bị bít lỗ dưới)
        if (rightLowerStem >= 0.60 && leftLowerStem >= 0.60 && qBL >= 0.65) {
          return makeRes(8, 0.98);
        }
        return makeRes(9, 0.99);
      }
    }

    // TRƯỜNG HỢP C: Không có lỗ kín (0 lỗ) -> 1, 2, 3, 4, 5, 7, hoặc 8/6/9 bị bít lỗ do mờ

    // 1. Kiểm tra Số 1: Chiều ngang mảnh mai (aspectRatio < 0.55), chiều cao đạt chuẩn (bh >= h * 0.40), góc dưới bên trái trống rỗng (qBL < 0.25)
    const isNarrowOne = bh >= Math.round(h * 0.38) && (
      (aspectRatio < 0.48 && qBL < 0.25) ||
      (aspectRatio < 0.55 && qBL < 0.20 && topBar < 0.60 && botBar < 0.60)
    );
    if (isNarrowOne) {
      return makeRes(1, 0.98);
    }

    // 2. Kiểm tra Số 4: Thanh ngang giữa rộng đặc trưng (midBar >= 0.70), trong khi đỉnh nhọn/hẹp và đáy hẹp (topBar <= 0.52 && botBar <= 0.52)
    const isFour = (midBar >= 0.70 && topBar <= 0.52 && botBar <= 0.52 && rightLowerStem >= 0.45);
    if (isFour) {
      return makeRes(4, 0.98);
    }

    // 3. Kiểm tra Số 7: Thanh đỉnh ngang phẳng rộng, đổ chéo về đáy trái, góc dưới phải hoàn toàn trống, không có chân đế
    const isSeven = (topBar >= 0.55 && rightLowerStem < 0.35 && qBR < 0.40 && botBar < 0.52 && !hasBottomLeft);
    if (isSeven) {
      return makeRes(7, 0.98);
    }

    // 4. Kiểm tra Số 2: Có thanh đế ngang phẳng rộng ở đáy (botBar >= 0.68), góc đáy trái vuông, và KHÔNG có nét vòm phải nửa dưới (rightLowerStem < 0.50)
    const isTwo = (botBar >= 0.68 && (hasBottomLeft || bottomLeftPixels >= 2) && leftUpperStem < 0.65 && rightLowerStem < 0.50);
    if (isTwo) {
      return makeRes(2, 0.98);
    }

    // 5. Kiểm tra Số 6 (bị mờ làm bít lỗ đáy): Sống lưng trái dài liền từ trên xuống dưới (leftUpperStem & leftLowerStem cao), góc trên phải mở (rightUpperStem < 0.40), đáy tròn đầy đặn (qBL & qBR cao)
    const isBlurredSix = (
      leftUpperStem >= 0.60 &&
      leftLowerStem >= 0.65 &&
      rightUpperStem <= 0.38 &&
      qBL >= 0.60 && qBR >= 0.60
    );
    if (isBlurredSix) {
      return makeRes(6, 0.97);
    }

    // 6. Kiểm tra Số 5: Có thanh đỉnh (topBar >= 0.55), sống lưng trên trái (leftUpperStem >= 0.55), bụng cong dưới phải (rightLowerStem >= 0.50), và đáy trái KHÔNG có sống lưng (leftLowerStem < 0.65)
    const isFive = (
      topBar >= 0.55 &&
      leftUpperStem >= 0.55 &&
      leftLowerStem < 0.65 &&
      rightLowerStem >= 0.50
    );
    if (isFive) {
      return makeRes(5, 0.98);
    }

    // 7. Kiểm tra Số 9 (bị mờ làm bít lỗ đỉnh): Vòm đỉnh tròn dày (qTL >= 0.65 & qTR đều cao), góc trên phải có nét dọc (rightUpperStem >= 0.60), nửa trên nặng hơn nửa dưới và góc dưới trái khuyết
    const isBlurredNine = (
      aspectRatio >= 0.55 &&
      qTL >= 0.65 &&
      leftUpperStem >= 0.50 &&
      rightUpperStem >= 0.60 &&
      rightLowerStem >= 0.55 &&
      (qBL < 0.45 || (qTL - qBL >= 0.18 && (qTL + qTR) > (qBL + qBR) + 0.10))
    );
    if (isBlurredNine) {
      return makeRes(9, 0.96);
    }

    // 8. Kiểm tra Số 8 (bị mờ làm bít cả 2 lỗ): Cả 4 góc đều đầy đặn và cân đối, cả 4 cạnh đều có nét dọc
    const isBlurredEight = (
      leftUpperStem >= 0.45 && leftLowerStem >= 0.45 &&
      rightUpperStem >= 0.45 && rightLowerStem >= 0.45 &&
      qTL > 0.50 && qTR > 0.50 && qBL > 0.50 && qBR > 0.50
    );
    if (isBlurredEight) {
      return makeRes(8, 0.95);
    }

    // Còn lại là Số 3
    return makeRes(3, 0.97);
  }
}
