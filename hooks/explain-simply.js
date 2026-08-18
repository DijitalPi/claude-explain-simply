#!/usr/bin/env node
/**
 * explain-simply — UserPromptSubmit hook
 *
 * Injects a short formatting rule that asks Claude to append a plain-language
 * summary to long answers.
 *
 * Design notes:
 *  - Fail-open. Any error at all exits 0 with no output, so a broken config or
 *    a weird filesystem can never block someone's prompt.
 *  - Cost-aware. The rule is injected on the first prompt of a session and then
 *    only every `refreshEvery` prompts, instead of on every single turn.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULTS = {
  enabled: true,
  // Append the summary when the answer is longer than this many lines,
  // or when it contains multiple sections / tables / code blocks.
  minLines: 15,
  heading: 'In simple terms',
  separator: '---------',
  summaryLines: '3-6',
  // "auto" = summarize in whatever language the conversation is using.
  language: 'auto',
  // Domain jargon to spell out instead of using. e.g. ["CPA", "ARR", "p95"]
  avoidTerms: [],
  // Re-inject the rule every N prompts so it does not fade in long sessions.
  // Set to 1 to inject on every prompt.
  refreshEvery: 8,
};

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function loadConfig(cwd) {
  const candidates = [
    process.env.EXPLAIN_SIMPLY_CONFIG,
    cwd ? path.join(cwd, '.explain-simply.json') : null,
    path.join(os.homedir(), '.claude', 'explain-simply.json'),
  ].filter(Boolean);

  for (const file of candidates) {
    const found = readJson(file);
    if (found) return { ...DEFAULTS, ...found };
  }
  return { ...DEFAULTS };
}

/** Prompt counter, kept per session in the OS temp dir. */
function nextCount(sessionId) {
  try {
    const dir = path.join(os.tmpdir(), 'explain-simply');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${String(sessionId).replace(/[^\w.-]/g, '_')}.json`);
    const state = readJson(file) || { count: 0 };
    state.count += 1;
    fs.writeFileSync(file, JSON.stringify(state));
    return state.count;
  } catch {
    // Cannot track state — treat every prompt as the first one.
    return 1;
  }
}

function buildRule(cfg) {
  const lang =
    cfg.language && cfg.language !== 'auto'
      ? `Write the summary in ${cfg.language}.`
      : 'Write the summary in the same language as the conversation.';

  const avoid =
    Array.isArray(cfg.avoidTerms) && cfg.avoidTerms.length
      ? `\n- Do not use these terms in the summary; describe the idea in ordinary words instead: ${cfg.avoidTerms.join(', ')}.`
      : '';

  return [
    '<explain-simply>',
    `When your reply is long — more than ~${cfg.minLines} lines, or containing multiple sections, tables, or code blocks — end it with a plain-language summary:`,
    '',
    `1. A separator line on its own: ${cfg.separator}`,
    `2. A bold heading: **${cfg.heading}**`,
    `3. ${cfg.summaryLines} short lines that a smart non-expert could follow.`,
    '4. A final line stating what happens next and who it depends on.',
    '',
    'Rules:',
    `- ${lang}`,
    '- The summary only restates what is already above it. No new information, caveats, or recommendations.',
    '- Skip it entirely on short replies. It is for long answers only.',
    `- Never explain that you are adding the summary; just add it.${avoid}`,
    '</explain-simply>',
  ].join('\n');
}

function main() {
  let input = {};
  try {
    input = JSON.parse(fs.readFileSync(0, 'utf8')) || {};
  } catch {
    // No parsable stdin — nothing to do.
    process.exit(0);
  }

  const cfg = loadConfig(input.cwd);
  if (!cfg.enabled) process.exit(0);

  const every = Number(cfg.refreshEvery) > 0 ? Number(cfg.refreshEvery) : 1;
  const count = nextCount(input.session_id || 'default');
  if (count !== 1 && count % every !== 0) process.exit(0);

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: buildRule(cfg),
      },
    })
  );
  process.exit(0);
}

try {
  main();
} catch {
  // Fail open, always.
  process.exit(0);
}
