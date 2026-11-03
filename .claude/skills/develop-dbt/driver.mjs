#!/usr/bin/env node
//
// develop-dbt driver: a thin, honest wrapper around the project's dbt.
//
// Design goals (learned from the previous version's bugs):
//   1. Surface dbt's REAL output and exit codes — never swallow errors.
//   2. Don't reimplement dbt's YAML/Jinja parsing with regexes (they produce
//      false positives, e.g. inline `{% set %}` looks like an unclosed block).
//   3. Be explicit about which commands touch the warehouse.
//
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const C = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', blue: '\x1b[34m', dim: '\x1b[2m',
};
const paint = (c, s) => `${C[c]}${s}${C.reset}`;
const info = (s) => console.log(paint('blue', s));
const ok = (s) => console.log(paint('green', `✓ ${s}`));
const warn = (s) => console.log(paint('yellow', s));
const fail = (s) => console.error(paint('red', `✗ ${s}`));

// Locate the project root by walking up for dbt_project.yml, so the driver
// works no matter where in the project it is invoked from. At each level we
// also check a dbt/ subdirectory, so invoking from the repo root — where the
// dbt project lives in dbt/, not alongside .claude/ — still resolves.
function findProjectRoot(start) {
  let dir = start;
  for (;;) {
    if (fs.existsSync(path.join(dir, 'dbt_project.yml'))) return dir;
    const nested = path.join(dir, 'dbt');
    if (fs.existsSync(path.join(nested, 'dbt_project.yml'))) return nested;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const projectRoot = findProjectRoot(process.cwd());
if (!projectRoot) {
  fail('No dbt_project.yml found here or in any parent directory. Run this from inside the dbt project.');
  process.exit(1);
}
const dbtBin = path.join(projectRoot, 'dbt-env', 'bin', 'dbt');
const pyBin = path.join(projectRoot, 'dbt-env', 'bin', 'python3');

function ensureDbt() {
  if (!fs.existsSync(dbtBin)) {
    fail(`dbt not found at ${path.relative(projectRoot, dbtBin)}/. Is the dbt-env virtualenv set up? See CLAUDE.md.`);
    process.exit(1);
  }
}

// Run dbt from the venv, streaming its real output. Returns the exit code.
function runDbt(args) {
  ensureDbt();
  info(`$ dbt ${args.join(' ')}`);
  const res = spawnSync(dbtBin, args, { cwd: projectRoot, stdio: 'inherit' });
  if (res.error) {
    fail(`Could not launch dbt: ${res.error.message}`);
    return 1;
  }
  return res.status ?? 1;
}

const resolveInProject = (p) => (path.isAbsolute(p) ? p : path.join(projectRoot, p));

// ---------------------------------------------------------------- commands

function cmdParse() {
  const code = runDbt(['parse']);
  if (code === 0) {
    ok('Parsed OK: YAML, Jinja, and ref()/source() links are valid (no warehouse used).');
  } else {
    fail('Parse failed — read the dbt error above for the file and line.');
  }
  return code;
}

function cmdCompile(selector) {
  const args = selector ? ['compile', '--select', selector] : ['compile'];
  const code = runDbt(args);
  if (code === 0) {
    ok(selector
      ? `Compiled ${selector}. Rendered SQL is under target/compiled/.`
      : 'Compiled all models. Rendered SQL is under target/compiled/.');
    warn('Note: compile opens a warehouse connection for introspection.');
  } else {
    fail('Compile failed — read the dbt error above.');
  }
  return code;
}

// Real YAML syntax check using the venv's PyYAML (a dbt dependency).
function lintYaml(absPath) {
  if (!fs.existsSync(pyBin)) return null; // can't lint; caller falls back to parse
  const program = [
    'import sys, yaml',
    'try:',
    '    yaml.safe_load(open(sys.argv[1]))',
    'except yaml.YAMLError as e:',
    '    print(e)',
    '    sys.exit(1)',
  ].join('\n');
  const res = spawnSync(pyBin, ['-c', program, absPath], { cwd: projectRoot, encoding: 'utf-8' });
  if (res.status === 0) return { valid: true };
  return { valid: false, error: (res.stdout || res.stderr || 'unknown YAML error').trim() };
}

function cmdValidate(file) {
  if (!file) {
    fail('validate needs a file path, e.g. validate models/example/schema.yml');
    return 1;
  }
  const abs = resolveInProject(file);
  if (!fs.existsSync(abs)) {
    fail(`File not found: ${file}`);
    return 1;
  }
  const ext = path.extname(abs).toLowerCase();

  if (ext === '.yml' || ext === '.yaml') {
    info(`Checking YAML syntax: ${file}`);
    const lint = lintYaml(abs);
    if (lint && !lint.valid) {
      fail(`YAML syntax error in ${file}:\n${lint.error}`);
      return 1;
    }
    if (lint) ok('YAML syntax OK.');
    // Then validate it in the context of the whole dbt project.
    return cmdParse();
  }

  if (ext === '.sql') {
    info(`Validating Jinja/SQL via dbt parse (whole project, includes ${file}).`);
    const code = cmdParse();
    if (code === 0) info('Tip: run `compile <model_name>` to see this model\'s rendered SQL.');
    return code;
  }

  fail(`Unsupported file type "${ext}". Use .sql, .yml, or .yaml.`);
  return 1;
}

// List the project's OWN artifacts from the filesystem — not the hundreds of
// models/macros that installed packages contribute.
function listFiles(dir, ext) {
  const root = path.join(projectRoot, dir);
  if (!fs.existsSync(root)) return [];
  const out = [];
  (function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(ext)) out.push(path.relative(projectRoot, full));
    }
  })(root);
  return out.sort();
}

function cmdList() {
  const sections = [
    ['Models', listFiles('models', '.sql')],
    ['Macros', listFiles('macros', '.sql')],
    ['Seeds', listFiles('seeds', '.csv')],
    ['Tests', listFiles('tests', '.sql')],
  ];
  for (const [title, files] of sections) {
    if (!files.length) continue;
    console.log(paint('blue', `\n${title} (${files.length}):`));
    files.forEach((f) => console.log(`  ${f}`));
  }
  console.log('');
  return 0;
}

function showHelp() {
  console.log(`
${paint('blue', 'develop-dbt driver')} ${paint('dim', '— validate and develop dbt artifacts')}

Usage: node .claude/skills/develop-dbt/driver.mjs <command> [arg]

  ${paint('green', 'parse')}              Validate ALL YAML, Jinja, and ref()/source() links.
                     Primary check after any edit.            ${paint('dim', '(no warehouse)')}
  ${paint('green', 'validate <file>')}    .yml: real YAML syntax check, then parse.
                     .sql: parse (catches Jinja errors).      ${paint('dim', '(no warehouse)')}
  ${paint('green', 'compile [model]')}    Render Jinja -> SQL into target/compiled/.
                     Pass a model name to compile just one.   ${paint('dim', '(opens a connection)')}
  ${paint('green', 'list')}               List this project's own models/macros/seeds/tests.
  ${paint('green', 'help')}               Show this message.

Examples:
  node .claude/skills/develop-dbt/driver.mjs parse
  node .claude/skills/develop-dbt/driver.mjs validate models/example/schema.yml
  node .claude/skills/develop-dbt/driver.mjs compile loops_statements_lists
`);
}

function main() {
  const [, , command, arg] = process.argv;
  let code = 0;
  switch (command) {
    case 'parse': code = cmdParse(); break;
    case 'validate': code = cmdValidate(arg); break;
    case 'compile': code = cmdCompile(arg); break;
    case 'list': code = cmdList(); break;
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    default:
      fail(`Unknown command: ${command}`);
      showHelp();
      code = 1;
  }
  process.exit(code);
}

main();
