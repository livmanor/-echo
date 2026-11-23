export interface SystemStats {
  threat_level: string;
  threat_score: number;
  kpis: {
    posts_ingested: number;
    flagged_posts: number;
    financial_ads: number;
    identifiers: number;
    seller_clusters: number;
    channels: number;
    open_alerts: number;
    coordinated_groups: number;
  };
  by_category: { category: string; count: number }[];
  by_platform: { platform: string; count: number; flagged: number }[];
  system_status: {
    collector: string;
    classifier: string;
    languages: string;
    evidence_seal: string;
  };
  model: {
    name: string;
    sample_agreement: number | null;
    labelled_posts: number;
    false_positives: number;
    missed: number;
  };
}

export interface Identifier {
  kind: string;
  value: string;
  normalized: string;
}

export interface PostRecord {
  id: string;
  platform: string;
  channel_id: string;
  channel_title: string;
  author: string;
  timestamp: string;
  text: string;
  ocr_text: string;
  image_ref: string;
  category: string;
  confidence: number;
  risk: string;
  flagged: boolean;
  financial_flag: boolean;
  financial_risk: string | null;
  financial_evidence: string[];
  lexicon_hits: string[];
  reasons: string[];
  content_hash: string;
  cluster_id: string | null;
  entity_id: string | null;
  identifiers: Identifier[];
}

export interface AlertRecord {
  id: string;
  post_id: string;
  title: string;
  severity: string;
  category: string;
  timestamp: string;
  status: string;
  reason: string;
  confidence: number;
  evidence_hash: string;
  channel_title: string;
  platform: string;
  post?: PostRecord;
}

export interface SellerEntity {
  id: string;
  label: string;
  risk: string;
  confidence: number;
  post_count: number;
  channel_count: number;
  categories: string[];
  first_seen: string;
  last_seen: string;
}

export interface IdentifierGroup {
  kind: string;
  value: string;
  normalized: string;
  posts: {
    id: string;
    category: string;
    flagged: boolean;
    risk: string;
    channel_title: string;
    platform: string;
    timestamp: string;
    entity_id: string | null;
  }[];
  channels: string[];
  flagged_posts: number;
  cross_channel: boolean;
}

export interface ClusterRecord {
  id: string;
  size: number;
  score: number;
  method: string;
  summary: string;
  posts: PostRecord[];
}

export interface ChannelRecord {
  id: string;
  platform: string;
  title: string;
  handle: string;
  visibility: string;
  mode: string;
  note: string;
  post_count: number;
  flagged_count: number;
  last_post: string | null;
}

export interface GraphNode {
  data: {
    id: string;
    label: string;
    type: string;
    risk?: string;
    platform?: string;
    confidence?: number;
  };
}

export interface GraphEdge {
  data: { id: string; source: string; target: string; relationship: string };
}

export interface AuditRow {
  id: string;
  user_officer: string;
  role: string;
  action: string;
  resource_target: string;
  timestamp: string;
  result: string;
}

export interface ClassifyResult {
  category: string;
  category_label: string;
  confidence: number;
  risk: string;
  flagged: boolean;
  financial_flag: boolean;
  financial_risk: string | null;
  financial_evidence: string[];
  lexicon_hits: string[];
  reasons: string[];
  identifiers: Identifier[];
}
