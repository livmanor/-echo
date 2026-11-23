import { useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api';
import type { AlertRecord, ChannelRecord, SystemStats } from '../types/monitor';
import { formatWhen } from '../lib/labels';
import { CategoryChip, ErrorNote, PageHeader, Panel, RiskBadge } from '../components/ui';

const CHART_LABELS: Record<string, string> = {
  drug_sale: 'Drugs',
  arms_sale: 'Arms',
  fake_documents: 'Documents',
  bank_account: 'Accounts',
  atm_card: 'Cards',
  net_banking: 'Net-bank',
  sim_card: 'SIMs',
};

export function DashboardView({ onOpenAlert }: { onOpenAlert: (id: string) => void }) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [channels, setChannels] = useState<ChannelRecord[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.getStats(), api.getAlerts(), api.getChannels()])
      .then(([nextStats, nextAlerts, nextChannels]) => {
        setStats(nextStats);
        setAlerts(nextAlerts.slice(0, 6));
        setChannels(nextChannels);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const cards = [
    ['Posts ingested', stats?.kpis.posts_ingested],
    ['Illegal-sale alerts', stats?.kpis.flagged_posts],
    ['Financial ads', stats?.kpis.financial_ads],
    ['Identifiers', stats?.kpis.identifiers],
    ['Seller clusters', stats?.kpis.seller_clusters],
    ['Coordinated groups', stats?.kpis.coordinated_groups],
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        eyebrow="Rajasthan Police · Public channels"
        title="Trade monitor"
        subtitle="Classified advertisements from public Telegram channels and imported social posts. Sample data is synthetic."
      />
      {error && <div className="mb-4"><ErrorNote message={`Backend unavailable. ${error}`} /></div>}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
        {cards.map(([label, value]) => (
          <Panel key={String(label)} className="p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">{label}</div>
            <div className="text-2xl font-semibold text-slate-100 mt-1">{value ?? '—'}</div>
          </Panel>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <Panel className="lg:col-span-3">
          <div className="text-xs font-semibold text-slate-200 mb-3">Flagged posts by category</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(stats?.by_category || []).map((row) => ({ ...row, name: CHART_LABELS[row.category] || row.category }))}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} width={28} />
                <Tooltip contentStyle={{ background: '#0A0E17', border: '1px solid #1e293b', fontSize: 12 }} />
                <Bar dataKey="count" fill="#22d3ee" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <div className="text-xs font-semibold text-slate-200 mb-3">Classifier</div>
          <p className="text-xs text-slate-400 leading-relaxed">{stats?.model.name}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xl text-cyan-300 font-semibold">
                {stats ? `${Math.round((stats.model.sample_agreement || 0) * 100)}%` : '—'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">sample agreement</div>
            </div>
            <div>
              <div className="text-xl text-slate-100 font-semibold">{stats?.model.false_positives ?? '—'}</div>
              <div className="text-[10px] text-slate-500 font-mono">false flags</div>
            </div>
            <div>
              <div className="text-xl text-slate-100 font-semibold">{stats?.model.missed ?? '—'}</div>
              <div className="text-[10px] text-slate-500 font-mono">missed sales</div>
            </div>
          </div>
          <div className="mt-4 space-y-1.5 text-[11px] font-mono text-slate-500">
            <div>Collector · {stats?.system_status.collector}</div>
            <div>Languages · {stats?.system_status.languages}</div>
            <div>Evidence · {stats?.system_status.evidence_seal}</div>
          </div>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-5 gap-4 mt-4">
        <Panel className="lg:col-span-3">
          <div className="text-xs font-semibold text-slate-200 mb-3">Latest alerts</div>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <button
                key={alert.id}
                onClick={() => onOpenAlert(alert.id)}
                className="w-full text-left flex items-center gap-3 px-2 py-2 rounded hover:bg-white/[0.04]"
              >
                <RiskBadge risk={alert.severity} />
                <CategoryChip id={alert.category} />
                <span className="text-xs text-slate-300 flex-1 truncate">{alert.channel_title}</span>
                <span className="text-[10px] font-mono text-slate-500">{formatWhen(alert.timestamp)}</span>
              </button>
            ))}
            {alerts.length === 0 && <div className="text-xs text-slate-500">No alerts yet.</div>}
          </div>
        </Panel>
        <Panel className="lg:col-span-2">
          <div className="text-xs font-semibold text-slate-200 mb-3">Public sources</div>
          <div className="space-y-3">
            {channels.map((channel) => (
              <div key={channel.id} className="border-b border-white/[0.04] pb-2 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-slate-200">{channel.title}</div>
                  <div className="text-[10px] font-mono text-rose-300">{channel.flagged_count} flagged</div>
                </div>
                <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                  {channel.platform} · {channel.visibility} · {channel.mode.replaceAll('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
