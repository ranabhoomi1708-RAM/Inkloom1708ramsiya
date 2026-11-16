import React from 'react';
import { X, GitCommit, Clock, FileText } from 'lucide-react';

export const VersionHistoryModal = ({ isOpen, onClose, versions = [], currentVersion = 1 }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-warmWhite max-w-2xl w-full rounded-2xl border border-[#E7E2D6] shadow-soft-lg flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 bg-cream/70 border-b border-[#E7E2D6] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-teal" />
            <h2 className="text-base font-extrabold text-deepTeal">Revision History & Unified Diffs</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-deepTeal hover:bg-cream"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Versions List */}
        <div className="p-6 overflow-y-auto space-y-5">
          {versions.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">No previous revisions. Currently on initial version (v1).</p>
          ) : (
            versions.map((ver) => (
              <div key={ver.version_number} className="bg-cream/40 p-4 rounded-xl border border-[#E7E2D6] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-teal text-white">
                      v{ver.version_number}
                    </span>
                    {ver.version_number === currentVersion && (
                      <span className="text-[10px] uppercase font-bold text-teal tracking-wide">
                        (Active Snapshot)
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 font-mono">
                    {new Date(ver.created_at || Date.now()).toLocaleString()}
                  </span>
                </div>

                {/* Diff from previous */}
                {ver.diff_from_previous ? (
                  <div className="mt-2 space-y-1">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                      Unified Diff
                    </span>
                    <pre className="bg-warmWhite p-3 rounded-lg border border-gray-200 text-xs font-mono overflow-x-auto text-deepTeal leading-relaxed">
                      {ver.diff_from_previous.split('\n').map((line, i) => {
                        const isAdd = line.startsWith('+');
                        const isDel = line.startsWith('-');
                        const color = isAdd ? 'text-[#1e6d49] bg-mint/50' : isDel ? 'text-[#a8322e] bg-blush/50' : 'text-gray-700';
                        return (
                          <div key={i} className={color}>
                            {line}
                          </div>
                        );
                      })}
                    </pre>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-gray-600 bg-warmWhite p-3 rounded-lg border border-gray-200">
                    <span className="font-semibold text-gray-500 block mb-1">Initial Draft Content:</span>
                    <p className="italic">"{ver.content_text}"</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
