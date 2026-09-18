/**
 * image_processor.js
 * Xử lý hình ảnh, phát hiện khung lưới Sudoku chuẩn xác và cắt 81 ô con
 */

import { DigitRecognizer } from './digit_recognizer.js';

export class ImageProcessor {
  constructor() {
    this.recognizer = new DigitRecognizer();
  }

  /**
   * Tải ảnh từ File, Blob hoặc URL thành HTMLImageElement
   */
  static loadImage(source) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Không thể tải hình ảnh. Vui lòng kiểm tra lại file.'));

      if (typeof source === 'string') {
        img.src = source;
      } else if (source instanceof File || source instanceof Blob) {
        img.src = URL.createObjectURL(source);
      } else {
        reject(new Error('Nguồn ảnh không hợp lệ.'));
      }
    });
  }

  /**
   * Phát hiện đường viền bao ngoài thực tế của bàn cờ Sudoku
   * Sử dụng thuật toán Line-Segment Clustering & Sudoku Signature Scoring:
   * Tự động quét tìm và khóa vị trí bàn cờ 9x9 ở bất kỳ góc nào trên màn hình,
   * dù là ảnh chụp toàn trang web hay ảnh cắt sẵn.
   */
  static detectGridBounds(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const getLum = (x, y) => {
      const idx = (y * width + x) * 4;
      return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    };

    // Tính độ sáng trung bình toàn ảnh để tự động thích ứng chế độ sáng/tối
    let totalLum = 0;
    const sampleStep = Math.max(1, Math.floor((width * height) / 4000));
    let sampleCount = 0;
    for (let i = 0; i < width * height; i += sampleStep) {
      totalLum += 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      sampleCount++;
    }
    const avgLum = totalLum / sampleCount;
    const isDarkTheme = avgLum < 120;

    // Điểm thuộc đường kẻ: nét tối đối với nền sáng, nét sáng đối với nền tối
    const isLinePixel = (x, y) => {
      const lum = getLum(x, y);
      return isDarkTheme ? lum > 130 : lum < 140;
    };

    const minLineLen = Math.max(50, Math.floor(Math.min(width, height) * 0.18));
    const step = (width > 900 || height > 900) ? 2 : 1;

    // 1. Quét tìm tất cả các đoạn thẳng ngang (Horizontal segments)
    const hSegments = [];
    for (let y = 0; y < height; y += step) {
      let runStart = -1;
      let gap = 0;
      for (let x = 0; x < width; x++) {
        if (isLinePixel(x, y)) {
          if (runStart === -1) runStart = x;
          gap = 0;
        } else if (runStart !== -1) {
          gap++;
          if (gap > 4 || x === width - 1) {
            const runEnd = x - gap;
            const len = runEnd - runStart + 1;
            if (len >= minLineLen) {
              hSegments.push({ y, x1: runStart, x2: runEnd, len });
            }
            runStart = -1;
            gap = 0;
          }
        }
      }
      if (runStart !== -1) {
        const runEnd = width - 1 - gap;
        const len = runEnd - runStart + 1;
        if (len >= minLineLen) {
          hSegments.push({ y, x1: runStart, x2: runEnd, len });
        }
      }
    }

    // 2. Quét tìm tất cả các đoạn thẳng dọc (Vertical segments)
    const vSegments = [];
    for (let x = 0; x < width; x += step) {
      let runStart = -1;
      let gap = 0;
      for (let y = 0; y < height; y++) {
        if (isLinePixel(x, y)) {
          if (runStart === -1) runStart = y;
          gap = 0;
        } else if (runStart !== -1) {
          gap++;
          if (gap > 4 || y === height - 1) {
            const runEnd = y - gap;
            const len = runEnd - runStart + 1;
            if (len >= minLineLen) {
              vSegments.push({ x, y1: runStart, y2: runEnd, len });
            }
            runStart = -1;
            gap = 0;
          }
        }
      }
      if (runStart !== -1) {
        const runEnd = height - 1 - gap;
        const len = runEnd - runStart + 1;
        if (len >= minLineLen) {
          vSegments.push({ x, y1: runStart, y2: runEnd, len });
        }
      }
    }

    // 3. Ghép cặp các đoạn thẳng ngang để tìm khung bàn cờ hình vuông ứng viên
    let bestCandidate = null;
    let maxScore = -9999;

    for (let i = 0; i < hSegments.length; i++) {
      const top = hSegments[i];
      for (let j = i + 1; j < hSegments.length; j++) {
        const bottom = hSegments[j];
        if (bottom.y <= top.y + minLineLen * 0.8) continue;

        const dx1 = Math.abs(top.x1 - bottom.x1);
        const dx2 = Math.abs(top.x2 - bottom.x2);
        const maxDiff = Math.max(16, top.len * 0.08);

        if (dx1 > maxDiff || dx2 > maxDiff) continue;

        const bw = (top.len + bottom.len) / 2;
        const bh = bottom.y - top.y;
        const ar = bw / bh;

        // Bàn cờ Sudoku luôn là hình vuông (tỷ lệ 0.80 - 1.25)
        if (ar < 0.80 || ar > 1.25) continue;

        const bx = Math.min(top.x1, bottom.x1);
        const by = top.y;

        // Chấm điểm đặc trưng cấu trúc Sudoku (Sudoku Signature Score)
        let score = 100;

        // Kiểm tra cạnh biên dọc bên trái
        const leftMatch = vSegments.some(v => 
          Math.abs(v.x - bx) <= Math.max(12, bw * 0.05) &&
          Math.max(0, Math.min(v.y2, by + bh) - Math.max(v.y1, by)) >= bh * 0.7
        );
        if (leftMatch) score += 120;

        // Kiểm tra cạnh biên dọc bên phải
        const rightMatch = vSegments.some(v => 
          Math.abs(v.x - (bx + bw)) <= Math.max(12, bw * 0.05) &&
          Math.max(0, Math.min(v.y2, by + bh) - Math.max(v.y1, by)) >= bh * 0.7
        );
        if (rightMatch) score += 120;

        // Kiểm tra đường kẻ phân vùng 3x3 chính (ở 1/3 và 2/3)
        const y3_1 = by + bh / 3;
        const y3_2 = by + (bh * 2) / 3;
        if (hSegments.some(h => Math.abs(h.y - y3_1) <= Math.max(6, bh * 0.03) && Math.abs(h.x1 - bx) <= 20)) score += 40;
        if (hSegments.some(h => Math.abs(h.y - y3_2) <= Math.max(6, bh * 0.03) && Math.abs(h.x1 - bx) <= 20)) score += 40;

        const x3_1 = bx + bw / 3;
        const x3_2 = bx + (bw * 2) / 3;
        if (vSegments.some(v => Math.abs(v.x - x3_1) <= Math.max(6, bw * 0.03) && Math.abs(v.y1 - by) <= 20)) score += 40;
        if (vSegments.some(v => Math.abs(v.x - x3_2) <= Math.max(6, bw * 0.03) && Math.abs(v.y1 - by) <= 20)) score += 40;

        // Kiểm tra các đường kẻ ô 9x9 con
        for (let k = 1; k <= 8; k++) {
          if (k === 3 || k === 6) continue;
          const yk = by + (bh / 9) * k;
          const xk = bx + (bw / 9) * k;
          if (hSegments.some(h => Math.abs(h.y - yk) <= Math.max(5, bh * 0.02) && Math.abs(h.x1 - bx) <= 25)) score += 15;
          if (vSegments.some(v => Math.abs(v.x - xk) <= Math.max(5, bw * 0.02) && Math.abs(v.y1 - by) <= 25)) score += 15;
        }

        // Điểm trừ độ méo hình vuông
        score -= Math.abs(1 - ar) * 120;

        // Ưu tiên bàn cờ có kích thước hợp lý
        score += Math.min(60, (bw * bh) / (width * height) * 90);

        if (score > maxScore) {
          maxScore = score;
          bestCandidate = { bx, by, bw, bh, score };
        }
      }
    }

    if (bestCandidate && bestCandidate.score >= 180) {
      return {
        x: Math.round(bestCandidate.bx),
        y: Math.round(bestCandidate.by),
        width: Math.round(bestCandidate.bw),
        height: Math.round(bestCandidate.bh)
      };
    }

    // Dự phòng: Lấy 96% khung ảnh nếu ảnh đã cắt sát mép và không tìm thấy cụm đoạn kẻ
    const padX = Math.round(width * 0.02);
    const padY = Math.round(height * 0.02);
    return {
      x: padX,
      y: padY,
      width: width - padX * 2,
      height: height - padY * 2
    };
  }

  /**
   * Cắt và xử lý nhận diện toàn bộ 81 ô của bàn cờ Sudoku
   */
  async processSudokuImage(img, onProgress = null, customBounds = null) {
    const mainCanvas = document.createElement('canvas');
    mainCanvas.width = img.naturalWidth || img.width;
    mainCanvas.height = img.naturalHeight || img.height;
    const ctx = mainCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    const bounds = customBounds || ImageProcessor.detectGridBounds(mainCanvas);

    const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
    const confidence = Array.from({ length: 9 }, () => Array(9).fill(0));
    const cellImages = Array.from({ length: 9 }, () => Array(9).fill(null));

    const cellW = bounds.width / 9;
    const cellH = bounds.height / 9;

    let processedCount = 0;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        // Tọa độ ô gốc
        const rawX = bounds.x + c * cellW;
        const rawY = bounds.y + r * cellH;

        // Cắt bớt viền mép (chừa 8% mỗi bên) để loại bỏ hoàn toàn các đường kẻ lưới
        const insetX = cellW * 0.08;
        const insetY = cellH * 0.08;
        const cropX = Math.round(rawX + insetX);
        const cropY = Math.round(rawY + insetY);
        const cropW = Math.max(10, Math.round(cellW - insetX * 2));
        const cropH = Math.max(10, Math.round(cellH - insetY * 2));

        const cellCanvas = document.createElement('canvas');
        cellCanvas.width = cropW;
        cellCanvas.height = cropH;
        const cCtx = cellCanvas.getContext('2d', { willReadFrequently: true });
        cCtx.drawImage(mainCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        cellImages[r][c] = cellCanvas.toDataURL('image/png');

        // Nhận diện chữ số bằng thuật toán nhận diện đặc trưng hình thái học
        const result = this.recognizer.recognizeCell(cellCanvas);
        grid[r][c] = result.digit;
        confidence[r][c] = result.confidence;

        processedCount++;
        if (onProgress) {
          onProgress(Math.round((processedCount / 81) * 100));
        }
      }
    }

    return {
      grid,
      confidence,
      cellImages,
      bounds,
      originalWidth: mainCanvas.width,
      originalHeight: mainCanvas.height
    };
  }
}
