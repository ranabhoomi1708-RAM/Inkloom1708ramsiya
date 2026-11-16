import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { BarChart3, TrendingUp, Users, ShieldAlert, Award, Clock } from 'lucide-react';

export const AnalyticsPage = ({ analytics }) => {
  const topRules = analytics?.top_violated_rules || [
    { rule_id: 1, title: 'No 100% Absolute Acne Elimination Claims', count: 6 },
    { rule_id: 4, title: 'Mandatory Sunscreen Reminder with Exfoliants', count: 4 },
    { rule_id: 2, title: 'Prohibit Hyperbolic Tone (Miracle / Magic)', count: 3 },
  ];

  const deptMistakes = analytics?.repeat_mistakes_by_department || [
    { department: 'Performance Marketing', violation_count: 14 },
    { department: 'Influencer Relations', violation_count: 8 },
    { department: 'Social Media & Ads', violation_count: 5 },
  ];

  const authorMistakes = analytics?.repeat_mistakes_by_author || [
    { author_id: 2, author_name: 'Arjun Mehta', violation_count: 9 },
    { author_id: 4, author_name: 'Rohit Verma', violation_count: 5 },
  ];

  const avgReviewTime = analytics?.average_review_time_hours || 3.4;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="pb-4 border-b border-[#E7E2D6]">
        <span className="caps-label">Continuous Brand Improvement</span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-deepTeal">Repeat Mistake & Velocity Analytics</h1>
        <p className="text-sm text-gray-600 mt-1">
          Identifies systemic training opportunities, recurring rule infractions, and review turnaround velocities.
        </p>
      </div>

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-warmWhite p-5 rounded-2xl border border-[#E7E2D6] shadow-soft flex items-center justify-between">
          <div>
            <span className="caps-label text-teal">Average Review Turnaround</span>
            <div className="text-2xl font-extrabold text-deepTeal mt-1">{avgReviewTime} hrs</div>
            <p className="text-xs text-gray-500 mt-0.5">From draft to manager sign-off</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-mint flex items-center justify-center text-teal">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-warmWhite p-5 rounded-2xl border border-[#E7E2D6] shadow-soft flex items-center justify-between">
          <div>
            <span className="caps-label text-coral">Top Recurrent Issue</span>
            <div className="text-lg font-extrabold text-deepTeal mt-1">Unsubstantiated Claims</div>
            <p className="text-xs text-gray-500 mt-0.5">45% of total flagged findings</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-coral/15 flex items-center justify-center text-coral">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-warmWhite p-5 rounded-2xl border border-[#E7E2D6] shadow-soft flex items-center justify-between">
          <div>
            <span className="caps-label text-[#2E9E6B]">Training Interventions</span>
            <div className="text-2xl font-extrabold text-deepTeal mt-1">2 Departments</div>
            <p className="text-xs text-gray-500 mt-0.5">Targeted copy guidelines suggested</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#2E9E6B]/15 flex items-center justify-center text-[#2E9E6B]">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Two Column Grid: Top Violated Rules & Repeat Mistakes by Dept */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Violated Rules */}
        <div className="bg-warmWhite p-6 rounded-2xl border border-[#E7E2D6] shadow-soft space-y-4">
          <div>
            <span className="caps-label">Ranked Infractions</span>
            <h2 className="text-base font-bold text-deepTeal">Top Violated Rules</h2>
            <p className="text-xs text-gray-500 mt-0.5">Most common guardrails broken during content authoring</p>
          </div>

          <div className="space-y-3">
            {topRules.map((rule, index) => (
              <div key={rule.rule_id || index} className="p-4 bg-cream/50 rounded-xl border border-[#E7E2D6] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-teal text-white flex items-center justify-center text-xs font-bold font-mono">
                    {index + 1}
                  </span>
                  <div>
                    <span className="text-xs font-bold text-deepTeal block">{rule.title}</span>
                    <span className="text-[10px] text-gray-400">Rule Ref #{rule.rule_id}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-coral">{rule.count}</span>
                  <span className="text-[10px] text-gray-500 block uppercase font-mono">incidents</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Repeat Mistakes by Department */}
        <div className="bg-warmWhite p-6 rounded-2xl border border-[#E7E2D6] shadow-soft space-y-4">
          <div>
            <span className="caps-label">Departmental Accountability</span>
            <h2 className="text-base font-bold text-deepTeal">Repeat Mistakes by Team</h2>
            <p className="text-xs text-gray-500 mt-0.5">Volume of flagged violations originating per department</p>
          </div>

          <div className="space-y-4 pt-2">
            {deptMistakes.map((dept) => {
              const maxVal = Math.max(...deptMistakes.map(d => d.violation_count), 1);
              const pct = (dept.violation_count / maxVal) * 100;

              return (
                <div key={dept.department} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-deepTeal">
                    <span>{dept.department}</span>
                    <span className="text-coral">{dept.violation_count} violations</span>
                  </div>
                  <div className="w-full bg-cream h-3 rounded-full overflow-hidden border border-gray-200">
                    <div
                      className="bg-teal h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Repeat Mistakes by Author sub-list */}
          <div className="pt-4 border-t border-[#EAE5D9]">
            <span className="caps-label">Author Breakdown</span>
            <div className="mt-2 space-y-2">
              {authorMistakes.map((auth) => (
                <div key={auth.author_id} className="flex justify-between text-xs text-gray-700 py-1">
                  <span>{auth.author_name}</span>
                  <span className="font-semibold text-deepTeal">{auth.violation_count} flags</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
