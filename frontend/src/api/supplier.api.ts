import api from './axios'

// ─── Types ───────────────────────────────────────────
export interface SupplierRfqSummary {
  id: string
  rfq_number: string
  title: string
  status: 'PUBLISHED' | 'ACTIVE' | 'CLOSED' | 'AWARDED'
  supplier_status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  bid_open_at: string | null
  bid_close_at: string | null
  buyer_company?: string
}

export interface SupplierRfqDetail extends SupplierRfqSummary {
  decline_reason?: string
  items: Array<{
    id: string
    description: string
    specification?: string
    uom: string
    quantity: number
  }>
  commercial_terms: Record<string, string>
  bidding_rules: {
    max_revisions: number
    min_change_percent: number
    cooling_time_minutes: number
    bid_open_at: string
    bid_close_at: string
    anti_snipe_window_minutes: number
    anti_snipe_extension_minutes: number
  }
}

export interface SupplierRanking {
  rank_color: 'GREEN' | 'YELLOW' | 'RED'
  proximity_label: 'VERY_CLOSE' | 'CLOSE' | 'FAR' | null
  own_prices: Array<{
    rfq_item_id: string
    unit_price: number
    total_price: number
  }>
}

export interface BidStatus {
  has_bid: boolean
  revisions_used: number
  revision_number: number        // alias for revisions_used (compat)
  revisions_remaining: number
  seconds_until_next_revision: number
  cooling_seconds_remaining: number // alias (compat)
  last_submission_at: string | null // derived from latest_bid
  latest_bid?: {
    id: string
    revision_number: number
    total_price: number
    submitted_at: string
    submission_hash: string
  }
}

// ─── API Functions ───────────────────────────────────
export async function getSupplierRfqs(): Promise<SupplierRfqSummary[]> {
  const { data } = await api.get('/api/supplier/rfqs')
  // Backend returns assignment_status; frontend expects supplier_status
  return (data.data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    supplier_status: r.assignment_status ?? r.supplier_status,
  })) as SupplierRfqSummary[]
}

export async function getSupplierRfq(id: string): Promise<SupplierRfqDetail> {
  const { data } = await api.get(`/api/supplier/rfqs/${id}`)
  const raw = data.data
  // Backend returns flat RFQ fields + nested assignment; reshape to match frontend types
  const assignment = raw.assignment ?? {}
  return {
    ...raw,
    supplier_status: assignment.status ?? raw.supplier_status,
    decline_reason: assignment.decline_reason ?? raw.decline_reason,
    commercial_terms: raw.commercial_terms ?? {
      payment_terms: raw.payment_terms ?? '',
      freight_terms: raw.freight_terms ?? '',
      delivery_lead_time: raw.delivery_lead_time_days ? `${raw.delivery_lead_time_days} days` : '',
      taxes_duties: raw.taxes_duties ?? '',
      warranty: raw.warranty ?? '',
      offer_validity: raw.offer_validity_days ? `${raw.offer_validity_days} days` : '',
      packing_forwarding: raw.packing_forwarding ?? '',
      special_conditions: raw.special_conditions ?? '',
    },
    bidding_rules: raw.bidding_rules ?? {
      max_revisions: raw.max_revisions,
      min_change_percent: raw.min_change_percent,
      cooling_time_minutes: raw.cooling_time_minutes,
      bid_open_at: raw.bid_open_at,
      bid_close_at: raw.bid_close_at,
      anti_snipe_window_minutes: raw.anti_snipe_window_minutes,
      anti_snipe_extension_minutes: raw.anti_snipe_extension_minutes,
    },
  } as SupplierRfqDetail
}

export async function acceptRfq(
  id: string,
  declarations: {
    declaration_rfq_terms: boolean
    declaration_no_collusion: boolean
    declaration_confidentiality: boolean
  },
): Promise<void> {
  await api.post(`/api/supplier/rfqs/${id}/accept`, declarations)
}

export async function declineRfq(id: string, reason: string): Promise<void> {
  await api.post(`/api/supplier/rfqs/${id}/decline`, { reason })
}

export async function submitBid(rfqId: string, items: Array<{ rfq_item_id: string; unit_price: number }>): Promise<unknown> {
  const { data } = await api.post(`/api/supplier/rfqs/${rfqId}/bids`, { items })
  return data.data
}

export async function reviseBid(rfqId: string, items: Array<{ rfq_item_id: string; unit_price: number }>): Promise<unknown> {
  const { data } = await api.put(`/api/supplier/rfqs/${rfqId}/bids`, { items })
  return data.data
}

export async function getSupplierRanking(rfqId: string): Promise<SupplierRanking> {
  const { data } = await api.get(`/api/supplier/rfqs/${rfqId}/ranking`)
  return data.data
}

export async function getBidStatus(rfqId: string): Promise<BidStatus> {
  const { data } = await api.get(`/api/supplier/rfqs/${rfqId}/bid-status`)
  const raw = data.data
  // Normalize backend response to frontend-friendly shape
  return {
    ...raw,
    revision_number: raw.revisions_used ?? raw.revision_number ?? 0,
    cooling_seconds_remaining: raw.seconds_until_next_revision ?? raw.cooling_seconds_remaining ?? 0,
    last_submission_at: raw.latest_bid?.submitted_at ?? raw.last_submission_at ?? null,
  }
}

export async function downloadReceipt(rfqId: string, revision: number): Promise<Blob> {
  const { data } = await api.get(`/api/supplier/rfqs/${rfqId}/receipt`, {
    params: { revision },
    responseType: 'blob',
  })
  return data
}
