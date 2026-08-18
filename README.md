# claude-explain-simply

A Claude Code plugin that ends long answers with a short, jargon-free summary.

Claude is good at thorough. Thorough is not always readable — especially when the
person reading is a founder, a client, a designer, or you at 11pm. This plugin adds
one thing to the end of long replies: a few plain sentences saying what it all
means and what happens next.

Short replies are left alone.

---

## What it looks like

Claude answers your question normally — tables, code, the whole thing. Then:

```
---------

**In simple terms**

The login page breaks because two parts of the app disagree about who is
signed in. One part still trusts an old note that says "signed in" after the
other part has already thrown it away.

Fixing it means having one place decide, instead of two.

Next step is mine: I can make that change and run the tests.
```

That's it. That's the whole plugin.

---

## Install

```bash
/plugin marketplace add DijitalPi/claude-explain-simply
/plugin install claude-explain-simply@claude-explain-simply
```

Then restart Claude Code. Requires `node` on your PATH.

---

## Why a hook, and not a skill

Worth knowing if you're building something similar.

A skill loads when Claude decides the current task matches it. That works well for
"help me do X". It works badly here, because this rule isn't attached to a task —
it's attached to *every long answer*. Claude doesn't stop before writing a long
answer to ask itself whether a formatting skill applies, so a skill version of this
would silently do nothing most of the time.

A `UserPromptSubmit` hook doesn't need to be noticed to work. It puts the rule into
context on its own schedule.

The `/simply` command covers the other half — when you've already got an answer and
just want it in human words.

---

## Configure

Optional. Create `~/.claude/explain-simply.json` for all projects, or
`.explain-simply.json` in a project root for just that one. Project config wins.

```json
{
  "enabled": true,
  "minLines": 15,
  "heading": "In simple terms",
  "separator": "---------",
  "summaryLines": "3-6",
  "language": "auto",
  "avoidTerms": [],
  "refreshEvery": 8
}
```

| Key | Default | What it does |
| --- | --- | --- |
| `enabled` | `true` | Set `false` to switch off without uninstalling. Useful per-project. |
| `minLines` | `15` | Roughly how long an answer must be before a summary is added. |
| `heading` | `In simple terms` | The bold heading above the summary. Make it whatever you want. |
| `separator` | `---------` | The line drawn before the summary. |
| `summaryLines` | `3-6` | How long the summary should be. |
| `language` | `auto` | `auto` matches the conversation. Or force one: `"Spanish"`, `"Turkish"`, `"Japanese"`. |
| `avoidTerms` | `[]` | Your field's jargon. See below — this is the setting that matters most. |
| `refreshEvery` | `8` | Re-inject the rule every N prompts so it doesn't fade in long sessions. `1` = every prompt. |

### `avoidTerms` is the one to actually set

"No jargon" is not a universal instruction — it depends entirely on what *your*
jargon is. A summary written for a marketing client and one written for a
cardiologist are jargon-free in completely different ways.

List the words that make your readers' eyes glaze over:

```json
{ "avoidTerms": ["CPA", "ROAS", "attribution window", "incrementality"] }
```

```json
{ "avoidTerms": ["idempotent", "p95", "backpressure", "eventual consistency"] }
```

The summary will then describe those ideas in ordinary words instead of naming them.

### A note on non-English use

The instruction sent to Claude is in English, but that does not force English
answers — with `language: "auto"` the summary comes back in whatever language you
were already speaking.

One thing to know: "plain language" behaves differently across languages. Technical
speech in many languages is already a mix of local grammar and English loanwords, so
a term that reads as jargon in English may be the ordinary everyday word elsewhere —
and the reverse. If summaries in your language come out stiff or over-translated,
put the words you *do* want kept as-is outside of `avoidTerms`, and list only the
ones that genuinely lose people.

---

## Cost

The rule is about 200 tokens. At the default `refreshEvery: 8` it is added on the
first prompt of a session and then once every eight prompts — call it 25 tokens per
turn amortized. Set `refreshEvery: 1` if you want it enforced harder and don't care.

---

## If something goes wrong

The hook is written to fail open. Bad config, unreadable temp directory, malformed
input — every path exits `0` with no output. It cannot block your prompt or break a
session. If it stops working, the worst case is that summaries quietly stop
appearing.

To turn it off without uninstalling, set `"enabled": false` in your config.

To remove it:

```bash
/plugin uninstall claude-explain-simply@claude-explain-simply
```

---

## Contributing

Issues and PRs welcome. Especially:

- Better default `avoidTerms` sets for specific fields (medicine, law, finance).
- Reports of the summary reading badly in a language other than English.

---

## License

MIT — see [LICENSE](LICENSE).

Türkçe: [README.tr.md](README.tr.md)
