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
}

export interface ActivityResponse {
  changes: number;
  new: number;
  archived: number;
}

export interface SyncResponse {
  sources_synced?: number;
  details?: SyncDetail[];
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
  startIngest: (id: string) =>
    api.post(`/ai/documents/${id}/ingest`).then(r => r.data),
  cancelIngest: (id: string) =>
    api.post(`/ai/documents/${id}/cancel`).then(r => r.data),
  downloadAll: () =>
    api.post('/ai/download').then(r => r.data),
  sync: () =>
    api.post('/ai/sync').then(r => r.data),
  pauseSync: () =>
    api.post('/ai/sync/pause').then(r => r.data),
  resumeSync: () =>
    api.post('/ai/sync/resume').then(r => r.data),
  getSyncStatus: () =>
    api.get<{ paused: boolean }>('/ai/sync/status').then(r => r.data),
  listSources: () =>
    api.get<SourceResponse[]>('/ai/sources').then(r => r.data),
  createSource: (data: { name: string; url: string; doc_group?: string; sync_interval?: string }) =>
    api.post('/ai/sources', data).then(r => r.data),
  updateSource: (id: string, data: Record<string, unknown>) =>
    api.put(`/ai/sources/${id}`, data).then(r => r.data),
  deleteSource: (id: string) =>
    api.delete(`/ai/sources/${id}`),
  syncSource: (sourceId?: string) =>
    api.post('/ai/sync', sourceId ? { source_id: sourceId } : {}).then(r => r.data),
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
