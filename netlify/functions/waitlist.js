const { supabase, respond, handleOptions } = require("./utils");
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return handleOptions();
  if (event.httpMethod !== "POST") return respond(405, { error: "Method not allowed" });
  let body;
  try { body = JSON.parse(event.body); } catch { return respond(400, { error: "Invalid JSON" }); }
  const { email, plan, source } = body;
  if (!email || !email.includes("@")) return respond(400, { error: "Valid email is required" });
  const { data, error } = await supabase.from("waitlist").upsert({ email: email.toLowerCase().trim(), plan: plan || "free", source: source || "website" }, { onConflict: "email" }).select().single();
  if (error) return respond(500, { error: error.message });
  return respond(200, { message: "You are on the list.", email: data.email, plan: data.plan });
};
