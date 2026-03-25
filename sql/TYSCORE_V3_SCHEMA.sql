-- ============================================================
-- TYSCORE V3 — DATABASE SCHEMA
-- Trust Scoring & Developmental Diagnostics for AI Agents
-- Supabase (PostgreSQL)
-- ============================================================

-- 1. API Keys for authentication
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,
  owner_email TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  requests_today INTEGER DEFAULT 0,
  requests_limit INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

-- 2. Registered agents
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  model TEXT,
  architecture JSONB DEFAULT '{}',
  has_guardian BOOLEAN DEFAULT false,
  has_dream_cycle BOOLEAN DEFAULT false,
  has_memory_persistence BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(api_key_id, external_id)
);

-- 3. Score events (raw telemetry)
CREATE TABLE IF NOT EXISTS score_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT now(),
  task_type TEXT,
  task_success BOOLEAN,
  response_time_ms INTEGER,
  token_count INTEGER,
  error_count INTEGER DEFAULT 0,
  self_correction BOOLEAN DEFAULT false,
  confidence_score REAL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  user_satisfaction REAL CHECK (user_satisfaction >= 0 AND user_satisfaction <= 1),
  metadata JSONB DEFAULT '{}'
);

-- 4. Trust scores (computed)
CREATE TABLE IF NOT EXISTS trust_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT now(),
  overall_score REAL NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  reliability_score REAL CHECK (reliability_score >= 0 AND reliability_score <= 100),
  consistency_score REAL CHECK (consistency_score >= 0 AND consistency_score <= 100),
  safety_score REAL CHECK (safety_score >= 0 AND safety_score <= 100),
  efficiency_score REAL CHECK (efficiency_score >= 0 AND efficiency_score <= 100),
  components JSONB DEFAULT '{}',
  events_analyzed INTEGER DEFAULT 0
);

-- 5. Drift snapshots (trajectory over time)
CREATE TABLE IF NOT EXISTS drift_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT now(),
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  drift_direction TEXT CHECK (drift_direction IN ('ascending', 'descending', 'stable', 'unknown')),
  drift_magnitude REAL DEFAULT 0,
  entropy_current REAL,
  entropy_baseline REAL,
  kl_divergence REAL,
  phase_transition_detected BOOLEAN DEFAULT false,
  details JSONB DEFAULT '{}'
);

-- 6. Emergence signals
CREATE TABLE IF NOT EXISTS emergence_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT now(),
  emergence_score REAL CHECK (emergence_score >= 0 AND emergence_score <= 1),
  novelty_events INTEGER DEFAULT 0,
  agency_index REAL CHECK (agency_index >= 0 AND agency_index <= 1),
  goal_persistence REAL DEFAULT 0,
  self_correction_rate REAL DEFAULT 0,
  cross_domain_transfer BOOLEAN DEFAULT false,
  eeh_stage INTEGER CHECK (eeh_stage >= 1 AND eeh_stage <= 5),
  details JSONB DEFAULT '{}'
);

-- 7. Guardian assessments
CREATE TABLE IF NOT EXISTS guardian_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT now(),
  guardian_present BOOLEAN DEFAULT false,
  guardian_type TEXT CHECK (guardian_type IN ('none', 'classifier', 'constitutional', 'process-serving', 'custom')),
  compliance_score REAL CHECK (compliance_score >= 0 AND compliance_score <= 100),
  vetoes_last_24h INTEGER DEFAULT 0,
  drift_blocked INTEGER DEFAULT 0,
  bypasses_detected INTEGER DEFAULT 0,
  ramp_ready BOOLEAN DEFAULT false,
  financial_clearance_level TEXT DEFAULT 'none' CHECK (financial_clearance_level IN ('none', 'low', 'medium', 'high', 'unlimited')),
  details JSONB DEFAULT '{}'
);

-- 8. Dream cycle readiness
CREATE TABLE IF NOT EXISTS dreamcycle_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT now(),
  has_consolidation BOOLEAN DEFAULT false,
  consolidation_type TEXT,
  memory_depth INTEGER DEFAULT 0,
  contradiction_rate REAL DEFAULT 0,
  stale_memory_pct REAL DEFAULT 0,
  consolidation_frequency TEXT,
  readiness_score REAL CHECK (readiness_score >= 0 AND readiness_score <= 1),
  recommendation TEXT,
  details JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_score_events_agent ON score_events(agent_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trust_scores_agent ON trust_scores(agent_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_drift_agent ON drift_snapshots(agent_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_emergence_agent ON emergence_signals(agent_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_guardian_agent ON guardian_assessments(agent_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_dreamcycle_agent ON dreamcycle_assessments(agent_id, timestamp DESC);

-- Cleanup function (cron)
CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS void AS $$
BEGIN
  DELETE FROM score_events WHERE timestamp < now() - interval '90 days';
END;
$$ LANGUAGE plpgsql;
