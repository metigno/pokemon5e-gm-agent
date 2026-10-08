/**
 * Bridge contract for the canonical Pokemon 5e engine.
 * This module does NOT replace canonical mechanics or invent outcomes.
 * A caller must supply a real engine adapter before mechanical actions run.
 */
export class CanonicalEngineBridge {
 constructor(adapter) {
  for (const method of ['validateAction','resolveAction','validateState']) {
   if (typeof adapter?.[method] !== 'function') throw new Error('Missing canonical engine adapter: '+method);
  }
  this.adapter = adapter;
 }
 async resolve(campaign, intent) {
  if (!campaign || !intent || typeof intent.text !== 'string' || !intent.text.trim()) throw new Error('Invalid action intent');
  const valid = await this.adapter.validateAction({ campaign:structuredClone(campaign),intent:structuredClone(intent) });
  if (!valid?.allowed) return { status:'rejected', reason:valid?.reason || 'Action not allowed' };
  const outcome = await this.adapter.resolveAction({ campaign:structuredClone(campaign),intent:structuredClone(intent) });
  if (!outcome || typeof outcome.narration !== 'string' || !outcome.narration.trim() || !outcome.statePatch || typeof outcome.statePatch !== 'object') {
   throw new Error('Canonical engine returned invalid outcome');
  }
  const checked = await this.adapter.validateState({ campaign:structuredClone(campaign),outcome:structuredClone(outcome) });
  if (!checked?.valid) throw new Error('Canonical state validation failed: '+(checked?.reason || 'unknown'));
  return {status:'resolved',...outcome};
 }
}
