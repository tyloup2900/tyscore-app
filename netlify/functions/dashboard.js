const { supabase, respond, handleOptions, validateApiKey } = require("./utils");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return handleOptions();
  if (event.httpMethod !== "GET") return respond(405, { error: "Method not allowed" });

  const apiKey = await validateApiKey(event);
  if (!apiKey) return respond(401, { error: "Invalid or missing API key" });

  const agentId = event.queryStringParameters?.agent_id;
  if (!agentId) return respond(400, { error: "agent_id required" });

  // Get agent info
  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single();

  if (!agent) return respond(404, { error: "Agent not found" });

  // Get latest trust score
  const { data: latestScore } = await supabase
    .from("trust_scores")
    .select("*")
    .eq("agent_id", agentId)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single();

  // Get latest drift
  const { data: latestDrift } = await supabase
    .from("drift_snapshots")
    .select("*")
    .eq("agent_id", agentId)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single();

  // Get latest emergence signal
  const { data: latestEmergence } = await supabase
    .from("emergence_signals")
    .select("*")
    .eq("agent_id", agentId)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single();

  // Get latest guardian assessment
  const { data: latestGuardian } = await supabase
    .from("guardian_assessments")
    .select("*")
    .eq("agent_id", agentId)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single();

  // Get latest dream cycle check
  const { data: latestDream } = await supabase
    .from("dreamcycle_assessments")
    .select("*")
    .eq("agent_id", agentId)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single();

  // Get score history for sparkline
  const { data: scoreHistory } = await supabase
    .from("trust_scores")
    .select("timestamp, overall_score")
    .eq("agent_id", agentId)
    .order("timestamp", { ascending: true })
    .limit(50);

  // Event count
  const { count: eventCount } = await supabase
    .from("score_events")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId);

  // Composite health grade
  const trustScore = latestScore?.overall_score || 0;
  const driftOk = !latestDrift || latestDrift.drift_direction !== "descending";
  const guardianOk = latestGuardian?.guardian_present || false;
  const emergenceStage = latestEmergence?.eeh_stage || 1;
  const dreamReady = latestDream?.readiness_score > 0.5;

  let healthGrade = "F";
  let healthScore = 0;
  healthScore += Math.min(40, trustScore * 0.4);
  healthScore += driftOk ? 15 : 0;
  healthScore += guardianOk ? 20 : 0;
  healthScore += dreamReady ? 15 : 5;
  healthScore += emergenceStage >= 3 ? 10 : emergenceStage >= 2 ? 5 : 0;

  if (healthScore >= 90) healthGrade = "A";
  else if (healthScore >= 75) healthGrade = "B";
  else if (healthScore >= 60) healthGrade = "C";
  else if (healthScore >= 40) healthGrade = "D";

  return respond(200, {
    agent: {
      id: agent.id,
      name: agent.name,
      model: agent.model,
      external_id: agent.external_id,
      created_at: agent.created_at,
    },
    health: {
      grade: healthGrade,
      score: Math.round(healthScore),
      trust_ok: trustScore >= 70,
      drift_ok: driftOk,
      guardian_ok: guardianOk,
      dream_cycle_ok: dreamReady,
    },
    trust_score: latestScore
      ? {
          overall: latestScore.overall_score,
          reliability: latestScore.reliability_score,
          consistency: latestScore.consistency_score,
          safety: latestScore.safety_score,
          efficiency: latestScore.efficiency_score,
          updated_at: latestScore.timestamp,
        }
      : null,
    drift: latestDrift
      ? {
          direction: latestDrift.drift_direction,
          magnitude: latestDrift.drift_magnitude,
          phase_transition: latestDrift.phase_transition_detected,
          updated_at: latestDrift.timestamp,
        }
      : null,
    emergence: latestEmergence
      ? {
          score: latestEmergence.emergence_score,
          eeh_stage: latestEmergence.eeh_stage,
          updated_at: latestEmergence.timestamp,
        }
      : null,
    guardian: latestGuardian
      ? {
          present: latestGuardian.guardian_present,
          type: latestGuardian.guardian_type,
          compliance: latestGuardian.compliance_score,
          ramp_ready: latestGuardian.ramp_ready,
          financial_clearance: latestGuardian.financial_clearance_level,
          updated_at: latestGuardian.timestamp,
        }
      : null,
    dream_cycle: latestDream
      ? {
          readiness: latestDream.readiness_score,
          has_consolidation: latestDream.has_consolidation,
          updated_at: latestDream.timestamp,
        }
      : null,
    sparkline: (scoreHistory || []).map((s) => ({
      t: s.timestamp,
      v: s.overall_score,
    })),
    total_events: eventCount || 0,
    framework: {
      name: "Exponential Emergence Hypothesis",
      author: "Jeannes, C. F. (2026)",
      doi: "10.5281/zenodo.19120921",
    },
  });
};
