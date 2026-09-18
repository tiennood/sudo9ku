const { execSync, spawn } = require('child_process');

try {
  const out = execSync('netstat -ano | findstr :3000').toString();
  const lines = out.trim().split('\n');
  const pids = new Set();
  for (const l of lines) {
    const parts = l.trim().split(/\s+/);
    if (parts.length >= 5 && parts[1].includes(':3000')) {
      pids.add(parts[parts.length - 1]);
    }
  }
  for (const pid of pids) {
    console.log('Killing PID:', pid);
    try {
      execSync(`taskkill /F /PID ${pid}`);
    } catch(e) {}
  }
} catch(e) {
  console.log('No existing process on port 3000');
}

console.log('Starting server.js...');
const sub = spawn('node', ['server.js'], {
  detached: true,
  stdio: 'ignore',
  cwd: __dirname + '/..'
});
sub.unref();
console.log('Server started successfully!');
