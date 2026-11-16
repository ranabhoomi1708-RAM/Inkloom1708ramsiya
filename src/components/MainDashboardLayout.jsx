import React, { useMemo, useState } from 'react';
import {
  AreaChart, Area, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ArrowUpRight,
  ArrowRight,
  PlusCircle,
  Search,
  Scale,
  History,
  FileCheck2,
  FolderKanban,
  ShieldCheck,
  Image as ImageIcon,
  TrendingUp,
} from 'lucide-react';
import { StatusChip } from './StatusChip';

const ASCI_CCPA_PACKS = new Set(['india_ad_code', 'india_ads', 'claim_evidence', 'influencer', 'pricing_offers', 'dark_patterns', 'outdated_info']);

function classifyFramework(finding, linkedRule) {
  const pack = (finding.pack || linkedRule?.pack || '').toLowerCase();
  const title = (linkedRule?.title || finding.rule_name || '').toLowerCase();
  const expl = (finding.explanation || '').toLowerCase();

  const isCcp =
    pack === 'pricing_offers' ||
    pack === 'dark_patterns' ||
    expl.includes('ccpa') ||
    title.includes('permanent cure') ||
    title.includes('free offer') ||
    title.includes('mrp');
  const isAsci =
    pack === 'india_ad_code' ||
    pack === 'india_ads' ||
    pack === 'influencer' ||
    pack === 'claim_evidence' ||
    expl.includes('asci') ||
    finding.type === 'claim' ||
    finding.type === 'regulatory';

  if (isAsci && isCcp) return 'ASCI & CCPA';
  if (isCcp) return 'CCPA 2022';
  if (isAsci || ASCI_CCPA_PACKS.has(pack)) return 'ASCI Code';
  return 'Brand & Visual';
}

function formatAuditSummary(ev) {
  if (!ev.after_state) return 'State transition logged';
  try {
    const parsed = JSON.parse(ev.after_state);
    if (parsed.status && parsed.compliance_score !== undefined) {
      return `Status -> ${parsed.status.replace(/_/g, ' ')} (Score ${Math.round(parsed.compliance_score)}/100)`;
    }
    if (parsed.status) {
      return `Status -> ${parsed.status.replace(/_/g, ' ')}`;
    }
    if (parsed.decision) {
      return `Finding ${parsed.decision}${parsed.justification ? `: "${parsed.justification}"` : ''}`;
    }
    if (parsed.title) {
      return `${parsed.title}`;
    }
    return ev.after_state;
  } catch {
    return ev.after_state;
  }
}

function getAuditBadgeStyle(action = '') {
  const norm = action.toLowerCase();
  if (norm.includes('approved')) return 'bg-[#2E9E6B]/15 text-[#1e6d49] border-[#2E9E6B]/30';
  if (norm.includes('revision') || norm.includes('rejected')) return 'bg-[#E0A030]/15 text-[#9e6f1c] border-[#E0A030]/30';
  if (norm.includes('check') || norm.includes('submitted')) return 'bg-mint text-deepTeal border-teal/25';
  return 'bg-cream text-teal border-[#E0DACE]';
}

export const MainDashboardLayout = ({
  brand = null,
  submissions = [],
  rules = [],
  auditEvents = [],
  analytics = null,
  currentRole = 'employee',
  onNavigate,
  onSelectSubmission,
  onOpenAudit,
}) => {
  const [projectFilter, setProjectFilter] = useState('all'); // all | action | in_review | approved
  const [searchQuery, setSearchQuery] = useState('');
  const [ruleFocusFilter, setRuleFocusFilter] = useState('all'); // all | asci | ccpa
  const [chartDepartment, setChartDepartment] = useState('all');

  const rulesById = useMemo(() => {
    const map = new Map();
    for (const r of rules) map.set(r.id, r);
    return map;
  }, [rules]);

  // Pending verification tasks aggregated across active submissions & ASCI/CCPA rules
  const pendingVerificationTasks = useMemo(() => {
    const tasks = [];
    for (const sub of submissions) {
      const subFindings = Array.isArray(sub.findings) ? sub.findings : [];
      for (const f of subFindings) {
        if (f.decision !== 'pending') continue;
        const linkedRule = f.rule_id ? rulesById.get(f.rule_id) : null;
        const framework = classifyFramework(f, linkedRule);
        tasks.push({
          id: `${sub.id}-${f.id}`,
          submissionId: sub.id,
          submissionTitle: sub.title,
          submissionStatus: sub.status,
          department: sub.department,
          findingId: f.id,
          severity: f.severity || 'medium',
          verdict: f.verdict || 'violation',
          type: f.type || 'regulatory',
          excerpt: f.excerpt,
          explanation: f.explanation,
          ruleTitle: linkedRule?.title || f.rule_name || 'Compliance Check',
          framework,
        });
      }
    }

    const sevWeight = { high: 3, medium: 2, low: 1 };
    return tasks.sort((a, b) => (sevWeight[b.severity] || 0) - (sevWeight[a.severity] || 0));
  }, [submissions, rulesById]);

  const asciPendingCount = useMemo(
    () => pendingVerificationTasks.filter((t) => t.framework.includes('ASCI')).length,
    [pendingVerificationTasks],
  );
  const ccpaPendingCount = useMemo(
    () => pendingVerificationTasks.filter((t) => t.framework.includes('CCPA')).length,
    [pendingVerificationTasks],
  );
  const asciCcpaRuleCount = useMemo(
    () => rules.filter((r) => r.is_active && ASCI_CCPA_PACKS.has((r.pack || '').toLowerCase())).length,
    [rules],
  );

  const visibleTasks = useMemo(() => {
    return pendingVerificationTasks.filter((t) => {
      if (ruleFocusFilter === 'asci') return t.framework.includes('ASCI');
      if (ruleFocusFilter === 'ccpa') return t.framework.includes('CCPA');
      return true;
    });
  }, [pendingVerificationTasks, ruleFocusFilter]);

  // Filtered active marketing projects
  const filteredProjects = useMemo(() => {
    return submissions.filter((sub) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchesTitle = (sub.title || '').toLowerCase().includes(q);
        const matchesDept = (sub.department || '').toLowerCase().includes(q);
        const matchesAuthor = (sub.author_name || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDept && !matchesAuthor) return false;
      }

      if (projectFilter === 'action') {
        const hasPending = (sub.findings || []).some((f) => f.decision === 'pending');
        return ['draft', 'ai_checked', 'revision_requested'].includes(sub.status) || hasPending;
      }
      if (projectFilter === 'in_review') return sub.status === 'in_review';
      if (projectFilter === 'approved') return sub.status === 'approved';
      return true;
    });
  }, [submissions, projectFilter, searchQuery]);

  // KPI metrics
  const inReviewCount = submissions.filter((s) => s.status === 'in_review').length;
  const approvedCount = submissions.filter((s) => s.status === 'approved').length;
  const actionNeededCount = submissions.filter((s) =>
    ['draft', 'ai_checked', 'revision_requested'].includes(s.status),
  ).length;
  const avgScore = submissions.length
    ? Math.round(submissions.reduce((acc, s) => acc + (Number(s.compliance_score) || 0), 0) / submissions.length)
    : 100;

  // Chart data
  const weeklyData = analytics?.issues_per_week?.length
    ? analytics.issues_per_week
    : [
        { week: 'W44', count: 5 },
        { week: 'W45', count: 8 },
        { week: 'W46', count: 6 },
      ];

  const typeData = analytics?.issues_by_type
    ? Object.entries(analytics.issues_by_type).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }))
    : [
        { name: 'Claim', value: 5 },
        { name: 'Regulatory', value: 2 },
        { name: 'Tone', value: 1 },
        { name: 'Visual', value: 1 },
      ];

  const TYPE_COLORS = {
    Claim: '#E8775D',
    Regulatory: '#1A6B66',
    Tone: '#E0A030',
    Visual: '#133B3B',
    Terminology: '#258B85',
  };

  // Departments available for the compliance-over-time filter
  const departments = useMemo(() => {
    const set = new Set(submissions.map((s) => s.department).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [submissions]);

  // Chronological compliance score series across all marketing projects
  const complianceTimelineData = useMemo(() => {
    const scoped = submissions.filter(
      (s) => chartDepartment === 'all' || s.department === chartDepartment,
    );
    const sorted = [...scoped].sort((a, b) => {
      const ta = new Date(a.updated_at || a.created_at || 0).getTime();
      const tb = new Date(b.updated_at || b.created_at || 0).getTime();
      return ta - tb;
    });

    let runningSum = 0;
    return sorted.map((sub, idx) => {
      const score = Math.round(Number(sub.compliance_score) || 0);
      runningSum += score;
      const rollingAvg = Math.round((runningSum / (idx + 1)) * 10) / 10;
      const dt = new Date(sub.updated_at || sub.created_at || Date.now());
      const dateLabel = dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const shortTitle =
        sub.title && sub.title.length > 22 ? `${sub.title.slice(0, 20)}...` : sub.title || `Project #${sub.id}`;

      return {
        id: sub.id,
        dateLabel,
        label: `${dateLabel} · #${sub.id}`,
        title: sub.title,
        shortTitle,
        department: sub.department,
        status: sub.status,
        version: sub.version || 1,
        score,
        rollingAvg,
      };
    });
  }, [submissions, chartDepartment]);

  const latestRollingAvg = complianceTimelineData.length
    ? complianceTimelineData[complianceTimelineData.length - 1].rollingAvg
    : avgScore;
  const aboveThresholdCount = complianceTimelineData.filter((d) => d.score >= 85).length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* TOP HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[#E7E2D6]">
        <div>
          <div className="flex items-center gap-2">
            <span className="caps-label">{brand?.name || 'GlowLeaf'} Workspace</span>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-mint text-deepTeal border border-teal/20 font-bold">
              {currentRole} view
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-deepTeal mt-1">
            Marketing Compliance &amp; Verification Dashboard
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Monitor active marketing projects, track recent compliance audit statuses, and clear pending ASCI &amp; CCPA verification tasks.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {onOpenAudit && (
            <button
              type="button"
              onClick={onOpenAudit}
              className="flex items-center gap-2 px-3.5 py-2 bg-warmWhite hover:bg-cream text-deepTeal border border-[#E0DACE] rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <History className="w-4 h-4 text-teal" />
              <span>Audit Log ({auditEvents.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('new')}
            className="flex items-center gap-2 px-4 py-2 bg-teal hover:bg-teal-dark text-white rounded-xl text-xs font-bold shadow-soft transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Submission</span>
          </button>
        </div>
      </div>

      {/* KPI STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-warmWhite p-5 rounded-2xl border border-[#E7E2D6] shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-teal">Active Projects</span>
            <div className="w-8 h-8 rounded-lg bg-mint flex items-center justify-center text-teal">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-deepTeal">{submissions.length}</span>
            <span className="text-xs font-semibold text-gray-500">{inReviewCount} in review</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{actionNeededCount} awaiting author action</p>
        </div>

        <div className="bg-warmWhite p-5 rounded-2xl border border-[#E7E2D6] shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-coral">Pending ASCI / CCPA</span>
            <div className="w-8 h-8 rounded-lg bg-blush flex items-center justify-center text-coral">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-deepTeal">{pendingVerificationTasks.length}</span>
            <span className="text-xs font-semibold text-coral">
              {pendingVerificationTasks.filter((t) => t.severity === 'high').length} high severity
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {asciPendingCount} ASCI · {ccpaPendingCount} CCPA tasks open
          </p>
        </div>

        <div className="bg-warmWhite p-5 rounded-2xl border border-[#E7E2D6] shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#2E9E6B]">Cleared &amp; Approved</span>
            <div className="w-8 h-8 rounded-lg bg-[#2E9E6B]/15 flex items-center justify-center text-[#2E9E6B]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-deepTeal">{approvedCount}</span>
            <span className="inline-flex items-center text-xs font-semibold text-emerald-700">
              <ArrowUpRight className="w-3.5 h-3.5" /> {avgScore}/100 avg
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Evidence-backed &amp; gate-verified</p>
        </div>

        <div className="bg-warmWhite p-5 rounded-2xl border border-[#E7E2D6] shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-deepTeal">Audit Trail Status</span>
            <div className="w-8 h-8 rounded-lg bg-cream border border-[#E0DACE] flex items-center justify-center text-teal">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-deepTeal">{auditEvents.length}</span>
            <span className="text-xs font-semibold text-teal">Immutable events</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Avg review turnaround: {analytics?.average_review_time_hours ?? 2.5}h
          </p>
        </div>
      </div>

      {/* MAIN TWO-COLUMN OPERATIONAL DASHBOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (7/12): ACTIVE MARKETING PROJECTS */}
        <section
          aria-label="Active Marketing Projects"
          className="lg:col-span-7 bg-warmWhite rounded-2xl border border-[#E7E2D6] shadow-soft overflow-hidden"
        >
          <div className="p-5 sm:p-6 border-b border-[#E7E2D6] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="caps-label">Campaign Pipeline</span>
                <h2 className="text-lg font-bold text-deepTeal">Active Marketing Projects</h2>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by campaign or team..."
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#E0DACE] bg-cream/50 text-deepTeal focus:outline-none focus:ring-2 focus:ring-teal/30 w-full sm:w-56"
                />
              </div>
            </div>

            {/* Project Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: `All (${submissions.length})` },
                { id: 'action', label: `Action Needed (${actionNeededCount})` },
                { id: 'in_review', label: `In Review (${inReviewCount})` },
                { id: 'approved', label: `Approved (${approvedCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setProjectFilter(tab.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    projectFilter === tab.id
                      ? 'bg-deepTeal text-white shadow-sm'
                      : 'bg-cream text-gray-600 hover:text-deepTeal border border-[#E7E2D6]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-[#EAE5D9]">
            {filteredProjects.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                No marketing projects match your current filter.
              </div>
            ) : (
              filteredProjects.map((sub) => {
                const score = Math.round(Number(sub.compliance_score) || 0);
                const subFindings = Array.isArray(sub.findings) ? sub.findings : [];
                const pendingCount = subFindings.filter((f) => f.decision === 'pending').length;
                const highRiskCount = subFindings.filter((f) => f.severity === 'high' && f.decision !== 'accepted').length;

                let barColor = 'bg-[#2E9E6B]';
                let scoreTextColor = 'text-[#1e6d49]';
                if (score < 60) {
                  barColor = 'bg-[#D9534F]';
                  scoreTextColor = 'text-[#a8322e]';
                } else if (score < 85) {
                  barColor = 'bg-[#E0A030]';
                  scoreTextColor = 'text-[#9e6f1c]';
                }

                return (
                  <div
                    key={sub.id}
                    onClick={() => onSelectSubmission(sub.id)}
                    className="p-5 hover:bg-cream/50 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-deepTeal truncate">{sub.title}</h3>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-cream border border-[#E0DACE] text-gray-600">
                          v{sub.version}
                        </span>
                        {sub.image_path && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-teal/10 text-teal font-mono font-semibold">
                            <ImageIcon className="w-3 h-3" /> Creative
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-600 line-clamp-1">{sub.content_text}</p>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 pt-0.5">
                        <span className="font-semibold text-gray-700">{sub.department}</span>
                        <span>· {sub.author_name || `User #${sub.author_id}`}</span>
                        {pendingCount > 0 && (
                          <span className="font-semibold text-coral">
                            · {pendingCount} pending finding{pendingCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {highRiskCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-blush text-[#a8322e] font-bold text-[10px]">
                            {highRiskCount} high risk
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                      <StatusChip status={sub.status} />

                      <div className="flex items-center gap-3">
                        <div className="w-24 text-right">
                          <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                            <span className="text-gray-400">Fit</span>
                            <span className={scoreTextColor}>{score}/100</span>
                          </div>
                          <div className="w-full h-1.5 bg-cream rounded-full overflow-hidden border border-[#E7E2D6]">
                            <div
                              className={`h-full rounded-full transition-all ${barColor}`}
                              style={{ width: `${Math.max(4, Math.min(100, score))}%` }}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSubmission(sub.id);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cream hover:bg-mint text-xs font-bold text-teal border border-[#E0DACE] transition-colors"
                        >
                          <span>Review</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* RIGHT COLUMN (5/12): PENDING ASCI & CCPA TASKS + RECENT COMPLIANCE AUDIT STATUSES */}
        <div className="lg:col-span-5 space-y-6">
          {/* PANEL 1: PENDING VERIFICATION TASKS FOR ASCI AND CCPA RULES */}
          <section
            aria-label="Pending ASCI and CCPA Verification Tasks"
            className="bg-warmWhite rounded-2xl border border-[#E7E2D6] shadow-soft overflow-hidden"
          >
            <div className="p-5 border-b border-[#E7E2D6] space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="caps-label">India Rule Pack Governance</span>
                  <h2 className="text-base font-bold text-deepTeal">
                    Pending ASCI &amp; CCPA Verification Tasks
                  </h2>
                </div>
                <span className="px-2 py-0.5 rounded bg-blush text-[#a8322e] text-[11px] font-bold border border-coral/30 shrink-0">
                  {pendingVerificationTasks.length} Open
                </span>
              </div>

              <div className="px-3 py-1.5 rounded-lg bg-cream/80 border border-[#E7E2D6] text-[11px] text-gray-600 flex items-center justify-between gap-2">
                <span>Checklist aid, not legal advice</span>
                <span className="font-mono font-semibold text-teal">{asciCcpaRuleCount} active rules</span>
              </div>

              {/* ASCI vs CCPA Summary Tiles */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setRuleFocusFilter(ruleFocusFilter === 'asci' ? 'all' : 'asci')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    ruleFocusFilter === 'asci'
                      ? 'bg-mint/70 border-teal ring-1 ring-teal'
                      : 'bg-cream/50 border-[#E7E2D6] hover:bg-cream'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal block">
                    ASCI Code
                  </span>
                  <span className="text-xl font-extrabold text-deepTeal">{asciPendingCount}</span>
                  <span className="text-[11px] text-gray-500 block">Claims, SPF &amp; disclosures</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRuleFocusFilter(ruleFocusFilter === 'ccpa' ? 'all' : 'ccpa')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    ruleFocusFilter === 'ccpa'
                      ? 'bg-blush/80 border-coral ring-1 ring-coral'
                      : 'bg-cream/50 border-[#E7E2D6] hover:bg-cream'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-coral block">
                    CCPA 2022
                  </span>
                  <span className="text-xl font-extrabold text-deepTeal">{ccpaPendingCount}</span>
                  <span className="text-[11px] text-gray-500 block">Misleading guarantees &amp; offers</span>
                </button>
              </div>
            </div>

            <div className="divide-y divide-[#EAE5D9] max-h-80 overflow-y-auto">
              {visibleTasks.length === 0 ? (
                <div className="p-6 text-center space-y-1">
                  <FileCheck2 className="w-6 h-6 text-[#2E9E6B] mx-auto" />
                  <p className="text-xs font-bold text-deepTeal">All ASCI &amp; CCPA tasks resolved</p>
                  <p className="text-[11px] text-gray-500">
                    Every flagged claim and regulatory requirement has an author decision.
                  </p>
                </div>
              ) : (
                visibleTasks.slice(0, 6).map((task) => {
                  const isHigh = task.severity === 'high';
                  return (
                    <div
                      key={task.id}
                      onClick={() => onSelectSubmission(task.submissionId)}
                      className="p-4 hover:bg-cream/40 cursor-pointer transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              isHigh ? 'bg-blush text-[#a8322e]' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {task.severity}
                          </span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cream border border-[#E0DACE] text-teal">
                            {task.framework}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-teal flex items-center gap-0.5 shrink-0">
                          Resolve <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>

                      <p className="text-xs font-bold text-deepTeal truncate">{task.ruleTitle}</p>
                      <p className="text-[11px] text-gray-600 italic line-clamp-1">"{task.excerpt}"</p>
                      <p className="text-[10px] text-gray-500 truncate">
                        Project: <span className="font-semibold text-gray-700">{task.submissionTitle}</span>
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* PANEL 2: RECENT COMPLIANCE AUDIT STATUSES */}
          <section
            aria-label="Recent Compliance Audit Statuses"
            className="bg-warmWhite rounded-2xl border border-[#E7E2D6] shadow-soft overflow-hidden"
          >
            <div className="p-5 border-b border-[#E7E2D6] flex items-center justify-between gap-2">
              <div>
                <span className="caps-label">Governance Ledger</span>
                <h2 className="text-base font-bold text-deepTeal">Recent Compliance Audit Statuses</h2>
              </div>
              {onOpenAudit && (
                <button
                  type="button"
                  onClick={onOpenAudit}
                  className="text-xs font-bold text-teal hover:text-teal-dark flex items-center gap-1 shrink-0"
                >
                  <span>Full Trail</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Workflow Status Distribution Bar */}
            <div className="px-5 py-3 bg-cream/40 border-b border-[#EAE5D9] flex flex-wrap gap-2 text-[11px]">
              {[
                { label: 'Approved', count: approvedCount, cls: 'text-[#1e6d49] bg-[#2E9E6B]/15' },
                { label: 'In Review', count: inReviewCount, cls: 'text-deepTeal bg-mint' },
                {
                  label: 'AI Checked',
                  count: submissions.filter((s) => s.status === 'ai_checked').length,
                  cls: 'text-teal bg-teal/10',
                },
                {
                  label: 'Revision',
                  count: submissions.filter((s) => s.status === 'revision_requested').length,
                  cls: 'text-[#9e6f1c] bg-[#E0A030]/15',
                },
              ].map((st) => (
                <span key={st.label} className={`px-2 py-0.5 rounded-md font-bold ${st.cls}`}>
                  {st.label}: {st.count}
                </span>
              ))}
            </div>

            <div className="divide-y divide-[#EAE5D9] max-h-72 overflow-y-auto">
              {auditEvents.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500">
                  No audit events recorded yet.
                </div>
              ) : (
                auditEvents.slice(0, 6).map((ev) => (
                  <div key={ev.id} className="p-4 space-y-1 hover:bg-cream/30 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getAuditBadgeStyle(
                          ev.action,
                        )}`}
                      >
                        {(ev.action || '').replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">
                        {new Date(ev.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                        {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-xs text-deepTeal font-medium line-clamp-1">
                      {formatAuditSummary(ev)}
                    </p>

                    <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                      <span className="font-semibold text-gray-700">{ev.actor_name}</span>
                      <span className="font-mono text-[10px] uppercase text-teal">({ev.role})</span>
                      {ev.entity_id && <span>· {ev.entity_type} #{ev.entity_id}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {/* COMPLIANCE SCORE OVER TIME (ALL MARKETING PROJECTS) */}
      <section
        aria-label="Compliance Score Over Time"
        className="bg-warmWhite p-6 rounded-2xl border border-[#E7E2D6] shadow-soft space-y-5"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="caps-label">Compliance Trajectory</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-mint text-deepTeal border border-teal/20">
                <TrendingUp className="w-3 h-3 text-teal" />
                {aboveThresholdCount}/{complianceTimelineData.length} &ge; 85 target
              </span>
            </div>
            <h2 className="text-lg font-bold text-deepTeal mt-0.5">
              Compliance Score Over Time Across Marketing Projects
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Tracks individual project compliance scores chronologically alongside the rolling portfolio average (Target &ge; 85/100).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="dept-timeline-filter" className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Team:
            </label>
            <select
              id="dept-timeline-filter"
              value={chartDepartment}
              onChange={(e) => setChartDepartment(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-[#E0DACE] bg-cream text-deepTeal focus:outline-none focus:ring-2 focus:ring-teal/30"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === 'all' ? 'All Departments' : dept}
                </option>
              ))}
            </select>
            <div className="px-3 py-1.5 rounded-xl bg-cream/70 border border-[#E7E2D6] text-xs font-bold text-deepTeal">
              Rolling Avg: <span className="text-teal">{latestRollingAvg}/100</span>
            </div>
          </div>
        </div>

        {complianceTimelineData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-xs text-gray-500 bg-cream/30 rounded-xl border border-dashed border-[#E0DACE]">
            No marketing project data available for this department filter.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={complianceTimelineData} margin={{ top: 14, right: 20, left: -10, bottom: 4 }}>
                <defs>
                  <linearGradient id="complianceScoreFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1A6B66" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#1A6B66" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAE5D9" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  stroke="#6B7B7B"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#E0DACE' }}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 85, 100]}
                  stroke="#6B7B7B"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const item = payload[0].payload;
                    const scoreBadgeCls =
                      item.score < 60
                        ? 'text-[#a8322e] bg-blush'
                        : item.score < 85
                        ? 'text-[#9e6f1c] bg-[#E0A030]/15'
                        : 'text-[#1e6d49] bg-[#2E9E6B]/15';
                    return (
                      <div className="bg-warmWhite border border-[#E7E2D6] rounded-xl p-3 shadow-soft-lg text-xs space-y-1.5 max-w-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] text-gray-500">
                            {item.dateLabel} · v{item.version}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${scoreBadgeCls}`}>
                            {item.score}/100
                          </span>
                        </div>
                        <p className="font-bold text-deepTeal leading-snug">{item.title}</p>
                        <p className="text-[11px] text-gray-500">
                          {item.department} · {String(item.status || '').replace(/_/g, ' ')}
                        </p>
                        <div className="pt-1 border-t border-[#EAE5D9] flex items-center justify-between text-[11px]">
                          <span className="text-gray-500">Rolling Portfolio Avg</span>
                          <span className="font-bold text-coral">{item.rollingAvg}/100</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                />
                <ReferenceLine
                  y={85}
                  stroke="#2E9E6B"
                  strokeDasharray="4 4"
                  label={{
                    value: 'Target 85',
                    position: 'insideTopLeft',
                    fill: '#1e6d49',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  name="Project Compliance Score"
                  stroke="#1A6B66"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#complianceScoreFill)"
                  dot={{ r: 4.5, fill: '#1A6B66', stroke: '#FFFDF9', strokeWidth: 2 }}
                  activeDot={{ r: 6.5, fill: '#133B3B', stroke: '#DCEEEB', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="rollingAvg"
                  name="Rolling Average"
                  stroke="#E8775D"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* ANALYTICS CHARTS STRIP */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-warmWhite p-6 rounded-2xl border border-[#E7E2D6] shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="caps-label">Velocity Trend</span>
              <h2 className="text-base font-bold text-deepTeal">Issues Caught per Week</h2>
            </div>
            <span className="text-xs text-gray-500">Pre-Publication Guardrails</span>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="week" stroke="#889999" fontSize={12} tickLine={false} />
                <YAxis stroke="#889999" fontSize={12} tickLine={false} />
                <Tooltip
                  cursor={{ fill: '#F7F4EC' }}
                  contentStyle={{ backgroundColor: '#FFFDF9', borderColor: '#E7E2D6', borderRadius: '12px' }}
                />
                <Bar dataKey="count" fill="#1A6B66" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-warmWhite p-6 rounded-2xl border border-[#E7E2D6] shadow-soft flex flex-col justify-between">
          <div>
            <span className="caps-label">Breakdown</span>
            <h2 className="text-base font-bold text-deepTeal">Issues by Violation Type</h2>
          </div>
          <div className="h-52 w-full my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={TYPE_COLORS[entry.name] || '#1A6B66'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#FFFDF9', borderColor: '#E7E2D6', borderRadius: '12px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-500 text-center">
            Claims &amp; ASCI/CCPA regulatory checks drive pre-pub accuracy
          </p>
        </div>
      </div>
    </div>
  );
};
