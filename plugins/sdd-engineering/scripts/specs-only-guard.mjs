#!/usr/bin/env node
// PreToolUse guard for the `spec-creator` agent (wired in hooks/hooks.json).
// A plugin hook runs in every session, so the guard acts only when the call comes from the
// spec-creator agent: Claude Code puts `agent_type` in the hook input for a subagent call.
// For spec-creator it allows Write/Edit only on Markdown files under a directory named `specs`
// inside the project, never under a `plans` directory; everything else is blocked with exit
// code 2, which Claude Code reports back to the agent as the reason.
// For any other agent, or the main session, it exits 0 at once.
// For spec-creator it fails closed: input it cannot parse is blocked too.
import { realpathSync, existsSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

function block(reason) {
  process.stderr.write(
    `specs-only-guard: ${reason} spec-creator may write only Markdown files in a "specs" folder (for example docs/specs/), never in a "plans" folder.\n`,
  );
  process.exit(2);
}

// Resolves symlinks in the deepest existing ancestor, so a link inside specs/ cannot point out.
function realpathLoose(p) {
  let dir = p;
  const tail = [];
  while (!existsSync(dir)) {
    tail.unshift(dir.slice(dirname(dir).length + 1));
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(realpathSync(dir), ...tail);
}

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const raw = Buffer.concat(chunks).toString('utf8');

let input;
try {
  input = JSON.parse(raw);
} catch {
  // Unparseable input: we cannot tell who is calling. Block only when the text itself names the agent.
  if (/spec-creator/.test(raw)) block('could not parse the hook input.');
  process.exit(0);
}

const agent = typeof input?.agent_type === 'string' ? input.agent_type : '';
if (!agent.endsWith('spec-creator')) process.exit(0);

const filePath = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
if (typeof filePath !== 'string' || filePath.length === 0) block(`${input?.tool_name ?? 'tool'} has no file path.`);

const root = realpathLoose(input.cwd || process.cwd());
const target = realpathLoose(isAbsolute(filePath) ? filePath : resolve(input.cwd || root, filePath));
const rel = relative(root, target).split(sep).join('/');

if (rel.startsWith('../') || isAbsolute(rel)) block(`${filePath} is outside the project.`);
if (!rel.endsWith('.md')) block(`${rel} is not a Markdown file.`);
const dirs = rel.split('/').slice(0, -1);
if (dirs.includes('plans')) block(`${rel} is in a plans folder; plans are saved by the main session.`);
if (!dirs.includes('specs')) block(`${rel} is not in a specs folder.`);

process.exit(0);
