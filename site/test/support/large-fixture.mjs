import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const WORDS = (
  'review route schema plugin hook server client query cache index migration deploy lint format test mock stub ' +
  'trace log metric alert queue worker stream buffer parse render layout style token theme build bundle publish ' +
  'secure audit permission session cookie header cors proxy retry timeout backoff batch shard replica snapshot'
).split(' ');

const pick = (seed, n) => Array.from({ length: n }, (_, i) => WORDS[(seed * 7 + i * 13) % WORDS.length]);
const sentence = (seed, n) => `${pick(seed, n).join(' ')}.`;

/**
 * A marketplace of 20 plugins x (10 skills + 4 agents) = 300 components, plus the 20 plugins,
 * written under `dir`. Returns `dir`.
 */
export function generateLarge(dir) {
  const write = (path, content) => {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), content);
  };
  const plugins = [];
  for (let p = 0; p < 20; p++) {
    const name = `plugin-${String(p).padStart(2, '0')}`;
    plugins.push({ name, source: `./plugins/${name}` });
    write(
      `plugins/${name}/.claude-plugin/plugin.json`,
      JSON.stringify({ name, version: `1.${p}.0`, description: `Plugin ${p}: ${sentence(p, 8)}`, keywords: pick(p, 3) }),
    );
    for (let s = 0; s < 10; s++) {
      const seed = p * 100 + s;
      write(
        `plugins/${name}/skills/skill-${s}/SKILL.md`,
        `---\nname: skill-${s}-${WORDS[seed % WORDS.length]}\ndescription: ${sentence(seed, 12)}\n---\n${Array.from({ length: 40 }, (_, i) => sentence(seed + i, 14)).join(' ')}\n`,
      );
    }
    for (let a = 0; a < 4; a++) {
      const seed = p * 100 + 50 + a;
      write(
        `plugins/${name}/agents/agent-${a}.md`,
        `---\nname: agent-${a}-${WORDS[seed % WORDS.length]}\ndescription: ${sentence(seed, 12)}\ntools: Read, Grep\nmodel: sonnet\n---\n${Array.from({ length: 40 }, (_, i) => sentence(seed + i, 14)).join(' ')}\n`,
      );
    }
  }
  write('.claude-plugin/marketplace.json', JSON.stringify({ name: 'gen-bin', owner: { name: 'yrazub' }, plugins }));
  return dir;
}
