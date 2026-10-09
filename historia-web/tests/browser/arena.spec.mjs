import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function ephemeralPort(){
 const socket=createServer();
 socket.listen(0,'127.0.0.1');await once(socket,'listening');
 const port=socket.address().port;
 await new Promise((resolve,reject)=>socket.close(error=>error?reject(error):resolve()));
 return port;
}
async function bootServer(port,dataDir,{accounts=false}={}){
 const child=spawn(process.execPath,['server.mjs'],{
  cwd:new URL('../../',import.meta.url).pathname,
  env:{...process.env,PORT:String(port),HISTORIA_DATA_DIR:dataDir,OPENAI_API_KEY:'',NODE_ENV:'test',HISTORIA_PUBLIC_ORIGIN:'',HISTORIA_AUTH_MODE:accounts?'accounts':'capability'},
  stdio:['ignore','pipe','pipe']
 });
 let output='';
 child.stdout.on('data',v=>{output+=String(v).slice(0,2000);});
 child.stderr.on('data',v=>{output+=String(v).slice(0,2000);});
 const base='http://127.0.0.1:'+port;
 for(let attempt=0;attempt<120;attempt++){
  if(child.exitCode!==null)throw Error('Historia server exited early: '+output);
  try{
   const response=await fetch(base+'/api/status',{signal:AbortSignal.timeout(550)});
   if(response.ok)return {child,base};
  }catch{}
  await sleep(100);
 }
 child.kill();
 throw Error('Historia startup failed: '+output);
}
async function stopServer(child){
 if(!child||child.exitCode!==null)return;
 const done=once(child,'exit').catch(()=>{});
 child.kill('SIGTERM');
 await done;
}
async function withoutRemoteSprites(page){
 await page.route('https://play.pokemonshowdown.com/**',route=>route.abort());
}

test('Desktop and touch mobile show a usable Arena without horizontal page overflow',async({page},testInfo)=>{
 await withoutRemoteSprites(page);
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/verso il mondiale 2060/i})).toBeVisible();
 await page.locator('nav button[data-view="arena"]').click();
 await expect(page.locator('#practice')).toBeVisible();
 await expect(page.locator('#npcProfile')).toBeVisible();
 const widths=await page.evaluate(()=>({
  viewport:document.documentElement.clientWidth,
  page:document.documentElement.scrollWidth,
  arena:document.querySelector('#arena').getBoundingClientRect().width
 }));
 expect(widths.page).toBeLessThanOrEqual(widths.viewport+2);
 expect(widths.arena).toBeLessThanOrEqual(widths.viewport);
 if(testInfo.project.name.includes('mobile')){
  const measured=await page.locator('#practice').boundingBox();
  expect(measured?.height).toBeGreaterThanOrEqual(44);
  expect(await page.locator('#mode').evaluate(x=>getComputedStyle(x).width)).toBeTruthy();
 }
 await page.locator('#npcProfile').selectOption('edward');
 await expect(page.locator('#npcProfile')).toHaveValue('edward');
});

test('Real touch-compatible manual choices are sent to Showdown, not a mock',async({page})=>{
 await withoutRemoteSprites(page);
 await page.goto('/');
 await page.locator('nav button[data-view="arena"]').click();
 await page.locator('#mode').selectOption('manual');
 await page.locator('#practice').click();
 await expect(page.locator('#battleStatus')).toContainText('Luke vs AI',{timeout:15000});
 await expect.poll(async()=>page.locator('#choices button').count(),{timeout:20000}).toBeGreaterThan(0);
 const first=page.locator('#choices button').first();
 await first.click();
 await expect(page.locator('#battleLog')).toContainText('|turn|',{timeout:30000});
 await expect(page.locator('#p1hp')).toBeVisible();
 await expect(page.locator('#p2hp')).toBeVisible();
 await expect(page.locator('#p1active')).toContainText('PS');
 expect(await page.locator('#arenaError').textContent()).toBe('');
});

test('Completed 6v6 visual replay, scrub and analysis survive a real Node restart',async({page})=>{
 test.setTimeout(115000);
 await withoutRemoteSprites(page);
 const dataDir=await mkdtemp(join(tmpdir(),'historia-browser-restart-'));
 const port=await ephemeralPort();
 let running=null;
 try{
  running=await bootServer(port,dataDir);
  await page.goto(running.base);
  await page.locator('nav button[data-view="arena"]').click();
  await page.locator('#mode').selectOption('auto');
  await page.locator('#npcProfile').selectOption('daniel');
  await page.locator('#practice').click();
  await expect(page.locator('#battleStatus')).toContainText('Vittoria confermata Showdown',{timeout:75000});
  await expect(page.locator('#openReplay')).toBeEnabled();
  const session=await page.evaluate(()=>localStorage.getItem('historia-session-id'));
  const battleId=await page.evaluate(()=>localStorage.getItem('historia-last-battle'));
  expect(session).toMatch(/^[0-9a-f]{40}$/);
  expect(battleId).toMatch(/^[0-9a-f-]{36}$/);
  const reportResponse=await page.request.get(running.base+'/api/battles/'+battleId+'/analysis',{headers:{'x-historia-session':session}});
  expect(reportResponse.status()).toBe(200);
  const initialReport=await reportResponse.json();
  expect(initialReport.verified).toBe(true);
  await page.locator('#openReplay').click();
  await expect(page.locator('#replayPanel')).toBeVisible();
  await expect(page.locator('#replayInfo')).toContainText('Fotogramma 1');
  const lastFrame=Number(await page.locator('#replaySeek').getAttribute('max'));
  expect(lastFrame).toBeGreaterThan(1);
  await page.locator('#replayNext').click();
  await expect(page.locator('#replayInfo')).toContainText('Fotogramma 2');
  await page.locator('#replaySeek').focus();await page.keyboard.press('End');
  await expect(page.locator('#replayInfo')).toContainText('Fotogramma '+(lastFrame+1));
  await expect(page.locator('#analysisSummary')).toContainText('Vincitore Showdown:');
  await page.locator('#replayPlay').click();
  await expect(page.locator('#replayPlay')).toContainText('Pausa');
  await page.locator('#replayPlay').click();
  await expect(page.locator('#replayPlay')).toContainText('Riproduci');
  await stopServer(running.child);running=null;
  running=await bootServer(port,dataDir);
  await page.reload();
  await page.locator('nav button[data-view="arena"]').click();
  await expect(page.locator('#battleStatus')).toContainText('Vittoria confermata Showdown',{timeout:15000});
  await page.locator('#openReplay').click();
  await expect(page.locator('#replayPanel')).toBeVisible();
  const replay=await page.request.get(running.base+'/api/battles/'+battleId+'/replay',{headers:{'x-historia-session':session}});
  expect(replay.status()).toBe(200);
  const replayBody=await replay.json();
  expect(replayBody.timeline.winner).toBe(initialReport.report.result.replace('Vincitore Showdown: ',''));
  expect(replayBody.verified).toBe(true);
  const list=await page.request.get(running.base+'/api/battles',{headers:{'x-historia-session':session}});
  expect((await list.json()).battles.some(item=>item.id===battleId)).toBe(true);
  const foreign=await page.request.get(running.base+'/api/battles/'+battleId+'/replay',{headers:{'x-historia-session':'e'.repeat(40)}});
  expect(foreign.status()).toBe(404);
 }finally{
  await stopServer(running?.child);
  await rm(dataDir,{recursive:true,force:true});
 }
});


test('Mid-battle manual Luke choice survives a real Node crash and remains playable on browser restore',async({page})=>{
 test.setTimeout(95000);
 await withoutRemoteSprites(page);
 const directory=await mkdtemp(join(tmpdir(),'historia-live-browser-restart-'));
 const port=await ephemeralPort();
 let instance=null;
 try{
  instance=await bootServer(port,directory);
  await page.goto(instance.base);
  await page.locator('nav button[data-view="arena"]').click();
  await page.locator('#mode').selectOption('manual');
  await page.locator('#practice').click();
  await expect.poll(()=>page.locator('#choices button').count(),{timeout:20000}).toBeGreaterThan(0);
  const session=await page.evaluate(()=>localStorage.getItem('historia-session-id'));
  const id=await page.evaluate(()=>localStorage.getItem('historia-last-battle'));
  let before;
  for(let i=0;i<2;i++){
   const current=await page.request.get(instance.base+'/api/battles/'+id,{headers:{'x-historia-session':session}});
   const state=await current.json();
   const command=state.choices.find(v=>/^move \d+$/.test(v))||state.choices[0];
   expect(command).toBeTruthy();
   const move=await page.request.post(instance.base+'/api/battles/'+id+'/choice',{
    headers:{'x-historia-session':session,'content-type':'application/json'},
    data:{choice:command,requestId:state.requestId}
   });
   expect(move.status()).toBe(200);
   await expect.poll(async()=>{
    const r=await page.request.get(instance.base+'/api/battles/'+id,{headers:{'x-historia-session':session}});
    const next=await r.json();
    before=next;
    return next.requestId;
   },{timeout:20000}).toBeGreaterThan(state.requestId);
  }
  const oldTurn=before.turn,oldRequest=before.requestId,oldLog=before.log;
  expect(oldLog).toContain('|turn|');
  await stopServer(instance.child);instance=null;
  instance=await bootServer(port,directory);
  await page.reload();
  await page.locator('nav button[data-view="arena"]').click();
  let recoveredState=null;
  try{await expect.poll(async()=>{
   const response=await page.request.get(instance.base+'/api/battles/'+id,{headers:{'x-historia-session':session}});
   const payload=await response.json();
   recoveredState={http:response.status(),status:payload.status,error:payload.error,
    requestId:payload.requestId,choices:payload.choices?.length};
   if(!response.ok)throw new Error('Server recovery '+JSON.stringify(recoveredState));
   return payload.choices?.length||0;
  },{timeout:20000}).toBeGreaterThan(0);}catch(e){throw new Error('Recovery API did not expose a legal choice: '+JSON.stringify(recoveredState)+'; '+e.message);}
  await expect.poll(async()=>{
   const buttons=await page.locator('#choices button').count();
   if(!buttons){
    const uiError=await page.locator('#arenaError').textContent();
    if(uiError)throw new Error('UI recovery '+uiError+'; API '+JSON.stringify(recoveredState));
   }
   return buttons;
  },{timeout:10000}).toBeGreaterThan(0);
  const restored=(await (await page.request.get(instance.base+'/api/battles/'+id,{
   headers:{'x-historia-session':session}
  })).json());
  expect(restored.status).toBe('active');
  expect(restored.turn).toBe(oldTurn);
  expect(restored.requestId).toBeGreaterThan(oldRequest);
  expect(restored.log).toBe(oldLog);
  await page.locator('#choices button').first().click();
  await expect.poll(async()=>{
   const response=await page.request.get(instance.base+'/api/battles/'+id,{headers:{'x-historia-session':session}});
   return (await response.json()).requestId;
  },{timeout:20000}).toBeGreaterThan(oldRequest);
  const forbidden=await page.request.get(instance.base+'/api/battles/'+id,{
   headers:{'x-historia-session':'f'.repeat(40)}
  });
  expect(forbidden.status()).toBe(404);
 }finally{
  await stopServer(instance?.child);
  await rm(directory,{recursive:true,force:true});
 }
});


test('Strict browser CSP blocks newly injected inline JavaScript while Arena remains usable',async({page})=>{
 await withoutRemoteSprites(page);
 await page.goto('/');
 const ran=await page.evaluate(async()=>{
  const script=document.createElement('script');
  script.textContent='window.__historiaUnexpectedCodeRan = true;';
  document.body.append(script);
  await new Promise(resolve=>setTimeout(resolve,10));
  return window.__historiaUnexpectedCodeRan===true;
 });
 expect(ran).toBe(false,'An unauthorized inline script must not execute');
 await page.locator('nav button[data-view="arena"]').click();
 await expect(page.locator('#practice')).toBeVisible();
});


test('Real Chromium local accounts: registration, cookie session, Arena access and logout-all survive restart',async({page})=>{
 test.setTimeout(90000);
 await withoutRemoteSprites(page);
 const directory=await mkdtemp(join(tmpdir(),'historia-auth-browser-'));
 const port=await ephemeralPort();
 let running=null;
 try{
  running=await bootServer(port,directory,{accounts:true});
  await page.goto(running.base);
  await expect(page.locator('#accountPanel')).toBeVisible();
  await expect(page.locator('#legacySession')).toBeHidden();
  await expect(page.locator('#accountUsername')).toBeVisible();
  await page.locator('#accountUsername').fill('BrowserPlayer');
  await page.locator('#accountPassword').fill('secure-historia-account-password');
  await page.locator('#accountRegister').click();
  await expect(page.locator('#accountStatus')).toContainText('browserplayer',{timeout:25000});
  await expect(page.locator('#accountLogoutAll')).toBeVisible();
  const cookies=await page.context().cookies();
  const authCookie=cookies.find(c=>c.name==='historia-local');
  expect(authCookie?.httpOnly).toBe(true);
  expect(authCookie?.sameSite).toBe('Strict');
  await page.locator('nav button[data-view="arena"]').click();
  await page.locator('#practice').click();
  await expect(page.locator('#battleStatus')).toContainText('Luke vs AI',{timeout:16000});
  const battleId=await page.evaluate(()=>localStorage.getItem('historia-last-battle'));
  expect(battleId).toMatch(/^[a-f0-9-]{36}$/);
  await stopServer(running.child);running=null;
  running=await bootServer(port,directory,{accounts:true});
  await page.reload();
  await expect(page.locator('#accountStatus')).toContainText('browserplayer');
  await page.locator('nav button[data-view="arena"]').click();
  await expect.poll(()=>page.locator('#choices button').count(),{timeout:20000}).toBeGreaterThan(0);
  await page.locator('#accountLogoutAll').click();
  await expect(page.locator('#accountStatus')).toContainText('Accedi');
  const denied=await page.request.get(running.base+'/api/battles/'+battleId);
  expect(denied.status()).toBe(401);
  await page.locator('#accountUsername').fill('BrowserPlayer');
  await page.locator('#accountPassword').fill('secure-historia-account-password');
  await page.locator('#accountLogin').click();
  await expect(page.locator('#accountStatus')).toContainText('browserplayer');
  await page.locator('nav button[data-view="arena"]').click();
  await expect.poll(()=>page.locator('#choices button').count(),{timeout:20000}).toBeGreaterThan(0);
  const restored=await page.request.get(running.base+'/api/battles/'+battleId);
  expect(restored.status()).toBe(200);
 }finally{
  await stopServer(running?.child);
  await rm(directory,{recursive:true,force:true});
 }
});
