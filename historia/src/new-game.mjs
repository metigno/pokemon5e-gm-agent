import {randomBytes} from 'node:crypto';
import {startNewTournament} from './tournament.mjs';
import {createGroupSchedule} from './schedule.mjs';
/** New Game only: save returned object immediately. Loading must never redraw. */
export function createNewWorldCup(confirmedQualifiers,year=2060){
 const cup=startNewTournament(confirmedQualifiers,()=>randomBytes(4).readUInt32BE(0),year);
 return {...cup,schedule:createGroupSchedule(cup.groups,year),saveVersion:1};
}
