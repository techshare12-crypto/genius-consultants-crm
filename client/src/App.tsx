import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { CandidateMaster } from './pages/CandidateMaster';
import { CallingWorkspace } from './pages/CallingWorkspace';
import { CallbacksCenter } from './pages/CallbacksCenter';
import { ShortlistedPipeline } from './pages/ShortlistedPipeline';
import { CommunicationsCenter } from './pages/CommunicationsCenter';
import { DocumentsManagement } from './pages/DocumentsManagement';
import { RegistrationsManagement } from './pages/RegistrationsManagement';
import { PublicRegistrationPortal } from './pages/PublicRegistrationPortal';
import { TeamDashboard } from './pages/TeamDashboard';
import { ClientsManagement } from './pages/ClientsManagement';
import { JobOrdersManagement } from './pages/JobOrdersManagement';
import { DailyCallingTracker } from './pages/DailyCallingTracker';
import { ExecutivePerformance } from './pages/ExecutivePerformance';
import { LeadImport } from './pages/LeadImport';
import { LeadAssignmentPage } from './pages/LeadAssignment';
import { UserManagement } from './pages/UserManagement';
import { Reports } from './pages/Reports';
import { ActivityLogsPage } from './pages/ActivityLogs';
import { Login } from './pages/Login';
import { CandidateProfileModal } from './components/candidate/CandidateProfileModal';
import { AddCandidateModal } from './components/candidate/AddCandidateModal';
import { Candidate } from './types';

const MainApp: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('DASHBOARD');

  // Candidate Profile Modal
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState<boolean>(false);

  // Add Candidate Modal
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);

  // Quick calling transition candidate
  const [callingCandidate, setCallingCandidate] = useState<Candidate | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-slate-400">Loading Genius Consultants Portal...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const handleOpenCandidateProfile = (candidateId: string) => {
    setSelectedCandidateId(candidateId);
    setProfileModalOpen(true);
  };

  const handleStartCall = (candidate: Candidate) => {
    setCallingCandidate(candidate);
    setCurrentTab('CALLING_WORKSPACE');
    setProfileModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Navbar onNavigate={(tab) => setCurrentTab(tab as NavTab)} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {currentTab === 'DASHBOARD' && (
            <Dashboard
              onNavigate={setCurrentTab}
              onOpenCandidateProfile={handleOpenCandidateProfile}
              onOpenAddCandidate={() => setAddModalOpen(true)}
            />
          )}

          {currentTab === 'CANDIDATES' && (
            <CandidateMaster
              onOpenCandidateProfile={handleOpenCandidateProfile}
              onOpenAddCandidate={() => setAddModalOpen(true)}
              onStartCall={handleStartCall}
            />
          )}

          {currentTab === 'MY_LEADS' && (
            <CandidateMaster
              onlyMyLeads={true}
              onOpenCandidateProfile={handleOpenCandidateProfile}
              onOpenAddCandidate={() => setAddModalOpen(true)}
              onStartCall={handleStartCall}
            />
          )}

          {currentTab === 'CALLING_WORKSPACE' && (
            <CallingWorkspace
              initialCandidate={callingCandidate}
              onOpenCandidateProfile={handleOpenCandidateProfile}
            />
          )}

          {currentTab === 'CALLBACKS' && (
            <CallbacksCenter
              onOpenCandidateProfile={handleOpenCandidateProfile}
              onStartCall={handleStartCall}
            />
          )}

          {currentTab === 'SHORTLISTED' && (
            <ShortlistedPipeline
              onOpenCandidateProfile={handleOpenCandidateProfile}
            />
          )}

          {currentTab === 'COMMUNICATIONS' && <CommunicationsCenter />}

          {currentTab === 'DOCUMENTS' && <DocumentsManagement />}

          {currentTab === 'TEAM_DASHBOARD' && <TeamDashboard />}

          {currentTab === 'CLIENTS' && <ClientsManagement />}

          {currentTab === 'JOB_ORDERS' && <JobOrdersManagement />}

          {currentTab === 'DAILY_TRACKER' && <DailyCallingTracker />}

          {currentTab === 'PERFORMANCE' && <ExecutivePerformance />}

          {currentTab === 'IMPORT' && <LeadImport />}

          {currentTab === 'ASSIGNMENTS' && <LeadAssignmentPage />}

          {currentTab === 'USER_MANAGEMENT' && <UserManagement />}

          {currentTab === 'REPORTS' && <Reports />}

          {currentTab === 'ACTIVITY_LOGS' && <ActivityLogsPage />}
        </main>
      </div>

      {/* Global Candidate Profile Modal */}
      <CandidateProfileModal
        candidateId={selectedCandidateId}
        isOpen={profileModalOpen}
        onClose={() => {
          setProfileModalOpen(false);
          setSelectedCandidateId(null);
        }}
        onStartCall={handleStartCall}
      />

      {/* Global Add Candidate Modal */}
      <AddCandidateModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onCandidateAdded={() => {
          setAddModalOpen(false);
        }}
      />
    </div>
  );
};

export function App() {
  // Check if public candidate registration link route: /register/:token
  const pathname = window.location.pathname;
  if (pathname.startsWith('/register/')) {
    const token = pathname.replace('/register/', '').split('/')[0];
    return <PublicRegistrationPortal token={token} />;
  }

  return (
    <AuthProvider>
      <NotificationProvider>
        <MainApp />
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
