import type {
  AlertRecord,
  AuditRow,
  ChannelRecord,
  ClassifyResult,
  ClusterRecord,
  GraphEdge,
  GraphNode,
  IdentifierGroup,
  PostRecord,
  SellerEntity,
  SystemStats,
} from '../types/monitor';

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000') + '/api';

let officer = 'DSP R. Sharma';
let role = 'Investigator';

export function setActor(nextRole: string) {
  role = nextRole;
  officer =
    nextRole === 'Analyst' ? 'P. Kaur' : nextRole === 'Administrator' ? 'Admin-01' : 'DSP R. Sharma';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('X-Officer', officer);
  headers.set('X-Role', role);
  if (init?.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      if (typeof body.detail === 'string') detail = body.detail;
    } catch {
      /* response had no json body */
    }
    throw new Error(detail || 'Request failed');
  }
  const type = response.headers.get('content-type') || '';
  if (type.includes('text/csv') || type.includes('text/html')) {
    return (await response.text()) as T;
  }
  return response.json();
}

export const api = {
  getStats: () => request<SystemStats>('/stats'),
  getChannels: () => request<ChannelRecord[]>('/channels'),
  getPosts: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<PostRecord[]>(`/posts${query ? `?${query}` : ''}`);
  },
  getPost: (id: string) =>
    request<{ post: PostRecord; entity: SellerEntity | null; related_posts: PostRecord[]; cluster_posts: PostRecord[] }>(
      `/posts/${id}`,
    ),
  getAlerts: () => request<AlertRecord[]>('/alerts'),
  updateAlert: (id: string, status: string) =>
    request<{ id: string; status: string }>(`/alerts/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getIdentifiers: (kind?: string) =>
    request<IdentifierGroup[]>(`/identifiers${kind ? `?kind=${encodeURIComponent(kind)}` : ''}`),
  getEntities: () => request<SellerEntity[]>('/entities'),
  getEntity: (id: string) => request<{ entity: SellerEntity; posts: PostRecord[] }>(`/entities/${id}`),
  getClusters: () => request<ClusterRecord[]>('/clusters'),
  getNetwork: () => request<{ nodes: GraphNode[]; edges: GraphEdge[] }>('/network'),
  classify: (text: string, ocrText = '') =>
    request<ClassifyResult>('/classify', {
      method: 'POST',
      body: JSON.stringify({ text, ocr_text: ocrText }),
    }),
  importFile: async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<{ imported: number; flagged: number; posts: number }>('/import', {
      method: 'POST',
      body,
    });
  },
  importJson: (posts: unknown[]) =>
    request<{ imported: number; flagged: number; posts: number }>('/import/json', {
      method: 'POST',
      body: JSON.stringify({ posts, source: 'paste' }),
    }),
  resetSample: () => request<{ posts: number; flagged: number }>('/sample/reset', { method: 'POST' }),
  getAudit: () => request<AuditRow[]>('/audit'),
  sampleCsvUrl: `${API_BASE}/sample.csv`,
  sampleJsonUrl: `${API_BASE}/sample.json`,
};
