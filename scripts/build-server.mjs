#!/usr/bin/env node
import { execSync } from 'child_process';

console.log('Building frontend with Vite...');
execSync('npx vite build', { stdio: 'inherit' });

console.log('Building server with esbuild (tree-shaking dev dependencies)...');
execSync(
  'npx esbuild server/index.ts --platform=node --bundle --define:process.env.NODE_ENV=\'"production"\' --external:vite --packages=external --format=esm --outdir=dist',
  { stdio: 'inherit' }
);

console.log('✅ Build complete!');
