import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {availableCanonicalTrainers,getCanonicalShowdownTeam} from '../canonical-teams.mjs';
import {ArenaService,practiceTeams,validatePackedTeam} from '../battle-service.mjs';

const {Teams}=createRequire(import.meta.url)('pokemon-showdown');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function requestReady(arena,id,filter){
 for(let i=0;i<140;i++){
  const b=await arena.load(id);
  if(b?.status==='error')throw Error('Showdown error: '+b.error);
  if(filter(b))return b;
  await delay(20);
 }
 throw Error('Expected Showdown move request not available');
}
test('35 source trainer names are present; Luke has exact six canonical species, unique items, Mega stone and Gmax flag',()=>{
 assert.equal(availableCanonicalTrainers.length,35);
 const p=Teams.unpack(getCanonicalShowdownTeam('Luke'));
 assert.deepEqual(p.map(x=>x.species),['Arcanine-Hisui','Venusaur','Kyurem-Black','Great Tusk','Blastoise','Kilowattrel']);
 assert.equal(p[0].item,'Choice Scarf');
 assert.equal(p[0].ability,'Rock Head');
 assert.equal(p[1].item,'Venusaurite');
 assert.equal(p[1].ability,'Overgrow');
 assert.equal(p[4].item,'White Herb');
 assert.equal(p[4].gigantamax,true);
 assert.equal(p[4].ivs.atk,0);
 assert.equal(p[5].item,'Focus Sash');
 assert.deepEqual(p[5].moves,['Volt Switch','Hurricane','Tailwind','Roost']);
 assert.equal(new Set(p.map(x=>x.item)).size,6);
 assert.equal(validatePackedTeam(Teams.pack(p)),Teams.pack(p));
});
test('Canonical 2060 roster validates every supported trainer and rejects unsupported items/forms explicitly',()=>{
 const accepted=[],rejected=[];
 for(const name of availableCanonicalTrainers){
  try{accepted.push(name);getCanonicalShowdownTeam(name);}
  catch(error){accepted.pop();rejected.push({name,message:error.message});}
 }
 assert.equal(accepted.length+rejected.length,35);
 // The source contains non-Showdown Mega Stones: those must NOT be replaced.
 for(const name of ['N','Lucas']){
  const failure=rejected.find(x=>x.name===name);
  assert.ok(failure,'unsupported custom Mega '+name+' must fail closed (never get silently rewritten)');
  assert.match(failure.message,/sconosciut|incompatibile/i);
 }
 assert.ok(accepted.includes('Luke'));
 assert.ok(accepted.includes('Mattew'));
 assert.ok(accepted.includes('Ronan Ward'));
 assert.ok(accepted.includes('Soren Veyr'));
 // Rejected teams are reported with the exact reason for the user's audit.
 console.log(JSON.stringify({canonicalSupported:accepted.length,unsupported:rejected}));
});
test('gen8customgame actually offers Mega Venusaur AND Blastoise Gigantamax in the Showdown side requests', {timeout:90000},async()=>{
 const path=await mkdtemp(join(tmpdir(),'historia-canon-mega-gmax-'));
 const arena=new ArenaService(path);
 const base=Teams.unpack(getCanonicalShowdownTeam('Luke'));
 try{
  for(const [species,special,expected] of [['Venusaur','mega',/\|-mega\|/],['Blastoise','dynamax',/\|-dynamax\|/]]){
   const idx=base.findIndex(x=>x.species===species);
   const arr=[base[idx],...base.filter((_,i)=>i!==idx)];
   const match=await arena.create({mode:'manual',sessionId:'canon'+species+'-owner-unique',p1team:Teams.export(arr),p2team:practiceTeams().p2,p2name:'Test Rival'});
   let b=await requestReady(arena,match.id,x=>x?.status==='active'&&x.choices?.length);
   if(b.choices.some(x=>x.startsWith('team '))){
    await arena.choose(match.id,{choice:b.choices.find(x=>x.startsWith('team ')),requestId:b.requestId});
    b=await requestReady(arena,match.id,x=>x?.status==='active'&&x.choices?.some(c=>c.endsWith(' '+special)));
   }
   assert.ok(b.choices.some(x=>x.endsWith(' '+special)),species+' must expose '+special+' in gen8customgame');
   const command=b.choices.find(x=>x.startsWith(species==='Blastoise'?'move 2 ':'move 1 ')&&x.endsWith(' '+special))||
    b.choices.find(x=>x.endsWith(' '+special));
   await arena.choose(match.id,{choice:command,requestId:b.requestId});
   const updated=await requestReady(arena,match.id,x=>x?.status==='active'&&expected.test(x.log)||x?.status==='complete'&&expected.test(x.publicLog||''));
   assert.match(updated.log||updated.publicLog,expected,species+' must actually transform on the official Showdown stream');
   if(species==='Blastoise'){
    assert.match(updated.log||updated.publicLog,/Blastoise-Gmax|Blastoise-Gmax/,'G-Max species must be used, not ordinary Dynamax');
   }
  }
 }finally{await arena.shutdown();await rm(path,{recursive:true,force:true});}
});
