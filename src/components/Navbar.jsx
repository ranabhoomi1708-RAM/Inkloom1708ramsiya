import React from 'react';
import { ShieldCheck, UserCheck, CheckCircle2, History, BarChart3, BookOpen, PlusCircle, LayoutDashboard } from 'lucide-react';
import { setAuthRole } from '../services/api';

export const Navbar = ({ currentRole, onRoleChange, activePage, onNavigate, onOpenAudit }) => {
  const roles = [
    { id: 'admin', name: 'Priya Sharma', title: 'Admin (Brand)', desc: 'Rules & Facts' },
    { id: 'employee', name: 'Arjun Mehta', title: 'Employee (Creator)', desc: 'Draft & Submit' },
    { id: 'manager', name: 'Kavita Rao', title: 'Manager (Reviewer)', desc: 'Approve & Gate' },
  ];

  const handleRoleSelect = (roleId) => {
    setAuthRole(roleId);
    if (onRoleChange) onRoleChange(roleId);
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'new', label: 'New Submission', icon: PlusCircle },
    { id: 'library', label: 'Brand Library', icon: BookOpen, adminOnly: true },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <header className="bg-warmWhite border-b border-[#E7E2D6] sticky top-0 z-30 shadow-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Tagline */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => onNavigate('dashboard')}
              className="flex items-center gap-2.5 text-left focus:outline-none focus:ring-2 focus:ring-teal/40 rounded-lg p-1"
            >
              <div className="w-9 h-9 rounded-xl bg-teal flex items-center justify-center text-white shadow-sm">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                </svg>
              </div>
              <div>
                <span className="text-lg font-extrabold tracking-tight text-deepTeal">Inkloom AI</span>
                <span className="hidden sm:block text-[10px] font-semibold text-teal tracking-wider uppercase">
                  Provably Accurate & Approved
                </span>
              </div>
            </button>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center space-x-1" aria-label="Main Navigation">
              {navItems.map((item) => {
                if (item.adminOnly && currentRole !== 'admin') return null;
                const Icon = item.icon;
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                      isActive
                        ? 'bg-mint text-deepTeal shadow-sm font-bold border border-teal/20'
                        : 'text-gray-600 hover:text-deepTeal hover:bg-cream'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-teal" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Controls: Audit Drawer Trigger & Role Switcher */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenAudit}
              title="Open Append-Only Audit Trail"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-deepTeal bg-cream hover:bg-mint border border-[#E0DACE] transition-colors"
            >
              <History className="w-4 h-4 text-teal" />
              <span className="hidden lg:inline">Audit Trail</span>
            </button>

            {/* Role Switcher Pill Group */}
            <div className="flex items-center bg-cream rounded-xl p-1 border border-[#E2DDCF] shadow-inner" role="group" aria-label="Role Switcher">
              {roles.map((r) => {
                const isSelected = currentRole === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => handleRoleSelect(r.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-deepTeal text-white shadow-sm'
                        : 'text-gray-600 hover:text-deepTeal hover:bg-warmWhite'
                    }`}
                    aria-pressed={isSelected}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-mint' : 'bg-gray-400'}`} />
                    <span>{r.title.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
