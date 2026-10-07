function mod(score){return Math.floor((Number(score??10)-10)/2);}
function proficiencyBonus(level){return 2+Math.floor((Number(level)-1)/4);}
const PATHS=Object.freeze({
 "Ace Trainer":{resource:{id:"battle-dice",name:"Battle Dice",level:5,recharge:"long-rest",die:({level})=>level>=15?"d10":level>=9?"d8":"d6",max:({abilities})=>Math.max(1,1+mod(abilities?.DEX))},features:{2:"ace-trainer",5:"battle-master",9:"tactical-mastery",15:"rapid-switching"}},
 "Hobbyist":{resource:{id:"skill-dice",name:"Skill Dice",level:5,recharge:"long-rest",die:({level})=>level>=15?"d10":level>=9?"d8":"d6",max:({abilities})=>Math.max(1,1+mod(abilities?.WIS))},features:{2:"hobbyist",5:"versatile",9:"generalist",15:"multitalented"}},
 "Poké Mentor":{resource:{id:"cheerleader",name:"Cheerleader",level:9,recharge:"short-rest",max:()=>1},features:{2:"double-tm-use",5:"retention",9:"cheerleader",15:"master-teacher"}},
 "Researcher":{resource:{id:"understanding",name:"Understanding",level:2,recharge:"long-rest",max:({level})=>proficiencyBonus(level)},features:{2:"understanding",5:"analyst",9:"evolution-expert",15:"professor"}},
 "Pokémon Collector":{resource:{id:"gotta-catch-em-all",name:"Gotta Catch 'Em All",level:5,recharge:"long-rest",max:()=>1},features:{2:"animal-handling-expertise",5:"gotta-catch-em-all",9:"disciplined-strikes",15:"expert-tracker"}},
 "Nurse":{resource:{id:"pokechef",name:"Pokéchef",level:5,recharge:"long-rest",max:({level})=>proficiencyBonus(level)},features:{2:"nurturing-touch",5:"pokechef",9:"field-medic",15:"tip-top-shape"}},
 "Type Master":{features:{2:"type-master",5:"drawing-power",9:"storing-power",15:"releasing-power"}},
 "Commander":{features:{2:"commander-bond",5:"follow-me",9:"show-me-what-youve-got",15:"were-a-team"}},
 "Grunt":{resource:{id:"shadow-points",name:"Shadow Points",level:2,recharge:"long-rest",max:({level})=>level},features:{2:"sabotage",5:"dark-advantage",9:"sinister-dodge",15:"nefarious-stagger"}},
 "Tactician":{resource:{id:"tactical-points",name:"Tactical Points",level:2,recharge:"long-rest",max:({level})=>level},features:{2:"tactical-healing",5:"directed-strike",9:"raise-your-defenses",15:"not-this-time"}},
 "Ranger":{features:{2:"ranger",5:"capture-styler",9:"partners",15:"poke-assist"}},
 "Guru":{resource:{id:"spirit",name:"Spirit",level:15,recharge:"long-rest",max:({abilities})=>Math.max(1,1+mod(abilities?.WIS))},features:{2:"guru",5:"mind",9:"body",15:"spirit"}},
 "Pokémon Breeder":{features:{2:"breeder",5:"tender-love-and-care",9:"good-genes",15:"enhanced-diversity"}}
});
export function trainerPathRuntime(path,{level,abilities={}}){
 const def=PATHS[path]; if(!def)return {features:[],resources:{}};
 const features=Object.entries(def.features).filter(([n])=>level>=Number(n)).map(([,id])=>id);
 const resources={}; const r=def.resource;
 if(r&&level>=r.level){const max=r.max({level,abilities});resources[r.id]={name:r.name,current:max,max,recharge:r.recharge,...(r.die?{die:r.die({level,abilities})}:{})};}
 return {features,resources};
}
export function trainerPathDefinition(path){return PATHS[path]??null;}
export function trainerPathNames(){return Object.keys(PATHS);}
