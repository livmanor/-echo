import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { PostRecord } from '../types/monitor';
import { formatWhen } from '../lib/labels';
import { CategoryChip, ErrorNote, PageHeader, Panel, RiskBadge } from '../components/ui';

export function FinancialView() {
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getPosts({ financial: 'true' }).then(setPosts).catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        eyebrow="Financial-ad detector"
        title="Accounts, cards, kits, and SIMs"
        subtitle="Posts offering to buy, sell, or rent savings or current accounts, ATM and credit cards, net-banking kits, or SIM cards."
      />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      <div className="space-y-3">
        {posts.map((post) => (
          <Panel key={post.id}>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <CategoryChip id={post.category} />
              <RiskBadge risk={post.financial_risk || post.risk} />
              <span className="text-[10px] font-mono text-slate-500">{post.channel_title} · {formatWhen(post.timestamp)}</span>
            </div>
            <p className="text-sm text-slate-200 whitespace-pre-wrap">{post.ocr_text || post.text}</p>
            <div className="mt-3 text-[10px] font-mono text-slate-500">SUPPORTING EVIDENCE</div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {post.financial_evidence.map((item) => (
                <span key={item} className="px-1.5 py-0.5 rounded border border-orange-500/30 text-[10px] font-mono text-orange-200">{item}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {post.identifiers.filter((item) => item.kind !== 'location').map((item) => (
                <span key={item.normalized} className="text-[11px] font-mono text-slate-400">{item.kind} {item.value}</span>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
