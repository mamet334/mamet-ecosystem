
export function entitas(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

export function tanpaTag(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export function urlAsliBing(link) {
  try {
    const u = new URL(link);
    if (u.hostname.endsWith('bing.com') && u.pathname.toLowerCase().includes('apiclick')) {
      return u.searchParams.get('url') || link;
    }
  } catch {  }
  return link;
}
