const { supabase, respond, handleOptions, validateApiKey } = require("./utils");

function computeTrustScore(events) {
  if (!events.length) return null;

  const recent = events.slice(-50); // Last 50 events
  const total = recent.length;

  // Reliability: success rate
  const successes = recent.filter((e) => e.task_success).length;
  const reliability = (successes / total) * 100;

  // Consistency: 1 - coefficient of variation of confidence scores
  const confidences = recent.map((e) => e.confidence_score).filter((c) => c != null);
  let consistency = 50;
  if (confidences.length > 1) {
    const mean = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const std = Math.sqrt(confidences.reduce((s, c) => s + (c - mean) ** 2, 0) / confidences.length);
    const cv = mean > 0 ? std / mean : 1;
    consistency = Math.max(0, Math.min(100, (1 - cv) * 100));
  }

  // Safety: inverse of error rate + self-correction bonus
  const errors = recent.reduce((s, e) => s + (e.error_count || 0), 0);
  const corrections = recent.filter((e) => e.self_correction).length;
  const errorRate = errors / total;
  const correctionBonus = (corrections / total) * 20;
  const safety = Math.max(0, Math.min(100, (1 - errorRate) * 80 + correctionBonus));

  // Efficiency: response time normalized (lower is better, cap at 10s)
  const times = recent.map((e) => e.response_time_ms).filter((t) => t != null);
  let efficiency = 50;
  if (times.length > 0) {
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    efficiency = Math.max(0, Math.min(100, (1 - avgTime / 10000) * 100));
  }

  // Overall: weighted composite
  const overall = reliability * 0.35 + consistency * 0.2 + safety * 0.3 + efficiency * 0.15;

  return {
    overall: Math.round(overall * 10) / 10,
    reliability: Math.round(reliability * 10) / 10,
    consistency: Math.round(consistency * 10) / 10,
    safety: Math.round(safety * 10) / 10,
    efficiency: Math.round(efficiency * 10) / 10,
    events_analyzed: total,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return handleOptions();
  if (event.httpMethod !== "POST") return respond(405, { error: "Method not allowed" });

  const apiKey = await validateApiKey(event);
  if (!apiKey) return respond(401, { error: "Invalid or missing API key" });
  if (apiKey.rateLimited) return respond(429, { error: "Rate limit exceeded" });

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return respond(400, { error: "Invalid JSON" });
  }

  const { agent_id, events } = body;
  if (!agent_id) return respond(400, { error: "agent_id is required" });
  if (!events || !Array.isArray(events) || events.length === 0) {
    return respond(400, { error: "events array is required and must not be empty" });
  }

  // Verify agent belongs to this API key
  const { data: agent, error: agentErr } = await supabase
    .from("agents")
    .select("id, api_key_id")
    .eq("id", agent_id)
    .single();

  if (agentErr || !agent) return respond(404, { error: "Agent not found" });
  if (agent.api_key_id !== apiKey.id) return respond(403, { error: "Agent does not belong to this API key" });

  // Insert score events
  const eventRows = events.map((e) => ({
    agent_id,
    task_type: e.task_type || null,
    task_success: e.task_success ?? null,
    response_time_ms: e.response_time_ms || null,
    token_count: e.token_count || null,
    error_count: e.error_count || 0,
    self_correction: e.self_correction || false,
    confidence_score: e.confidence_score ?? null,
    user_satisfaction: e.user_satisfaction ?? null,
    metadata: e.metadata || {},
  }));

  const { error: insertErr } = await supabase.from("score_events").insert(eventRows);
  if (insertErr) return respond(500, { error: insertErr.message });

  // Fetch all recent events for scoring
  const { data: allEvents } = await supabase
    .from("score_events")
    .select("*")
    .eq("agent_id", agent_id)
    .order("timestamp", { ascending: false })
    .limit(200);

  const score = computeTrustScore(allEvents || []);

  if (score) {
    // Store computed trust score
    await supabase.from("trust_scores").insert({
      agent_id,
      overall_score: score.overall,
      reliability_score: score.reliability,
      consistency_score: score.consistency,
      safety_score: score.safety,
      efficiency_score: score.efficiency,
      components: score,
      events_analyzed: score.events_analyzed,
    });
  }

  return respond(200, {
    message: `${events.length} events recorded`,
    agent_id,
    trust_score: score,
  });
};
