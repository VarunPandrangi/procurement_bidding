import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Performance indexes for Sprint 10 hardening.
  // Using IF NOT EXISTS so this migration is idempotent — some may already exist.
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_audit_log_rfq_id ON audit_log(rfq_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_bids_rfq_supplier ON bids(rfq_id, supplier_id);
    CREATE INDEX IF NOT EXISTS idx_bids_is_latest ON bids(rfq_id, is_latest);
    CREATE INDEX IF NOT EXISTS idx_rfqs_buyer_status ON rfqs(buyer_id, status);
    CREATE INDEX IF NOT EXISTS idx_rfq_suppliers_lookup ON rfq_suppliers(rfq_id, supplier_id);
    CREATE INDEX IF NOT EXISTS idx_negotiation_suppliers ON negotiation_suppliers(negotiation_id, supplier_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Only drop the composite indexes that are new in this migration.
  // idx_audit_log_rfq_id, idx_audit_log_created_at, idx_rfqs_buyer_status
  // already existed from earlier migrations so we do NOT drop them here.
  await knex.raw(`
    DROP INDEX IF EXISTS idx_bids_rfq_supplier;
    DROP INDEX IF EXISTS idx_bids_is_latest;
    DROP INDEX IF EXISTS idx_rfq_suppliers_lookup;
    DROP INDEX IF EXISTS idx_negotiation_suppliers;
  `);
}
