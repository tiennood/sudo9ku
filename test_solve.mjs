import { SudokuSolver } from "./js/sudoku_solver.js";

const board = [
  [0, 8, 0, 0, 0, 0, 9, 0, 0],
  [0, 0, 0, 7, 0, 0, 1, 0, 0],
  [0, 0, 6, 0, 0, 2, 0, 0, 4],
  [7, 5, 0, 0, 0, 9, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 6],
  [0, 0, 9, 0, 4, 8, 0, 0, 3],
  [0, 4, 8, 0, 0, 0, 0, 3, 0],
  [0, 0, 0, 0, 1, 0, 0, 0, 0],
  [0, 3, 0, 5, 0, 0, 8, 0, 0]
];

const cands = SudokuSolver.getAllCandidates(board);
const num = 8;

export function analyzeCandidateEliminations(currentBoard, candsMap, targetNum) {
  if (!targetNum || targetNum < 1 || targetNum > 9) return { eliminated: new Map(), confirmed: new Set() };

  const eliminated = new Map(); // key `${r},${c}` -> reason string
  const confirmed = new Set();  // key `${r},${c}`

  // 1. Ô đã điền targetNum
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (currentBoard[r][c] === targetNum) {
        // Hàng
        for (let j = 0; j < 9; j++) {
          if (j !== c && !eliminated.has(`${r},${j}`)) {
            eliminated.set(`${r},${j}`, `Cùng hàng với ô (${r + 1}, ${c + 1}) = ${targetNum}`);
          }
        }
        // Cột
        for (let i = 0; i < 9; i++) {
          if (i !== r && !eliminated.has(`${i},${c}`)) {
            eliminated.set(`${i},${c}`, `Cùng cột với ô (${r + 1}, ${c + 1}) = ${targetNum}`);
          }
        }
        // Khối 3x3
        const br = Math.floor(r / 3) * 3;
        const bc = Math.floor(c / 3) * 3;
        for (let i = br; i < br + 3; i++) {
          for (let j = bc; j < bc + 3; j++) {
            if ((i !== r || j !== c) && !eliminated.has(`${i},${j}`)) {
              eliminated.set(`${i},${j}`, `Cùng Khối 3x3 với ô (${r + 1}, ${c + 1}) = ${targetNum}`);
            }
          }
        }
      }
    }
  }

  if (!candsMap) return { eliminated, confirmed };

  const isCandAvailable = (r, c) => {
    return currentBoard[r][c] === 0 && candsMap[r] && candsMap[r][c] && candsMap[r][c].includes(targetNum) && !eliminated.has(`${r},${c}`);
  };

  let changed = true;
  let passes = 0;

  while (changed && passes < 10) {
    changed = false;
    passes++;

    // 2. Đơn lẻ ẩn trong Khối 3x3 (Hidden Single in Box)
    for (let b = 0; b < 9; b++) {
      const br = Math.floor(b / 3) * 3;
      const bc = (b % 3) * 3;
      const validInBox = [];
      for (let r = br; r < br + 3; r++) {
        for (let c = bc; c < bc + 3; c++) {
          if (isCandAvailable(r, c)) validInBox.push({ r, c });
        }
      }

      if (validInBox.length === 1) {
        const p = validInBox[0];
        const key = `${p.r},${p.c}`;
        if (!confirmed.has(key)) {
          confirmed.add(key);
          for (let c = 0; c < 9; c++) {
            if (c !== p.c && isCandAvailable(p.r, c)) {
              eliminated.set(`${p.r},${c}`, `Số ${targetNum} duy nhất của Khối ${b + 1} tại ô (${p.r + 1}, ${p.c + 1}) khóa Hàng ${p.r + 1}`);
              changed = true;
            }
          }
          for (let r = 0; r < 9; r++) {
            if (r !== p.r && isCandAvailable(r, p.c)) {
              eliminated.set(`${r},${p.c}`, `Số ${targetNum} duy nhất của Khối ${b + 1} tại ô (${p.r + 1}, ${p.c + 1}) khóa Cột ${p.c + 1}`);
              changed = true;
            }
          }
        }
      }

      // 3. Khóa tia trong Khối (Pointing Lines)
      if (validInBox.length > 1) {
        const rows = new Set(validInBox.map(p => p.r));
        if (rows.size === 1) {
          const row = Array.from(rows)[0];
          for (let c = 0; c < 9; c++) {
            if ((c < bc || c >= bc + 3) && isCandAvailable(row, c)) {
              eliminated.set(`${row},${c}`, `Khóa tia Pointing: Số ${targetNum} trong Khối ${b + 1} chỉ nằm trên Hàng ${row + 1}`);
              changed = true;
            }
          }
        }
        const cols = new Set(validInBox.map(p => p.c));
        if (cols.size === 1) {
          const col = Array.from(cols)[0];
          for (let r = 0; r < 9; r++) {
            if ((r < br || r >= br + 3) && isCandAvailable(r, col)) {
              eliminated.set(`${r},${col}`, `Khóa tia Pointing: Số ${targetNum} trong Khối ${b + 1} chỉ nằm trên Cột ${col + 1}`);
              changed = true;
            }
          }
        }
      }
    }

    // 4. Chặn ngược Khối (Box-Line Reduction / Claiming)
    for (let r = 0; r < 9; r++) {
      const validInRow = [];
      for (let c = 0; c < 9; c++) {
        if (isCandAvailable(r, c)) validInRow.push({ r, c });
      }
      if (validInRow.length > 1) {
        const boxes = new Set(validInRow.map(p => Math.floor(p.c / 3)));
        if (boxes.size === 1) {
          const bIdx = Array.from(boxes)[0];
          const br = Math.floor(r / 3) * 3;
          const bc = bIdx * 3;
          for (let i = br; i < br + 3; i++) {
            if (i !== r) {
              for (let j = bc; j < bc + 3; j++) {
                if (isCandAvailable(i, j)) {
                  eliminated.set(`${i},${j}`, `Chặn ngược Claiming: Số ${targetNum} trên Hàng ${r + 1} chỉ nằm trọn trong Khối`);
                  changed = true;
                }
              }
            }
          }
        }
      }
    }

    // 5. Cánh bướm X-Wing
    // Theo 2 Hàng -> Triệt tiêu trên 2 Cột
    const rowCandCols = [];
    for (let r = 0; r < 9; r++) {
      const cols = [];
      for (let c = 0; c < 9; c++) {
        if (isCandAvailable(r, c)) cols.push(c);
      }
      rowCandCols.push(cols);
    }
    for (let r1 = 0; r1 < 8; r1++) {
      if (rowCandCols[r1].length === 2) {
        const [c1, c2] = rowCandCols[r1];
        for (let r2 = r1 + 1; r2 < 9; r2++) {
          if (rowCandCols[r2].length === 2 && rowCandCols[r2][0] === c1 && rowCandCols[r2][1] === c2) {
            // Found X-Wing on rows r1, r2 across cols c1, c2
            for (let r = 0; r < 9; r++) {
              if (r !== r1 && r !== r2) {
                if (isCandAvailable(r, c1)) {
                  eliminated.set(`${r},${c1}`, `Cánh bướm X-Wing trên Hàng ${r1 + 1} & ${r2 + 1} triệt tiêu Cột ${c1 + 1}`);
                  changed = true;
                }
                if (isCandAvailable(r, c2)) {
                  eliminated.set(`${r},${c2}`, `Cánh bướm X-Wing trên Hàng ${r1 + 1} & ${r2 + 1} triệt tiêu Cột ${c2 + 1}`);
                  changed = true;
                }
              }
            }
          }
        }
      }
    }
  }

  return { eliminated, confirmed };
}

const result = analyzeCandidateEliminations(board, cands, num);
console.log("Total eliminated cells:", result.eliminated.size);
for (const [coord, reason] of result.eliminated.entries()) {
  console.log(`  ${coord}: ${reason}`);
}
console.log("Confirmed cells for 8:", Array.from(result.confirmed));
