/**
 * Maps the BlockReason enum emitted by auth-service (UPPER_SNAKE_CASE) to the
 * Spanish label shown in every admin / auth screen.
 *
 * Single source of truth for block-reason translation. Keys must stay in sync
 * with `auth-service/.../model/enums/BlockReason.java` and with the
 * `<option value="…">` list in admin gestión de reportes / gestión de usuarios.
 *
 * Used by:
 *  - welcome.page.ts        (blocked-account modal on login)
 *  - gestion-usuarios.page  (card + detail modal)
 */
export const BLOCK_REASON_LABELS: Record<string, string> = {
  HARASSMENT_OR_BULLYING: 'Acoso o bullying',
  INCITEMENT_TO_VIOLENCE: 'Incitación a la violencia',
  RACISM_OR_DISCRIMINATION: 'Racismo o discriminación',
  INAPPROPRIATE_CONTENT: 'Contenido inapropiado',
  SPAM_OR_ADVERTISING: 'Spam o publicidad',
};

/** Returns the Spanish label for a block-reason enum, or a fallback if unknown. */
export function translateBlockReason(raw: string | null | undefined): string {
  if (!raw) return 'Sin motivo especificado';
  return BLOCK_REASON_LABELS[raw] ?? raw;
}
