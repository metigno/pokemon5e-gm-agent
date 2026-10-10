import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createShowdownBattle} from '../showdown-engine.mjs';
import {legalChoices,selectAiFallback} from '../showdown-protocol.mjs';

const {Teams,Dex}=createRequire(import.meta.url)('pokemon-showdown');
const mon=(species,moves=['tackle'],item='')=>({name:species,species,ability:'',nature:'Hardy',level:100,moves,item});
const foe=Teams.pack(Array.from({length:6},()=>mon('Magikarp',['splash','tackle'])));
const forbidden=['Zacian','Zacian-Crowned','Zamazenta','Zamazenta-Crowned','Eternatus'];

test('Official Showdown requests never offer Dynamax for Zacian, Zamazenta, Eternatus and crowned forms',{timeout:45000},async()=>{
 for(const species of forbidden){
  const entry=Dex.species.get(species);
  assert.equal(entry.exists,true,species);
  assert.equal(entry.cannotDynamax,true,species+' upstream Dex restriction');
  const item=species==='Zacian-Crowned'?'Rusted Sword':species==='Zamazenta-Crowned'?'Rusted Shield':'';
  const team=Teams.pack([mon(species,['tackle','protect'],item),...Array.from({length:5},()=>mon('Pikachu',['thunderbolt']))]);
  const game=await createShowdownBattle({p1team:team,p2team:foe,format:'gen8customgame',p1name:'Luke',p2name:'Rivale'});
  const errors=[];
  const reader=async(side)=>{
   for await (const chunk of game[side]){
    for(const line of String(chunk).split('\n')){
     if(line.startsWith('|error|'))errors.push(side+': '+line);
     if(!line.startsWith('|request|'))continue;
     const request=JSON.parse(line.slice(9));
     if(request.wait)continue;
     if(request.teamPreview){await game.choose(side,'team 123456');continue;}
     if(request.active){
      if(side==='p1')return request;
      const cmd=selectAiFallback(request);
      if(cmd)await game.choose(side,cmd);
     }
    }
   }
   throw new Error(side+' closed before active request');
  };
  try{
   const side1=reader('p1');
   const side2=reader('p2').catch(e=>errors.push('p2 '+e.message));
   const req=await Promise.race([side1,new Promise((_,reject)=>setTimeout(()=>reject(new Error('No active request for '+species)),6500))]);
   assert.deepEqual(errors,[],species+' simulator errors');
   assert.equal(!!req.active[0].canDynamax,false,species+' must not Dynamax in real Showdown request');
   assert.equal(legalChoices(req).some(x=>x.endsWith(' dynamax')),false,species+' browser must not show Dynamax');
  }finally{await game.close();}
 }
});
