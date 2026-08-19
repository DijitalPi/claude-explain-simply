'use strict';
/**
 * Test harness.
 *
 * The hook is a small program: JSON on stdin, JSON or nothing on stdout, always
 * exit 0. So the tests run the real file in a real subprocess and assert on what
 * comes back — importing it would not work anyway, since it calls main() at load
 * and reads fd 0.
 *
 * Each test gets a throwaway HOME and TMPDIR. That matters: the hook falls back
 * to ~/.claude/explain-simply.json for config and keeps its prompt counter in
 * the temp directory, so without the sandbox the suite would read whatever the
 * developer running it happens to have configured.
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const HOOK = path.join(REPO, 'hooks', 'explain-simply.js');

function sandbox() {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'explain-simply-test-')));
  const home = path.join(base, 'home');
  const tmp = path.join(base, 'tmp');
  const cwd = path.join(base, 'project');
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.mkdirSync(tmp, { recursive: true });
  fs.mkdirSync(cwd, { recursive: true });
  return { base, home, tmp, cwd };
}

/** Write a config file and return its path, for use with EXPLAIN_SIMPLY_CONFIG. */
function config(sb, obj, where) {
  const file =
    where === 'project'
      ? path.join(sb.cwd, '.explain-simply.json')
      : where === 'home'
        ? path.join(sb.home, '.claude', 'explain-simply.json')
        : path.join(sb.base, 'explain-simply.json');
  fs.writeFileSync(file, JSON.stringify(obj));
  return file;
}

/**
 * Run the hook. The environment is built from scratch rather than inherited, so
 * a developer with EXPLAIN_SIMPLY_CONFIG exported cannot change what the suite
 * sees.
 */
function run(input, opts = {}) {
  const sb = opts.sandbox;
  if (!sb) throw new Error('run() needs a sandbox');

  const res = spawnSync(process.execPath, [opts.script || HOOK], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    timeout: opts.timeout || 20000,
    env: {
      PATH: process.env.PATH,
      HOME: sb.home,
      USERPROFILE: sb.home,
      TMPDIR: sb.tmp,
      TMP: sb.tmp,
      TEMP: sb.tmp,
      ...(opts.env || {}),
    },
  });

  if (res.error) throw res.error;

  let json = null;
  if (res.stdout && res.stdout.trim()) {
    try {
      json = JSON.parse(res.stdout);
    } catch {
      json = null;
    }
  }

  const out = json && json.hookSpecificOutput ? json.hookSpecificOutput : {};
  return {
    code: res.status,
    stdout: res.stdout,
    stderr: res.stderr,
    json,
    context: out.additionalContext || '',
    event: out.hookEventName,
    silent: res.status === 0 && res.stdout.trim() === '',
  };
}

/** Submit a prompt, optionally with a config file pointed at by the env var. */
function submit(sb, cfg, extra = {}) {
  return run(
    { session_id: 'sess-1', cwd: sb.cwd, prompt: 'do the thing', ...extra },
    { sandbox: sb, env: cfg ? { EXPLAIN_SIMPLY_CONFIG: config(sb, cfg) } : {} }
  );
}

/** Recursively collect files under dir, skipping .git. */
function walk(dir, ext, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, ext, found);
    else if (entry.name.endsWith(ext)) found.push(full);
  }
  return found;
}

module.exports = { REPO, HOOK, sandbox, config, run, submit, walk };
