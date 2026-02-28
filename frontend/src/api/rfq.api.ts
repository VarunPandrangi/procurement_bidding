import api from './axios'

// ─── Types ───────────────────────────────────────────
export interface RfqSummary {
  id: string
  rfq_number: string
  title: string
  status: 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'CLOSED' | 'AWARDED'
  buyer_id: string
  supplier_count: number
  bid_open_at: string | null
  bid_close_at: string | null
  created_at: string
  updated_at: string
}

export interface RfqDetail extends RfqSummary {
  items: RfqItem[]
  suppliers: RfqSupplier[]
  // Commercial terms (flat)
  payment_terms: string | null
  freight_terms: string | null
  delivery_lead_time_days: number | null
  taxes_duties: string | null
  warranty: string | null
  offer_validity_days: number | null
  packing_forwarding: string | null
  special_conditions: string | null
  commercial_locked_at: string | null
  commercial_locked_by_supplier_code: string | null
  // Bidding rules (flat)
  max_revisions: number
  min_change_percent: number
  cooling_time_minutes: number
  anti_snipe_window_minutes: number
  anti_snipe_extension_minutes: number
  // Weights
  weight_price: number
  weight_delivery: number
  weight_payment: number
}

export interface RfqItem {
  id: string
  sl_no: number
  description: string
  specification?: string
  uom: string
  quantity: number
  last_price?: number | null
}

export interface RfqSupplier {
  id: string
  supplier_id: string
  supplier_code: string
  company_name: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  credibility_class?: string
}

// ─── Ranking Types ──────────────────────────────────
export interface ItemRankingEntry {
  supplier_code: string
  supplier_id: string
  unit_price: number
  total_price: number
  rank: number
}

export interface ItemRanking {
  rfq_item_id: string
  l1_supplier_code: string | null
  l1_price: number | null
  bidder_count: number
  rankings: ItemRankingEntry[]
}

export interface TotalRanking {
  supplier_code: string
  supplier_id: string
  total_price: number
  rank: number
  credibility_class: 'EXCELLENT' | 'STABLE' | 'RISKY' | null
}

export interface WeightedRanking {
  supplier_code: string
  supplier_id: string
  score: number
  rank: number
  score_breakdown: {
    price_score: number
    delivery_score: number
    payment_score: number
  }
}

export interface RankingResult {
  item_rankings: ItemRanking[]
  total_rankings: TotalRanking[]
  weighted_rankings: WeightedRanking[]
}

// ─── Compliance Flag Types ──────────────────────────
export interface ComplianceFlag {
  id: string
  rfq_id: string
  flag_id: string
  flag_type: string
  affected_supplier_code: string | null
  affected_item_ids: string[] | null
  detail_text: string
  recommendation_text: string
  is_active: boolean
  created_at: string
}

// ─── Audit Types ────────────────────────────────────
export interface RfqAuditEntry {
  id: string
  rfq_id: string
  event_type: string
  actor_type: string
  actor_id: string
  actor_code: string | null
  event_data: Record<string, unknown>
  event_hash: string
  created_at: string
}

// ─── Simulation Types ───────────────────────────────
export type SimulationInput =
  | { mode: 'single_supplier'; supplier_id: string }
  | { mode: 'item_split'; items: { rfq_item_id: string; supplier_id: string }[] }
  | { mode: 'category_split'; categories: { item_ids: string[]; supplier_id: string }[] }

export interface SimulationResult {
  mode: 'single_supplier' | 'item_split' | 'category_split'
  total_procurement_cost: number
  delivery_outcome_days: number | null
  unique_supplier_count: number
  delta_vs_l1_total: number
  theoretical_minimum_cost: number
  per_supplier_breakdown: {
    supplier_code: string
    items_awarded_count: number
    subtotal: number
  }[]
  simulated_at: string
}

// ─── Award Types ────────────────────────────────────
export interface AwardInput {
  type: 'single' | 'split'
  allocations: {
    supplier_id: string
    item_ids?: string[]
  }[]
}

// ─── KPI Types ──────────────────────────────────────
export interface BuyerKpiData {
  cycle_time_hours: number | null
  savings_pct: number | null
  participation_ratio_pct: number | null
  price_convergence_cv: number | null
  rfq_count: number
}

// ─── Available Supplier (for wizard) ────────────────
export interface AvailableSupplier {
  id: string
  company_name: string
  unique_code: string
  credibility_class: 'EXCELLENT' | 'STABLE' | 'RISKY' | null
  is_active: boolean
}

// ─── API Functions ───────────────────────────────────
export async function getBuyerRfqs(params?: { status?: string }): Promise<RfqSummary[]> {
  const { data } = await api.get('/api/buyer/rfqs', { params })
  return data.data
}

export async function getBuyerRfq(id: string): Promise<RfqDetail> {
  const { data } = await api.get(`/api/buyer/rfqs/${id}`)
  return data.data
}

export async function createRfq(payload: Record<string, unknown>): Promise<RfqDetail> {
  const { data } = await api.post('/api/buyer/rfqs', payload)
  return data.data
}

export async function updateRfq(id: string, payload: Record<string, unknown>): Promise<RfqDetail> {
  const { data } = await api.put(`/api/buyer/rfqs/${id}`, payload)
  return data.data
}

export async function publishRfq(id: string): Promise<RfqDetail> {
  const { data } = await api.post(`/api/buyer/rfqs/${id}/publish`)
  return data.data
}

export async function closeRfq(id: string): Promise<RfqDetail> {
  const { data } = await api.post(`/api/buyer/rfqs/${id}/close`)
  return data.data
}

export async function getRankings(rfqId: string): Promise<RankingResult> {
  const { data } = await api.get(`/api/buyer/rfqs/${rfqId}/rankings`)
  return data.data
}

export async function getFlags(rfqId: string): Promise<ComplianceFlag[]> {
  const { data } = await api.get(`/api/buyer/rfqs/${rfqId}/flags`)
  return data.data
}

export async function getAuditLog(rfqId: string, params?: Record<string, string>): Promise<{ entries: RfqAuditEntry[]; total: number }> {
  const { data } = await api.get(`/api/buyer/rfqs/${rfqId}/audit-log`, { params })
  return { entries: data.data, total: data.meta?.total ?? data.data.length }
}

export async function runSimulation(rfqId: string, payload: SimulationInput): Promise<SimulationResult> {
  const { data } = await api.post(`/api/buyer/rfqs/${rfqId}/simulation`, payload)
  return data.data
}

export async function finaliseAward(rfqId: string, payload: AwardInput): Promise<RfqDetail> {
  const { data } = await api.post(`/api/buyer/rfqs/${rfqId}/award`, payload)
  return data.data
}

export async function exportExcel(rfqId: string): Promise<Blob> {
  const { data } = await api.get(`/api/buyer/rfqs/${rfqId}/export/excel`, { responseType: 'blob' })
  return data
}

export async function exportPdf(rfqId: string): Promise<Blob> {
  const { data } = await api.get(`/api/buyer/rfqs/${rfqId}/export/pdf`, { responseType: 'blob' })
  return data
}

export async function updateWeights(rfqId: string, weights: { weight_price: number; weight_delivery: number; weight_payment: number }): Promise<RfqDetail> {
  const { data } = await api.patch(`/api/buyer/rfqs/${rfqId}/weights`, weights)
  return data.data
}

export async function getBuyerKpis(params?: { from?: string; to?: string }): Promise<BuyerKpiData> {
  const { data } = await api.get('/api/buyer/kpis', { params })
  return data.data
}

export async function getAvailableSuppliers(): Promise<AvailableSupplier[]> {
  const { data } = await api.get('/api/buyer/suppliers')
  return data.data
}

export async function assignSuppliers(rfqId: string, supplier_ids: string[]): Promise<void> {
  await api.post(`/api/buyer/rfqs/${rfqId}/suppliers`, { supplier_ids })
}
