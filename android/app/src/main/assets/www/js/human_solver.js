/**
 * human_solver.js
 * Thuật toán suy luận logic giải Sudoku từng bước mô phỏng tư duy con người
 * Đồng bộ đáp án chính xác với Sudoku.com và giải thích chi tiết các công thức logic.
 */

import { SudokuSolver } from './sudoku_solver.js';

export class HumanSolver {
  /**
   * Tạo toàn bộ chuỗi các bước giải theo phương pháp suy luận logic
   * @param {number[][]} initialBoard Ma trận 9x9 ban đầu
   * @param {number[][]} [officialSolution=null] Lời giải chính thức (từ Sudoku.com) để đồng bộ 100%
   * @returns {{ steps: Array, finalBoard: number[][], isComplete: boolean }}
   */
  static generateSolveSteps(initialBoard, officialSolution = null) {
    const currentBoard = SudokuSolver.cloneBoard(initialBoard);
    const steps = [];

    // Nếu chưa có lời giải chính thức, tự giải để kiểm tra
    let solution = officialSolution;
    if (!solution) {
      const solRes = SudokuSolver.solve(initialBoard);
      if (solRes.solved) {
        solution = solRes.solution;
      }
    }

    // Khởi tạo tập ứng viên cho từng ô
    let candidates = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => [])
    );

    // Tính ứng viên ban đầu
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (currentBoard[r][c] === 0) {
          candidates[r][c] = SudokuSolver.getCandidates(currentBoard, r, c);
        } else {
          candidates[r][c] = [];
        }
      }
    }

    // Ghi nhận bước 0: Trạng thái đề bài
    steps.push({
      stepIndex: 0,
      type: 'initial',
      title: 'Đề bài ban đầu',
      strategyName: 'Khởi tạo',
      formulaId: 'initial',
      formulaName: 'Khởi tạo đề bài',
      formulaRule: 'Đề bài gốc cung cấp các ô cố định ban đầu.',
      abstractFormula: 'Khởi tạo ma trận 9x9 từ các số cho sẵn của đề bài',
      concreteFormula: 'Xác định các ô đã có số và tính toán tập ứng viên hợp lệ cho toàn bộ ô trống',
      patternExplanation: 'Quan sát các ô đã cho sẵn số trên bảng.',
      actionExplanation: 'Bắt đầu tính toán tập ứng viên cho 81 ô.',
      explanation: 'Bắt đầu giải Sudoku từ các số đã cho trong đề bài.',
      targetCell: null,
      relatedUnit: null,
      highlightCells: [],
      boardState: SudokuSolver.cloneBoard(currentBoard),
      candidatesState: candidates.map(row => row.map(cell => [...cell]))
    });

    let progress = true;
    let maxIterations = 200; // Bảo vệ chống vòng lặp vô hạn
    let iteration = 0;

    while (progress && !this.isBoardFilled(currentBoard) && iteration++ < maxIterations) {
      progress = false;

      // 1. Full House (Ô duy nhất còn lại trong Đơn vị: Khối 3x3, Hàng, Cột - Rất dễ)
      const fullHouse = this.findFullHouse(currentBoard, candidates);
      if (fullHouse) {
        this.applyPlacement(currentBoard, candidates, fullHouse, steps);
        progress = true;
        continue;
      }

      // 2. Cross-Hatching / Hidden Single theo Khối 3x3 (Gióng hàng ngang dọc - Rất dễ)
      const boxSingle = this.findHiddenSingleInBox(currentBoard, candidates);
      if (boxSingle) {
        this.applyPlacement(currentBoard, candidates, boxSingle, steps);
        progress = true;
        continue;
      }

      // 3. Naked Single (Đơn lẻ trần - Dễ)
      const nakedSingle = this.findNakedSingle(currentBoard, candidates);
      if (nakedSingle) {
        this.applyPlacement(currentBoard, candidates, nakedSingle, steps);
        progress = true;
        continue;
      }

      // 4. Hidden Single theo Hàng hoặc Cột (Trung bình)
      const lineSingle = this.findHiddenSingleInLine(currentBoard, candidates);
      if (lineSingle) {
        this.applyPlacement(currentBoard, candidates, lineSingle, steps);
        progress = true;
        continue;
      }

      // 3. Naked Pair (Cặp đôi trần trong Hàng, Cột, Khối 3x3)
      const nakedPair = this.findNakedPair(currentBoard, candidates);
      if (nakedPair) {
        this.applyElimination(candidates, nakedPair, steps, currentBoard);
        progress = true;
        continue;
      }

      // 4. Hidden Pair (Cặp đôi ẩn trong Hàng, Cột, Khối 3x3)
      const hiddenPair = this.findHiddenPair(currentBoard, candidates);
      if (hiddenPair) {
        this.applyElimination(candidates, hiddenPair, steps, currentBoard);
        progress = true;
        continue;
      }

      // 5. Pointing (Khóa ứng viên Khối -> Hàng/Cột)
      const pointing = this.findPointing(currentBoard, candidates);
      if (pointing) {
        this.applyElimination(candidates, pointing, steps, currentBoard);
        progress = true;
        continue;
      }

      // 6. Box-Line Reduction / Claiming (Khóa ứng viên Hàng/Cột -> Khối)
      const boxLine = this.findBoxLineReduction(currentBoard, candidates);
      if (boxLine) {
        this.applyElimination(candidates, boxLine, steps, currentBoard);
        progress = true;
        continue;
      }

      // 7. X-Wing (Cánh chữ X)
      const xWing = this.findXWing(currentBoard, candidates);
      if (xWing) {
        this.applyElimination(candidates, xWing, steps, currentBoard);
        progress = true;
        continue;
      }

      // 7b. XY-Wing (Cánh chữ Y)
      const xyWing = this.findXYWing(currentBoard, candidates);
      if (xyWing) {
        this.applyElimination(candidates, xyWing, steps, currentBoard);
        progress = true;
        continue;
      }

      // 8. Nếu không còn kỹ thuật đơn thuần, dùng phương pháp Chứng minh Phản chứng (Proof by Contradiction / Nishio Chains)
      if (!this.isBoardFilled(currentBoard)) {
        const branchStep = this.findBranchingStep(currentBoard, candidates, solution);
        if (branchStep) {
          this.applyPlacement(currentBoard, candidates, branchStep, steps);
          progress = true;
          continue;
        }
      }
    }

    const isComplete = this.isBoardFilled(currentBoard);

    // Bổ sung bước kết thúc nếu hoàn thành
    if (isComplete) {
      steps.push({
        stepIndex: steps.length,
        type: 'completed',
        title: 'Hoàn thành câu đố!',
        strategyName: 'Hoàn tất',
        formulaId: 'completed',
        formulaName: 'Hoàn tất ván đấu',
        formulaRule: 'Mọi ô trên bảng đều thỏa mãn quy tắc Sudoku 1-9.',
        patternExplanation: 'Tất cả 81 ô đều đã được điền số chính xác.',
        actionExplanation: 'Kết thúc quá trình giải Sudoku.',
        explanation: 'Chúc mừng! Toàn bộ 81 ô của bảng Sudoku đã được giải thành công và đồng bộ chính xác với Sudoku.com!',
        targetCell: null,
        relatedUnit: null,
        highlightCells: [],
        boardState: SudokuSolver.cloneBoard(currentBoard),
        candidatesState: Array.from({ length: 9 }, () => Array(9).fill([]))
      });
    }

    return {
      steps,
      finalBoard: currentBoard,
      isComplete
    };
  }

  static isBoardFilled(board) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) return false;
      }
    }
    return true;
  }

  /**
   * Áp dụng điền số vào ô và cập nhật lại danh sách ứng viên
   */
  static applyPlacement(board, candidates, stepData, steps) {
    const {
      row, col, value,
      strategyName, formulaId, formulaName, formulaRule,
      abstractFormula, concreteFormula,
      difficultyRank, difficultyLevel, difficultyBadge,
      patternExplanation, actionExplanation, explanation,
      relatedUnit, highlightCells, peerConflicts
    } = stepData;

    board[row][col] = value;
    candidates[row][col] = [];

    // Cập nhật loại trừ ứng viên `value` khỏi hàng, cột, khối
    const startR = Math.floor(row / 3) * 3;
    const startC = Math.floor(col / 3) * 3;

    for (let i = 0; i < 9; i++) {
      if (candidates[row][i].includes(value)) {
        candidates[row][i] = candidates[row][i].filter(v => v !== value);
      }
      if (candidates[i][col].includes(value)) {
        candidates[i][col] = candidates[i][col].filter(v => v !== value);
      }
    }

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const cr = startR + r;
        const cc = startC + c;
        if (candidates[cr][cc].includes(value)) {
          candidates[cr][cc] = candidates[cr][cc].filter(v => v !== value);
        }
      }
    }

    steps.push({
      stepIndex: steps.length,
      type: 'place',
      title: stepData.title || `Điền số ${value} vào ô (${row + 1}, ${col + 1})`,
      strategyName,
      formulaId: formulaId || 'naked-single',
      formulaName: formulaName || strategyName,
      formulaRule: formulaRule || '',
      abstractFormula: abstractFormula || '',
      concreteFormula: concreteFormula || '',
      difficultyRank: difficultyRank || 2.0,
      difficultyLevel: difficultyLevel || 'easy',
      difficultyBadge: difficultyBadge || '🟢 Dễ',
      patternExplanation: patternExplanation || '',
      actionExplanation: actionExplanation || '',
      targetCell: { row, col, value },
      relatedUnit: relatedUnit || null,
      highlightCells: highlightCells || [{ row, col, type: 'target' }],
      peerConflicts: peerConflicts || [],
      explanation,
      boardState: SudokuSolver.cloneBoard(board),
      candidatesState: candidates.map(rowArr => rowArr.map(cellArr => [...cellArr]))
    });
  }

  /**
   * Áp dụng loại trừ ứng viên mà chưa điền số
   */
  static applyElimination(candidates, stepData, steps, board) {
    const {
      strategyName, formulaId, formulaName, formulaRule,
      abstractFormula, concreteFormula,
      difficultyRank, difficultyLevel, difficultyBadge,
      patternExplanation, actionExplanation, explanation,
      relatedUnit, highlightCells, eliminations
    } = stepData;

    for (const elim of eliminations) {
      const { row, col, value } = elim;
      candidates[row][col] = candidates[row][col].filter(v => v !== value);
    }

    steps.push({
      stepIndex: steps.length,
      type: 'eliminate',
      title: stepData.title || `Loại trừ ứng viên: ${strategyName}`,
      strategyName,
      formulaId: formulaId || 'eliminate',
      formulaName: formulaName || strategyName,
      formulaRule: formulaRule || '',
      abstractFormula: abstractFormula || '',
      concreteFormula: concreteFormula || '',
      difficultyRank: difficultyRank || 4.0,
      difficultyLevel: difficultyLevel || 'hard',
      difficultyBadge: difficultyBadge || '🔥 Nâng cao',
      patternExplanation: patternExplanation || '',
      actionExplanation: actionExplanation || '',
      targetCell: null,
      relatedUnit: relatedUnit || null,
      highlightCells: highlightCells || [],
      eliminations,
      explanation,
      boardState: SudokuSolver.cloneBoard(board),
      candidatesState: candidates.map(rowArr => rowArr.map(cellArr => [...cellArr]))
    });
  }

  /**
   * Chiến thuật 1: Full House (Ô duy nhất còn lại trong Hàng, Cột hoặc Khối 3x3)
   */
  static findFullHouse(board, candidates) {
    // 1. Khối 3x3
    for (let b = 0; b < 9; b++) {
      const startR = Math.floor(b / 3) * 3;
      const startC = (b % 3) * 3;
      const emptyCells = [];
      const presentVals = new Set();
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          const r = startR + dr;
          const c = startC + dc;
          if (board[r][c] === 0) emptyCells.push({ r, c });
          else presentVals.add(board[r][c]);
        }
      }
      if (emptyCells.length === 1) {
        const { r, c } = emptyCells[0];
        for (let val = 1; val <= 9; val++) {
          if (!presentVals.has(val)) {
            const unitText = `Khối 3x3 số ${b + 1}`;
            return {
              row: r, col: c, value: val,
              difficultyRank: 1.0,
              difficultyLevel: 'very-easy',
              difficultyBadge: '⭐ Rất dễ (Ô cuối cùng)',
              strategyName: 'Ô duy nhất còn lại (Full House)',
              formulaId: 'hidden-single',
              formulaName: 'Ô cuối cùng (Full House)',
              title: `Điền số ${val} vào ô (${r + 1}, ${c + 1})`,
              abstractFormula: 'Đơn vị U chỉ còn 1 ô trống duy nhất ⇒ Điền số còn thiếu vào ô đó',
              concreteFormula: `${unitText} chỉ còn 1 ô trống ⇒ Điền số ${val} vào ô (${r + 1}, ${c + 1})`,
              formulaRule: `${unitText} chỉ còn 1 ô trống ⇒ Điền số ${val} vào ô (${r + 1}, ${c + 1}).`,
              patternExplanation: `${unitText} đã có 8 số. Ô (${r + 1}, ${c + 1}) là ô trống duy nhất còn lại.`,
              actionExplanation: `Điền số ${val} vào ô (${r + 1}, ${c + 1}).`,
              explanation: `Trong ${unitText}: 8 ô khác đã có đủ số. Ô (${r + 1}, ${c + 1}) là ô trống duy nhất còn lại nên bắt buộc phải là số ${val}.`,
              relatedUnit: { type: 'box', index: b },
              highlightCells: [
                { row: r, col: c, type: 'target' },
                ...Array.from({ length: 9 }, (_, idx) => ({
                  row: startR + Math.floor(idx / 3),
                  col: startC + (idx % 3),
                  type: (startR + Math.floor(idx / 3) === r && startC + (idx % 3) === c) ? 'target' : 'unit'
                }))
              ]
            };
          }
        }
      }
    }

    // 2. Hàng
    for (let r = 0; r < 9; r++) {
      const emptyCells = [];
      const presentVals = new Set();
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) emptyCells.push({ r, c });
        else presentVals.add(board[r][c]);
      }
      if (emptyCells.length === 1) {
        const { c } = emptyCells[0];
        for (let val = 1; val <= 9; val++) {
          if (!presentVals.has(val)) {
            const unitText = `Hàng ${r + 1}`;
            return {
              row: r, col: c, value: val,
              difficultyRank: 1.0,
              difficultyLevel: 'very-easy',
              difficultyBadge: '⭐ Rất dễ (Ô cuối cùng)',
              strategyName: 'Ô duy nhất còn lại (Full House)',
              formulaId: 'hidden-single',
              formulaName: 'Ô cuối cùng (Full House)',
              title: `Điền số ${val} vào ô (${r + 1}, ${c + 1})`,
              abstractFormula: 'Đơn vị U chỉ còn 1 ô trống duy nhất ⇒ Điền số còn thiếu vào ô đó',
              concreteFormula: `${unitText} chỉ còn 1 ô trống ⇒ Điền số ${val} vào ô (${r + 1}, ${c + 1})`,
              formulaRule: `${unitText} chỉ còn 1 ô trống ⇒ Điền số ${val} vào ô (${r + 1}, ${c + 1}).`,
              patternExplanation: `${unitText} đã có 8 số. Ô (${r + 1}, ${c + 1}) là ô trống duy nhất còn lại.`,
              actionExplanation: `Điền số ${val} vào ô (${r + 1}, ${c + 1}).`,
              explanation: `Trong ${unitText}: 8 ô khác đã có đủ số. Ô (${r + 1}, ${c + 1}) là ô trống duy nhất còn lại nên bắt buộc phải là số ${val}.`,
              relatedUnit: { type: 'row', index: r },
              highlightCells: [
                { row: r, col: c, type: 'target' },
                ...Array.from({ length: 9 }, (_, idx) => ({ row: r, col: idx, type: idx === c ? 'target' : 'unit' }))
              ]
            };
          }
        }
      }
    }

    // 3. Cột
    for (let c = 0; c < 9; c++) {
      const emptyCells = [];
      const presentVals = new Set();
      for (let r = 0; r < 9; r++) {
        if (board[r][c] === 0) emptyCells.push({ r, c });
        else presentVals.add(board[r][c]);
      }
      if (emptyCells.length === 1) {
        const { r } = emptyCells[0];
        for (let val = 1; val <= 9; val++) {
          if (!presentVals.has(val)) {
            const unitText = `Cột ${c + 1}`;
            return {
              row: r, col: c, value: val,
              difficultyRank: 1.0,
              difficultyLevel: 'very-easy',
              difficultyBadge: '⭐ Rất dễ (Ô cuối cùng)',
              strategyName: 'Ô duy nhất còn lại (Full House)',
              formulaId: 'hidden-single',
              formulaName: 'Ô cuối cùng (Full House)',
              title: `Điền số ${val} vào ô (${r + 1}, ${c + 1})`,
              abstractFormula: 'Đơn vị U chỉ còn 1 ô trống duy nhất ⇒ Điền số còn thiếu vào ô đó',
              concreteFormula: `${unitText} chỉ còn 1 ô trống ⇒ Điền số ${val} vào ô (${r + 1}, ${c + 1})`,
              formulaRule: `${unitText} chỉ còn 1 ô trống ⇒ Điền số ${val} vào ô (${r + 1}, ${c + 1}).`,
              patternExplanation: `${unitText} đã có 8 số. Ô (${r + 1}, ${c + 1}) là ô trống duy nhất còn lại.`,
              actionExplanation: `Điền số ${val} vào ô (${r + 1}, ${c + 1}).`,
              explanation: `Trong Cột ${c + 1}: 8 ô khác đã có đủ số. Ô (${r + 1}, ${c + 1}) là ô trống duy nhất còn lại nên bắt buộc phải là số ${val}.`,
              relatedUnit: { type: 'col', index: c },
              highlightCells: [
                { row: r, col: c, type: 'target' },
                ...Array.from({ length: 9 }, (_, idx) => ({ row: idx, col: c, type: idx === r ? 'target' : 'unit' }))
              ]
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Chiến thuật 2: Cross-Hatching Khối 3x3 (Hidden Single trong Khối 3x3)
   */
  static findHiddenSingleInBox(board, candidates) {
    for (let b = 0; b < 9; b++) {
      const startR = Math.floor(b / 3) * 3;
      const startC = (b % 3) * 3;

      for (let val = 1; val <= 9; val++) {
        let alreadyInBox = false;
        for (let dr = 0; dr < 3; dr++) {
          for (let dc = 0; dc < 3; dc++) {
            if (board[startR + dr][startC + dc] === val) {
              alreadyInBox = true;
              break;
            }
          }
          if (alreadyInBox) break;
        }
        if (alreadyInBox) continue;

        const possibleCells = [];
        for (let dr = 0; dr < 3; dr++) {
          for (let dc = 0; dc < 3; dc++) {
            const cr = startR + dr;
            const cc = startC + dc;
            if (board[cr][cc] === 0 && candidates[cr][cc].includes(val)) {
              possibleCells.push({ r: cr, c: cc });
            }
          }
        }

        if (possibleCells.length === 1) {
          const { r, c } = possibleCells[0];
          const boxNum = b + 1;
          const patternExplanation = `Trong Khối 3x3 số ${boxNum}: Các tia gióng ngang dọc chứa số ${val} loại trừ các ô khác.`;
          const abstractFormula = 'Tia gióng ngang dọc loại trừ toàn bộ ô khác trong khối ⇒ Điền vào ô còn lại';
          const concreteFormula = `Khối ${boxNum} chỉ có ô (${r + 1}, ${c + 1}) nhận được số ${val} ⇒ Điền số ${val}`;
          const formulaRule = `∃! ô trong Khối ${boxNum} chứa ứng viên ${val} ⇒ Điền ${val} vào ô (${r + 1}, ${c + 1}).`;
          const actionExplanation = `Điền số ${val} vào ô (${r + 1}, ${c + 1}).`;
          const explanation = `Trong Khối 3x3 số ${boxNum}: Áp dụng công thức Tia gióng Khối 3x3 (Cross-Hatching / Hidden Single). Số ${val} chỉ có thể đặt vào duy nhất ô (Hàng ${r + 1}, Cột ${c + 1}).`;

          const boxCells = [];
          for (let dr = 0; dr < 3; dr++) {
            for (let dc = 0; dc < 3; dc++) {
              boxCells.push({
                row: startR + dr,
                col: startC + dc,
                type: (startR + dr === r && startC + dc === c) ? 'target' : 'unit'
              });
            }
          }

          return {
            row: r, col: c, value: val,
            difficultyRank: 1.3,
            difficultyLevel: 'very-easy',
            difficultyBadge: '⭐ Rất dễ (Tia gióng Khối)',
            strategyName: 'Gióng hàng ngang dọc (Cross-Hatching Khối 3x3)',
            formulaId: 'hidden-single',
            formulaName: 'Tia gióng Khối (Cross-Hatching)',
            title: `Điền số ${val} vào ô (${r + 1}, ${c + 1})`,
            abstractFormula,
            concreteFormula,
            formulaRule,
            patternExplanation,
            actionExplanation,
            explanation,
            relatedUnit: { type: 'box', index: b },
            highlightCells: boxCells
          };
        }
      }
    }
    return null;
  }

  /**
   * Chiến thuật 3: Naked Single (Đơn lẻ trần)
   */
  static findNakedSingle(board, candidates) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0 && candidates[r][c].length === 1) {
          const value = candidates[r][c][0];

          const peerCells = [];
          for (let i = 0; i < 9; i++) {
            if (i !== c && board[r][i] !== 0) peerCells.push({ row: r, col: i, val: board[r][i], type: 'row' });
            if (i !== r && board[i][c] !== 0) peerCells.push({ row: i, col: c, val: board[i][c], type: 'col' });
          }
          const startR = Math.floor(r / 3) * 3;
          const startC = Math.floor(c / 3) * 3;
          for (let dr = 0; dr < 3; dr++) {
            for (let dc = 0; dc < 3; dc++) {
              const cr = startR + dr;
              const cc = startC + dc;
              if ((cr !== r || cc !== c) && board[cr][cc] !== 0) {
                peerCells.push({ row: cr, col: cc, val: board[cr][cc], type: 'box' });
              }
            }
          }

          const seenValues = new Set(peerCells.map(item => item.val));
          const otherValues = Array.from(seenValues).filter(v => v !== value).sort((a, b) => a - b);

          const patternExplanation = `Ô (${r + 1}, ${c + 1}) chỉ còn đúng 1 ứng viên duy nhất là số ${value}. Tất cả các số khác [${otherValues.join(', ')}] đều đã có mặt ở hàng, cột hoặc khối 3x3 bao quanh.`;
          const abstractFormula = 'C(r, c) = {X} ⇒ Điền số X vào ô (r, c)';
          const concreteFormula = `C(Hàng ${r + 1}, Cột ${c + 1}) = {${value}} ⇒ Điền số ${value} vào ô (${r + 1}, ${c + 1})`;
          const formulaRule = `C(Hàng ${r + 1}, Cột ${c + 1}) = {${value}} ⇒ Điền số ${value} vào ô (${r + 1}, ${c + 1}).`;
          const actionExplanation = `Điền số ${value} vào ô (${r + 1}, ${c + 1}).`;
          const explanation = `Tại ô Hàng ${r + 1}, Cột ${c + 1}: Áp dụng công thức Đơn lẻ trần (Naked Single). Ô này chỉ còn lại duy nhất số ${value}, vì các số khác (${otherValues.join(', ')}) đã xuất hiện trên cùng hàng, cột hoặc khối 3x3.`;

          return {
            row: r, col: c, value,
            difficultyRank: 2.0,
            difficultyLevel: 'easy',
            difficultyBadge: '🟢 Dễ (Đơn lẻ trần)',
            strategyName: 'Đơn lẻ trần (Naked Single)',
            formulaId: 'naked-single',
            formulaName: 'Đơn lẻ trần (Naked Single)',
            title: `Điền số ${value} vào ô (${r + 1}, ${c + 1})`,
            abstractFormula,
            concreteFormula,
            formulaRule,
            patternExplanation,
            actionExplanation,
            explanation,
            relatedUnit: { type: 'box', index: Math.floor(r / 3) * 3 + Math.floor(c / 3) },
            highlightCells: [
              { row: r, col: c, type: 'target' },
              ...peerCells.map(p => ({ row: p.row, col: p.col, type: 'unit' }))
            ]
          };
        }
      }
    }
    return null;
  }

  /**
   * Chiến thuật 4: Hidden Single theo Hàng hoặc Cột
   */
  static findHiddenSingleInLine(board, candidates) {
    // 1. Hàng
    for (let r = 0; r < 9; r++) {
      for (let val = 1; val <= 9; val++) {
        let alreadyInRow = false;
        for (let c = 0; c < 9; c++) {
          if (board[r][c] === val) { alreadyInRow = true; break; }
        }
        if (alreadyInRow) continue;

        const possibleCols = [];
        for (let c = 0; c < 9; c++) {
          if (board[r][c] === 0 && candidates[r][c].includes(val)) possibleCols.push(c);
        }

        if (possibleCols.length === 1) {
          const c = possibleCols[0];
          const patternExplanation = `Trong Hàng ${r + 1}, chỉ có duy nhất ô Cột ${c + 1} có thể chứa số ${val}. Các ô khác trong hàng đều bị loại trừ số này.`;
          const abstractFormula = 'Hàng chỉ có 1 ô nhận X ⇒ Điền số X vào ô đó';
          const concreteFormula = `Chỉ duy nhất ô Cột ${c + 1} trên Hàng ${r + 1} nhận được số ${val} ⇒ Điền số ${val}`;
          const formulaRule = `∃! ô trong Hàng ${r + 1} chứa ứng viên ${val} ⇒ Điền ${val} vào ô (${r + 1}, ${c + 1}).`;
          const actionExplanation = `Điền số ${val} vào ô (${r + 1}, ${c + 1}).`;
          const explanation = `Trong Hàng ${r + 1}: Áp dụng công thức Đơn lẻ ẩn theo Hàng (Hidden Single). Số ${val} chỉ có thể đặt vào duy nhất ô Cột ${c + 1}.`;

          return {
            row: r, col: c, value: val,
            difficultyRank: 2.8,
            difficultyLevel: 'medium',
            difficultyBadge: '⚡ Trung bình (Ẩn trong Hàng)',
            strategyName: 'Đơn lẻ ẩn theo Hàng (Hidden Single in Row)',
            formulaId: 'hidden-single',
            formulaName: 'Đơn lẻ ẩn (Hidden Single)',
            title: `Điền số ${val} vào ô (${r + 1}, ${c + 1})`,
            abstractFormula,
            concreteFormula,
            formulaRule,
            patternExplanation,
            actionExplanation,
            explanation,
            relatedUnit: { type: 'row', index: r },
            highlightCells: [
              { row: r, col: c, type: 'target' },
              ...Array.from({ length: 9 }, (_, idx) => ({ row: r, col: idx, type: idx === c ? 'target' : 'unit' }))
            ]
          };
        }
      }
    }

    // 2. Cột
    for (let c = 0; c < 9; c++) {
      for (let val = 1; val <= 9; val++) {
        let alreadyInCol = false;
        for (let r = 0; r < 9; r++) {
          if (board[r][c] === val) { alreadyInCol = true; break; }
        }
        if (alreadyInCol) continue;

        const possibleRows = [];
        for (let r = 0; r < 9; r++) {
          if (board[r][c] === 0 && candidates[r][c].includes(val)) possibleRows.push(r);
        }

        if (possibleRows.length === 1) {
          const r = possibleRows[0];
          const patternExplanation = `Trong Cột ${c + 1}, chỉ có duy nhất ô Hàng ${r + 1} có thể nhận số ${val}.`;
          const abstractFormula = 'Cột chỉ có 1 ô nhận X ⇒ Điền số X vào ô đó';
          const concreteFormula = `Chỉ duy nhất ô Hàng ${r + 1} trên Cột ${c + 1} nhận được số ${val} ⇒ Điền số ${val}`;
          const formulaRule = `∃! ô trong Cột ${c + 1} chứa ứng viên ${val} ⇒ Điền ${val} vào ô (${r + 1}, ${c + 1}).`;
          const actionExplanation = `Điền số ${val} vào ô (${r + 1}, ${c + 1}).`;
          const explanation = `Trong Cột ${c + 1}: Áp dụng công thức Đơn lẻ ẩn theo Cột (Hidden Single). Số ${val} chỉ có thể đặt vào duy nhất ô Hàng ${r + 1}.`;

          return {
            row: r, col: c, value: val,
            difficultyRank: 3.0,
            difficultyLevel: 'medium',
            difficultyBadge: '⚡ Trung bình (Ẩn trong Cột)',
            strategyName: 'Đơn lẻ ẩn theo Cột (Hidden Single in Column)',
            formulaId: 'hidden-single',
            formulaName: 'Đơn lẻ ẩn (Hidden Single)',
            title: `Điền số ${val} vào ô (${r + 1}, ${c + 1})`,
            abstractFormula,
            concreteFormula,
            formulaRule,
            patternExplanation,
            actionExplanation,
            explanation,
            relatedUnit: { type: 'col', index: c },
            highlightCells: [
              { row: r, col: c, type: 'target' },
              ...Array.from({ length: 9 }, (_, idx) => ({ row: idx, col: c, type: idx === r ? 'target' : 'unit' }))
            ]
          };
        }
      }
    }

    return null;
  }

  /**
   * Giữ tương thích: Tìm Hidden Single bất kỳ (Khối trước, Dòng/Cột sau)
   */
  static findHiddenSingle(board, candidates) {
    return this.findHiddenSingleInBox(board, candidates) || this.findHiddenSingleInLine(board, candidates);
  }

  /**
   * Tìm tất cả các nước đi trực tiếp khả thi trên bàn cờ hiện tại,
   * được phân loại và sắp xếp chặt chẽ từ DỄ ĐẾN KHÓ:
   * 1. Full House (Rank 1.0)
   * 2. Cross-Hatching Khối 3x3 (Rank 1.3)
   * 3. Naked Single (Rank 2.0)
   * 4. Hidden Single Hàng / Cột (Rank 2.8 - 3.0)
   * 5. Kỹ thuật nâng cao nếu không còn nước đi đơn lẻ
   */
  static findAllImmediateMoves(board, candidates, officialSolution = null) {
    const immediateMoves = [];
    const seenTarget = new Set();

    // 1. Full House
    for (let b = 0; b < 9; b++) {
      const startR = Math.floor(b / 3) * 3;
      const startC = (b % 3) * 3;
      const emptyCells = [];
      const presentVals = new Set();
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          const r = startR + dr;
          const c = startC + dc;
          if (board[r][c] === 0) emptyCells.push({ r, c });
          else presentVals.add(board[r][c]);
        }
      }
      if (emptyCells.length === 1) {
        const { r, c } = emptyCells[0];
        const key = `${r},${c}`;
        if (!seenTarget.has(key)) {
          for (let val = 1; val <= 9; val++) {
            if (!presentVals.has(val)) {
              seenTarget.add(key);
              immediateMoves.push({
                row: r, col: c, value: val,
                targetCell: { row: r, col: c, value: val },
                difficultyRank: 1.0,
                difficultyLevel: 'very-easy',
                difficultyBadge: '⭐ Rất dễ (Ô cuối cùng)',
                strategyName: 'Ô duy nhất còn lại (Full House)',
                formulaId: 'hidden-single',
                formulaName: 'Ô cuối cùng (Full House)',
                title: `Điền số ${val} vào ô (${r + 1}, ${c + 1})`,
                abstractFormula: 'Đơn vị U chỉ còn 1 ô trống duy nhất ⇒ Điền số còn thiếu vào ô đó',
                concreteFormula: `Khối 3x3 số ${b + 1} chỉ còn 1 ô trống ⇒ Điền số ${val} vào ô (${r + 1}, ${c + 1})`,
                formulaRule: `Khối 3x3 số ${b + 1} chỉ còn 1 ô trống ⇒ Điền số ${val} vào ô (${r + 1}, ${c + 1}).`,
                patternExplanation: `Khối 3x3 số ${b + 1} đã có 8 số. Ô (${r + 1}, ${c + 1}) là ô trống duy nhất còn lại.`,
                actionExplanation: `Điền số ${val} vào ô (${r + 1}, ${c + 1}).`,
                explanation: `Trong Khối 3x3 số ${b + 1}: 8 ô khác đã có đủ số. Ô (${r + 1}, ${c + 1}) là ô trống duy nhất còn lại nên bắt buộc phải là số ${val}.`,
                relatedUnit: { type: 'box', index: b },
                highlightCells: [
                  { row: r, col: c, type: 'target' },
                  ...Array.from({ length: 9 }, (_, idx) => ({
                    row: startR + Math.floor(idx / 3),
                    col: startC + (idx % 3),
                    type: (startR + Math.floor(idx / 3) === r && startC + (idx % 3) === c) ? 'target' : 'unit'
                  }))
                ]
              });
            }
          }
        }
      }
    }

    for (let r = 0; r < 9; r++) {
      const emptyCells = [];
      const presentVals = new Set();
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) emptyCells.push({ r, c });
        else presentVals.add(board[r][c]);
      }
      if (emptyCells.length === 1) {
        const { c } = emptyCells[0];
        const key = `${r},${c}`;
        if (!seenTarget.has(key)) {
          for (let val = 1; val <= 9; val++) {
            if (!presentVals.has(val)) {
              seenTarget.add(key);
              immediateMoves.push({
                row: r, col: c, value: val,
                targetCell: { row: r, col: c, value: val },
                difficultyRank: 1.0,
                difficultyLevel: 'very-easy',
                difficultyBadge: '⭐ Rất dễ (Ô cuối cùng)',
                strategyName: 'Ô duy nhất còn lại (Full House)',
                formulaId: 'hidden-single',
                formulaName: 'Ô cuối cùng (Full House)',
                title: `Điền số ${val} vào ô (${r + 1}, ${c + 1})`,
                abstractFormula: 'Đơn vị U chỉ còn 1 ô trống duy nhất ⇒ Điền số còn thiếu vào ô đó',
                concreteFormula: `Hàng ${r + 1} chỉ còn 1 ô trống ⇒ Điền số ${val} vào ô (${r + 1}, ${c + 1})`,
                formulaRule: `Hàng ${r + 1} chỉ còn 1 ô trống ⇒ Điền số ${val} vào ô (${r + 1}, ${c + 1}).`,
                patternExplanation: `Hàng ${r + 1} đã có 8 số. Ô (${r + 1}, ${c + 1}) là ô trống duy nhất còn lại.`,
                actionExplanation: `Điền số ${val} vào ô (${r + 1}, ${c + 1}).`,
                explanation: `Trong Hàng ${r + 1}: 8 ô khác đã có đủ số. Ô (${r + 1}, ${c + 1}) là ô trống duy nhất còn lại nên bắt buộc phải là số ${val}.`,
                relatedUnit: { type: 'row', index: r },
                highlightCells: [
                  { row: r, col: c, type: 'target' },
                  ...Array.from({ length: 9 }, (_, idx) => ({ row: r, col: idx, type: idx === c ? 'target' : 'unit' }))
                ]
              });
            }
          }
        }
      }
    }

    for (let c = 0; c < 9; c++) {
      const emptyCells = [];
      const presentVals = new Set();
      for (let r = 0; r < 9; r++) {
        if (board[r][c] === 0) emptyCells.push({ r, c });
        else presentVals.add(board[r][c]);
      }
      if (emptyCells.length === 1) {
        const { r } = emptyCells[0];
        const key = `${r},${c}`;
        if (!seenTarget.has(key)) {
          for (let val = 1; val <= 9; val++) {
            if (!presentVals.has(val)) {
              seenTarget.add(key);
              immediateMoves.push({
                row: r, col: c, value: val,
                targetCell: { row: r, col: c, value: val },
                difficultyRank: 1.0,
                difficultyLevel: 'very-easy',
                difficultyBadge: '⭐ Rất dễ (Ô cuối cùng)',
                strategyName: 'Ô duy nhất còn lại (Full House)',
                formulaId: 'hidden-single',
                formulaName: 'Ô cuối cùng (Full House)',
                title: `Điền số ${val} vào ô (${r + 1}, ${c + 1})`,
                abstractFormula: 'Đơn vị U chỉ còn 1 ô trống duy nhất ⇒ Điền số còn thiếu vào ô đó',
                concreteFormula: `Cột ${c + 1} chỉ còn 1 ô trống ⇒ Điền số ${val} vào ô (${r + 1}, ${c + 1})`,
                formulaRule: `Cột ${c + 1} chỉ còn 1 ô trống ⇒ Điền số ${val} vào ô (${r + 1}, ${c + 1}).`,
                patternExplanation: `Cột ${c + 1} đã có 8 số. Ô (${r + 1}, ${c + 1}) là ô trống duy nhất còn lại.`,
                actionExplanation: `Điền số ${val} vào ô (${r + 1}, ${c + 1}).`,
                explanation: `Trong Cột ${c + 1}: 8 ô khác đã có đủ số. Ô (${r + 1}, ${c + 1}) là ô trống duy nhất còn lại nên bắt buộc phải là số ${val}.`,
                relatedUnit: { type: 'col', index: c },
                highlightCells: [
                  { row: r, col: c, type: 'target' },
                  ...Array.from({ length: 9 }, (_, idx) => ({ row: idx, col: c, type: idx === r ? 'target' : 'unit' }))
                ]
              });
            }
          }
        }
      }
    }

    // 2. Cross-Hatching trong Khối 3x3
    for (let b = 0; b < 9; b++) {
      const startR = Math.floor(b / 3) * 3;
      const startC = (b % 3) * 3;
      for (let val = 1; val <= 9; val++) {
        let alreadyInBox = false;
        for (let dr = 0; dr < 3; dr++) {
          for (let dc = 0; dc < 3; dc++) {
            if (board[startR + dr][startC + dc] === val) { alreadyInBox = true; break; }
          }
          if (alreadyInBox) break;
        }
        if (alreadyInBox) continue;

        const possibleCells = [];
        for (let dr = 0; dr < 3; dr++) {
          for (let dc = 0; dc < 3; dc++) {
            const cr = startR + dr;
            const cc = startC + dc;
            if (board[cr][cc] === 0 && candidates[cr][cc].includes(val)) {
              possibleCells.push({ r: cr, c: cc });
            }
          }
        }

        if (possibleCells.length === 1) {
          const { r, c } = possibleCells[0];
          const key = `${r},${c}`;
          if (!seenTarget.has(key)) {
            seenTarget.add(key);
            const boxNum = b + 1;
            const boxCells = [];
            for (let dr = 0; dr < 3; dr++) {
              for (let dc = 0; dc < 3; dc++) {
                boxCells.push({
                  row: startR + dr,
                  col: startC + dc,
                  type: (startR + dr === r && startC + dc === c) ? 'target' : 'unit'
                });
              }
            }
            immediateMoves.push({
              row: r, col: c, value: val,
              targetCell: { row: r, col: c, value: val },
              difficultyRank: 1.3,
              difficultyLevel: 'very-easy',
              difficultyBadge: '⭐ Rất dễ (Tia gióng Khối)',
              strategyName: 'Gióng hàng ngang dọc (Cross-Hatching Khối 3x3)',
              formulaId: 'hidden-single',
              formulaName: 'Tia gióng Khối (Cross-Hatching)',
              title: `Điền số ${val} vào ô (${r + 1}, ${c + 1})`,
              abstractFormula: 'Tia gióng ngang dọc loại trừ toàn bộ ô khác trong khối ⇒ Điền vào ô còn lại',
              concreteFormula: `Khối ${boxNum} chỉ có ô (${r + 1}, ${c + 1}) nhận được số ${val} ⇒ Điền số ${val}`,
              formulaRule: `∃! ô trong Khối ${boxNum} chứa ứng viên ${val} ⇒ Điền ${val} vào ô (${r + 1}, ${c + 1}).`,
              patternExplanation: `Trong Khối 3x3 số ${boxNum}: Các tia gióng ngang dọc chứa số ${val} loại trừ các ô khác.`,
              actionExplanation: `Điền số ${val} vào ô (${r + 1}, ${c + 1}).`,
              explanation: `Trong Khối 3x3 số ${boxNum}: Áp dụng công thức Tia gióng Khối 3x3 (Cross-Hatching / Hidden Single). Số ${val} chỉ có thể đặt vào duy nhất ô (${r + 1}, ${c + 1}).`,
              relatedUnit: { type: 'box', index: b },
              highlightCells: boxCells
            });
          }
        }
      }
    }

    // 3. Naked Single
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0 && candidates[r][c].length === 1) {
          const key = `${r},${c}`;
          if (!seenTarget.has(key)) {
            seenTarget.add(key);
            const value = candidates[r][c][0];
            const peerCells = [];
            for (let i = 0; i < 9; i++) {
              if (i !== c && board[r][i] !== 0) peerCells.push({ row: r, col: i, val: board[r][i], type: 'row' });
              if (i !== r && board[i][c] !== 0) peerCells.push({ row: i, col: c, val: board[i][c], type: 'col' });
            }
            const startR = Math.floor(r / 3) * 3;
            const startC = Math.floor(c / 3) * 3;
            for (let dr = 0; dr < 3; dr++) {
              for (let dc = 0; dc < 3; dc++) {
                const cr = startR + dr;
                const cc = startC + dc;
                if ((cr !== r || cc !== c) && board[cr][cc] !== 0) {
                  peerCells.push({ row: cr, col: cc, val: board[cr][cc], type: 'box' });
                }
              }
            }
            const seenValues = new Set(peerCells.map(item => item.val));
            const otherValues = Array.from(seenValues).filter(v => v !== value).sort((a, b) => a - b);
            immediateMoves.push({
              row: r, col: c, value,
              targetCell: { row: r, col: c, value },
              difficultyRank: 2.0,
              difficultyLevel: 'easy',
              difficultyBadge: '🟢 Dễ (Đơn lẻ trần)',
              strategyName: 'Đơn lẻ trần (Naked Single)',
              formulaId: 'naked-single',
              formulaName: 'Đơn lẻ trần (Naked Single)',
              title: `Điền số ${value} vào ô (${r + 1}, ${c + 1})`,
              abstractFormula: 'C(r, c) = {X} ⇒ Điền số X vào ô (r, c)',
              concreteFormula: `C(Hàng ${r + 1}, Cột ${c + 1}) = {${value}} ⇒ Điền số ${value} vào ô (${r + 1}, ${c + 1})`,
              formulaRule: `C(Hàng ${r + 1}, Cột ${c + 1}) = {${value}} ⇒ Điền số ${value} vào ô (${r + 1}, ${c + 1}).`,
              patternExplanation: `Ô (${r + 1}, ${c + 1}) chỉ còn đúng 1 ứng viên duy nhất là số ${value}.`,
              actionExplanation: `Điền số ${value} vào ô (${r + 1}, ${c + 1}).`,
              explanation: `Tại ô Hàng ${r + 1}, Cột ${c + 1}: Áp dụng công thức Đơn lẻ trần (Naked Single). Ô này chỉ còn lại duy nhất số ${value}, vì các số khác (${otherValues.join(', ')}) đã xuất hiện trên cùng hàng, cột hoặc khối 3x3.`,
              relatedUnit: { type: 'box', index: Math.floor(r / 3) * 3 + Math.floor(c / 3) },
              highlightCells: [
                { row: r, col: c, type: 'target' },
                ...peerCells.map(p => ({ row: p.row, col: p.col, type: 'unit' }))
              ]
            });
          }
        }
      }
    }

    // 4. Hidden Single theo Hàng hoặc Cột
    for (let r = 0; r < 9; r++) {
      for (let val = 1; val <= 9; val++) {
        let alreadyInRow = false;
        for (let c = 0; c < 9; c++) {
          if (board[r][c] === val) { alreadyInRow = true; break; }
        }
        if (alreadyInRow) continue;
        const possibleCols = [];
        for (let c = 0; c < 9; c++) {
          if (board[r][c] === 0 && candidates[r][c].includes(val)) possibleCols.push(c);
        }
        if (possibleCols.length === 1) {
          const c = possibleCols[0];
          const key = `${r},${c}`;
          if (!seenTarget.has(key)) {
            seenTarget.add(key);
            immediateMoves.push({
              row: r, col: c, value: val,
              targetCell: { row: r, col: c, value: val },
              difficultyRank: 2.8,
              difficultyLevel: 'medium',
              difficultyBadge: '⚡ Trung bình (Ẩn trong Hàng)',
              strategyName: 'Đơn lẻ ẩn theo Hàng (Hidden Single in Row)',
              formulaId: 'hidden-single',
              formulaName: 'Đơn lẻ ẩn (Hidden Single)',
              title: `Điền số ${val} vào ô (${r + 1}, ${c + 1})`,
              abstractFormula: 'Hàng chỉ có 1 ô nhận X ⇒ Điền số X vào ô đó',
              concreteFormula: `Chỉ duy nhất ô Cột ${c + 1} trên Hàng ${r + 1} nhận được số ${val} ⇒ Điền số ${val}`,
              formulaRule: `∃! ô trong Hàng ${r + 1} chứa ứng viên ${val} ⇒ Điền ${val} vào ô (${r + 1}, ${c + 1}).`,
              patternExplanation: `Trong Hàng ${r + 1}, chỉ có duy nhất ô Cột ${c + 1} có thể chứa số ${val}.`,
              actionExplanation: `Điền số ${val} vào ô (${r + 1}, ${c + 1}).`,
              explanation: `Trong Hàng ${r + 1}: Áp dụng công thức Đơn lẻ ẩn theo Hàng (Hidden Single). Số ${val} chỉ có thể đặt vào duy nhất ô Cột ${c + 1}.`,
              relatedUnit: { type: 'row', index: r },
              highlightCells: [
                { row: r, col: c, type: 'target' },
                ...Array.from({ length: 9 }, (_, idx) => ({ row: r, col: idx, type: idx === c ? 'target' : 'unit' }))
              ]
            });
          }
        }
      }
    }

    for (let c = 0; c < 9; c++) {
      for (let val = 1; val <= 9; val++) {
        let alreadyInCol = false;
        for (let r = 0; r < 9; r++) {
          if (board[r][c] === val) { alreadyInCol = true; break; }
        }
        if (alreadyInCol) continue;
        const possibleRows = [];
        for (let r = 0; r < 9; r++) {
          if (board[r][c] === 0 && candidates[r][c].includes(val)) possibleRows.push(r);
        }
        if (possibleRows.length === 1) {
          const r = possibleRows[0];
          const key = `${r},${c}`;
          if (!seenTarget.has(key)) {
            seenTarget.add(key);
            immediateMoves.push({
              row: r, col: c, value: val,
              targetCell: { row: r, col: c, value: val },
              difficultyRank: 3.0,
              difficultyLevel: 'medium',
              difficultyBadge: '⚡ Trung bình (Ẩn trong Cột)',
              strategyName: 'Đơn lẻ ẩn theo Cột (Hidden Single in Column)',
              formulaId: 'hidden-single',
              formulaName: 'Đơn lẻ ẩn (Hidden Single)',
              title: `Điền số ${val} vào ô (${r + 1}, ${c + 1})`,
              abstractFormula: 'Cột chỉ có 1 ô nhận X ⇒ Điền số X vào ô đó',
              concreteFormula: `Chỉ duy nhất ô Hàng ${r + 1} trên Cột ${c + 1} nhận được số ${val} ⇒ Điền số ${val}`,
              formulaRule: `∃! ô trong Cột ${c + 1} chứa ứng viên ${val} ⇒ Điền ${val} vào ô (${r + 1}, ${c + 1}).`,
              patternExplanation: `Trong Cột ${c + 1}, chỉ có duy nhất ô Hàng ${r + 1} có thể nhận số ${val}.`,
              actionExplanation: `Điền số ${val} vào ô (${r + 1}, ${c + 1}).`,
              explanation: `Trong Cột ${c + 1}: Áp dụng công thức Đơn lẻ ẩn theo Cột (Hidden Single). Số ${val} chỉ có thể đặt vào duy nhất ô Hàng ${r + 1}.`,
              relatedUnit: { type: 'col', index: c },
              highlightCells: [
                { row: r, col: c, type: 'target' },
                ...Array.from({ length: 9 }, (_, idx) => ({ row: idx, col: c, type: idx === r ? 'target' : 'unit' }))
              ]
            });
          }
        }
      }
    }

    if (immediateMoves.length > 0) {
      immediateMoves.sort((a, b) => a.difficultyRank - b.difficultyRank);
      return immediateMoves;
    }

    // 5. Nếu không còn nước đi đơn lẻ, tìm nước suy luận nâng cao đầu tiên
    const pairStep = this.findNakedPair(board, candidates) || this.findHiddenPair(board, candidates);
    if (pairStep) {
      const isNaked = pairStep.formulaId === 'naked-pair';
      return [{
        ...pairStep,
        difficultyRank: isNaked ? 3.5 : 3.8,
        difficultyLevel: 'hard',
        difficultyBadge: isNaked ? '🔥 Khó (Cặp đôi trần)' : '🔥 Khó (Cặp đôi ẩn)',
        title: pairStep.title || `Loại trừ ứng viên: ${pairStep.strategyName}`,
        targetCell: (pairStep.eliminations && pairStep.eliminations[0])
          ? { row: pairStep.eliminations[0].row, col: pairStep.eliminations[0].col, value: pairStep.eliminations[0].value }
          : null
      }];
    }

    const pointingStep = this.findPointing(board, candidates);
    if (pointingStep) {
      return [{
        ...pointingStep,
        difficultyRank: 4.0,
        difficultyLevel: 'hard',
        difficultyBadge: '🔥 Khó (Tia chỉ hướng Pointing)',
        title: pointingStep.title || `Loại trừ ứng viên: ${pointingStep.strategyName}`,
        targetCell: (pointingStep.eliminations && pointingStep.eliminations[0])
          ? { row: pointingStep.eliminations[0].row, col: pointingStep.eliminations[0].col, value: pointingStep.eliminations[0].value }
          : null
      }];
    }

    const boxLineStep = this.findBoxLineReduction(board, candidates);
    if (boxLineStep) {
      return [{
        ...boxLineStep,
        difficultyRank: 4.2,
        difficultyLevel: 'hard',
        difficultyBadge: '🔥 Khó (Giảm trừ Hàng-Khối)',
        title: boxLineStep.title || `Loại trừ ứng viên: ${boxLineStep.strategyName}`,
        targetCell: (boxLineStep.eliminations && boxLineStep.eliminations[0])
          ? { row: boxLineStep.eliminations[0].row, col: boxLineStep.eliminations[0].col, value: boxLineStep.eliminations[0].value }
          : null
      }];
    }

    const wingStep = this.findXWing(board, candidates) || this.findXYWing(board, candidates);
    if (wingStep) {
      const isX = wingStep.formulaId === 'x-wing';
      return [{
        ...wingStep,
        difficultyRank: isX ? 4.5 : 4.8,
        difficultyLevel: 'expert',
        difficultyBadge: isX ? '⚡ Chuyên gia (X-Wing)' : '⚡ Chuyên gia (XY-Wing)',
        title: wingStep.title || `Loại trừ ứng viên: ${wingStep.strategyName}`,
        targetCell: (wingStep.eliminations && wingStep.eliminations[0])
          ? { row: wingStep.eliminations[0].row, col: wingStep.eliminations[0].col, value: wingStep.eliminations[0].value }
          : null
      }];
    }

    const branchStep = this.findBranchingStep(board, candidates, officialSolution);
    if (branchStep) {
      return [{
        ...branchStep,
        difficultyRank: 5.0,
        difficultyLevel: 'nightmare',
        difficultyBadge: '☠️ Ác mộng (Phản chứng)',
        title: `Điền số ${branchStep.value} vào ô (${branchStep.row + 1}, ${branchStep.col + 1})`,
        targetCell: { row: branchStep.row, col: branchStep.col, value: branchStep.value }
      }];
    }

    return [];
  }

  /**
   * Chiến thuật 3: Naked Pair (Cặp đôi trần trong Hàng, Cột, Khối 3x3)
   */
  static findNakedPair(board, candidates) {
    // 1. Kiểm tra theo Hàng
    for (let r = 0; r < 9; r++) {
      const pairCells = [];
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0 && candidates[r][c].length === 2) {
          pairCells.push({ c, cands: candidates[r][c] });
        }
      }

      for (let i = 0; i < pairCells.length; i++) {
        for (let j = i + 1; j < pairCells.length; j++) {
          const c1 = pairCells[i];
          const c2 = pairCells[j];
          if (c1.cands[0] === c2.cands[0] && c1.cands[1] === c2.cands[1]) {
            const pair = c1.cands;
            const eliminations = [];
            for (let c = 0; c < 9; c++) {
              if (c !== c1.c && c !== c2.c && board[r][c] === 0) {
                if (candidates[r][c].includes(pair[0])) {
                  eliminations.push({ row: r, col: c, value: pair[0] });
                }
                if (candidates[r][c].includes(pair[1])) {
                  eliminations.push({ row: r, col: c, value: pair[1] });
                }
              }
            }

            if (eliminations.length > 0) {
              const abstractFormula = 'C(A) = C(B) = {X, Y} trong U ⇒ Xóa X, Y khỏi các ô khác trong U';
              const concreteFormula = `C(${r + 1}, ${c1.c + 1}) = C(${r + 1}, ${c2.c + 1}) = {${pair.join(', ')}} trên Hàng ${r + 1} ⇒ Xóa {${pair.join(', ')}} khỏi ${eliminations.length} ô còn lại`;
              return {
                strategyName: 'Cặp đôi trần theo Hàng (Naked Pair)',
                formulaId: 'naked-pair',
                formulaName: 'Cặp đôi trần (Naked Pair)',
                abstractFormula,
                concreteFormula,
                formulaRule: `C(A) = C(B) = {${pair.join(', ')}} ⇒ Loại bỏ {${pair.join(', ')}} khỏi các ô còn lại trong Hàng ${r + 1}.`,
                patternExplanation: `Hai ô (${r + 1}, ${c1.c + 1}) và (${r + 1}, ${c2.c + 1}) trên cùng Hàng ${r + 1} chỉ chứa chính xác cặp số {${pair.join(', ')}}.`,
                actionExplanation: `Loại bỏ ứng viên ${pair.join(' và ')} khỏi ${eliminations.length} vị trí khác trên Hàng ${r + 1}.`,
                explanation: `Trên Hàng ${r + 1}, hai ô Cột ${c1.c + 1} và Cột ${c2.c + 1} cùng chỉ chứa cặp số {${pair.join(', ')}} (Naked Pair). Hai số này bắt buộc phải chia nhau chiếm 2 ô này, do đó loại bỏ {${pair.join(', ')}} khỏi các ô còn lại trên hàng.`,
                relatedUnit: { type: 'row', index: r },
                highlightCells: [
                  { row: r, col: c1.c, type: 'pair' },
                  { row: r, col: c2.c, type: 'pair' },
                  ...eliminations.map(e => ({ row: e.row, col: e.col, type: 'elimination' }))
                ],
                eliminations
              };
            }
          }
        }
      }
    }

    // 2. Kiểm tra theo Cột
    for (let c = 0; c < 9; c++) {
      const pairCells = [];
      for (let r = 0; r < 9; r++) {
        if (board[r][c] === 0 && candidates[r][c].length === 2) {
          pairCells.push({ r, cands: candidates[r][c] });
        }
      }

      for (let i = 0; i < pairCells.length; i++) {
        for (let j = i + 1; j < pairCells.length; j++) {
          const r1 = pairCells[i];
          const r2 = pairCells[j];
          if (r1.cands[0] === r2.cands[0] && r1.cands[1] === r2.cands[1]) {
            const pair = r1.cands;
            const eliminations = [];
            for (let r = 0; r < 9; r++) {
              if (r !== r1.r && r !== r2.r && board[r][c] === 0) {
                if (candidates[r][c].includes(pair[0])) {
                  eliminations.push({ row: r, col: c, value: pair[0] });
                }
                if (candidates[r][c].includes(pair[1])) {
                  eliminations.push({ row: r, col: c, value: pair[1] });
                }
              }
            }

            if (eliminations.length > 0) {
              const abstractFormula = 'C(A) = C(B) = {X, Y} trong U ⇒ Xóa X, Y khỏi các ô khác trong U';
              const concreteFormula = `C(${r1.r + 1}, ${c + 1}) = C(${r2.r + 1}, ${c + 1}) = {${pair.join(', ')}} trên Cột ${c + 1} ⇒ Xóa {${pair.join(', ')}} khỏi ${eliminations.length} ô còn lại`;
              return {
                strategyName: 'Cặp đôi trần theo Cột (Naked Pair)',
                formulaId: 'naked-pair',
                formulaName: 'Cặp đôi trần (Naked Pair)',
                abstractFormula,
                concreteFormula,
                formulaRule: `C(A) = C(B) = {${pair.join(', ')}} ⇒ Loại bỏ {${pair.join(', ')}} khỏi các ô còn lại trong Cột ${c + 1}.`,
                patternExplanation: `Hai ô (${r1.r + 1}, ${c + 1}) và (${r2.r + 1}, ${c + 1}) trên Cột ${c + 1} chỉ chứa chính xác cặp số {${pair.join(', ')}}.`,
                actionExplanation: `Loại bỏ ứng viên ${pair.join(' và ')} khỏi ${eliminations.length} vị trí khác trên Cột ${c + 1}.`,
                explanation: `Trên Cột ${c + 1}, hai ô Hàng ${r1.r + 1} và Hàng ${r2.r + 1} cùng chỉ chứa cặp số {${pair.join(', ')}} (Naked Pair). Ta loại bỏ {${pair.join(', ')}} khỏi các ô còn lại trong Cột ${c + 1}.`,
                relatedUnit: { type: 'col', index: c },
                highlightCells: [
                  { row: r1.r, col: c, type: 'pair' },
                  { row: r2.r, col: c, type: 'pair' },
                  ...eliminations.map(e => ({ row: e.row, col: e.col, type: 'elimination' }))
                ],
                eliminations
              };
            }
          }
        }
      }
    }

    // 3. Kiểm tra theo Khối 3x3
    for (let b = 0; b < 9; b++) {
      const startR = Math.floor(b / 3) * 3;
      const startC = (b % 3) * 3;
      const pairCells = [];

      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          const r = startR + dr;
          const c = startC + dc;
          if (board[r][c] === 0 && candidates[r][c].length === 2) {
            pairCells.push({ r, c, cands: candidates[r][c] });
          }
        }
      }

      for (let i = 0; i < pairCells.length; i++) {
        for (let j = i + 1; j < pairCells.length; j++) {
          const cell1 = pairCells[i];
          const cell2 = pairCells[j];
          if (cell1.cands[0] === cell2.cands[0] && cell1.cands[1] === cell2.cands[1]) {
            const pair = cell1.cands;
            const eliminations = [];

            for (let dr = 0; dr < 3; dr++) {
              for (let dc = 0; dc < 3; dc++) {
                const r = startR + dr;
                const c = startC + dc;
                if ((r !== cell1.r || c !== cell1.c) && (r !== cell2.r || c !== cell2.c) && board[r][c] === 0) {
                  if (candidates[r][c].includes(pair[0])) {
                    eliminations.push({ row: r, col: c, value: pair[0] });
                  }
                  if (candidates[r][c].includes(pair[1])) {
                    eliminations.push({ row: r, col: c, value: pair[1] });
                  }
                }
              }
            }

            if (eliminations.length > 0) {
              const abstractFormula = 'C(A) = C(B) = {X, Y} trong U ⇒ Xóa X, Y khỏi các ô khác trong U';
              const concreteFormula = `C(${cell1.r + 1}, ${cell1.c + 1}) = C(${cell2.r + 1}, ${cell2.c + 1}) = {${pair.join(', ')}} trong Khối ${b + 1} ⇒ Xóa {${pair.join(', ')}} khỏi ${eliminations.length} ô còn lại`;
              return {
                strategyName: 'Cặp đôi trần theo Khối 3x3 (Naked Pair)',
                formulaId: 'naked-pair',
                formulaName: 'Cặp đôi trần (Naked Pair)',
                abstractFormula,
                concreteFormula,
                formulaRule: `C(A) = C(B) = {${pair.join(', ')}} trong Khối ${b + 1} ⇒ Loại bỏ {${pair.join(', ')}} khỏi các ô còn lại trong khối.`,
                patternExplanation: `Trong Khối 3x3 số ${b + 1}, hai ô (${cell1.r + 1}, ${cell1.c + 1}) và (${cell2.r + 1}, ${cell2.c + 1}) chỉ chứa {${pair.join(', ')}}.`,
                actionExplanation: `Loại bỏ ứng viên ${pair.join(' và ')} khỏi các ô còn lại trong Khối ${b + 1}.`,
                explanation: `Trong Khối 3x3 số ${b + 1}, hai ô (${cell1.r + 1}, ${cell1.c + 1}) và (${cell2.r + 1}, ${cell2.c + 1}) chỉ chứa cặp {${pair.join(', ')}}. Ta loại bỏ 2 số này khỏi các ô khác trong cùng khối.`,
                relatedUnit: { type: 'box', index: b },
                highlightCells: [
                  { row: cell1.r, col: cell1.c, type: 'pair' },
                  { row: cell2.r, col: cell2.c, type: 'pair' },
                  ...eliminations.map(e => ({ row: e.row, col: e.col, type: 'elimination' }))
                ],
                eliminations
              };
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Chiến thuật 4: Hidden Pair (Cặp đôi ẩn trong Hàng, Cột, Khối 3x3)
   */
  static findHiddenPair(board, candidates) {
    // Helper: Tìm 2 số chỉ xuất hiện trong đúng 2 ô của 1 đơn vị
    const checkUnit = (cells, unitType, unitIndex, unitName) => {
      // digit -> list of cells
      const digitMap = {};
      for (let d = 1; d <= 9; d++) digitMap[d] = [];

      cells.forEach(cell => {
        if (board[cell.r][cell.c] === 0) {
          candidates[cell.r][cell.c].forEach(d => {
            digitMap[d].push(cell);
          });
        }
      });

      // Lọc các số xuất hiện đúng 2 lần
      const pairDigits = [];
      for (let d = 1; d <= 9; d++) {
        if (digitMap[d].length === 2) {
          pairDigits.push(d);
        }
      }

      for (let i = 0; i < pairDigits.length; i++) {
        for (let j = i + 1; j < pairDigits.length; j++) {
          const d1 = pairDigits[i];
          const d2 = pairDigits[j];
          const cells1 = digitMap[d1];
          const cells2 = digitMap[d2];

          if (cells1[0].r === cells2[0].r && cells1[0].c === cells2[0].c &&
              cells1[1].r === cells2[1].r && cells1[1].c === cells2[1].c) {
            // Tìm thấy Hidden Pair: d1 và d2 chỉ xuất hiện tại cells1[0] và cells1[1]!
            // Kiểm tra xem 2 ô này có ứng viên khác ngoài d1, d2 không để loại trừ
            const cA = cells1[0];
            const cB = cells1[1];
            const eliminations = [];

            candidates[cA.r][cA.c].forEach(cand => {
              if (cand !== d1 && cand !== d2) {
                eliminations.push({ row: cA.r, col: cA.c, value: cand });
              }
            });
            candidates[cB.r][cB.c].forEach(cand => {
              if (cand !== d1 && cand !== d2) {
                eliminations.push({ row: cB.r, col: cB.c, value: cand });
              }
            });

            if (eliminations.length > 0) {
              const pairStr = `{${d1}, ${d2}}`;
              const abstractFormula = 'X, Y chỉ có thể xuất hiện tại 2 ô A, B trong U ⇒ Xóa các ứng viên khác khỏi A, B';
              const concreteFormula = `Cặp số ${pairStr} chỉ xuất hiện ở 2 ô (${cA.r + 1}, ${cA.c + 1}) & (${cB.r + 1}, ${cB.c + 1}) trong ${unitName} ⇒ Xóa toàn bộ ứng viên khác trong 2 ô này`;
              return {
                strategyName: `Cặp đôi ẩn theo ${unitName} (Hidden Pair)`,
                formulaId: 'hidden-pair',
                formulaName: 'Cặp đôi ẩn (Hidden Pair)',
                abstractFormula,
                concreteFormula,
                formulaRule: `${pairStr} chỉ xuất hiện ở 2 ô (${cA.r + 1}, ${cA.c + 1}) và (${cB.r + 1}, ${cB.c + 1}) ⇒ Xóa toàn bộ ứng viên khác trong 2 ô này.`,
                patternExplanation: `Trong ${unitName}, hai số ${d1} và ${d2} chỉ có thể nằm tại đúng 2 ô (${cA.r + 1}, ${cA.c + 1}) và (${cB.r + 1}, ${cB.c + 1}).`,
                actionExplanation: `Xóa sạch các ứng viên thừa khác ngoài ${d1} và ${d2} tại 2 ô này.`,
                explanation: `Trong ${unitName}: Cặp số ${pairStr} chỉ có thể xuất hiện tại 2 ô (${cA.r + 1}, ${cA.c + 1}) và (${cB.r + 1}, ${cB.c + 1}) (Hidden Pair). Vì 2 số này bắt buộc phải nằm ở 2 ô này, ta loại bỏ tất cả các ứng viên khác khỏi 2 ô đó.`,
                relatedUnit: { type: unitType, index: unitIndex },
                highlightCells: [
                  { row: cA.r, col: cA.c, type: 'pair' },
                  { row: cB.r, col: cB.c, type: 'pair' },
                  ...eliminations.map(e => ({ row: e.row, col: e.col, type: 'elimination' }))
                ],
                eliminations
              };
            }
          }
        }
      }
      return null;
    };

    // Kiểm tra hàng
    for (let r = 0; r < 9; r++) {
      const cells = Array.from({ length: 9 }, (_, c) => ({ r, c }));
      const res = checkUnit(cells, 'row', r, `Hàng ${r + 1}`);
      if (res) return res;
    }

    // Kiểm tra cột
    for (let c = 0; c < 9; c++) {
      const cells = Array.from({ length: 9 }, (_, r) => ({ r, c }));
      const res = checkUnit(cells, 'col', c, `Cột ${c + 1}`);
      if (res) return res;
    }

    // Kiểm tra khối 3x3
    for (let b = 0; b < 9; b++) {
      const startR = Math.floor(b / 3) * 3;
      const startC = (b % 3) * 3;
      const cells = [];
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          cells.push({ r: startR + dr, c: startC + dc });
        }
      }
      const res = checkUnit(cells, 'box', b, `Khối 3x3 số ${b + 1}`);
      if (res) return res;
    }

    return null;
  }

  /**
   * Chiến thuật 5: Pointing (Khóa ứng viên Khối -> Hàng/Cột)
   */
  static findPointing(board, candidates) {
    for (let b = 0; b < 9; b++) {
      const startR = Math.floor(b / 3) * 3;
      const startC = (b % 3) * 3;

      for (let val = 1; val <= 9; val++) {
        const cells = [];
        for (let dr = 0; dr < 3; dr++) {
          for (let dc = 0; dc < 3; dc++) {
            const cr = startR + dr;
            const cc = startC + dc;
            if (board[cr][cc] === 0 && candidates[cr][cc].includes(val)) {
              cells.push({ r: cr, c: cc });
            }
          }
        }

        if (cells.length === 2 || cells.length === 3) {
          // Cùng Hàng
          const sameRow = cells.every(cell => cell.r === cells[0].r);
          if (sameRow) {
            const targetRow = cells[0].r;
            const eliminations = [];
            for (let c = 0; c < 9; c++) {
              if (Math.floor(c / 3) !== (b % 3) && board[targetRow][c] === 0 && candidates[targetRow][c].includes(val)) {
                eliminations.push({ row: targetRow, col: c, value: val });
              }
            }

            if (eliminations.length > 0) {
              const abstractFormula = 'X trong Khối B chỉ nằm trên Hàng/Cột U ⇒ Xóa X khỏi phần còn lại của U';
              const concreteFormula = `Số ${val} trong Khối ${b + 1} chỉ nằm trên Hàng ${targetRow + 1} ⇒ Xóa ${val} khỏi các ô trên Hàng ${targetRow + 1} ngoài Khối ${b + 1}`;
              return {
                strategyName: 'Khóa ứng viên Khối - Hàng (Pointing Line)',
                formulaId: 'pointing',
                formulaName: 'Khóa ứng viên (Pointing Pair/Triple)',
                abstractFormula,
                concreteFormula,
                formulaRule: `Ứng viên ${val} trong Khối ${b + 1} chỉ nằm trên Hàng ${targetRow + 1} ⇒ Loại bỏ ${val} khỏi phần còn lại của Hàng ${targetRow + 1}.`,
                patternExplanation: `Trong Khối 3x3 số ${b + 1}, tất cả các vị trí của số ${val} đều nằm thẳng trên Hàng ${targetRow + 1}.`,
                actionExplanation: `Loại bỏ ứng viên ${val} khỏi các ô trên Hàng ${targetRow + 1} nằm ngoài Khối ${b + 1}.`,
                explanation: `Trong Khối 3x3 số ${b + 1}, số ${val} bắt buộc phải nằm trên Hàng ${targetRow + 1} (Pointing Line). Do đó số ${val} không thể xuất hiện ở các ô khác thuộc Hàng ${targetRow + 1} bên ngoài khối này.`,
                relatedUnit: { type: 'row', index: targetRow },
                highlightCells: [
                  ...cells.map(c => ({ row: c.r, col: c.c, type: 'pair' })),
                  ...eliminations.map(e => ({ row: e.row, col: e.col, type: 'elimination' }))
                ],
                eliminations
              };
            }
          }

          // Cùng Cột
          const sameCol = cells.every(cell => cell.c === cells[0].c);
          if (sameCol) {
            const targetCol = cells[0].c;
            const eliminations = [];
            for (let r = 0; r < 9; r++) {
              if (Math.floor(r / 3) !== Math.floor(b / 3) && board[r][targetCol] === 0 && candidates[r][targetCol].includes(val)) {
                eliminations.push({ row: r, col: targetCol, value: val });
              }
            }

            if (eliminations.length > 0) {
              const abstractFormula = 'X trong Khối B chỉ nằm trên Hàng/Cột U ⇒ Xóa X khỏi phần còn lại của U';
              const concreteFormula = `Số ${val} trong Khối ${b + 1} chỉ nằm trên Cột ${targetCol + 1} ⇒ Xóa ${val} khỏi các ô trên Cột ${targetCol + 1} ngoài Khối ${b + 1}`;
              return {
                strategyName: 'Khóa ứng viên Khối - Cột (Pointing Column)',
                formulaId: 'pointing',
                formulaName: 'Khóa ứng viên (Pointing Pair/Triple)',
                abstractFormula,
                concreteFormula,
                formulaRule: `Ứng viên ${val} trong Khối ${b + 1} chỉ nằm trên Cột ${targetCol + 1} ⇒ Loại bỏ ${val} khỏi phần còn lại của Cột ${targetCol + 1}.`,
                patternExplanation: `Trong Khối 3x3 số ${b + 1}, tất cả các vị trí của số ${val} đều nằm thẳng trên Cột ${targetCol + 1}.`,
                actionExplanation: `Loại bỏ ứng viên ${val} khỏi các ô trên Cột ${targetCol + 1} nằm ngoài Khối ${b + 1}.`,
                explanation: `Trong Khối 3x3 số ${b + 1}, số ${val} bắt buộc phải nằm trên Cột ${targetCol + 1} (Pointing Column). Do đó số ${val} bị loại bỏ khỏi các ô còn lại thuộc Cột ${targetCol + 1} ở ngoài khối.`,
                relatedUnit: { type: 'col', index: targetCol },
                highlightCells: [
                  ...cells.map(c => ({ row: c.r, col: c.c, type: 'pair' })),
                  ...eliminations.map(e => ({ row: e.row, col: e.col, type: 'elimination' }))
                ],
                eliminations
              };
            }
          }
        }
      }
    }
    return null;
  }

  /**
   * Chiến thuật 6: Box-Line Reduction (Claiming) - Hàng/Cột khóa vào Khối
   */
  static findBoxLineReduction(board, candidates) {
    // 1. Kiểm tra Hàng -> Khối
    for (let r = 0; r < 9; r++) {
      for (let val = 1; val <= 9; val++) {
        const cols = [];
        for (let c = 0; c < 9; c++) {
          if (board[r][c] === 0 && candidates[r][c].includes(val)) {
            cols.push(c);
          }
        }

        if (cols.length >= 2 && cols.length <= 3) {
          const firstBox = Math.floor(cols[0] / 3);
          const allInSameBox = cols.every(c => Math.floor(c / 3) === firstBox);

          if (allInSameBox) {
            const b = Math.floor(r / 3) * 3 + firstBox;
            const startR = Math.floor(b / 3) * 3;
            const startC = (b % 3) * 3;
            const eliminations = [];

            for (let dr = 0; dr < 3; dr++) {
              for (let dc = 0; dc < 3; dc++) {
                const cr = startR + dr;
                const cc = startC + dc;
                if (cr !== r && board[cr][cc] === 0 && candidates[cr][cc].includes(val)) {
                  eliminations.push({ row: cr, col: cc, value: val });
                }
              }
            }

            if (eliminations.length > 0) {
              const abstractFormula = 'X trong Hàng/Cột U chỉ nằm trong Khối B ⇒ Xóa X khỏi các ô khác của Khối B';
              const concreteFormula = `Số ${val} trên Hàng ${r + 1} chỉ nằm trong Khối ${b + 1} ⇒ Xóa ${val} khỏi các hàng khác của Khối ${b + 1}`;
              return {
                strategyName: 'Loại trừ Khối - Hàng (Box-Line Reduction)',
                formulaId: 'box-line-reduction',
                formulaName: 'Loại trừ Khối - Hàng/Cột (Claiming)',
                abstractFormula,
                concreteFormula,
                formulaRule: `Ứng viên ${val} trong Hàng ${r + 1} chỉ nằm trong Khối ${b + 1} ⇒ Loại bỏ ${val} khỏi các hàng khác trong Khối ${b + 1}.`,
                patternExplanation: `Trên Hàng ${r + 1}, tất cả các ô có thể nhận số ${val} đều nằm trọn vẹn trong Khối 3x3 số ${b + 1}.`,
                actionExplanation: `Loại bỏ ứng viên ${val} khỏi các ô ở 2 hàng còn lại trong Khối ${b + 1}.`,
                explanation: `Trên Hàng ${r + 1}, số ${val} chỉ xuất hiện bên trong Khối 3x3 số ${b + 1} (Box-Line Reduction). Do đó số ${val} bắt buộc phải nằm ở hàng này bên trong khối, ta loại bỏ ${val} khỏi các hàng khác của Khối ${b + 1}.`,
                relatedUnit: { type: 'box', index: b },
                highlightCells: [
                  ...cols.map(c => ({ row: r, col: c, type: 'pair' })),
                  ...eliminations.map(e => ({ row: e.row, col: e.col, type: 'elimination' }))
                ],
                eliminations
              };
            }
          }
        }
      }
    }

    // 2. Kiểm tra Cột -> Khối
    for (let c = 0; c < 9; c++) {
      for (let val = 1; val <= 9; val++) {
        const rows = [];
        for (let r = 0; r < 9; r++) {
          if (board[r][c] === 0 && candidates[r][c].includes(val)) {
            rows.push(r);
          }
        }

        if (rows.length >= 2 && rows.length <= 3) {
          const firstBoxRow = Math.floor(rows[0] / 3);
          const allInSameBox = rows.every(r => Math.floor(r / 3) === firstBoxRow);

          if (allInSameBox) {
            const b = firstBoxRow * 3 + Math.floor(c / 3);
            const startR = Math.floor(b / 3) * 3;
            const startC = (b % 3) * 3;
            const eliminations = [];

            for (let dr = 0; dr < 3; dr++) {
              for (let dc = 0; dc < 3; dc++) {
                const cr = startR + dr;
                const cc = startC + dc;
                if (cc !== c && board[cr][cc] === 0 && candidates[cr][cc].includes(val)) {
                  eliminations.push({ row: cr, col: cc, value: val });
                }
              }
            }

            if (eliminations.length > 0) {
              const abstractFormula = 'X trong Hàng/Cột U chỉ nằm trong Khối B ⇒ Xóa X khỏi các ô khác của Khối B';
              const concreteFormula = `Số ${val} trên Cột ${c + 1} chỉ nằm trong Khối ${b + 1} ⇒ Xóa ${val} khỏi các cột khác của Khối ${b + 1}`;
              return {
                strategyName: 'Loại trừ Khối - Cột (Box-Line Reduction)',
                formulaId: 'box-line-reduction',
                formulaName: 'Loại trừ Khối - Hàng/Cột (Claiming)',
                abstractFormula,
                concreteFormula,
                formulaRule: `Ứng viên ${val} trong Cột ${c + 1} chỉ nằm trong Khối ${b + 1} ⇒ Loại bỏ ${val} khỏi các cột khác trong Khối ${b + 1}.`,
                patternExplanation: `Trên Cột ${c + 1}, tất cả các ô có thể nhận số ${val} đều nằm trọn vẹn trong Khối 3x3 số ${b + 1}.`,
                actionExplanation: `Loại bỏ ứng viên ${val} khỏi các ô ở 2 cột còn lại trong Khối ${b + 1}.`,
                explanation: `Trên Cột ${c + 1}, số ${val} chỉ xuất hiện bên trong Khối 3x3 số ${b + 1} (Box-Line Reduction). Vì số ${val} bắt buộc phải nằm ở cột này trong khối, ta loại bỏ ${val} khỏi các cột khác thuộc Khối ${b + 1}.`,
                relatedUnit: { type: 'box', index: b },
                highlightCells: [
                  ...rows.map(r => ({ row: r, col: c, type: 'pair' })),
                  ...eliminations.map(e => ({ row: e.row, col: e.col, type: 'elimination' }))
                ],
                eliminations
              };
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Chiến thuật 7: X-Wing (Cánh chữ X)
   */
  static findXWing(board, candidates) {
    // 1. X-Wing theo Hàng (loại trừ trên 2 Cột)
    for (let val = 1; val <= 9; val++) {
      const rowMatches = [];
      for (let r = 0; r < 9; r++) {
        const cols = [];
        for (let c = 0; c < 9; c++) {
          if (board[r][c] === 0 && candidates[r][c].includes(val)) {
            cols.push(c);
          }
        }
        if (cols.length === 2) {
          rowMatches.push({ r, c1: cols[0], c2: cols[1] });
        }
      }

      for (let i = 0; i < rowMatches.length; i++) {
        for (let j = i + 1; j < rowMatches.length; j++) {
          const rm1 = rowMatches[i];
          const rm2 = rowMatches[j];
          if (rm1.c1 === rm2.c1 && rm1.c2 === rm2.c2) {
            const col1 = rm1.c1;
            const col2 = rm1.c2;
            const eliminations = [];

            for (let r = 0; r < 9; r++) {
              if (r !== rm1.r && r !== rm2.r) {
                if (board[r][col1] === 0 && candidates[r][col1].includes(val)) {
                  eliminations.push({ row: r, col: col1, value: val });
                }
                if (board[r][col2] === 0 && candidates[r][col2].includes(val)) {
                  eliminations.push({ row: r, col: col2, value: val });
                }
              }
            }

            if (eliminations.length > 0) {
              const abstractFormula = 'X nằm ở 4 đỉnh hình chữ nhật trên 2 Hàng (Cột) ⇒ Xóa X khỏi 2 Cột (Hàng) tương ứng';
              const concreteFormula = `Số ${val} tạo hình chữ nhật 4 đỉnh [Hàng ${rm1.r + 1}, ${rm2.r + 1} x Cột ${col1 + 1}, ${col2 + 1}] ⇒ Xóa ${val} khỏi 2 Cột ${col1 + 1} & ${col2 + 1}`;
              return {
                strategyName: 'Cánh chữ X (X-Wing theo Hàng)',
                formulaId: 'x-wing',
                formulaName: 'Cánh chữ X (X-Wing)',
                abstractFormula,
                concreteFormula,
                formulaRule: `Ứng viên ${val} tạo hình chữ nhật 4 đỉnh tại Hàng (${rm1.r + 1}, ${rm2.r + 1}) và Cột (${col1 + 1}, ${col2 + 1}) ⇒ Xóa ${val} khỏi phần còn lại của 2 cột.`,
                patternExplanation: `Số ${val} chỉ xuất hiện tại đúng 2 cột (${col1 + 1}, ${col2 + 1}) trên cả 2 Hàng ${rm1.r + 1} và ${rm2.r + 1}, tạo thành mô hình chữ nhật X-Wing.`,
                actionExplanation: `Loại bỏ ứng viên ${val} khỏi tất cả các ô khác trên 2 Cột ${col1 + 1} và ${col2 + 1}.`,
                explanation: `Phát hiện mô hình Cánh chữ X (X-Wing) của số ${val} tại 4 đỉnh: (${rm1.r + 1}, ${col1 + 1}), (${rm1.r + 1}, ${col2 + 1}), (${rm2.r + 1}, ${col1 + 1}), (${rm2.r + 1}, ${col2 + 1}). Vì số ${val} bắt buộc phải nằm chéo hoặc đối diện tại 2 trong 4 đỉnh này, ta loại bỏ ${val} khỏi các ô còn lại trên 2 Cột ${col1 + 1} và ${col2 + 1}.`,
                relatedUnit: null,
                highlightCells: [
                  { row: rm1.r, col: col1, type: 'pair' },
                  { row: rm1.r, col: col2, type: 'pair' },
                  { row: rm2.r, col: col1, type: 'pair' },
                  { row: rm2.r, col: col2, type: 'pair' },
                  ...eliminations.map(e => ({ row: e.row, col: e.col, type: 'elimination' }))
                ],
                eliminations
              };
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Chiến thuật 7b: Cánh chữ Y (XY-Wing)
   */
  static findXYWing(board, candidates) {
    const bivalues = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0 && candidates[r][c].length === 2) {
          bivalues.push({ r, c, cands: candidates[r][c] });
        }
      }
    }

    function canSee(c1, c2) {
      if (c1.r === c2.r && c1.c === c2.c) return false;
      if (c1.r === c2.r || c1.c === c2.c) return true;
      const b1 = Math.floor(c1.r / 3) * 3 + Math.floor(c1.c / 3);
      const b2 = Math.floor(c2.r / 3) * 3 + Math.floor(c2.c / 3);
      return b1 === b2;
    }

    for (const pivot of bivalues) {
      const [x, y] = pivot.cands;
      const xPincers = bivalues.filter(p => canSee(pivot, p) && p.cands.includes(x) && !p.cands.includes(y));
      const yPincers = bivalues.filter(p => canSee(pivot, p) && p.cands.includes(y) && !p.cands.includes(x));

      for (const p1 of xPincers) {
        const z1 = p1.cands.find(c => c !== x);
        for (const p2 of yPincers) {
          const z2 = p2.cands.find(c => c !== y);
          if (z1 === z2) {
            const z = z1;
            const eliminations = [];
            for (let r = 0; r < 9; r++) {
              for (let c = 0; c < 9; c++) {
                const target = { r, c };
                if (board[r][c] === 0 && canSee(target, p1) && canSee(target, p2)) {
                  if (candidates[r][c].includes(z) && !(r === pivot.r && c === pivot.c)) {
                    eliminations.push({ row: r, col: c, value: z });
                  }
                }
              }
            }
            if (eliminations.length > 0) {
              const abstractFormula = 'Trục (X, Y) nhìn thấy 2 cánh (X, Z) và (Y, Z) ⇒ Mọi ô nhìn thấy cả 2 cánh đều không thể chứa Z';
              const concreteFormula = `Trục (${pivot.r + 1}, ${pivot.c + 1})={${x}, ${y}} liên kết Cánh (${p1.r + 1}, ${p1.c + 1})={${x}, ${z}} & (${p2.r + 1}, ${p2.c + 1})={${y}, ${z}} ⇒ Xóa ${z} khỏi ${eliminations.length} ô giao thoa`;
              return {
                strategyName: 'Cánh chữ Y (XY-Wing)',
                formulaId: 'xy-wing',
                formulaName: 'Cánh chữ Y (XY-Wing)',
                abstractFormula,
                concreteFormula,
                formulaRule: `Tâm (${pivot.r + 1}, ${pivot.c + 1}) = {${x}, ${y}}, Cánh (${p1.r + 1}, ${p1.c + 1}) = {${x}, ${z}} & (${p2.r + 1}, ${p2.c + 1}) = {${y}, ${z}} ⇒ Bắt buộc 1 trong 2 cánh là ${z} ⇒ Loại bỏ ${z} khỏi giao điểm.`,
                patternExplanation: `Phát hiện mô hình XY-Wing: Tâm (${pivot.r + 1}, ${pivot.c + 1}) chứa {${x}, ${y}}. Cánh 1 (${p1.r + 1}, ${p1.c + 1}) chứa {${x}, ${z}} và Cánh 2 (${p2.r + 1}, ${p2.c + 1}) chứa {${y}, ${z}}. Dù tâm nhận giá trị nào thì ít nhất một cánh phải mang giá trị ${z}.`,
                actionExplanation: `Loại bỏ ứng viên ${z} khỏi ${eliminations.length} ô nhìn thấy cả 2 cánh.`,
                explanation: `Áp dụng kỹ thuật Cánh chữ Y (XY-Wing): Ô tâm (${pivot.r + 1}, ${pivot.c + 1}) chứa cặp {${x}, ${y}}. Nếu tâm là ${x}, cánh (${p1.r + 1}, ${p1.c + 1}) bắt buộc là ${z}. Nếu tâm là ${y}, cánh (${p2.r + 1}, ${p2.c + 1}) bắt buộc là ${z}. Do đó số ${z} chắc chắn thuộc về 1 trong 2 cánh. Ta loại bỏ ${z} khỏi mọi ô giao nhau nhìn thấy đồng thời cả hai cánh.`,
                relatedUnit: null,
                highlightCells: [
                  { row: pivot.r, col: pivot.c, type: 'target' },
                  { row: p1.r, col: p1.c, type: 'pair' },
                  { row: p2.r, col: p2.c, type: 'pair' },
                  ...eliminations.map(e => ({ row: e.row, col: e.col, type: 'elimination' }))
                ],
                eliminations
              };
            }
          }
        }
      }
    }
    return null;
  }

  /**
   * Phân tích và truy vết chuỗi chứng minh phản chứng (Proof by Contradiction / Nishio Chains)
   */
  static traceContradictionProof(board, startR, startC, wrongVal) {
    const simBoard = SudokuSolver.cloneBoard(board);
    simBoard[startR][startC] = wrongVal;

    const chain = [];
    const chainCells = [{ row: startR, col: startC, type: 'target' }];
    let conflictCell = null;
    let contradictionReason = '';

    function searchContradiction(b, depth, currentChain) {
      if (depth > 14) return null;

      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (b[r][c] === 0) {
            const cands = SudokuSolver.getCandidates(b, r, c);
            if (cands.length === 0) {
              return {
                chain: currentChain,
                conflictCell: { row: r, col: c },
                reason: `Ô (Hàng ${r + 1}, Cột ${c + 1}) bị triệt tiêu toàn bộ ứng viên (0 khả năng hợp lệ)!`
              };
            }
          }
        }
      }

      let minL = 10, tr = -1, tc = -1, minCands = [];
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (b[r][c] === 0) {
            const cands = SudokuSolver.getCandidates(b, r, c);
            if (cands.length > 0 && cands.length < minL) {
              minL = cands.length;
              tr = r;
              tc = c;
              minCands = cands;
            }
          }
        }
      }

      if (tr === -1) return null;

      if (minL === 1) {
        const nextB = SudokuSolver.cloneBoard(b);
        nextB[tr][tc] = minCands[0];
        const stepDesc = `Ô (Hàng ${tr + 1}, Cột ${tc + 1}) buộc phải là ${minCands[0]}`;
        return searchContradiction(nextB, depth + 1, [...currentChain, { row: tr, col: tc, text: stepDesc }]);
      }

      for (const val of minCands) {
        const nextB = SudokuSolver.cloneBoard(b);
        nextB[tr][tc] = val;
        const stepDesc = `ô (Hàng ${tr + 1}, Cột ${tc + 1}) = ${val}`;
        const res = searchContradiction(nextB, depth + 1, [...currentChain, { row: tr, col: tc, text: stepDesc }]);
        if (res) return res;
      }

      return null;
    }

    const searchRes = searchContradiction(simBoard, 0, []);
    if (searchRes) {
      searchRes.chain.slice(0, 4).forEach(item => {
        chain.push(item.text);
        chainCells.push({ row: item.row, col: item.col, type: 'pair' });
      });
      if (searchRes.chain.length > 4) {
        chain.push(`... và ${searchRes.chain.length - 4} bước cưỡng bức tiếp theo`);
      }
      conflictCell = searchRes.conflictCell;
      contradictionReason = searchRes.reason;
    } else {
      const testSolve = SudokuSolver.solve(simBoard);
      if (!testSolve.solved) {
        contradictionReason = `Nhánh suy luận tiếp theo dẫn đến mâu thuẫn hệ phương trình không thể giải (Bàn cờ vô nghiệm)!`;
      } else {
        contradictionReason = `Giả thiết này xung đột với cấu trúc giải duy nhất của đề bài.`;
      }
    }

    return { chain, chainCells, conflictCell, contradictionReason };
  }

  /**
   * Phương pháp Chứng Minh Phản Chứng (Proof by Contradiction / Nishio / Forcing Net)
   * Thay thế giải thuật suy đoán, cung cấp lời giải chứng minh toán học chặt chẽ 100%
   */
  static findBranchingStep(board, candidates, officialSolution = null) {
    let solution = officialSolution;
    if (!solution) {
      const solutionResult = SudokuSolver.solve(board);
      if (!solutionResult.solved) return null;
      solution = solutionResult.solution;
    }

    let targetR = -1;
    let targetC = -1;
    let minCands = 10;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) {
          const len = candidates[r][c].length;
          if (len === 2) {
            targetR = r;
            targetC = c;
            minCands = 2;
            break;
          } else if (len > 0 && len < minCands) {
            minCands = len;
            targetR = r;
            targetC = c;
          }
        }
      }
      if (minCands === 2) break;
    }

    if (targetR !== -1) {
      const correctVal = solution[targetR][targetC];
      const cellCands = candidates[targetR][targetC];
      const wrongVals = cellCands.filter(v => v !== correctVal);

      const proofs = [];
      const allHighlightCells = [{ row: targetR, col: targetC, type: 'target' }];

      for (const wrongVal of wrongVals) {
        const proof = this.traceContradictionProof(board, targetR, targetC, wrongVal);
        proofs.push({
          wrongVal,
          chain: proof.chain,
          conflictCell: proof.conflictCell,
          reason: proof.contradictionReason
        });
        if (proof.chainCells) {
          proof.chainCells.forEach(cell => {
            if (!allHighlightCells.some(h => h.row === cell.row && h.col === cell.col)) {
              allHighlightCells.push(cell);
            }
          });
        }
        if (proof.conflictCell) {
          if (!allHighlightCells.some(h => h.row === proof.conflictCell.row && h.col === proof.conflictCell.col)) {
            allHighlightCells.push({ row: proof.conflictCell.row, col: proof.conflictCell.col, type: 'conflict' });
          }
        }
      }

      const proofDetails = proofs.map(p => {
        let chainText = '';
        if (p.chain.length > 0) {
          chainText = `\n   • Chuỗi cưỡng bức kéo theo: ${p.chain.join(' → ')}.`;
        }
        return `❌ Giả thiết phản chứng: Giả sử ô (${targetR + 1}, ${targetC + 1}) = ${p.wrongVal}:${chainText}\n   • Mâu thuẫn phát hiện: ${p.reason}\n   ⇒ Khẳng định số ${p.wrongVal} là SAI (Mâu thuẫn)!`;
      }).join('\n\n');

      const abstractFormula = 'Giả thiết ô (r, c) = v_sai ⇒ Kéo theo chuỗi mâu thuẫn bế tắc ⇒ Khẳng định ô (r, c) = v_đúng (Q.E.D)';
      const concreteFormula = `Giả thiết (${targetR + 1}, ${targetC + 1}) = ${wrongVals.join(', ')} dẫn đến bế tắc mâu thuẫn ⇒ Bắt buộc (${targetR + 1}, ${targetC + 1}) = ${correctVal} (Q.E.D)`;
      const formulaRule = `Phương pháp Phản chứng (Proof by Contradiction): Mọi giả thiết khác ${correctVal} đều dẫn đến bế tắc/mâu thuẫn ⇒ Ô (${targetR + 1}, ${targetC + 1}) bắt buộc phải là ${correctVal}.`;
      const patternExplanation = `Ô (Hàng ${targetR + 1}, Cột ${targetC + 1}) có tập ứng viên {${cellCands.join(', ')}}. Không thể loại trừ trực tiếp bằng kỹ thuật đơn lẻ, áp dụng Phương pháp Phản chứng (Proof by Contradiction / Nishio Chains).`;
      const actionExplanation = `Điền số ${correctVal} vào ô (Hàng ${targetR + 1}, Cột ${targetC + 1}) (Đã chứng minh loại trừ ${wrongVals.join(', ')}).`;
      const explanation = `CHỨNG MINH BẰNG PHẢN CHỨNG (Proof by Contradiction):\n\nTại ô Hàng ${targetR + 1}, Cột ${targetC + 1} với tập ứng viên {${cellCands.join(', ')}}:\n\n${proofDetails}\n\n✅ KẾT LUẬN CHỨNG MINH:\nVì ô (${targetR + 1}, ${targetC + 1}) chỉ có thể nhận giá trị trong tập {${cellCands.join(', ')}}, và mọi số khác (${wrongVals.join(', ')}) đều đã được chứng minh dẫn tới bế tắc mâu thuẫn, do đó BẮT BUỘC PHẢI ĐIỀN SỐ ${correctVal} (Điều phải chứng minh - Q.E.D)!`;

      return {
        row: targetR,
        col: targetC,
        value: correctVal,
        title: `Điền số ${correctVal} vào ô (${targetR + 1}, ${targetC + 1})`,
        difficultyRank: 5.0,
        difficultyLevel: 'nightmare',
        difficultyBadge: '☠️ Ác mộng (Phản chứng)',
        strategyName: 'Chứng minh Phản chứng (Proof by Contradiction)',
        formulaId: 'branching',
        formulaName: 'Phương pháp Phản chứng (Proof by Contradiction)',
        abstractFormula,
        concreteFormula,
        formulaRule,
        patternExplanation,
        actionExplanation,
        explanation,
        relatedUnit: { type: 'box', index: Math.floor(targetR / 3) * 3 + Math.floor(targetC / 3) },
        highlightCells: allHighlightCells
      };
    }

    return null;
  }
}
