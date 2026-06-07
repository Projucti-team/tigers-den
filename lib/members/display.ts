/** Title-case display name — avoids ALL CAPS from Google OAuth. */
export function formatMemberDisplayName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 2 && /^[A-Z.]+$/.test(word)) {
        return word.replace(/\./g, "").toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
