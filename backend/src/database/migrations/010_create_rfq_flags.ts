import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create rfq_flags table for compliance & risk flags (FR-10)
  await knex.schema.createTable('rfq_flags', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('rfq_id').notNullable().references('id').inTable('rfqs').onDelete('CASCADE');
    table.string('flag_id', 10).notNullable(); // FLAG-01 through FLAG-05
    table.string('flag_type', 50).notNullable(); // delivery_deviation, payment_deviation, etc.
    table.specificType('affected_supplier_code', 'CHAR(5)').nullable();
    table.specificType('affected_item_ids', 'UUID[]').nullable();
    table.text('detail_text').notNullable();
    table.text('recommendation_text').notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // Indexes for efficient querying
  await knex.raw('CREATE INDEX idx_rfq_flags_rfq_id ON rfq_flags(rfq_id)');
  await knex.raw(
    'CREATE INDEX idx_rfq_flags_active ON rfq_flags(rfq_id, is_active) WHERE is_active = true',
  );

  // Add supplier-specific delivery and payment fields to rfq_suppliers
  // These are needed for FLAG-01 (delivery deviation) and FLAG-02 (payment deviation)
  await knex.schema.alterTable('rfq_suppliers', (table) => {
    table.integer('supplier_delivery_days').nullable();
    table.text('supplier_payment_terms').nullable();
  });

  // Seed flag config values if not already present (idempotent)
  const flagConfigs = [
    {
      key: 'flag_delivery_deviation_threshold',
      value: '20',
      description: 'Percentage threshold for delivery deviation risk flag (FLAG-01)',
    },
    {
      key: 'flag_abnormal_low_price_threshold',
      value: '40',
      description: 'Percentage below average threshold for abnormally low price flag (FLAG-03)',
    },
    {
      key: 'flag_supplier_dominance_threshold',
      value: '80',
      description: 'Percentage of L1 positions for supplier dominance flag (FLAG-04)',
    },
    {
      key: 'flag_late_revision_count',
      value: '3',
      description: 'Number of late revisions to trigger excessive late revisions flag (FLAG-05)',
    },
    {
      key: 'flag_late_revision_window_percent',
      value: '20',
      description: 'Percentage of bid window considered late for FLAG-05',
    },
  ];

  for (const config of flagConfigs) {
    await knex.raw(
      `INSERT INTO system_config (key, value, description)
       VALUES (?, ?, ?)
       ON CONFLICT (key) DO NOTHING`,
      [config.key, config.value, config.description],
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('rfq_flags');
  await knex.schema.alterTable('rfq_suppliers', (table) => {
    table.dropColumn('supplier_delivery_days');
    table.dropColumn('supplier_payment_terms');
  });
}
