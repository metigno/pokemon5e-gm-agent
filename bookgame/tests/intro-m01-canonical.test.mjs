import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { compileStory } from "../src/compiler/story-compiler.mjs";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const scenesDir=fileURLToPath(new URL("../content/scenes/",import.meta.url));
const modulesDir=fileURLToPath(new URL("../content/modules/",import.meta.url));

async function engine(){
 const bundle=await compileStory({scenesDir,modulesDir});
 return new BookgameEngine({scenes:{async load(id){return structuredClone(bundle.scenes[id]);}}});
}

test("fresh save starts in canonical Intro/M1 and not in free roam", async()=>{
 const e=await engine(); const s=createNewGameState({protagonist:"Luke"});
 assert.equal(s.story.sceneId,"intro-m01");
 assert.equal(s.story.nodeId,"trainer_specialization");
 assert.equal(s.world.flags.character_creation_complete,false);
 assert.equal(s.world.flags.intro_complete,false);
 assert.equal(s.world.flags.free_roam,false);
 assert.equal(s.world.flags.tutorial_skipped,undefined);
 const v=await e.present(s); assert.match(v.text,/Specialization/i);
});

test("specialization is persisted before tutorial choice", async()=>{
 const e=await engine(); let s=createNewGameState({protagonist:"Luke"});
 s=await e.choose(s,"specialization_fire");
 assert.equal(s.player.trainerClass,"pokemon-trainer");
 assert.equal(s.player.trainerPath,null);
 assert.equal(s.player.specializations.fire,1);
 assert.equal(s.player.characterCreation.complete,true);
 assert.equal(s.world.flags.character_creation_complete,true);
 assert.equal(s.story.nodeId,"tutorial_choice");
 assert.equal(s.world.flags.intro_complete,false);
});

test("tutorial cannot be reported skipped unless player explicitly skips it", async()=>{
 const e=await engine(); let s=createNewGameState({protagonist:"Luke"});
 s=await e.choose(s,"specialization_fire");
 s=await e.choose(s,"play_tutorial");
 assert.equal(s.world.flags.tutorial_skipped,false);
 assert.equal(s.story.nodeId,"tutorial_rules");
 s=await e.choose(s,"finish_tutorial");
 assert.equal(s.world.flags.tutorial_complete,true);
 s=await e.choose(s,"enter_m1");
 assert.equal(s.world.flags.intro_complete,true);
 assert.equal(s.world.flags.free_roam,true);
 assert.equal(s.story.sceneId,"m01-release");
});

test("explicit tutorial skip is durable and still requires release step", async()=>{
 const e=await engine(); let s=createNewGameState({protagonist:"Luke"});
 s=await e.choose(s,"specialization_fire");
 s=await e.choose(s,"skip_tutorial");
 assert.equal(s.world.flags.tutorial_skipped,true);
 assert.equal(s.world.flags.intro_complete,false);
 assert.equal(s.story.nodeId,"release");
 s=await e.choose(s,"enter_m1");
 assert.equal(s.world.flags.intro_complete,true);
 assert.equal(s.world.flags.free_roam,true);
});
