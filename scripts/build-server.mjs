#!/usr/bin/env node
import { execSync } from 'child_process';

console.log('Building frontend with Vite...');
execSync('npx vite build', { stdio: 'inherit' });

console.log('Building server with esbuild (excluding Vite)...');
execSync(
  'npx esbuild server/index.ts --platform=node --bundle --external:./vite --external:./vite.js --external:../vite.config.ts --packages=external --format=esm --outdir=dist',
  { stdio: 'inherit' }
);

console.log('✅ Build complete!');
