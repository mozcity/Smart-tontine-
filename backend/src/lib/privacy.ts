/**
 * Numéro masqué pour les autres membres d'un groupe (audit du 05/10/2026) : « +226 70 •• •• 56 ».
 * Seuls l'organisateur (ou l'administrateur du coffre) et le membre lui-même voient le numéro complet.
 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const m = /^(\+\d{3})(\d{2})\d*(\d{2})$/.exec(phone);
  return m ? `${m[1]} ${m[2]} •• •• ${m[3]}` : '••••••';
}

export const withMaskedPhones = <T extends { id: string; phone: string | null }>(rows: T[], viewerId: string, fullAccess: boolean) =>
  rows.map((r) => (fullAccess || r.id === viewerId ? r : { ...r, phone: maskPhone(r.phone) }));
