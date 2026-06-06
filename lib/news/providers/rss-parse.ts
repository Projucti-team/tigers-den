import { decodeHtmlEntities } from "@/lib/news/http";

export type ParsedRssItem = {
  title: string;
  description: string;
  link: string;
  guid: string;
  pubDate: string;
  imageUrl?: string;
};

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function readTag(block: string, tag: string): string {
  const cdata = block.match(
    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"),
  )?.[1];
  if (cdata !== undefined) return cdata.trim();

  const inner = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1];
  return inner ? stripTags(inner) : "";
}

export function parseRssItems(xml: string): ParsedRssItem[] {
  const items: ParsedRssItem[] = [];
  const itemBlocks = xml.split(/<item>/i).slice(1);

  for (const block of itemBlocks) {
    const title = readTag(block, "title");
    const description = readTag(block, "description");
    const link =
      block.match(/<url>([^<]*)<\/url>/i)?.[1]?.trim() ||
      block.match(/<link>([^<]*)<\/link>/i)?.[1]?.trim();
    const guid =
      block.match(/<guid[^>]*>([^<]*)<\/guid>/i)?.[1]?.trim() ||
      block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1]?.trim() ||
      link ||
      "";
    const pubDate = readTag(block, "pubDate");
    const imageUrl =
      block.match(/<coverImages>([^<]*)<\/coverImages>/i)?.[1]?.trim() ||
      block.match(/url="([^"]+)"[^>]*medium="image"/i)?.[1]?.trim() ||
      block.match(/<enclosure[^>]+url="([^"]+)"[^>]*type="image/i)?.[1]?.trim();

    if (!title || !link) continue;
    items.push({ title, description, link, guid, pubDate, imageUrl });
  }

  return items;
}
