import { buildSnippet, type TeamPlugin } from '../lib/team/snippet';
import { knownPlugins, loadSelection, matchKnown, notifyChange, parseNames, saveSelection } from '../lib/team/selection';
import { SHELL_MARKETPLACE_ADD, shellInstallCommand } from '../lib/search/invocable';

const app = document.querySelector<HTMLElement>('[data-team-app]');
const dataEl = document.getElementById('team-data');
if (app && dataEl) init(app, JSON.parse(dataEl.textContent ?? '[]') as TeamPlugin[]);

function init(app: HTMLElement, plugins: TeamPlugin[]): void {
  const known = knownPlugins();
  const q = <T extends HTMLElement>(sel: string) => app.querySelector<T>(sel)!;
  const rows = [...app.querySelectorAll<HTMLElement>('[data-row]')];
  const unknownList = q<HTMLUListElement>('[data-unknown]');
  const none = q('[data-none]');
  const detail = q('[data-detail]');
  const snippetCode = q('[data-snippet]');
  const snippetCopy = q<HTMLButtonElement>('[data-snippet-copy]');
  const shellCode = q('[data-shell]');
  const shellCopy = q<HTMLButtonElement>('[data-shell-copy]');
  const shareBox = q('[data-share]');
  const shareCode = shareBox.querySelector('code')!;
  const shareCopy = shareBox.querySelector<HTMLButtonElement>('button[data-copy]')!;

  // A shared link wins over what this browser stored; either way only catalog names count (AC-37, EC-11).
  const params = new URLSearchParams(location.search);
  let selected: string[];
  let unknown: string[] = [];
  if (params.has('plugins')) {
    ({ selected, unknown } = matchKnown(parseNames(params.get('plugins')), known));
    saveSelection(selected);
  } else {
    selected = loadSelection(known);
  }

  function render(): void {
    const snippet = buildSnippet(selected, plugins);

    for (const row of rows) {
      const name = row.dataset.row!;
      const input = row.querySelector<HTMLInputElement>('input')!;
      const dep = row.querySelector<HTMLElement>('[data-dep]')!;
      const explicit = selected.includes(name);
      const by = snippet.addedBy[name];
      input.checked = explicit || !!by;
      input.disabled = !explicit && !!by;
      dep.hidden = explicit || !by;
      dep.textContent = by && !explicit ? `Added as a dependency of ${by.join(', ')}` : '';
    }

    unknownList.hidden = unknown.length === 0;
    unknownList.replaceChildren(
      ...unknown.map((name) => {
        const li = document.createElement('li');
        li.textContent = `Unknown plugin: ${name}`;
        return li;
      }),
    );

    const has = snippet.enabled.length > 0;
    none.hidden = has;
    detail.hidden = !has;

    snippetCode.textContent = snippet.json;
    snippetCopy.dataset.copy = snippet.json;

    const link = `${location.origin}${location.pathname}?plugins=${selected.map(encodeURIComponent).join(',')}`;
    shareCode.textContent = link;
    shareCopy.dataset.copy = link;

    const shell = [SHELL_MARKETPLACE_ADD, ...snippet.enabled.map(shellInstallCommand)].join('\n');
    shellCode.textContent = shell;
    shellCopy.dataset.copy = shell;
  }

  function writeUrl(): void {
    const query = selected.length ? `?plugins=${selected.map(encodeURIComponent).join(',')}` : '';
    history.replaceState(null, '', `${location.pathname}${query}${location.hash}`);
  }

  for (const row of rows) {
    row.querySelector('input')!.addEventListener('change', (e) => {
      const name = row.dataset.row!;
      const on = (e.target as HTMLInputElement).checked;
      selected = on ? [...selected.filter((n) => n !== name), name] : selected.filter((n) => n !== name);
      saveSelection(selected);
      writeUrl();
      render();
      notifyChange();
    });
  }

  app.hidden = false;
  render();
  if (params.has('plugins')) writeUrl();
  notifyChange();
}
