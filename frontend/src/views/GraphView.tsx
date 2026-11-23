import { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { api } from '../services/api';
import type { SellerEntity } from '../types/monitor';
import { categoryLabel } from '../lib/labels';
import { ErrorNote, PageHeader, Panel, RiskBadge } from '../components/ui';

const COLORS: Record<string, string> = {
  seller: '#fb7185',
  channel: '#22d3ee',
  phone: '#fbbf24',
  upi: '#c4b5fd',
  wallet: '#34d399',
  telegram: '#38bdf8',
  account: '#fdba74',
  ifsc: '#94a3b8',
};

export function GraphView() {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<SellerEntity | null>(null);
  const [counts, setCounts] = useState({ nodes: 0, edges: 0 });

  useEffect(() => {
    let cy: cytoscape.Core | null = null;
    let cancelled = false;
    api.getNetwork().then((graph) => {
      if (cancelled || !container.current) return;
      setCounts({ nodes: graph.nodes.length, edges: graph.edges.length });
      cy = cytoscape({
        container: container.current,
        elements: [...graph.nodes, ...graph.edges],
        layout: { name: 'cose', animate: false, padding: 24, nodeRepulsion: 7800 } as cytoscape.LayoutOptions,
        style: [
          {
            selector: 'node',
            style: {
              'background-color': (node: cytoscape.NodeSingular) => COLORS[node.data('type')] || '#64748b',
              label: 'data(label)',
              color: '#e2e8f0',
              'font-size': 9,
              'font-family': 'JetBrains Mono, monospace',
              'text-max-width': '88px',
              'text-wrap': 'ellipsis',
              'text-valign': 'bottom',
              'text-margin-y': 6,
              width: 22,
              height: 22,
            },
          },
          {
            selector: 'node[type = "seller"]',
            style: { width: 34, height: 34, 'font-size': 10 },
          },
          {
            selector: 'edge',
            style: {
              width: 1,
              'line-color': '#334155',
              'curve-style': 'bezier',
              label: 'data(relationship)',
              'font-size': 8,
              color: '#64748b',
              'text-rotation': 'autorotate',
            },
          },
        ],
      });
      cy.on('tap', 'node', async (event) => {
        const data = event.target.data();
        if (data.type !== 'seller') {
          setSelected(null);
          return;
        }
        const detail = await api.getEntity(data.id);
        setSelected(detail.entity);
      });
    }).catch((err: Error) => setError(err.message));
    return () => {
      cancelled = true;
      cy?.destroy();
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        eyebrow="Link analysis"
        title="Seller graph"
        subtitle="A seller node is every post joined by the same phone, UPI, wallet, handle, or account. Channel nodes show where that seller posted."
      />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      <div className="grid lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 glass-card h-[680px] relative">
          <div ref={container} className="absolute inset-0" />
          <div className="absolute left-3 bottom-3 text-[10px] font-mono text-slate-500">
            {counts.nodes} nodes · {counts.edges} links
          </div>
        </div>
        <Panel>
          <div className="text-[10px] font-mono text-slate-500 mb-2">LEGEND</div>
          <div className="space-y-1.5 mb-4">
            {Object.entries(COLORS).map(([name, color]) => (
              <div key={name} className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                {name}
              </div>
            ))}
          </div>
          {selected ? (
            <div className="space-y-2">
              <div className="text-sm text-slate-100">{selected.label}</div>
              <RiskBadge risk={selected.risk} />
              <div className="text-xs text-slate-400">
                {selected.post_count} posts across {selected.channel_count} channel{selected.channel_count === 1 ? '' : 's'}
              </div>
              <div className="flex flex-wrap gap-1">
                {selected.categories.map((category) => (
                  <span key={category} className="text-[10px] font-mono text-slate-400">{categoryLabel(category)}</span>
                ))}
              </div>
              <div className="text-[10px] font-mono text-slate-600">{selected.id}</div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Select a rose seller node to read the cluster.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
