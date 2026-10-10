import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeLog} from '../server.mjs';

test('estrae turni, mosse, KO e vincitore da un log Showdown',()=>{
 const log='|turn|1\n|move|p1a: Arcanine|Flare Blitz|p2a: Garchomp\n|faint|p2a: Garchomp\n|turn|2\n|win|Luke';
 const result=summarizeLog(log);
 assert.equal(result.turns,2);
 assert.equal(result.winner,'Luke');
 assert.equal(result.events.filter(e=>e.type==='move').length,1);
 assert.equal(result.events.filter(e=>e.type==='faint').length,1);
});
test('non inventa un vincitore quando il log è incompleto',()=>{
 assert.equal(summarizeLog('|turn|1\n|switch|p1a: Venusaur|Venusaur').winner,null);
});
test('rifiuta payload di log troppo grandi',()=>{
 assert.throws(()=>summarizeLog('x'.repeat(40001)),/Log non valido/);
});
