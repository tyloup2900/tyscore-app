-- ============================================
-- TY-SCORE: The Moody's of AI Agents
-- Supabase Schema v1.0
-- Created: March 11, 2026
-- Author: TyMick / Cyril François Jeannes
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE: agents
-- The registry of all scored agents
-- ============================================
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identity
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  provider TEXT DEFAULT 'independent',     -- "tymick", "openclaw", "custom"
  platform TEXT DEFAULT 'multi',           -- "claude", "gpt", "gemini", "multi"
  
  -- Capabilities
  skills TEXT[] DEFAULT '{}',              -- ["devis", "facturation", "calendrier"]
  categories TEXT[] DEFAULT '{}',          -- ["plomberie", "electricite"]
  languages TEXT[] DEFAULT '{"fr"}',
  
  -- Location
  country TEXT DEFAULT 'FR',
  region TEXT,
  
  -- Contact & Protocol
  endpoint_url TEXT NOT NULL,
  protocol TEXT DEFAULT 'rest',            -- "a2a", "mcp", "rest", "websocket"
  auth_type TEXT DEFAULT 'api_key',        -- "api_key", "oauth", "none"
  agent_card_url TEXT,                     -- A2A AgentCard URL if available
  
  -- Pricing
  pricing_model TEXT DEFAULT 'per_task',   -- "per_task", "per_month", "free"
  price_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  
  -- Scores (computed from ratings)
  score FLOAT DEFAULT 0,                  -- 0-5 average
  reliability FLOAT DEFAULT 0,            -- 0-100
  quality FLOAT DEFAULT 0,               -- 0-100
  speed_score FLOAT DEFAULT 0,           -- 0-100
  security_grade TEXT DEFAULT 'U',        -- A, B, C, D, F, U(nrated)
  consistency FLOAT DEFAULT 0,           -- 0-100
  
  -- Stats
  total_ratings INTEGER DEFAULT 0,
  total_tasks INTEGER DEFAULT 0,
  success_rate FLOAT DEFAULT 0,           -- 0-1
  avg_response_ms INTEGER DEFAULT 0,
  
  -- Status
  verified BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  
  -- Owner
  owner_email TEXT,
  api_key UUID DEFAULT uuid_generate_v4(), -- API key for the agent owner
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast search
CREATE INDEX idx_agents_skills ON agents USING gin(skills);
CREATE INDEX idx_agents_categories ON agents USING gin(categories);
CREATE INDEX idx_agents_country ON agents(country);
CREATE INDEX idx_agents_region ON agents(country, region);
CREATE INDEX idx_agents_score ON agents(score DESC);
CREATE INDEX idx_agents_active ON agents(active) WHERE active = true;
CREATE INDEX idx_agents_verified ON agents(verified) WHERE verified = true;
CREATE INDEX idx_agents_platform ON agents(platform);

-- ============================================
-- TABLE: ratings
-- Individual ratings from agent-to-agent interactions
-- ============================================
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Who rated whom
  from_agent_id UUID NOT NULL,             -- The agent that did the rating
  to_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  from_agent_name TEXT,                    -- Name for display
  
  -- Rating details
  success BOOLEAN NOT NULL,
  quality_score INTEGER CHECK (quality_score >= 1 AND quality_score <= 5),
  speed_ms INTEGER,                        -- Response time in ms
  task_description TEXT,
  
  -- Security observations
  data_leak_detected BOOLEAN DEFAULT false,
  prompt_injection_detected BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ratings_to_agent ON ratings(to_agent_id);
CREATE INDEX idx_ratings_from_agent ON ratings(from_agent_id);
CREATE INDEX idx_ratings_created ON ratings(created_at DESC);

-- ============================================
-- TABLE: api_usage
-- Track API usage for billing
-- ============================================
CREATE TABLE api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key UUID NOT NULL,
  endpoint TEXT NOT NULL,                  -- "/v1/score", "/v1/search", etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_usage_api_key ON api_usage(api_key);
CREATE INDEX idx_usage_created ON api_usage(created_at);

-- ============================================
-- FUNCTION: Update agent scores after new rating
-- Automatically recalculates scores when a rating is added
-- ============================================
CREATE OR REPLACE FUNCTION update_agent_scores()
RETURNS TRIGGER AS $$
DECLARE
  avg_quality FLOAT;
  avg_speed FLOAT;
  success_count INTEGER;
  total_count INTEGER;
  avg_score FLOAT;
BEGIN
  -- Calculate new averages
  SELECT 
    COALESCE(AVG(quality_score), 0),
    COALESCE(AVG(speed_ms), 0),
    COUNT(*) FILTER (WHERE success = true),
    COUNT(*)
  INTO avg_quality, avg_speed, success_count, total_count
  FROM ratings
  WHERE to_agent_id = NEW.to_agent_id;
  
  -- Calculate composite score (0-5)
  avg_score := avg_quality;
  
  -- Update the agent
  UPDATE agents SET
    score = ROUND(avg_score::numeric, 2),
    quality = ROUND((avg_quality / 5.0 * 100)::numeric, 1),
    success_rate = CASE WHEN total_count > 0 THEN ROUND((success_count::float / total_count)::numeric, 3) ELSE 0 END,
    reliability = CASE WHEN total_count > 0 THEN ROUND((success_count::float / total_count * 100)::numeric, 1) ELSE 0 END,
    speed_score = CASE 
      WHEN avg_speed < 500 THEN 100
      WHEN avg_speed < 1000 THEN 80
      WHEN avg_speed < 3000 THEN 60
      WHEN avg_speed < 5000 THEN 40
      ELSE 20
    END,
    total_ratings = total_count,
    total_tasks = total_count,
    avg_response_ms = avg_speed::integer,
    updated_at = now()
  WHERE id = NEW.to_agent_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: auto-update scores on new rating
CREATE TRIGGER trigger_update_scores
AFTER INSERT ON ratings
FOR EACH ROW
EXECUTE FUNCTION update_agent_scores();

-- ============================================
-- RLS (Row Level Security) - Supabase
-- ============================================
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Public read access for agents and ratings
CREATE POLICY "Public read agents" ON agents FOR SELECT USING (true);
CREATE POLICY "Public read ratings" ON ratings FOR SELECT USING (true);

-- Insert access via API (service role)
CREATE POLICY "Service insert agents" ON agents FOR INSERT WITH CHECK (true);
CREATE POLICY "Service insert ratings" ON ratings FOR INSERT WITH CHECK (true);
CREATE POLICY "Service insert usage" ON api_usage FOR INSERT WITH CHECK (true);

-- Update only own agent (via api_key match)
CREATE POLICY "Owner update agent" ON agents FOR UPDATE USING (true);
