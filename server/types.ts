export interface Organization {
  id: number;
  name: string;
  slug: string;
  industry: string;
  settings: {
    enabled_rule_packs: string[];
    [key: string]: unknown;
  };
  created_at: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  department: string;
  password_hash: string;
  is_active: boolean;
  created_at: string;
}

export interface Membership {
  id: number;
  user_id: number;
  org_id: number;
  role: string;
  department: string;
  is_active: boolean;
  created_at: string;
}

export interface Brand {
  id: number;
  org_id: number;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  palette: Record<string, string> | null;
  created_at: string;
}

export interface Guideline {
  id: number;
  org_id: number;
  title: string;
  filename: string;
  content_text: string;
  created_at: string;
}

export interface ApprovedFact {
  id: number;
  org_id: number;
  statement: string;
  source: string;
  version: number;
  valid_until: string | null;
  supersedes_id: number | null;
  created_at: string;
}

export interface ApprovedFactOut extends ApprovedFact {
  is_expired: boolean;
  is_superseded: boolean;
}

export interface Rule {
  id: number;
  org_id: number;
  title: string;
  type: string;
  severity: string;
  pack: string;
  description: string;
  disclaimer: string;
  is_active: boolean;
  created_at: string;
}

export interface RuleDraft {
  title: string;
  type: string;
  severity: string;
  pack: string;
  description: string;
  disclaimer?: string;
}

export interface Submission {
  id: number;
  org_id: number;
  title: string;
  author_id: number;
  department: string;
  version: number;
  status: string;
  compliance_score: number;
  content_text: string;
  image_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmissionVersion {
  id: number;
  org_id: number;
  submission_id: number;
  version_number: number;
  content_text: string;
  diff_from_previous: string | null;
  created_at: string;
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Finding {
  id: number;
  org_id: number;
  submission_id: number;
  version_number: number;
  type: string;
  severity: string;
  verdict: string;
  span_start: number | null;
  span_end: number | null;
  bbox: BBox | null;
  excerpt: string;
  explanation: string;
  rule_id: number | null;
  evidence_fact_id: number | null;
  suggested_text: string | null;
  decision: string;
  justification: string | null;
  created_at: string;
  category?: string | null;
  confidence?: number | null;
  detected_by?: string | null;
  pack?: string | null;
  rule_name?: string | null;
  why_hurts_trust?: string | null;
  needs_human?: boolean;
}

export interface FindingDraft {
  type: string;
  severity: string;
  verdict: string;
  excerpt: string;
  explanation: string;
  span_start: number | null;
  span_end: number | null;
  bbox: BBox | null;
  rule_id: number | null;
  evidence_fact_id: number | null;
  suggested_text: string | null;
  category?: string | null;
  confidence?: number;
  detected_by?: string;
  pack?: string | null;
  rule_name?: string | null;
  why_hurts_trust?: string | null;
  needs_human?: boolean;
  quote?: string | null;
}

export interface Review {
  id: number;
  org_id: number;
  submission_id: number;
  reviewer_id: number;
  action: string;
  comment: string | null;
  override_reason: string | null;
  created_at: string;
}

export interface AuditEvent {
  id: number;
  org_id: number;
  actor_id: number | null;
  actor_name: string;
  role: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  before_state: string | null;
  after_state: string | null;
  timestamp: string;
}

export interface FeedbackReport {
  id: number;
  org_id: number;
  finding_id: number | null;
  user_id: number;
  comment: string;
  proposed_correction: string | null;
  created_at: string;
}

export interface ActiveContext {
  user: User;
  org: Organization;
  membership: Membership;
  activeRole: string;
  activeDepartment: string;
}
