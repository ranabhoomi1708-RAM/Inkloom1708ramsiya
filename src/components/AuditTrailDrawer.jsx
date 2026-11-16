import React, { useState, useEffect } from 'react';
import { X, History, Shield, ArrowRight, UserCheck, Clock } from 'lucide-react';
import { api } from '../services/api';

export const AuditTrailDrawer = ({ isOpen, onClose }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.audit.list(50, 0)
        .then((data) => setEvents(data || []))
        .catch(() => setEvents([]))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-lg bg-warmWhite border-l border-[#E7E2D6] shadow-soft-lg flex flex-col">
          {/* Header */}
          <div className="p-6 bg-cream/70 border-b border-[#E7E2D6] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center text-white">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-deepTeal">Immutable Audit Trail</h2>
                <span className="text-[11px] text-teal font-semibold tracking-wider uppercase block">
                  Append-Only Security Log
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:text-deepTeal hover:bg-cream"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Subheader Notice */}
          <div className="px-6 py-2.5 bg-mint/40 border-b border-teal/20 text-[11px] text-deepTeal flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-teal shrink-0" />
            <span>Every state transition, finding decision, and override is permanently recorded.</span>
          </div>

          {/* Timeline Events List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {loading ? (
              <p className="text-xs text-gray-400 text-center py-8">Loading audit events...</p>
            ) : events.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">No audit events recorded yet.</p>
            ) : (
              events.map((ev, index) => (
                <div key={ev.id || index} className="relative pl-6 border-l-2 border-[#DCEEEB] space-y-1">
                  {/* Timeline dot */}
                  <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-teal" />

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-deepTeal">
                      {ev.action?.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="text-[11px] text-gray-600 flex items-center gap-1.5">
                    <span className="font-semibold text-deepTeal">{ev.actor_name}</span>
                    <span className="px-1.5 py-0.2 rounded bg-cream border border-gray-200 text-[10px] uppercase font-mono">
                      {ev.role}
                    </span>
                    <span>· {ev.entity_type} #{ev.entity_id || ''}</span>
                  </div>

                  {ev.after_state && (
                    <div className="mt-1 bg-cream/60 p-2 rounded-lg text-[10px] font-mono text-gray-600 line-clamp-3">
                      {ev.after_state}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
