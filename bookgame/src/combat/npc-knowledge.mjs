function hpView(pokemon){
 return pokemon?{speciesId:pokemon.speciesId,types:structuredClone(pokemon.types??[]),hp:{current:pokemon.hp.current,max:pokemon.hp.max},statuses:structuredClone(pokemon.statuses??{}),level:Number(pokemon.level??1),setup:{attack:Number((pokemon.effects?.attackModifierSources??[]).reduce((s,x)=>s+Number(x.value??0),0)),ac:Number((pokemon.effects?.acModifierSources??[]).reduce((s,x)=>s+Number(x.value??0),0)),damage:Number((pokemon.effects?.damageModifierSources??[]).reduce((s,x)=>s+Number(x.value??0),0))}}:null;
}
export function createNpcKnowledge(battle){
 return {
  seenPlayerPokemon:{[battle.player.speciesId]:hpView(battle.player)},
  revealedPlayerMoves:{[battle.player.speciesId]:[]},
  lastObservedLogIndex:0
 };
}
export function updateNpcKnowledge(battle,knowledge,{revealedMoveTypes={}}={}){
 const next=structuredClone(knowledge??createNpcKnowledge(battle));
 next.seenPlayerPokemon[battle.player.speciesId]=hpView(battle.player);
 next.revealedPlayerMoves[battle.player.speciesId]??=[];
 for(const event of (battle.log??[]).slice(next.lastObservedLogIndex)){
  if(event.actor!=="player"||!event.moveId) continue;
  const list=next.revealedPlayerMoves[battle.player.speciesId]??=[];
  if(!list.some(x=>(typeof x==="string"?x:x.id)===event.moveId)) list.push({id:event.moveId,type:revealedMoveTypes[event.moveId]??event.moveType??null});
  next.revealedPlayerMoves[battle.player.speciesId]=list;
 }
 next.lastObservedLogIndex=(battle.log??[]).length;
 return next;
}
export function npcPublicBattleView(battle,knowledge){
 const k=updateNpcKnowledge(battle,knowledge);
 return {
  round:battle.round,
  player:hpView(battle.player),
  revealedPlayerMoves:structuredClone(k.revealedPlayerMoves[battle.player.speciesId]??[]),
  opponent:hpView(battle.opponent),
  knownPlayerBench:Object.values(k.seenPlayerPokemon).filter(p=>p.speciesId!==battle.player.speciesId),
  opponentBench:(battle.opponentBench??[]).map(hpView)
 };
}
