function mod(score){return Math.floor((Number(score??10)-10)/2);}
const PATHS=Object.freeze({
 "Tactician":{resource:{id:"tactical-points",name:"Tactical Points",level:2,recharge:"long-rest",max:({level})=>level},features:{2:"tactical-healing",5:"directed-strike",9:"raise-your-defenses",15:"not-this-time"}},
 "Poké Mentor":{resource:{id:"cheerleader",name:"Cheerleader",level:9,recharge:"short-rest",max:()=>1},features:{2:"double-tm-use",5:"retention",9:"cheerleader",15:"master-teacher"}},
 "Pokémon Collector":{resource:{id:"gotta-catch-em-all",name:"Gotta Catch 'Em All",level:5,recharge:"long-rest",max:()=>1},features:{2:"animal-handling-expertise",5:"gotta-catch-em-all",9:"disciplined-strikes",15:"expert-tracker"}},
 "Ace Trainer":{resource:{id:"battle-dice",name:"Battle Dice",level:5,recharge:"long-rest",die:({level})=>level>=15?"d10":level>=9?"d8":"d6",max:({abilities})=>Math.max(1,1+mod(abilities?.DEX))},features:{2:"ace-trainer",5:"battle-master",9:"tactical-mastery",15:"rapid-switching"}},
 "Commander":{features:{2:"commander-bond",5:"follow-me",9:"show-me-what-youve-got",15:"were-a-team"}}
});
export function trainerPathRuntime(path,{level,abilities={}}){
 const def=PATHS[path]; if(!def)return {features:[],resources:{}};
 const features=Object.entries(def.features).filter(([n])=>level>=Number(n)).map(([,id])=>id);
 const resources={}; const r=def.resource;
 if(r&&level>=r.level){const max=r.max({level,abilities});resources[r.id]={name:r.name,current:max,max,recharge:r.recharge,...(r.die?{die:r.die({level,abilities})}:{})};}
 return {features,resources};
}
export function trainerPathDefinition(path){return PATHS[path]??null;}
