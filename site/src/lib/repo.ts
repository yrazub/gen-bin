import { execFileSync } from 'node:child_process';
import { REPO, REPO_URL } from './constants';

export { REPO, REPO_URL };

/** Short commit SHA of the working tree, or "local" outside a git checkout. */
export function commitSha(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || 'local';
  } catch {
    return 'local';
  }
}

/** GitHub URL of a repository file or directory at the built commit ("main" when built outside git). */
export function sourceUrl(path: string, kind: 'blob' | 'tree', sha: string): string {
  return `${REPO_URL}/${kind}/${sha === 'local' ? 'main' : sha}/${path}`;
}
