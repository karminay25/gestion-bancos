-- Tabla para almacenar tokens y configuraciones del sistema
CREATE TABLE IF NOT EXISTS sistema_config (
  id TEXT PRIMARY KEY, -- ej: 'microsoft_auth'
  data JSONB NOT NULL,  -- contendrá access_token, refresh_token, expiry, etc.
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
