import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ── Table 1: negotiation_events ──
  await knex.schema.createTable('negotiation_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('parent_rfq_id').notNullable().references('id').inTable('rfqs').onDelete('RESTRICT');
    table.uuid('buyer_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.string('status', 20).notNullable().defaultTo('DRAFT');

    // Bidding rules
    table.integer('max_revisions').notNullable();
    table.decimal('min_change_percent', 5, 2).notNullable();
    table.integer('cooling_time_minutes').notNullable();
    table.timestamp('bid_open_at', { useTz: true }).nullable();
    table.timestamp('bid_close_at', { useTz: true }).nullable();
    table.integer('anti_snipe_window_minutes').notNullable().defaultTo(10);
    table.integer('anti_snipe_extension_minutes').notNullable().defaultTo(5);

    // Timestamps
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // CHECK constraint for negotiation status
  await knex.raw(`
    ALTER TABLE negotiation_events ADD CONSTRAINT negotiation_events_status_check
    CHECK (status IN ('DRAFT', 'ACTIVE', 'CLOSED', 'AWARDED'))
  `);

  // Indexes
  await knex.raw(
    'CREATE INDEX idx_negotiation_events_parent_rfq_id ON negotiation_events(parent_rfq_id)',
  );
  await knex.raw('CREATE INDEX idx_negotiation_events_buyer_id ON negotiation_events(buyer_id)');
  await knex.raw('CREATE INDEX idx_negotiation_events_status ON negotiation_events(status)');

  // ── Table 2: negotiation_suppliers ──
  await knex.schema.createTable('negotiation_suppliers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('negotiation_id')
      .notNullable()
      .references('id')
      .inTable('negotiation_events')
      .onDelete('CASCADE');
    table
      .uuid('supplier_id')
      .notNullable()
      .references('id')
      .inTable('suppliers')
      .onDelete('RESTRICT');
    table.specificType('supplier_code', 'CHAR(5)').notNullable();
    table.string('status', 20).notNullable().defaultTo('INVITED');

    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['negotiation_id', 'supplier_id']);
  });

  // CHECK constraint for negotiation supplier status
  await knex.raw(`
    ALTER TABLE negotiation_suppliers ADD CONSTRAINT negotiation_suppliers_status_check
    CHECK (status IN ('INVITED', 'ACCEPTED', 'DECLINED'))
  `);

  // Indexes
  await knex.raw(
    'CREATE INDEX idx_negotiation_suppliers_negotiation_id ON negotiation_suppliers(negotiation_id)',
  );
  await knex.raw(
    'CREATE INDEX idx_negotiation_suppliers_supplier_id ON negotiation_suppliers(supplier_id)',
  );

  // ── Alter bids: add nullable negotiation_id ──
  await knex.schema.alterTable('bids', (table) => {
    table
      .uuid('negotiation_id')
      .nullable()
      .references('id')
      .inTable('negotiation_events')
      .onDelete('RESTRICT');
  });

  await knex.raw('CREATE INDEX idx_bids_negotiation_id ON bids(negotiation_id)');

  // Partial index for fast "latest bid per supplier per negotiation" queries
  await knex.raw(`
    CREATE INDEX idx_bids_negotiation_supplier_latest
    ON bids(negotiation_id, supplier_id)
    WHERE is_latest = true AND negotiation_id IS NOT NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Remove indexes and column from bids
  await knex.raw('DROP INDEX IF EXISTS idx_bids_negotiation_supplier_latest');
  await knex.raw('DROP INDEX IF EXISTS idx_bids_negotiation_id');
  await knex.schema.alterTable('bids', (table) => {
    table.dropColumn('negotiation_id');
  });

  // Drop tables in dependency order
  await knex.schema.dropTableIfExists('negotiation_suppliers');
  await knex.schema.dropTableIfExists('negotiation_events');
}
