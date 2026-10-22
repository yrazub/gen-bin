import { parse } from 'yaml';
import { CatalogError } from './errors';

export interface Parsed {
  data: Record<string, unknown>;
  body: string;
}

/** Splits a leading `---` block from the body and parses it as YAML. */
export function parseFrontmatter(text: string, file: string): Parsed {
  const src = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  if (!/^---[ \t]*\n/.test(src)) return { data: {}, body: src };
  const lines = src.split('\n');
  const end = lines.findIndex((line, i) => i > 0 && /^---[ \t]*$/.test(line));
  if (end === -1) throw new CatalogError(file, 'frontmatter block is not closed with ---');
  let data: unknown;
  try {
    data = parse(lines.slice(1, end).join('\n'));
  } catch (e) {
    throw new CatalogError(file, `invalid frontmatter: ${(e as Error).message}`);
  }
  if (data == null) data = {};
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new CatalogError(file, 'frontmatter must be a YAML mapping');
  }
  return { data: data as Record<string, unknown>, body: lines.slice(end + 1).join('\n') };
}
