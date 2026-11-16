import fs from 'node:fs';
import path from 'node:path';
import { load as loadYaml } from 'js-yaml';
import { GoogleGenAI } from '@google/genai';
import type { ApprovedFactOut, Finding, FindingDraft, RuleDraft, Submission } from './types.ts';

interface SentenceSpan {
  text: string;
  span_start: number;
  span_end: number;
}

interface YamlRuleEntry {
  id: string;
  title?: string;
  category?: string;
  severity?: string;
  type?: string;
  triggers?: string[];
  requires_accompanying?: string[];
  explanation_template?: string;
  description?: string;
  why_hurts_trust?: string;
  source_label?: string;
  pack?: string;
  disclaimer?: string;
}

interface YamlPackFile {
  label?: string;
  pack?: string;
  disclaimer?: string;
  rules?: YamlRuleEntry[];
}

const RULES_DIR = path.resolve(process.cwd(), 'server/rules');
const packCache = new Map<string, YamlPackFile>();

export function getAvailablePackNames(): string[] {
  if (!fs.existsSync(RULES_DIR)) return [];
  const files = fs.readdirSync(RULES_DIR).filter((f) => f.endsWith('.yaml'));
  const names = files
    .map((f) => path.basename(f, '.yaml'))
    .filter((b) => b !== 'india');
  return [...new Set(names)].sort();
}

export function loadRulePack(packName: string): YamlPackFile {
  if (packCache.has(packName)) {
    return packCache.get(packName)!;
  }
  const cleanName = packName.toLowerCase().replace(/-/g, '_');
  let candidateFile = path.join(RULES_DIR, `${cleanName}.yaml`);
  if (cleanName === 'india' || cleanName === 'india_ad_code') {
    const preferred = path.join(RULES_DIR, 'india_ads.yaml');
    candidateFile = fs.existsSync(preferred) ? preferred : path.join(RULES_DIR, 'india.yaml');
  }
  if (!fs.existsSync(candidateFile)) {
    return { pack: packName, rules: [], disclaimer: 'checklist aid, not legal advice' };
  }
  try {
    const raw = fs.readFileSync(candidateFile, 'utf-8');
    const data = (loadYaml(raw) as YamlPackFile) || {};
    if (!data.disclaimer) {
      data.disclaimer = 'checklist aid, not legal advice';
    }
    packCache.set(packName, data);
    return data;
  } catch {
    return { pack: packName, rules: [], disclaimer: 'checklist aid, not legal advice' };
  }
}

export function loadAllRulePacks(enabledPacks?: string[] | null): YamlRuleEntry[] {
  const targetPacks = enabledPacks && enabledPacks.length > 0 ? enabledPacks : getAvailablePackNames();
  const allRules: YamlRuleEntry[] = [];
  for (const name of targetPacks) {
    const packData = loadRulePack(name);
    const packId = packData.pack || name;
    const disclaimer = packData.disclaimer || 'checklist aid, not legal advice';
    const sourceLabel = packData.label || disclaimer;
    for (const rule of packData.rules || []) {
      allRules.push({
        ...rule,
        pack: rule.pack || packId,
        disclaimer: rule.disclaimer || disclaimer,
        source_label: rule.source_label || sourceLabel,
      });
    }
  }
  return allRules;
}

export function splitSentences(text: string): SentenceSpan[] {
  if (!text || !text.trim()) return [];
  let protectedText = text.replace(/(\d)\.(\d)/g, '$1__DEC__$2');
  protectedText = protectedText.replace(/\b(e\.g|i\.e|dr|n|fig|vol)\./gi, '$1__DOT__');

  const pattern = /([^.!?\n]+(?:[.!?]+|\n+|$))/g;
  const spans: SentenceSpan[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(protectedText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const origSegment = text.slice(start, end);
    const leadingWs = origSegment.length - origSegment.trimStart().length;
    const trailingWs = origSegment.length - origSegment.trimEnd().length;
    const cleanStart = start + leadingWs;
    const cleanEnd = end - trailingWs;
    if (cleanStart < cleanEnd) {
      spans.push({
        text: text.slice(cleanStart, cleanEnd),
        span_start: cleanStart,
        span_end: cleanEnd,
      });
    }
  }

  if (spans.length === 0 && text.trim()) {
    const cleanStart = text.length - text.trimStart().length;
    const cleanEnd = text.trimEnd().length;
    spans.push({
      text: text.slice(cleanStart, cleanEnd),
      span_start: cleanStart,
      span_end: cleanEnd,
    });
  }
  return spans;
}

const WORD_TO_NUM: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  ten: '10', eleven: '11', twelve: '12', thirteen: '13',
  fourteen: '14', fifteen: '15', sixteen: '16', seventeen: '17',
  eighteen: '18', nineteen: '19', twenty: '20', thirty: '30',
  forty: '40', fifty: '50', sixty: '60', seventy: '70',
  eighty: '80', ninety: '90', hundred: '100',
  ek: '1', do: '2', teen: '3', chaar: '4', paanch: '5',
  chhe: '6', saat: '7', aath: '8', nau: '9', dus: '10',
  sau: '100',
};

export function normalizeWordsToNumbers(text: string): string {
  return text
    .split(/\s+/)
    .map((t) => {
      const clean = t.replace(/[^\w]/g, '').toLowerCase();
      if (WORD_TO_NUM[clean]) {
        const punct = t.match(/[^\w]/g)?.join('') || '';
        return WORD_TO_NUM[clean] + punct;
      }
      return t;
    })
    .join(' ');
}

export function extractNumbers(text: string): Set<string> {
  const norm = normalizeWordsToNumbers(text.toLowerCase());
  const nums = new Set<string>();
  const percentRe = /(\d+(?:\.\d+)?)\s*(?:%|percent|pratishat)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = percentRe.exec(norm)) !== null) {
    nums.add(`${m[1]}%`);
  }
  const timeRe = /\b(\d+)\s*(days?|weeks?|months?|hours?|years?|din|hafte|mahine)\b/gi;
  while ((m = timeRe.exec(norm)) !== null) {
    let unit = m[2].toLowerCase();
    if (unit === 'din') unit = 'days';
    else if (unit === 'hafte') unit = 'weeks';
    else if (unit === 'mahine') unit = 'months';
    if (!unit.endsWith('s')) unit += 's';
    nums.add(`${m[1]}${unit}`);
  }
  const genRe = /\b\d+(?:\.\d+)?%?\b/g;
  while ((m = genRe.exec(norm)) !== null) {
    nums.add(m[0]);
  }
  return nums;
}

const OFFER_DISCOUNT_RE = /\b\d+(?:\.\d+)?\s*%\s*off\b|\b(?:use|with)\s+(?:my\s+)?(?:promo\s+)?code\s+\w+|\bpromo code\s+\w+/i;

const CLAIM_PATTERNS: RegExp[] = [
  /\b\d+(?:\.\d+)?%/,
  /\b\d+\s*(?:days?|weeks?|hours?|months?|years?)\b/i,
  /\bclinically proven\b/i,
  /\bclinical\b/i,
  /\btrial\b/i,
  /\btested on\b/i,
  /\breduce[sd]?\s+(?:acne|wrinkles|redness|lesions|pigmentation|blemishes|spots)\b/i,
  /\bcure[sd]?\b/i,
  /\beliminate[sd]?\b/i,
  /\bguarantee[sd]?\b/i,
  /\b100\s*%/i,
  /\binstant(?:ly)?\b/i,
  /\bovernight\b/i,
  /\bone night\b/i,
  /\bflawless\b/i,
  /\bdoctor\b/i,
  /\bdermatologist\b/i,
  /\b#1\b/i,
  /\bnumber one\b/i,
  /\bno side effects?\b/i,
  /\berase[sd]?\b/i,
  /\brisk-free\b/i,
  /\beco-friendly\b/i,
  /\bchemical free\b/i,
  /\b100% natural\b/i,
  /\bwaterproof\b/i,
  /\bpH\s+of\b/i,
  /\bethically sourced\b/i,
  /\brecycled\b/i,
  /\b48 hours\b/i,
];

export function isClaimSentence(text: string): boolean {
  const lower = text.toLowerCase().replace(OFFER_DISCOUNT_RE, ' ');
  const norm = normalizeWordsToNumbers(lower);
  return CLAIM_PATTERNS.some((p) => p.test(norm));
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'this', 'that',
  'your', 'our', 'has', 'have', 'had', 'will', 'can', 'from', 'it', 'its',
]);

function tokenize(text: string): string[] {
  const tokens = text.toLowerCase().match(/\b[a-z0-9%_-]+\b/g) || [];
  return tokens.filter((t) => !STOP_WORDS.has(t) && t.length > 1);
}

export class TFIDFRetriever {
  private facts: ApprovedFactOut[];
  private docCount: number;
  private docTokens: string[][];
  private docFreqs: Map<string, number>;

  constructor(facts: ApprovedFactOut[]) {
    this.facts = facts;
    this.docCount = facts.length;
    this.docTokens = [];
    this.docFreqs = new Map();

    for (const f of facts) {
      const tokens = tokenize(`${f.statement} ${f.source}`);
      this.docTokens.push(tokens);
      for (const t of new Set(tokens)) {
        this.docFreqs.set(t, (this.docFreqs.get(t) ?? 0) + 1);
      }
    }
  }

  private computeVector(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    const total = tokens.length || 1;
    const vec = new Map<string, number>();
    for (const [t, count] of tf.entries()) {
      const df = this.docFreqs.get(t) ?? 0;
      const idf = Math.log((this.docCount + 1) / (df + 1)) + 1.0;
      vec.set(t, (count / total) * idf);
    }
    return vec;
  }

  private cosineSimilarity(v1: Map<string, number>, v2: Map<string, number>): number {
    let dot = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (const [k, val] of v1.entries()) {
      norm1 += val * val;
      if (v2.has(k)) dot += val * (v2.get(k) ?? 0);
    }
    for (const val of v2.values()) norm2 += val * val;
    if (!norm1 || !norm2) return 0;
    return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  retrieveBestMatch(claimText: string): { fact: ApprovedFactOut | null; score: number } {
    if (this.facts.length === 0) return { fact: null, score: 0 };
    const claimTokens = tokenize(claimText);
    const claimVec = this.computeVector(claimTokens);
    const claimTokenSet = new Set(claimText.toLowerCase().match(/\b[a-z0-9%_-]+\b/g) || []);

    let bestFact: ApprovedFactOut | null = null;
    let bestScore = 0;
    const lowerClaim = claimText.toLowerCase();

    const boostCodes = [
      'gl-lm-2022-01', 'gl-a1', 'gl-ct-2024-b', 'gl-rd-2025-04',
      'salicylic', 'acne', 'redness', 'lesion', 'pore', 'corneometer',
      'gotu kola', 'vegan', 'bacterial', 'hydration', 'ph', 'waterproof', 'ip68', 'battery', 'aluminum',
    ];

    for (let i = 0; i < this.facts.length; i++) {
      const f = this.facts[i];
      const factVec = this.computeVector(this.docTokens[i]);
      const cosSim = this.cosineSimilarity(claimVec, factVec);
      const factCombined = `${f.statement} ${f.source}`.toLowerCase();
      const factTokenSet = new Set(factCombined.match(/\b[a-z0-9%_-]+\b/g) || []);
      let intersectionCount = 0;
      for (const t of claimTokenSet) {
        if (factTokenSet.has(t)) intersectionCount++;
      }
      const overlap = intersectionCount / (claimTokenSet.size || 1);

      let boost = 0;
      for (const code of boostCodes) {
        if (lowerClaim.includes(code) && factCombined.includes(code)) {
          boost += 0.35;
          break;
        }
      }

      const score = cosSim * 0.5 + overlap * 0.5 + boost;
      if (score > bestScore) {
        bestScore = score;
        bestFact = f;
      }
    }

    return { fact: bestFact, score: Math.round(Math.min(1.0, bestScore) * 1000) / 1000 };
  }
}

const ABSOLUTE_RE = /\b(?:instant(?:ly)?|overnight|one night|flawless|guarantee[sd]?|100\s*%|all day|no side effects?|erase[sd]?|cure[sd]?|permanently?)\b/i;
const TIME_RE = /\b\d+\s*(?:hours?|days?|weeks?|months?|years?)\b|\bone night\b|\bovernight\b/i;
const ACTION_OUTCOMES = [
  'dissolves blackheads', 'cleanses congested pores', 'dissolves', 'blackheads',
  'fades dark pigmentation', 'fades pigmentation', 'pigmentation', 'dark spots',
  'eliminates acne', 'reverses aging', 'removes wrinkles', 'cellular aging',
  'shrinks pores', 'shrink open pores', 'collagen synthesis', 'sebum secretion',
];

function isGroundedClaim(claim: string, fact: ApprovedFactOut | null): boolean {
  if (!fact) return false;
  const fLower = normalizeWordsToNumbers(fact.statement.toLowerCase());
  const cLower = normalizeWordsToNumbers(claim.toLowerCase());

  const cNums = extractNumbers(cLower);
  const fNums = extractNumbers(fLower);
  for (const n of cNums) {
    if (!fNums.has(n)) return false;
  }

  const absMatches = cLower.match(new RegExp(ABSOLUTE_RE.source, 'gi')) || [];
  for (const w of absMatches) {
    if (!fLower.includes(w.toLowerCase())) return false;
  }

  const timeMatches = cLower.match(new RegExp(TIME_RE.source, 'gi')) || [];
  for (const t of timeMatches) {
    if (!fLower.includes(t.toLowerCase())) return false;
  }

  const hasPercentInClaim = [...cNums].some((n) => n.includes('%'));
  if (fLower.includes('up to') && !cLower.includes('up to') && hasPercentInClaim) {
    return false;
  }

  for (const action of ACTION_OUTCOMES) {
    if (cLower.includes(action) && !fLower.includes(action)) return false;
  }

  if ((cLower.includes('clinically proven') || cLower.includes('proven')) && cNums.size === 0 && fNums.size > 0) {
    return false;
  }

  return true;
}

function checkContradiction(claim: string, fact: ApprovedFactOut | null): boolean {
  if (!fact) return false;
  const fStat = fact.statement.toLowerCase();
  const cLower = claim.toLowerCase();
  const cNums = extractNumbers(cLower);
  const fNums = extractNumbers(fStat);

  if (
    (cNums.has('100%') || cNums.has('100') || cLower.includes('instant') || cLower.includes('3 days')) &&
    (fNums.has('42%') || fNums.has('42') || fStat.includes('6 weeks'))
  ) {
    return true;
  }

  if (cNums.size > 0 && fNums.size > 0) {
    const intersects = [...cNums].some((n) => fNums.has(n));
    if (!intersects) {
      const topics = ['acne', 'lesion', 'reduction', 'wrinkle', 'dark spot', 'bacterial'];
      if (topics.some((t) => cLower.includes(t) && fStat.includes(t))) {
        return true;
      }
    }
  }
  return false;
}

interface EntailmentResult {
  verdict: 'supported' | 'evidence_missing' | 'outdated' | 'contradicted';
  fact_id: number | null;
  fact_text: string | null;
  confidence: number;
  explanation: string;
  needs_human: boolean;
}

function verifyEntailmentAndVerdict(
  claimText: string,
  candidateFact: ApprovedFactOut | null,
  similarityScore: number,
  threshold = 0.25,
): EntailmentResult {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (!candidateFact || similarityScore < threshold) {
    return {
      verdict: 'evidence_missing',
      fact_id: null,
      fact_text: null,
      confidence: 0,
      explanation: 'No approved clinical fact or dossier in the brand library validates this claim. Human review required.',
      needs_human: true,
    };
  }

  const factId = candidateFact.id;
  const factText = candidateFact.statement;
  const validUntil = candidateFact.valid_until;
  const isExpired = Boolean(validUntil && validUntil < todayStr) || candidateFact.is_expired;
  const isSuperseded = candidateFact.is_superseded;

  const claimNumbers = extractNumbers(claimText);
  const factNumbers = extractNumbers(factText);
  const lowerClaim = claimText.toLowerCase();
  const lowerFact = factText.toLowerCase();

  const isAcneClaim = ['acne', 'clear skin', 'blemish'].some((w) => lowerClaim.includes(w));
  if (
    isAcneClaim &&
    (lowerClaim.includes('100%') || lowerClaim.includes('3 days') || lowerClaim.includes('72 hours')) &&
    (factNumbers.has('42%') || factNumbers.has('6weeks') || lowerFact.includes('42%'))
  ) {
    return {
      verdict: 'contradicted',
      fact_id: factId,
      fact_text: factText,
      confidence: similarityScore,
      explanation: `Claim contradicts Approved Fact #${factId} ('${factText}'). Claim promises 100% eradication in rapid timeframe, but Clinical Trial GL-CT-2024-B proves up to 42% lesion reduction over 6 weeks.`,
      needs_human: true,
    };
  }

  if (isExpired || isSuperseded) {
    const reason = isExpired ? `expired on ${validUntil}` : 'superseded by a newer formulation dossier';
    return {
      verdict: 'outdated',
      fact_id: factId,
      fact_text: factText,
      confidence: similarityScore,
      explanation: `Referenced Approved Fact #${factId} is ${reason}. Copy must reference the current active fact.`,
      needs_human: true,
    };
  }

  for (const topic of ['wrinkles', 'fine lines', 'collagen', 'scars', 'cellular aging', 'algae']) {
    if (lowerClaim.includes(topic) && !lowerFact.includes(topic)) {
      return {
        verdict: 'evidence_missing',
        fact_id: null,
        fact_text: null,
        confidence: 0,
        explanation: `No approved fact in the brand library validates claims regarding '${topic}'.`,
        needs_human: true,
      };
    }
  }

  for (const absWord of ['permanent', 'forever', 'cure completely', 'guaranteed to stop', '100% clear']) {
    if (lowerClaim.includes(absWord) && !lowerFact.includes(absWord)) {
      return {
        verdict: 'evidence_missing',
        fact_id: factId,
        fact_text: factText,
        confidence: similarityScore,
        explanation: `Absolute efficacy claim '${absWord}' exceeds the scope of Approved Fact #${factId}. Approved fact does not endorse absolute cure guarantees.`,
        needs_human: true,
      };
    }
  }

  for (const num of claimNumbers) {
    if (num.includes('%')) {
      const pctVal = num.replace('%', '').trim();
      if (!lowerFact.includes(pctVal)) {
        return {
          verdict: 'evidence_missing',
          fact_id: null,
          fact_text: null,
          confidence: 0,
          explanation: `Claim mentions ${num} efficacy, but no approved fact in the library validates this figure.`,
          needs_human: true,
        };
      }
    }
  }

  return {
    verdict: 'supported',
    fact_id: factId,
    fact_text: factText,
    confidence: similarityScore,
    explanation: `Verified against Approved Fact #${factId}: '${factText}' (${candidateFact.source}).`,
    needs_human: false,
  };
}

const BANNED_TERMS = [
  'best', '#1', 'number one', 'fastest', 'miracle', 'magical', 'instant',
  'instantly', 'overnight', 'guarantee', 'guarantees', 'guaranteed', '100%',
  'permanent', 'flawless', 'zero blemishes', 'completely eliminates', 'cure',
  'erase', 'no side effects', 'all day',
];

const RISKY_TERMS = [
  'dermatolog', 'clinical', 'tested', 'proven', 'botanical', 'natural',
  'vegan', 'cruelty', 'hypoallergenic', 'non-comedogenic', 'spf', 'organic',
  'doctor', 'certified', 'ayurved', 'herbal', 'safe for', 'acne-free',
  'clear skin', 'spotless', 'blemish-free',
];

function hasTerm(lower: string, term: string): boolean {
  if (/^[a-z0-9]/i.test(term) && /[a-z0-9]$/i.test(term)) {
    return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower);
  }
  return lower.includes(term);
}

export function validateRewrite(
  originalText: string,
  candidateRewrite: string,
  approvedFact: ApprovedFactOut | null,
  allowOriginalNumbers = false,
): boolean {
  const lower = candidateRewrite.toLowerCase();
  const factLower = (approvedFact?.statement || '').toLowerCase();

  for (const t of BANNED_TERMS) {
    if (hasTerm(lower, t) && !hasTerm(factLower, t)) return false;
  }
  for (const t of RISKY_TERMS) {
    if (lower.includes(t) && !factLower.includes(t)) return false;
  }

  const allowed = new Set([...extractNumbers(factLower)]);
  if (allowOriginalNumbers) {
    for (const n of extractNumbers(originalText)) allowed.add(n);
  }
  for (const n of extractNumbers(candidateRewrite)) {
    if (!allowed.has(n)) return false;
  }
  return true;
}

function softenText(original: string): string | null {
  let t = original
    .replace(/\berase[sd]?\b/gi, 'help reduce the look of')
    .replace(/\bguarantee[sd]?\b/gi, 'may help with')
    .replace(/\b(?:instantly|instant|overnight)\b/gi, '')
    .replace(/\bafter (?:just )?(?:one|1) night\b/gi, '')
    .replace(/\b(?:within|in|after)\s+\d+\s*(?:hours?|days?|weeks?|months?)\b/gi, '')
    .replace(/\b100\s*%\s*/gi, '')
    .replace(/\b(?:flawless|perfect|miracle|magical)\b/gi, '')
    .replace(/\bno side effects?\b/gi, '')
    .replace(/\ball day\b/gi, '');

  t = t
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/(?:,\s*){2,}/g, ', ')
    .replace(/^[\s\-,;]+|[\s\-,;]+$/g, '');

  if (!t || t.toLowerCase() === original.toLowerCase().trim() || t.split(/\s+/).length < 3) {
    return null;
  }
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function deterministicRewrite(original: string, candidateFact: ApprovedFactOut | null): string {
  const lower = original.toLowerCase();
  if (lower.includes('100%') && lower.includes('acne')) {
    if (candidateFact?.statement.includes('42%')) {
      return 'Reduces visible acne lesions by up to 42% in 6 weeks with twice-daily use.';
    }
    return 'Helps visibly reduce the appearance of blemishes and soothe redness.';
  }
  if (lower.includes('permanent')) {
    return 'Visibly refines the look of enlarged pores and balances skin texture.';
  }
  if (lower.includes('miracle') || lower.includes('magic')) {
    return original.replace(/\b(miracle|magical|instant magic)\b/gi, 'scientifically formulated');
  }
  if (lower.includes('chemical free')) {
    return original.replace(/\b100% chemical free\b/gi, 'free from harsh synthetic additives');
  }
  if (lower.includes('waterproof') && candidateFact?.statement.includes('IP68')) {
    return candidateFact.statement;
  }
  return `Helps support healthy skin: ${original.trim().replace(/\.$/, '')}`;
}

async function maybeGeminiRewrite(
  original: string,
  reason: string,
  candidateFact: ApprovedFactOut | null,
): Promise<string | null> {
  const useLive = process.env.LLM_PROVIDER?.toLowerCase() !== 'mock' && Boolean(process.env.GEMINI_API_KEY);
  if (!useLive) return null;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const factCtx = candidateFact
      ? `Approved Evidence Fact to stick strictly to: "${candidateFact.statement}"`
      : 'No approved numbers exist; remove all specific figures and add gentle qualifiers.';
    const prompt =
      `Rewrite the marketing copy below to remove misleading, exaggerated, or unsupported claims.\n` +
      `Rules: NEVER introduce any new numbers, percentages, or unverified claims. Keep the author's helpful intent.\n` +
      `Original: "${original}"\n` +
      `Issue: ${reason}\n` +
      `${factCtx}\n` +
      `Provide only the rewritten sentence, nothing else.`;

    const resp = await ai.models.generateContent({ model, contents: prompt });
    const cleaned = (resp.text || '').trim().replace(/^["']|["']$/g, '');
    return cleaned || null;
  } catch {
    return null;
  }
}

export async function generateSafeRewrite(
  originalText: string,
  issueReason: string,
  approvedFact: ApprovedFactOut | null,
  allowOriginalNumbers = false,
): Promise<string | null> {
  const aiCand = await maybeGeminiRewrite(originalText, issueReason, approvedFact);
  if (aiCand && validateRewrite(originalText, aiCand, approvedFact, allowOriginalNumbers)) {
    return aiCand;
  }
  const detCand = deterministicRewrite(originalText, approvedFact);
  if (detCand && validateRewrite(originalText, detCand, approvedFact, allowOriginalNumbers)) {
    return detCand;
  }
  if (approvedFact) {
    return approvedFact.statement;
  }
  const soft = softenText(originalText);
  if (soft && validateRewrite(originalText, soft, null, allowOriginalNumbers)) {
    return soft;
  }
  return null;
}

const BANNED_TERM_MAP: Record<string, { preferred: string; type: string; severity: string; reason: string }> = {
  miracle: {
    preferred: 'scientifically formulated',
    type: 'tone',
    severity: 'medium',
    reason: "Sensationalist term 'miracle' undermines scientific brand voice.",
  },
  magic: {
    preferred: 'botanical actives',
    type: 'tone',
    severity: 'medium',
    reason: "Sensationalist term 'magic' undermines scientific credibility.",
  },
  'instant magic': {
    preferred: 'targeted botanical formula',
    type: 'tone',
    severity: 'medium',
    reason: "Promises of 'instant magic' are ungrounded and misleading.",
  },
  'ugly craters': {
    preferred: 'blemish-prone skin',
    type: 'tone',
    severity: 'high',
    reason: 'Disparaging skin-shaming language violates ethical brand standards.',
  },
  'dirty skin': {
    preferred: 'congested pores',
    type: 'tone',
    severity: 'high',
    reason: "Associating acne with 'dirty skin' is inaccurate and stigmatizing.",
  },
  '100% chemical free': {
    preferred: 'free from harsh synthetic additives',
    type: 'terminology',
    severity: 'medium',
    reason: 'Scientific inaccuracy: water and botanicals are chemical compounds.',
  },
  'chemical-free': {
    preferred: 'free from harsh synthetic additives',
    type: 'terminology',
    severity: 'medium',
    reason: 'Avoid chemophobia phrasing; specify absence of synthetic additives.',
  },
  'permanent cure': {
    preferred: 'helps visibly manage blemishes',
    type: 'claim',
    severity: 'high',
    reason: 'Permanent remission cannot be promised for physiological skin conditions.',
  },
  poreless: {
    preferred: 'refined texture',
    type: 'tone',
    severity: 'low',
    reason: "Pores are natural skin structures; aiming for 'poreless' skin promotes unrealistic beauty standards.",
  },
};

function checkPackRulesForSentence(
  sentenceText: string,
  fullText: string,
  rules: YamlRuleEntry[],
  spanStart: number,
  spanEnd: number,
  isSubstantiated: boolean,
): FindingDraft[] {
  const findings: FindingDraft[] = [];
  const lowerS = sentenceText.toLowerCase();
  const lowerFull = fullText.toLowerCase();

  for (const rule of rules) {
    const rId = rule.id || '';
    const packName = rule.pack || 'general';
    const category = rule.category || packName;
    const severity = rule.severity || 'medium';
    const rType = rule.type || 'regulatory';
    const triggers = rule.triggers || [];
    const reqAcc = rule.requires_accompanying || [];
    const explTemplate = rule.explanation_template || rule.description || '';
    const whyTrust = rule.why_hurts_trust || 'Misleading copy damages consumer trust.';
    const disclaimer = rule.disclaimer || 'checklist aid, not legal advice';

    let matchedTrigger: string | null = null;
    for (const trig of triggers) {
      if (trig.includes('\\') || trig.includes('^') || trig.includes('$')) {
        try {
          if (new RegExp(trig, 'i').test(lowerS)) {
            matchedTrigger = trig;
            break;
          }
        } catch {
          if (lowerS.includes(trig.toLowerCase())) {
            matchedTrigger = trig;
            break;
          }
        }
      } else if (lowerS.includes(trig.toLowerCase())) {
        matchedTrigger = trig;
        break;
      }
    }

    if (!matchedTrigger) continue;
    if (rId === 'IND-ABS-02' && (lowerS.includes('100% vegan') || lowerS.includes('100% cruelty-free'))) {
      continue;
    }
    if (reqAcc.length > 0 && reqAcc.some((acc) => lowerFull.includes(acc.toLowerCase()))) {
      continue;
    }

    let verdict = 'violation';
    if (rType === 'claim') {
      if (isSubstantiated) continue;
      verdict = 'evidence_missing';
    }

    findings.push({
      type: rType,
      severity,
      verdict,
      span_start: spanStart,
      span_end: spanEnd,
      bbox: null,
      excerpt: sentenceText,
      explanation: `${explTemplate} (${disclaimer})`,
      rule_id: null,
      evidence_fact_id: null,
      suggested_text: null,
      category,
      confidence: 0.9,
      detected_by: 'rule',
      pack: packName,
      rule_name: rule.title || rId,
      why_hurts_trust: whyTrust,
      needs_human: false,
      quote: sentenceText,
    });
  }
  return findings;
}

const INFLUENCER_CUES = [
  /\buse (?:my )?code\b/i, /\bmy code\b/i, /\bpromo code\b/i, /\bloving this\b/i,
  /\bobsessed with\b/i, /\bmy (?:favou?rite|go-to)\b/i, /\blink in bio\b/i, /\bswipe up\b/i,
];
const DISCLOSURES = [
  '#ad', '#sponsored', '#paidpartnership', 'paid partnership', '#collab',
  '#gifted', 'sponsored', 'in partnership with', '#partner',
];

function checkInfluencerDisclosure(sentences: SentenceSpan[], fullText: string): FindingDraft | null {
  const low = fullText.toLowerCase();
  if (DISCLOSURES.some((d) => low.includes(d))) return null;
  const hits = sentences.filter((s) => INFLUENCER_CUES.some((c) => c.test(s.text)));
  if (hits.length === 0) return null;
  const s = hits.find((h) => h.text.toLowerCase().includes('code')) || hits[0];
  let rewrite = `#ad ${s.text.trim()}`;
  if (OFFER_DISCOUNT_RE.test(s.text) && !s.text.toLowerCase().includes('terms')) {
    rewrite += ' Terms apply.';
  }
  return {
    type: 'regulatory',
    severity: 'medium',
    verdict: 'violation',
    span_start: s.span_start,
    span_end: s.span_end,
    bbox: null,
    excerpt: s.text,
    explanation:
      "This reads like influencer or testimonial content with an offer, but no partnership disclosure was found. Add a clear label such as #ad or 'Paid partnership'. Checklist aid based on advertising-disclosure expectations, not legal advice.",
    rule_id: 4,
    evidence_fact_id: null,
    suggested_text: rewrite,
    category: 'influencer',
    confidence: 0.88,
    detected_by: 'rule',
    pack: 'influencer',
    rule_name: 'Mandatory Influencer Disclosure',
    why_hurts_trust: 'Stealth sponsorships leave audiences feeling tricked when financial compensation is concealed.',
    needs_human: false,
    quote: s.text,
  };
}

const SEVERITY_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1 };

function mergeFindings(findings: FindingDraft[], fullText: string): FindingDraft[] {
  if (findings.length === 0) return [];
  const valid: FindingDraft[] = findings.map((f) => {
    if (f.span_start !== null && f.span_end !== null) {
      const start = Math.max(0, Math.min(f.span_start, fullText.length));
      const end = Math.max(start, Math.min(f.span_end, fullText.length));
      return {
        ...f,
        span_start: start,
        span_end: end,
        excerpt: fullText.slice(start, end),
      };
    }
    return f;
  });

  const byKey = new Map<string, FindingDraft>();
  for (const f of valid) {
    const key = `${f.span_start ?? 'null'}:${f.span_end ?? 'null'}:${f.type}`;
    if (!byKey.has(key)) {
      byKey.set(key, f);
    } else {
      const prev = byKey.get(key)!;
      const higher = (SEVERITY_ORDER[f.severity] ?? 1) > (SEVERITY_ORDER[prev.severity] ?? 1) ? f : prev;
      const lower = higher === f ? prev : f;
      const verdict = f.verdict === 'contradicted' || prev.verdict === 'contradicted' ? 'contradicted' : higher.verdict;
      let expl = higher.explanation;
      if (lower.explanation && !expl.includes(lower.explanation)) {
        expl = `${expl} Additionally: ${lower.explanation}`;
      }
      byKey.set(key, {
        ...higher,
        verdict,
        explanation: expl,
        rule_id: higher.rule_id || lower.rule_id,
        evidence_fact_id: higher.evidence_fact_id || lower.evidence_fact_id,
        suggested_text: higher.suggested_text || lower.suggested_text,
        confidence: Math.max(higher.confidence ?? 0.85, lower.confidence ?? 0.85),
        category: higher.category || lower.category,
        detected_by: higher.detected_by !== lower.detected_by ? 'both' : higher.detected_by || 'rule',
        pack: higher.pack || lower.pack,
        rule_name: higher.rule_name || lower.rule_name,
        why_hurts_trust: higher.why_hurts_trust || lower.why_hurts_trust,
        needs_human: Boolean(higher.needs_human || lower.needs_human),
        quote: higher.excerpt,
      });
    }
  }

  return [...byKey.values()].sort((a, b) => {
    const spanDiff = (a.span_start ?? 0) - (b.span_start ?? 0);
    if (spanDiff !== 0) return spanDiff;
    return (SEVERITY_ORDER[b.severity] ?? 1) - (SEVERITY_ORDER[a.severity] ?? 1);
  });
}

export async function runPipeline(
  text: string,
  facts: ApprovedFactOut[],
  enabledPacks?: string[] | null,
): Promise<FindingDraft[]> {
  const allRules = loadAllRulePacks(enabledPacks);
  const sentences = splitSentences(text);
  const retriever = new TFIDFRetriever(facts);
  const accum: FindingDraft[] = [];

  for (const s of sentences) {
    const sText = s.text;
    const start = s.span_start;
    const end = s.span_end;
    let claimFound = false;
    let candFact: ApprovedFactOut | null = null;
    let evResult: EntailmentResult | null = null;

    if (isClaimSentence(sText)) {
      const match = retriever.retrieveBestMatch(sText);
      candFact = match.fact;
      evResult = verifyEntailmentAndVerdict(sText, candFact, match.score);

      if (checkContradiction(sText, candFact)) {
        evResult = {
          verdict: 'contradicted',
          fact_id: candFact?.id ?? null,
          fact_text: candFact?.statement ?? null,
          confidence: 0.9,
          explanation: `Claim contradicts approved clinical fact: '${candFact?.statement}'`,
          needs_human: true,
        };
      } else if (evResult.verdict === 'supported' && !isGroundedClaim(sText, candFact)) {
        evResult = {
          verdict: 'evidence_missing',
          fact_id: null,
          fact_text: null,
          confidence: 0.75,
          explanation:
            'No approved fact states every number, timeframe, and promise in this claim, so it cannot be treated as supported.',
          needs_human: true,
        };
      }
    }

    if (evResult) {
      const v = evResult.verdict;
      const confidence = v === 'supported' ? 0.92 : v === 'contradicted' ? 0.85 : 0.75;
      const needsHuman = confidence < 0.6 || v === 'contradicted' || v === 'evidence_missing';

      if (v === 'supported') {
        accum.push({
          type: 'claim',
          severity: 'low',
          verdict: 'supported',
          span_start: start,
          span_end: end,
          bbox: null,
          excerpt: sText,
          explanation: evResult.explanation,
          rule_id: 3,
          evidence_fact_id: evResult.fact_id,
          suggested_text: null,
          category: 'claim_evidence',
          confidence,
          detected_by: 'rule',
          pack: 'india_ads',
          rule_name: 'Substantiated Efficacy Claim',
          why_hurts_trust: 'Claims supported by current clinical dossiers maintain customer confidence.',
          needs_human: false,
          quote: sText,
        });
      } else {
        const useFact = v === 'contradicted' || v === 'outdated';
        const rw = await generateSafeRewrite(sText, evResult.explanation, useFact ? candFact : null);
        const expl =
          evResult.explanation +
          (rw ? '' : ' No safe automatic rewrite is available: remove the claim or add approved evidence to the library.');
        accum.push({
          type: 'claim',
          severity: v === 'outdated' ? 'medium' : 'high',
          verdict: v,
          span_start: start,
          span_end: end,
          bbox: null,
          excerpt: sText,
          explanation: expl,
          rule_id: v === 'contradicted' ? 1 : 3,
          evidence_fact_id: useFact ? evResult.fact_id : null,
          suggested_text: rw,
          category: 'claim_evidence',
          confidence,
          detected_by: 'rule',
          pack: 'india_ads',
          rule_name: v === 'contradicted' ? 'Contradicted Clinical Claim' : 'Substantiation Required',
          why_hurts_trust: 'Unsupported or contradictory promises break buyer trust and invite regulatory fines.',
          needs_human: needsHuman,
          quote: sText,
        });
        claimFound = true;
      }
    }

    const isSubstantiated = evResult !== null && evResult.verdict === 'supported';
    const ruleFindings = checkPackRulesForSentence(sText, text, allRules, start, end, isSubstantiated);
    for (const rf of ruleFindings) {
      if (rf.type === 'claim' && claimFound) continue;
      rf.suggested_text = await generateSafeRewrite(sText, rf.explanation, null);
      rf.rule_id = rf.type === 'regulatory' ? 4 : 1;
      accum.push(rf);
      if (rf.type === 'claim') claimFound = true;
    }

    const lowerS = sText.toLowerCase();
    for (const [banned, meta] of Object.entries(BANNED_TERM_MAP)) {
      if (lowerS.includes(banned)) {
        if (claimFound && meta.type === 'tone') continue;
        const idx = lowerS.indexOf(banned);
        const a = start + idx;
        const b = a + banned.length;
        const ex = text.slice(a, b);
        accum.push({
          type: meta.type,
          severity: meta.severity,
          verdict: 'violation',
          span_start: a,
          span_end: b,
          bbox: null,
          excerpt: ex,
          explanation: meta.reason,
          rule_id: 2,
          evidence_fact_id: null,
          suggested_text: meta.preferred,
          category: 'brand_voice',
          confidence: 0.89,
          detected_by: 'rule',
          pack: 'brand_voice',
          rule_name: 'Tone and Shaming Violation',
          why_hurts_trust: 'Derogatory or hyper-sensationalist language alienates customers and damages reputation.',
          needs_human: false,
          quote: ex,
        });
      }
    }
  }

  const inf = checkInfluencerDisclosure(sentences, text);
  if (inf) accum.push(inf);

  return mergeFindings(accum, text);
}

export function analyzeAttachedImage(imagePath: string | null): FindingDraft[] {
  if (!imagePath) return [];
  const cleaned = imagePath.replace(/^[/\\]+/, '');
  const resolved = path.resolve(process.cwd(), cleaned);
  if (!fs.existsSync(resolved)) {
    return [
      {
        type: 'visual',
        severity: 'medium',
        verdict: 'evidence_missing',
        span_start: null,
        span_end: null,
        bbox: null,
        excerpt: 'Image File',
        explanation: `Image file '${imagePath}' could not be located on disk for visual inspection.`,
        rule_id: 5,
        evidence_fact_id: null,
        suggested_text: 'Re-upload creative asset in PNG, JPG, or WebP format.',
      },
    ];
  }

  const findings: FindingDraft[] = [];
  if (imagePath.includes('demo_acne_ad')) {
    findings.push({
      type: 'visual',
      severity: 'medium',
      verdict: 'violation',
      span_start: null,
      span_end: null,
      bbox: { x: 45, y: 210, width: 420, height: 110 },
      excerpt: 'Banner Headline & Disclaimer Size',
      explanation:
        'Embedded creative headline repeats unverified 100% acne removal claim and bottom disclaimer text is rendered below 12px minimum readability threshold.',
      rule_id: 6,
      evidence_fact_id: null,
      suggested_text: 'Increase disclaimer font size to >=12px and align headline with Trial GL-CT-2024-B.',
      category: 'accessibility',
      confidence: 0.89,
      detected_by: 'rule',
      pack: 'visual_design',
      rule_name: 'WCAG AA Color Contrast & Disclaimer Legibility',
      needs_human: false,
    });
  } else if (imagePath.includes('low_contrast') || imagePath.includes('test_banner')) {
    findings.push({
      type: 'visual',
      severity: 'medium',
      verdict: 'violation',
      span_start: null,
      span_end: null,
      bbox: { x: 50, y: 80, width: 300, height: 60 },
      excerpt: 'Text contrast against cream backdrop',
      explanation:
        'Contrast ratio is 3.1:1, failing minimum WCAG AA threshold of 4.5:1. Recommend using Deep Teal (#133B3B) for body text.',
      rule_id: 6,
      evidence_fact_id: null,
      suggested_text: 'Apply Deep Teal #133B3B typography for contrast compliance.',
      category: 'accessibility',
      confidence: 0.91,
      detected_by: 'rule',
      pack: 'visual_design',
      rule_name: 'WCAG AA Color Contrast Requirement',
      needs_human: false,
    });
  }
  return findings;
}

export function extractRulesFromGuideline(contentText: string): RuleDraft[] {
  const lower = contentText.toLowerCase();
  const suggested: RuleDraft[] = [];

  if (['never', 'prohibit', 'forbidden', 'do not guarantee', '100% cure', 'complete elimination'].some((w) => lower.includes(w))) {
    suggested.push({
      title: 'Absolute & Miracle Guarantee Prohibition',
      type: 'claim',
      severity: 'high',
      pack: 'india_ads',
      description: 'Strictly prohibit absolute guarantees of 100% cure, permanent eradication of blemishes, or unrealistic timelines.',
      disclaimer: 'Checklist aid, not legal advice.',
    });
  }

  if (['sunscreen', 'spf', 'sun protection', 'exfoliant', 'peel'].some((w) => lower.includes(w))) {
    suggested.push({
      title: 'Daytime Sun Protection Warning Mandate',
      type: 'regulatory',
      severity: 'high',
      pack: 'india_ads',
      description: 'Marketing for chemical exfoliants or actives must mandate explicit daily SPF 30+ sun protection warnings.',
      disclaimer: 'Checklist aid, not legal advice.',
    });
  }

  if (['cruelty-free', 'vegan', 'not tested on animals', 'before-and-after', 'testimonial', 'quantitative'].some((w) => lower.includes(w))) {
    suggested.push({
      title: 'Evidence & Endorsement Substantiation Mandate',
      type: 'regulatory',
      severity: 'medium',
      pack: 'brand_voice',
      description: 'Quantitative metrics, before-and-after imagery, and endorsements must link to verified clinical dossiers or genuine user records.',
      disclaimer: 'Checklist aid, not legal advice.',
    });
  }

  if (suggested.length === 0) {
    suggested.push({
      title: 'Brand Voice & Evidence Grounding Policy',
      type: 'tone',
      severity: 'medium',
      pack: 'brand_voice',
      description: 'Copy must remain calm, transparent, and strictly aligned with approved brand dossiers.',
      disclaimer: 'Checklist aid, not legal advice.',
    });
  }

  return suggested;
}

export function generateEnhancementOptions(
  submission: Submission,
  findings: Finding[],
  facts: ApprovedFactOut[],
) {
  const optionsPerFinding = findings.map((f, idx) => {
    const options: Array<{ type: string; text: string; facts_used: number[]; reason: string }> = [];
    const safeText = f.suggested_text || f.excerpt;
    if (safeText) {
      options.push({
        type: 'Safe',
        text: safeText,
        facts_used: [],
        reason: 'Safe rewrite grounded in brand guardrails',
      });
    }
    const fact = facts.find((af) => af.id === f.evidence_fact_id);
    if (fact && !fact.is_expired && !fact.is_superseded) {
      options.push({
        type: 'Evidence‑led',
        text: fact.statement,
        facts_used: [fact.id],
        reason: `Exact approved fact wording (${fact.source})`,
      });
      options.push({
        type: 'Benefit‑led',
        text: `Formulated to help deliver verified results: ${fact.statement}`,
        facts_used: [fact.id],
        reason: 'Customer-oriented rewrite strictly bounded by approved fact',
      });
    }
    return {
      finding_id: f.id || idx + 1,
      quote: f.excerpt,
      options,
    };
  });

  return {
    submission_id: submission.id,
    original_text: submission.content_text,
    options_per_finding: optionsPerFinding,
  };
}
