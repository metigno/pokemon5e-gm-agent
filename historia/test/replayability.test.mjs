import test from 'node:test';
import assert from 'node:assert/strict';
import {startNewTournament,restoreTournament} from '../src/tournament.mjs';
const entrants=Array.from({length:32},(_,i)=>({id:`p${i}`,rankingPoints:1000-i}));
test('new games use new seeds and draws',()=>{const a=startNewTournament(entrants,()=>1),b=startNewTournament(entrants,()=>2);assert.notDeepEqual(a.groups,b.groups);assert.notEqual(a.editionId,b.editionId)});
test('reload preserves tournament exactly',()=>{const t=startNewTournament(entrants,()=>123);const copy=restoreTournament(JSON.parse(JSON.stringify(t)));assert.deepEqual(copy,t)});
test('later world cups use four-year cadence',()=>{assert.equal(startNewTournament(entrants,()=>7,2064).year,2064);assert.throws(()=>startNewTournament(entrants,()=>7,2062))});
test('invalid RNG is rejected',()=>{assert.throws(()=>startNewTournament(entrants,()=>-1));assert.throws(()=>startNewTournament(entrants,()=>1.2))});
