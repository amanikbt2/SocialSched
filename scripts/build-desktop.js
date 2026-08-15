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

// 1.5 Fix absolute asset paths in index.html for Electron (convert "/_expo" to "./_expo" etc.)
const indexPath = path.join(__dirname, '../dist/index.html');
if (fs.existsSync(indexPath)) {
  console.log('Fixing absolute asset paths in dist/index.html for Electron compatibility...');
  let html = fs.readFileSync(indexPath, 'utf8');
  html = html.replace(/src="\//g, 'src="./');
  html = html.replace(/href="\//g, 'href="./');
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('Asset paths in dist/index.html successfully converted to relative paths!');
}

// 2. Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const originalMain = packageJson.main;
const originalDependencies = packageJson.dependencies;

let isCleanedUp = false;
function restorePackageJson() {
  if (isCleanedUp) return;
  console.log('Restoring package.json main entry point and dependencies...');
  packageJson.main = originalMain;
  packageJson.dependencies = originalDependencies;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  isCleanedUp = true;
}

// Register exit and termination signal handlers to ensure restoration
process.on('exit', restorePackageJson);
process.on('SIGINT', () => {
  restorePackageJson();
  process.exit(130);
});
process.on('SIGTERM', () => {
  restorePackageJson();
  process.exit(143);
});

try {
  // 3. Swap main to electron/main.js & strip dependencies for the build
  console.log('Swapping entry point in package.json to electron/main.js and stripping dependencies for build...');
  packageJson.main = 'electron/main.js';
  packageJson.dependencies = {}; // Strip dependencies for electron build (assets are precompiled)
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
  restorePackageJson();
}
