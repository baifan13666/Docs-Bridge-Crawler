/**
 * Copy WASM and MJS files from onnxruntime-web to public directory
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

// Copy all WASM and MJS files needed by onnxruntime-web
const filesToCopy = [
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jspi.wasm',
  'ort-wasm-simd-threaded.jspi.mjs',
];

let copiedCount = 0;

filesToCopy.forEach(file => {
  const sourcePath = path.join(sourceDir, file);
  const targetPath = path.join(targetDir, file);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`✅ Copied ${file}`);
    copiedCount++;
  } else {
    console.log(`⚠️  File not found: ${file}`);
  }
});

console.log(`\n✅ Successfully copied ${copiedCount} files to public/wasm/`);
