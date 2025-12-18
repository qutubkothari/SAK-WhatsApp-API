#!/usr/bin/env node
const knex = require('knex');
require('dotenv').config();

const db = knex({
  client: 'postgresql',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'sak_whatsapp_api'
  },
  migrations: {
    directory: './dist/database/migrations',
    loadExtensions: ['.js']
  }
});

async function runMigrations() {
  try {
    console.log('🔄 Running migrations...');
    const [batchNo, log] = await db.migrate.latest();
    
    if (log.length === 0) {
      console.log('✅ Database is already up to date');
    } else {
      console.log(`✅ Batch ${batchNo} run: ${log.length} migrations`);
      log.forEach(file => console.log(`  - ${file}`));
    }
    
    await db.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await db.destroy();
    process.exit(1);
  }
}

runMigrations();
