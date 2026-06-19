/** Lightweight env check — safe to import from scrape scripts (no Payload/sharp). */
export function isPayloadConfigured(): boolean {
  return Boolean(process.env.PAYLOAD_SECRET?.trim());
}
