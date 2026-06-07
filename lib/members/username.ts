const HONORIFIC_PREFIXES = new Set(["md", "mr", "mrs", "ms", "dr", "prof", "sir"]);

export function slugifyUsername(input: string): string {
  const parts = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  while (
    parts.length > 1 &&
    (parts[0].length <= 2 || HONORIFIC_PREFIXES.has(parts[0]))
  ) {
    parts.shift();
  }

  const slug = parts
    .join("-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  return slug || "tiger";
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(username);
}
