import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('system_config', (table) => {
    table.string('key', 100).primary();
    table.text('value').notNullable();
    table.text('description').nullable();
    table.uuid('updated_by').nullable().references('id').inTable('users');
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Seed default system configuration values
  await knex('system_config').insert([
    {
      key: 'default_max_revisions',
      value: '5',
      description: 'Default maximum number of bid revisions per supplier per RFQ',
    },
    {
      key: 'default_min_change_percent',
      value: '1.00',
      description: 'Default minimum percentage change required per revision',
    },
    {
      key: 'default_cooling_time_minutes',
      value: '5',
      description: 'Default cooling time between revisions in minutes',
    },
    {
      key: 'default_anti_snipe_window_minutes',
      value: '10',
      description: 'Default anti-snipe window in minutes before bid close',
    },
    {
      key: 'default_anti_snipe_extension_minutes',
      value: '5',
      description: 'Default anti-snipe extension duration in minutes',
    },
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
    {
      key: 'supplier_link_expiry_hours',
      value: '72',
      description: 'Default expiry for tokenized supplier links in hours',
    },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('system_config');
}
