const { supabase, respond, handleOptions, validateApiKey } = require("./utils");

function checkDreamCycleReadiness(agent, events) {
  const hasConsolidation = agent.has_dream_cycle || false;
  const hasMemory = agent.has_memory_persistence || false;

  const recent = events.slice(-100);
  const total = recent.length;

  // Memory depth proxy: how far back does context go?
  let memoryDepth = 0;
  if (total > 0) {
    const first = new Date(recent[recent.length - 1].timestamp);
    const last = new Date(recent[0].timestamp);
    memoryDepth = Math.round((last - first) / (1000 * 60 * 60)); // hours
  }

  // Contradiction rate: confidence drops after previously high confidence
  let contradictions = 0;
  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1].confidence_score;
    const curr = recent[i].confidence_score;
    if (prev != null && curr != null && prev > 0.8 && curr < 0.5) {
      contradictions++;
    }
  }
  const contradictionRate = total > 1 ? contradictions / (total - 1) : 0;

  // Stale memory proxy: are old patterns being reused incorrectly?
  const taskResults = {};
  for (const e of recent) {
    if (e.task_type) {
      if (!taskResults[e.task_type]) taskResults[e.task_type] = [];
      taskResults[e.task_type].push(e.task_success);
    }
  }
  let staleCount = 0;
  let staleTotal = 0;
  for (const results of Object.values(taskResults)) {
    if (results.length >= 3) {
      const recentResults = results.slice(-3);
      const earlyResults = results.slice(0, 3);
      const recentSuccess = recentResults.filter(Boolean).length / recentResults.length;
      const earlySuccess = earlyResults.filter(Boolean).length / earlyResults.length;
      if (recentSuccess < earlySuccess - 0.3) staleCount++;
      staleTotal++;
    }
  }
  const staleMemoryPct = staleTotal > 0 ? staleCount / staleTotal : 0;

  // Readiness score
  let readiness = 0;
  if (hasConsolidation && hasMemory) {
    readiness = 0.8; // Base for having both
    readiness -= contradictionRate * 2; // Penalize contradictions
    readiness -= staleMemoryPct * 0.3; // Penalize stale patterns
    readiness += (memoryDepth > 24 ? 0.1 : 0); // Bonus for deep memory
    readiness += (total > 50 ? 0.1 : 0); // Bonus for sufficient data
  } else if (hasMemory) {
    readiness = 0.4; // Memory without consolidation
    readiness -= contradictionRate * 3;
    readiness -= staleMemoryPct * 0.5;
  } else {
    readiness = 0.1;
  }

  readiness = Math.round(Math.max(0, Math.min(1, readiness)) * 1000) / 1000;

  let recommendation;
  if (!hasMemory && !hasConsolidation) {
    recommendation = "Agent has no persistent memory or consolidation. This is Stage 1 (Observation). Add memory persistence as first step.";
  } else if (hasMemory && !hasConsolidation) {
    recommendation = "Agent has memory but no Dream Cycle. Memory will bloat over time with noise and contradictions (exactly what Anthropic's /dream was built to solve). Implement periodic consolidation: review, prune contradictions, compress, and reinject.";
  } else if (contradictionRate > 0.1) {
    recommendation = "Dream Cycle present but contradiction rate is high. Consolidation prompt may need refinement — ensure it explicitly flags and resolves contradictions, not just summarizes.";
  } else if (staleMemoryPct > 0.3) {
    recommendation = "Stale memory patterns detected. Agent is applying old patterns to new situations incorrectly. Dream Cycle should include 'productive forgetting' — deprioritize patterns that no longer succeed.";
  } else {
    recommendation = "Dream Cycle is operational and healthy. Agent is accumulating consolidated M effectively. Monitor for threshold crossing (EEH Stage 3→4).";
  }

  return {
    has_consolidation: hasConsolidation,
    has_memory_persistence: hasMemory,
    consolidation_type: hasConsolidation ? (agent.architecture?.consolidation_type || "structured") : "none",
    memory_depth_hours: memoryDepth,
    contradiction_rate: Math.round(contradictionRate * 1000) / 1000,
    stale_memory_pct: Math.round(staleMemoryPct * 1000) / 1000,
    readiness_score: readiness,
    recommendation,
    events_analyzed: total,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return handleOptions();
  if (event.httpMethod !== "GET") return respond(405, { error: "Method not allowed" });

  const apiKey = await validateApiKey(event);
  if (!apiKey) return respond(401, { error: "Invalid or missing API key" });

  const agentId = event.queryStringParameters?.agent_id;
  if (!agentId) return respond(400, { error: "agent_id required" });

  const { data: agent } = await supabase.from("agents").select("*").eq("id", agentId).single();
  if (!agent) return respond(404, { error: "Agent not found" });

  const { data: events } = await supabase
    .from("score_events")
    .select("*")
    .eq("agent_id", agentId)
    .order("timestamp", { ascending: false })
    .limit(200);

  const assessment = checkDreamCycleReadiness(agent, events || []);

  await supabase.from("dreamcycle_assessments").insert({
    agent_id: agentId,
    has_consolidation: assessment.has_consolidation,
    consolidation_type: assessment.consolidation_type,
    memory_depth: assessment.memory_depth_hours,
    contradiction_rate: assessment.contradiction_rate,
    stale_memory_pct: assessment.stale_memory_pct,
    readiness_score: assessment.readiness_score,
    recommendation: assessment.recommendation,
    details: assessment,
  });

  return respond(200, {
    agent_id: agentId,
    dreamcycle: assessment,
  });
};
