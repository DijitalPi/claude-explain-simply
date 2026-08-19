'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { sandbox, config, run, submit } = require('./helpers');

test('injects the rule on the first prompt of a session', () => {
  const sb = sandbox();
  const r = submit(sb);
  assert.equal(r.event, 'UserPromptSubmit');
  assert.match(r.context, /<explain-simply>/);
  assert.match(r.context, /<\/explain-simply>/);
  assert.match(r.context, /\*\*In simple terms\*\*/);
  assert.match(r.context, /---------/);
  assert.match(r.context, /~15 lines/);
  assert.match(r.context, /3-6 short lines/);
});

test('the rule tells Claude to skip short replies and not to announce itself', () => {
  const sb = sandbox();
  const r = submit(sb);
  assert.match(r.context, /Skip it entirely on short replies/);
  assert.match(r.context, /Never explain that you are adding the summary/);
  assert.match(r.context, /only restates what is already above it/);
});

test('stays quiet on the prompts in between — the rule is not re-sent every turn', () => {
  const sb = sandbox();
  assert.ok(submit(sb).context, 'prompt 1 injects');
  for (let i = 2; i <= 7; i++) {
    assert.ok(submit(sb).silent, `prompt ${i} should be quiet`);
  }
});

test('re-injects every refreshEvery prompts so the rule does not fade', () => {
  const sb = sandbox();
  const cfg = { refreshEvery: 4 };
  assert.ok(submit(sb, cfg).context, 'prompt 1');
  assert.ok(submit(sb, cfg).silent, 'prompt 2');
  assert.ok(submit(sb, cfg).silent, 'prompt 3');
  assert.ok(submit(sb, cfg).context, 'prompt 4');
  assert.ok(submit(sb, cfg).silent, 'prompt 5');
  assert.ok(submit(sb, cfg).silent, 'prompt 6');
  assert.ok(submit(sb, cfg).silent, 'prompt 7');
  assert.ok(submit(sb, cfg).context, 'prompt 8');
});

test('refreshEvery:1 injects on every prompt', () => {
  const sb = sandbox();
  for (let i = 1; i <= 4; i++) {
    assert.ok(submit(sb, { refreshEvery: 1 }).context, `prompt ${i}`);
  }
});

test('refreshEvery:0 is treated as every prompt rather than never', () => {
  const sb = sandbox();
  assert.ok(submit(sb, { refreshEvery: 0 }).context, 'prompt 1');
  assert.ok(submit(sb, { refreshEvery: 0 }).context, 'prompt 2');
});

test('counts each session separately', () => {
  const sb = sandbox();
  assert.ok(submit(sb).context, 'first prompt of session 1');
  assert.ok(submit(sb).silent, 'second prompt of session 1');
  assert.ok(submit(sb, null, { session_id: 'sess-2' }).context, 'first prompt of session 2');
});

test('a session with no id still gets the rule', () => {
  const sb = sandbox();
  const r = run({ cwd: sb.cwd, prompt: 'hello' }, { sandbox: sb });
  assert.match(r.context, /<explain-simply>/);
});

test('language: a named language is requested explicitly', () => {
  const sb = sandbox();
  const r = submit(sb, { language: 'Turkish' });
  assert.match(r.context, /Write the summary in Turkish\./);
});

test('language: "auto" follows the conversation', () => {
  const sb = sandbox();
  const r = submit(sb, { language: 'auto' });
  assert.match(r.context, /same language as the conversation/);
});

test('heading, separator, minLines and summaryLines come from config', () => {
  const sb = sandbox();
  const r = submit(sb, {
    heading: 'Basitçe anlatım',
    separator: '===',
    minLines: 30,
    summaryLines: '2-4',
  });
  assert.match(r.context, /\*\*Basitçe anlatım\*\*/);
  assert.match(r.context, /A separator line on its own: ===/);
  assert.match(r.context, /~30 lines/);
  assert.match(r.context, /2-4 short lines/);
});

test('avoidTerms are listed as words to spell out instead', () => {
  const sb = sandbox();
  const r = submit(sb, { avoidTerms: ['CPA', 'ROAS'] });
  assert.match(r.context, /Do not use these terms in the summary/);
  assert.match(r.context, /CPA, ROAS/);
});

test('no avoidTerms means no line about them', () => {
  const sb = sandbox();
  const r = submit(sb, { avoidTerms: [] });
  assert.ok(!r.context.includes('Do not use these terms'));
});

test('a project config beats the one in the home directory', () => {
  const sb = sandbox();
  config(sb, { heading: 'Home heading' }, 'home');
  config(sb, { heading: 'Project heading' }, 'project');
  const r = run({ session_id: 'sess-1', cwd: sb.cwd }, { sandbox: sb });
  assert.match(r.context, /\*\*Project heading\*\*/);
});

test('the home config applies when the project has none', () => {
  const sb = sandbox();
  config(sb, { heading: 'Home heading' }, 'home');
  const r = run({ session_id: 'sess-1', cwd: sb.cwd }, { sandbox: sb });
  assert.match(r.context, /\*\*Home heading\*\*/);
});

test('EXPLAIN_SIMPLY_CONFIG beats both', () => {
  const sb = sandbox();
  config(sb, { heading: 'Home heading' }, 'home');
  config(sb, { heading: 'Project heading' }, 'project');
  const explicit = config(sb, { heading: 'Explicit heading' });
  const r = run(
    { session_id: 'sess-1', cwd: sb.cwd },
    { sandbox: sb, env: { EXPLAIN_SIMPLY_CONFIG: explicit } }
  );
  assert.match(r.context, /\*\*Explicit heading\*\*/);
});

test('a partial config keeps the defaults for everything else', () => {
  const sb = sandbox();
  const r = submit(sb, { heading: 'Özet' });
  assert.match(r.context, /\*\*Özet\*\*/);
  assert.match(r.context, /~15 lines/, 'minLines still defaulted');
  assert.match(r.context, /3-6 short lines/, 'summaryLines still defaulted');
});

test('enabled:false turns it off completely', () => {
  const sb = sandbox();
  assert.ok(submit(sb, { enabled: false }).silent);
});

test('a corrupt config falls back to the defaults instead of failing', () => {
  const sb = sandbox();
  const file = config(sb, {});
  require('node:fs').writeFileSync(file, '{ not json');
  const r = run(
    { session_id: 'sess-1', cwd: sb.cwd },
    { sandbox: sb, env: { EXPLAIN_SIMPLY_CONFIG: file } }
  );
  assert.equal(r.code, 0);
  assert.match(r.context, /\*\*In simple terms\*\*/);
});

test('fails open on stdin that is not JSON at all', () => {
  const sb = sandbox();
  for (const bad of ['', 'not json', '{oops', '<html>']) {
    const r = run(bad, { sandbox: sb });
    assert.equal(r.code, 0, `exit 0 for: ${JSON.stringify(bad)}`);
    assert.equal(r.stdout.trim(), '', `no output for: ${JSON.stringify(bad)}`);
  }
});

test('JSON that parses but is not an event is treated as an empty first prompt', () => {
  // Documented rather than guarded against: `null` and `[]` are valid JSON, so
  // they survive the parse and fall through to the defaults. Claude Code always
  // sends an object, and injecting the rule is the harmless direction to fail.
  for (const odd of ['null', '[]', '"hello"']) {
    // A fresh sandbox each time: they all land on the same "default" session,
    // and the counter would silence the second one.
    const r = run(odd, { sandbox: sandbox() });
    assert.equal(r.code, 0, `exit 0 for: ${odd}`);
    assert.match(r.context, /<explain-simply>/, `default rule for: ${odd}`);
  }
});

test('emits nothing but a single JSON object — no stray logging', () => {
  const sb = sandbox();
  const r = submit(sb);
  assert.equal(r.stderr, '');
  assert.ok(r.json && r.json.hookSpecificOutput, 'stdout is one JSON object');
  assert.deepEqual(Object.keys(r.json), ['hookSpecificOutput']);
});
