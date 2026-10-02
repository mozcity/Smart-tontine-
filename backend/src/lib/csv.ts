/**
 * Cellule CSV sûre : guillemets doublés, et neutralisation des formules (=, +, -, @, tabulation) pour qu'un nom
 * de groupe ou un libellé saisi par un membre ne s'exécute pas à l'ouverture dans Excel (injection CSV).
 */
export function csvCell(v: unknown): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(?:[.,]\d+)?$/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
