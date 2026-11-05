'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const components = [
  'public/scripts/night-shift/mobile-controls.js',
  'public/scripts/night-shift/shell.js',
  'public/scripts/night-shift/devices.js',
  'public/scripts/night-shift/diagnostics.js',
  'public/scripts/night-shift/sessions.js',
  'public/scripts/night-shift/profiles.js',
  'public/scripts/night-shift/health.js',
  'public/scripts/night-shift/history.js',
  'public/scripts/night-shift/files.js',
  'public/scripts/night-shift/actions.js'
];
const outputPath = path.join(root, 'public/scripts/custom.js');
const output = components.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('');

if (process.argv.includes('--check')) {
  const current = fs.readFileSync(outputPath, 'utf8');
  if (current !== output) {
    console.error('public/scripts/custom.js is out of date. Run node scripts/build-night-shift.js.');
    process.exitCode = 1;
  } else {
    console.log('custom.js matches its modular source components.');
  }
} else {
  fs.writeFileSync(outputPath, output, 'utf8');
  console.log('Built public/scripts/custom.js from ten Night Shift components.');
}
