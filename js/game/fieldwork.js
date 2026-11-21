import { el } from '../core/util.js';
import { Sound } from '../core/audio.js';
import { thumbOfModel } from '../gfx/thumbs.js';
import { UI } from '../ui/ui.js';
import { G, save } from './game.js';
import { S, addMoney } from './state.js';
import { action, life } from './workshop.js';

const specimens = [
  { model:'weed1', name:'갈래풀', detail:'가운데 줄기 끝이 뾰족하고 잎이 여러 갈래로 퍼진다.' },
  { model:'weed2', name:'노란 끝풀', detail:'곧게 선 줄기 맨 위에 동그란 노란 눈이 달린다.' },
  { model:'sapling', name:'어린나무', detail:'한 줄기에 넓은 잎이 달린다. 밭에 남겨 키운다.' }
];
const questions = ['가운데 끝이 뾰족하고 잎이 사방으로 퍼진 표본은?', '줄기 끝에 노란 눈이 달린 표본은?', '넓은 잎이 난 어린 줄기예요. 밭에 남겨 키울 표본은?'];
export const certifiedPlots = [[2.7,8.9],[4.65,7.2],[6.25,6.15]];
export const story = () => life().story ||= {};
export const gradeWork = () => {
  const s=story();
  if(s.gradeWork?.day!==S.day)s.gradeWork={day:S.day,picked:[],active:false,paid:false};
  return s.gradeWork;
};
export function specimenAt(i,advanced=false){return (S.day+i+(advanced?1:0))%2;}
export function plantModel(i,advanced=false){return specimens[specimenAt(i,advanced)].model;}
export function modelImage(model,alt,opts={}){
  const img=el('img','story-art');img.alt=alt;img.src=thumbOfModel(model,opts);return img;
}
function shuffle(list){
  const out=[...list];
  for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
  return out;
}
function choices(box,order,select){
  const row=el('div','story-cards');
  for(const index of order){
    const p=specimens[index],btn=action(row,p.name,()=>select(index));
    btn.prepend(modelImage(p.model,''));btn.classList.add('story-choice');
  }
  box.append(row);
}
export function study(){
  const box=el('div','story-page');
  box.append(el('p','note','하치와레　“풀잎만 보니까 헷갈리더라. 끝에 뭐가 달렸는지도 그려 두면 어떨까?”'));
  for(const p of specimens){
    const row=el('div','story-specimen'),text=el('div');
    text.append(el('b','',p.name),el('p','',p.detail));row.append(modelImage(p.model,''),text);box.append(row);
  }
  UI.openPanel('하치와레와 풀 뽑기 공부',box);
}
function drawExam(){
  const s=story(),exam=s.exam,box=el('div','story-page');
  if(!exam)return;
  const question=exam.questions[exam.step];
  box.append(el('p','story-count','풀 뽑기 검정 5급　'+(exam.step+1)+' / 3'),el('h3','',questions[question]));
  const step=exam.step;
  choices(box,exam.orders[step],answer=>{
    if(s.exam!==exam || exam.step!==step)return;
    if(answer===question)exam.score++;
    exam.step++;
    if(exam.step<3){save();drawExam();return;}
    s.exam=null;s.posted={score:exam.score,number:exam.number};save();
    const sent=el('div','story-page');
    sent.append(el('h3','','답안지를 제출했어요.'),el('p','story-seal','수험 번호　'+exam.number),
      el('p','note','들녘 남쪽, 귀갓길 왼쪽의 나무 게시판에서 내 번호를 찾아보세요.'));
    action(sent,'게시판 보러 가기',()=>UI.closePanel());UI.openPanel('풀 뽑기 검정 접수처',sent);
  });
  UI.openPanel('풀 뽑기 검정 시험장',box);
}
export function openResults(){
  const s=story(),entry=s.posted;
  if(!entry)return;
  const passed=entry.score===3,box=el('div','story-page'),list=el('div','story-roll');
  const number=entry.number;
  const others=[number-6,number-3,number+2,number+5];
  if(passed)others.splice(2,0,number);
  for(const n of others)list.append(el('span',n===number?'story-seal':'',String(n)));
  s.examScore=entry.score;s.posted=null;if(passed)s.grade=5;save();
  box.append(el('p','story-count','내 수험 번호　'+number),el('h3','','5급 합격자 명단'),list,
    el('p','',passed?'내 번호가 있어요! 접수처에서 5급 구역 일감을 받을 수 있어요.':'이번 명단에는 내 번호가 없어요. 연습하고 다시 도전할 수 있어요.'),
    el('p','note','맞힌 문제　'+entry.score+' / 3'));
  if(!passed)action(box,'연습장 펼치기',study);
  UI.openPanel('들녘 합격 게시판',box);Sound.sfx(passed?'fanfare':'ui');
}
function startExam(){
  const s=story();if(s.grade===5)return;
  if(s.posted)return;
  if(!s.exam)s.attempts=(s.attempts||0)+1;
  s.exam ||= {number:102+((S.day*17+s.attempts*31)%800),questions:shuffle([0,1,2]),orders:Array.from({length:3},()=>shuffle([0,1,2])),step:0,score:0};
  save();drawExam();
}
export function fieldDesk(box,room){
  const s=story(),w=gradeWork();
  action(box,'하치와레의 풀 연습장',study);
  if(s.posted){box.append(el('p','note','수험 번호 '+s.posted.number+' · 귀갓길 왼쪽 게시판에서 결과를 확인하세요.'));return;}
  if(s.grade!==5){action(box,s.exam?'5급 시험 이어 풀기':'풀 뽑기 5급 응시',startExam);return;}
  box.append(el('span','story-seal','풀 뽑기 5급'));
  if(w.paid){box.append(el('p','note','오늘의 5급 작업을 마쳤어요.'));return;}
  if(!w.active)action(box,'5급 구역 일감 받기',()=>{
    if(w!==gradeWork() || w.active)return;
    w.active=true;save();room.gradePlants.forEach(o=>o.visible=true);UI.closePanel();UI.toast('서쪽 밭 세 곳에서 작업표와 같은 풀을 골라 주세요.');
  });
  else if(w.picked.length===3)action(box,'5급 작업 보수 받기 · 200 도토리',()=>{
    if(w!==gradeWork() || w.paid || !w.active || w.picked.length!==3)return;
    w.paid=true;addMoney(200);s.gradeJobs=(s.gradeJobs||0)+1;save();
    UI.closePanel();Sound.sfx('coin');UI.toast('5급 구역 보수 200 도토리를 받았어요.');
  });
  else box.append(el('p','note','서쪽 5급 구역 · '+w.picked.length+' / 3곳 완료'));
}
export function inspectPlot(room,i,advanced,record,onPick){
  if(record.picked.includes(i))return;
  const target=specimenAt(i,advanced),box=el('div','story-page');
  box.append(el('p','story-count',(advanced?'5급 구역':'일반 구역')+'　'+(i+1)+'번 밭'),
    el('h3','',advanced?'작업표의 특징을 보고 풀을 고르세요.':'오늘 작업표와 같은 풀을 뽑으세요.'),
    el('p','note',advanced?specimens[target].detail:specimens[target].name+'을 모으는 날이에요. 어린나무는 남겨 주세요.'));
  const status=el('p','story-status');status.setAttribute('aria-live','polite');
  choices(box,shuffle([0,1,2]),n=>{
    if(G.room!==room || record.day!==S.day || record.picked.includes(i))return;
    if(n!==target){status.textContent=n===2?'어린나무예요. 잎을 남겨 두고 다시 살펴보세요.':'작업표와 달라요. 줄기의 끝을 비교해 보세요.';return;}
    UI.closePanel();G.player.do('pick',.3);onPick();
  });
  box.append(status);UI.openPanel('풀밭 살펴보기',box);
}
export function journal(){
  const s=story(),box=el('div','story-page');
  const rescue=['동굴 등불 마을 동쪽 구덩이를 살펴보기','구덩이 곁에서 치이카와 만나기','서쪽 작은 나무 아래 덩굴 찾기','구덩이로 덩굴 가져가기','파란 사스마타 되찾기','두 친구와 함께 올라오기','두 친구와 무사히 귀환'][s.rescue||0];
  for(const [title,detail] of [
    ['풀 뽑기 검정',s.grade===5?'5급 보유 · 특별 작업 '+(s.gradeJobs||0)+'회 완료':s.posted?'수험 번호 '+s.posted.number+' · 들녘 남쪽 게시판에서 결과 확인':s.exam?'응시 중 · '+s.exam.step+' / 3문제 완료':'풀잎 들녘에서 공부하고 5급 시험 보기'],
    ['구덩이에 빠진 하치와레',rescue],
    ['라멘 가게 로(郎)','라멘 골목에서 시사와 주문 맞추기 · 내어 준 그릇 '+(s.servings||0)+'개'],
    ['토벌', '완료 보고 '+life().hunts+'건 · 풀잎 들녘의 노동 갑옷 씨에게 접수']
  ]){const row=el('div','story-line');row.append(el('b','',title),el('p','',detail));box.append(row);}
  const sources=el('details','story-sources');
  sources.append(el('summary','','이야기의 원작 출처'),el('p','note','풀 뽑기 검정과 보수, 구덩이에 빠진 하치와레, 라멘 가게 로의 주문 방식을 바탕으로 만들었어요. 시험 문제와 보수 액수, 구조 신호는 이 마을의 플레이 규칙이에요.'));
  for(const [label,url] of [
    ['공식 애니메이션 인물 소개','https://www.anime-chiikawa.jp/chara.html'],
    ['나가노의 풀 뽑기 만화','https://x.com/ngnchiikawa/status/2026294080075157730'],
    ['애니메이션 31화 · 구덩이에 빠진 하치와레','https://times.abema.tv/articles/-/10171077'],
    ['고단샤 · 라멘 가게 로','https://cocreco.kodansha.co.jp/genki/news/genki-news/LW56A']
  ]){
    const link=el('a','',label);link.href=url;link.target='_blank';link.rel='noopener noreferrer';sources.append(link);
  }
  box.append(sources);UI.openPanel('먼작귀 생활 수첩',box);
}
