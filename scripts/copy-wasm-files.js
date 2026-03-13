/**
 * Copy WASM files from onnxruntime-web to public directory
 * This allows Next.js to serve them as static assets
 */

const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../node_modules/onnxruntime-web/dist');
const targetDir = path.join(__dirname, '../public/wasm');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log('✅ Created public/wasm directory');
}

// Copy all WASM files
const wasmFiles = fs.readdirSync(sourceDir).filter(file => file.endsWith('.wasm'));

if (wasmFiles.length === 0) {
  console.log('⚠️  No WASM files found in onnxruntime-web/dist');
  process.exit(0);
}

wasmFiles.forEach(file => {
  const sourcePath = path.join(sourceDir, file);
  const targetPath = path.join(targetDir, file);
  
  fs.copyFileSync(sourcePath, targetPath);
  console.log(`✅ Copied ${file}`);
});

console.log(`\n✅ Successfully copied ${wasmFiles.length} WASM files to public/wasm/`);
