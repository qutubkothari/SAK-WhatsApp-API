import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Users table
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email').notNullable().unique();
    table.string('password_hash').notNullable();
    table.string('full_name').notNullable();
    table.string('company_name');
    table.enum('plan', ['free', 'starter', 'pro', 'enterprise']).defaultTo('free');
    table.string('stripe_customer_id');
    table.string('stripe_subscription_id');
    table.timestamp('subscription_ends_at');
    table.boolean('is_active').defaultTo(true);
    table.boolean('email_verified').defaultTo(false);
    table.string('verification_token');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // WhatsApp Sessions table
  await knex.schema.createTable('sessions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('session_id').notNullable().unique();
    table.string('name').notNullable();
    table.string('phone_number');
    table.string('api_key').notNullable().unique();
    table.enum('status', ['pending', 'connected', 'disconnected', 'error']).defaultTo('pending');
    table.string('qr_code');
    table.timestamp('last_connected_at');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // Messages table (for logging and analytics)
  await knex.schema.createTable('messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('session_id').notNullable().references('id').inTable('sessions').onDelete('CASCADE');
    table.string('message_id');
    table.string('to_number').notNullable();
    table.enum('type', ['text', 'image', 'document', 'video', 'audio']).notNullable();
    table.text('content');
    table.enum('status', ['queued', 'sent', 'delivered', 'failed']).defaultTo('queued');
    table.string('error_message');
    table.integer('retry_count').defaultTo(0);
    table.timestamp('sent_at');
    table.timestamp('delivered_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Webhooks table
  await knex.schema.createTable('webhooks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('session_id').notNullable().references('id').inTable('sessions').onDelete('CASCADE');
    table.string('url').notNullable();
    table.string('secret');
    table.specificType('events', 'text[]').notNullable();
    table.boolean('is_active').defaultTo(true);
    table.integer('failed_attempts').defaultTo(0);
    table.timestamp('last_success_at');
    table.timestamp('last_failure_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // API Keys table (for multiple keys per user)
  await knex.schema.createTable('api_keys', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('key_hash').notNullable().unique();
    table.string('name').notNullable();
    table.string('last_four').notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('last_used_at');
    table.timestamp('expires_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Usage Stats table (for analytics)
  await knex.schema.createTable('usage_stats', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('session_id').references('id').inTable('sessions').onDelete('CASCADE');
    table.date('date').notNullable();
    table.integer('messages_sent').defaultTo(0);
    table.integer('messages_received').defaultTo(0);
    table.integer('messages_failed').defaultTo(0);
    table.integer('api_calls').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.unique(['user_id', 'session_id', 'date']);
  });

  // Invoices table
  await knex.schema.createTable('invoices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('stripe_invoice_id').unique();
    table.decimal('amount', 10, 2).notNullable();
    table.string('currency').defaultTo('usd');
    table.enum('status', ['pending', 'paid', 'failed', 'refunded']).defaultTo('pending');
    table.string('pdf_url');
    table.timestamp('paid_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Activity Logs table
  await knex.schema.createTable('activity_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('session_id').references('id').inTable('sessions').onDelete('CASCADE');
    table.string('action').notNullable();
    table.jsonb('metadata');
    table.string('ip_address');
    table.string('user_agent');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Create indexes for better performance
  await knex.schema.raw('CREATE INDEX idx_messages_session_created ON messages(session_id, created_at DESC)');
  await knex.schema.raw('CREATE INDEX idx_messages_status ON messages(status)');
  await knex.schema.raw('CREATE INDEX idx_usage_stats_date ON usage_stats(date DESC)');
  await knex.schema.raw('CREATE INDEX idx_activity_logs_user ON activity_logs(user_id, created_at DESC)');
  await knex.schema.raw('CREATE INDEX idx_sessions_user ON sessions(user_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('activity_logs');
  await knex.schema.dropTableIfExists('invoices');
  await knex.schema.dropTableIfExists('usage_stats');
  await knex.schema.dropTableIfExists('api_keys');
  await knex.schema.dropTableIfExists('webhooks');
  await knex.schema.dropTableIfExists('messages');
  await knex.schema.dropTableIfExists('sessions');
  await knex.schema.dropTableIfExists('users');
}
