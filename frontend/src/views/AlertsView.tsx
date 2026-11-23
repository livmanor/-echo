import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { AlertRecord } from '../types/monitor';
import { formatWhen } from '../lib/labels';
import { CategoryChip, ErrorNote, PageHeader, Panel, RiskBadge } from '../components/ui';

const STATUSES = ['NEW', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED'];

export function AlertsView({
  selectedId,
  onSelect,
  onReport,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReport: (id: string) => void;
}) {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [error, setError] = useState('');

  const load = () => {
    api.getAlerts().then(setAlerts).catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    load();
  }, []);

  const active = alerts.find((alert) => alert.id === selectedId) || alerts[0];

  useEffect(() => {
    if (!active) return;
    document.getElementById(`alert-${active.id}`)?.scrollIntoView({ block: 'nearest' });
  }, [active?.id]);
  const post = active?.post;

  const setStatus = async (status: string) => {
    if (!active) return;
    await api.updateAlert(active.id, status);
    load();
  };

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        eyebrow="Triage"
        title="Alert dashboard"
        subtitle="Every alert keeps an evidence snapshot: the post text, time, channel, and content hash."
      />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 space-y-2 max-h-[74vh] overflow-y-auto pr-1">
          {alerts.map((alert) => (
            <button
              id={`alert-${alert.id}`}
              key={alert.id}
              onClick={() => onSelect(alert.id)}
              className={`w-full text-left glass-card p-3 ${active?.id === alert.id ? 'border-cyan-500/50 bg-cyan-500/5' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <RiskBadge risk={alert.severity} />
                <span className="text-[10px] font-mono text-slate-500">{alert.status}</span>
              </div>
              <div className="text-xs text-slate-200">{alert.title}</div>
              <div className="text-[10px] font-mono text-slate-500 mt-1">{formatWhen(alert.timestamp)}</div>
            </button>
          ))}
        </div>
        {active && post && (
          <Panel className="lg:col-span-3 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryChip id={active.category} />
              <RiskBadge risk={active.severity} />
              <span className="text-[11px] font-mono text-slate-500">{active.confidence}%</span>
              <span className="text-[11px] font-mono text-slate-500 ml-auto">{active.id}</span>
            </div>
            <div>
              <div className="text-[10px] font-mono text-slate-500 mb-1">POST TEXT</div>
              <p className="text-sm text-slate-100 whitespace-pre-wrap">{post.text}</p>
            </div>
            {post.ocr_text && (
              <div className="rounded border border-dashed border-cyan-500/30 p-3">
                <div className="text-[10px] font-mono text-cyan-400 mb-1">POSTER OCR · {post.image_ref}</div>
                <p className="text-sm whitespace-pre-wrap text-slate-200">{post.ocr_text}</p>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-[10px] font-mono text-slate-500">TIME</div>
                <div>{formatWhen(post.timestamp)}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-slate-500">CHANNEL</div>
                <div>{post.channel_title} · {post.platform}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-[10px] font-mono text-slate-500">SHA-256</div>
                <div className="font-mono text-[11px] break-all text-cyan-200/80">{active.evidence_hash}</div>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-slate-500 mb-1">IDENTIFIERS</div>
              <div className="flex flex-wrap gap-1.5">
                {post.identifiers.map((item) => (
                  <span key={`${item.kind}-${item.normalized}`} className="px-2 py-1 rounded bg-white/[0.04] border border-white/10 text-[11px] font-mono">
                    <span className="text-slate-500">{item.kind}</span> {item.value}
                  </span>
                ))}
                {post.identifiers.length === 0 && <span className="text-xs text-slate-500">None extracted.</span>}
              </div>
            </div>
            <div className="text-xs text-slate-400">{active.reason}</div>
            {post.entity_id && (
              <div className="text-[11px] font-mono text-amber-300/90">
                Linked seller cluster {post.entity_id}
                {post.cluster_id ? ` · coordinated text ${post.cluster_id}` : ''}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => setStatus(status)}
                  className={`px-2.5 py-1.5 rounded border text-[10px] font-mono ${active.status === status ? 'border-cyan-400 text-cyan-200' : 'border-white/10 text-slate-400'}`}
                >
                  {status}
                </button>
              ))}
              <button
                onClick={() => onReport(active.id)}
                className="px-2.5 py-1.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-mono text-cyan-200"
              >
                Evidence report
              </button>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
