/* global self */
const AVOID_DOMAINS = [
  'gmail.com',
  'amazon.com',
  'amazon.co.jp',
  'facebook.com',
  'youtube.com',
  'google.com',
  'x.com',
  'yahoo.co.jp',
];

const SECRET_PATTERNS = [
  { id: 'aws_access_key', name: 'AWS アクセスキー', regex: /AKIA[0-9A-Z]{16}/g },
  { id: 'aws_credentials', name: 'AWS Credentials', regex: /"Credentials"/g },
  { id: 'google_api_key', name: 'Google API キー', regex: /AIza[0-9A-Za-z\-_]{35}/g },
  { id: 'private_ip_192', name: 'プライベートIP (192.168)', regex: /192\.168\.[12]?\d{1,2}\.[12]?\d{1,2}/g },
  { id: 'private_ip_172', name: 'プライベートIP (172.x)', regex: /172\.[123]?\d?\.[12]?\d{1,2}\.[12]?\d{1,2}/g },
  { id: 's3_bucket', name: 'S3 Bucket URL', regex: /https?:\/\/[\w-]{1,255}?\.s3\.[\w-]{10,20}?\.amazonaws\.com\//g },
  { id: 'slack_token', name: 'Slack Token', regex: /xoxp-\d{13}-\d{13}-\d{13}-[\w]{32}/g },
  { id: 'uuid', name: 'UUID', regex: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi },
  { id: 'four_g_token', name: '4gtoken', regex: /4gtoken/g },
  { id: 'private_key', name: 'Private Key', regex: /-----BEGIN [\w]{2,3} PRIVATE KEY-----/g },
  { id: 'github_token', name: 'GitHub Access Token', regex: /[a-zA-Z0-9_-]*:[a-zA-Z0-9_\-]+@github\.com/g },
  { id: 'jwt', name: 'JSON Web Token', regex: /ey[A-Za-z0-9-_=]+\.ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]+/g },
  { id: 'yahoo_client_id', name: 'Yahoo! JAPAN Client ID', regex: /dj0[A-Za-z0-9]{52}-/g },
  { id: 'stripe_api_key', name: 'Stripe API Key', regex: /sk_(?:live|test|rk_live)_[0-9a-zA-Z]{24,}/g },
  { id: 'sendgrid_api_key', name: 'SendGrid API Key', regex: /SG\.[0-9A-Za-z_-]{22}\.[0-9A-Za-z_-]{43}/g },
  { id: 'openai_api_key', name: 'OpenAI API Key', regex: /sk-(?:proj-[a-zA-Z0-9_-]{40,}|[a-zA-Z0-9]{20}T3BlbkFJ[a-zA-Z0-9]{20})/g },
];

function shouldSkipDomain(hostname) {
  return AVOID_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function extractContext(text, matchStr, radius = 30) {
  const index = text.indexOf(matchStr);
  if (index === -1) return text.slice(0, 100) + '...';

  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + matchStr.length + radius);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < text.length ? '...' : '';
  return prefix + text.slice(start, end) + suffix;
}

function scanText(text, sourceType, context) {
  if (!text) return [];

  const results = [];
  for (const patternDef of SECRET_PATTERNS) {
    const regex = new RegExp(patternDef.regex.source, patternDef.regex.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      results.push({
        patternId: patternDef.id,
        patternName: patternDef.name,
        match: match[0],
        text: extractContext(text, match[0]),
        type: sourceType,
        context,
      });
    }
  }
  return results;
}

function resultKey(item) {
  return `${item.patternId}|${item.match}|${item.type}|${item.context || ''}`;
}

function dedupeResults(results) {
  const seen = new Set();
  return results.filter((item) => {
    const key = resultKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

if (typeof self !== 'undefined') {
  self.AVOID_DOMAINS = AVOID_DOMAINS;
  self.SECRET_PATTERNS = SECRET_PATTERNS;
  self.shouldSkipDomain = shouldSkipDomain;
  self.extractContext = extractContext;
  self.scanText = scanText;
  self.resultKey = resultKey;
  self.dedupeResults = dedupeResults;
}
