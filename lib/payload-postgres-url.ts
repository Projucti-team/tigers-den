/** Postgres connection string from env (server Postgres, or legacy hosted URL). */
export function getPostgresConnectionString(): string | null {
  const direct =
    process.env.POSTGRES_URL?.trim() || process.env.DATABASE_URL?.trim() || null;
  if (direct) return direct;

  const uri = process.env.DATABASE_URI?.trim();
  if (uri && /^postgres(ql)?:/i.test(uri)) return uri;

  return null;
}

export function isPostgresDatabase(): boolean {
  return getPostgresConnectionString() != null;
}
