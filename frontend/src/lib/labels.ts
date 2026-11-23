export const CATEGORY_META: Record<string, { label: string; chip: string }> = {
  drug_sale: { label: 'Drug sale', chip: 'bg-rose-500/10 text-rose-300 border-rose-500/30' },
  arms_sale: { label: 'Illegal arms', chip: 'bg-red-500/10 text-red-300 border-red-500/30' },
  fake_documents: { label: 'Fake documents', chip: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  bank_account: { label: 'Bank account', chip: 'bg-orange-500/10 text-orange-300 border-orange-500/30' },
  atm_card: { label: 'ATM / card', chip: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30' },
  net_banking: { label: 'Net-banking kit', chip: 'bg-violet-500/10 text-violet-300 border-violet-500/30' },
  sim_card: { label: 'SIM card', chip: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' },
  benign: { label: 'Not a sale', chip: 'bg-slate-500/10 text-slate-400 border-slate-600' },
};

export function categoryLabel(id: string) {
  return CATEGORY_META[id]?.label || id;
}

export function categoryChip(id: string) {
  return CATEGORY_META[id]?.chip || CATEGORY_META.benign.chip;
}

export function riskClass(risk: string) {
  if (risk === 'CRITICAL') return 'badge-critical';
  if (risk === 'HIGH') return 'badge-high';
  if (risk === 'MEDIUM') return 'badge-medium';
  return 'badge-low';
}

export function formatWhen(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function shortHash(value?: string) {
  if (!value) return '—';
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}
