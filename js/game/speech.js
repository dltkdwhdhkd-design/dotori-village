import { VILLAGERS, PERSONALITY } from '../data/villagers.js';
import { voice } from '../data/voices.js';
import { Dialog, fill } from '../ui/ui.js';
import { S } from './state.js';

export function speak(n,line,vars={}){
  const def=VILLAGERS[n.id], values={p:S.player.name,v:S.village.name,...vars};
  const words=typeof line==='string'?line:line.words;
  return Dialog.say(n.name||def.name,fill(words,values),{
    actor:words?n.actor:null,pitch:n.pitch||PERSONALITY[def.p].pitch,
    gesture:line.gesture?fill(line.gesture,values):''
  });
}
export function speakScene(n,cue,vars){return speak(n,voice(n.id,cue),vars);}
