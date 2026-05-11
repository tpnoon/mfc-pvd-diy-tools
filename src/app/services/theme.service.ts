import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'mfc-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.initial());

  constructor() {
    effect(() => {
      const t = this.theme();
      document.documentElement.setAttribute('data-theme', t);
      try {
        localStorage.setItem(STORAGE_KEY, t);
      } catch (err) {
        // localStorage can throw in private-browsing mode, when quota is exceeded,
        // or when the host has disabled storage. Theme still applies in-memory for
        // the rest of the session; we just can't remember it next visit.
        console.debug('Theme persistence skipped:', err);
      }
    });
  }

  toggle() {
    this.theme.update(t => (t === 'light' ? 'dark' : 'light'));
  }

  set(t: Theme) {
    this.theme.set(t);
  }

  private initial(): Theme {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (err) {
      // Same private-mode story as setItem above. Fall through to OS preference.
      console.debug('Theme persistence read failed; falling back to OS preference:', err);
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
