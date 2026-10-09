/**
 * Battle lifecycle adapter for the official self-hosted pokemon-showdown
 * package. The only source of turn mechanics and terminal wins is Showdown.
 */
export async function createShowdownBattle({format='gen8customgame',p1team,p2team,p1name='Luke',p2name='NPC',seed}={}) {
 if(typeof p1team!=='string'||!p1team.trim()||typeof p2team!=='string'||!p2team.trim())throw new Error('Sono necessarie due squadre Showdown packed');
 if(format!=='gen8customgame')throw new Error('Formato non ancora certificato: usare gen8customgame per i test tecnici');
 const {BattleStream,getPlayerStreams}=await import('pokemon-showdown');
 if(typeof BattleStream!=='function'||typeof getPlayerStreams!=='function')throw new Error('API simulatore Showdown non disponibile');
 const stream=new BattleStream();
 const players=getPlayerStreams(stream);
 const start={formatid:format};
 if(seed)start.seed=seed;
 // Start commands must go to the underlying BattleStream.
 await stream.write('>start '+JSON.stringify(start));
 await stream.write('>player p1 '+JSON.stringify({name:p1name,team:p1team}));
 await stream.write('>player p2 '+JSON.stringify({name:p2name,team:p2team}));
 return {
  p1:players.p1,p2:players.p2,spectator:players.spectator,omniscient:players.omniscient,
  choose:async(side,choice)=>{
   if(!['p1','p2'].includes(side))throw new Error('Lato non valido');
   if(typeof choice!=='string'||!(/^(move [1-4](?: mega| dynamax)?|switch [1-6]|team [1-6]{1,6})$/.test(choice)))throw new Error('Comando non valido');
   await players[side].write('>'+choice);
  },
  close:async()=>{await stream.writeEnd?.();}
 };
}
