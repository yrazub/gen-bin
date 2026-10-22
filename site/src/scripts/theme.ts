const KEY = 'gen-bin:theme';

function apply(choice: 'system' | 'light' | 'dark'): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

function store(choice: 'system' | 'light' | 'dark'): void {
  try {
    if (choice === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // storage blocked: the choice lasts while the page is open (EC-15)
  }
}

function current(): 'system' | 'light' | 'dark' {
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'light' || attr === 'dark' ? attr : 'system';
}

function init(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-theme-choice]');
  const sync = () => {
    const now = current();
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeChoice === now)));
  };
  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      const choice = b.dataset.themeChoice;
      if (choice !== 'system' && choice !== 'light' && choice !== 'dark') return;
      apply(choice);
      store(choice);
      sync();
    }),
  );
  sync();
}

init();
