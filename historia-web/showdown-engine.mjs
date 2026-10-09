/**
 * Battle worker adapter for the official pokemon-showdown simulator package.
 * Only the simulator determines outcomes. No fake battle resolution.
 * Requires npm install in historia-web.
 */
export async function createShowdownBattle({format='gen9nationaldex',p1team,p2team,seed}={}) {
 if(typeof p1team!=='string'||!p1team.trim()||typeof p2team!=='string'||!p2team.trim())throw new Error('Sono necessarie due squadre Showdown packed');
 const {BattleStream,getPlayerStreams}=await import('pokemon-showdown');
 const stream=new BattleStream();
 const players=getPlayerStreams(stream);
 const start={formatid:format};
 if(seed)start.seed=seed;
 await players.omniscient.write('>start '+JSON.stringify(start));
 await players.omniscient.write('>player p1 '+JSON.stringify({name:'Luke',team:p1team}));
 await players.omniscient.write('>player p2 '+JSON.stringify({name:'Avversario',team:p2team}));
 return {
  p1:players.p1,p2:players.p2,spectator:players.spectator,
  choose:async(side,choice)=>{
   if(!['p1','p2'].includes(side))throw new Error('Lato non valido');
   if(typeof choice!=='string'||!/^(move [1-4](?: [a-z0-9 ]+)?|switch [1-6]|team [1-6](?:,[1-6])*)$/.test(choice))throw new Error('Comando non valido');
   await players[side].write('>'+choice);
  },
  close:async()=>{await stream.writeEnd?.();}
 };
}
