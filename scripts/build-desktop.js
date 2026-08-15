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
// 2. Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const originalMain = packageJson.main === 'electron/main.js' ? 'expo-router/entry' : packageJson.main;
const originalDependencies = (packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0)
  ? packageJson.dependencies
  : {
      "@react-native-async-storage/async-storage": "1.23.1",
      "caniuse-lite": "^1.0.30001809",
      "date-fns": "^4.1.0",
      "expo": "~52.0.0",
      "expo-asset": "~11.0.5",
      "expo-constants": "~17.0.0",
      "expo-crypto": "~14.0.0",
      "expo-file-system": "~18.0.0",
      "expo-font": "~13.0.0",
      "expo-haptics": "~14.0.0",
      "expo-image-picker": "~16.0.0",
      "expo-linking": "~7.0.0",
      "expo-router": "~4.0.0",
      "expo-sharing": "~13.0.0",
      "expo-splash-screen": "~0.29.24",
      "expo-sqlite": "~15.1.4",
      "expo-status-bar": "~2.0.0",
      "expo-system-ui": "~4.0.0",
      "lodash.throttle": "^4.1.1",
      "lucide-react-native": "^0.469.0",
      "react": "18.3.1",
      "react-dom": "^18.3.1",
      "react-native": "0.76.9",
      "react-native-gesture-handler": "~2.20.2",
      "react-native-reanimated": "~3.16.1",
      "react-native-safe-area-context": "4.12.0",
      "react-native-screens": "~4.4.0",
      "react-native-svg": "~15.8.0",
      "react-native-web": "^0.19.13",
      "zustand": "^5.0.0"
    };

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
