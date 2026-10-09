/**
 * Read-only replay model. Every frame is derived from the *public spectator*
 * transcript of a completed, server-verified Pokémon Showdown battle.
 *
 * This is a visual event timeline, not a re-simulation or Showdown replay file.
 * Unknown effects are not inferred; HP is shown only when Showdown made it public.
 */
const sideOf=actor=>{
 const match=/^(p[12])a:/.exec(String(actor||''));
 return match?.[1]||null;
};
const clone=value=>JSON.parse(JSON.stringify(value));
const safeText=value=>String(value??'').slice(0,160);
function hpInfo(condition){
 const text=String(condition||'');
 const m=/^(\d+)\/(\d+)/.exec(text);
 if(m && Number(m[2])>0)return {hp:Math.max(0,Math.min(100,Math.round(100*Number(m[1])/Number(m[2])))),fainted:Number(m[1])===0};
 const pct=/^(\d+)%/.exec(text);
 if(pct)return {hp:Math.max(0,Math.min(100,Number(pct[1]))),fainted:Number(pct[1])===0};
 if(/fnt/.test(text))return {hp:0,fainted:true};
 return {hp:null,fainted:false};
}
const emptyMon=()=>({name:null,species:null,hp:null,status:null,fainted:false,mega:false,dynamax:false,gigantamax:false});
const newFrame=(turn,field)=>({turn,field:clone(field),events:[]});
const IMPORTANT=new Set(['faint','mega','dynamax','critical','superEffective','win','tie']);
export function buildReplayTimeline(log){
 if(typeof log!=='string'||log.length>1800000)throw Error('Log pubblico Showdown non valido');
 const lines=log.split(/\r?\n/);
 if(lines.length>10000)throw Error('Log replay oltre limite');
 const field={p1:emptyMon(),p2:emptyMon()};
 const frames=[newFrame(0,field)];
 let current=frames[0],winner=null,tied=false,totalMoves=0;
 const stats={p1:{moves:0,switches:0,faints:0,mega:0,dynamax:0},p2:{moves:0,switches:0,faints:0,mega:0,dynamax:0}};
 const highlights=[];
 const emit=(type,side,actor,detail)=>{
  const event={type,side:side||null,actor:safeText(actor),detail:safeText(detail)};
  current.events.push(event);
  if(IMPORTANT.has(type) && highlights.length<150)
   highlights.push({turn:current.turn,...event});
 };
 const finish=()=>{current.field=clone(field);};
 for(const line of lines){
  if(!line||!line.startsWith('|'))continue;
  const p=line.split('|'),tag=p[1],actor=p[2]||'',side=sideOf(actor);
  if(tag==='turn'){
   const t=Number(p[2]);
   if(!Number.isInteger(t)||t<1||t>1000)continue;
   finish();
   current=newFrame(t,field);frames.push(current);
   continue;
  }
  if(['switch','drag','replace'].includes(tag)&&side){
   const species=safeText((p[3]||'').split(',')[0]);
   const name=safeText(actor.split(': ').slice(1).join(': ')||species);
   field[side]={...emptyMon(),name,species,...hpInfo(p[4])};
   stats[side].switches++;
   emit('switch',side,name,species);
   continue;
  }
  if(['detailschange','-formechange'].includes(tag)&&side){
   // Showdown can publish a forme change separately from the initial switch:
   // Gigantamax and Mega sprites must come from its real public protocol.
   field[side].species=safeText((p[3]||'').split(',')[0]);
   field[side].mega=field[side].mega||/mega/i.test(field[side].species||'');
   field[side].gigantamax=/-gmax$/i.test(field[side].species||'');
   continue;
  }
  if((tag==='-damage'||tag==='-heal')&&side){
   Object.assign(field[side],hpInfo(p[3]));
   const status=/\b(brn|par|tox|psn|slp|frz)\b/.exec(String(p[3]||''));
   if(status)field[side].status=status[1];
   emit(tag==='-damage'?'damage':'heal',side,field[side].name,p[3]);
   continue;
  }
  if(tag==='-status'&&side){field[side].status=safeText(p[3]);emit('status',side,actor,p[3]);continue;}
  if(tag==='-curestatus'&&side){field[side].status=null;emit('cureStatus',side,actor,p[3]);continue;}
  if(tag==='move'&&side){
   totalMoves++;stats[side].moves++;emit('move',side,actor,p[3]);continue;
  }
  if(tag==='faint'&&side){
   field[side].hp=0;field[side].fainted=true;stats[side].faints++;emit('faint',side,actor,'KO');continue;
  }
  if(tag==='-mega'&&side){field[side].mega=true;stats[side].mega++;emit('mega',side,actor,p[3]||'Mega Evoluzione');continue;}
  if(tag==='-dynamax'&&side){if(!field[side].dynamax){field[side].dynamax=true;stats[side].dynamax++;emit('dynamax',side,actor,'Dynamax');}continue;}
  if(tag==='-start'&&side&&String(p[3]).toLowerCase()==='dynamax'){
   if(!field[side].dynamax){field[side].dynamax=true;stats[side].dynamax++;emit('dynamax',side,actor,'Dynamax');}continue;
  }
  if(tag==='-end'&&side&&String(p[3]).toLowerCase()==='dynamax'){field[side].dynamax=false;emit('dynamaxEnd',side,actor,'Dynamax terminato');continue;}
  if(tag==='-crit'){emit('critical',side,actor,'Colpo critico');continue;}
  if(tag==='-supereffective'){emit('superEffective',side,actor,'Superefficace');continue;}
  if(tag==='-weather'){emit('weather',null,'Meteo',p[2]);continue;}
  if(tag==='win'){winner=safeText(p[2]);emit('win',null,'Risultato',winner);continue;}
  if(tag==='tie'){tied=true;emit('tie',null,'Risultato','Pareggio');continue;}
 }
 finish();
 const clean=frames.filter((f,i)=>i>0||f.events.length>0);
 const turns=clean.reduce((max,f)=>Math.max(max,f.turn),0);
 return {turns,winner,tie:tied,frames:clean,stats,totalMoves,highlights};
}
export function renderTechnicalReport(timeline,{p1name='Luke',p2name='NPC'}={}){
 if(!timeline||!Array.isArray(timeline.frames))throw Error('Timeline non valida');
 const {turns,stats,highlights}=timeline;
 const ordered=highlights.filter(h=>['faint','mega','dynamax','critical'].includes(h.type));
 const chosen=ordered.slice(0,12).map(h=>({
  turn:h.turn,type:h.type,actor:h.actor,detail:h.detail,
  description:h.type==='faint'?h.actor+' va KO':
   h.type==='mega'?h.actor+' effettua la Mega Evoluzione':
   h.type==='dynamax'?h.actor+' utilizza Dynamax':
   h.actor+' subisce un colpo critico'
 }));
 return {
  status:timeline.tie?'tie':timeline.winner?'complete':'unverified',
  result:timeline.tie?'Pareggio Showdown':timeline.winner?'Vincitore Showdown: '+timeline.winner:'Risultato non disponibile',
  turns,
  trainers:[
   {name:p1name,side:'p1',...stats.p1},
   {name:p2name,side:'p2',...stats.p2}
  ],
  keyMoments:chosen,
  caveat:'Conteggi e momenti sono solo eventi osservati nel log pubblico Showdown. Non dimostrano errori, prediction, motivazioni o probabilità senza analisi aggiuntiva.'
 };
}
