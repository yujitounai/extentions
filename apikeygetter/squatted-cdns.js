/* global self */
/**
 * 既知のスクワッティング / 侵害 CDN ドメイン（Polyfill.io サプライチェーン攻撃等）
 * @see https://sansec.io/research/polyfill-supply-chain-attack
 */
const SQUATTED_CDN_DOMAINS = [
  'polyfill.io',
  'polyfill.com',
  'polyfill.site',
  'polyfill.cloud',
  'polyfill.top',
  'bootcdn.net',
  'bootcdn.com',
  'bootcss.com',
  'staticfile.net',
  'staticfile.org',
  'staticfile.com',
  'unionadjs.com',
  'xhsbpza.com',
  'union.macoms.la',
  'newcrbpc.com',
  'googie-anaiytics.com',
  'kuurza.com',
];

const SQUATTED_CDN_SORTED = [...SQUATTED_CDN_DOMAINS].sort((a, b) => b.length - a.length);

function matchSquattedCdnHostname(hostname) {
  if (!hostname) return null;
  const host = hostname.toLowerCase();
  for (const domain of SQUATTED_CDN_SORTED) {
    if (host === domain || host.endsWith(`.${domain}`)) {
      return domain;
    }
  }
  return null;
}

function matchSquattedCdnUrl(url) {
  try {
    const parsed = new URL(url, typeof location !== 'undefined' ? location.href : undefined);
    const matchedDomain = matchSquattedCdnHostname(parsed.hostname);
    if (!matchedDomain) return null;
    return {
      url: parsed.href,
      hostname: parsed.hostname,
      matchedDomain,
    };
  } catch {
    return null;
  }
}

function squattedCdnHitKey(hit) {
  return `${hit.matchedDomain}|${hit.url}|${hit.source}`;
}

function dedupeSquattedCdnHits(hits) {
  const seen = new Set();
  return hits.filter((hit) => {
    const key = squattedCdnHitKey(hit);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

if (typeof self !== 'undefined') {
  self.SQUATTED_CDN_DOMAINS = SQUATTED_CDN_DOMAINS;
  self.matchSquattedCdnHostname = matchSquattedCdnHostname;
  self.matchSquattedCdnUrl = matchSquattedCdnUrl;
  self.dedupeSquattedCdnHits = dedupeSquattedCdnHits;
}
