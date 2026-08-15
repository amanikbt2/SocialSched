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

// 1.5 Fix absolute paths + inject Electron routing fix in dist/index.html
console.log('Fixing paths in dist/index.html for Electron file:// compatibility...');
const indexPath = path.join(__dirname, '../dist/index.html');
if (fs.existsSync(indexPath)) {
  let indexHtml = fs.readFileSync(indexPath, 'utf8');

  // Fix absolute paths -> relative
  indexHtml = indexHtml.replace(/href="\/(?!\/)/g, 'href="./');
  indexHtml = indexHtml.replace(/src="\/(?!\/)/g, 'src="./');

  // Inject script to redirect file:// routes — Expo Router uses pathname for routing,
  // but file:// makes the full file path the "pathname", causing Unmatched Route.
  // This script rewrites the location so Expo Router sees "/" as the route.
  const routerFixScript = `
  <script>
    // Electron file:// routing fix: ensure Expo Router sees "/" as root
    (function() {
      if (window.location.protocol === 'file:') {
        // Only do this once; push state so router sees "/"
        if (window.location.hash === '' && window.location.pathname !== '/') {
          window.history.replaceState(null, '', '/');
        }
      }
    })();
  </script>`;

  // Inject before closing </head>
  indexHtml = indexHtml.replace('</head>', routerFixScript + '\n</head>');

  fs.writeFileSync(indexPath, indexHtml, 'utf8');
  console.log('Successfully patched dist/index.html for Electron!');
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
