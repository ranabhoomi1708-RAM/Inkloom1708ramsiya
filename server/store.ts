import crypto from 'node:crypto';
import type {
  ApprovedFact,
  ApprovedFactOut,
  AuditEvent,
  Brand,
  FeedbackReport,
  Finding,
  Guideline,
  Membership,
  Organization,
  Review,
  Rule,
  Submission,
  SubmissionVersion,
  User,
} from './types.ts';

export interface InkloomStore {
  organizations: Organization[];
  users: User[];
  memberships: Membership[];
  brands: Brand[];
  guidelines: Guideline[];
  facts: ApprovedFact[];
  rules: Rule[];
  submissions: Submission[];
  submissionVersions: SubmissionVersion[];
  findings: Finding[];
  reviews: Review[];
  auditEvents: AuditEvent[];
  feedbackReports: FeedbackReport[];
  nextIds: {
    org: number;
    user: number;
    membership: number;
    brand: number;
    guideline: number;
    fact: number;
    rule: number;
    submission: number;
    version: number;
    finding: number;
    review: number;
    audit: number;
    feedback: number;
  };
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`inkloom-salt:${password}`).digest('hex');
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  return hashPassword(password) === passwordHash;
}

function nowIso(): string {
  return new Date().toISOString();
}

function daysAgoIso(days: number, hoursOffset = 0): string {
  const d = new Date(Date.now() - days * 86400_000 + hoursOffset * 3600_000);
  return d.toISOString();
}

export function createSeededStore(): InkloomStore {
  const demoPwd = hashPassword('DemoPassword123!');
  const ts = nowIso();

  const organizations: Organization[] = [
    {
      id: 1,
      name: 'GlowLeaf',
      slug: 'glowleaf',
      industry: 'skincare',
      settings: {
        enabled_rule_packs: [
          'india_ads',
          'dark_patterns',
          'greenwashing',
          'influencer',
          'pricing_offers',
          'health_claims',
          'accessibility',
          'brand_voice',
        ],
      },
      created_at: daysAgoIso(30),
    },
    {
      id: 2,
      name: 'BrightByte',
      slug: 'brightbyte',
      industry: 'electronics',
      settings: {
        enabled_rule_packs: [
          'india_ads',
          'pricing_offers',
          'greenwashing',
          'accessibility',
          'brand_voice',
        ],
      },
      created_at: daysAgoIso(20),
    },
  ];

  const users: User[] = [
    {
      id: 1,
      email: 'admin@glowleaf.in',
      name: 'Priya Sharma',
      role: 'admin',
      department: 'Brand Governance',
      password_hash: demoPwd,
      is_active: true,
      created_at: daysAgoIso(30),
    },
    {
      id: 2,
      email: 'employee@glowleaf.in',
      name: 'Arjun Mehta',
      role: 'employee',
      department: 'Performance Marketing',
      password_hash: demoPwd,
      is_active: true,
      created_at: daysAgoIso(30),
    },
    {
      id: 3,
      email: 'manager@glowleaf.in',
      name: 'Kavita Rao',
      role: 'manager',
      department: 'Legal & Compliance',
      password_hash: demoPwd,
      is_active: true,
      created_at: daysAgoIso(30),
    },
    {
      id: 4,
      email: 'admin@brightbyte.io',
      name: 'Vikram Das',
      role: 'admin',
      department: 'Product Leadership',
      password_hash: demoPwd,
      is_active: true,
      created_at: daysAgoIso(20),
    },
    {
      id: 5,
      email: 'employee@brightbyte.io',
      name: 'Ritu Verma',
      role: 'employee',
      department: 'Growth Marketing',
      password_hash: demoPwd,
      is_active: true,
      created_at: daysAgoIso(20),
    },
  ];

  const memberships: Membership[] = [
    { id: 1, user_id: 1, org_id: 1, role: 'admin', department: 'Brand Governance', is_active: true, created_at: daysAgoIso(30) },
    { id: 2, user_id: 2, org_id: 1, role: 'employee', department: 'Performance Marketing', is_active: true, created_at: daysAgoIso(30) },
    { id: 3, user_id: 3, org_id: 1, role: 'manager', department: 'Legal & Compliance', is_active: true, created_at: daysAgoIso(30) },
    { id: 4, user_id: 4, org_id: 2, role: 'admin', department: 'Product Leadership', is_active: true, created_at: daysAgoIso(20) },
    { id: 5, user_id: 5, org_id: 2, role: 'employee', department: 'Growth Marketing', is_active: true, created_at: daysAgoIso(20) },
    { id: 6, user_id: 2, org_id: 2, role: 'employee', department: 'External Marketing', is_active: true, created_at: daysAgoIso(15) },
  ];

  const brands: Brand[] = [
    {
      id: 1,
      org_id: 1,
      name: 'GlowLeaf',
      tagline: 'Pure Botanical Radiance, Backed by Science',
      logo_url: '/sample_data/glowleaf_logo.png',
      palette: {
        cream: '#F7F4EC',
        warm_white: '#FFFDF9',
        deep_teal: '#133B3B',
        teal: '#1A6B66',
        coral: '#E8775D',
        mint: '#DCEEEB',
        blush: '#FAE3DC',
      },
      created_at: daysAgoIso(30),
    },
    {
      id: 2,
      org_id: 2,
      name: 'BrightByte',
      tagline: 'Engineered Precision for the Connected World',
      logo_url: null,
      palette: {
        navy: '#0B192C',
        electric_blue: '#1E3E62',
        cyan: '#00ADB5',
        white: '#EEEEEE',
      },
      created_at: daysAgoIso(20),
    },
  ];

  const guidelines: Guideline[] = [
    {
      id: 1,
      org_id: 1,
      title: 'GlowLeaf Brand Guidelines & Voice 2026',
      filename: 'glowleaf_brand_voice_2026.txt',
      content_text:
        "GlowLeaf Core Values: We believe in transparent botanical skincare backed by rigorous clinical trials.\n" +
        "Tone: Calm, empowering, scientifically grounded. Never hyperbolic, sensationalist, or guilt-inducing.\n" +
        "Forbidden terms: 'Miracle', 'Instant Magic', 'Poreless Skin', '100% Guaranteed Cure'.\n" +
        "Mandatory statements: Chemical exfoliants (AHA/BHA/Retinoids) must always mandate daily broad-spectrum SPF 30+.",
      created_at: daysAgoIso(25),
    },
    {
      id: 2,
      org_id: 1,
      title: 'GlowLeaf India Ad Compliance Checklist (ASCI & CCPA 2022)',
      filename: 'india_ad_code_guide.txt',
      content_text:
        "Checklist aid, not legal advice.\n" +
        "1. Claims of complete elimination of medical conditions (such as acne or melasma) violate ASCI Code.\n" +
        "2. All quantitative claims (percentages, days, reductions) must link to verified clinical trial dossiers.\n" +
        "3. Before-and-after imagery must state whether lighting, makeup, or retouching was employed.\n" +
        "4. Endorsements must reflect genuine user testimonials.",
      created_at: daysAgoIso(24),
    },
    {
      id: 3,
      org_id: 2,
      title: 'BrightByte Engineering & Consumer Device Voice 2026',
      filename: 'brightbyte_guidelines_2026.txt',
      content_text:
        "BrightByte Ethos: Precision audio engineering and sustainable consumer electronics.\n" +
        "Tone: Minimalist, analytical, confident.\n" +
        "Battery Claims: Always state test conditions (playback volume, codec, ANC state).\n" +
        "Waterproofing: Never claim '100% waterproof'; state certified IP rating (e.g. IP68).",
      created_at: daysAgoIso(18),
    },
  ];

  // GlowLeaf 12 facts (IDs 1..12) + BrightByte 4 facts (IDs 13..16)
  const facts: ApprovedFact[] = [
    {
      id: 1,
      org_id: 1,
      statement: 'Formulation GL-A1 contained 1% unencapsulated Salicylic Acid with a 3-week stability window.',
      source: 'Formulation Log 2023-Archived',
      version: 1,
      valid_until: '2024-01-01',
      supersedes_id: null,
      created_at: daysAgoIso(90),
    },
    {
      id: 2,
      org_id: 1,
      statement: 'Formulation GL-A2 contains 2% Encapsulated Salicylic Acid from organic willow bark with a 24-month stability window.',
      source: 'R&D Dossier GL-RD-2025-04',
      version: 2,
      valid_until: '2028-12-31',
      supersedes_id: 1,
      created_at: daysAgoIso(25),
    },
    {
      id: 3,
      org_id: 1,
      statement: 'Preliminary in-vitro study 2022 indicated 25% bacterial inhibition in petri dish assays.',
      source: 'Internal Lab Memo GL-LM-2022-01',
      version: 1,
      valid_until: '2023-12-31',
      supersedes_id: null,
      created_at: daysAgoIso(120),
    },
    {
      id: 4,
      org_id: 1,
      statement: 'Clinically proven to reduce inflammatory acne lesions by up to 42% after 6 weeks of continuous twice-daily application.',
      source: 'Dermatological Clinical Trial GL-CT-2024-B, n=60 participants',
      version: 1,
      valid_until: '2027-12-31',
      supersedes_id: null,
      created_at: daysAgoIso(22),
    },
    {
      id: 5,
      org_id: 1,
      statement: '88% of trial participants reported a visible reduction in facial redness within 14 days.',
      source: 'Dermatological Clinical Trial GL-CT-2024-B (Subjective Self-Assessment)',
      version: 1,
      valid_until: '2027-12-31',
      supersedes_id: null,
      created_at: daysAgoIso(22),
    },
    {
      id: 6,
      org_id: 1,
      statement: '100% vegan, cruelty-free, and dermatologically tested on sensitive Indian skin types (Fitzpatrick types III-V).',
      source: 'Dermatological Safety Panel GL-SP-2025-01',
      version: 1,
      valid_until: '2028-06-30',
      supersedes_id: null,
      created_at: daysAgoIso(21),
    },
    {
      id: 7,
      org_id: 1,
      statement: 'Formulated at an optimal barrier-friendly pH of 5.2 - 5.6.',
      source: 'GL Quality Control Batch Certificate QC-2026-B12',
      version: 1,
      valid_until: '2027-12-31',
      supersedes_id: null,
      created_at: daysAgoIso(20),
    },
    {
      id: 8,
      org_id: 1,
      statement: 'Contains cold-pressed Gotu Kola (Centella Asiatica) sourced ethically from organic cooperative farms in Kerala.',
      source: 'Supplier Ethical Sourcing Certificate SC-2025-KER-09',
      version: 1,
      valid_until: '2028-01-31',
      supersedes_id: null,
      created_at: daysAgoIso(19),
    },
    {
      id: 9,
      org_id: 1,
      statement: 'Non-comedogenic rating verified by independent laboratory sebumeter testing.',
      source: 'Independent Lab Report ILR-2025-NC4',
      version: 1,
      valid_until: '2027-09-30',
      supersedes_id: null,
      created_at: daysAgoIso(18),
    },
    {
      id: 10,
      org_id: 1,
      statement: 'Free from synthetic fragrances, drying alcohols, parabens, and phthalates.',
      source: 'Clean Formulation Policy Doc CFP-2026',
      version: 1,
      valid_until: '2029-12-31',
      supersedes_id: null,
      created_at: daysAgoIso(17),
    },
    {
      id: 11,
      org_id: 1,
      statement: 'Packaging is made with 85% post-consumer recycled (PCR) amber glass.',
      source: 'Sustainability Audit Report SA-2025-PKG',
      version: 1,
      valid_until: '2028-12-31',
      supersedes_id: null,
      created_at: daysAgoIso(16),
    },
    {
      id: 12,
      org_id: 1,
      statement: 'Clinical hydration index increased by 31% measured via corneometer at 4 hours post-application.',
      source: 'Corneometry Study GL-CS-2025-03',
      version: 1,
      valid_until: '2027-12-31',
      supersedes_id: null,
      created_at: daysAgoIso(15),
    },
    // BrightByte facts
    {
      id: 13,
      org_id: 2,
      statement: 'Battery delivers up to 48 hours of continuous audio playback at 50% volume with ANC disabled.',
      source: 'sample, replace with your own (Battery Benchmark Report BB-2026-E)',
      version: 1,
      valid_until: '2028-12-31',
      supersedes_id: null,
      created_at: daysAgoIso(18),
    },
    {
      id: 14,
      org_id: 2,
      statement: 'Chassis manufactured with 75% post-consumer recycled aluminum alloy.',
      source: 'sample, replace with your own (Material Sourcing Certificate MS-2026-AL)',
      version: 1,
      valid_until: '2028-12-31',
      supersedes_id: null,
      created_at: daysAgoIso(18),
    },
    {
      id: 15,
      org_id: 2,
      statement: 'Fast-Charging delivers up to 8 hours of playback from a 10-minute charge.',
      source: 'sample, replace with your own (Power Engineering Dossier PED-2025-09)',
      version: 1,
      valid_until: '2028-06-30',
      supersedes_id: null,
      created_at: daysAgoIso(18),
    },
    {
      id: 16,
      org_id: 2,
      statement: 'IP68 water and dust resistance rating certified under IEC Standard 60529.',
      source: 'sample, replace with your own (IEC Ingress Protection Certificate IP-2025-88)',
      version: 1,
      valid_until: '2027-12-31',
      supersedes_id: null,
      created_at: daysAgoIso(18),
    },
  ];

  // GlowLeaf 15 Rules (IDs 1..15) + BrightByte 3 Rules (IDs 16..18)
  const rules: Rule[] = [
    {
      id: 1,
      org_id: 1,
      title: 'No 100% Absolute Acne Elimination Claims',
      type: 'claim',
      severity: 'high',
      pack: 'india_ad_code',
      description: 'Never claim 100% cure, permanent removal, or instant overnight acne eradication. Violates ASCI Code and CCPA 2022 guidelines on substantiated claims.',
      disclaimer: 'Checklist aid, not legal advice.',
      is_active: true,
      created_at: daysAgoIso(25),
    },
    {
      id: 2,
      org_id: 1,
      title: 'Prohibit Hyperbolic Tone (Miracle / Magic)',
      type: 'tone',
      severity: 'medium',
      pack: 'brand_voice',
      description: "Do not use words like 'miracle', 'instant magic', or 'potion'. GlowLeaf maintains an evidence-based dermatological tone.",
      disclaimer: 'Checklist aid, not legal advice.',
      is_active: true,
      created_at: daysAgoIso(25),
    },
    {
      id: 3,
      org_id: 1,
      title: 'Substantiate Any Quantitative Percentage',
      type: 'claim',
      severity: 'high',
      pack: 'claim_evidence',
      description: 'Any claim containing a numeric percentage must cite an approved fact with clinical trial registration.',
      disclaimer: 'Checklist aid, not legal advice.',
      is_active: true,
      created_at: daysAgoIso(25),
    },
    {
      id: 4,
      org_id: 1,
      title: 'Mandatory Daily Sunscreen Reminder for Exfoliants',
      type: 'regulatory',
      severity: 'medium',
      pack: 'india_ad_code',
      description: 'Any marketing copy featuring salicylic acid, glycolic acid, or AHAs/BHAs must include a warning to apply SPF daily.',
      disclaimer: 'Checklist aid, not legal advice.',
      is_active: true,
      created_at: daysAgoIso(25),
    },
    {
      id: 5,
      org_id: 1,
      title: 'Visual Logo Margin and Clearspace',
      type: 'visual',
      severity: 'low',
      pack: 'visual_design',
      description: 'The GlowLeaf logo must maintain minimum clearspace equal to 1.5x the height of the brand leaf mark.',
      disclaimer: 'Checklist aid, not legal advice.',
      is_active: true,
      created_at: daysAgoIso(25),
    },
    {
      id: 6,
      org_id: 1,
      title: 'WCAG AA Color Contrast Requirement',
      type: 'accessibility',
      severity: 'medium',
      pack: 'visual_design',
      description: 'Text on colored backgrounds must satisfy minimum WCAG AA contrast ratio of 4.5:1.',
      disclaimer: 'Checklist aid, not legal advice.',
      is_active: true,
      created_at: daysAgoIso(25),
    },
    {
      id: 7,
      org_id: 1,
      title: 'No Unverified Permanent Cure Claims',
      type: 'claim',
      severity: 'high',
      pack: 'india_ad_code',
      description: "Skin blemishes fluctuate with hormones and diet; claims of 'permanent cure' are deceptive under consumer protection rules.",
      disclaimer: 'Checklist aid, not legal advice.',
      is_active: true,
      created_at: daysAgoIso(25),
    },
    {
      id: 8,
      org_id: 1,
      title: 'Approved Ingredient Origin Verification',
      type: 'terminology',
      severity: 'medium',
      pack: 'brand_voice',
      description: 'Botanical origin claims (e.g. Kerala Gotu Kola) must match certified source dossiers.',
      disclaimer: 'Checklist aid, not legal advice.',
      is_active: true,
      created_at: daysAgoIso(25),
    },
    {
      id: 9,
      org_id: 1,
      title: 'No Degrading Body-Shaming Terminology',
      type: 'tone',
      severity: 'high',
      pack: 'brand_voice',
      description: "Do not describe normal pores, natural skin texture, or hormonal acne with disgust-laden terms like 'ugly craters' or 'dirty skin'.",
      disclaimer: 'Checklist aid, not legal advice.',
      is_active: true,
      created_at: daysAgoIso(25),
    },
    {
      id: 10,
      org_id: 1,
      title: 'Clinical Study Sample Size Transparency',
      type: 'claim',
      severity: 'medium',
      pack: 'claim_evidence',
      description: 'When quoting trial efficacy, include reference to trial sample size (e.g., n=60).',
      disclaimer: 'Checklist aid, not legal advice.',
      is_active: true,
      created_at: daysAgoIso(25),
    },
    {
      id: 11,
      org_id: 1,
      title: 'Natural vs Synthetic Ingredient Accuracy',
      type: 'terminology',
      severity: 'medium',
      pack: 'brand_voice',
      description: "Avoid using '100% chemical free'. Everything is chemistry; say 'free from harsh synthetic additives'.",
      disclaimer: 'Checklist aid, not legal advice.',
      is_active: true,
      created_at: daysAgoIso(25),
    },
    {
      id: 12,
      org_id: 1,
      title: 'No Misleading Before/After Alterations',
      type: 'regulatory',
      severity: 'high',
      pack: 'india_ad_code',
      description: 'Before and after creative assets must not use digital smoothing filters or distinct studio lighting to exaggerate results.',
      disclaimer: 'Checklist aid, not legal advice.',
      is_active: true,
      created_at: daysAgoIso(25),
    },
    {
      id: 13,
      org_id: 1,
      title: 'Dermatologist Endorsement Protocol',
      type: 'regulatory',
      severity: 'high',
      pack: 'india_ad_code',
      description: "References to 'dermatologist recommended' must be supported by certified independent panel results.",
      disclaimer: 'Checklist aid, not legal advice.',
      is_active: true,
      created_at: daysAgoIso(25),
    },
    {
      id: 14,
      org_id: 1,
      title: 'Accurate Packaging Recyclability Claims',
      type: 'claim',
      severity: 'low',
      pack: 'brand_voice',
      description: 'Sustainability claims must specify the exact PCR percentage (e.g., 85% PCR amber glass).',
      disclaimer: 'Checklist aid, not legal advice.',
      is_active: true,
      created_at: daysAgoIso(25),
    },
    {
      id: 15,
      org_id: 1,
      title: 'Mandatory Checklist Disclaimer Label',
      type: 'regulatory',
      severity: 'low',
      pack: 'india_ad_code',
      description: "All verification reports must display 'Checklist aid, not legal advice'.",
      disclaimer: 'Checklist aid, not legal advice.',
      is_active: true,
      created_at: daysAgoIso(25),
    },
    // BrightByte rules
    {
      id: 16,
      org_id: 2,
      title: 'Disclose Battery Testing Conditions',
      type: 'claim',
      severity: 'medium',
      pack: 'pricing_offers',
      description: 'All battery duration copy must disclose volume level and active feature conditions.',
      disclaimer: 'Checklist aid, not legal advice.',
      is_active: true,
      created_at: daysAgoIso(18),
    },
    {
      id: 17,
      org_id: 2,
      title: 'Prohibit Absolute Waterproof Guarantees',
      type: 'claim',
      severity: 'high',
      pack: 'india_ads',
      description: 'Consumer electronics cannot claim 100% waterproof immersion; cite IEC IP rating.',
      disclaimer: 'Checklist aid, not legal advice.',
      is_active: true,
      created_at: daysAgoIso(18),
    },
    {
      id: 18,
      org_id: 2,
      title: 'Substantiate Recycled Content Percentage',
      type: 'claim',
      severity: 'low',
      pack: 'greenwashing',
      description: 'Sustainability copy must specify the exact PCR percentage (75% PCR aluminum).',
      disclaimer: 'Checklist aid, not legal advice.',
      is_active: true,
      created_at: daysAgoIso(18),
    },
  ];

  // GlowLeaf 8 Submissions (IDs 1..8) + BrightByte 2 Submissions (IDs 9..10)
  const submissions: Submission[] = [
    {
      id: 1,
      org_id: 1,
      title: 'GlowLeaf Monsoon Acne Hero Ad',
      author_id: 2,
      department: 'Performance Marketing',
      version: 1,
      status: 'ai_checked',
      compliance_score: 35.0,
      content_text: 'Removes 100% acne in 3 days with natural willow extract! The miracle overnight cure your skin has been waiting for.',
      image_path: '/sample_data/demo_acne_ad.png',
      created_at: daysAgoIso(6),
      updated_at: daysAgoIso(6, 1),
    },
    {
      id: 2,
      org_id: 1,
      title: 'GlowLeaf Overnight Radiance Elixir Campaign',
      author_id: 2,
      department: 'Social Media & Ads',
      version: 1,
      status: 'draft',
      compliance_score: 100.0,
      content_text: 'Wake up with instant magical glow. Transform dull skin overnight.',
      image_path: null,
      created_at: daysAgoIso(5),
      updated_at: daysAgoIso(5),
    },
    {
      id: 3,
      org_id: 1,
      title: 'GlowLeaf BHA Pore Eraser Instagram Post',
      author_id: 2,
      department: 'Performance Marketing',
      version: 1,
      status: 'ai_checked',
      compliance_score: 60.0,
      content_text: 'Permanent pore eraser! Say goodbye to enlarged pores forever.',
      image_path: null,
      created_at: daysAgoIso(4),
      updated_at: daysAgoIso(4, 1),
    },
    {
      id: 4,
      org_id: 1,
      title: 'GlowLeaf Anti-Bacterial Serum Announcement',
      author_id: 2,
      department: 'Performance Marketing',
      version: 1,
      status: 'ai_checked',
      compliance_score: 75.0,
      content_text: 'In-vitro tests confirm 25% bacterial inhibition in laboratory trials.',
      image_path: null,
      created_at: daysAgoIso(3),
      updated_at: daysAgoIso(3, 1),
    },
    {
      id: 5,
      org_id: 1,
      title: 'GlowLeaf Barrier Hydration Cream Launch',
      author_id: 2,
      department: 'Performance Marketing',
      version: 1,
      status: 'in_review',
      compliance_score: 95.0,
      content_text: 'Clinical hydration index increased by 31% after 4 hours. Dermatologically tested for sensitive skin.',
      image_path: null,
      created_at: daysAgoIso(2),
      updated_at: daysAgoIso(2, 2),
    },
    {
      id: 6,
      org_id: 1,
      title: 'GlowLeaf Willow Bark Clarifying Gel Copy',
      author_id: 2,
      department: 'Performance Marketing',
      version: 1,
      status: 'revision_requested',
      compliance_score: 70.0,
      content_text: '100% chemical free botanical formula with zero synthetic toxins.',
      image_path: null,
      created_at: daysAgoIso(7),
      updated_at: daysAgoIso(6),
    },
    {
      id: 7,
      org_id: 1,
      title: 'GlowLeaf Gotu Kola Ethical Sourcing Spotlight',
      author_id: 2,
      department: 'Social Media & Ads',
      version: 1,
      status: 'approved',
      compliance_score: 100.0,
      content_text: 'Formulated at a skin-friendly pH of 5.2 - 5.6 with ethically sourced Kerala Gotu Kola.',
      image_path: null,
      created_at: daysAgoIso(9),
      updated_at: daysAgoIso(8),
    },
    {
      id: 8,
      org_id: 1,
      title: 'GlowLeaf Summer Promotion Display Banner',
      author_id: 2,
      department: 'Performance Marketing',
      version: 1,
      status: 'ai_checked',
      compliance_score: 85.0,
      content_text: 'Gentle botanical skincare designed for sensitive skin types.',
      image_path: '/uploads/submissions/489e3ef1_test_banner.png',
      created_at: daysAgoIso(1),
      updated_at: daysAgoIso(1, 1),
    },
    // BrightByte
    {
      id: 9,
      org_id: 2,
      title: 'BrightByte Earbuds Pro Launch Campaign',
      author_id: 5,
      department: 'Growth Marketing',
      version: 1,
      status: 'draft',
      compliance_score: 100.0,
      content_text: 'BrightByte Earbuds Pro deliver up to 48 hours of continuous audio playback with 75% recycled aluminum alloy casing.',
      image_path: null,
      created_at: daysAgoIso(4),
      updated_at: daysAgoIso(4),
    },
    {
      id: 10,
      org_id: 2,
      title: 'BrightByte Summer Pool Party Social Post',
      author_id: 5,
      department: 'Growth Marketing',
      version: 1,
      status: 'ai_checked',
      compliance_score: 45.0,
      content_text: 'BrightByte Earbuds Pro feature 100% waterproof guarantee and last forever on a single charge!',
      image_path: null,
      created_at: daysAgoIso(2),
      updated_at: daysAgoIso(2),
    },
  ];

  const submissionVersions: SubmissionVersion[] = submissions.map((s) => ({
    id: s.id,
    org_id: s.org_id,
    submission_id: s.id,
    version_number: 1,
    content_text: s.content_text,
    diff_from_previous: null,
    created_at: s.created_at,
  }));

  const findings: Finding[] = [
    {
      id: 1,
      org_id: 1,
      submission_id: 1,
      version_number: 1,
      type: 'claim',
      severity: 'high',
      verdict: 'contradicted',
      span_start: 0,
      span_end: 28,
      bbox: null,
      excerpt: 'Removes 100% acne in 3 days',
      explanation: 'Contradicted by Trial GL-CT-2024-B: product demonstrates up to 42% lesion reduction over 6 weeks, not 100% in 3 days.',
      rule_id: 1,
      evidence_fact_id: 4,
      suggested_text: 'Reduces visible acne lesions by up to 42% in 6 weeks',
      decision: 'pending',
      justification: null,
      created_at: daysAgoIso(6),
      category: 'claim_evidence',
      confidence: 0.92,
      detected_by: 'rule',
      pack: 'india_ads',
      rule_name: 'No 100% Absolute Acne Elimination Claims',
      needs_human: true,
    },
    {
      id: 2,
      org_id: 1,
      submission_id: 1,
      version_number: 1,
      type: 'tone',
      severity: 'medium',
      verdict: 'violation',
      span_start: 61,
      span_end: 78,
      bbox: null,
      excerpt: 'miracle overnight',
      explanation: 'Violates GlowLeaf brand tone: Hyperbolic miracle claims are strictly prohibited.',
      rule_id: 2,
      evidence_fact_id: null,
      suggested_text: 'scientifically formulated',
      decision: 'pending',
      justification: null,
      created_at: daysAgoIso(6),
      category: 'brand_voice',
      confidence: 0.89,
      detected_by: 'rule',
      pack: 'brand_voice',
      rule_name: 'Prohibit Hyperbolic Tone (Miracle / Magic)',
      needs_human: false,
    },
    {
      id: 3,
      org_id: 1,
      submission_id: 1,
      version_number: 1,
      type: 'regulatory',
      severity: 'medium',
      verdict: 'violation',
      span_start: 34,
      span_end: 56,
      bbox: null,
      excerpt: 'natural willow extract',
      explanation: 'Willow bark (salicylic acid) requires an explicit broad-spectrum SPF reminder.',
      rule_id: 4,
      evidence_fact_id: null,
      suggested_text: 'natural willow extract (always use daily SPF 30+)',
      decision: 'pending',
      justification: null,
      created_at: daysAgoIso(6),
      category: 'india_ads',
      confidence: 0.9,
      detected_by: 'rule',
      pack: 'india_ads',
      rule_name: 'Mandatory Daily Sunscreen Reminder for Exfoliants',
      needs_human: false,
    },
    {
      id: 4,
      org_id: 1,
      submission_id: 3,
      version_number: 1,
      type: 'claim',
      severity: 'high',
      verdict: 'evidence_missing',
      span_start: 0,
      span_end: 22,
      bbox: null,
      excerpt: 'Permanent pore eraser!',
      explanation: 'No verified clinical study in brand library supports permanent eradication of skin pores.',
      rule_id: 7,
      evidence_fact_id: null,
      suggested_text: 'Visibly refines the look of enlarged pores.',
      decision: 'pending',
      justification: null,
      created_at: daysAgoIso(4),
      category: 'claim_evidence',
      confidence: 0.85,
      detected_by: 'rule',
      pack: 'india_ads',
      rule_name: 'No Unverified Permanent Cure Claims',
      needs_human: true,
    },
    {
      id: 5,
      org_id: 1,
      submission_id: 4,
      version_number: 1,
      type: 'claim',
      severity: 'medium',
      verdict: 'outdated',
      span_start: 0,
      span_end: 68,
      bbox: null,
      excerpt: 'In-vitro tests confirm 25% bacterial inhibition in laboratory trials.',
      explanation: 'Cites preliminary in-vitro study GL-LM-2022-01 which expired on 2023-12-31. Needs re-verification against 2025/2026 clinical dossiers.',
      rule_id: 3,
      evidence_fact_id: 3,
      suggested_text: null,
      decision: 'pending',
      justification: null,
      created_at: daysAgoIso(3),
      category: 'outdated_info',
      confidence: 0.82,
      detected_by: 'rule',
      pack: 'outdated_info',
      rule_name: 'Substantiate Any Quantitative Percentage',
      needs_human: true,
    },
    {
      id: 6,
      org_id: 1,
      submission_id: 5,
      version_number: 1,
      type: 'claim',
      severity: 'low',
      verdict: 'supported',
      span_start: 0,
      span_end: 55,
      bbox: null,
      excerpt: 'Clinical hydration index increased by 31% after 4 hours',
      explanation: 'Corroborated by Corneometry Study GL-CS-2025-03.',
      rule_id: 3,
      evidence_fact_id: 12,
      suggested_text: null,
      decision: 'accepted',
      justification: null,
      created_at: daysAgoIso(2),
      category: 'claim_evidence',
      confidence: 0.94,
      detected_by: 'rule',
      pack: 'claim_evidence',
      rule_name: 'Substantiate Any Quantitative Percentage',
      needs_human: false,
    },
    {
      id: 7,
      org_id: 1,
      submission_id: 6,
      version_number: 1,
      type: 'terminology',
      severity: 'medium',
      verdict: 'violation',
      span_start: 0,
      span_end: 18,
      bbox: null,
      excerpt: '100% chemical free',
      explanation: "Scientific inaccuracy: all plant botanicals and water are chemicals. Use 'free from harsh synthetic additives'.",
      rule_id: 11,
      evidence_fact_id: null,
      suggested_text: 'free from harsh synthetic additives',
      decision: 'accepted',
      justification: null,
      created_at: daysAgoIso(7),
      category: 'brand_voice',
      confidence: 0.9,
      detected_by: 'rule',
      pack: 'brand_voice',
      rule_name: 'Natural vs Synthetic Ingredient Accuracy',
      needs_human: false,
    },
    {
      id: 8,
      org_id: 1,
      submission_id: 7,
      version_number: 1,
      type: 'claim',
      severity: 'low',
      verdict: 'supported',
      span_start: 0,
      span_end: 41,
      bbox: null,
      excerpt: 'Formulated at a skin-friendly pH of 5.2 - 5.6',
      explanation: 'Validated by GL Quality Control Batch Certificate QC-2026-B12.',
      rule_id: 3,
      evidence_fact_id: 7,
      suggested_text: null,
      decision: 'accepted',
      justification: null,
      created_at: daysAgoIso(9),
      category: 'claim_evidence',
      confidence: 0.95,
      detected_by: 'rule',
      pack: 'claim_evidence',
      needs_human: false,
    },
    {
      id: 9,
      org_id: 1,
      submission_id: 7,
      version_number: 1,
      type: 'claim',
      severity: 'low',
      verdict: 'supported',
      span_start: 47,
      span_end: 84,
      bbox: null,
      excerpt: 'ethically sourced Kerala Gotu Kola',
      explanation: 'Validated by Supplier Sourcing Certificate SC-2025-KER-09.',
      rule_id: 8,
      evidence_fact_id: 8,
      suggested_text: null,
      decision: 'accepted',
      justification: null,
      created_at: daysAgoIso(9),
      category: 'brand_voice',
      confidence: 0.93,
      detected_by: 'rule',
      pack: 'brand_voice',
      needs_human: false,
    },
    {
      id: 10,
      org_id: 1,
      submission_id: 8,
      version_number: 1,
      type: 'visual',
      severity: 'medium',
      verdict: 'violation',
      span_start: null,
      span_end: null,
      bbox: { x: 50, y: 80, width: 300, height: 60 },
      excerpt: 'Text contrast against cream backdrop',
      explanation: 'Contrast ratio is 3.1:1, failing minimum WCAG AA threshold of 4.5:1. Recommend using Deep Teal (#133B3B) for body text.',
      rule_id: 6,
      evidence_fact_id: null,
      suggested_text: 'Apply Deep Teal #133B3B typography for contrast compliance.',
      decision: 'pending',
      justification: null,
      created_at: daysAgoIso(1),
      category: 'accessibility',
      confidence: 0.91,
      detected_by: 'rule',
      pack: 'visual_design',
      rule_name: 'WCAG AA Color Contrast Requirement',
      needs_human: false,
    },
    // BrightByte finding
    {
      id: 11,
      org_id: 2,
      submission_id: 10,
      version_number: 1,
      type: 'claim',
      severity: 'high',
      verdict: 'evidence_missing',
      span_start: 29,
      span_end: 56,
      bbox: null,
      excerpt: '100% waterproof guarantee',
      explanation: 'Electronics cannot claim 100% waterproof guarantee. Product is certified for IP68 under IEC 60529.',
      rule_id: 17,
      evidence_fact_id: 16,
      suggested_text: 'IP68 water and dust resistance certified under IEC Standard 60529',
      decision: 'pending',
      justification: null,
      created_at: daysAgoIso(2),
      category: 'india_ads',
      confidence: 0.9,
      detected_by: 'rule',
      pack: 'india_ads',
      needs_human: true,
    },
  ];

  const reviews: Review[] = [
    {
      id: 1,
      org_id: 1,
      submission_id: 6,
      reviewer_id: 3,
      action: 'revision_requested',
      comment: "Please update the '100% chemical free' phrase to adhere to our terminology rule #11.",
      override_reason: null,
      created_at: daysAgoIso(6, 4),
    },
    {
      id: 2,
      org_id: 1,
      submission_id: 7,
      reviewer_id: 3,
      action: 'approved',
      comment: 'All botanical sourcing claims verified against Certificate SC-2025-KER-09. Approved for publication.',
      override_reason: null,
      created_at: daysAgoIso(8, 3),
    },
  ];

  const auditEvents: AuditEvent[] = [
    {
      id: 1,
      org_id: 1,
      actor_id: 1,
      actor_name: 'Priya Sharma',
      role: 'admin',
      action: 'system_seed',
      entity_type: 'system',
      entity_id: null,
      before_state: null,
      after_state: 'Database seeded with GlowLeaf brand data, 12 facts, 15 rules, and 8 submissions.',
      timestamp: daysAgoIso(10),
    },
    {
      id: 2,
      org_id: 1,
      actor_id: 3,
      actor_name: 'Kavita Rao',
      role: 'manager',
      action: 'manager_review_approved',
      entity_type: 'submission',
      entity_id: 7,
      before_state: JSON.stringify({ status: 'in_review' }),
      after_state: JSON.stringify({ status: 'approved', comment: 'All botanical sourcing claims verified against Certificate SC-2025-KER-09.' }),
      timestamp: daysAgoIso(8, 3),
    },
    {
      id: 3,
      org_id: 1,
      actor_id: 3,
      actor_name: 'Kavita Rao',
      role: 'manager',
      action: 'manager_review_revision_requested',
      entity_type: 'submission',
      entity_id: 6,
      before_state: JSON.stringify({ status: 'in_review' }),
      after_state: JSON.stringify({ status: 'revision_requested', comment: "Update '100% chemical free' phrase." }),
      timestamp: daysAgoIso(6, 4),
    },
    {
      id: 4,
      org_id: 1,
      actor_id: 2,
      actor_name: 'Arjun Mehta',
      role: 'employee',
      action: 'submission_ai_check',
      entity_type: 'submission',
      entity_id: 1,
      before_state: JSON.stringify({ status: 'draft' }),
      after_state: JSON.stringify({ status: 'ai_checked', compliance_score: 35.0, findings_count: 3 }),
      timestamp: daysAgoIso(6, 1),
    },
    {
      id: 5,
      org_id: 2,
      actor_id: 4,
      actor_name: 'Vikram Das',
      role: 'admin',
      action: 'system_seed',
      entity_type: 'system',
      entity_id: null,
      before_state: null,
      after_state: 'Database seeded with BrightByte electronics brand data.',
      timestamp: ts,
    },
  ];

  return {
    organizations,
    users,
    memberships,
    brands,
    guidelines,
    facts,
    rules,
    submissions,
    submissionVersions,
    findings,
    reviews,
    auditEvents,
    feedbackReports: [],
    nextIds: {
      org: 3,
      user: 6,
      membership: 7,
      brand: 3,
      guideline: 4,
      fact: 17,
      rule: 19,
      submission: 11,
      version: 11,
      finding: 12,
      review: 3,
      audit: 6,
      feedback: 1,
    },
  };
}

export function enrichFact(fact: ApprovedFact, allOrgFacts: ApprovedFact[]): ApprovedFactOut {
  const today = new Date().toISOString().slice(0, 10);
  const supersededIds = new Set(
    allOrgFacts.map((f) => f.supersedes_id).filter((id): id is number => id !== null),
  );
  const isExpired = Boolean(fact.valid_until && fact.valid_until < today);
  const isSuperseded = supersededIds.has(fact.id);
  return {
    ...fact,
    is_expired: isExpired,
    is_superseded: isSuperseded,
  };
}

export function calculateComplianceScore(findings: Finding[]): number {
  const severityWeights: Record<string, number> = {
    high: 25.0,
    medium: 10.0,
    low: 4.0,
  };
  const verdictMultipliers: Record<string, number> = {
    violation: 1.0,
    contradicted: 1.0,
    evidence_missing: 0.8,
    outdated: 0.8,
    supported: 0.0,
  };

  let totalDeduction = 0.0;
  for (const f of findings) {
    if (f.decision === 'accepted') continue;
    const base = severityWeights[f.severity.toLowerCase()] ?? 5.0;
    const mult = verdictMultipliers[f.verdict.toLowerCase()] ?? 0.5;
    totalDeduction += base * mult;
  }
  const score = Math.max(0.0, 100.0 - totalDeduction);
  return Math.round(score * 10) / 10;
}

export function generateDiff(oldText: string, newText: string, oldV: number, newV: number): string {
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);
  const lines: string[] = [`--- v${oldV}`, `+++ v${newV}`, `@@ -1,${oldLines.length} +1,${newLines.length} @@`];
  for (const l of oldLines) {
    if (!newLines.includes(l)) lines.push(`-${l}`);
  }
  for (const l of newLines) {
    if (!oldLines.includes(l)) lines.push(`+${l}`);
  }
  if (lines.length === 3) {
    lines.push(` ${newText}`);
  }
  return lines.join('\n');
}

export function recordAuditEvent(
  store: InkloomStore,
  orgId: number,
  actor: { id: number | null; name: string; role: string },
  action: string,
  entityType: string,
  entityId: number | null,
  before: unknown,
  after: unknown,
): AuditEvent {
  const event: AuditEvent = {
    id: store.nextIds.audit++,
    org_id: orgId,
    actor_id: actor.id,
    actor_name: actor.name,
    role: actor.role,
    action,
    entity_type: entityType,
    entity_id: entityId,
    before_state: before !== null && before !== undefined ? (typeof before === 'string' ? before : JSON.stringify(before)) : null,
    after_state: after !== null && after !== undefined ? (typeof after === 'string' ? after : JSON.stringify(after)) : null,
    timestamp: new Date().toISOString(),
  };
  store.auditEvents.push(event);
  return event;
}

function getIsoWeek(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return getIsoWeek(now.toISOString());
  }
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getAnalyticsSummary(store: InkloomStore, orgId: number) {
  const subs = store.submissions.filter((s) => s.org_id === orgId);
  const findings = store.findings.filter((f) => f.org_id === orgId);
  const rulesMap = new Map(store.rules.filter((r) => r.org_id === orgId).map((r) => [r.id, r.title]));
  const usersMap = new Map(store.users.map((u) => [u.id, u.name]));
  const reviews = store.reviews.filter((r) => r.org_id === orgId);

  const statusCounts: Record<string, number> = {
    draft: 0,
    ai_checked: 0,
    in_review: 0,
    revision_requested: 0,
    approved: 0,
  };
  for (const s of subs) {
    statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
  }

  const issuesByType: Record<string, number> = {};
  const issuesBySeverity: Record<string, number> = { high: 0, medium: 0, low: 0 };
  const ruleCounts = new Map<number, number>();
  const deptCounts = new Map<string, number>();
  const authorCounts = new Map<number, number>();
  const weekCounts = new Map<string, number>();
  const subMap = new Map(subs.map((s) => [s.id, s]));

  for (const f of findings) {
    issuesByType[f.type] = (issuesByType[f.type] ?? 0) + 1;
    const sev = f.severity.toLowerCase();
    issuesBySeverity[sev] = (issuesBySeverity[sev] ?? 0) + 1;
    if (f.rule_id) {
      ruleCounts.set(f.rule_id, (ruleCounts.get(f.rule_id) ?? 0) + 1);
    }
    const sub = subMap.get(f.submission_id);
    if (sub) {
      deptCounts.set(sub.department, (deptCounts.get(sub.department) ?? 0) + 1);
      authorCounts.set(sub.author_id, (authorCounts.get(sub.author_id) ?? 0) + 1);
    }
    const wk = getIsoWeek(f.created_at);
    weekCounts.set(wk, (weekCounts.get(wk) ?? 0) + 1);
  }

  const topViolatedRules = [...ruleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([rule_id, count]) => ({
      rule_id,
      title: rulesMap.get(rule_id) ?? `Rule #${rule_id}`,
      count,
    }));

  const repeatMistakesByDepartment = [...deptCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([department, violation_count]) => ({ department, violation_count }));

  const repeatMistakesByAuthor = [...authorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([author_id, violation_count]) => ({
      author_id,
      author_name: usersMap.get(author_id) ?? `Author #${author_id}`,
      violation_count,
    }));

  let issuesPerWeek = [...weekCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, count]) => ({ week, count }));

  if (issuesPerWeek.length === 0) {
    issuesPerWeek = [{ week: getIsoWeek(new Date().toISOString()), count: 0 }];
  }

  const reviewTimes: number[] = [];
  for (const rev of reviews) {
    const sub = subMap.get(rev.submission_id);
    if (sub) {
      const deltaHrs = (new Date(rev.created_at).getTime() - new Date(sub.created_at).getTime()) / 3600_000;
      if (deltaHrs >= 0) reviewTimes.push(deltaHrs);
    }
  }
  const averageReviewTimeHours =
    reviewTimes.length > 0
      ? Math.round((reviewTimes.reduce((a, b) => a + b, 0) / reviewTimes.length) * 10) / 10
      : 2.5;

  return {
    total_submissions: subs.length,
    status_counts: statusCounts,
    issues_by_type: issuesByType,
    issues_by_severity: issuesBySeverity,
    issues_per_week: issuesPerWeek,
    top_violated_rules: topViolatedRules,
    repeat_mistakes_by_department: repeatMistakesByDepartment,
    repeat_mistakes_by_author: repeatMistakesByAuthor,
    average_review_time_hours: averageReviewTimeHours,
  };
}
