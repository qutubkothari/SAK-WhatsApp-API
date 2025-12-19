import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add auto-reply fields to sessions table
  await knex.schema.table('sessions', (table: any) => {
    table.boolean('auto_reply_enabled').defaultTo(false);
    table.text('auto_reply_message').defaultTo('Thank you for your message! We will get back to you soon.');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('sessions', (table: any) => {
    table.dropColumn('auto_reply_enabled');
    table.dropColumn('auto_reply_message');
  });
}
