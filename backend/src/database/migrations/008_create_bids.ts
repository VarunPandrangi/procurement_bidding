import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('bids', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('rfq_id').notNullable().references('id').inTable('rfqs').onDelete('RESTRICT');
    table
      .uuid('supplier_id')
      .notNullable()
      .references('id')
      .inTable('suppliers')
      .onDelete('RESTRICT');
    table.specificType('supplier_code', 'CHAR(5)').notNullable();

    // Bid versioning
    table.integer('revision_number').notNullable().defaultTo(0);
    table.timestamp('submitted_at', { useTz: true }).notNullable();

    // Price
    table.decimal('total_price', 20, 4).notNullable();

    // Integrity
    table.string('submission_hash', 64).notNullable();

    // Latest flag
    table.boolean('is_latest').notNullable().defaultTo(true);

    // Timestamps
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // Unique constraint: one revision per supplier per RFQ
  await knex.raw(`
    ALTER TABLE bids ADD CONSTRAINT bids_rfq_supplier_revision_unique
    UNIQUE (rfq_id, supplier_id, revision_number)
  `);

  // Standard indexes
  await knex.raw('CREATE INDEX idx_bids_rfq_id ON bids(rfq_id)');
  await knex.raw('CREATE INDEX idx_bids_supplier_id ON bids(supplier_id)');

  // Partial index for fast "latest bid per supplier" queries
  await knex.raw(`
    CREATE INDEX idx_bids_rfq_supplier_latest
    ON bids(rfq_id, supplier_id)
    WHERE is_latest = true
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('bids');
}
