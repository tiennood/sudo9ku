/**
 * sudoku_solver.js
 * Thuật toán kiểm tra hợp lệ, tìm kiếm ứng viên và giải Sudoku tức thời
 */

export class SudokuSolver {
  /**
   * Tạo bản sao sâu của bàn cờ 9x9
   */
  static cloneBoard(board) {
    return board.map(row => [...row]);
  }

  /**
   * Kiểm tra xem giá trị val có hợp lệ tại vị trí (row, col) không
   */
  static isValid(board, row, col, val) {
    // Kiểm tra hàng
    for (let c = 0; c < 9; c++) {
      if (c !== col && board[row][c] === val) return false;
    }

    // Kiểm tra cột
    for (let r = 0; r < 9; r++) {
      if (r !== row && board[r][col] === val) return false;
    }

    // Kiểm tra khối 3x3
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const currR = startRow + r;
        const currC = startCol + c;
        if ((currR !== row || currC !== col) && board[currR][currC] === val) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Lấy danh sách các số ứng viên hợp lệ cho 1 ô (1-9)
   */
  static getCandidates(board, row, col) {
    if (board[row][col] !== 0) return [];
    const candidates = [];
    for (let val = 1; val <= 9; val++) {
      if (this.isValid(board, row, col, val)) {
        candidates.push(val);
      }
    }
    return candidates;
  }

  /**
   * Lấy ma trận tất cả các ứng viên cho toàn bộ 81 ô
   */
  static getAllCandidates(board) {
    const candidatesMap = Array.from({ length: 9 }, () => Array(9).fill(null));
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        candidatesMap[r][c] = this.getCandidates(board, r, c);
      }
    }
    return candidatesMap;
  }

  /**
   * Kiểm tra xem bàn cờ hiện tại có xung đột sẵn không
   */
  static validateBoard(board) {
    const conflicts = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = board[r][c];
        if (val !== 0) {
          if (!this.isValid(board, r, c, val)) {
            conflicts.push({ row: r, col: c, value: val });
          }
        }
      }
    }
    return {
      isValid: conflicts.length === 0,
      conflicts
    };
  }

  /**
   * Giải Sudoku tức thời sử dụng Backtracking tối ưu hóa (chọn ô ít ứng viên nhất trước - MRV)
   * Trả về { solved: boolean, solution: number[][] }
   */
  static solve(board) {
    const validation = this.validateBoard(board);
    if (!validation.isValid) {
      return { solved: false, solution: null, error: 'Bàn cờ ban đầu có số xung đột!' };
    }

    const b = this.cloneBoard(board);
    let nodeCount = 0;
    const MAX_NODES = 40000;

    function solveHelper() {
      if (++nodeCount > MAX_NODES) return false;

      let minCandidates = 10;
      let targetRow = -1;
      let targetCol = -1;
      let bestCandidates = null;

      // Tìm ô trống có ít ứng viên nhất (Most Constrained Variable)
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (b[r][c] === 0) {
            const candidates = SudokuSolver.getCandidates(b, r, c);
            if (candidates.length === 0) {
              return false; // Ô trống không còn ứng viên nào hợp lệ -> nhánh cụt
            }
            if (candidates.length < minCandidates) {
              minCandidates = candidates.length;
              targetRow = r;
              targetCol = c;
              bestCandidates = candidates;
              if (minCandidates === 1) break; // Tối ưu: Nếu chỉ còn 1 ứng viên, chọn luôn
            }
          }
        }
        if (minCandidates === 1) break;
      }

      // Đã điền kín hết bảng
      if (targetRow === -1) return true;

      // Thử từng ứng viên
      for (const val of bestCandidates) {
        b[targetRow][targetCol] = val;
        if (solveHelper()) return true;
        b[targetRow][targetCol] = 0;
      }

      return false;
    }

    const solved = solveHelper();
    return {
      solved,
      solution: solved ? b : null
    };
  }

  /**
   * Đếm số lượng nghiệm (dừng nếu > limit)
   */
  static countSolutions(board, limit = 2) {
    const validation = this.validateBoard(board);
    if (!validation.isValid) return 0;

    const b = this.cloneBoard(board);
    let count = 0;
    let nodeCount = 0;
    const MAX_NODES = 40000;

    function countHelper() {
      if (++nodeCount > MAX_NODES) return;

      let emptyR = -1;
      let emptyC = -1;
      let minCandidates = 10;
      let bestCandidates = null;

      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (b[r][c] === 0) {
            const candidates = SudokuSolver.getCandidates(b, r, c);
            if (candidates.length === 0) return;
            if (candidates.length < minCandidates) {
              minCandidates = candidates.length;
              emptyR = r;
              emptyC = c;
              bestCandidates = candidates;
              if (minCandidates === 1) break;
            }
          }
        }
        if (minCandidates === 1) break;
      }

      if (emptyR === -1) {
        count++;
        return;
      }

      for (const val of bestCandidates) {
        b[emptyR][emptyC] = val;
        countHelper();
        b[emptyR][emptyC] = 0;
        if (count >= limit) return;
      }
    }

    countHelper();
    return count;
  }

  /**
   * Thuật toán Bào bớt ô có kiểm soát (Selective Clue Carving)
   * Giảm tỉ lệ thắng & cố tình phá hủy các nước đi dễ để ép xuất hiện công thức cao cấp (Pointing, Pairs, X-Wing, Phản chứng)
   * trong khi TUYỆT ĐỐI BẢO TOÀN 1 NGHIỆM DUY NHẤT (Unique Solution Guarantee).
   */
  static selectiveCarveClues(inputGrid, targetClues = 22, seedNumber = 2026) {
    const g = this.cloneBoard(inputGrid);
    let s = (Math.abs(seedNumber) * 16807) % 2147483647 || 2026;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };

    let currentClues = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (g[r][c] !== 0) currentClues++;
      }
    }

    if (currentClues <= targetClues) {
      return { carvedGrid: g, remainingClues: currentClues, carvedCount: 0 };
    }

    let carvedCount = 0;
    const maxAttempts = 35;
    let attempt = 0;

    while (currentClues > targetClues && attempt++ < maxAttempts) {
      const candidates = this.getAllCandidates(g);
      const givenClues = [];

      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (g[r][c] !== 0) {
            // Đếm số ô lân cận đang có ít ứng viên (dễ giải)
            let easyPeers = 0;
            for (let pr = 0; pr < 9; pr++) {
              if (pr !== r && g[pr][c] === 0 && candidates[pr][c].length <= 2) easyPeers++;
            }
            for (let pc = 0; pc < 9; pc++) {
              if (pc !== c && g[r][pc] === 0 && candidates[r][pc].length <= 2) easyPeers++;
            }
            const br = Math.floor(r / 3) * 3;
            const bc = Math.floor(c / 3) * 3;
            for (let dr = 0; dr < 3; dr++) {
              for (let dc = 0; dc < 3; dc++) {
                const pr = br + dr;
                const pc = bc + dc;
                if ((pr !== r || pc !== c) && g[pr][pc] === 0 && candidates[pr][pc].length <= 2) easyPeers++;
              }
            }

            // Điểm ưu tiên: Càng phá hủy nhiều ô dễ giải càng được ưu tiên bào trước
            const score = easyPeers * 10 + rnd() * 6;
            givenClues.push({ r, c, val: g[r][c], score });
          }
        }
      }

      // Sắp xếp ưu tiên bào ô phá nước đi dễ
      givenClues.sort((a, b) => b.score - a.score);

      let carvedInPass = false;
      for (const item of givenClues) {
        g[item.r][item.c] = 0;
        // Kiểm tra bảo toàn duy nhất 1 nghiệm
        if (this.countSolutions(g, 2) === 1) {
          currentClues--;
          carvedCount++;
          carvedInPass = true;
          break; // Cập nhật lại bản đồ ứng viên cho lượt tiếp theo
        } else {
          g[item.r][item.c] = item.val; // Phục hồi nếu bị phân nhánh đa nghiệm
        }
      }

      if (!carvedInPass) break;
    }

    return { carvedGrid: g, remainingClues: currentClues, carvedCount };
  }
}
