/**
 * Battle orchestration only. Actual Pokémon Showdown engine/server remains
 * authoritative for choices, turns, RNG, damage and victory.
 */
export function createBattleSession(fixture,controlledTrainerId,{battleId,formatId='gen9customgame'}={}){
 if(!fixture||fixture.status!=='scheduled'||!fixture.id||!fixture.homeId||!fixture.awayId||fixture.homeId===fixture.awayId)throw new Error('Invalid scheduled fixture');
 if(typeof battleId!=='string'||!/^battle-[a-z0-9-]+$/i.test(battleId))throw new Error('Server-issued battle ID required');
 if(typeof formatId!=='string'||!/^[a-z0-9]+$/.test(formatId))throw new Error('Invalid Showdown format');
 const human=[fixture.homeId,fixture.awayId].includes(controlledTrainerId);
 return {fixtureId:fixture.id,battleId,formatId,mode:human?'human-vs-ai':'ai-vs-ai',controlledTrainerId:human?controlledTrainerId:null,homeId:fixture.homeId,awayId:fixture.awayId,status:'pending',lastTurn:0,requestId:0};
}
export function startBattleSession(session){if(session.status!=='pending')throw new Error('Session already started');return {...session,status:'active'};}
export function recordTurn(session,turn){if(session.status!=='active'||!Number.isInteger(turn)||turn<=session.lastTurn)throw new Error('Invalid turn progression');return {...session,lastTurn:turn};}
/** User choices must be relayed unchanged to a trusted Showdown server. */
export function makeHumanChoice(session,{trainerId,requestId,choice}){
 if(session.status!=='active'||session.mode!=='human-vs-ai'||trainerId!==session.controlledTrainerId)throw new Error('Human control unavailable');
 if(!Number.isInteger(requestId)||requestId<=session.requestId)throw new Error('Stale battle request');
 if(typeof choice!=='string'||!(/^(move [1-4](?: .+)?|switch [1-6]|team [1-6](?:[1-6])*)$/.test(choice)))throw new Error('Invalid Showdown choice syntax');
 return {battleId:session.battleId,trainerId,requestId,choice};
}
export function acceptChoice(session,command){if(session.status!=='active'||command.battleId!==session.battleId||command.requestId<=session.requestId)throw new Error('Stale or mismatched choice');return {...session,requestId:command.requestId};}
export function finishBattleSession(session,verifiedReceipt){if(session.status!=='active'||!verifiedReceipt||verifiedReceipt.battleId!==session.battleId||verifiedReceipt.authority!=='showdown-verified')throw new Error('Verified outcome required');if(![session.homeId,session.awayId].includes(verifiedReceipt.winnerId)||![session.homeId,session.awayId].includes(verifiedReceipt.loserId)||verifiedReceipt.winnerId===verifiedReceipt.loserId)throw new Error('Invalid result participants');return {...session,status:'complete',winnerId:verifiedReceipt.winnerId,logDigest:verifiedReceipt.logDigest};}
