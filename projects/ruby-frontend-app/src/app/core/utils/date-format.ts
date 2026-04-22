/**
 * Shared date formatters for admin screens.
 *
 * Accepts ISO-8601 strings (backend default) and already-formatted dd/MM/yyyy
 * strings. Returns '' on empty / invalid input so templates stay clean.
 */

/** `19/02/2026, 09:20` — zero-padded day/month/year plus 24h time. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}, ${hh}:${mi}`;
}

/** `15/6/2023` — day/month/year, no padding on day or month, no time. */
export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}
