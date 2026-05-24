export function getMemberDisplayName(
  name?: string | null,
  email?: string | null,
): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;

  const local = email?.split("@")[0]?.trim();
  if (local) return local;

  return "Member";
}
