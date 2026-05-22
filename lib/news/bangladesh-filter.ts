const KEYWORDS = [
  "bangladesh",
  "bangladeshi",
  "tigers",
  "mirpur",
  "sylhet",
  "chattogram",
  "chittagong",
  "shanto",
  "mushfiqur",
  "litton",
  "tamim",
  "mahmudullah",
  "mehidy",
  "taijul",
  "taskin",
  "mustafizur",
  "najmul",
  "soumya",
  "mehidy hasan",
  "tanzid",
  "jaker",
  "rishad",
  "hasan mahmud",
];

/** True when title + optional body mention Bangladesh cricket. */
export function isBangladeshCricketNews(title: string, body = ""): boolean {
  const text = `${title} ${body}`.toLowerCase();
  if (KEYWORDS.some((k) => text.includes(k))) return true;

  if (/\bban\b/.test(text) && /(cricket|test|odi|t20|series|innings|wicket)/.test(text)) {
    return true;
  }

  if (/\bvs\s+bangladesh\b|\bbangladesh\s+vs\b/.test(text)) return true;

  return false;
}
