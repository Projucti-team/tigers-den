/**
 * ESPNcricinfo profile URLs end in "-{numericId}" (players: /cricketers/{slug}-{id}, teams:
 * /team/{slug}-{id}) and that trailing number IS the ESPN Core API id directly — confirmed live:
 * espncricinfo.com/cricketers/hasan-mahmud-926629 -> core.espnuk.org/.../athletes/926629 (same
 * "Hasan Mahmud"); espncricinfo.com/team/kent-1098 -> core.espnuk.org/.../teams/1098 (same
 * "Kent"). No separate id-mapping step needed, unlike series/tour ids which differ between the
 * two systems.
 */
export function parseCricinfoTrailingId(url: string): number | null {
  const match = url.trim().match(/-(\d+)\/?(?:[?#].*)?$/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}
