const { supabase, respond } = require("./utils");
const crypto = require("crypto");
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return respond(405, { error: "Method not allowed" });
  let stripeEvent;
  try { stripeEvent = JSON.parse(event.body); } catch { return respond(400, { error: "Invalid payload" }); }
  if (stripeEvent.type === "checkout.session.completed") {
    const email = stripeEvent.data.object.customer_email;
    const rawKey = "tysc_" + crypto.randomBytes(24).toString("hex");
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const { error } = await supabase.from("api_keys").insert({ key_hash: keyHash, owner_email: email, plan: "pro", requests_limit: 999999 });
    if (error) return respond(500, { error: "Failed to create API key" });
    return respond(200, { received: true, api_key: rawKey, message: "Store this key. It cannot be retrieved again." });
  }
  return respond(200, { received: true });
};
