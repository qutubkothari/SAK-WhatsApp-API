import knex from 'knex';
import dotenv from 'dotenv';

dotenv.config();

export const db = knex({
  client: 'postgresql',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'sak_whatsapp_api',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  },
  pool: {
    min: 2,
    max: 10
  }
});

// Test connection
db.raw('SELECT 1')
  .then(() => {
    console.log('✅ Database connected successfully');
  })
  .catch((error) => {
    console.error('❌ Database connection failed:', error);
    console.warn('⚠️  Server will continue but database operations will fail');
    console.warn('⚠️  Please check your .env file DB_HOST setting');
  });

export default db;
