import { knownPlugins, loadSelection, notifyChange, saveSelection, TEAM_EVENT } from '../lib/team/selection';

function sync(): void {
  const known = knownPlugins();
  const selected = new Set(loadSelection(known));
  document.querySelectorAll<HTMLButtonElement>('[data-team-toggle]').forEach((btn) => {
    const name = btn.dataset.teamToggle ?? '';
    const valid = known.includes(name);
    btn.hidden = !valid;
    const on = valid && selected.has(name);
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? '✓ In team setup' : '+ Add to team setup';
  });
}

document.addEventListener('click', (event) => {
  const btn = (event.target as Element | null)?.closest<HTMLButtonElement>('button[data-team-toggle]');
  const name = btn?.dataset.teamToggle;
  if (!btn || !name) return;
  const known = knownPlugins();
  if (!known.includes(name)) return;
  const current = loadSelection(known);
  saveSelection(current.includes(name) ? current.filter((n) => n !== name) : [...current, name]);
  notifyChange();
});

document.addEventListener(TEAM_EVENT, sync);
sync();
