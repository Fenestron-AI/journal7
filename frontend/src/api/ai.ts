import api from './client';

export interface LegalDocumentResponse {
  id: string;
  title: string;
  docNumber?: string;
  docDate?: string;
  revision?: string;
  docType: string;
  status: string;
  filePath?: string;
  chunkCount: number;
  canonical: boolean;
  metadata: Record<string, string>;
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
