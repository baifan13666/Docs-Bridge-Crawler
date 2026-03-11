#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Create sharp-stub directory if it doesn't exist
const sharpStubDir = path.join(__dirname, '..', 'sharp-stub');
if (!fs.existsSync(sharpStubDir)) {
  fs.mkdirSync(sharpStubDir, { recursive: true });
  console.log('Created sharp-stub directory');
}

// Check if files already exist
const packageJsonPath = path.join(sharpStubDir, 'package.json');
const indexJsPath = path.join(sharpStubDir, 'index.js');

if (fs.existsSync(packageJsonPath) && fs.existsSync(indexJsPath)) {
  console.log('Sharp stub files already exist - skipping creation');
  process.exit(0);
}

// Create package.json for sharp-stub
const packageJson = {
  "name": "sharp",
  "version": "0.33.5",
  "description": "Stub for sharp package to avoid installation issues",
  "main": "index.js"
};

if (!fs.existsSync(packageJsonPath)) {
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('Created sharp-stub/package.json');
}

// Create index.js for sharp-stub
const indexJs = `// Sharp stub for deployment environments where sharp is not needed
module.exports = {};
`;

if (!fs.existsSync(indexJsPath)) {
  fs.writeFileSync(indexJsPath, indexJs);
  console.log('Created sharp-stub/index.js');
}

console.log('Sharp stub setup completed successfully');