import { useState } from 'react';
import { api } from '../services/api';
import type { ClassifyResult } from '../types/monitor';
import { CategoryChip, ErrorNote, PageHeader, Panel, RiskBadge } from '../components/ui';

export function IngestView({ onImported }: { onImported: () => void }) {
  const [paste, setPaste] = useState('');
  const [sandbox, setSandbox] = useState('Savings account for rent, KYC ready. Call +91 99999 10024');
  const [ocr, setOcr] = useState('');
  const [result, setResult] = useState<ClassifyResult | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(ok);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        eyebrow="Collector"
        title="Import public posts"
        subtitle="Load a CSV or JSON export, including a Telegram desktop export. The collector does not log in, join private groups, or contact anyone."
      />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      {message && <div className="mb-4 text-xs font-mono text-emerald-300">{message}</div>}

      <div className="grid md:grid-cols-2 gap-4">
        <Panel className="space-y-3">
          <div className="text-xs font-semibold text-slate-200">File import</div>
          <p className="text-xs text-slate-500">CSV needs a text column. Optional columns: timestamp, channel, platform, author, ocr_text, image_ref.</p>
          <input
            type="file"
            accept=".csv,.json,application/json,text/csv"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) run(() => api.importFile(file), `Imported ${file.name}`);
            }}
            className="text-xs text-slate-400"
          />
          <div className="flex flex-wrap gap-2 text-[11px] font-mono">
            <a className="text-cyan-300 underline" href={api.sampleCsvUrl}>Download sample CSV</a>
            <a className="text-cyan-300 underline" href={api.sampleJsonUrl}>Sample JSON</a>
          </div>
          <button
            disabled={busy}
            onClick={() => run(() => api.resetSample(), 'Sample dataset restored')}
            className="px-3 py-2 rounded bg-cyan-500/15 border border-cyan-500/30 text-xs text-cyan-100"
          >
            Restore bundled sample
          </button>
        </Panel>

        <Panel className="space-y-3">
          <div className="text-xs font-semibold text-slate-200">Paste JSON</div>
          <textarea
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
            placeholder='[{"text":"...","channel":"Open board","platform":"telegram","timestamp":"2026-08-20T10:00:00+05:30"}]'
            className="w-full h-36 bg-black/30 border border-white/10 rounded p-2 text-xs font-mono text-slate-300"
          />
          <button
            disabled={busy || !paste.trim()}
            onClick={() =>
              run(async () => {
                const parsed = JSON.parse(paste);
                const posts = Array.isArray(parsed) ? parsed : parsed.posts;
                await api.importJson(posts);
              }, 'JSON imported')
            }
            className="px-3 py-2 rounded border border-white/10 text-xs text-slate-200"
          >
            Import pasted posts
          </button>
        </Panel>
      </div>

      <Panel className="mt-4 space-y-3">
        <div className="text-xs font-semibold text-slate-200">Try the classifier</div>
        <textarea
          value={sandbox}
          onChange={(event) => setSandbox(event.target.value)}
          className="w-full h-24 bg-black/30 border border-white/10 rounded p-2 text-sm text-slate-200"
        />
        <input
          value={ocr}
          onChange={(event) => setOcr(event.target.value)}
          placeholder="Optional poster OCR text"
          className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-slate-300"
        />
        <button
          onClick={async () => {
            setError('');
            try {
              setResult(await api.classify(sandbox, ocr));
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Classify failed');
            }
          }}
          className="px-3 py-2 rounded bg-white/5 border border-white/10 text-xs"
        >
          Classify text
        </button>
        {result && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              <CategoryChip id={result.category} />
              <RiskBadge risk={result.risk} />
              <span className="text-[11px] font-mono text-slate-500">{result.confidence}%</span>
              {result.financial_flag && <span className="text-[11px] font-mono text-orange-300">Financial ad</span>}
            </div>
            <div className="text-xs text-slate-400">{result.reasons.join(' · ')}</div>
            <div className="flex flex-wrap gap-1.5">
              {result.identifiers.map((item) => (
                <span key={`${item.kind}${item.normalized}`} className="text-[11px] font-mono px-2 py-1 border border-white/10 rounded">
                  {item.kind}: {item.value}
                </span>
              ))}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
