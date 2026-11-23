import { useCallback, useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { AlertsView } from './views/AlertsView';
import { AuditView } from './views/AuditView';
import { ClustersView } from './views/ClustersView';
import { DashboardView } from './views/DashboardView';
import { FeedView } from './views/FeedView';
import { FinancialView } from './views/FinancialView';
import { GraphView } from './views/GraphView';
import { IdentifiersView } from './views/IdentifiersView';
import { IngestView } from './views/IngestView';
import { LandingPageView } from './views/LandingPageView';
import { ReportView } from './views/ReportView';
import { api, setActor } from './services/api';
import type { SystemStats } from './types/monitor';

const PATH_TO_VIEW: Record<string, string> = {
  '/': 'landing',
  '/home': 'home',
  '/feed': 'feed',
  '/alerts': 'alerts',
  '/ingest': 'ingest',
  '/identifiers': 'identifiers',
  '/financial': 'financial',
  '/graph': 'graph',
  '/clusters': 'clusters',
  '/report': 'report',
  '/audit': 'audit',
};

export default function App() {
  const [activeView, setActiveView] = useState(() => PATH_TO_VIEW[window.location.pathname.toLowerCase()] || 'landing');
  const [role, setRole] = useState('Investigator');
  const [query, setQuery] = useState('');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [alertId, setAlertId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const navigateTo = useCallback((view: string) => {
    const next = PATH_TO_VIEW[view] || view;
    setActiveView(next);
    const path = next === 'landing' ? '/' : `/${next}`;
    if (window.location.pathname !== path) {
      window.history.pushState({ view: next }, '', path);
    }
  }, []);

  useEffect(() => {
    const onPop = () => setActiveView(PATH_TO_VIEW[window.location.pathname.toLowerCase()] || 'landing');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const loadHeader = useCallback(() => {
    api.getStats().then(setStats).catch(() => setStats(null));
    api.getAlerts().then((rows) => setAlertCount(rows.filter((row) => row.status !== 'RESOLVED').length)).catch(() => setAlertCount(0));
  }, []);

  useEffect(() => {
    if (activeView !== 'landing') loadHeader();
  }, [activeView, refreshKey, loadHeader]);

  const onRole = (next: string) => {
    setRole(next);
    setActor(next);
  };

  if (activeView === 'landing') {
    return <LandingPageView onNavigate={navigateTo} />;
  }

  return (
    <div className="min-h-screen bg-[#06090F] text-slate-200 flex flex-col">
      <Navbar
        stats={stats}
        role={role}
        onRoleChange={onRole}
        query={query}
        onQuery={setQuery}
        onSearch={() => navigateTo('feed')}
        onNavigate={navigateTo}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeView={activeView} onNavigate={navigateTo} alertCount={alertCount} />
        <main className="flex-1 overflow-y-auto p-6">
          {activeView === 'home' && (
            <DashboardView onOpenAlert={(id) => { setAlertId(id); navigateTo('alerts'); }} />
          )}
          {activeView === 'feed' && <FeedView query={query} key={refreshKey} />}
          {activeView === 'alerts' && (
            <AlertsView
              key={refreshKey}
              selectedId={alertId}
              onSelect={setAlertId}
              onReport={(id) => { setAlertId(id); navigateTo('report'); }}
            />
          )}
          {activeView === 'ingest' && <IngestView onImported={() => setRefreshKey((value) => value + 1)} />}
          {activeView === 'identifiers' && <IdentifiersView key={refreshKey} />}
          {activeView === 'financial' && <FinancialView key={refreshKey} />}
          {activeView === 'graph' && <GraphView key={refreshKey} />}
          {activeView === 'clusters' && <ClustersView key={refreshKey} />}
          {activeView === 'report' && <ReportView alertId={alertId} />}
          {activeView === 'audit' && <AuditView key={refreshKey} />}
        </main>
      </div>
    </div>
  );
}
