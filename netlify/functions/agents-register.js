const { supabase, respond, handleOptions, validateApiKey } = require("./utils");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return handleOptions();
  if (event.httpMethod !== "POST") return respond(405, { error: "Method not allowed" });

  const apiKey = await validateApiKey(event);
  if (!apiKey) return respond(401, { error: "Invalid or missing API key" });
  if (apiKey.rateLimited) return respond(429, { error: "Rate limit exceeded", plan: apiKey.plan });

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return respond(400, { error: "Invalid JSON" });
  }

  const { external_id, name, model, architecture, has_guardian, has_dream_cycle, has_memory_persistence, metadata } = body;
  if (!external_id || !name) return respond(400, { error: "external_id and name are required" });

  const { data, error } = await supabase
    .from("agents")
    .upsert({
      api_key_id: apiKey.id,
      external_id,
      name,
      model: model || null,
      architecture: architecture || {},
      has_guardian: has_guardian || false,
      has_dream_cycle: has_dream_cycle || false,
      has_memory_persistence: has_memory_persistence || false,
      metadata: metadata || {},
      updated_at: new Date().toISOString(),
    }, { onConflict: "api_key_id,external_id" })
    .select()
    .single();

  if (error) return respond(500, { error: error.message });

  return respond(201, {
    message: "Agent registered",
    agent: {
      id: data.id,
      external_id: data.external_id,
      name: data.name,
      model: data.model,
      has_guardian: data.has_guardian,
      has_dream_cycle: data.has_dream_cycle,
    },
  });
};
