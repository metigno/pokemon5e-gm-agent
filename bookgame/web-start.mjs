// Web-only hosting entrypoint. Android packaging does not use this file.
process.env.P5E_UI_HOST = "0.0.0.0";
process.env.P5E_UI_PORT = process.env.PORT || "4173";
await import("./src/compiler/cli.mjs");
await import("./ui/server.mjs");
