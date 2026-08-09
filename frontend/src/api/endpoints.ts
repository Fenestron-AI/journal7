import api from './client';

export interface LoginRequest { username: string; password: string }
export interface AuthResponse { accessToken: string; refreshToken: string; tokenType: string; expiresIn: number }
export interface UserResponse { id: string; username: string; fullName: string; email: string | null; role: string }

export const authApi = {
  login: (data: LoginRequest) => api.post<AuthResponse>('/auth/login', data),
  refresh: (refreshToken: string) => api.post<AuthResponse>('/auth/refresh', { refreshToken }),
  me: () => api.get<UserResponse>('/auth/me'),
};

export interface CounterpartyResponse {
  id: string; code: string; name: string; fullName?: string; inn?: string; kpp?: string;
  type: string; phone?: string; email?: string;
}
export interface CounterpartyListResponse { items: CounterpartyResponse[]; total: number; page: number; size: number; totalPages: number }

export const counterpartyApi = {
  list: (q = '', page = 1, size = 20) => api.get<CounterpartyListResponse>('/reference/counterparties', { params: { q, page, size } }),
  get: (id: string) => api.get<CounterpartyResponse>(`/reference/counterparties/${id}`),
  create: (data: any) => api.post<CounterpartyResponse>('/reference/counterparties', data),
  update: (id: string, data: any) => api.put<CounterpartyResponse>(`/reference/counterparties/${id}`, data),
  delete: (id: string) => api.delete(`/reference/counterparties/${id}`),
};

export interface SaleContractResponse {
  id: string; number: string; counterpartyId: string; counterpartyName: string;
  dateFrom: string; dateTo?: string; type: string; priceCategory: string; confirmed: boolean;
}

export const contractApi = {
  list: (q = '', page = 1, size = 20) => api.get<{ items: SaleContractResponse[]; total: number; page: number; size: number }>('/contracts/sale', { params: { q, page, size } }),
  get: (id: string) => api.get<SaleContractResponse>(`/contracts/sale/${id}`),
  create: (data: any) => api.post<SaleContractResponse>('/contracts/sale', data),
  update: (id: string, data: any) => api.put<SaleContractResponse>(`/contracts/sale/${id}`, data),
  delete: (id: string) => api.delete(`/contracts/sale/${id}`),
  tree: (id: string) => api.get<any>(`/contracts/sale/${id}/tree`),
  createObject: (contractId: string, data: any) => api.post(`/contracts/sale/${contractId}/objects`, data),
  deleteObject: (objectId: string) => api.delete(`/contracts/sale/objects/${objectId}`),
  createDP: (contractId: string, objectId: string, data: any) => api.post(`/contracts/sale/${contractId}/objects/${objectId}/delivery-points`, data),
  updateDP: (pointId: string, data: any) => api.put(`/contracts/sale/delivery-points/${pointId}`, data),
  deleteDP: (pointId: string) => api.delete(`/contracts/sale/delivery-points/${pointId}`),
};

export interface PowerProfileResponse { id: string; code: string; name: string; type: string; unit: string; valueCount: number; minValue?: number; maxValue?: number; avgValue?: number }
export interface HeatmapItem { date: string; hour: number; value: number }

export const powerProfileApi = {
  list: (q = '', page = 1) => api.get<{ items: PowerProfileResponse[]; total: number; page: number; size: number }>('/reference/power-profiles', { params: { q, page } }),
  create: (data: any) => api.post<PowerProfileResponse>('/reference/power-profiles', data),
  delete: (id: string) => api.delete(`/reference/power-profiles/${id}`),
  heatmap: (id: string, from: string, to: string) => api.get<{ data: HeatmapItem[] }>(`/reference/power-profiles/${id}/heatmap`, { params: { from, to } }),
  validate: (id: string, from: string, to: string) => api.post<any>(`/reference/power-profiles/${id}/validate?from=${from}&to=${to}`),
  importValues: (id: string, file: File) => {
    const form = new FormData(); form.append('file', file);
    return api.post(`/reference/power-profiles/${id}/values`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export interface CalculationResultResponse {
  id: string; contractId: string; priceCategory: string; status: string;
  periodFrom: string; periodTo: string; totalVolume: number; totalCost: number; costPerMwh: number;
  hourlyResults: { date: string; hour: number; volume: number; price: number; cost: number; zone?: string }[];
  zoneResults: Record<string, { zone: string; volume: number; rate: number; cost: number }>;
}

export const calculationApi = {
  run: (contractId: string, data: any) => api.post<CalculationResultResponse>(`/calculations/sale?contractId=${contractId}`, data),
  list: (contractId: string) => api.get<{ items: CalculationResultResponse[]; total: number }>(`/calculations/sale?contractId=${contractId}`),
  get: (id: string) => api.get<CalculationResultResponse>(`/calculations/sale/${id}`),
  delete: (id: string) => api.delete(`/calculations/sale/${id}`),
};

export interface InvoiceResponse { id: string; number: string; date: string; type: string; totalAmount: number; totalVat: number; totalWithVat: number; status: string; items: any[] }

export const invoiceApi = {
  list: (contractId: string) => api.get<InvoiceResponse[]>('/billing/invoices', { params: { contractId } }),
  generate: (contractId: string, calculationId: string, number: string, type: string) =>
    api.post<InvoiceResponse>(`/billing/invoices/generate?contractId=${contractId}`, { calculationId, number, type }),
  delete: (id: string) => api.delete(`/billing/invoices/${id}`),
};
