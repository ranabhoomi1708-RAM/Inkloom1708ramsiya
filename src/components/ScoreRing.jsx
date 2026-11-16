import React from 'react';

export const ScoreRing = ({ score = 100, size = 110, strokeWidth = 9 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, Number(score) || 0));
  const offset = circumference - (clampedScore / 100) * circumference;

  let color = "#2E9E6B"; // green approved
  let labelText = "High Brand Fit";
  if (clampedScore < 60) {
    color = "#D9534F"; // high risk
    labelText = "High Risk";
  } else if (clampedScore < 85) {
    color = "#E0A030"; // needs revision
    labelText = "Needs Revision";
  }

  return (
    <div className="flex flex-col items-center justify-center relative select-none" style={{ width: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E6EFEF"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Active progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {/* Center score readout */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-extrabold tracking-tight text-deepTeal">
          {Math.round(clampedScore)}
        </span>
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest -mt-1">
          / 100
        </span>
      </div>
      <span className="mt-2 text-xs font-semibold" style={{ color }}>
        {labelText}
      </span>
    </div>
  );
};
