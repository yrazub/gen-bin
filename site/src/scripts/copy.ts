const timers = new WeakMap<HTMLButtonElement, number>();

function flash(btn: HTMLButtonElement, label: string, ms: number): void {
  const idle = btn.dataset.idleLabel ?? btn.textContent ?? 'Copy';
  btn.dataset.idleLabel = idle;
  const idleAria = btn.dataset.idleAria ?? btn.getAttribute('aria-label') ?? '';
  btn.dataset.idleAria = idleAria;
  btn.textContent = label;
  btn.setAttribute('aria-label', label);
  window.clearTimeout(timers.get(btn));
  timers.set(
    btn,
    window.setTimeout(() => {
      btn.textContent = idle;
      btn.setAttribute('aria-label', idleAria);
    }, ms),
  );
}

/** EC-12: without the clipboard API, select the command so the user can copy it by hand. */
function selectText(btn: HTMLButtonElement): void {
  const code = btn.closest('[data-copy-box]')?.querySelector('code');
  const selection = window.getSelection();
  if (code && selection) selection.selectAllChildren(code);
}

document.addEventListener('click', async (event) => {
  const btn = (event.target as Element | null)?.closest<HTMLButtonElement>('button[data-copy]');
  if (!btn) return;
  const text = btn.dataset.copy ?? '';
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
    await navigator.clipboard.writeText(text);
    flash(btn, '✓ Copied', 2000);
  } catch {
    selectText(btn);
    flash(btn, 'Press Ctrl/Cmd+C', 4000);
  }
});
