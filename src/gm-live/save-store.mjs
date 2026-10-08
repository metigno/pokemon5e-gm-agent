import { mkdir, readFile, writeFile, rename, open } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const GM_SLOT_ID = 'gm-live-slot-1';
const VERSION = 1;
function safeId(id) {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new Error('Invalid campaign id');
  return id;
}
export function createCampaign({ protagonist, campaignId = randomUUID() }) {
  if (!protagonist || typeof protagonist !== 'string') throw new Error('Protagonist required');
  return {
    schemaVersion: VERSION, slotId: GM_SLOT_ID, campaignId: safeId(campaignId),
    revision: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    protagonist, world: { day: 1, time: 'morning', location: null, flags: {} },
    character: {}, team: [], inventory: [], npcStates: {}, quests: {},
    encounters: {}, relationships: {}, rolls: [], journal: [], history: []
  };
}
export function validateCampaign(value) {
  if (!value || value.schemaVersion !== VERSION || value.slotId !== GM_SLOT_ID) throw new Error('Invalid GM save schema');
  safeId(value.campaignId);
  if (!Number.isSafeInteger(value.revision) || value.revision < 0) throw new Error('Invalid revision');
  for (const field of ['team', 'inventory', 'rolls', 'journal', 'history']) {
    if (!Array.isArray(value[field])) throw new Error('Invalid '+field);
  }
  return value;
}
export class GmSaveStore {
  constructor(root) { this.root = path.resolve(root); }
  filename(id) { return path.join(this.root, safeId(id), GM_SLOT_ID + '.json'); }
  async load(id) {
    try { return validateCampaign(JSON.parse(await readFile(this.filename(id), 'utf8'))); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  async save(value, expectedRevision) {
    validateCampaign(value);
    await mkdir(path.dirname(this.filename(value.campaignId)), { recursive: true });
    const existing = await this.load(value.campaignId);
    if ((existing?.revision ?? -1) !== expectedRevision) throw new Error('Save revision conflict');
    const next = structuredClone(value);
    next.revision = (existing?.revision ?? -1) + 1;
    next.updatedAt = new Date().toISOString();
    const target = this.filename(value.campaignId);
    const tmp = target + '.' + randomUUID() + '.tmp';
    const handle = await open(tmp, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(next, null, 2)); await handle.sync(); }
    finally { await handle.close(); }
    await rename(tmp, target);
    return next;
  }
}
