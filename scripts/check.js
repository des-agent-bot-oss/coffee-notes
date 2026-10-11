#!/usr/bin/env node
// `npm run check` — the project build/type check described in docs/SPEC.md §6.
// Zero dependencies: node --check for syntax, JSON.parse for JSON files, plus
// the layout and import-policy assertions. Exits non-zero with an itemised report.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const results = [];

const SKIP_DIRS = new Set(['.git', 'node_modules', '.evidence-tmp']);

// Files promised by docs/SPEC.md §2 that must exist for the app to run.
// Vendored .woff2 files are optional by design (§5: fallback stack must work).
const REQUIRED_FILES = [
  'package.json',
  'server/index.js',
  'server/router.js',
  'server/db.js',
  'server/schema.sql',
  'server/api.js',
  'server/seed.js',
  'server/static.js',
  'test/api.test.js',
  'test/db.test.js',
  'public/index.html',
  'public/styles.css',
  'public/app.js',
  'public/fonts/dm-sans.css',
  'docs/SPEC.md',
  'docs/BRIEF.md',
  'docs/ASSUMPTIONS.md',
  'docs/OPERATIONS.md',
  'evidence/RUN-REPORT.md',
  'evidence/DELEGATION-TRACE.jsonl'
];

const SYNTAX_DIRS = ['server', 'public', 'test', 'scripts'];
const RUNTIME_DIRS = ['server', 'public'];

function walk(dir, predicate) {
  const found = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full, predicate));
    else if (predicate(entry.name)) found.push(full);
  }
  return found;
}

function rel(file) {
  return path.relative(ROOT, file);
}

function item(label, ok, detail) {
  results.push({ label, ok, detail });
  if (!ok) failures.push(detail ? `${label}: ${detail}` : label);
}

// 1. Syntax-check every .js file under server/, public/, test/, scripts/.
{
  const files = SYNTAX_DIRS.flatMap((dir) => walk(path.join(ROOT, dir), (name) => name.endsWith('.js')));
  const broken = [];
  for (const file of files) {
    const direct = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (direct.status === 0) continue;
    // Fallback for files node cannot classify from a package.json context.
    const source = fs.readFileSync(file, 'utf8');
    const fallback = spawnSync(process.execPath, ['--check', '--input-type=module'], {
      input: source,
      encoding: 'utf8'
    });
    if (fallback.status === 0) continue;
    broken.push(`${rel(file)}: ${(fallback.stderr || direct.stderr || '').trim().split('\n')[0]}`);
  }
  item(`syntax: ${files.length} .js file(s) under ${SYNTAX_DIRS.join(', ')}`, broken.length === 0, broken.join('; '));
}

// 2. Parse every JSON file (package.json counts double: it is also inspected below).
{
  const files = [path.join(ROOT, 'package.json'), ...walk(ROOT, (name) => name.endsWith('.json'))];
  const unique = [...new Set(files)];
  const broken = [];
  for (const file of unique) {
    try {
      JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      broken.push(`${rel(file)}: ${error.message}`);
    }
  }
  item(`json: ${unique.length} file(s) parse`, broken.length === 0, broken.join('; '));
}

// 3. Files promised by the layout section must exist.
{
  const missing = REQUIRED_FILES.filter((file) => !fs.existsSync(path.join(ROOT, file)));
  item(`layout: ${REQUIRED_FILES.length} required file(s) present`, missing.length === 0, `missing ${missing.join(', ')}`);
}

// 4. package.json metadata and scripts.
{
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const problems = [];
  if (pkg.name !== 'coffee-notes') problems.push(`name is "${pkg.name}"`);
  if (pkg.type !== 'module') problems.push(`type is "${pkg.type}"`);
  if (!pkg.engines || !/>=\s*22/.test(String(pkg.engines.node ?? ''))) problems.push('engines.node must require >=22');
  const expectedScripts = {
    start: 'node server/index.js',
    dev: 'COFFEE_NOTES_PORT=4317 node --watch server/index.js',
    test: 'node --test',
    seed: 'node server/seed.js --demo',
    check: 'node scripts/check.js'
  };
  for (const [name, command] of Object.entries(expectedScripts)) {
    if (!pkg.scripts || pkg.scripts[name] !== command) {
      problems.push(`scripts.${name} should be "${command}"`);
    }
  }
  const runtimeDeps = Object.keys(pkg.dependencies ?? {});
  if (runtimeDeps.length > 0) problems.push(`runtime dependencies present: ${runtimeDeps.join(', ')}`);
  item('package.json: metadata, scripts, zero runtime dependencies', problems.length === 0, problems.join('; '));
}

// 5. The app shell must reference the CSS and JS assets it ships with.
{
  const htmlPath = path.join(ROOT, 'public', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const problems = [];
  if (!/href="[^"]*styles\.css"/.test(html)) problems.push('no link to styles.css');
  if (!/src="[^"]*app\.js"/.test(html)) problems.push('no script tag for app.js');
  if (!/href="[^"]*fonts\/dm-sans\.css"/.test(html)) problems.push('no link to fonts/dm-sans.css');
  item('public/index.html references styles.css, app.js and the vendored font CSS', problems.length === 0, problems.join('; '));
}

// 6. Runtime files must not import from node_modules.
{
  const files = RUNTIME_DIRS.flatMap((dir) => walk(path.join(ROOT, dir), (name) => name.endsWith('.js')));
  const problems = [];
  const specifier = /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(specifier)) {
      const target = match[1];
      if (target.includes('node_modules')) {
        problems.push(`${rel(file)} imports "${target}"`);
        continue;
      }
      const bare = !target.startsWith('.') && !target.startsWith('/') && !target.startsWith('node:');
      if (bare) problems.push(`${rel(file)} imports bare specifier "${target}" (would need node_modules)`);
    }
  }
  item(`imports: no node_modules dependency in ${files.length} runtime file(s)`, problems.length === 0, problems.join('; '));
}

console.log('coffee-notes check');
for (const { label, ok, detail } of results) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — ${detail}`}`);
}
if (failures.length > 0) {
  console.log(`\nFAILED: ${failures.length} item(s)`);
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
console.log('\nAll checks passed.');
