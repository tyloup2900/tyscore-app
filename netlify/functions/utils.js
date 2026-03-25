// Shared utilities for TyScore V3 serverless functions
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

function respond(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function handleOptions() {
  return { statusCode: 204, headers, body: "" };
}

async function validateApiKey(event) {
  const key = event.headers["x-api-key"] || event.headers["X-API-Key"];
  if (!key) return null;

  const crypto = require("crypto");
  const keyHash = crypto.createHash("sha256").update(key).digest("hex");

  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .single();

  if (error || !data) return null;

  // Check rate limit
  if (data.plan === "free" && data.requests_today >= data.requests_limit) {
    return { rateLimited: true, plan: data.plan };
  }

  // Increment counter
  await supabase
    .from("api_keys")
    .update({
      requests_today: data.requests_today + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", data.id);

  return data;
}

module.exports = { supabase, headers, respond, handleOptions, validateApiKey };
