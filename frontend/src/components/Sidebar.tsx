import {
  ArrowLeft,
  BellRing,
  Database,
  FileText,
  History,
  Landmark,
  LayoutDashboard,
  Link2,
  Radio,
  ScanText,
  Share2,
  Upload,
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  alertCount: number;
}

const sections = [
  {
    heading: 'Operations',
    items: [
      { id: 'home', label: 'Monitor', icon: LayoutDashboard },
      { id: 'feed', label: 'Classified posts', icon: Radio },
      { id: 'alerts', label: 'Alerts', icon: BellRing, alerts: true },
      { id: 'ingest', label: 'Import', icon: Upload },
    ],
  },
  {
    heading: 'Intelligence',
    items: [
      { id: 'identifiers', label: 'Identifiers', icon: ScanText },
      { id: 'financial', label: 'Financial ads', icon: Landmark },
      { id: 'graph', label: 'Seller graph', icon: Share2 },
      { id: 'clusters', label: 'Coordinated ads', icon: Link2 },
    ],
  },
  {
    heading: 'Casework',
    items: [
      { id: 'report', label: 'Evidence report', icon: FileText },
      { id: 'audit', label: 'Audit log', icon: History },
    ],
  },
];

export function Sidebar({ activeView, onNavigate, alertCount }: SidebarProps) {
  return (
    <aside className="no-print w-56 bg-[#06090F] border-r border-white/[0.05] flex flex-col shrink-0">
      <nav className="flex-1 overflow-y-auto py-4">
        {sections.map((section, index) => (
          <div key={section.heading} className={index ? 'mt-3' : ''}>
            <div className="px-4 pt-1 pb-1.5 text-[10px] font-semibold text-slate-600 tracking-[0.14em] uppercase">
              {section.heading}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-[9px] text-left ${active ? 'bg-white/[0.06] text-slate-100' : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]'}`}
                >
                  <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-cyan-400' : 'text-slate-600'}`} />
                  <span className={`text-[13px] flex-1 ${active ? 'font-semibold' : ''}`}>{item.label}</span>
                  {'alerts' in item && item.alerts && alertCount > 0 && (
                    <span className="text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/20">
                      {alertCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/[0.05] px-3 py-3 space-y-2">
        <div className="flex items-center gap-2 text-[10px] text-slate-600 px-1">
          <Database className="w-3 h-3" />
          <span>PUBLIC EXPORT · v2</span>
        </div>
        <button
          onClick={() => onNavigate('landing')}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded border border-white/[0.07] text-slate-400 hover:text-slate-200 text-[12px]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to portal
        </button>
      </div>
    </aside>
  );
}
