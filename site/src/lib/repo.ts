import { execFileSync } from 'node:child_process';

export const REPO = 'yrazub/gen-bin';
export const REPO_URL = `https://github.com/${REPO}`;

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
