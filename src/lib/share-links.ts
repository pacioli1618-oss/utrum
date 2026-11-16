// Links people pass around. Framework-free and unit-tested: a wrong link here breaks the whole loop.
// Secrets (host and participant tokens) go in the #fragment: browsers never send it to the
// server, so it stays out of logs, analytics and link previews (docs/conventions.md, Routes).

/** List link, the one that can go to a WhatsApp group: people join with their own name. */
export function buildListUrl(origin: string, slug: string) {
  return `${origin}/l/${encodeURIComponent(slug)}`;
}

/** Host link: opens the list's management screen on any device. */
export function buildHostUrl(origin: string, slug: string, hostToken: string) {
  return `${origin}/l/${encodeURIComponent(slug)}/manage#${encodeURIComponent(hostToken)}`;
}

/** Personal link: opens one person's comparisons and ranking on another device. */
export function buildParticipantUrl(origin: string, slug: string, participantToken: string) {
  return `${origin}/l/${encodeURIComponent(slug)}/me#${encodeURIComponent(participantToken)}`;
}

/** Reads a token back from location.hash ("#abc" → "abc"); empty when missing. */
export function readTokenFromHash(hash: string) {
  try {
    return decodeURIComponent(hash.replace(/^#/, '')).trim();
  } catch {
    return '';
  }
}

/** "utrum.gr1618.io/l/sh3v2kw2nc2s": what people see, without the protocol. */
export function displayUrl(url: string) {
  return url.replace(/^https?:\/\//, '');
}

/** Opens WhatsApp (app on phones, web elsewhere) with the message ready to send. */
export function buildWhatsAppUrl(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Splits a pasted list into clean, distinct item labels, keeping the order. One item per line
 * (commas are allowed inside an item: "Arroz, feijão e farofa"); list bullets are dropped.
 */
export function parseItems(text: string) {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const label = line
      .replace(/^\s*(?:[-*•–]|\d+[.)])\s+/, '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 120);
    const key = label.toLocaleLowerCase();
    if (label && !seen.has(key)) {
      seen.add(key);
      items.push(label);
    }
  }
  return items;
}
