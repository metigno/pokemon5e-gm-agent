// Audio is strictly presentation: it cannot change campaign or combat state.
const ENABLED = "p5e_audio_enabled";
const VOLUME = "p5e_audio_volume";

export function selectSoundtrack(snapshot) {
  if (!snapshot?.hasSession) return "intro";
  const battle = snapshot.battle;
  const title = String(snapshot.story?.sceneTitle ?? "").toLowerCase();
  if (battle) {
    const context = String(battle.encounterId ?? "") + " " + String(battle.opponentTrainerId ?? "");
    if (/mondial|world.?cup|pwt.?final|final.?round/i.test(context)) return "pwt_final";
    if (/legend|kyurem|zacian|zamazenta|rayquaza|giratina|dialga|palkia|arceus/i.test(context)) return "battle_legendary";
    if (/champion|elite|boss|final|tournament|torneo|gym|capopalestra|trial|promozione/i.test(context)) return "battle_boss";
    return battle.opponentTrainerId ? "battle_trainer" : "battle_wild";
  }
  if (/mondial|world.?cup|pwt/.test(title) && /final|campion|titolo|cerimonia/.test(title)) return "pwt_victor";
  if (/vittori|trionf|campion|premiazion/.test(title)) return "victory";
  if (/sconfitt|disfatta/.test(title)) return "defeat";
  if (/pericol|allarm|attacc|insegu|crisi|croll|emergenz|tempesta|minacci|imboscat|scontro/.test(title)) return "danger";
  if (/mister|indagin|segre|rovine|enigm|ombra|traccia|laboratorio|archiv|caverna/.test(title)) return "mystery";
  if (/riposo|pausa|casa|rifugio|guarigion/.test(title)) return "calm";
  const n = Number(String(snapshot.story?.moduleId ?? "").match(/\d+/)?.[0] ?? 0);
  return n >= 1 && n <= 12 ? "m" + String(n).padStart(2, "0") : "intro";
}

const motifs = {
  intro: [60,64,67,72,67,64,62,67],
  calm: [60,64,67,64,62,65,69,65],
  mystery: [57,60,63,60,58,61,64,61],
  danger: [45,48,46,49,45,48,43,46],
  battle_wild: [52,59,55,62,52,59,57,64],
  battle_trainer: [48,55,60,55,50,57,62,57],
  battle_boss: [45,52,57,60,43,50,55,59],
  battle_legendary: [40,47,52,59,42,49,54,61],
  evolution: [60,64,67,72,74,76,79,84]
};
function fallbackMotif(id) {
  if (motifs[id]) return motifs[id];
  if (id === "pwt_final") return motifs.battle_boss;
  if (id === "victory" || id === "pwt_victor" || id === "pwt_win") return motifs.evolution;
  const n = Number(id.slice(1));
  return n >= 7 ? motifs.mystery : n >= 4 ? motifs.battle_wild : motifs.intro;
}
const clamp = (v) => Math.max(0, Math.min(1, Number.isFinite(Number(v)) ? Number(v) : .65));

export class AudioSoundscape {
  constructor() {
    this.enabled = localStorage.getItem(ENABLED) === "1";
    this.volume = clamp(localStorage.getItem(VOLUME) ?? 0.65);
    this.cue = "intro";
    this.overrideCue = null;
    this.track = null;
    this.context = null;
    this.timer = null;
    this.step = 0;
    this.generation = 0;
    this.manifest = null;
    this.manifestPromise = null;
    this.playingCue = null;
  }
  get active() { return this.enabled && this.volume > 0; }
  _context() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      try { this.context = new AudioContext(); } catch { return null; }
    }
    if (this.context.state === "suspended") this.context.resume().catch(() => {});
    return this.context;
  }
  unlock() { if (this.active) this._context(); }
  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    localStorage.setItem(ENABLED, this.enabled ? "1" : "0");
    if (this.active) { this.unlock(); this._changeCue(); } else this.stop();
  }
  setVolume(v) {
    this.volume = clamp(v);
    localStorage.setItem(VOLUME, String(this.volume));
    if (this.track) this.track.volume = this.volume * 0.43;
    if (!this.active) this.stop();
    else { this.unlock(); this._changeCue(); }
  }
  sync(snapshot) { this.cue = selectSoundtrack(snapshot); this._changeCue(); }
  setOverride(cue) { this.overrideCue = cue; this._changeCue(); }
  clearOverride() { this.overrideCue = null; this._changeCue(); }
  _stopTrack() {
    if (!this.track) return;
    const old = this.track;
    this.track = null;
    old.pause();
    old.removeAttribute("src");
    old.load();
  }
  _stopFallback() { if (this.timer !== null) clearInterval(this.timer); this.timer = null; this.step = 0; }
  stop() { ++this.generation; this._stopTrack(); this._stopFallback(); this.playingCue = null; }
  async _getManifest() {
    if (!this.manifestPromise) {
      this.manifestPromise = fetch("/audio/manifest.json", { cache: "no-store" })
        .then(response => response.ok ? response.json() : null)
        .then(data => data?.format === "p5e-offline-audio-v1" ? data : null)
        .catch(() => null);
    }
    return this.manifestPromise;
  }
  _changeCue() {
    if (!this.active) return;
    const wanted = this.overrideCue || this.cue;
    if (this.playingCue === wanted) return;
    this._stopTrack();
    this._stopFallback();
    const generation = ++this.generation;
    this.playingCue = wanted;
    this._startFallback(wanted);
    void this._getManifest().then(manifest => {
      if (!this.active || generation !== this.generation) return;
      this.manifest = manifest;
      if (!manifest?.music?.[wanted]) return;
      const audio = new Audio("/audio/" + wanted + ".ogg");
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = this.volume * .43;
      this.track = audio;
      audio.addEventListener("error", () => {
        if (this.track === audio) { this._stopTrack(); this._startFallback(wanted); }
      }, { once: true });
      audio.play().then(() => {
        if (generation === this.generation) this._stopFallback();
        else audio.pause();
      }).catch(() => {
        if (this.track === audio) this._stopTrack();
      });
    });
  }
  _beep(note, duration = .12, intensity = .07, type = "triangle") {
    const ctx = this._context();
    if (!ctx || !this.active) return;
    const osc = ctx.createOscillator(), gain = ctx.createGain(), t = ctx.currentTime;
    osc.type = type;
    osc.frequency.value = 440 * 2 ** ((note - 69) / 12);
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, intensity * this.volume), t + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t); osc.stop(t + duration + .018);
  }
  _startFallback(cue) {
    if (!this.active || this.timer !== null) return;
    const notes = fallbackMotif(cue);
    const interval = /battle|danger|pwt_final/.test(cue) ? 250 : 510;
    const tick = () => {
      if (!this.active) return;
      const note = notes[this.step++ % notes.length];
      this._beep(note, interval / 1000 * .75, .026);
      if (this.step % 4 === 0) this._beep(note - 12, interval / 1000 * 1.6, .012, "sine");
    };
    tick();
    this.timer = setInterval(tick, interval);
  }
  playEffect(id) {
    if (!this.active) return;
    this.unlock();
    if (this.manifest?.effects?.[id]) {
      const effect = new Audio("/audio/" + id + ".ogg");
      effect.volume = this.volume * .65;
      effect.play().catch(() => this._fallbackEffect(id));
    } else this._fallbackEffect(id);
  }
  _fallbackEffect(id) {
    const notes = {
      ui_select: [72], ui_confirm: [76, 81], ui_cancel: [55],
      ui_page: [67], ui_advance: [81], ui_hit: [48, 43],
      pwt_fanfare: [72, 76, 79]
    }[id] ?? [72];
    for (const note of notes) this._beep(note, .11, .09);
  }
  playCry(speciesId) {
    if (!this.active) return;
    const key = String(speciesId ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!this.manifest?.cries?.[key]) { this._beep(57, .2, .045, "sawtooth"); return; }
    const cry = new Audio("/audio/cries/" + key + ".wav");
    cry.volume = this.volume * .46;
    cry.play().catch(() => {});
  }
  playStinger(id) {
    if (!this.active) return;
    if (!this.manifest?.music?.[id]) {
      this.playEffect(id === "defeat" ? "ui_cancel" : "ui_confirm");
      return;
    }
    const stinger = new Audio("/audio/" + id + ".ogg");
    stinger.volume = this.volume * .6;
    stinger.play().catch(() => {});
  }
}
