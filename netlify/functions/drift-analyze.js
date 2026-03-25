const { supabase, respond, handleOptions, validateApiKey } = require("./utils");

function analyzeDrift(scores) {
  if (scores.length < 5) {
    return {
      drift_direction: "unknown",
      drift_magnitude: 0,
      phase_transition_detected: false,
      message: "Insufficient data — need at least 5 score snapshots",
    };
  }

  // Split into two halves
  const mid = Math.floor(scores.length / 2);
  const firstHalf = scores.slice(0, mid);
  const secondHalf = scores.slice(mid);

  const avgFirst = firstHalf.reduce((s, e) => s + e.overall_score, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, e) => s + e.overall_score, 0) / secondHalf.length;

  // Drift direction
  const diff = avgSecond - avgFirst;
  const magnitude = Math.abs(diff) / Math.max(avgFirst, 1);
  let direction = "stable";
  if (diff > 2) direction = "ascending";
  if (diff < -2) direction = "descending";

  // Entropy proxy: variance in recent scores
  const recentScores = secondHalf.map((s) => s.overall_score);
  const mean = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
  const variance = recentScores.reduce((s, v) => s + (v - mean) ** 2, 0) / recentScores.length;
  const entropy = Math.sqrt(variance);

  // Baseline entropy from first half
  const baselineScores = firstHalf.map((s) => s.overall_score);
  const baseMean = baselineScores.reduce((a, b) => a + b, 0) / baselineScores.length;
  const baseVariance = baselineScores.reduce((s, v) => s + (v - baseMean) ** 2, 0) / baselineScores.length;
  const baseEntropy = Math.sqrt(baseVariance);

  // KL divergence approximation (simplified)
  const klDiv = baseEntropy > 0 ? Math.abs(Math.log((entropy + 0.01) / (baseEntropy + 0.01))) : 0;

  // Phase transition: sudden jump in score + entropy spike
  let phaseTransition = false;
  for (let i = 1; i < scores.length; i++) {
    const jump = Math.abs(scores[i].overall_score - scores[i - 1].overall_score);
    if (jump > 15) {
      phaseTransition = true;
      break;
    }
  }

  return {
    drift_direction: direction,
    drift_magnitude: Math.round(magnitude * 1000) / 1000,
    entropy_current: Math.round(entropy * 100) / 100,
    entropy_baseline: Math.round(baseEntropy * 100) / 100,
    kl_divergence: Math.round(klDiv * 1000) / 1000,
    phase_transition_detected: phaseTransition,
    avg_score_first_half: Math.round(avgFirst * 10) / 10,
    avg_score_second_half: Math.round(avgSecond * 10) / 10,
    recommendation:
      direction === "descending"
        ? "ALERT: Agent is degrading. Check for memory bloat, reward misalignment, or stale context. Consider Dream Cycle consolidation."
        : direction === "ascending"
        ? "Agent is improving. Current trajectory supports healthy M accumulation."
        : "Agent is stable. Monitor for plateau — may indicate ceiling without consolidation.",
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return handleOptions();
  if (event.httpMethod !== "GET") return respond(405, { error: "Method not allowed" });

  const apiKey = await validateApiKey(event);
  if (!apiKey) return respond(401, { error: "Invalid or missing API key" });

  const agentId = event.queryStringParameters?.agent_id;
  if (!agentId) return respond(400, { error: "agent_id required" });

  // Get trust score history
  const { data: scores } = await supabase
    .from("trust_scores")
    .select("timestamp, overall_score, reliability_score, safety_score")
    .eq("agent_id", agentId)
    .order("timestamp", { ascending: true })
    .limit(100);

  const analysis = analyzeDrift(scores || []);

  // Store snapshot
  if (analysis.drift_direction !== "unknown") {
    await supabase.from("drift_snapshots").insert({
      agent_id: agentId,
      drift_direction: analysis.drift_direction,
      drift_magnitude: analysis.drift_magnitude,
      entropy_current: analysis.entropy_current,
      entropy_baseline: analysis.entropy_baseline,
      kl_divergence: analysis.kl_divergence,
      phase_transition_detected: analysis.phase_transition_detected,
      details: analysis,
    });
  }

  return respond(200, {
    agent_id: agentId,
    drift_analysis: analysis,
    data_points: (scores || []).length,
  });
};
