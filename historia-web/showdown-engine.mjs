/**
 * Battle lifecycle adapter for the official self-hosted pokemon-showdown
 * package. The only source of turn mechanics and terminal wins is Showdown.
 */
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
export function historiaFormat(){
 const {Dex}=require('pokemon-showdown');
 return {...Dex.formats.get('gen8customgame'),id:'historia',name:'Historia WHAT-IF 6v6',debug:false,
  ruleset:['Cancel Mod','Max Team Size = 6','Max Move Count = 4','Max Level = 100','Default Level = 100','+Past','+Future'],ruleTable:null};
}
export async function createShowdownBattle({format='gen8customgame',p1team,p2team,p1name='Luke',p2name='NPC',seed}={}) {
 if(typeof p1team!=='string'||!p1team.trim()||typeof p2team!=='string'||!p2team.trim())throw new Error('Sono necessarie due squadre Showdown packed');
 if(!['historia','gen8customgame'].includes(format))throw new Error('Formato non supportato');
 const {BattleStream,getPlayerStreams,Dex}=require('pokemon-showdown');
 if(typeof BattleStream!=='function'||typeof getPlayerStreams!=='function')throw new Error('API simulatore Showdown non disponibile');
 const stream=new BattleStream();
 const players=getPlayerStreams(stream);
 const start={formatid:format==='historia'?'gen8customgame':format};
 if(format==='historia'){
  // Use upstream Gen8 mechanics (Mega + Dynamax) and inherited intergeneration
  // data. Team Preview is omitted to preserve Historia's fog of war.
  start.format=historiaFormat();
 }
 if(seed)start.seed=seed;
 // Start commands must go to the underlying BattleStream.
 await stream.write('>start '+JSON.stringify(start));
 await stream.write('>player p1 '+JSON.stringify({name:p1name,team:p1team}));
 await stream.write('>player p2 '+JSON.stringify({name:p2name,team:p2team}));
 return {
  p1:players.p1,p2:players.p2,spectator:players.spectator,omniscient:players.omniscient,
  reissuePendingRequests:()=>{
   // Private requests are re-sent from the actual Battle side states, not
   // guessed from packed sets. Never send them to the public spectator channel.
   const battle=stream.battle;
   if(!battle)return;
   for(const side of ['p1','p2']){
    const player=battle.getSide(side);
    if(player?.activeRequest&&!player.isChoiceDone())player.emitRequest(player.activeRequest);
   }
   battle.sendUpdates();
  },
  currentRequest:(side)=>{
   if(!['p1','p2'].includes(side))throw new Error('Lato non valido');
   const player=stream.battle?.getSide(side);
   if(!player?.activeRequest||player.isChoiceDone())return null;
   // The simulator remains authoritative: this is the actual pending private
   // request for the controlled side, not a guessed reconstructed move list.
   return JSON.parse(JSON.stringify(player.activeRequest));
  },
  choose:async(side,choice)=>{
   if(!['p1','p2'].includes(side))throw new Error('Lato non valido');
   if(typeof choice!=='string'||!(/^(move [1-4](?: mega| dynamax)?|switch [1-6]|team [1-6]{1,6})$/.test(choice)))throw new Error('Comando non valido');
   await players[side].write(choice);
  },
  close:async()=>{await stream.writeEnd?.();}
 };
}
