import api from './axios'

// ─── Types ───────────────────────────────────────────
export interface AdminUser {
  id: string
  email: string
  full_name: string
  role: 'ADMIN' | 'BUYER' | 'SUPPLIER'
  is_active: boolean
  supplier_code?: string | null
  company_name?: string | null
  created_at: string
}

export interface AdminSupplier {
  id: string
  user_id: string
  company_name: string
  unique_code: string
  contact_name?: string
  contact_email?: string
  credibility_score?: number
  credibility_class?: 'EXCELLENT' | 'STABLE' | 'RISKY'
  is_active: boolean
  categories?: string[]
  category_tags?: string[]
  email?: string
  full_name?: string
}

export interface AuditLogEntry {
  id: string
  rfq_id?: string
  event_type: string
  actor_id: string
  actor_email?: string
  actor_role?: string
  event_data: Record<string, unknown>
  entry_hash: string
  previous_hash: string
  created_at: string
}

export interface SystemConfig {
  key: string
  value: string
  description: string
  updated_at?: string
  updated_by?: string
}

export interface AuditLogParams {
  page?: number
  limit?: number
  event_type?: string
  rfq_id?: string
  from?: string
  to?: string
  sort?: string
}

export interface CreateUserPayload {
  email: string
  password: string
  full_name: string
  role: string
  company_name?: string
  contact_name?: string
}

// ─── API Functions ───────────────────────────────────
export async function getAdminUsers(): Promise<AdminUser[]> {
  const { data } = await api.get('/api/admin/users')
  return data.data
}

export async function createUser(payload: CreateUserPayload): Promise<AdminUser> {
  const { data } = await api.post('/api/admin/users', payload)
  return data.data
}

export async function deactivateUser(id: string): Promise<void> {
  await api.patch(`/api/admin/users/${id}/deactivate`)
}

export async function reactivateUser(id: string): Promise<void> {
  await api.patch(`/api/admin/users/${id}/reactivate`)
}

export async function getAdminSuppliers(): Promise<AdminSupplier[]> {
  const { data } = await api.get('/api/admin/suppliers')
  return data.data
}

export async function onboardSupplier(payload: { company_name: string; contact_name: string; contact_email: string; categories?: string[] }): Promise<AdminSupplier> {
  const { data } = await api.post('/api/admin/suppliers', payload)
  return data.data
}

export async function getAdminAuditLog(params?: AuditLogParams): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const { data } = await api.get('/api/admin/audit-log', { params })
  return { entries: data.data, total: data.meta?.pagination?.total ?? 0 }
}

export async function getSystemConfig(): Promise<SystemConfig[]> {
  const { data } = await api.get('/api/admin/config')
  return data.data
}

export async function updateSystemConfig(key: string, value: string): Promise<SystemConfig> {
  const { data } = await api.put(`/api/admin/config/${key}`, { value })
  return data.data
}

export async function getAdminKpis(params?: { from?: string; to?: string }): Promise<unknown> {
  const { data } = await api.get('/api/admin/kpis', { params })
  return data.data
}

export async function adminExtendRfq(rfqId: string, payload: { minutes: number; justification: string }): Promise<void> {
  await api.post(`/api/admin/rfqs/${rfqId}/extend`, payload)
}

export async function adminOverride(payload: { entity_type: string; entity_id: string; action: string; justification: string }): Promise<void> {
  await api.post('/api/admin/overrides', payload)
}

export async function fulfillAward(rfqId: string): Promise<void> {
  await api.post(`/api/admin/rfqs/${rfqId}/fulfill`)
}
