import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { AuditRow } from '../types/monitor';
import { formatWhen } from '../lib/labels';
import { ErrorNote, PageHeader } from '../components/ui';

export function AuditView() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAudit().then(setRows).catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        eyebrow="Casework"
        title="Audit log"
        subtitle="Imports, sample resets, and alert status changes."
      />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      <div className="glass-card overflow-hidden">
        <table className="intel-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Officer</th>
              <th>Action</th>
              <th>Target</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{formatWhen(row.timestamp)}</td>
                <td>{row.user_officer}</td>
                <td>{row.action}</td>
                <td>{row.resource_target}</td>
                <td>{row.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-4 text-xs text-slate-500">No audit events yet.</div>}
      </div>
    </div>
  );
}
