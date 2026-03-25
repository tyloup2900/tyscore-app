const { respond, handleOptions } = require("./utils");
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return handleOptions();
  if (event.httpMethod !== "POST") return respond(405, { error: "Method not allowed" });
  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  let body;
  try { body = JSON.parse(event.body); } catch { return respond(400, { error: "Invalid JSON" }); }
  const { email } = body;
  if (!email) return respond(400, { error: "Email is required" });
  try {
    const session = await stripe.checkout.sessions.create({ payment_method_types: ["card"], mode: "subscription", customer_email: email, line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }], success_url: "https://tyscore-app.netlify.app/?payment=success", cancel_url: "https://tyscore-app.netlify.app/?payment=cancelled" });
    return respond(200, { url: session.url, session_id: session.id });
  } catch (err) { return respond(500, { error: err.message }); }
};
