import { CanonicalEngineBridge } from './canonical-bridge.mjs';
import { GmSession } from './session.mjs';

/**
 * Server-side orchestration: only validated canonical outcomes may be committed.
 * The narrator is a presentation adapter, never an authority for mechanics.
 */
export class GmTurnCoordinator {
 constructor({ root, engine, narrator }) {
  this.session = new GmSession(root);
  this.engine = new CanonicalEngineBridge(engine);
  if (typeof narrator !== 'function') throw new Error('Narrator adapter required');
  this.narrator = narrator;
 }
 async play({ campaignId, expectedRevision, action }) {
  const campaign = await this.session.get(campaignId);
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.revision !== expectedRevision) throw new Error('Save revision conflict');
  const intent = typeof action === 'string' ? {text:action} : action;
  const result = await this.engine.resolve(campaign,intent);
  if (result.status === 'rejected') return {status:'rejected',reason:result.reason,revision:campaign.revision};
  const narration = await this.narrator({ action, outcome:result, campaign:structuredClone(campaign) });
  if (typeof narration !== 'string' || !narration.trim()) throw new Error('Narrator returned no text');
  const saved = await this.session.record(campaignId,expectedRevision,{
   playerAction:intent.text,narration,statePatch:result.statePatch
  });
  return {status:'committed',revision:saved.revision,narration,campaign:saved};
 }
}
