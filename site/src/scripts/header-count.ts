import { knownPlugins, loadSelection, TEAM_EVENT } from '../lib/team/selection';

function update(): void {
  const badge = document.querySelector<HTMLElement>('[data-team-count]');
  if (!badge) return;
  const n = loadSelection(knownPlugins()).length;
  badge.hidden = n === 0;
  const hidden = document.createElement('span');
  hidden.className = 'visually-hidden';
  hidden.textContent = n === 1 ? ' plugin selected' : ' plugins selected';
  badge.replaceChildren(document.createTextNode(String(n)), hidden);
}

update();
document.addEventListener(TEAM_EVENT, update);
