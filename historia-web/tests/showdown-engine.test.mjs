import test from 'node:test';
import assert from 'node:assert/strict';
import {createShowdownBattle} from '../showdown-engine.mjs';
test('rifiuta squadre mancanti prima di caricare il simulatore',async()=>{
 await assert.rejects(createShowdownBattle({p1team:'',p2team:'abc'}),/due squadre/);
 await assert.rejects(createShowdownBattle({p1team:'abc'}),/due squadre/);
});
