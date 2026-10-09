import test from 'node:test';import assert from 'node:assert/strict';
import {parseShowdownOutcome,applyAuthoritativeShowdownResult} from '../src/showdown-bridge.mjs';
const match={id:'2060-GA-D1-M1',homeId:'luke',awayId:'red',status:'scheduled'};
const log='|player|p1|Luke|\n|player|p2|Red|\n|turn|1\n|win|Luke';
test('parse terminal winner from Showdown protocol',()=>{const r=parseShowdownOutcome(log);assert.equal(r.winnerName,'Luke');assert.equal(r.loserName,'Red');assert.match(r.logDigest,/^sha256:/)});
test('reject incomplete logs and ties',()=>{assert.throws(()=>parseShowdownOutcome('|player|p1|Luke|\n|player|p2|Red|'));assert.throws(()=>parseShowdownOutcome('|player|p1|Luke|\n|player|p2|Red|\n|tie|'))});
test('require trusted server and matching players',()=>{const input={battleId:'battle-gen9customgame-1',log,playerNames:{luke:'Luke',red:'Red'}};assert.throws(()=>applyAuthoritativeShowdownResult([match],match.id,input),/verification/);const updated=applyAuthoritativeShowdownResult([match],match.id,{...input,verifiedByServer:true});assert.equal(updated[0].result.winnerId,'luke');assert.equal(updated[0].status,'complete');assert.throws(()=>applyAuthoritativeShowdownResult([match],match.id,{...input,verifiedByServer:true,playerNames:{luke:'Other',red:'Red'}}))});
