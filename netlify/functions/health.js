const { respond, handleOptions } = require("./utils");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return handleOptions();
  return respond(200, {
    status: "ok",
    service: "TyScore V3",
    version: "3.0.0",
    timestamp: new Date().toISOString(),
    endpoints: [
      "POST /api/agents-register",
      "POST /api/scores-submit",
      "GET  /api/scores-get?agent_id=",
      "GET  /api/drift-analyze?agent_id=",
      "GET  /api/emergence-signal?agent_id=",
      "GET  /api/guardian-assess?agent_id=",
      "GET  /api/dreamcycle-check?agent_id=",
      "GET  /api/dashboard?agent_id=",
      "GET  /api/health",
    ],
  });
};
