import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/lib/markdown';

const opts = { repoPath: 'plugins/demo', commitSha: 'abc1234' };
const render = (md: string) => renderMarkdown(md, opts);

describe('renderMarkdown', () => {
  it('drops <script>, event handlers, <iframe> and raw HTML blocks', () => {
    const html = render(
      [
        'before <script>alert(1)</script> after',
        '',
        '<img src="https://x.test/a.png" onerror="alert(2)">',
        '',
        '<iframe src="https://evil.test"></iframe>',
        '',
        '<div onclick="alert(3)">raw block</div>',
        '',
        '<a href="https://x.test" onclick="alert(4)">inline</a>',
      ].join('\n'),
    );
    expect(html).not.toMatch(/<script|<iframe|<div|onerror|onclick|<img/i);
    expect(html).toContain('before');
  });

  it('removes javascript: and data: links and images', () => {
    const html = render(
      '[a](javascript:alert(1)) [b](data:text/html;base64,PHNjcmlwdD4=) [c](JaVaScRiPt:alert(1)) ![d](data:image/png;base64,AAAA) ![e](http://x.test/e.png)',
    );
    expect(html).not.toMatch(/javascript:|data:|href=|src=/i);
    for (const text of ['a', 'b', 'c']) expect(html).toContain(`>${text}</a>`);
  });

  it('keeps http, https and mailto links, and adds rel to the web ones', () => {
    const html = render('[w](https://x.test/p) [h](http://x.test) [m](mailto:a@x.test) [a](#section)');
    expect(html).toContain('href="https://x.test/p" rel="noopener noreferrer"');
    expect(html).toContain('href="http://x.test"');
    expect(html).toContain('href="mailto:a@x.test"');
    expect(html).toContain('href="#section"');
  });

  it('EC-8: rewrites relative links to the file on GitHub at the commit', () => {
    const html = render('[doc](./docs/x.md) [up](../other/y.md) [root](/README.md) [here](z.md#top)');
    expect(html).toContain('href="https://github.com/yrazub/gen-bin/blob/abc1234/plugins/demo/docs/x.md"');
    expect(html).toContain('href="https://github.com/yrazub/gen-bin/blob/abc1234/plugins/other/y.md"');
    expect(html).toContain('href="https://github.com/yrazub/gen-bin/blob/abc1234/README.md"');
    expect(html).toContain('href="https://github.com/yrazub/gen-bin/blob/abc1234/plugins/demo/z.md#top"');
  });

  it('EC-8: rewrites relative images to the raw file at the commit', () => {
    const html = render('![shot](./img/a.png)');
    expect(html).toContain('src="https://raw.githubusercontent.com/yrazub/gen-bin/abc1234/plugins/demo/img/a.png"');
  });

  it('resolves against the repository root when the file is at the root', () => {
    const html = renderMarkdown('[c](docs/a.md)', { repoPath: '', commitSha: 'abc1234' });
    expect(html).toContain('href="https://github.com/yrazub/gen-bin/blob/abc1234/docs/a.md"');
  });

  it('drops relative URLs that leave the repository or the commit', () => {
    const html = render('[a](../../../../evil/x) [b](//evil.test/x) ![c](../../../../evil/x.png) ![d](//evil.test/x.png)');
    expect(html).not.toMatch(/href=|src=/);
  });

  it('renders GFM tables and code blocks', () => {
    const html = render(['| a | b |', '|---|---|', '| 1 | 2 |', '', '```ts', 'const x = 1;', '```'].join('\n'));
    expect(html).toContain('<table>');
    expect(html).toContain('<td>1</td>');
    expect(html).toContain('<pre><code class="language-ts">const x = 1;');
  });
});
