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

// 1.5 Fix absolute paths in dist/index.html for Electron compatibility
console.log('Fixing paths in dist/index.html for Electron compatibility...');
const indexPath = path.join(__dirname, '../dist/index.html');
if (fs.existsSync(indexPath)) {
  let indexHtml = fs.readFileSync(indexPath, 'utf8');

  // Fix absolute paths -> relative
  indexHtml = indexHtml.replace(/href="\/(?!\/)/g, 'href="./');
  indexHtml = indexHtml.replace(/src="\/(?!\/)/g, 'src="./');

  fs.writeFileSync(indexPath, indexHtml, 'utf8');
  console.log('Successfully fixed absolute paths in dist/index.html!');
} else {
  console.warn('Warning: dist/index.html not found! Skipping path fix.');
}

// 2. Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const originalMain = packageJson.main;
const originalDependencies = packageJson.dependencies;

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
  console.log('Restoring package.json main entry point and dependencies...');
  packageJson.main = originalMain;
  packageJson.dependencies = originalDependencies;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
}
