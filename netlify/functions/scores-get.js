const { supabase, respond, handleOptions, validateApiKey } = require("./utils");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return handleOptions();
  if (event.httpMethod !== "GET") return respond(405, { error: "Method not allowed" });

  const apiKey = await validateApiKey(event);
  if (!apiKey) return respond(401, { error: "Invalid or missing API key" });

  const agentId = event.queryStringParameters?.agent_id;
  if (!agentId) return respond(400, { error: "agent_id query parameter is required" });

  // Get latest trust score
  const { data: latest } = await supabase
    .from("trust_scores")
    .select("*")
    .eq("agent_id", agentId)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single();

  // Get score history (last 30 entries)
  const { data: history } = await supabase
    .from("trust_scores")
    .select("timestamp, overall_score, reliability_score, consistency_score, safety_score, efficiency_score")
    .eq("agent_id", agentId)
    .order("timestamp", { ascending: false })
    .limit(30);

  // Get event count
  const { count } = await supabase
    .from("score_events")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId);

  return respond(200, {
    agent_id: agentId,
    current_score: latest || null,
    total_events: count || 0,
    history: (history || []).reverse(),
  });
};
