'use strict';
/**
 * Checks the repository itself rather than the hook's behaviour: that every file
 * parses, and that the manifests still point at things that exist.
 *
 * The failure this catches is the quiet one — a renamed hook file, a command
 * that no longer exists — where nothing looks broken until someone installs it.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { REPO, walk } = require('./helpers');

const PLUGIN = JSON.parse(
  fs.readFileSync(path.join(REPO, '.claude-plugin', 'plugin.json'), 'utf8')
);
const MARKETPLACE = JSON.parse(
  fs.readFileSync(path.join(REPO, '.claude-plugin', 'marketplace.json'), 'utf8')
);

test('every JavaScript file parses', () => {
  const files = walk(REPO, '.js');
  assert.ok(files.length >= 1);
  for (const file of files) {
    const res = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(res.status, 0, `${path.relative(REPO, file)} does not parse:\n${res.stderr}`);
  }
});

test('every JSON file parses', () => {
  for (const file of walk(REPO, '.json')) {
    assert.doesNotThrow(
      () => JSON.parse(fs.readFileSync(file, 'utf8')),
      `${path.relative(REPO, file)} is not valid JSON`
    );
  }
});

test('plugin.json is complete', () => {
  for (const field of ['name', 'description', 'version', 'license', 'author', 'homepage']) {
    assert.ok(PLUGIN[field], `plugin.json is missing ${field}`);
  }
  assert.match(PLUGIN.version, /^\d+\.\d+\.\d+$/);
});

test('the hook command points at a file that exists', () => {
  const events = Object.values(PLUGIN.hooks || {}).flat();
  assert.ok(events.length, 'plugin.json declares no hooks');
  for (const event of events) {
    for (const h of event.hooks || []) {
      const referenced = String(h.command).match(/\$\{CLAUDE_PLUGIN_ROOT\}([^"']+)/);
      assert.ok(referenced, 'hook command does not use CLAUDE_PLUGIN_ROOT');
      assert.ok(
        fs.existsSync(path.join(REPO, referenced[1])),
        `hook references missing ${referenced[1]}`
      );
      assert.ok(h.timeout > 0, 'hook has no timeout');
    }
  }
});

test('the marketplace entry agrees with plugin.json', () => {
  const entry = MARKETPLACE.plugins.find((p) => p.name === PLUGIN.name);
  assert.ok(entry, `marketplace.json has no entry named ${PLUGIN.name}`);
  assert.ok(entry.description, 'the marketplace entry has no description');
  assert.ok(fs.existsSync(path.join(REPO, entry.source)), `${entry.source} does not exist`);
});

test('the /simply command is shipped and has frontmatter', () => {
  const file = path.join(REPO, 'commands', 'simply.md');
  assert.ok(fs.existsSync(file), 'commands/simply.md is missing');
  const body = fs.readFileSync(file, 'utf8');
  assert.match(body, /^---\n[\s\S]*?description:/, 'no description in the frontmatter');
  assert.match(body, /\$ARGUMENTS/, 'the command ignores its arguments');
});

test('config.example.json only documents keys the hook actually reads', () => {
  const example = JSON.parse(fs.readFileSync(path.join(REPO, 'config.example.json'), 'utf8'));
  const source = fs.readFileSync(path.join(REPO, 'hooks', 'explain-simply.js'), 'utf8');
  const defaults = source.slice(source.indexOf('const DEFAULTS'), source.indexOf('function readJson'));

  for (const key of Object.keys(example)) {
    assert.match(defaults, new RegExp(`\\b${key}\\b`), `config.example.json documents unused "${key}"`);
  }
});

test('both readmes are present and show how to install it', () => {
  for (const name of ['README.md', 'README.tr.md', 'LICENSE']) {
    assert.ok(fs.existsSync(path.join(REPO, name)), `${name} is missing`);
  }
  const readme = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8');
  assert.ok(readme.includes(`/plugin install ${PLUGIN.name}@${MARKETPLACE.name}`));
});
