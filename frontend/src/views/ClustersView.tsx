import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { ClusterRecord } from '../types/monitor';
import { formatWhen, shortHash } from '../lib/labels';
import { ErrorNote, PageHeader, Panel } from '../components/ui';

export function ClustersView() {
  const [clusters, setClusters] = useState<ClusterRecord[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getClusters().then(setClusters).catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Link analysis"
        title="Coordinated advertisements"
        subtitle="Posts grouped by overlapping wording, including OCR text from posters. A shared phone or UPI is linked in the seller graph even when the wording differs."
      />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      <div className="space-y-4">
        {clusters.map((cluster) => (
          <Panel key={cluster.id}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="text-xs font-mono text-cyan-300">{cluster.id}</div>
              <div className="text-[11px] font-mono text-slate-500">
                {cluster.size} posts · similarity {Math.round(cluster.score * 100)}% · {cluster.method.replaceAll('_', ' ')}
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {cluster.posts.map((post) => (
                <div key={post.id} className="rounded border border-white/[0.06] p-3 bg-black/20">
                  <div className="text-[10px] font-mono text-slate-500 mb-1">
                    {post.id} · {post.platform} · {post.channel_title} · {formatWhen(post.timestamp)}
                  </div>
                  <p className="text-xs text-slate-200 whitespace-pre-wrap">{post.text}</p>
                  {post.ocr_text && (
                    <p className="text-xs text-cyan-100/80 whitespace-pre-wrap mt-2 border-t border-white/5 pt-2">{post.ocr_text}</p>
                  )}
                  <div className="text-[10px] font-mono text-slate-600 mt-2">sha256 {shortHash(post.content_hash)}</div>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
