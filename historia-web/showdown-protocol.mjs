/**
 * Showdown protocol adapter. This module does not run the simulator.
 * It validates a user's decision against the current Showdown request.
 * The future battle worker must supply authentic request JSON.
 */
export function legalChoices(request) {
 if (!request || typeof request !== 'object') throw new Error('Richiesta Showdown mancante');
 if (request.wait) return [];
 if (request.forceSwitch) {
  const available=(request.side?.pokemon||[]).flatMap((p,i)=>!p.active&&!p.fainted&&!String(p.condition||'').startsWith('0 fnt')?['switch '+(i+1)]:[]);
  return available;
 }
 const moves=(request.active?.[0]?.moves||[]).flatMap((m,i)=>m.disabled||m.pp===0?[]:['move '+(i+1)]);
 const switches=(request.side?.pokemon||[]).flatMap((p,i)=>!p.active&&!p.fainted&&!String(p.condition||'').startsWith('0 fnt')?['switch '+(i+1)]:[]);
 return [...moves,...switches];
}
export function validateChoice(request, choice) {
 if(typeof choice!=='string'||!legalChoices(request).includes(choice))throw new Error('Comando non legale per il turno corrente');
 return choice;
}
export function selectAiFallback(request) {
 const options=legalChoices(request);
 if(!options.length) return null;
 return options.find(x=>x.startsWith('move '))||options[0];
}
