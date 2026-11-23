import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { PostRecord } from '../types/monitor';
import { formatWhen, shortHash } from '../lib/labels';
import { CategoryChip, ErrorNote, PageHeader, Panel, RiskBadge } from '../components/ui';

const FILTERS = [
  ['', 'All categories'],
  ['drug_sale', 'Drugs'],
  ['arms_sale', 'Arms'],
  ['fake_documents', 'Documents'],
  ['bank_account', 'Accounts'],
  ['atm_card', 'Cards'],
  ['net_banking', 'Net-banking'],
  ['sim_card', 'SIM'],
  ['benign', 'Not a sale'],
];

export function FeedView({ query }: { query: string }) {
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [category, setCategory] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const params: Record<string, string> = {};
    if (category) params.category = category;
    if (flaggedOnly) params.flagged = 'true';
    if (query.trim()) params.q = query.trim();
    api.getPosts(params).then(setPosts).catch((err: Error) => setError(err.message));
  }, [category, flaggedOnly, query]);

  const active = posts.find((post) => post.id === selected) || posts[0];

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        eyebrow="Collection"
        title="Classified posts"
        subtitle="Each row is a public post or an imported advertisement, with the category the model assigned."
      >
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="bg-white/[0.03] border border-white/10 rounded px-2 py-1.5 text-xs text-slate-300"
        >
          {FILTERS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button
          onClick={() => setFlaggedOnly((value) => !value)}
          className={`px-3 py-1.5 rounded border text-xs font-mono ${flaggedOnly ? 'border-rose-500/40 text-rose-300' : 'border-white/10 text-slate-400'}`}
        >
          {flaggedOnly ? 'Flagged only' : 'Include clear posts'}
        </button>
      </PageHeader>
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 space-y-2 max-h-[72vh] overflow-y-auto pr-1">
          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => setSelected(post.id)}
              className={`w-full text-left glass-card p-3 ${active?.id === post.id ? 'border-cyan-500/40' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <CategoryChip id={post.category} />
                <RiskBadge risk={post.risk} />
              </div>
              <div className="text-xs text-slate-300 line-clamp-2">{post.text || post.ocr_text}</div>
              <div className="text-[10px] font-mono text-slate-500 mt-2">
                {post.platform} · {post.channel_title} · {formatWhen(post.timestamp)}
              </div>
            </button>
          ))}
          {posts.length === 0 && <div className="text-xs text-slate-500">No posts match.</div>}
        </div>
        {active && (
          <Panel className="lg:col-span-3">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <CategoryChip id={active.category} />
              <RiskBadge risk={active.risk} />
              <span className="text-[11px] font-mono text-slate-500">{active.confidence}% confidence</span>
            </div>
            <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{active.text}</p>
            {active.ocr_text && (
              <div className="mt-4 rounded border border-dashed border-cyan-500/30 bg-cyan-500/5 p-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 mb-1">
                  OCR from poster {active.image_ref || ''}
                </div>
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{active.ocr_text}</p>
              </div>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-slate-500 font-mono text-[10px]">WHEN</dt>
                <dd>{formatWhen(active.timestamp)}</dd>
              </div>
              <div>
                <dt className="text-slate-500 font-mono text-[10px]">CHANNEL</dt>
                <dd>{active.channel_title}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500 font-mono text-[10px]">SHA-256</dt>
                <dd className="font-mono text-[11px] break-all text-slate-400">{active.content_hash}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <div className="text-[10px] font-mono text-slate-500 mb-1">WHY THIS LABEL</div>
              {active.reasons.map((reason) => (
                <div key={reason} className="text-xs text-slate-300">{reason}</div>
              ))}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {active.lexicon_hits.map((hit) => (
                  <span key={hit} className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/10 text-[10px] font-mono text-slate-300">{hit}</span>
                ))}
              </div>
            </div>
            <div className="mt-4 text-[10px] font-mono text-slate-500">
              Hash preview {shortHash(active.content_hash)} · {active.identifiers.length} identifiers
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
