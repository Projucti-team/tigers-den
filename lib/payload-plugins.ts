import type { Plugin } from "payload";

/** No external storage plugin: uploads stay on local/persistent media volume. */
export function getPayloadPlugins(): Plugin[] {
  return [];
}
