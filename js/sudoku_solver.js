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

    function solveHelper() {
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

    function countHelper() {
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
}
