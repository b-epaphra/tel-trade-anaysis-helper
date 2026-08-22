const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment files
['.env.local', '.env.production.local', '.env'].forEach(f => {
  const fullPath = path.resolve(__dirname, '..', f);
  if (fs.existsSync(fullPath)) {
    dotenv.config({ path: fullPath });
  }
});

const token = process.env.VERCEL_TOKEN || process.env.VERCEL_AUTH_TOKEN || '';
if (!token) {
  console.error('Error: VERCEL_TOKEN or VERCEL_AUTH_TOKEN not found in environment files.');
  process.exit(1);
}

console.log('Deploying tel-trade-analyser to Vercel production...');
const res = spawnSync('npx', ['vercel', '--prod', '--yes', '--token', token], {
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..')
});

process.exit(res.status || 0);
