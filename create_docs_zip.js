const fs = require('fs');
const archiver = require('archiver');
const path = require('path');

const output = fs.createWriteStream('Teams_Meeting_Minutes_Documentation.zip');
const archive = archiver('zip', {
  zlib: { level: 9 }
});

output.on('close', () => {
  console.log(`✅ Documentation archive created successfully!`);
  console.log(`📦 Total size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📄 Files included: ${archive.pointer()} bytes`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// Add all markdown files
const mdFiles = fs.readdirSync('.').filter(f => f.endsWith('.md'));
mdFiles.forEach(file => {
  archive.file(file, { name: file });
  console.log(`Adding: ${file}`);
});

archive.finalize();
