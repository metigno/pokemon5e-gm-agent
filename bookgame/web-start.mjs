// Dedicated web deployment entrypoint; never used by the Android APK.
// Story compilation is performed by the Railway build command.
process.env.P5E_UI_HOST = "0.0.0.0";
process.env.P5E_UI_PORT = process.env.PORT || "4173";
await import("./ui/server.mjs");
