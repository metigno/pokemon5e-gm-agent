import test from 'node:test';
import assert from 'node:assert/strict';
import {selectTacticalChoice,resolveAiProfile,AI_PROFILES} from '../tactical-ai.mjs';
import {legalChoices} from '../showdown-protocol.mjs';

const own=(species,condition='100/100',active=true)=>({ident:'p2a: '+species,details:species+', L100',active,condition});
const req=(species,moves,{hp='100/100',bench=[],props={}}={})=>({
 active:[{moves:moves.map(([move,pp=15])=>({move,id:move.toLowerCase().replace(/[^a-z0-9]/g,''),pp})),...props}],
 side:{pokemon:[own(species,hp),...bench.map(([s,h])=>own(s,h,false))]}
});
const foe=species=>'|switch|p1a: Rivale|'+species+', L100|100/100\n|turn|1\n';

test('the AI selects a four-times-effective second move over its first move, based on public type only',()=>{
 const request=req('Venusaur',[['Sludge Bomb'],['Giga Drain'],['Earth Power']]);
 const choice=selectTacticalChoice(request,{side:'p2',profile:'luke',publicLog:foe('Swampert')});
 assert.equal(choice,'move 2');
 assert.ok(legalChoices(request).includes(choice));
});
test('the Five have distinct stable profiles and favor different decisions when appropriate',()=>{
 for(const id of ['luke','mattew','daniel','edward','fab','balanced'])assert.ok(AI_PROFILES[id]);
 assert.equal(resolveAiProfile('nonexisting'),'balanced');
 const request=req('Arcanine',[['Toxic'],['Tackle']]);
 const log=foe('Gyarados');
 assert.equal(selectTacticalChoice(request,{side:'p2',profile:'daniel',publicLog:log}),'move 1');
 assert.equal(selectTacticalChoice(request,{side:'p2',profile:'edward',publicLog:log}),'move 2');
});
test('the controller recovers at critical HP, instead of mindlessly attacking',()=>{
 const request=req('Blastoise',[['Surf'],['Recover']],{hp:'12/100'});
 assert.equal(selectTacticalChoice(request,{side:'p2',publicLog:foe('Jolteon')}),'move 2');
});
test('the controller switches on a dangerous publicly observable matchup when a healthy alternative exists',()=>{
 const request=req('Charizard',[['Air Slash']],{hp:'12/100',bench:[['Venusaur','100/100']]});
 assert.equal(selectTacticalChoice(request,{side:'p2',profile:'luke',publicLog:foe('Swampert')}),'switch 2');
});
test('the controller uses Mega when its own private legal request actually offers it',()=>{
 const request=req('Venusaur',[['Sludge Bomb']],{props:{canMegaEvo:true}});
 assert.equal(selectTacticalChoice(request,{side:'p2',profile:'luke',publicLog:foe('Blastoise')}),'move 1 mega');
 const noMega=req('Venusaur',[['Sludge Bomb']]);
 assert.equal(selectTacticalChoice(noMega,{side:'p2',profile:'luke',publicLog:foe('Blastoise')}),'move 1');
});
test('forced switches are chosen from legal living members and do not use opponent-private information',()=>{
 const request={...req('Venusaur',[['Tackle']],{bench:[['Pikachu','0 fnt'],['Blastoise','80/100'],['Machamp','25/100']]}),forceSwitch:[true]};
 assert.equal(selectTacticalChoice(request,{side:'p2',publicLog:foe('Gengar')}),'switch 3');
 assert.deepEqual(legalChoices(request),['switch 3','switch 4']);
});
test('no unrevealed opponent team, items, moves or ability are needed or read',()=>{
 const request=req('Arcanine',[['Flare Blitz'],['Close Combat']]);
 const log='|turn|1\n'; // public spectator has not announced the opposing active
 const neutral=selectTacticalChoice(request,{side:'p2',profile:'luke',publicLog:log});
 const poisoned={...request,opponent:{team:[{species:'Tyranitar',moves:['Stone Edge'],item:'Assault Vest',ability:'Sand Stream'}]}};
 assert.equal(selectTacticalChoice(poisoned,{side:'p2',profile:'luke',publicLog:log}),neutral);
 assert.ok(legalChoices(request).includes(neutral));
});
test('AI respects disabled moves, no-Dynamax forms, and waiting requests',()=>{
 const request=req('Zacian',[['Behemoth Blade'],['Protect']],{props:{canDynamax:true}});
 request.active[0].moves[0].disabled=true;
 assert.equal(selectTacticalChoice(request,{side:'p2',profile:'edward',publicLog:foe('Tyranitar')}),'move 2');
 assert.equal(selectTacticalChoice({wait:true},{side:'p2'}),null);
});
test('public state can contain fainted opponents without feeding unrevealed replacement data',()=>{
 const request=req('Venusaur',[['Tackle'],['Giga Drain']]);
 const log=foe('Swampert')+'|faint|p1a: Swampert\n';
 assert.equal(selectTacticalChoice(request,{side:'p2',publicLog:log}),'move 2'); // stronger move, not an assumed next opponent
});
