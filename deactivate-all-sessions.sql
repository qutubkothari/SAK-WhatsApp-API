UPDATE sessions SET is_active = false, status = 'disconnected' WHERE is_active = true;
