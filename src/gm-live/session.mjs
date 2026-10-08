import { randomInt, randomUUID } from 'node:crypto';
import { createCampaign, GmSaveStore } from './save-store.mjs';

const allowed = new Set(['Luke','Edward','Fab','Daniel','Mattew']);
export class GmSession {
 constructor(root) { this.store = new GmSaveStore(root); }
 async start(protagonist, campaignId) {
  if (!allowed.has(protagonist)) throw new Error('Unknown protagonist');
  return this.store.save(createCampaign({ protagonist, ...(campaignId ? { campaignId } : {}) }), -1);
 }
 async get(id) { return this.store.load(id); }
 async record(id, expectedRevision, { playerAction, narration, statePatch = {}, dice = null }) {
  if (typeof playerAction !== 'string' || !playerAction.trim()) throw new Error('Action required');
  if (typeof narration !== 'string') throw new Error('Narration required');
  const game = await this.store.load(id);
  if (!game) throw new Error('Campaign not found');
  if (game.revision !== expectedRevision) throw new Error('Save revision conflict');
  const next = structuredClone(game);
  for (const [key, value] of Object.entries(statePatch)) {
   if (!['world','character','team','inventory','npcStates','quests','encounters','relationships'].includes(key)) throw new Error('Forbidden state patch');
   if (['team','inventory'].includes(key) ? !Array.isArray(value) : !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid state patch');
   next[key] = value;
  }
  const event = { id: randomUUID(), timestamp: new Date().toISOString(), playerAction, narration };
  if (dice) {
   const { count = 1, sides = 20, modifier = 0 } = dice;
   if (![count,sides,modifier].every(Number.isSafeInteger) || count < 1 || count > 100 || sides < 2 || sides > 1000) throw new Error('Invalid dice');
   const rolls = Array.from({length: count}, () => randomInt(1,sides+1));
   event.dice = { count, sides, modifier, rolls, total: rolls.reduce((a,b)=>a+b,modifier) };
   next.rolls.push({ eventId: event.id, ...event.dice });
  }
  next.history.push(event);
  next.journal.push({ eventId: event.id, summary: narration });
  return this.store.save(next, expectedRevision);
 }
}
