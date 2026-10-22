import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Ctx } from './files';
import type { Release, ReleaseSection } from './types';

const HEADING = /^##\s+(\S+)\s+(\S+)/;

export function readChangelog(ctx: Ctx): Release[] {
  const file = join(ctx.root, 'CHANGELOG.md');
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');

  const releases: Release[] = [];
  let current: { plugin: string; version: string; lines: string[] } | undefined;
  const flush = () => {
    if (!current) return;
    const body = current.lines.join('\n').trim();
    releases.push({
      plugin: current.plugin,
      version: current.version,
      date: releaseDate(ctx, current.plugin, current.version),
      sections: sections(current.lines),
      body,
    });
  };
  for (const line of lines) {
    const m = HEADING.exec(line);
    if (m) {
      flush();
      current = { plugin: m[1], version: m[2], lines: [] };
    } else if (/^#{1,2}\s/.test(line)) {
      flush();
      current = undefined;
    } else if (current) {
      current.lines.push(line);
    }
  }
  flush();

  // Unreleased first, then newest date; the file order breaks ties.
  return releases
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      if (a.r.date === b.r.date) return a.i - b.i;
      if (a.r.date === null) return -1;
      if (b.r.date === null) return 1;
      return a.r.date < b.r.date ? 1 : -1;
    })
    .map((x) => x.r);
}

function sections(lines: string[]): ReleaseSection[] {
  const out: ReleaseSection[] = [];
  for (const line of lines) {
    const h = /^###\s+(.+?)\s*$/.exec(line);
    if (h) out.push({ heading: h[1], items: [] });
    else {
      const item = /^\s*[-*]\s+(.*\S)\s*$/.exec(line);
      if (item && out.length) out[out.length - 1].items.push(item[1]);
    }
  }
  return out;
}

/** Date of the commit that added the heading; null when git cannot say (EC-16, EC-17). */
function releaseDate(ctx: Ctx, plugin: string, version: string): string | null {
  let date: string | undefined;
  try {
    date = execFileSync(
      'git',
      ['-C', ctx.root, 'log', `-S## ${plugin} ${version}`, '--format=%cs', '--reverse', '--', 'CHANGELOG.md'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
      .split('\n')
      .find(Boolean);
  } catch {
    date = undefined;
  }
  if (!date) {
    ctx.warnings.push(`no release date for ${plugin} ${version}: shown as Unreleased`);
    return null;
  }
  return date;
}
