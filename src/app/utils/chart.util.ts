import { Chart, registerables } from 'chart.js';

// Register Chart.js controllers once per bundle. Importing this module elsewhere
// guarantees Chart is ready without each component re-running register().
let _registered = false;
export function ensureChartsRegistered(): void {
  if (_registered) return;
  Chart.register(...registerables);
  _registered = true;
}

/** Read a CSS custom property from :root, trimmed. Returns '' if missing. */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
