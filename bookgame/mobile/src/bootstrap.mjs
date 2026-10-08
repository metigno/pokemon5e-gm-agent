import { Nodejs } from "@capawesome/capacitor-nodejs";

const status = document.getElementById("status");
const errorBox = document.getElementById("error");
let redirected = false;

function failure(message) {
  status.textContent = "Avvio non riuscito";
  errorBox.textContent = String(message || "Errore sconosciuto.");
  errorBox.hidden = false;
}
function enterGame(token) {
  if (redirected) return;
  if (!/^[a-f0-9]{64}$/.test(token ?? "")) return failure("Sessione locale non valida.");
  redirected = true;
  // All game UI, images and API requests use this in-app loopback endpoint.
  // No external Node process, CDN, network fetch or remote backend is used.
  window.location.replace("http://127.0.0.1:4173/?entry=" + token);
}
try {
  await Nodejs.addListener("message", ({ eventName, args }) => {
    if (eventName === "bookgame-server-ready") enterGame(args?.[0]);
    else if (eventName === "bookgame-server-error") failure(args?.[0]);
  });
  status.textContent = "Caricamento del motore offline…";
  await Nodejs.start();
} catch (error) {
  failure(error?.message ?? error);
}
