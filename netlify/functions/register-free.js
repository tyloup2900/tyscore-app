const { supabase, respond, handleOptions } = require("./utils");
const crypto = require("crypto");
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return handleOptions();
  if (event.httpMethod !== "POST") return respond(405, { error: "Method not allowed" });
  let body;
  try { body = JSON.parse(event.body); } catch { return respond(400, { error: "Invalid JSON" }); }
  const { email } = body;
  if (!email || !email.includes("@")) return respond(400, { error: "Valid email required" });
  const existing = await supabase.from("api_keys").select("id").eq("owner_email", email.toLowerCase().trim()).eq("plan", "free").single();
  if (existing.data) return respond(400, { error: "Free key already exists for this email" });
  const rawKey = "tysc_free_" + crypto.randomBytes(16).toString("hex");
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const { error } = await supabase.from("api_keys").insert({ key_hash: keyHash, owner_email: email.toLowerCase().trim(), plan: "free", requests_limit: 100 });
  if (error) return respond(500, { error: "Failed to create key" });
  return respond(200, { api_key: rawKey, plan: "free", limit: "100 requests/day", message: "Store this key. It cannot be retrieved again." });
};
