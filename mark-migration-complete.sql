INSERT INTO knex_migrations (name, batch, migration_time) 
VALUES ('003_add_auto_reply.ts', 1, NOW()) 
ON CONFLICT DO NOTHING;
