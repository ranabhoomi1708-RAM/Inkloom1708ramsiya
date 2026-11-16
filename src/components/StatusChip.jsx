import React from 'react';

export const StatusChip = ({ status, className = "" }) => {
  const norm = (status || "").toLowerCase().replace(/_/g, " ");

  let bg = "bg-mint text-deepTeal border-teal/20";
  let dot = "bg-teal";
  let label = status;

  if (norm.includes("approved")) {
    bg = "bg-[#2E9E6B]/15 text-[#1e6d49] border-[#2E9E6B]/30";
    dot = "bg-[#2E9E6B]";
    label = "Approved";
  } else if (norm.includes("revision") || norm.includes("needs revision")) {
    bg = "bg-[#E0A030]/15 text-[#9e6f1c] border-[#E0A030]/30";
    dot = "bg-[#E0A030]";
    label = "Needs Revision";
  } else if (norm.includes("evidence") || norm.includes("missing") || norm.includes("risk") || norm.includes("contradicted") || norm.includes("violation")) {
    bg = "bg-[#D9534F]/15 text-[#a8322e] border-[#D9534F]/30";
    dot = "bg-[#D9534F]";
    label = norm.includes("contradicted") ? "Contradicted" : norm.includes("evidence") ? "Evidence Missing" : "High Risk";
  } else if (norm.includes("in review")) {
    bg = "bg-mint text-deepTeal border-teal/30";
    dot = "bg-teal";
    label = "In Review";
  } else if (norm.includes("ai checked") || norm.includes("checked")) {
    bg = "bg-teal/10 text-teal-dark border-teal/20";
    dot = "bg-teal";
    label = "AI Checked";
  } else if (norm.includes("draft")) {
    bg = "bg-gray-200/60 text-gray-700 border-gray-300";
    dot = "bg-gray-400";
    label = "Draft";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border ${bg} ${className}`}
      role="status"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};

export const VerdictChip = ({ verdict, severity = "medium" }) => {
  const norm = (verdict || "").toLowerCase();

  let style = "bg-gray-100 text-gray-700 border-gray-300";
  let label = verdict;

  if (norm === "supported") {
    style = "bg-[#2E9E6B]/15 text-[#1e6d49] border-[#2E9E6B]/30";
    label = "Supported";
  } else if (norm === "evidence_missing") {
    style = "bg-[#D9534F]/15 text-[#a8322e] border-[#D9534F]/30";
    label = "Evidence Missing";
  } else if (norm === "contradicted") {
    style = "bg-[#D9534F]/20 text-[#a8322e] border-[#D9534F]/40 font-bold";
    label = "Contradicted";
  } else if (norm === "outdated") {
    style = "bg-[#E0A030]/15 text-[#9e6f1c] border-[#E0A030]/30";
    label = "Outdated";
  } else if (norm === "violation") {
    style = severity === "high"
      ? "bg-[#D9534F]/15 text-[#a8322e] border-[#D9534F]/30"
      : "bg-[#E0A030]/15 text-[#9e6f1c] border-[#E0A030]/30";
    label = "Rule Violation";
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${style}`}>
      {label}
    </span>
  );
};
