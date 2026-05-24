/** Vercel serverless has a read-only project filesystem; only git-tracked `data/` is readable. */
export function canWriteProjectDataFiles(): boolean {
  return process.env.VERCEL !== "1";
}
