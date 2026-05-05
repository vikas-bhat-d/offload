/**
 * Offload -- Link Metadata Service
 *
 * Fetches structured metadata for any URL.
 * Platform-specific oEmbed for YouTube, Spotify, Reddit.
 * OG tag fallback for Instagram, Twitter/X, GitHub, and generic URLs.
 *
 * No API keys required -- all endpoints are public.
 */

export type Platform =
  | 'youtube'
  | 'instagram'
  | 'twitter'
  | 'spotify'
  | 'reddit'
  | 'github'
  | 'generic';

export interface LinkMetadata {
  url: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  sourceName: string;
  platform: Platform;
  /** Concatenated title + description -- fed to the embedding model */
  embedText: string;
}

// ─── Platform Detection ──────────────────────────────

export function detectPlatform(url: string): Platform {
  try {
    const {hostname}  = new URL(url);
    const host = hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'youtu.be') return 'youtube';
    if (host === 'instagram.com') return 'instagram';
    if (host === 'twitter.com' || host === 'x.com') return 'twitter';
    if (host === 'open.spotify.com') return 'spotify';
    if (host === 'reddit.com' || host === 'redd.it') return 'reddit';
    if (host === 'github.com') return 'github';
    return 'generic';
  } catch {
    return 'generic';
  }
}

export function platformLabel(platform: Platform): string {
  const labels: Record<Platform, string> = {
    youtube: 'YouTube',
    instagram: 'Instagram',
    twitter: 'X (Twitter)',
    spotify: 'Spotify',
    reddit: 'Reddit',
    github: 'GitHub',
    generic: 'Web',
  };
  return labels[platform];
}

// ─── Fetch Helpers ───────────────────────────────────

const FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOEmbed(oEmbedUrl: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetchWithTimeout(oEmbedUrl, {
      headers: { 'User-Agent': 'Offload/1.0 (oEmbed consumer)' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── OG Tag Parser ───────────────────────────────────

function extractOGTag(html: string, property: string): string | null {
  // Handles both property= and name= variants, and both attribute orderings
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']og:${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:${property}["']`, 'i'),
    new RegExp(`<meta[^>]+(?:property|name)=["']twitter:${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']twitter:${property}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }
  return null;
}

function extractTitle(html: string): string | null {
  const og = extractOGTag(html, 'title');
  if (og) return og;
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : null;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

async function fetchOGTags(url: string): Promise<{
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Offload/1.0; +https://offload.app)',
        Accept: 'text/html',
      },
    });
    if (!res.ok) return { title: null, description: null, image: null, siteName: null };
    const html = await res.text();
    // Only parse the <head> to avoid reading large bodies
    const head = html.slice(0, 100000);
    console.log(head)
    const data= {
      title: extractTitle(head),
      description: extractOGTag(head, 'description'),
      image: extractOGTag(head, 'image'),
      siteName: extractOGTag(head, 'site_name'),
    };
    console.log(data);
    return data
  } catch {
    return { title: null, description: null, image: null, siteName: null };
  }
}

// ─── Per-Platform Fetchers ───────────────────────────

async function fetchYouTubeMeta(url: string): Promise<Partial<LinkMetadata>> {
  const oembed = await fetchOEmbed(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  );
  if (oembed) {
    return {
      title: oembed.title ?? '',
      description: oembed.author_name ? `by ${oembed.author_name}` : '',
      thumbnailUrl: oembed.thumbnail_url ?? null,
      sourceName: 'YouTube',
    };
  }
  // Fallback to OG tags
  const og = await fetchOGTags(url);
  return {
    title: og.title ?? '',
    description: og.description ?? '',
    thumbnailUrl: og.image ?? null,
    sourceName: 'YouTube',
  };
}

async function fetchSpotifyMeta(url: string): Promise<Partial<LinkMetadata>> {
  const oembed = await fetchOEmbed(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
  );
  if (oembed) {
    return {
      title: oembed.title ?? '',
      description: oembed.provider_name ?? 'Spotify',
      thumbnailUrl: oembed.thumbnail_url ?? null,
      sourceName: 'Spotify',
    };
  }
  const og = await fetchOGTags(url);
  return {
    title: og.title ?? '',
    description: og.description ?? '',
    thumbnailUrl: og.image ?? null,
    sourceName: 'Spotify',
  };
}

async function fetchRedditMeta(url: string): Promise<Partial<LinkMetadata>> {
  const oembed = await fetchOEmbed(
    `https://www.reddit.com/oembed?url=${encodeURIComponent(url)}`,
  );
  if (oembed) {
    return {
      title: oembed.title ?? '',
      description: oembed.author_name ? `r/${oembed.author_name}` : '',
      thumbnailUrl: oembed.thumbnail_url ?? null,
      sourceName: 'Reddit',
    };
  }
  const og = await fetchOGTags(url);
  return {
    title: og.title ?? '',
    description: og.description ?? '',
    thumbnailUrl: og.image ?? null,
    sourceName: 'Reddit',
  };
}

async function fetchTwitterMeta(url: string): Promise<Partial<LinkMetadata>> {
  // Twitter oEmbed is increasingly restricted; OG tags are the reliable path
  const og = await fetchOGTags(url);
  // Try oEmbed as secondary attempt
  const oembed = await fetchOEmbed(
    `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`,
  );
  const authorMatch = oembed?.html?.match(/@(\w+)/);
  return {
    title: og.title ?? (oembed ? 'Tweet' : 'X post'),
    description: og.description ?? (authorMatch ? `by @${authorMatch[1]}` : ''),
    thumbnailUrl: og.image ?? null,
    sourceName: 'X (Twitter)',
  };
}

async function fetchInstagramMeta(url: string): Promise<Partial<LinkMetadata>> {
  // Instagram blocks most crawlers; attempt OG tags and accept graceful failure
  const og = await fetchOGTags(url);
  return {
    title: og.title ?? 'Instagram post',
    description: og.description ?? '',
    thumbnailUrl: og.image ?? null,
    sourceName: 'Instagram',
  };
}

async function fetchGitHubMeta(url: string): Promise<Partial<LinkMetadata>> {
  const og = await fetchOGTags(url);
  return {
    title: og.title ?? '',
    description: og.description ?? '',
    thumbnailUrl: og.image ?? null,
    sourceName: 'GitHub',
  };
}

async function fetchGenericMeta(url: string): Promise<Partial<LinkMetadata>> {
  const og = await fetchOGTags(url);
  let siteName = og.siteName;
  if (!siteName) {
    try {
      siteName = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      siteName = 'Web';
    }
  }
  return {
    title: og.title ?? '',
    description: og.description ?? '',
    thumbnailUrl: og.image ?? null,
    sourceName: siteName,
  };
}

// ─── Main Export ─────────────────────────────────────

export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  const platform = detectPlatform(url);

  const fetchers: Record<Platform, (u: string) => Promise<Partial<LinkMetadata>>> = {
    youtube: fetchYouTubeMeta,
    spotify: fetchSpotifyMeta,
    reddit: fetchRedditMeta,
    twitter: fetchTwitterMeta,
    instagram: fetchInstagramMeta,
    github: fetchGitHubMeta,
    generic: fetchGenericMeta,
  };

  let partial: Partial<LinkMetadata>;
  try {
    partial = await fetchers[platform](url);
  } catch {
    partial = {};
  }

  const title = partial.title?.trim() || url;
  const description = (partial.description ?? '').trim();
  // Truncate description to ~300 chars for embedding efficiency
  const descTruncated = description.length > 300 ? description.slice(0, 297) + '...' : description;

  const embedText = descTruncated ? `${title}. ${descTruncated}` : title;

  return {
    url,
    title,
    description: descTruncated,
    thumbnailUrl: partial.thumbnailUrl ?? null,
    sourceName: partial.sourceName ?? platformLabel(platform),
    platform,
    embedText,
  };
}

/** Quick check: does the string look like a URL? */
export function isUrl(text: string): boolean {
  return /^https?:\/\/[^\s]{4,}/i.test(text.trim());
}
