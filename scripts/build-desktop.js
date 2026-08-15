const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const packageJsonPath = path.join(__dirname, '../package.json');

// Helper to run commands
function runCmd(cmd) {
  console.log(`Executing: ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

// 1. Build the web assets
console.log('Building web bundle...');
runCmd('npm run build:web');

// 2. Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const originalMain = packageJson.main;

try {
  // 3. Swap main to electron/main.js
  console.log('Swapping entry point in package.json to electron/main.js...');
  packageJson.main = 'electron/main.js';
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  // 4. Run electron-builder build
  console.log('Running electron-builder build...');
  
  // Decide target parameters
  const args = process.argv.slice(2).join(' ');
  runCmd(`npx electron-builder build ${args}`);

  console.log('Electron build completed successfully!');
} catch (error) {
  console.error('An error occurred during build:', error);
  process.exitCode = 1;
} finally {
  // 5. Restore original package.json
  console.log('Restoring package.json main entry point...');
  packageJson.main = originalMain;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
}
