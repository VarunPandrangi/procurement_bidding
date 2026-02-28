import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('suppliers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('company_name', 255).notNullable();
    table.string('contact_name', 255);
    table.string('contact_email', 255);
    table.specificType('unique_code', 'CHAR(5)').unique().notNullable();
    table.specificType('category_tags', 'TEXT[]');
    table.decimal('credibility_score', 5, 2).defaultTo(50.0);
    table.string('credibility_class', 20).defaultTo('STABLE');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE suppliers ADD CONSTRAINT suppliers_credibility_class_check
    CHECK (credibility_class IN ('EXCELLENT', 'STABLE', 'RISKY'))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('suppliers');
}
