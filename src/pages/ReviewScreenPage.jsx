import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, ArrowLeft, ShieldAlert,
  Sparkles, FileText, ImageIcon, Eye, Check, X, Edit3, Lock,
  History, MessageSquare, AlertCircle
} from 'lucide-react';
import { StatusChip, VerdictChip } from '../components/StatusChip';
import { ScoreRing } from '../components/ScoreRing';
import { api } from '../services/api';

export const ReviewScreenPage = ({
  submissionId,
  currentRole,
  onBack,
  onShowToast,
  onOpenVersions,
}) => {
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFindingId, setActiveFindingId] = useState(null);
  const [viewMode, setViewMode] = useState('text'); // text | image

  // Rejection Justification Modal
  const [rejectingFinding, setRejectingFinding] = useState(null);
  const [justificationText, setJustificationText] = useState('');

  // Manager Review Modals
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [managerAction, setManagerAction] = useState('approved'); // approved | revision_requested
  const [managerComment, setManagerComment] = useState('');
  const [managerOverrideReason, setManagerOverrideReason] = useState('');
  const [requiresOverride, setRequiresOverride] = useState(false);

  // Load submission details
  const fetchSubmission = async () => {
    try {
      const data = await api.submissions.get(submissionId);
      setSubmission(data);
      if (data.findings?.length > 0 && !activeFindingId) {
        setActiveFindingId(data.findings[0].id);
      }
    } catch (err) {
      onShowToast(err.message || 'Failed to load submission', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmission();
  }, [submissionId]);

  // Handle Finding Decision (Accept or Reject)
  const handleDecision = async (finding, decision, justification = null) => {
    if (finding.severity === 'high' && decision === 'rejected' && !justification) {
      setRejectingFinding(finding);
      setJustificationText('');
      return;
    }

    try {
      await api.findings.updateDecision(finding.id, decision, justification);
      onShowToast(
        decision === 'accepted' ? 'Suggested rewrite accepted' : 'Finding rejected with justification',
        'success'
      );
      setRejectingFinding(null);
      fetchSubmission();
    } catch (err) {
      onShowToast(err.message || 'Action failed', 'error');
    }
  };

  // Employee: Submit for Review
  const handleSubmitForReview = async () => {
    try {
      await api.submissions.submit(submission.id);
      onShowToast('Submitted to Manager for review!', 'success');
      fetchSubmission();
    } catch (err) {
      onShowToast(err.message || 'Submission failed governance check', 'error');
    }
  };

  // Manager: Initiate Review Action
  const handleInitiateReview = (action) => {
    setManagerAction(action);
    setManagerComment('');
    setManagerOverrideReason('');

    // Check if high-severity evidence_missing exists and is unresolved
    const hasUnresolvedEvidenceMissing = submission.findings?.some(
      f => f.severity === 'high' && f.verdict === 'evidence_missing' && f.decision !== 'accepted'
    );

    setRequiresOverride(action === 'approved' && hasUnresolvedEvidenceMissing);
    setShowManagerModal(true);
  };

  const handleConfirmManagerReview = async (e) => {
    e.preventDefault();
    try {
      await api.submissions.review(submission.id, {
        action: managerAction,
        comment: managerComment || null,
        override_reason: requiresOverride ? managerOverrideReason : null,
      });
      onShowToast(
        managerAction === 'approved' ? 'Content Approved for Publishing!' : 'Revision Requested from author',
        'success'
      );
      setShowManagerModal(false);
      fetchSubmission();
    } catch (err) {
      onShowToast(err.message || 'Manager action failed', 'error');
    }
  };

  if (loading || !submission) {
    return (
      <div className="py-24 text-center space-y-3">
        <Sparkles className="w-8 h-8 text-teal mx-auto animate-spin" />
        <p className="text-sm text-gray-500 font-semibold">Loading verification dossier...</p>
      </div>
    );
  }

  const findings = submission.findings || [];
  const pendingCount = findings.filter(f => f.decision === 'pending').length;
  const canEmployeeSubmit = submission.status === 'ai_checked' && pendingCount === 0;

  // Render text with clickable highlighted spans
  const renderHighlightedContent = () => {
    const text = submission.content_text || '';
    if (!findings.length) return <span>{text}</span>;

    // Sort findings by span_start
    const sorted = [...findings]
      .filter(f => f.span_start !== null && f.span_end !== null && f.span_start < f.span_end)
      .sort((a, b) => a.span_start - b.span_start);

    if (!sorted.length) return <span>{text}</span>;

    const elements = [];
    let lastIdx = 0;

    sorted.forEach((f) => {
      if (f.span_start > lastIdx) {
        elements.push(
          <span key={`text-${lastIdx}`}>{text.substring(lastIdx, f.span_start)}</span>
        );
      }

      const isSelected = activeFindingId === f.id;
      const highlightClass =
        f.severity === 'high'
          ? isSelected ? 'highlight-high active' : 'highlight-high'
          : isSelected ? 'highlight-medium active' : 'highlight-medium';

      elements.push(
        <mark
          key={`finding-${f.id}`}
          onClick={() => setActiveFindingId(f.id)}
          className={`${highlightClass} transition-all`}
          title={`Click to view: ${f.explanation}`}
        >
          {text.substring(f.span_start, f.span_end)}
        </mark>
      );
      lastIdx = f.span_end;
    });

    if (lastIdx < text.length) {
      elements.push(<span key={`text-end`}>{text.substring(lastIdx)}</span>);
    }

    return elements;
  };

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-[#E7E2D6]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-warmWhite border border-[#E7E2D6] text-deepTeal hover:bg-cream transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-deepTeal">{submission.title}</h1>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-cream border border-teal/20 text-teal font-bold">
                v{submission.version}
              </span>
              <StatusChip status={submission.status} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Authored by <span className="font-semibold text-gray-700">{submission.author_name || `User #${submission.author_id}`}</span> · {submission.department}
            </p>
          </div>
        </div>

        {/* View Mode & Version History Buttons */}
        <div className="flex items-center gap-2">
          {submission.image_path && (
            <div className="flex bg-cream p-1 rounded-xl border border-[#E0DACE] text-xs">
              <button
                onClick={() => setViewMode('text')}
                className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1 ${
                  viewMode === 'text' ? 'bg-deepTeal text-white' : 'text-gray-600'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Text
              </button>
              <button
                onClick={() => setViewMode('image')}
                className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1 ${
                  viewMode === 'image' ? 'bg-deepTeal text-white' : 'text-gray-600'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" /> Image Overlay
              </button>
            </div>
          )}
          <button
            onClick={onOpenVersions}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-warmWhite hover:bg-cream border border-[#E7E2D6] rounded-xl text-xs font-bold text-deepTeal shadow-soft transition-colors"
          >
            <History className="w-4 h-4 text-teal" />
            <span>Version History ({submission.versions?.length || 1})</span>
          </button>
        </div>
      </div>

      {/* Main Split View: Left (Content) vs Right (Findings Dossier) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Visual Content & Highlighted Spans */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-warmWhite rounded-2xl border border-[#E7E2D6] shadow-soft overflow-hidden">
            <div className="p-4 bg-cream/70 border-b border-[#E7E2D6] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="caps-label">Ad Copy Verification View</span>
              </div>
              <span className="text-[11px] text-gray-400">Click highlighted text to inspect finding</span>
            </div>

            {viewMode === 'text' ? (
              <div className="p-6 font-sans text-base leading-relaxed text-deepTeal select-text whitespace-pre-wrap">
                {renderHighlightedContent()}
              </div>
            ) : (
              <div className="p-6 text-center space-y-4">
                <div className="relative inline-block border border-gray-300 rounded-xl overflow-hidden shadow-inner bg-cream/40">
                  <img
                    src={submission.image_path}
                    alt="Creative Preview"
                    className="max-h-96 w-auto object-contain mx-auto"
                    onError={(e) => {
                      // fallback dummy SVG banner if local path doesn't load
                      e.target.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='200' fill='%23F7F4EC'><rect width='400' height='200' fill='%23DCEEEB'/><text x='50%' y='45%' font-family='sans-serif' font-size='16' font-weight='bold' fill='%23133B3B' text-anchor='middle'>GlowLeaf Monsoon Banner</text><text x='50%' y='65%' font-family='sans-serif' font-size='12' fill='%231A6B66' text-anchor='middle'>Removes 100% acne in 3 days</text></svg>";
                    }}
                  />
                  {/* Bounding box overlay demo */}
                  <div
                    className="absolute border-2 border-coral bg-coral/20 rounded cursor-pointer animate-pulse"
                    style={{ left: '15%', top: '35%', width: '70%', height: '35%' }}
                    title="Visual Finding: Hyperbolic text & contrast flag"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Bounding boxes highlight visual contrast flags and headline areas.
                </p>
              </div>
            )}
          </div>

          {/* Quick Guidance Box */}
          <div className="bg-mint/40 p-4 rounded-2xl border border-teal/20 text-xs text-deepTeal space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-teal">
              <Sparkles className="w-3.5 h-3.5" /> Explain & Fix Protocol
            </span>
            <p className="text-gray-600">
              Every finding explains <strong>WHY</strong>, cites rule & trial evidence, and offers a safer rewrite.
              Accepting rewrites waives penalty points and boosts compliance to 100%.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Compliance Score & Findings Cards */}
        <div className="lg:col-span-6 space-y-4">
          {/* Compliance Score Header Card */}
          <div className="bg-warmWhite p-5 rounded-2xl border border-[#E7E2D6] shadow-soft flex items-center justify-between gap-4">
            <div>
              <span className="caps-label">Formula: High (25), Med (10), Low (4)</span>
              <h2 className="text-lg font-bold text-deepTeal mt-0.5">Brand Compliance Score</h2>
              <p className="text-xs text-gray-500 mt-1">
                {findings.length} finding{findings.length !== 1 ? 's' : ''} detected across claims, tone, and ad regulations.
              </p>
            </div>
            <ScoreRing score={submission.compliance_score} size={95} />
          </div>

          {/* Findings Cards List */}
          <div className="space-y-4">
            {findings.map((f) => {
              const isSelected = activeFindingId === f.id;
              const isHigh = f.severity === 'high';

              return (
                <div
                  key={f.id}
                  id={`finding-card-${f.id}`}
                  onClick={() => setActiveFindingId(f.id)}
                  className={`bg-warmWhite rounded-2xl border p-5 transition-all shadow-soft cursor-pointer ${
                    isSelected ? 'ring-2 ring-teal border-teal' : 'border-[#E7E2D6] hover:border-teal/40'
                  }`}
                >
                  {/* Card Header: Type, Verdict & Decision */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EAE5D9]">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-cream text-teal border border-teal/20">
                        {f.type}
                      </span>
                      <VerdictChip verdict={f.verdict} severity={f.severity} />
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        isHigh ? 'bg-coral/15 text-coral' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {f.severity}
                      </span>
                    </div>

                    {/* Decision Indicator */}
                    {f.decision === 'accepted' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2E9E6B]">
                        <Check className="w-3.5 h-3.5" /> Accepted
                      </span>
                    ) : f.decision === 'rejected' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500">
                        <X className="w-3.5 h-3.5" /> Rejected
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Pending Decision
                      </span>
                    )}
                  </div>

                  {/* Excerpt Quoted */}
                  <div className="mt-3">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                      Flagged Excerpt
                    </span>
                    <blockquote className="mt-1 text-xs italic font-semibold text-deepTeal bg-cream/50 p-2.5 rounded-xl border-l-4 border-coral">
                      "{f.excerpt}"
                    </blockquote>
                  </div>

                  {/* Why Flagged (Explanation) */}
                  <div className="mt-3">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                      Why Flagged
                    </span>
                    <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">
                      {f.explanation}
                    </p>
                  </div>

                  {/* Evidence Block or Evidence Missing Alert */}
                  <div className="mt-3">
                    {f.verdict === 'evidence_missing' ? (
                      <div className="p-3 bg-blush/60 rounded-xl border border-coral/30 text-xs text-[#a8322e] flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-coral shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block">Evidence Missing — Human Review Required</span>
                          <span className="text-[11px] text-gray-600">
                            No approved fact or clinical trial in the brand library substantiates this claim.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-cream/70 rounded-xl border border-[#E0DACE] text-xs space-y-1">
                        <span className="font-bold text-teal flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified Evidence Dossier
                        </span>
                        <p className="text-gray-700 font-medium">
                          {f.rule_id ? `Rule Ref: #${f.rule_id} · ` : ''}
                          {f.evidence_fact_id ? `Fact Ref: #${f.evidence_fact_id}` : 'ASCI & CCPA Checklist Aid'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Suggested Rewrite as a Visual Diff */}
                  {f.suggested_text && (
                    <div className="mt-3 space-y-1.5">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                        Proposed Safer Rewrite
                      </span>
                      <div className="rounded-xl border border-teal/30 overflow-hidden text-xs">
                        {/* Red removed */}
                        <div className="bg-blush/40 px-3 py-1.5 text-[#a8322e] line-through font-mono">
                          - {f.excerpt}
                        </div>
                        {/* Green replacement */}
                        <div className="bg-mint/60 px-3 py-1.5 text-[#1e6d49] font-medium font-sans">
                          + {f.suggested_text}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Justification note if already rejected */}
                  {f.justification && (
                    <div className="mt-2 p-2 bg-cream rounded-lg text-xs text-gray-600 border border-gray-200">
                      <span className="font-bold text-deepTeal">Justification:</span> {f.justification}
                    </div>
                  )}

                  {/* Action Buttons for Employee */}
                  <div className="mt-4 pt-3 border-t border-[#EAE5D9] flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDecision(f, 'rejected');
                      }}
                      className="px-3 py-1.5 bg-cream hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                    >
                      Reject Finding
                    </button>
                    {f.suggested_text && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDecision(f, 'accepted');
                        }}
                        className="px-3.5 py-1.5 bg-teal hover:bg-teal-dark text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept Rewrite</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FIXED BOTTOM GOVERNANCE BAR */}
      <div className="fixed bottom-0 inset-x-0 bg-warmWhite/95 backdrop-blur border-t border-[#E0DACE] py-3.5 px-6 shadow-soft-lg z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-teal">Workflow Status:</span>
            <StatusChip status={submission.status} />
            {currentRole === 'employee' && pendingCount > 0 && (
              <span className="hidden sm:inline text-xs text-amber-700 font-medium">
                ({pendingCount} finding{pendingCount !== 1 ? 's' : ''} require accept/reject before submission)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Employee Submit Button */}
            {currentRole === 'employee' && (
              <button
                disabled={!canEmployeeSubmit}
                onClick={handleSubmitForReview}
                className="px-5 py-2.5 bg-teal hover:bg-teal-dark text-white rounded-xl text-xs font-bold shadow-soft transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                title={!canEmployeeSubmit ? "Resolve all pending findings first" : "Submit for Manager Review"}
              >
                <span>Submit for Review</span>
                <Check className="w-4 h-4" />
              </button>
            )}

            {/* Manager Review Buttons */}
            {currentRole === 'manager' && (
              <>
                <button
                  onClick={() => handleInitiateReview('revision_requested')}
                  className="px-4 py-2.5 bg-cream hover:bg-[#E0A030]/20 text-[#9e6f1c] border border-[#E0A030]/40 rounded-xl text-xs font-bold transition-all"
                >
                  Request Revision
                </button>
                <button
                  onClick={() => handleInitiateReview('approved')}
                  className="px-5 py-2.5 bg-[#2E9E6B] hover:bg-[#258257] text-white rounded-xl text-xs font-bold shadow-soft transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve Content</span>
                </button>
              </>
            )}

            {currentRole === 'admin' && (
              <span className="text-xs text-gray-500 font-medium italic">
                Viewing as Admin (Library & Governance)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: REJECT HIGH-SEVERITY JUSTIFICATION */}
      {rejectingFinding && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-warmWhite max-w-md w-full rounded-2xl p-6 border border-[#E7E2D6] shadow-soft-lg space-y-4">
            <div className="flex items-center gap-2 text-coral">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="text-base font-bold text-deepTeal">Written Justification Required</h3>
            </div>
            <p className="text-xs text-gray-600">
              Under Inkloom governance rules, rejecting a <strong>High Severity</strong> finding requires a documented written explanation (e.g., legal token, special trial exemption, or verified disclaimer placement).
            </p>
            <div className="bg-cream/60 p-3 rounded-xl border border-gray-200 text-xs italic text-gray-700">
              "{rejectingFinding.excerpt}"
            </div>
            <textarea
              rows={3}
              required
              placeholder="Provide clear rationale for overriding this rule/evidence finding..."
              value={justificationText}
              onChange={(e) => setJustificationText(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-coral/40 focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingFinding(null)}
                className="px-3.5 py-1.5 text-xs text-gray-600 hover:text-deepTeal"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!justificationText.trim()}
                onClick={() => handleDecision(rejectingFinding, 'rejected', justificationText)}
                className="px-4 py-1.5 bg-coral text-white rounded-xl text-xs font-bold hover:bg-coral/90 disabled:opacity-40"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: MANAGER REVIEW & OVERRIDE MODAL */}
      {showManagerModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <form
            onSubmit={handleConfirmManagerReview}
            className="bg-warmWhite max-w-md w-full rounded-2xl p-6 border border-[#E7E2D6] shadow-soft-lg space-y-4"
          >
            <div className="flex items-center gap-2">
              {managerAction === 'approved' ? (
                <CheckCircle2 className="w-5 h-5 text-[#2E9E6B]" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-[#E0A030]" />
              )}
              <h3 className="text-base font-bold text-deepTeal">
                {managerAction === 'approved' ? 'Manager Approval' : 'Request Author Revision'}
              </h3>
            </div>

            {/* Governance Override Warning */}
            {requiresOverride && (
              <div className="p-3.5 bg-blush rounded-xl border border-coral/30 space-y-2">
                <span className="font-bold text-xs text-[#a8322e] flex items-center gap-1.5">
                  <Lock className="w-4 h-4" /> Managerial Override Gate
                </span>
                <p className="text-[11px] text-gray-700">
                  A high-severity claim lacks approved evidence. Manager approval is blocked unless you record an official override reason for the audit trail.
                </p>
                <input
                  type="text"
                  required
                  placeholder="Official override reason (e.g. Trade event exception EX-2026-9)"
                  value={managerOverrideReason}
                  onChange={(e) => setManagerOverrideReason(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-coral/40 focus:ring-2 focus:ring-coral/40 focus:outline-none bg-warmWhite"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Review Comments for Author
              </label>
              <textarea
                rows={3}
                placeholder="Add feedback, next steps, or confirmation details..."
                value={managerComment}
                onChange={(e) => setManagerComment(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal/30 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowManagerModal(false)}
                className="px-3.5 py-1.5 text-xs text-gray-600 hover:text-deepTeal"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-soft ${
                  managerAction === 'approved' ? 'bg-[#2E9E6B] hover:bg-[#258257]' : 'bg-[#E0A030] hover:bg-[#c78b22]'
                }`}
              >
                Confirm {managerAction === 'approved' ? 'Approval' : 'Revision Request'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
