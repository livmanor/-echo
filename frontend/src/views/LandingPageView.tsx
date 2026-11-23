import { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Shield } from 'lucide-react';
import { api } from '../services/api';
import type { SystemStats } from '../types/monitor';

export function LandingPageView({ onNavigate }: { onNavigate: (view: string) => void }) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    api.getStats().then(setStats).catch(() => setStats(null));
    return () => clearInterval(timer);
  }, []);

  const enter = () => {
    if (pin.length < 4) {
      setError('Use any 4-digit demo PIN.');
      return;
    }
    onNavigate('home');
  };

  return (
    <div className="min-h-screen bg-[#06090F] text-slate-100 flex flex-col relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <header className="relative z-10 flex items-center justify-between px-8 py-5 text-[11px] font-mono text-slate-500">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          ECHO · CHANDIGARH POLICE HACKATHON
        </div>
        <div>{time.toLocaleString('en-IN')}</div>
      </header>
      <main className="relative z-10 flex-1 grid lg:grid-cols-2 gap-10 items-center px-8 pb-16 max-w-6xl mx-auto w-full">
        <div>
          <div className="text-[11px] font-mono tracking-[0.18em] text-cyan-400 uppercase">PS02 · Narcotics / Financial fraud</div>
          <h1 className="text-4xl font-semibold tracking-tight mt-3 leading-tight">
            Telegram and social media illegal trade monitor
          </h1>
          <p className="text-sm text-slate-400 mt-4 max-w-xl leading-relaxed">
            Watches public channel exports for drug sales, illegal arms, fake documents, and advertisements that buy, sell, or rent bank accounts, ATM cards, net-banking kits, and SIM cards.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-300">
            <li>Slang and emoji lexicon blended with a naive Bayes classifier, including Hindi and Hinglish.</li>
            <li>Extracts phones, UPI IDs, wallets, handles, and locations, then links the same identifier across channels.</li>
            <li>Alerts carry the post text, time, channel, and SHA-256 evidence hash.</li>
          </ul>
          <p className="mt-6 text-[11px] font-mono text-slate-500 max-w-xl">
            Demo data is synthetic. The collector imports public exports and CSV/JSON. It does not join private groups, use a cover identity, or contact sellers.
          </p>
          <div className="mt-6 flex gap-6 text-xs font-mono text-slate-400">
            <div><div className="text-slate-100 text-lg">{stats?.kpis.flagged_posts ?? '—'}</div>flagged posts</div>
            <div><div className="text-slate-100 text-lg">{stats?.kpis.financial_ads ?? '—'}</div>financial ads</div>
            <div><div className="text-slate-100 text-lg">{stats?.kpis.seller_clusters ?? '—'}</div>seller clusters</div>
          </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            enter();
          }}
          className="glass-card p-6 max-w-md ml-auto w-full"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Lock className="w-4 h-4 text-cyan-400" />
            Demo gate
          </div>
          <p className="text-xs text-slate-500 mt-2">Any 4-digit PIN opens the monitor. This is not an authentication system.</p>
          <label className="block mt-5 text-[10px] font-mono uppercase tracking-wider text-slate-500">Access PIN</label>
          <div className="mt-1 flex items-center gap-2 border border-white/10 rounded px-3 py-2 bg-black/20">
            <input
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              className="flex-1 bg-transparent outline-none text-sm tracking-[0.3em]"
              placeholder="0000"
            />
            <button type="button" onClick={() => setShowPin((value) => !value)} className="text-slate-500">
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <div className="text-xs text-rose-300 mt-2">{error}</div>}
          <button type="submit" className="mt-5 w-full py-2.5 rounded bg-cyan-400 text-slate-950 text-sm font-semibold">
            Open monitor
          </button>
        </form>
      </main>
    </div>
  );
}
