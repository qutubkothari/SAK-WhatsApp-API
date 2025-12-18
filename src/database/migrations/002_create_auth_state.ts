import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('auth_state', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('session_id').notNullable();
    table.string('key', 500).notNullable();
    table.text('value').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Composite unique constraint on session_id + key
    table.unique(['session_id', 'key']);
    
    // Foreign key to sessions table
    table.foreign('session_id').references('id').inTable('sessions').onDelete('CASCADE');
    
    // Index for fast lookups
    table.index(['session_id', 'key']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('auth_state');
}
