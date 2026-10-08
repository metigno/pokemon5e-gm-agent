import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrainerCheckAdapter } from '../src/gm-live/trainer-check-adapter.mjs';

test('missing trainer ability sheet is rejected',async()=>{
 const engine=createTrainerCheckAdapter();
 assert.equal((await engine.validateAction({campaign:{character:{}},intent:{text:'Climb',kind:'trainer-check',ability:'STR',dc:10}})).allowed,false);
});
test('proficient check cannot silently use zero proficiency',async()=>{
 const engine=createTrainerCheckAdapter();
 const campaign={character:{abilities:{STR:15}}};
 assert.equal((await engine.validateAction({campaign,intent:{text:'Climb',kind:'trainer-check',ability:'STR',dc:10,proficient:true}})).allowed,false);
});
