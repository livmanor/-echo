import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { AlertRecord } from '../types/monitor';
import { categoryLabel, formatWhen } from '../lib/labels';
import { ErrorNote, PageHeader, RiskBadge } from '../components/ui';

export function ReportView({ alertId }: { alertId: string | null }) {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [current, setCurrent] = useState<string | null>(alertId);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAlerts().then(setAlerts).catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (alertId) setCurrent(alertId);
  }, [alertId]);

  const alert = alerts.find((item) => item.id === current) || alerts[0];
  const post = alert?.post;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Casework"
        title="Evidence report"
        subtitle="Print this page to save a PDF. The report is an evidence snapshot, not a charging document."
        children={
          <button onClick={() => window.print()} className="no-print px-3 py-1.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-xs text-cyan-100">
            Print / Save PDF
          </button>
        }
      />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      <div className="no-print mb-3">
        <select
          value={alert?.id || ''}
          onChange={(event) => setCurrent(event.target.value)}
          className="bg-white/[0.03] border border-white/10 rounded px-2 py-1.5 text-xs w-full"
        >
          {alerts.map((item) => (
            <option key={item.id} value={item.id}>{item.id} · {item.title}</option>
          ))}
        </select>
      </div>
      {alert && post && (
        <article className="bg-white text-slate-900 rounded-lg p-8 print:p-0 print:rounded-none">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="text-[11px] tracking-[0.16em] uppercase text-slate-500">ECHO · PS02 evidence snapshot</div>
              <h2 className="text-xl font-semibold mt-1">{categoryLabel(alert.category)}</h2>
              <p className="text-sm text-slate-600 mt-1">{alert.channel_title} · {alert.platform}</p>
            </div>
            <RiskBadge risk={alert.severity} />
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm mt-4">
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-slate-500">Time</dt>
              <dd>{formatWhen(post.timestamp)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-slate-500">Alert</dt>
              <dd className="font-mono text-xs">{alert.id} · {alert.status}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[10px] uppercase tracking-wider text-slate-500">SHA-256</dt>
              <dd className="font-mono text-xs break-all">{alert.evidence_hash}</dd>
            </div>
          </dl>
          <h3 className="text-xs uppercase tracking-wider text-slate-500 mt-6">Post text</h3>
          <p className="mt-1 text-sm whitespace-pre-wrap">{post.text}</p>
          {post.ocr_text && (
            <>
              <h3 className="text-xs uppercase tracking-wider text-slate-500 mt-5">Poster OCR {post.image_ref}</h3>
              <p className="mt-1 text-sm whitespace-pre-wrap">{post.ocr_text}</p>
            </>
          )}
          <h3 className="text-xs uppercase tracking-wider text-slate-500 mt-5">Identifiers</h3>
          <ul className="mt-1 text-sm">
            {post.identifiers.map((item) => (
              <li key={`${item.kind}-${item.normalized}`} className="font-mono text-xs">{item.kind}: {item.value}</li>
            ))}
          </ul>
          <h3 className="text-xs uppercase tracking-wider text-slate-500 mt-5">Why it was flagged</h3>
          <p className="mt-1 text-sm">{alert.reason}</p>
          {post.financial_flag && (
            <p className="mt-2 text-sm">Financial evidence: {post.financial_evidence.join(', ') || 'category match'}</p>
          )}
          <p className="mt-6 text-[11px] text-slate-500">
            Synthetic demonstration dataset. This report does not authorise contact with a seller. Seller cluster {post.entity_id || 'none'}.
            Coordinated group {post.cluster_id || 'none'}.
          </p>
        </article>
      )}
    </div>
  );
}
