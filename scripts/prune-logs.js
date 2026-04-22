const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const logsDir = path.join(rootDir, 'logs');
const keepCount = Number(process.argv[2] || process.env.LOG_RETENTION || 30);

if (!fs.existsSync(logsDir)) {
  process.exit(0);
}

const entries = fs.readdirSync(logsDir);
const runBases = new Set();

for (const entry of entries) {
  if (entry === 'latest.txt' || entry === 'latest.json') continue;
  const match = entry.match(/^(.*)_run-\d+\.(txt|json)$/);
  if (match) runBases.add(match[1]);
}

const keep = new Set(
  Array.from(runBases)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, keepCount)
);

let deleted = 0;

for (const entry of entries) {
  if (entry === 'latest.txt' || entry === 'latest.json') continue;
  const match = entry.match(/^(.*)_run-\d+\.(txt|json)$/);
  if (!match) continue;
  if (!keep.has(match[1])) {
    fs.unlinkSync(path.join(logsDir, entry));
    deleted += 1;
  }
}

console.log(`Pruned ${deleted} log files. Kept ${keep.size} runs plus latest files.`);
