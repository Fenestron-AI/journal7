import api from './client';

export interface LegalDocumentResponse {
  id: string;
  title: string;
  docNumber?: string;
  docDate?: string;
  revision?: string;
  docType: string;
  docCategory?: string;
  syncInterval?: string;
  status: string;
  downloadState?: string;
  processingState?: string;
  priority?: string;
  pinned?: boolean;
  filePath?: string;
  chunkCount: number;
  originalFilename?: string;
  fileSize: number;
  source: string;
  sourceUrl?: string;
  metadata: Record<string, string>;
}

export interface SourceResponse {
  id: string;
  name: string;
  url: string;
  sync_strategy: string;
  doc_group: string;
  sync_interval: string;
  active: boolean;
  status: string;
  last_synced_at: number;
  crawl_depth: number;
  url_filter: string[];
}

export interface SourcePayload {
  name: string;
  url: string;
  doc_group?: string;
  sync_interval?: string;
  crawl_depth?: number;
  url_filter?: string[];
  active?: boolean;
}

export interface CatalogRuleResponse {
  id: string;
  action: string;
  priority: number;
  source: string | null;
  category: string | null;
  doc_type: string | null;
  doc_number: string | null;
  title_mask: string | null;
  comment: string | null;
  active: boolean;
  createdAt: number;
}

export interface CatalogRulePayload {
  action?: string;
  priority?: number;
  source?: string | null;
  category?: string | null;
  doc_type?: string | null;
  doc_number?: string | null;
  title_mask?: string | null;
  comment?: string | null;
  active?: boolean;
}

export interface FileSourceResponse {
  id: string;
  domain: string;
  priority: number;
  active: boolean;
  comment: string | null;
  createdAt: number;
}

export interface FileSourcePayload {
  domain: string;
  priority?: number;
  comment?: string | null;
  active?: boolean;
}

export const CATEGORIES: Record<string, string> = {
  laws: 'Законы',
  regulations: 'Постановления',
  standards: 'Стандарты и правила',
  charters: 'Уставы',
  other: 'Прочее',
  tariffs: 'Тарифы',
};

export const INTERVALS: Record<string, string> = {
  weekly: 'Еженедельно',
  monthly: 'Ежемесячно',
};

export const DOC_TYPES: Record<string, string> = {
  law: 'ФЗ',
  decree: 'Постановление',
  order: 'Приказ',
  regulation: 'Регламент',
  contract: 'Договор',
  standard: 'Стандарт',
  method: 'Методика',
  other: 'Прочее',
};

export interface ActivityResponse {
  changes: number;
  new: number;
  archived: number;
}

export interface SyncResponse {
  sources_synced?: number;
  details?: SyncDetail[];
}

export interface SyncStateResponse {
  running: boolean;
  cancelled: boolean;
  current_source: string | null;
  done_sources: number;
  total_sources: number;
  started_at: number | null;
  last_result: SyncResponse | null;
}

export interface SyncDiffDoc {
  title: string;
  doc_number?: string;
}

export interface SyncDiff {
  id: string;
  sourceName: string;
  newDocs: SyncDiffDoc[];
  archivedDocs: SyncDiffDoc[];
  createdAt: number;
}

export interface SyncDetail {
  name: string;
  url: string;
  new?: number;
  updated?: number;
  archived?: number;
  error?: string;
}

export interface SourceRefDto {
  documentId: string;
  title: string;
  docNumber?: string;
  chunkIndex: number;
  text: string;
}

export interface QaResponseDto {
  answer: string;
  sources: SourceRefDto[];
}

export interface NotificationDto {
  id: string;
  docNumber: string;
  title: string;
  message: string;
  read: boolean;
}

export const aiApi = {
  listDocuments: (status?: string) =>
    api.get<LegalDocumentResponse[]>('/ai/documents', { params: { status } }).then(r => r.data),
  getDocument: (id: string) =>
    api.get<LegalDocumentResponse>(`/ai/documents/${id}`).then(r => r.data),
  deleteDocument: (id: string) =>
    api.delete(`/ai/documents/${id}`),
  setDocumentUrl: (id: string, url: string) =>
    api.post(`/ai/documents/${id}/set-url`, { url }).then(r => r.data),
  forgetDocuments: (ids: string[]) =>
    api.post('/ai/documents/forget', { ids }).then(r => r.data),
  unforgetDocuments: (ids: string[]) =>
    api.post('/ai/documents/unforget', { ids }).then(r => r.data),
  setCategory: (ids: string[], category: string) =>
    api.post('/ai/documents/category', { ids, category }).then(r => r.data),
  getDiffs: () =>
    api.get<SyncDiff[]>('/ai/diffs').then(r => r.data),
  acknowledgeDiffs: (ids: string[] = []) =>
    api.post('/ai/diffs/acknowledge', { ids }).then(r => r.data),
  startIngest: (id: string) =>
    api.post(`/ai/documents/${id}/ingest`).then(r => r.data),
  cancelIngest: (id: string) =>
    api.post(`/ai/documents/${id}/cancel`).then(r => r.data),
  downloadAll: () =>
    api.post('/ai/download').then(r => r.data),
  sync: () =>
    api.post('/ai/sync').then(r => r.data),
  getScheduler: () =>
    api.get<{ enabled: boolean }>('/ai/scheduler').then(r => r.data),
  setScheduler: (enabled: boolean) =>
    api.post<{ enabled: boolean }>('/ai/scheduler', { enabled }).then(r => r.data),
  getSyncState: () =>
    api.get<SyncStateResponse>('/ai/sync/state').then(r => r.data),
  cancelSync: () =>
    api.post('/ai/sync/cancel').then(r => r.data),
  pauseSync: () =>
    api.post('/ai/sync/pause').then(r => r.data),
  resumeSync: () =>
    api.post('/ai/sync/resume').then(r => r.data),
  getSyncStatus: () =>
    api.get<{ paused: boolean }>('/ai/sync/status').then(r => r.data),
  listSources: () =>
    api.get<SourceResponse[]>('/ai/sources').then(r => r.data),
  createSource: (data: SourcePayload) =>
    api.post('/ai/sources', data).then(r => r.data),
  updateSource: (id: string, data: Partial<SourcePayload>) =>
    api.put(`/ai/sources/${id}`, data).then(r => r.data),
  deleteSource: (id: string) =>
    api.delete(`/ai/sources/${id}`),
  syncSource: (sourceId?: string) =>
    api.post('/ai/sync', sourceId ? { source_id: sourceId } : {}).then(r => r.data),
  listCatalogRules: () =>
    api.get<CatalogRuleResponse[]>('/ai/catalog-rules').then(r => r.data),
  createCatalogRule: (data: CatalogRulePayload) =>
    api.post('/ai/catalog-rules', data).then(r => r.data),
  updateCatalogRule: (id: string, data: CatalogRulePayload) =>
    api.put(`/ai/catalog-rules/${id}`, data).then(r => r.data),
  deleteCatalogRule: (id: string) =>
    api.delete(`/ai/catalog-rules/${id}`),
  listFileSources: () =>
    api.get<FileSourceResponse[]>('/ai/file-sources').then(r => r.data),
  createFileSource: (data: FileSourcePayload) =>
    api.post('/ai/file-sources', data).then(r => r.data),
  updateFileSource: (id: string, data: Partial<FileSourcePayload>) =>
    api.put(`/ai/file-sources/${id}`, data).then(r => r.data),
  deleteFileSource: (id: string) =>
    api.delete(`/ai/file-sources/${id}`),
  activity: () =>
    api.get<ActivityResponse>('/ai/activity').then(r => r.data),
  clearActivity: () =>
    api.post('/ai/activity/clear'),
  refresh: () =>
    api.post('/ai/documents/refresh').then(r => r.data),
  ask: (question: string, messages: { role: string; content: string }[] = []) =>
    api.post<QaResponseDto>('/ai/chat', { messages: [...messages, { role: 'user', content: question }] }).then(r => r.data),
  health: () =>
    api.get<{ worker: boolean }>('/ai/health').then(r => r.data),
  notifications: (read?: boolean) =>
    api.get<NotificationDto[]>('/ai/notifications', { params: { read } }).then(r => r.data),
  markRead: (id: string) =>
    api.post(`/ai/notifications/${id}/read`),
};
