import type { ReactNode } from 'react';
import { categoryChip, categoryLabel, riskClass } from '../lib/labels';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-5">
      <div>
        {eyebrow && (
          <div className="text-[10px] font-mono tracking-[0.16em] uppercase text-cyan-500/80 mb-1">{eyebrow}</div>
        )}
        <h1 className="text-lg font-semibold text-slate-100 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 font-mono mt-1 max-w-3xl">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function CategoryChip({ id }: { id: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wide ${categoryChip(id)}`}>
      {categoryLabel(id)}
    </span>
  );
}

export function RiskBadge({ risk }: { risk?: string | null }) {
  if (!risk) return null;
  return <span className={riskClass(risk)}>{risk}</span>;
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`glass-card p-4 ${className}`}>{children}</section>;
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 font-mono">
      {message}
    </div>
  );
}
