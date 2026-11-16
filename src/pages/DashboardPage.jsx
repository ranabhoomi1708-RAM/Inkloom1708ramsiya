import React from 'react';
import { MainDashboardLayout } from '../components/MainDashboardLayout';

export const DashboardPage = ({
  brand = null,
  submissions = [],
  rules = [],
  auditEvents = [],
  analytics = null,
  currentRole,
  onNavigate,
  onSelectSubmission,
  onOpenAudit,
}) => {
  return (
    <MainDashboardLayout
      brand={brand}
      submissions={submissions}
      rules={rules}
      auditEvents={auditEvents}
      analytics={analytics}
      currentRole={currentRole}
      onNavigate={onNavigate}
      onSelectSubmission={onSelectSubmission}
      onOpenAudit={onOpenAudit}
    />
  );
};
