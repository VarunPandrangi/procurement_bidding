import {
  UserRole,
  CredibilityClass,
  ActorType,
  AuditEventType,
  RFQStatus,
  SupplierAssignmentStatus,
  RankColor,
  ProximityLabel,
  NegotiationStatus,
  NegotiationSupplierStatus,
} from './enums';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Supplier {
  id: string;
  user_id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  unique_code: string;
  category_tags: string[] | null;
  credibility_score: number;
  credibility_class: CredibilityClass;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AuditLogEntry {
  id: string;
  rfq_id: string | null;
  event_type: AuditEventType;
  actor_type: ActorType;
  actor_id: string | null;
  actor_code: string | null;
  event_data: Record<string, unknown>;
  event_hash: string;
  created_at: Date;
}

export interface SystemConfig {
  key: string;
  value: string;
  description: string | null;
  updated_by: string | null;
  updated_at: Date;
}

export interface UserWithSupplier extends User {
  supplier?: Supplier;
}

export interface TokenPayload {
  userId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface SupplierLinkTokenPayload {
  supplierId: string;
  rfqId: string;
  type: 'supplier_access';
  iat?: number;
  exp?: number;
}

export interface RFQ {
  id: string;
  rfq_number: string;
  buyer_id: string;
  title: string;
  status: RFQStatus;
  max_revisions: number;
  min_change_percent: number;
  cooling_time_minutes: number;
  bid_open_at: Date | null;
  bid_close_at: Date | null;
  anti_snipe_window_minutes: number;
  anti_snipe_extension_minutes: number;
  payment_terms: string | null;
  freight_terms: string | null;
  delivery_lead_time_days: number | null;
  taxes_duties: string | null;
  warranty: string | null;
  offer_validity_days: number | null;
  packing_forwarding: string | null;
  special_conditions: string | null;
  commercial_locked_at: Date | null;
  commercial_locked_by_supplier_code: string | null;
  weight_price: number;
  weight_delivery: number;
  weight_payment: number;
  created_at: Date;
  updated_at: Date;
}

export interface RFQItem {
  id: string;
  rfq_id: string;
  sl_no: number;
  description: string;
  specification: string | null;
  uom: string;
  quantity: number;
  last_price: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface RFQSupplier {
  id: string;
  rfq_id: string;
  supplier_id: string;
  supplier_code: string;
  access_token: string | null;
  access_token_expires_at: Date | null;
  status: SupplierAssignmentStatus;
  decline_reason: string | null;
  accepted_at: Date | null;
  declaration_rfq_terms: boolean;
  declaration_no_collusion: boolean;
  declaration_confidentiality: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Bid {
  id: string;
  rfq_id: string;
  supplier_id: string;
  supplier_code: string;
  revision_number: number;
  submitted_at: Date;
  total_price: number;
  submission_hash: string;
  is_latest: boolean;
  negotiation_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface BidItem {
  id: string;
  bid_id: string;
  rfq_item_id: string;
  unit_price: number;
  total_price: number;
  created_at: Date;
}

export interface ItemRankingEntry {
  supplier_code: string;
  supplier_id: string;
  unit_price: number;
  total_price: number;
  rank: number;
}

export interface ItemRanking {
  rfq_item_id: string;
  rankings: ItemRankingEntry[];
}

export interface TotalRanking {
  supplier_code: string;
  supplier_id: string;
  total_price: number;
  rank: number;
}

export interface WeightedRanking {
  supplier_code: string;
  supplier_id: string;
  price_score: number;
  delivery_score: number;
  payment_score: number;
  weighted_score: number;
  rank: number;
}

export interface SupplierRankView {
  rank_color: RankColor;
  proximity_label: ProximityLabel | null;
  own_items: Array<{
    rfq_item_id: string;
    unit_price: number;
    total_price: number;
  }>;
  own_total_price: number;
}

export interface RankingResult {
  item_rankings: ItemRanking[];
  total_rankings: TotalRanking[];
  weighted_rankings: WeightedRanking[];
}

export interface NegotiationEvent {
  id: string;
  parent_rfq_id: string;
  buyer_id: string;
  status: NegotiationStatus;
  max_revisions: number;
  min_change_percent: number;
  cooling_time_minutes: number;
  bid_open_at: Date | null;
  bid_close_at: Date | null;
  anti_snipe_window_minutes: number;
  anti_snipe_extension_minutes: number;
  created_at: Date;
  updated_at: Date;
}

export interface NegotiationSupplier {
  id: string;
  negotiation_id: string;
  supplier_id: string;
  supplier_code: string;
  status: NegotiationSupplierStatus;
  created_at: Date;
  updated_at: Date;
}
