import test from 'node:test';
import assert from 'node:assert/strict';
import {createGroupSchedule,finalizedGroupStandings} from '../../historia/src/schedule.mjs';
test('Playoffs rank only equal KO subsets and cannot demote the uniquely resolved KO leader',()=>{
 const groups=Object.fromEntries([... 'ABCDEFGH'].map(g=>[g,['A','B','C','D'].map(id=>({id:g==='A'?id:g+id}))]));
 const schedule=createGroupSchedule(groups);
 const outcomes=[['A','B','A',3],['B','C','B',1],['A','C','C',1],['A','D','A',1],['B','D','B',3],['C','D','C',1]];
 for(const g of schedule.filter(g=>g.group==='A')){
  const [a,b,w,ko]=outcomes.find(([a,b])=>[a,b].includes(g.homeId)&&[a,b].includes(g.awayId));
  const l=w===a?b:a;g.status='complete';g.result={authority:'showdown-verified',winnerId:w,loserId:l,koDifferential:{[w]:ko,[l]:-ko}};
 }
 let error;try{finalizedGroupStandings(schedule,'A');}catch(e){error=e;}
 assert.deepEqual(new Set(error.tiedIds),new Set(['B','C']));
 const ranked=finalizedGroupStandings(schedule,'A',{playoffOrders:{'6:1':['C','B']}});
 assert.deepEqual(ranked.map(r=>r.id),['A','C','B','D']);
});
