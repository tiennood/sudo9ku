const fs = require('fs');
let code = fs.readFileSync('js/sudoku_solver.js', 'utf8') + '\n' + fs.readFileSync('js/human_solver.js', 'utf8');
code = code.replace(/export\s+/g, '').replace(/import\s+[^;]+;/g, '');
code += '\nglobal.SudokuSolver = SudokuSolver; global.HumanSolver = HumanSolver;';
eval(code);

// Sample extreme puzzle (Escargot / difficult puzzle)
const puzzle = [
  [1, 0, 0, 0, 0, 7, 0, 9, 0],
  [0, 3, 0, 0, 2, 0, 0, 0, 8],
  [0, 0, 9, 6, 0, 0, 5, 0, 0],
  [0, 0, 5, 3, 0, 0, 9, 0, 0],
  [0, 1, 0, 0, 8, 0, 0, 0, 2],
  [6, 0, 0, 0, 0, 4, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 1, 0],
  [0, 4, 0, 0, 0, 0, 0, 0, 7],
  [0, 0, 7, 0, 0, 0, 3, 0, 0]
];

const solRes = SudokuSolver.solve(puzzle);
console.log('Puzzle Solved:', solRes.solved);
const candidates = SudokuSolver.getAllCandidates(puzzle);
const immediate = HumanSolver.findAllImmediateMoves(puzzle, candidates, solRes.solution);
console.log('Immediate moves count:', immediate.length);
immediate.forEach((m, idx) => {
  console.log(`[${idx}] Rank: ${m.difficultyRank} | Badge: ${m.difficultyBadge} | Strategy: ${m.strategyName} | Target: Ô (${m.targetCell.row + 1}, ${m.targetCell.col + 1}) = ${m.targetCell.value}`);
});

// Now simulate user filling 2 numbers:
console.log('\n--- Simulating User Plays 2 Moves ---');
const userBoard = puzzle.map(r => [...r]);
if (immediate.length > 0) {
  const m1 = immediate[0];
  userBoard[m1.targetCell.row][m1.targetCell.col] = m1.targetCell.value;
  console.log(`User entered Ô (${m1.targetCell.row + 1}, ${m1.targetCell.col + 1}) = ${m1.targetCell.value}`);
}
const cand2 = SudokuSolver.getAllCandidates(userBoard);
const immediate2 = HumanSolver.findAllImmediateMoves(userBoard, cand2, solRes.solution);
console.log('Immediate moves after user play:', immediate2.length);
immediate2.forEach((m, idx) => {
  console.log(`[${idx}] Rank: ${m.difficultyRank} | Badge: ${m.difficultyBadge} | Strategy: ${m.strategyName} | Target: Ô (${m.targetCell.row + 1}, ${m.targetCell.col + 1}) = ${m.targetCell.value}`);
});

// Test full generateSolveSteps from userBoard
console.log('\n--- Generating full steps from userBoard ---');
const solveResult = HumanSolver.generateSolveSteps(userBoard, solRes.solution);
const steps = solveResult.steps;
console.log('Total steps generated from userBoard:', steps.length);
console.log('First 5 steps:');
steps.slice(0, 5).forEach((s, i) => {
  console.log(`Step ${s.stepIndex}: Rank ${s.difficultyRank} | ${s.formulaName || s.strategyName} | ${s.title}`);
});
