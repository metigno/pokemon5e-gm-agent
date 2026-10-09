/**
 * Accept only actions exposed by that player's private Showdown request.
 * A request is trusted only when obtained from its player stream server-side.
 */
const alive = p => !p.fainted && !/^0(?:\/| fnt|$)/.test(String(p.condition ?? ''));
export function legalChoices(request) {
 if (!request || typeof request !== 'object') throw new Error('Richiesta Showdown mancante');
 if (request.wait) return [];
 const team = request.side?.pokemon || [];
 if (request.teamPreview) {
  const order = team.map((_,i)=>i+1).join('');
  return order ? ['team '+order] : [];
 }
 const switches = team.flatMap((p,i)=>p && !p.active && alive(p) ? ['switch '+(i+1)] : []);
 if (Array.isArray(request.forceSwitch) && request.forceSwitch.some(Boolean)) return switches;
 const active = request.active?.[0];
 if (!active) return switches;
 const moves = (active.moves || []).flatMap((m,i) => {
  if (m.disabled || m.pp === 0) return [];
  const base = 'move '+(i+1);
  const allowed = [base];
  if (active.canMegaEvo) allowed.push(base+' mega');
  if (active.canDynamax) allowed.push(base+' dynamax');
  // Z-moves, Terastallization and G-Max are never surfaced by Historia.
  return allowed;
 });
 return [...moves,...(active.trapped || active.maybeTrapped ? [] : switches)];
}
export function validateChoice(request,choice) {
 if (typeof choice !== 'string' || !legalChoices(request).includes(choice))
  throw new Error('Comando non legale per il turno corrente');
 return choice;
}
export function selectAiFallback(request) {
 const choices=legalChoices(request);
 if (!choices.length) return null;
 // No opponent-private state. Pick the first ordinary usable move, otherwise switch.
 return choices.find(x=>/^move \d+$/.test(x)) || choices[0];
}
