// Railway-only web entrypoint. Canonical story and gameplay remain unchanged.
process.env.P5E_UI_HOST = "0.0.0.0";
process.env.P5E_UI_PORT = process.env.PORT || "4173";
await import("./ui/server.mjs");
