import { createAdminClient } from "@/lib/supabase/server";

// Best-effort logo scrape: fetch the contractor's website, pick the best
// image candidate (og:image → apple-touch-icon → favicon), download it and
// store it in the public 'logos' bucket. Never throws — onboarding and
// settings must succeed even when this fails.

const HTML_BYTE_CAP = 512 * 1024;
const IMAGE_BYTE_CAP = 2 * 1024 * 1024;
const IMAGE_BYTE_MIN = 100;
const HTML_TIMEOUT_MS = 6_000;
const IMAGE_TIMEOUT_MS = 5_000;
const TOTAL_DEADLINE_MS = 12_000;
const MAX_DOWNLOAD_ATTEMPTS = 4;
const USER_AGENT = "QuoteMagicBot/1.0 (+https://quotemagic.app)";

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

export type LogoResult =
  | { ok: true; logoUrl: string }
  | { ok: false; reason: string };

export async function scrapeAndStoreLogo(
  websiteUrl: string,
  contractorId: string
): Promise<LogoResult> {
  try {
    const startedAt = Date.now();

    const pageUrl = normalizeUrl(websiteUrl);
    if (!pageUrl) return { ok: false, reason: "That doesn't look like a website address." };
    if (isBlockedHost(pageUrl.hostname)) {
      return { ok: false, reason: "That address can't be reached." };
    }

    const page = await fetchHtml(pageUrl);
    const candidates = page
      ? extractCandidates(page.html, page.finalUrl)
      : [];
    // Even without readable HTML, the well-known paths are worth a shot.
    const origin = (page ? new URL(page.finalUrl) : pageUrl).origin;
    candidates.push(`${origin}/apple-touch-icon.png`, `${origin}/favicon.ico`);

    let attempts = 0;
    for (const candidate of dedupe(candidates)) {
      if (attempts >= MAX_DOWNLOAD_ATTEMPTS) break;
      if (Date.now() - startedAt > TOTAL_DEADLINE_MS) break;
      attempts++;
      const image = await downloadImage(candidate);
      if (!image) continue;

      const admin = createAdminClient();
      const path = `${contractorId}/${Date.now()}.${MIME_EXT[image.mime]}`;
      const { error: uploadError } = await admin.storage
        .from("logos")
        .upload(path, image.bytes, { contentType: image.mime, upsert: true });
      if (uploadError) return { ok: false, reason: "Couldn't save the logo." };

      const { data } = admin.storage.from("logos").getPublicUrl(path);
      const { error: updateError } = await admin
        .from("contractors")
        .update({ logo_url: data.publicUrl })
        .eq("id", contractorId);
      if (updateError) return { ok: false, reason: "Couldn't save the logo." };

      return { ok: true, logoUrl: data.publicUrl };
    }

    return { ok: false, reason: "Couldn't find a usable logo on that site." };
  } catch {
    return { ok: false, reason: "Couldn't reach that website." };
  }
}

function normalizeUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

// Cheap SSRF guard: blocks the obvious local/private targets. We don't
// re-resolve DNS — acceptable for a prototype fetching public marketing sites.
function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.startsWith("[")) return true; // IPv6 literal — no real site needs this
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 0 || a === 10 || a === 127 || a === 169) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
  }
  return false;
}

async function fetchHtml(
  url: URL
): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(HTML_TIMEOUT_MS),
    });
    if (!res.ok || !res.body) return null;
    if (isBlockedHost(new URL(res.url).hostname)) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (type !== "text/html" && type !== "application/xhtml+xml") return null;

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < HTML_BYTE_CAP) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
    reader.cancel().catch(() => {});
    const html = new TextDecoder("utf-8", { fatal: false }).decode(
      concat(chunks, Math.min(total, HTML_BYTE_CAP))
    );
    return { html, finalUrl: res.url };
  } catch {
    return null;
  }
}

function concat(chunks: Uint8Array[], cap: number): Uint8Array {
  const out = new Uint8Array(cap);
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.byteLength, cap - offset);
    out.set(chunk.subarray(0, take), offset);
    offset += take;
    if (offset >= cap) break;
  }
  return out;
}

function getAttr(tag: string, name: string): string | null {
  const m = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")
  );
  return m ? (m[1] ?? m[2] ?? m[3]).trim() : null;
}

function largestSize(sizes: string | null): number {
  if (!sizes) return 0;
  let best = 0;
  for (const m of sizes.matchAll(/(\d+)x(\d+)/gi)) {
    best = Math.max(best, Number(m[1]));
  }
  return best;
}

function extractCandidates(html: string, baseUrl: string): string[] {
  const ogImages: string[] = [];
  const touchIcons: { href: string; size: number }[] = [];
  const icons: { href: string; size: number; score: number }[] = [];

  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const prop = (getAttr(tag, "property") ?? getAttr(tag, "name") ?? "").toLowerCase();
    if (prop === "og:image" || prop === "og:image:secure_url") {
      const content = getAttr(tag, "content");
      if (content) ogImages.push(content);
    }
  }

  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = (getAttr(tag, "rel") ?? "").toLowerCase();
    const href = getAttr(tag, "href");
    if (!href) continue;
    const size = largestSize(getAttr(tag, "sizes"));
    if (rel.includes("apple-touch-icon")) {
      touchIcons.push({ href, size });
    } else if (rel.split(/\s+/).includes("icon")) {
      const type = (getAttr(tag, "type") ?? "").toLowerCase();
      const score =
        type.includes("svg") || href.toLowerCase().includes(".svg")
          ? 2
          : type.includes("png") || href.toLowerCase().includes(".png")
            ? 1
            : 0;
      icons.push({ href, size, score });
    }
  }

  touchIcons.sort((a, b) => b.size - a.size);
  icons.sort((a, b) => b.score - a.score || b.size - a.size);

  const ordered = [
    ...ogImages,
    ...touchIcons.map((i) => i.href),
    ...icons.map((i) => i.href),
  ];

  const resolved: string[] = [];
  for (const href of ordered) {
    if (href.startsWith("data:")) continue;
    try {
      const abs = new URL(href, baseUrl);
      if (
        (abs.protocol === "https:" || abs.protocol === "http:") &&
        !isBlockedHost(abs.hostname)
      ) {
        resolved.push(abs.toString());
      }
    } catch {
      // skip unparseable hrefs
    }
  }
  return resolved;
}

function dedupe(urls: string[]): string[] {
  return [...new Set(urls)];
}

async function downloadImage(
  url: string
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!(mime in MIME_EXT)) return null;
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > IMAGE_BYTE_CAP) return null;
    const buffer = new Uint8Array(await res.arrayBuffer());
    if (buffer.byteLength < IMAGE_BYTE_MIN || buffer.byteLength > IMAGE_BYTE_CAP) {
      return null;
    }
    return { bytes: buffer, mime };
  } catch {
    return null;
  }
}
