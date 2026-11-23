import { LogOut, Radio, Search, Shield } from 'lucide-react';
import type { SystemStats } from '../types/monitor';

interface NavbarProps {
  stats: SystemStats | null;
  role: string;
  onRoleChange: (role: string) => void;
  query: string;
  onQuery: (value: string) => void;
  onSearch: () => void;
  onNavigate: (view: string) => void;
}

export function Navbar({ stats, role, onRoleChange, query, onQuery, onSearch, onNavigate }: NavbarProps) {
  const score = stats?.threat_score ?? 0;
  const tone =
    score >= 85
      ? 'text-rose-300 border-rose-800/70 bg-rose-950/30'
      : score >= 65
        ? 'text-amber-300 border-amber-800/70 bg-amber-950/30'
        : 'text-emerald-300 border-emerald-800/70 bg-emerald-950/30';

  return (
    <header className="no-print h-14 bg-[#06090F] border-b border-white/[0.06] sticky top-0 z-40 flex items-center gap-4 px-5">
      <button onClick={() => onNavigate('home')} className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center">
          <Shield className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="leading-tight text-left">
          <div className="text-[13px] font-semibold tracking-[0.08em] text-slate-100 font-mono">ECHO</div>
          <div className="text-[10px] text-slate-500 hidden sm:block">Rajasthan Police · public channels</div>
        </div>
      </button>
      <div className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded border text-[11px] font-mono ${tone}`}>
        <Radio className="w-3 h-3" />
        <span>{stats?.threat_level || '—'}</span>
        <span className="opacity-60">{score}</span>
      </div>
      <form
        className="flex-1 max-w-md hidden md:block"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <label className="flex items-center gap-2 px-3 py-2 rounded bg-white/[0.03] border border-white/[0.07] text-slate-400">
          <Search className="w-3.5 h-3.5" />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search phone, UPI, handle, channel"
            className="flex-1 bg-transparent outline-none text-[11px] font-mono text-slate-200 placeholder:text-slate-600"
          />
        </label>
      </form>
      <div className="ml-auto flex items-center gap-2">
        <select
          value={role}
          onChange={(event) => onRoleChange(event.target.value)}
          className="bg-white/[0.03] border border-white/[0.07] text-slate-300 text-[11px] font-mono rounded px-2 py-1.5"
        >
          <option value="Investigator">DySP, Cyber Cell</option>
          <option value="Analyst">Intelligence Analyst</option>
          <option value="Administrator">Systems Admin</option>
        </select>
        <button
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-white/[0.07] text-slate-500 text-[11px] font-mono"
        >
          <LogOut className="w-3.5 h-3.5" />
          Portal
        </button>
      </div>
    </header>
  );
}
