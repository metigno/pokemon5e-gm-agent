import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createShowdownBattle} from '../showdown-engine.mjs';
import {parseTeamInput,describeTeam,exportTeamInput,practiceTeams,validatePackedTeam} from '../battle-service.mjs';
import {legalChoices,selectAiFallback} from '../showdown-protocol.mjs';

const {Teams,Dex}=createRequire(import.meta.url)('pokemon-showdown');
const luke=`Arcanine-Hisui @ Choice Scarf
Ability: Rock Head
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Flare Blitz
- Head Smash
- Close Combat
- Crunch

Venusaur @ Black Sludge
Ability: Overgrow
EVs: 252 HP / 4 SpA / 252 SpD
Calm Nature
- Sleep Powder
- Leech Seed
- Sludge Bomb
- Giga Drain

Kyurem-Black @ Loaded Dice
Ability: Teravolt
EVs: 252 Atk / 4 SpA / 252 Spe
Hasty Nature
- Icicle Spear
- Fusion Bolt
- Dragon Dance
- Earth Power

Great Tusk @ Heavy-Duty Boots
Ability: Protosynthesis
EVs: 252 HP / 252 Atk / 4 Def
Adamant Nature
- Earthquake
- Rapid Spin
- Close Combat
- Stealth Rock

Aerodactyl @ Aerodactylite
Ability: Unnerve
EVs: 252 Atk / 4 Def / 252 Spe
Jolly Nature
- Stone Edge
- Earthquake
- Roost
- Aerial Ace

Blastoise @ Leftovers
Ability: Torrent
EVs: 252 HP / 252 SpA / 4 SpD
Modest Nature
Gigantamax: Yes
- Surf
- Ice Beam
- Rapid Spin
- Shell Smash`;
const opponent=Teams.export(Teams.unpack(practiceTeams().p2));

test('Exported Luke team faithfully roundtrips through official Showdown import & pack',()=>{
 const packed=parseTeamInput(luke);
 const sets=Teams.unpack(packed);
 assert.equal(sets.length,6);
 assert.deepEqual(sets.map(m=>m.species),['Arcanine-Hisui','Venusaur','Kyurem-Black','Great Tusk','Aerodactyl','Blastoise']);
 assert.equal(sets[0].ability,'Rock Head');
 assert.equal(sets[0].item,'Choice Scarf');
 assert.equal(sets[0].nature,'Jolly');
 assert.equal(sets[0].evs.atk,252);
 assert.deepEqual(sets[0].moves,['Flare Blitz','Head Smash','Close Combat','Crunch']);
 assert.equal(sets[2].item,'Loaded Dice');
 assert.equal(sets[3].item,'Heavy-Duty Boots');
 assert.equal(sets[4].item,'Aerodactylite');
 assert.equal(sets[5].item,'Leftovers');
 assert.equal(sets[5].gigantamax,true);
 assert.equal(sets[5].ability,'Torrent');
 assert.equal(Dex.species.get(sets[0].species).types.join('/'),'Fire/Rock');
 assert.equal(parseTeamInput(packed),packed);
 assert.equal(parseTeamInput(exportTeamInput(packed)),packed);
 assert.deepEqual(describeTeam(luke).map(x=>x.moves),sets.map(x=>x.moves));
});

test('Reject invalid imports instead of replacing individual entries or teams',()=>{
 assert.throws(()=>parseTeamInput('Arcanine-Hisui @ Choice Scarf\nAbility: Rock Head\n- Crunch'),/esattamente sei/);
 const malformed=luke.replace('Rock Head','Rock-Heads-Unknown');
 assert.throws(()=>parseTeamInput(malformed),/Abilità sconosciuta/);
 const badGmax=luke.replace('Gigantamax: Yes','').replace('Ability: Teravolt','Ability: Teravolt\nGigantamax: Yes');
 assert.throws(()=>parseTeamInput(badGmax),/non compatibile con Gigantamax/);
 const t=Teams.unpack(parseTeamInput(luke));t[2].item='Choice Scarf';
 assert.throws(()=>validatePackedTeam(Teams.pack(t)),/Item Clause/);
});

test('Gen8 Custom Game simulator offers authentic Mega Aerodactyl and Gigamax Blastoise on different Pokemon',
 {timeout:25000},async()=>{
 const t=Teams.unpack(parseTeamInput(luke));
 const first=[t[4],t[5],t[0],t[1],t[2],t[3]];
 const pack=Teams.pack(first);
 const foe=Teams.pack(Array.from({length:6},(_,i)=>({name:'Magikarp'+i,species:'Magikarp',ability:'Swift Swim',level:100,nature:'Hardy',moves:['Splash','Tackle']})));
 const game=await createShowdownBattle({p1team:pack,p2team:foe,p1name:'Luke',p2name:'Rivale'});
 const logs=[],errors=[];
 let mega=false,switched=false,gmax=false,firstRequest=null;
 const read=async side=>{
  for await(const chunk of game[side]){
   for(const line of String(chunk).split('\n')){
    if(line.startsWith('|error|'))errors.push(side+': '+line);
    if(!line.startsWith('|request|'))continue;
    const request=JSON.parse(line.slice(9));
    if(request.wait)continue;
    let choice=null;
    if(side==='p1'&&request.active){
     firstRequest ||= request;
     const available=legalChoices(request);
     if(!mega){choice=available.find(c=>c==='move 1 mega');if(choice)mega=true;}
     else if(!switched&&available.includes('switch 2')){choice='switch 2';switched=true;}
     else if(switched&&!gmax){choice=available.find(c=>c==='move 1 dynamax');if(choice)gmax=true;}
    }
    choice ||=selectAiFallback(request);
    if(choice)await game.choose(side,choice);
   }
  }
 };
 const watch=async()=>{
  for await(const chunk of game.spectator){
   for(const line of String(chunk).split('\n')){
    if(line.startsWith('|'))logs.push(line);
    if(line.startsWith('|win|')||line.startsWith('|tie|'))return;
   }
  }
 };
 try{
  const pending=[read('p1'),read('p2')];
  await Promise.race([watch(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Timeout real G-Max battle')),20000))]);
  assert.deepEqual(errors,[]);
  assert.ok(mega&&switched&&gmax,'Player used both mechanics in real simulator');
  assert.ok(logs.some(line=>line.startsWith('|-mega|p1a: Aerodactyl|')),'Real Mega Aerodactyl');
  assert.ok(logs.some(line=>line.startsWith('|-start|p1a: Blastoise|Dynamax')),'Real Dynamax/Gigamax activation');
  assert.ok(logs.some(line=>line.startsWith('|move|p1a: Blastoise|G-Max Cannonade|')),'Real G-Max move from engine, not a UI substitution');
  assert.ok(logs.some(line=>line.startsWith('|win|')),'Simulator terminal verdict recorded');
  assert.ok(firstRequest?.side?.pokemon?.[0]?.item==='Aerodactylite','Held item stays in private simulator request');
 }finally{await game.close();}
});
