#!/usr/bin/env node
// Capacitor regenerates Android files; re-apply narrowly scoped localhost policy.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = join(ROOT, "android/app/src/main/AndroidManifest.xml");
const security = join(ROOT, "android/app/src/main/res/xml/bookgame_network_security.xml");
let xml = await readFile(manifest, "utf8");
if (!xml.includes("<application")) throw Error("AndroidManifest has no application element");
if (!xml.includes('android.permission.INTERNET')) {
  xml = xml.replace(/(<manifest\b[^>]*>)/, '$1\n    <uses-permission android:name="android.permission.INTERNET" />');
}
if (/android:networkSecurityConfig=/.test(xml) &&
    !xml.includes('@xml/bookgame_network_security')) {
  throw Error("A different Android network policy already exists; review manually");
}
if (!xml.includes('@xml/bookgame_network_security')) {
  xml = xml.replace(/<application\b/, '<application android:networkSecurityConfig="@xml/bookgame_network_security"');
}
await writeFile(manifest, xml, "utf8");
await mkdir(dirname(security), { recursive: true });
await writeFile(security, `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">127.0.0.1</domain>
  </domain-config>
</network-security-config>
`, "utf8");
console.log("Android traffic restricted to the embedded loopback HTTP origin.");
