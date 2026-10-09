import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createShowdownBattle} from '../showdown-engine.mjs';
import {legalChoices,selectAiFallback} from '../showdown-protocol.mjs';

const {Teams}=createRequire(import.meta.url)('pokemon-showdown');
const mon=(species,moves,item='')=>({name:species,species,item,ability:'',level:100,nature:'Hardy',moves});
const luke=Teams.pack([
 mon('Venusaur',['sludgebomb','gigadrain','earthpower','synthesis'],'Venusaurite'),
 mon('Arcanine',['thunderfang','flareblitz','closecombat','crunch']),
 ...Array.from({length:4},()=>mon('Pikachu',['thunderbolt','quickattack']))
]);
const opponent=Teams.pack(Array.from({length:6},()=>mon('Magikarp',['splash','tackle'])));

test('Gen8 custom game: one trainer can Mega Evolve then Dynamax a DIFFERENT Pokemon, actual events in Showdown log', {timeout:25000}, async()=>{
 const game=await createShowdownBattle({p1team:luke,p2team:opponent,format:'gen8customgame',p1name:'Luke',p2name:'Avversario'});
 const log=[];let firstMega=false,switched=false,usedDmax=false;
 const errors=[];
 const sideLoop=async(side)=>{
  for await(const chunk of game[side]){
   for(const line of String(chunk).split('\n')){
    if(line.startsWith('|error|')){errors.push(side+': '+line);continue;}
    if(!line.startsWith('|request|'))continue;
    const req=JSON.parse(line.slice('|request|'.length));
    if(req.wait)continue;
    let choice;
    if(side==='p1'&&req.active){
     const choices=legalChoices(req);
     if(!firstMega){
      choice=choices.find(x=>x.endsWith(' mega'));
      assert.ok(choice,'Venusaur holding Venusaurite must be able to Mega Evolve in the simulator');
      firstMega=true;
     }else if(!switched && choices.includes('switch 2')){
      choice='switch 2';switched=true;
     }else if(switched&&!usedDmax){
      choice=choices.find(x=>x.endsWith(' dynamax'));
      assert.ok(choice,'Different Pokemon must be allowed to Dynamax after Mega Evolution');
      usedDmax=true;
     }
    }
    choice ||=selectAiFallback(req);
    if(choice)await game.choose(side,choice);
   }
  }
 };
 const watch=async()=>{
  for await(const chunk of game.spectator){
   for(const line of String(chunk).split('\n')){
    if(line.startsWith('|'))log.push(line);
    if(line.startsWith('|win|')||line.startsWith('|tie|'))return;
   }
  }
 };
 try{
  const tasks=[sideLoop('p1'),sideLoop('p2')];
  await Promise.race([watch(),new Promise((_,rej)=>setTimeout(()=>rej(new Error('Timeout battle')),20000))]);
  assert.deepEqual(errors,[],'All Showdown choices accepted');
  assert.equal(firstMega,true);assert.equal(switched,true);assert.equal(usedDmax,true);
  assert.ok(log.some(line=>line.startsWith('|-mega|p1a: Venusaur|')), 'Real mega transformation event');
  assert.ok(log.some(line=>line.startsWith('|-start|p1a: Arcanine|Dynamax')), 'Real dynamax event for distinct Pokemon');
  assert.ok(log.some(line=>line.startsWith('|win|')),'Authoritative winner event');
 }finally{await game.close();}
});
