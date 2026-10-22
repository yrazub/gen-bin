import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { CatalogError } from './errors';

export interface Ctx {
  root: string;
  marketplace: string;
  errors: CatalogError[];
  warnings: string[];
}

export const posix = (p: string): string => p.split(sep).join('/');

export const rel = (ctx: Ctx, abs: string): string => posix(relative(ctx.root, abs));

export const isFile = (p: string): boolean => existsSync(p) && statSync(p).isFile();
export const isDir = (p: string): boolean => existsSync(p) && statSync(p).isDirectory();

/** Reads and parses a JSON file. A missing file is undefined; a broken one is recorded. */
export function readJson(ctx: Ctx, abs: string): unknown {
  if (!isFile(abs)) return undefined;
  try {
    return JSON.parse(readFileSync(abs, 'utf8'));
  } catch (e) {
    ctx.errors.push(new CatalogError(rel(ctx, abs), `invalid JSON: ${(e as Error).message}`));
    return undefined;
  }
}

/** Every file under `dir` whose name ends with `ext`, sorted, as absolute paths. */
export function listFiles(dir: string, ext: string): string[] {
  if (!isDir(dir)) return [];
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(ext)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

export const asRecord = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;

export const asString = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.replace(/\s+/g, ' ').trim() : undefined;

export const asStrings = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string')
    : typeof v === 'string'
      ? v.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
