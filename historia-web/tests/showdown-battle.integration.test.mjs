import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

test('simulatore Showdown: battle stream completo con vincitore reale', {timeout:20000}, async()=>{
 const {BattleStream,getPlayerStreams,Teams}=require('pokemon-showdown');
 assert.equal(typeof BattleStream,'function');
 assert.equal(typeof getPlayerStreams,'function');
 const pack=species=>Teams.pack([{name:species,species,ability:'',moves:['tackle'],nature:'Hardy',level:100}]);
 const stream=new BattleStream();
 const players=getPlayerStreams(stream);
 const events=[];
 let winner=null;
 let decisions=0;
 const readPlayer=async (side,player)=>{
  for await(const chunk of player){
   for(const line of String(chunk).split('\n')){
    if(!line.startsWith('|request|'))continue;
    const request=JSON.parse(line.slice('|request|'.length));
    if(request.wait)continue;
    if(request.teamPreview)await player.write('>team 1');
    else if(request.forceSwitch)await player.write('>switch 1');
    else if(request.active){decisions++;await player.write('>move 1');}
   }
  }
 };
 const readSpectator=async()=>{
  for await(const chunk of players.omniscient){
   for(const line of String(chunk).split('\n')){
    if(line.startsWith('|turn|'))events.push(line);
    if(line.startsWith('|win|'))winner=line.slice(5);
   }
   if(winner)break;
  }
 };
 const readers=[readPlayer('p1',players.p1),readPlayer('p2',players.p2),readSpectator()];
 try{
  await stream.write('>start '+JSON.stringify({formatid:'gen9customgame'}));
  await stream.write('>player p1 '+JSON.stringify({name:'Luke',team:pack('Arcanine')}));
  await stream.write('>player p2 '+JSON.stringify({name:'Rivale',team:pack('Magikarp')}));
  await Promise.race([readers[2],new Promise((_,reject)=>setTimeout(()=>reject(Error('Battaglia non terminata entro 15s')),15000))]);
  assert.ok(winner==='Luke'||winner==='Rivale', 'Il vincitore deve provenire dal simulatore');
  assert.ok(events.length>0,'Il simulatore deve produrre turni');
  assert.ok(decisions>0,'I giocatori devono inviare comandi');
 } finally {
  await stream.writeEnd?.();
 }
});
