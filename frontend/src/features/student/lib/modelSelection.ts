import type { ModelInfo } from '../api/student'

/**
 * Which models the student view ticks on page load.
 *
 * Registry-driven: the backend flags the demo defaults with `default_selected`
 * (see app/models_registry.py), so which models run on a zero-click "Try" is
 * decided in one place instead of being inferred from tier ordering here.
 * Expensive models are deliberately left unflagged — they stay selectable in
 * the picker, they are just never billed by a casual click.
 *
 * Unavailable models (provider key not configured) are never picked. If that
 * leaves nothing selected — no keys, or a registry with no defaults flagged —
 * fall back to the first available model so the UI is never left with an empty
 * selection.
 */
export function defaultSelection(models: ModelInfo[]): string[] {
  const available = models.filter((m) => m.available)
  const ids = available.filter((m) => m.default_selected).map((m) => m.id)
  return ids.length > 0 ? ids : available.slice(0, 1).map((m) => m.id)
}
