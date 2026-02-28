import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('rfqs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('rfq_number', 20).unique().notNullable();
    table.uuid('buyer_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');

    // Core fields
    table.string('title', 500).notNullable();
    table.string('status', 20).notNullable().defaultTo('DRAFT');

    // Bidding rules
    table.integer('max_revisions').notNullable().defaultTo(5);
    table.decimal('min_change_percent', 5, 2).notNullable().defaultTo(1.0);
    table.integer('cooling_time_minutes').notNullable().defaultTo(5);
    table.timestamp('bid_open_at', { useTz: true }).nullable();
    table.timestamp('bid_close_at', { useTz: true }).nullable();
    table.integer('anti_snipe_window_minutes').notNullable().defaultTo(10);
    table.integer('anti_snipe_extension_minutes').notNullable().defaultTo(5);

    // Commercial terms
    table.text('payment_terms').nullable();
    table.text('freight_terms').nullable();
    table.integer('delivery_lead_time_days').nullable();
    table.text('taxes_duties').nullable();
    table.text('warranty').nullable();
    table.integer('offer_validity_days').nullable();
    table.text('packing_forwarding').nullable();
    table.text('special_conditions').nullable();

    // Commercial lock fields
    table.timestamp('commercial_locked_at', { useTz: true }).nullable();
    table.specificType('commercial_locked_by_supplier_code', 'CHAR(5)').nullable();

    // Weighted ranking config
    table.decimal('weight_price', 5, 2).defaultTo(100.0);
    table.decimal('weight_delivery', 5, 2).defaultTo(0.0);
    table.decimal('weight_payment', 5, 2).defaultTo(0.0);

    // Timestamps
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // CHECK constraint for status enum
  await knex.raw(`
    ALTER TABLE rfqs ADD CONSTRAINT rfqs_status_check
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ACTIVE', 'CLOSED', 'AWARDED'))
  `);

  // Indexes for common query patterns
  await knex.raw('CREATE INDEX idx_rfqs_buyer_id ON rfqs(buyer_id)');
  await knex.raw('CREATE INDEX idx_rfqs_status ON rfqs(status)');
  await knex.raw('CREATE INDEX idx_rfqs_buyer_status ON rfqs(buyer_id, status)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('rfqs');
}
