/** Coolify/VPS deployments write to persistent volumes mounted under /app/data. */
export function canWriteProjectDataFiles(): boolean {
  return true;
}
