import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { NewSubmissionPage } from './pages/NewSubmissionPage';
import { ReviewScreenPage } from './pages/ReviewScreenPage';
import { BrandLibraryPage } from './pages/BrandLibraryPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AuditTrailDrawer } from './components/AuditTrailDrawer';
import { VersionHistoryModal } from './components/VersionHistoryModal';
import { api, getAuthRole, setAuthRole } from './services/api';
import { mockBrand, mockFacts, mockRules, mockSubmissions, mockAnalytics } from './services/mockData';

export function App() {
  const [currentRole, setCurrentRole] = useState(getAuthRole());
  const [activePage, setActivePage] = useState('dashboard'); // dashboard | new | review | library | analytics
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);

  // Modals & Drawers
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isVersionsOpen, setIsVersionsOpen] = useState(false);

  // App Data State
  const [submissions, setSubmissions] = useState([]);
  const [brand, setBrand] = useState(null);
  const [facts, setFacts] = useState([]);
  const [rules, setRules] = useState([]);
  const [guidelines, setGuidelines] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [auditEvents, setAuditEvents] = useState([]);

  // Toast Notifications
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch all core data from API
  const refreshData = async () => {
    try {
      const [brandData, subsData, factsData, rulesData, guidesData, analyticsData, auditData] = await Promise.allSettled([
        api.brand.get(),
        api.submissions.list(),
        api.facts.list(),
        api.rules.list(),
        api.guidelines.list(),
        api.analytics.getSummary(),
        api.audit.list(15, 0),
      ]);

      setBrand(brandData.status === 'fulfilled' ? brandData.value : mockBrand);
      setSubmissions(subsData.status === 'fulfilled' ? subsData.value : mockSubmissions);
      setFacts(factsData.status === 'fulfilled' ? factsData.value : mockFacts);
      setRules(rulesData.status === 'fulfilled' ? rulesData.value : mockRules);
      setGuidelines(guidesData.status === 'fulfilled' ? guidesData.value : []);
      setAnalytics(analyticsData.status === 'fulfilled' ? analyticsData.value : mockAnalytics);
      setAuditEvents(auditData.status === 'fulfilled' ? auditData.value : []);
    } catch {
      // Offline fallback
      setBrand(mockBrand);
      setSubmissions(mockSubmissions);
      setFacts(mockFacts);
      setRules(mockRules);
      setAnalytics(mockAnalytics);
      setAuditEvents([]);
    }
  };

  useEffect(() => {
    refreshData();
  }, [currentRole]);

  const handleRoleChange = (newRole) => {
    setAuthRole(newRole);
    setCurrentRole(newRole);
    showToast(`Switched active persona to ${newRole.toUpperCase()}`, 'info');
    // If admin-only page and switched away from admin, go back to dashboard
    if (activePage === 'library' && newRole !== 'admin') {
      setActivePage('dashboard');
    }
  };

  const handleSelectSubmission = (id) => {
    setSelectedSubmissionId(id);
    setActivePage('review');
  };

  const activeSubmission = submissions.find(s => s.id === selectedSubmissionId);

  return (
    <div className="min-h-screen flex flex-col bg-cream text-deepTeal">
      {/* Accessible Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-teal text-white px-3 py-1 rounded z-50"
      >
        Skip to main content
      </a>

      {/* Top Navigation & Role Switcher */}
      <Navbar
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        activePage={activePage}
        onNavigate={setActivePage}
        onOpenAudit={() => setIsAuditOpen(true)}
      />

      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 animate-fadeIn" role="alert">
          <div className={`px-4 py-3 rounded-2xl shadow-soft-lg text-xs font-bold flex items-center gap-2 border ${
            toast.type === 'error'
              ? 'bg-blush text-[#a8322e] border-coral/40'
              : toast.type === 'success'
              ? 'bg-[#2E9E6B]/15 text-[#1e6d49] border-[#2E9E6B]/40'
              : 'bg-mint text-deepTeal border-teal/30'
          }`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main Body Content */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activePage === 'dashboard' && (
          <DashboardPage
            brand={brand}
            submissions={submissions}
            rules={rules}
            auditEvents={auditEvents}
            analytics={analytics}
            currentRole={currentRole}
            onNavigate={setActivePage}
            onSelectSubmission={handleSelectSubmission}
            onOpenAudit={() => setIsAuditOpen(true)}
          />
        )}

        {activePage === 'new' && (
          <NewSubmissionPage
            onSubmissionCreated={(newId) => {
              refreshData();
              handleSelectSubmission(newId);
            }}
            onShowToast={showToast}
          />
        )}

        {activePage === 'review' && (
          <ReviewScreenPage
            submissionId={selectedSubmissionId || 1}
            currentRole={currentRole}
            onBack={() => {
              refreshData();
              setActivePage('dashboard');
            }}
            onShowToast={showToast}
            onOpenVersions={() => setIsVersionsOpen(true)}
          />
        )}

        {activePage === 'library' && currentRole === 'admin' && (
          <BrandLibraryPage
            brand={brand}
            facts={facts}
            rules={rules}
            guidelines={guidelines}
            onRefresh={refreshData}
            onShowToast={showToast}
          />
        )}

        {activePage === 'analytics' && (
          <AnalyticsPage analytics={analytics} />
        )}
      </main>

      {/* Audit Trail Drawer */}
      <AuditTrailDrawer
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={isVersionsOpen}
        onClose={() => setIsVersionsOpen(false)}
        versions={activeSubmission?.versions || []}
        currentVersion={activeSubmission?.version || 1}
      />
    </div>
  );
}
export default App;
