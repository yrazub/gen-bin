import rehypeSanitize, { defaultSchema, type Options as Schema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { REPO } from './repo';

export interface RenderOptions {
  /** Directory of the Markdown file, relative to the repository root ('' for the root). */
  repoPath: string;
  commitSha: string;
}

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

const schema: Schema = {
  ...defaultSchema,
  protocols: { ...defaultSchema.protocols, href: ['http', 'https', 'mailto'], src: ['https'] },
};

const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Points a relative URL at the file in the repository at the built commit (EC-8).
 * Returns undefined for anything that would leave the repository.
 */
function resolveRelative(href: string, kind: 'blob' | 'raw', { repoPath, commitSha }: RenderOptions): string | undefined {
  const [host, prefix] =
    kind === 'blob'
      ? ['https://github.com', `/${REPO}/blob/${commitSha}/`]
      : ['https://raw.githubusercontent.com', `/${REPO}/${commitSha}/`];
  const dir = repoPath.replace(/^\/+|\/+$/g, '');
  const rootRelative = href.startsWith('/');
  const base = `${host}${prefix}${rootRelative || !dir ? '' : `${dir}/`}`;
  try {
    const resolved = new URL(rootRelative ? href.slice(1) : href, base);
    return resolved.origin === host && resolved.pathname.startsWith(prefix) ? resolved.href : undefined;
  } catch {
    return undefined;
  }
}

function isRelative(url: string): boolean {
  return !HAS_SCHEME.test(url) && !url.startsWith('//') && !url.startsWith('#');
}

function visit(node: HastNode, fn: (el: HastNode) => void): void {
  if (node.type === 'element') fn(node);
  node.children?.forEach((c) => visit(c, fn));
}

function rewriteLinks(options: RenderOptions) {
  return (tree: HastNode) =>
    visit(tree, (el) => {
      const props = el.properties;
      if (!props) return;
      if (el.tagName === 'a' && typeof props.href === 'string') {
        const href = props.href;
        if (href.startsWith('//')) delete props.href;
        else if (isRelative(href)) {
          const resolved = resolveRelative(href, 'blob', options);
          if (resolved) props.href = resolved;
          else delete props.href;
        }
        if (typeof props.href === 'string' && /^https?:/.test(props.href)) props.rel = ['noopener', 'noreferrer'];
      }
      if (el.tagName === 'img' && typeof props.src === 'string') {
        const src = props.src;
        if (src.startsWith('//')) delete props.src;
        else if (isRelative(src)) {
          const resolved = resolveRelative(src, 'raw', options);
          if (resolved) props.src = resolved;
          else delete props.src;
        }
      }
    });
}

/**
 * Renders untrusted Markdown to safe HTML: raw HTML is dropped, only http, https and mailto
 * links and https images survive, and relative URLs point at the repository at `commitSha`.
 */
export function renderMarkdown(md: string, options: RenderOptions): string {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeSanitize, schema)
      .use(() => rewriteLinks(options))
      .use(rehypeStringify)
      .processSync(md),
  );
}
