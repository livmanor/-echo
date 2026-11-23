import { Fragment, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { IdentifierGroup } from '../types/monitor';
import { CategoryChip, ErrorNote, PageHeader, RiskBadge } from '../components/ui';

const KINDS = ['', 'phone', 'upi', 'telegram', 'wallet', 'account', 'ifsc', 'location'];

export function IdentifiersView() {
  const [kind, setKind] = useState('');
  const [rows, setRows] = useState<IdentifierGroup[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api.getIdentifiers(kind || undefined).then(setRows).catch((err: Error) => setError(err.message));
  }, [kind]);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Extraction"
        title="Seller identifiers"
        subtitle="Phone numbers, UPI IDs, handles, wallets, and places pulled from post text and poster OCR. The same value across channels is one row."
      >
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          className="bg-white/[0.03] border border-white/10 rounded px-2 py-1.5 text-xs"
        >
          {KINDS.map((value) => (
            <option key={value} value={value}>{value || 'All kinds'}</option>
          ))}
        </select>
      </PageHeader>
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      <div className="glass-card overflow-hidden">
        <table className="intel-table">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Value</th>
              <th>Posts</th>
              <th>Channels</th>
              <th>Flagged</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = `${row.kind}:${row.normalized}`;
              return (
                <Fragment key={key}>
                  <tr onClick={() => setOpen(open === key ? null : key)} className="cursor-pointer">
                    <td className="uppercase text-[10px] text-slate-500">{row.kind}</td>
                    <td className="text-slate-100">{row.value}</td>
                    <td>{row.posts.length}</td>
                    <td>{row.cross_channel ? row.channels.join(' · ') : row.channels[0]}</td>
                    <td>{row.flagged_posts}</td>
                  </tr>
                  {open === key && (
                    <tr>
                      <td colSpan={5}>
                        <div className="flex flex-col gap-1 py-1">
                          {row.posts.map((post) => (
                            <div key={post.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                              <span className="font-mono text-slate-500">{post.id}</span>
                              <CategoryChip id={post.category} />
                              <RiskBadge risk={post.risk} />
                              <span>{post.channel_title}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-4 text-xs text-slate-500">No identifiers.</div>}
      </div>
    </div>
  );
}
