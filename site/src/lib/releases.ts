import type { Release } from './catalog/types';
import { renderMarkdown } from './markdown';

export const releaseDate = (r: Release): string => r.date ?? 'Unreleased';

/** A release's notes as safe HTML. `headingOffset` keeps its New / Changed / Fixed headings under the page's. */
export function releaseHtml(r: Release, sha: string, headingOffset: number): string {
  return renderMarkdown(r.body, { repoPath: '', commitSha: sha, headingOffset });
}
