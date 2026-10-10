import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {canonicalTeam} from '../canonical-2060-teams.mjs';
import {practiceTeams} from '../battle-service.mjs';
import {createShowdownBattle} from '../showdown-engine.mjs';
import {legalChoices,selectAiFallback} from '../showdown-protocol.mjs';

const {Teams}=createRequire(import.meta.url)('pokemon-showdown');

async function probeLukeTransformation(species,specialChoice,expectedEvent){
 const sets=Teams.unpack(canonicalTeam('Luke'));
 const selected=sets.find(p=>p.species===species);
 assert.ok(selected,'Missing species '+species);
 const rest=sets.filter(p=>p!==selected);
 const team=Teams.pack([selected,...rest]);
 const game=await createShowdownBattle({
  p1team:team,p2team:practiceTeams().p2,
  p1name:'Luke',p2name:'Mattew',format:'gen8customgame'
 });
 const events=[],errors=[];
 let transformed=false;
 const act=async side=>{
  for await(const chunk of game[side]){
   for(const line of String(chunk).split(/\r?\n/)){
    if(line.startsWith('|error|'))errors.push(line);
    if(!line.startsWith('|request|'))continue;
    const req=JSON.parse(line.slice(9));if(req.wait)continue;
    const choices=legalChoices(req);
    let choice=selectAiFallback(req);
    if(side==='p1'&&req.active&&!transformed){
     choice=choices.find(x=>x===specialChoice);
     assert.ok(choice,JSON.stringify({species,choices,canMega:req.active[0].canMegaEvo,
      canDynamax:req.active[0].canDynamax,gigantamax:selected.gigantamax}));
     transformed=true;
    }
    if(choice)await game.choose(side,choice);
   }
  }
 };
 const watcher=async()=>{
  for await(const chunk of game.spectator){
   for(const line of String(chunk).split(/\r?\n/)){
    if(line.startsWith('|'))events.push(line);
    if(events.some(x=>expectedEvent.test(x)))return;
   }
  }
  throw Error('Showdown stream ended without transformation event');
 };
 try{
  void act('p1').catch(err=>{errors.push(err.stack||String(err));});
  void act('p2').catch(err=>{errors.push(err.stack||String(err));});
  await Promise.race([
   watcher(),
   new Promise((_,reject)=>setTimeout(()=>reject(Error('No in-game transformation within 12 seconds')),12000))
  ]);
  assert.equal(transformed,true);
  assert.deepEqual(errors,[]);
  assert.ok(events.some(line=>expectedEvent.test(line)),events.join('\n').slice(-2400));
  return events;
 }finally{await game.close();}
}

test('Real Gen8 Custom Game: 2060 Venusaurite triggers Mega Venusaur with Thick Fat', {timeout:20000},async()=>{
 const events=await probeLukeTransformation('Venusaur','move 1 mega',/\|-mega\|p1a:.*Venusaur/);
 assert.ok(events.some(x=>x.includes('|-mega|')));
});

test('Real Gen8 Custom Game: 2060 Gigantamax Blastoise performs G-Max Cannonade, not regular Max Geyser', {timeout:20000},async()=>{
 const events=await probeLukeTransformation('Blastoise','move 2 dynamax',/\|move\|p1a:.*\|G-Max Cannonade\|/);
 assert.ok(events.some(x=>x.includes('|G-Max Cannonade|')),events.join('\n').slice(-3000));
});
