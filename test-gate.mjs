#!/usr/bin/env node
// test-gate.mjs — push current source + run remote selftest; exit non-zero
// unless failed==0 AND passed>=BASELINE. Autonomous loop: node test-gate.mjs
import { execSync } from 'node:child_process';

const BASELINE = 800;

try {
  console.log('==> clasp push -f');
  execSync('clasp push -f', { stdio: 'inherit' });
} catch {
  console.error('GATE: FAIL - clasp push failed');
  process.exit(2);
}

let out = '';
try {
  console.log('==> clasp run-function runSelfTest');
  out = execSync('clasp run-function runSelfTest', { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
  process.stdout.write(out);
} catch (e) {
  if (e.stdout) process.stdout.write(e.stdout);
  console.error('GATE: FAIL - clasp run-function did not execute');
  process.exit(2);
}

// Envelope (Node inspect style): { failures: [ ... ], passed: <int>, failed: <int> }
// failures[] prints first, so the top-level passed/failed are the LAST matches.
const p = [...out.matchAll(/passed:\s*(\d+)/g)].at(-1);
const f = [...out.matchAll(/failed:\s*(\d+)/g)].at(-1);
if (!p || !f) {
  console.error('GATE: FAIL - could not parse selftest output');
  process.exit(2);
}
const passed = Number(p[1]);
const failed = Number(f[1]);
console.log('GATE: passed=' + passed + ' failed=' + failed + ' baseline=' + BASELINE);

if (failed !== 0) {
  console.error('GATE: FAIL - ' + failed + ' failing assert(s)');
  process.exit(1);
}
if (passed < BASELINE) {
  console.error('GATE: FAIL - passed ' + passed + ' < baseline ' + BASELINE + ' (regressie/ontbrekende testcase?)');
  process.exit(1);
}
console.log('GATE: PASS');
