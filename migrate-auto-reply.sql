ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auto_reply_enabled BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auto_reply_message TEXT DEFAULT 'Thank you for your message! We will get back to you soon.';
