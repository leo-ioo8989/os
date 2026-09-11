import type { OwnerIntent } from './intent.js';
import { WORKFORCE_CAPABILITIES, type WorkforceCapability } from './workforce.js';

export interface IntentCapabilityInference {
  capabilities: readonly WorkforceCapability[];
  rationale: string;
  requiresClarification: boolean;
}

type Rule = { capabilities: readonly WorkforceCapability[]; patterns: readonly RegExp[]; label: string };

const RULES: readonly Rule[] = [
  { label: 'web/frontend', capabilities: ['FRONTEND_DEVELOPMENT', 'SOFTWARE_ENGINEERING'], patterns: [/\bwebsite\b/i, /\blanding page\b/i, /\bweb app\b/i, /\bfrontend\b/i, /\bui\b/i, /\bhtml\b/i, /\bcss\b/i, /\breact\b/i] },
  { label: 'backend/api', capabilities: ['BACKEND_DEVELOPMENT', 'SOFTWARE_ENGINEERING'], patterns: [/\bbackend\b/i, /\bapi\b/i, /\bserver\b/i, /\bendpoint\b/i, /\bmicroservice\b/i] },
  { label: 'mobile', capabilities: ['SOFTWARE_ENGINEERING'], patterns: [/\bmobile app\b/i, /\bandroid\b/i, /\bios app\b/i, /\bflutter\b/i, /\breact native\b/i] },
  { label: 'software/debugging', capabilities: ['SOFTWARE_ENGINEERING'], patterns: [/\bsoftware\b/i, /\bcode\b/i, /\bprogram\b/i, /\bimplement\b/i, /\bdebug\b/i, /\bbug\b/i] },
  { label: 'architecture', capabilities: ['ARCHITECTURE'], patterns: [/\barchitect(?:ure|ural)\b/i, /\bsystem design\b/i, /\btechnical design\b/i] },
  { label: 'code-review/qa', capabilities: ['CODE_REVIEW', 'TECHNICAL_QA'], patterns: [/\bcode review\b/i, /\breview (?:the )?code\b/i, /\btest the code\b/i, /\bqa\b/i] },
  { label: 'ux/design', capabilities: ['UX_DESIGN', 'VISUAL_DESIGN'], patterns: [/\bux\b/i, /\buser experience\b/i, /\bwireframe\b/i, /\bprototype\b/i, /\bvisual design\b/i, /\bgraphic design\b/i, /\bbranding\b/i] },
  { label: 'content/copy', capabilities: ['COPYWRITING', 'CONTENT_QA'], patterns: [/\bcopywriting\b/i, /\bblog post\b/i, /\barticle\b/i, /\bwrite content\b/i, /\bemail copy\b/i, /\bcontent\b/i] },
  { label: 'seo', capabilities: ['SEO'], patterns: [/\bseo\b/i, /\bsearch engine optimization\b/i, /\bkeyword research\b/i] },
  { label: 'social', capabilities: ['SOCIAL_MEDIA'], patterns: [/\bsocial media\b/i, /\binstagram\b/i, /\btiktok\b/i, /\blinkedin\b/i, /\bsocial post\b/i] },
  { label: 'marketing/growth', capabilities: ['GROWTH_ANALYSIS', 'MARKET_ANALYSIS'], patterns: [/\bmarketing\b/i, /\bgrowth\b/i, /\bcampaign\b/i, /\bfunnel\b/i, /\bmarket(?:ing)? strategy\b/i] },
  { label: 'research', capabilities: ['WEB_RESEARCH', 'SOURCE_DISCOVERY'], patterns: [/\bresearch\b/i, /\binvestigate\b/i, /\bfind sources\b/i, /\bcompetitor research\b/i, /\bsource\b/i] },
  { label: 'academic', capabilities: ['ACADEMIC_RESEARCH'], patterns: [/\bacademic\b/i, /\bliterature review\b/i, /\bpaper\b/i, /\bscholarly\b/i] },
  { label: 'product', capabilities: ['PRODUCT_ANALYSIS'], patterns: [/\bproduct analysis\b/i, /\bproduct research\b/i, /\bproduct requirements\b/i, /\bprd\b/i] },
  { label: 'data/analytics', capabilities: ['DATA_ANALYSIS'], patterns: [/\bdata analysis\b/i, /\banalytics\b/i, /\bdashboard\b/i, /\bmetrics\b/i, /\bstatistics\b/i] },
  { label: 'video', capabilities: ['VIDEO_EDITING'], patterns: [/\bvideo\b/i, /\breel\b/i, /\bshort film\b/i, /\bediting\b/i] },
  { label: 'audio', capabilities: ['AUDIO_GENERATION'], patterns: [/\baudio\b/i, /\bvoiceover\b/i, /\bvoice\b/i, /\bpodcast\b/i, /\bmusic\b/i] },
  { label: 'presentation', capabilities: ['PRESENTATION_DESIGN'], patterns: [/\bpresentation\b/i, /\bslides\b/i, /\bdeck\b/i, /\bpowerpoint\b/i] },
  { label: 'security', capabilities: ['SECURITY_REVIEW'], patterns: [/\bsecurity\b/i, /\bthreat model\b/i, /\bvulnerability\b/i, /\bpenetration test\b/i, /\bprivacy review\b/i] },
  { label: 'market analysis', capabilities: ['MARKET_ANALYSIS'], patterns: [/\bmarket size\b/i, /\bmarket analysis\b/i, /\bcompetitor\b/i, /\bpricing analysis\b/i] },
];

const CAP_SET = new Set<string>(WORKFORCE_CAPABILITIES);

export function inferIntentCapabilities(intent: OwnerIntent): IntentCapabilityInference {
  const text = [intent.requestedOutcome, intent.businessContext, intent.projectContext, ...intent.constraints, ...intent.riskRequirements]
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
    .trim();
  const matched = RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(text)));
  const capabilities = [...new Set(matched.flatMap((rule) => rule.capabilities))].filter((cap) => CAP_SET.has(cap));
  if (capabilities.length === 0) {
    return { capabilities: [], rationale: 'No governed capability rule matched the owner intent; clarification or a governed capability extension is required.', requiresClarification: true };
  }
  return {
    capabilities,
    rationale: `Deterministic capability inference matched: ${matched.map((rule) => rule.label).join(', ')}.`,
    requiresClarification: false,
  };
}
