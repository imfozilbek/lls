-- «Platforma»: the admin lists shops by status, newest first.
CREATE INDEX IF NOT EXISTS idx_businesses_status_created ON businesses (status, created_at);
