import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createShowdownBattle} from '../showdown-engine.mjs';
import {legalChoices,selectAiFallback} from '../showdown-protocol.mjs';
const {Teams}=createRequire(import.meta.url)('pokemon-showdown');
const mon=(species,item,moves,other={})=>({name:species,species,item,ability:'',level:100,nature:'Hardy',moves,...other});
const six=lead=>Teams.pack([lead,...Array.from({length:5},()=>mon('Magikarp','',['Splash','Tackle']))]);

async function observedFirst({p1team,p2team,done},{timeout=12000}={}){
 const game=await createShowdownBattle({p1team,p2team,p1name:'Luke',p2name:'Rivale'});
 const events=[],errors=[];
 const sideReader=async side=>{
  for await(const chunk of game[side]){
   for(const line of String(chunk).split('\n')){
    if(line.startsWith('|error|'))errors.push(line);
    if(!line.startsWith('|request|'))continue;
    const req=JSON.parse(line.slice(9));
    if(req.wait)continue;
    const choice=selectAiFallback(req);
    if(choice)await game.choose(side,choice);
   }
  }
 };
 const reader=async()=>{
  for await(const chunk of game.spectator){
   for(const line of String(chunk).split('\n')){
    events.push(line);
    if(done(events))return;
   }
  }
 };
 try{
  const a=sideReader('p1'),b=sideReader('p2');
  await Promise.race([reader(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('No item effect observed')),timeout))]);
  assert.deepEqual(errors,[]);
  return events;
 }finally{await game.close();}
}

test('Choice Scarf modifies real turn order: Hisuian Arcanine beats faster Jolteon', {timeout:16000},async()=>{
 const hisui=mon('Arcanine-Hisui','Choice Scarf',['Crunch','Flare Blitz','Head Smash','Close Combat'],
  {ability:'Rock Head',nature:'Jolly',evs:{atk:252,spe:252,spd:4}});
 const jolteon=mon('Jolteon','',['Thunderbolt','Quick Attack'],{ability:'Volt Absorb',nature:'Timid',evs:{spa:252,spe:252,spd:4}});
 const log=await observedFirst({p1team:six(hisui),p2team:six(jolteon),done:log=>log.some(x=>x.startsWith('|move|'))});
 const first=log.find(x=>x.startsWith('|move|'));
 assert.match(first,/^\|move\|p1a: Arcanine-Hisui\|Crunch\|/,'Choice Scarf acts first despite base speed difference');
});

test('Loaded Dice changes authentic Icicle Spear hit count to 4 or 5', {timeout:16000},async()=>{
 const kyurem=mon('Kyurem-Black','Loaded Dice',['Icicle Spear','Fusion Bolt','Protect'],{ability:'Teravolt'});
 const steelix=mon('Steelix','',['Tackle','Protect'],{ability:'Sturdy'});
 const log=await observedFirst({p1team:six(kyurem),p2team:six(steelix),
  done:log=>log.some(x=>x.startsWith('|-hitcount|p2a: Steelix|'))});
 const hit=log.find(x=>x.startsWith('|-hitcount|p2a: Steelix|'));
 assert.match(hit,/^\|-hitcount\|p2a: Steelix\|[45]$/,'Authoritative Showdown attack has 4-5 strikes');
});
