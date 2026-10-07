'use strict';
const $=id=>document.getElementById(id),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=new Date(),season=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(date).replace(/[^0-9]/g,'');
const hash=s=>[...s].reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619)>>>0,2166136261);
const elements=['지','수','화','풍'],featured=elements[hash(season)%4],seasonKey='manduk-tactics-season-'+season,saveKey='manduk-tactics-run-'+season;
const pool=elements.flatMap(e=>PETS.map((p,id)=>({...p,id})).filter(p=>p.element===e).sort((a,b)=>hash(season+a.name)-hash(season+b.name)).slice(0,6)).sort((a,b)=>(a.atk+a.def+a.spd)-(b.atk+b.def+b.spd));
const catalog=new Map(elements.flatMap(e=>pool.filter(p=>p.element===e).map((p,i)=>[p.id,{...p,cost:[1,1,2,3,4,5][i],heal:p.passive.includes('치유')}] )));
const shuffled=list=>{const copy=list.slice();for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;};
const profileKey='manduk-tactics-profile-v1';
let profile=null,portraitChoice=0;
try{const x=JSON.parse(localStorage.getItem(profileKey)||'null');if(x&&typeof x.id==='string'&&typeof x.name==='string'&&x.name.trim()&&Number.isInteger(x.avatar)&&PETS[x.avatar])profile=x;}catch{}
const items={
  vitality:{name:'생명의 씨앗',icon:'heart',text:'최대 체력 +10%',hp:1.10},
  fang:{name:'용기의 송곳니',icon:'swords',text:'공격력 +12%',atk:1.12},
  feather:{name:'바람 깃털',icon:'wind',text:'공격 간격 10% 감소',speed:.90},
  shell:{name:'수호의 껍질',icon:'shield',text:'피해 감소 +7%p (최대 55%)',armor:.07},
  spring:{name:'샘물 부적',icon:'water',text:'공격력 +8% · 회복량 +18%',atk:1.08,heal:1.18},
  stone:{name:'산의 심장',icon:'earth',text:'최대 체력 +6% · 피해 감소 +3%p',hp:1.06,armor:.03}
};
function role(d){return d.heal?'치유형':skillFor(d)==='guard'||d.def>=10?'수비형':['fireball','freeze','tide'].includes(skillFor(d))?'원거리형':'공격형';}
function sale(u){return pet(u).cost*3**(u.star-1);}
function isLootRound(){return state.round%4===0;}
function gearHtml(u){return u.item?`<span class="gear-mark" title="${items[u.item].name}"><img src="assets/gear-${u.item}.png" alt="${items[u.item].name}"></span>`:'';}
const grades=['','일반','고급','희귀','영웅','전설'];
const skills={heal:{name:'생명의 손길',icon:'heart',text:'가장 다친 아군 1마리를 공격력의 145%만큼 회복합니다. 치유 조합 효과도 적용됩니다.'},guard:{name:'대지의 갑옷',icon:'shield',text:'자신에게 공격력의 100% 보호막을 얻고 120% 피해로 공격합니다. 보호막은 최대 체력의 50%까지 쌓입니다.'},quake:{name:'지진 강타',icon:'earth',text:'대상에게 150% 피해, 대상 주변의 다른 적 최대 2마리에게 75% 피해를 줍니다.'},freeze:{name:'빙결 송곳니',icon:'water',text:'155% 피해를 주고 3초 동안 대상의 이동 속도를 30% 낮추며 공격 간격을 40% 늘립니다.'},tide:{name:'회복의 파도',icon:'water',text:'체력이 가장 낮은 아군 최대 2마리를 각각 공격력의 85%만큼 회복합니다. 치유 조합 효과도 적용됩니다.'},fireball:{name:'화염 폭발',icon:'fire',text:'대상에게 165% 피해, 대상 주변의 다른 적 최대 2마리에게 65% 피해를 줍니다.'},burn:{name:'불꽃 낙인',icon:'fire',text:'165% 피해를 주고 3초 동안 초당 공격력의 30% 화상 피해를 줍니다. 화상은 중첩되지 않고 새 화상으로 갱신됩니다.'},flurry:{name:'질풍 연격',icon:'wind',text:'대상에게 공격력의 80% 피해로 3번 연속 공격합니다.'},gale:{name:'바람의 가호',icon:'wind',text:'150% 피해로 공격하고 3초 동안 자신의 공격 간격을 20% 줄입니다.'}};
function skillFor(d){return d.heal?'heal':({지:['guard','quake'],수:['freeze','tide'],화:['fireball','burn'],풍:['flurry','gale']})[d.element][hash(d.name)%2];}
let state,selected=null,inspected=null,shopViewed=null,scoutIndex=null,toastTimer,busy=false,combat=null,animation=0,last=0,elapsed=0,seasonRecord={games:0,wins:0,best:5};
const pet=u=>catalog.get(u.id),uid=()=>crypto.randomUUID(),user=()=>state.players[0],units=p=>p.roster.filter(u=>u.slot!==null);
const paths={flag:'M5 21V3m0 1h14l-3 5 3 5H5',coins:'M3 6c0-4 18-4 18 0s-18 4-18 0m0 0v6c0 4 18 4 18 0V6M3 12v6c0 4 18 4 18 0v-6',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',star:'m12 3 3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1z',swords:'M4 3 21 20m-5 1 5-5M20 3 3 20m0-5 6 6M4 3v5h5m11-5v5h-5',heart:'M12 21 3 12C-3 5 6-1 12 6c6-7 15-1 9 6z',shield:'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6z',book:'M12 5v16M2 3c4-1 7 0 10 2 3-2 6-3 10-2v15c-4-1-7 0-10 3-3-3-6-4-10-3z',trophy:'M7 3h10v7c0 7-10 7-10 0zM7 5H3v4c0 3 4 4 4 4m10-8h4v4c0 3-4 4-4 4m-5 2v6m-5 0h10',paw:'M8 13c-8 8 1 10 4 7 3 3 12 1 4-7-2-3-6-3-8 0M4 5v3m5-6v4m6-4v4m5-1v3',bag:'M4 7h16l1 14H3zM8 7V5a4 4 0 0 1 8 0v2'};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.star}"/></svg>`;
Object.assign(paths,{eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12m7 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0',refresh:'M20 8a8 8 0 1 0 0 8m0-14v6h-6',wind:'M2 8h14a3 3 0 1 0-3-3M2 12h18a3 3 0 1 1-3 3M2 16h9',water:'M12 2C9 7 4 10 4 15a8 8 0 0 0 16 0c0-5-5-8-8-13z',fire:'M13 2c2 7-3 6-1 10 2-1 3-3 3-5 8 9 6 15-3 15S1 15 7 9c0 4 2 4 2 4s-1-6 4-11',earth:'M12 21V5M12 16C0 16 2 5 2 5s10-2 10 11m0-3c0-10 10-10 10-10s2 10-10 10',warning:'m12 3 10 18H2zM12 9v5m0 3v1'});
const elementIcon=e=>icon(({지:'earth',수:'water',화:'fire',풍:'wind'})[e]);
const badge=e=>`<span class="element-badge" data-element="${e}">${elementIcon(e)}${e} 속성</span>`;
paths.home='m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7';
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
const portraits=PETS.map(p=>p.img);
function avatar(p){return `<span class="portrait player-${state.players.indexOf(p)}"><img src="${portraits[p.avatar]||portraits[state.players.indexOf(p)]}" alt=""></span>`;}
function message(text){$('message').textContent=text;}
function warn(text){message(text);clearTimeout(toastTimer);const el=$('toast');el.innerHTML=`${icon('warning')}<div><b>잠깐! 확인해주세요</b><span>${escape(text)}</span></div>`;el.hidden=false;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');toastTimer=setTimeout(()=>{el.classList.remove('show');setTimeout(()=>{if(!el.classList.contains('show'))el.hidden=true;},350);},3300);}
function prepareAI(){if(state.ended||state.aiPreparedRound===state.round)return;state.players.slice(1).forEach(aiPrepare);state.aiPreparedRound=state.round;remember();}
function remember(){try{localStorage.setItem(saveKey,JSON.stringify(state));}catch{message('진행 저장이 차단됐어요. 이 화면에서 계속 플레이할 수 있습니다.');}}
function record(){try{localStorage.setItem(seasonKey,JSON.stringify(seasonRecord));}catch{}}
function createPlayer(name){return {name,hp:40,gold:12,level:3,xp:0,roster:[],shop:[],wins:0,place:null,inventory:[],avatar:Math.floor(Math.random()*PETS.length)};}
const shopOdds={3:[75,25,0,0,0],4:[50,35,15,0,0],5:[30,35,25,10,0],6:[15,25,30,23,7]};
function offer(p){const odds=shopOdds[p.level];let roll=Math.random()*100,cost=1;for(let i=0;i<odds.length;i++){roll-=odds[i];if(roll<0){cost=i+1;break;}}const choices=pool.filter(x=>catalog.get(x.id).cost===cost);return choices[Math.floor(Math.random()*choices.length)].id;}
function startingPets(p){for(const [i,d] of shuffled(pool.filter(x=>catalog.get(x.id).cost===1)).slice(0,3).entries()){add(p,d.id);p.roster.at(-1).slot=[4,5,1][i];}}
function shop(p){p.shop=Array.from({length:5},()=>offer(p));}
function add(p,id){p.roster.push({id,uid:uid(),star:1,slot:null});merge(p);}
function merge(p){
  for(let star=1;star<3;star++)for(const id of catalog.keys()){
    let copies=p.roster.filter(u=>u.id===id&&u.star===star);
    while(copies.length>=3){
      copies.sort((a,b)=>(a.slot===null)-(b.slot===null));const kept=copies[0],removed=copies.slice(1,3).map(u=>u.uid);kept.star++;
      for(const copy of copies.slice(1,3))if(copy.item){if(!kept.item)kept.item=copy.item;else p.inventory.push({uid:uid(),id:copy.item});}
      p.roster=p.roster.filter(u=>!removed.includes(u.uid));copies=p.roster.filter(u=>u.id===id&&u.star===star);
    }
  }
}
function fresh(){
  if(busy)return;
  if(state&&profile&&state.rankStarted&&!state.resultRecorded&&!finishRecord(state.ended?user().place:5,!state.ended))return;
  state={runId:uid(),rankStarted:!!profile,season,rosterVersion:3,shopOddsVersion:2,round:1,ended:false,players:[createPlayer(profile?.name||'나',null),...['숲길 탐험가','별빛 여행자','달빛 조련사','새벽 모험가'].map(name=>createPlayer(name,null))],log:[]};
  for(const p of state.players){
    startingPets(p);shop(p);
  }
  user().avatar=profile?.avatar??0;
  selected=null;inspected=null;shopViewed=null;scoutIndex=null;prepareAI();remember();render();message('기본 페트 3마리가 배치돼 있어요. 구매·합성하거나 바로 전투를 시작하세요.');
}
function valid(s){return s&&s.season===season&&Number.isInteger(s.round)&&s.round>=1&&s.round<=18&&Array.isArray(s.players)&&[4,5].includes(s.players.length)&&s.players.every(p=>typeof p.name==='string'&&Number.isFinite(p.hp)&&Number.isFinite(p.gold)&&p.gold>=0&&Number.isInteger(p.level)&&p.level>=3&&p.level<=6&&Array.isArray(p.roster)&&p.roster.length<=14&&p.roster.every(u=>catalog.has(u.id)&&[1,2,3].includes(u.star)&&typeof u.uid==='string'&&(u.slot===null||(Number.isInteger(u.slot)&&u.slot>=0&&u.slot<8)))&&Array.isArray(p.shop)&&p.shop.length===5&&p.shop.every(id=>id===null||catalog.has(id)))&&Array.isArray(s.log);}
try{const data=JSON.parse(localStorage.getItem(seasonKey)||'null');if(data&&Number.isInteger(data.games)&&Number.isInteger(data.wins)&&Number.isInteger(data.best))seasonRecord=data;const saved=JSON.parse(localStorage.getItem(saveKey)||'null');if(valid(saved)){
state=saved;
for(const p of state.players){p.inventory=Array.isArray(p.inventory)?p.inventory.filter(i=>items[i.id]&&typeof i.uid==='string'):[];p.avatar=Number.isInteger(p.avatar)&&PETS[p.avatar]?p.avatar:Math.floor(Math.random()*PETS.length);for(const u of p.roster)if(!items[u.item])delete u.item;delete p.preference;}
if(state.players.length===4&&!state.ended){const ai=createPlayer('새벽 모험가',null),alive=state.players.filter(p=>p.hp>0);ai.hp=Math.max(1,Math.round(alive.reduce((n,p)=>n+p.hp,0)/alive.length));ai.gold=Math.floor(alive.reduce((n,p)=>n+p.gold,0)/alive.length);ai.level=Math.round(alive.reduce((n,p)=>n+p.level,0)/alive.length);for(const d of shuffled(pool.filter(d=>shopOdds[ai.level][catalog.get(d.id).cost-1]>0)).slice(0,ai.level)){add(ai,d.id);ai.roster.at(-1).slot=[4,5,6,7,0,1][ai.roster.length-1];}shop(ai);state.players.push(ai);aiPrepare(ai);}
}
}catch{}
function synergies(p){
  const unique=[...new Map(units(p).map(u=>[u.id,pet(u)])).values()],counts={},families={};
  for(const item of unique){counts[item.element]=(counts[item.element]||0)+1;families[item.category]=(families[item.category]||0)+1;}
  return {counts,families};
}
function stats(u,p){
  const d=pet(u),{counts,families}=synergies(p),baseHP=Math.max(180+d.cost*12,Math.min(185+d.cost*20,70+d.hp*3),d.heal?180+d.cost*18:0),baseAtk=Math.max(20+d.cost*3,Math.min(26+d.cost*3,8+d.atk*2.5),d.heal?26+d.cost*2:0),mult=1.8**(u.star-1),tier=(counts[d.element]||0)>=4?2:(counts[d.element]||0)>=2?1:0;
  const result={hp:Math.round((baseHP+Math.max(0,d.def-9)*5)*mult*(families[d.category]>=2?1.12:1)*(d.element==='지'?1+tier*.15:1)),atk:baseAtk*mult*(d.element==='화'?1+tier*.10:1)*(d.element===featured?1.05:1),armor:Math.min(.55,d.def*.02),cooldown:Math.max(.55,Math.min(d.heal?1.15:1.45,1.75-d.spd*.07))/(d.element==='풍'?1+tier*.12:1),heal:1+(d.element==='수'?tier*.25:0)};
  // Roles are derived from this game's skill and defence, not new codex facts.
  if(role(d)==='원거리형'){result.cooldown*=1.02;}
  if(d.cost===5){result.hp=Math.round(result.hp*1.06);result.atk*=1.06;}
  const item=items[u.item];if(item){result.hp=Math.round(result.hp*(item.hp||1));result.atk*=item.atk||1;result.cooldown*=item.speed||1;result.armor=Math.min(.55,result.armor+(item.armor||0));result.heal*=item.heal||1;}
  return result;
}
function strength(p){return units(p).reduce((sum,u)=>{const s=stats(u,p);return sum+s.hp*.12+s.atk/s.cooldown;},0);}
function slotHtml(u,slot,bench=false){return `<button class="slot ${u?'occupied':''} ${u?.uid===selected?'selected':''} ${u?'':'empty'}" ${u?`data-element="${pet(u).element}" data-cost="${pet(u).cost}"`:''} data-${bench?'bench':'slot'}="${u?u.uid:slot}" ${busy||state.ended?'disabled':''}>${u?`<span class="slot-element">${elementIcon(pet(u).element)}</span><img src="${pet(u).img}" alt=""><strong>${escape(pet(u).name)}</strong><small>${'★'.repeat(u.star)} · ${role(pet(u))}</small>${gearHtml(u)}<span class="unit-cost">${pet(u).cost}G</span>`:bench?'빈 칸':`배치 ${slot+1}`}</button>`;}
function render(){
  const p=user();$('season').textContent=`${season.slice(0,4)}.${season.slice(4)} 시즌 · ${featured} 속성 강화`;
  $('season-detail').innerHTML=`${badge(featured)}<strong>이번 달 공격력 +5%</strong><span>이 속성의 모든 페트에게 자동 적용</span><small>매월 등장 페트 24종과 강화 속성이 바뀝니다.</small>`;
  $('season-record').textContent=`이번 시즌 ${seasonRecord.games}전 ${seasonRecord.wins}승 · 최고 ${seasonRecord.games?seasonRecord.best:'—'}위`;
  $('round').textContent=`${state.round} / 18`;$('health').textContent=p.hp;$('gold').textContent=p.gold;$('level').textContent=`Lv.${p.level} · 최대 ${p.level}마리`;$('level-xp').textContent=p.level>=6?'최고 레벨':`다음 레벨까지 경험치 ${p.xp} / ${threshold(p)}`;
  $('phase').textContent=busy?'전투 진행 중':state.ended?'대회 종료':isLootRound()?'장비 탐험 라운드':'준비 단계';$('round-progress').style.width=state.round/18*100+'%';
  $('xp-progress').style.width=(p.level>=6?100:p.xp/(p.level*4)*100)+'%';$('income').textContent=`다음 보상 5G + 이자 ${Math.min(3,Math.floor(p.gold/10))}G ${isLootRound()?'':' + 승리 1G'}`;
  const opponents=state.players.filter(q=>q!==p&&q.hp>0),opponent=opponents[(state.round-1)%opponents.length];
  $('duel').innerHTML=`<div>${avatar(p)}<span><b>나의 편성</b><small>${units(p).length}마리 · ${p.wins}승</small></span></div><strong>VS</strong>${opponent?`<div><span><b>${escape(opponent.name)}</b><small>${opponent.wins}승 · ${isLootRound()?'이번 라운드는 장비 탐험':'랜덤 편성'}</small><a class="scout-link" href="#ai-scout">AI 편성 보기</a></span>${avatar(opponent)}</div>`:'<b>대회 종료</b>'}`;
  if(isLootRound()&&!state.ended)$('duel').innerHTML=`<div>${avatar(p)}<span><b>${escape(p.name)}</b><small>장비 탐험 · 체력 피해 없음</small></span></div><strong>VS</strong><div><span><b>탐험 수호자</b><small>쉬운 중립 봇 · 장비 1개 보장</small></span>${icon('shield')}</div>`;
  $('capacity').textContent=`배치 ${units(p).length} / ${p.level}마리`;
  $('standings').innerHTML=state.players.slice().sort((a,b)=>(a.place||0)-(b.place||0)||b.hp-a.hp).map(q=>`<div class="competitor player-${state.players.indexOf(q)} ${q===p?'mine':''} ${q.hp<=0?'out':''}"><div class="player-head">${avatar(q)}<div><small class="player-tag">${q===p?'YOU':q.hp<=0?'탈락':'AI'}</small><strong>${escape(q.name)}</strong></div></div><div class="hp"><i style="width:${Math.max(0,q.hp)/40*100}%"></i></div><span>${icon('heart')} ${Math.max(0,q.hp)} <b>${q.place?q.place+'위':q.wins+'승'}</b></span><small>${q===p?'내 편성':'랜덤 편성'} · ${units(q).length}마리</small></div>`).join('');
  $('board').innerHTML=[4,5,6,7,0,1,2,3].map(i=>slotHtml(p.roster.find(u=>u.slot===i),i)).join('');
  const reserves=p.roster.filter(u=>u.slot===null);$('bench').innerHTML=Array.from({length:6},(_,i)=>slotHtml(reserves[i],i,true)).join('');
  const {counts,families}=synergies(p);$('synergies').innerHTML=elements.map(e=>`<span data-element="${e}" class="synergy ${counts[e]>=2?'active':''}">${elementIcon(e)} ${e} ${counts[e]||0} / ${(counts[e]||0)>=2?4:2} · ${e==='지'?'체력':e==='수'?'치유':e==='화'?'공격':'속도'}</span>`).join('')+Object.entries(families).filter(([,v])=>v>=2).map(([f])=>`<span class="synergy active">${escape(f)} · 체력 +12%</span>`).join('');
  $('shop-odds').innerHTML=`<b>Lv.${p.level} 등장 확률</b>`+shopOdds[p.level].map((v,i)=>`<span data-cost="${i+1}">${i+1}G <strong>${v}%</strong></span>`).join('');
  $('shop').innerHTML=p.shop.map((id,i)=>{if(id===null)return '<div class="offer sold-offer">구매 완료</div>';const d=catalog.get(id);return `<article class="offer" data-element="${d.element}" data-cost="${d.cost}"><span class="grade-label">${grades[d.cost]} · ${d.cost}G</span><button class="offer-info ${shopViewed===id?'viewing':''}" data-shop-info="${id}" aria-label="${escape(d.name)} 정보 보기"><img src="${d.img}" alt=""><strong>${escape(d.name)}</strong>${badge(d.element)}<small class="role-label">${role(d)} · ${escape(d.category)}</small><small>${skills[skillFor(d)].name}</small><span>${icon('eye')} 정보 보기</span></button><button class="offer-buy" data-buy="${i}" ${busy||state.ended||p.gold<d.cost?'disabled':''}>${icon('coins')} 구매 · ${d.cost}G</button></article>`;}).join('');
  const chosen=p.roster.find(u=>u.uid===selected);$('sell').textContent=chosen?`판매 · ${sale(chosen)}G`:'선택한 페트 판매';$('deselect').disabled=!selected&&!inspected&&shopViewed===null;$('sell').disabled=busy||!chosen||state.ended;
  renderScout(opponent);const inspectPlayer=inspected&&state.players[inspected.index],inspectUnit=inspectPlayer?.roster.find(u=>u.uid===inspected.uid);
  if(inspectUnit){detail(inspectUnit,inspectPlayer);$('sell').disabled=true;}else if(chosen)detail(chosen,p);else if(shopViewed!==null&&catalog.has(shopViewed))detail({id:shopViewed,star:1},p,true);else $('pet-detail').innerHTML=`<div class="detail-empty">${icon('paw')}<h3>페트를 선택하세요</h3><p>내 전장·대기석 또는 상대 편성에서<br>페트를 누르면 능력치가 표시됩니다.</p></div>`;
  renderEquipment();
  $('ready').disabled=busy||state.ended||!units(p).length;$('ready').textContent=busy?'전투 중…':state.ended?'대회 종료':isLootRound()?'탐험 시작 · 장비 획득':'전투 시작';
  $('reroll').disabled=busy||state.ended||p.gold<2;$('experience').disabled=busy||state.ended||p.gold<4||p.level>=6;$('new-game').disabled=busy;
  $('log').innerHTML=state.log.slice(-8).reverse().map(text=>`<li>${escape(text)}</li>`).join('');
}
function statRow(label,value,type){return `<div class="stat-row stat-${type}"><dt>${icon(({hp:'heart',atk:'swords',def:'shield',spd:'wind'})[type])}${label}</dt><dd>${value}</dd></div>`;}
function detail(u,p,preview=false){const d=pet(u),s=stats(u,p),skill=skills[skillFor(d)];const html=`<div class="pet-portrait" data-element="${d.element}"><span>${preview?'상점 미리보기 · 구매 전':p===user()?'내 페트':escape(p.name)+' · 정찰 중'}</span><img src="${d.img}" alt="${escape(d.name)}"></div><div class="detail-name"><h3>${escape(d.name)}</h3><span class="stars">${'★'.repeat(u.star)}</span></div><div class="detail-tags">${badge(d.element)}<span class="grade-label" data-cost="${d.cost}">${grades[d.cost]} · ${d.cost}G</span><span>${escape(d.category)}</span><b class="role-label">${role(d)}</b></div><p class="item-summary">장비: ${u.item?items[u.item].name+' · '+items[u.item].text:'미장착 · 페트당 1개'}${p===user()&&!preview?'<br>판매 시 '+sale(u)+'G · 장비는 보관함으로 반환':''}</p><h4 class="stat-heading">도감 능력치</h4><dl class="stat-list">${statRow('체력',d.hp,'hp')}${statRow('공격력',d.atk,'atk')}${statRow('방어력',d.def,'def')}${statRow('순발력',d.spd,'spd')}</dl><h4 class="stat-heading">이번 편성의 전투 능력치</h4><dl class="stat-list combat-stats">${statRow('전투 체력',s.hp,'hp')}${statRow('전투 공격력',s.atk.toFixed(0),'atk')}${statRow('피해 감소',(s.armor*100).toFixed(0)+'%','def')}${statRow('공격 간격',s.cooldown.toFixed(2)+'초','spd')}</dl><div class="skill-description"><h4>${icon(skill.icon)} ${skill.name}</h4><p><b>4회 공격마다 발동</b><br>${skill.text}</p><small>도감 패시브: ${escape(d.passive)} · 전용 게임 효과</small></div>`;$('pet-detail').innerHTML=html;if(p!==user())$('scout-detail').innerHTML=html;}
function renderScout(opponent){
  if(!inspected)$('scout-detail').innerHTML='<p>상대 페트를 누르면 여기에 정보가 표시됩니다.</p>';
  if(scoutIndex===null)scoutIndex=opponent?state.players.indexOf(opponent):1;
  $('scout-tabs').innerHTML=state.players.slice(1).map((p,i)=>`<button data-scout="${i+1}" aria-pressed="${scoutIndex===i+1}" class="${scoutIndex===i+1?'active':''}" data-element="${featured}">${avatar(p)}<span>${escape(p.name)}<small>${p.hp<=0?'탈락':p===opponent?'이번 상대':'AI 참가자'}</small></span></button>`).join('');
  const p=state.players[scoutIndex];$('scout-summary').innerHTML=`<span>레벨 ${p.level} · 배치 ${units(p).length}/${p.level}</span><span>${p.hp<=0?'탈락한 참가자의 마지막 편성':busy?'전투에 참여한 편성':'이번 라운드 확정 편성'}</span>`;
  $('scout-board').innerHTML=[4,5,6,7,0,1,2,3].map(i=>{const u=p.roster.find(u=>u.slot===i);return u?`<button class="scout-unit ${inspected?.uid===u.uid?'selected':''}" data-inspect="${u.uid}" data-element="${pet(u).element}" data-cost="${pet(u).cost}"><span class="slot-element">${elementIcon(pet(u).element)}</span><img src="${pet(u).img}" alt=""><strong>${escape(pet(u).name)}</strong><small>${'★'.repeat(u.star)} · ${role(pet(u))}</small>${gearHtml(u)}<span class="unit-cost">${pet(u).cost}G</span></button>`:'<div class="scout-empty">빈 칸</div>';}).join('');
  const {counts,families}=synergies(p);$('scout-synergies').innerHTML=Object.entries(counts).map(([e,v])=>`<span data-element="${e}" class="synergy ${v>=2?'active':''}">${elementIcon(e)} ${e} ${v}/${v>=2?4:2}</span>`).join('')+Object.entries(families).filter(([,v])=>v>=2).map(([f])=>`<span class="synergy active">${escape(f)} · 체력 +12%</span>`).join('');
}
function buy(index){
  if(busy||state.ended)return;const p=user(),id=p.shop[index];if(id===null||!catalog.has(id))return;
  if(p.roster.filter(u=>u.slot===null).length>=6&&!p.roster.some(u=>u.id===id&&u.star===1&&p.roster.filter(v=>v.id===id&&v.star===1).length>=2)){warn('대기석이 가득 찼어요. 먼저 배치하거나 판매해주세요.');return;}
  if(p.gold<catalog.get(id).cost)return;p.gold-=catalog.get(id).cost;add(p,id);p.shop[index]=null;selected=p.roster.find(u=>u.id===id)?.uid;inspected=null;shopViewed=null;remember();render();message(`${catalog.get(id).name} 구매 완료. 같은 페트 3마리는 자동으로 합성됩니다.`);
}
function selectSlot(target){
  if(busy||state.ended)return;inspected=null;shopViewed=null;const p=user(),slot=Number(target),at=p.roster.find(u=>u.slot===slot),chosen=p.roster.find(u=>u.uid===selected);
  if(!chosen){selected=at?.uid||null;render();return;}
  if(at?.uid===chosen.uid){chosen.slot=null;selected=null;}
  else if(!at&&chosen.slot===null&&units(p).length>=p.level){warn(`레벨이 부족합니다. 현재 레벨 ${p.level}에서는 ${p.level}마리까지만 배치할 수 있어요. 경험치를 구매하거나 기존 페트를 대기석으로 옮겨주세요.`);return;}
  else{if(at)at.slot=chosen.slot;chosen.slot=slot;selected=null;}
  if(p.roster.filter(u=>u.slot===null).length>6){if(chosen.slot===null)chosen.slot=slot;message('대기석이 가득 차 있어요.');}
  remember();render();
}
function threshold(p){return p.level>=6?'MAX':p.level*4;}
function gainXP(p,amount){p.xp+=amount;while(p.level<6&&p.xp>=p.level*4){p.xp-=p.level*4;p.level++;}if(p.level>=6)p.xp=0;}
function aiPrepare(p){
  if(state.round===1)return;
  if(p.hp<=0)return;
  if(p.draftRound!==state.round){p.draftSeed=uid();p.draftRound=state.round;}
  if(state.round%3===0&&p.gold>=4&&p.level<6){p.gold-=4;gainXP(p,4);}
  for(let attempt=0;attempt<8&&p.gold>0;attempt++){
    const sorted=p.shop.map((id,i)=>({id,i})).filter(x=>x.id!==null&&catalog.get(x.id).cost<=p.gold).sort((a,b)=>aiValue(p,b.id)-aiValue(p,a.id));
    const choice=sorted[0];if(!choice)break;if(p.roster.length<12){p.gold-=catalog.get(choice.id).cost;add(p,choice.id);p.shop[choice.i]=null;}else break;
    if(p.shop.every(id=>id===null)&&p.gold>=2){p.gold-=2;shop(p);}
  }
  p.roster.sort((a,b)=>aiValue(p,b.id)*b.star-aiValue(p,a.id)*a.star);p.roster.forEach(u=>u.slot=null);
  const deployed=p.roster.slice(0,p.level).sort((a,b)=>(pet(b).def-pet(a).def));deployed.forEach((u,i)=>u.slot=[4,5,6,7,0,1][i]);
  equipAI(p);
  while(p.roster.length>p.level+6){const sold=p.roster.pop();p.gold+=sale(sold);if(sold.item)p.inventory.push({uid:uid(),id:sold.item});}
}
function aiValue(p,id){const d=catalog.get(id);return d.cost*8+hash(season+p.draftSeed+state.round+id)%25+p.roster.filter(u=>u.id===id&&u.star<3).length*7;}
function fighters(p,side){return units(p).map(u=>{const s=stats(u,p);if(p.neutral){s.hp=Math.round(s.hp*.6);s.atk*=.65;}return {...u,...s,max:s.hp,side,x:u.slot%4,y:side?Math.floor(u.slot/4):4-Math.floor(u.slot/4),wait:Math.random()*.4,hits:0,shield:0,slowUntil:0,hasteUntil:0,burnUntil:0,burnDps:0};});}
function makeCombat(a,b){return {a,b,time:0,done:false,winner:null,survivors:0,actors:[...fighters(a,0),...fighters(b,1)]};}
function tick(c,dt,visible=false){
  if(c.done)return;c.time+=dt;
  for(const f of c.actors){
    if(f.hp<=0)continue;if(f.burnUntil>c.time)takeDamage(f,f.burnDps*dt,false);if(f.hp<=0)continue;const enemies=c.actors.filter(t=>t.side!==f.side&&t.hp>0);if(!enemies.length)break;
    const target=enemies.sort((a,b)=>Math.hypot(a.x-f.x,a.y-f.y)-Math.hypot(b.x-f.x,b.y-f.y))[0],distance=Math.hypot(target.x-f.x,target.y-f.y);
    f.wait-=dt;
    const range=role(pet(f))==='원거리형'?2.6:1;
    if(distance>range){const move=Math.min(distance-range,dt*(.8+pet(f).spd*.04)*(f.slowUntil>c.time?.7:1));f.x+=(target.x-f.x)/distance*move;f.y+=(target.y-f.y)/distance*move;continue;}
    if(f.wait>0)continue;f.wait=f.cooldown*(f.slowUntil>c.time?1.4:1)*(f.hasteUntil>c.time?.8:1);f.hits++;const casting=f.hits%4===0;
    if(casting)castSkill(c,f,target,visible);else strike(f,target,1,visible);
    if(visible){const el=document.getElementById('fighter-'+f.uid);if(el){el.classList.remove('hit','cast');void el.offsetWidth;el.classList.add(casting?'cast':'hit');}}

  }
  const alive=[0,1].map(side=>c.actors.filter(f=>f.side===side&&f.hp>0));
  if(!alive[0].length||!alive[1].length||c.time>=24){
    const power=alive.map(list=>list.reduce((s,f)=>s+f.hp/f.max,0));c.winner=power[0]===power[1]?null:power[0]>power[1]?0:1;c.survivors=c.winner===null?0:alive[c.winner].length;c.done=true;
  }
}
function takeDamage(target,amount,visible=false){const blocked=Math.min(target.shield,amount);target.shield-=blocked;const damage=amount-blocked;target.hp=Math.max(0,target.hp-damage);if(visible&&amount>=1)effect(target,Math.round(damage),false,blocked>=amount?'방어':'');}
function strike(f,target,mult,visible){if(target.hp<=0)return;const advantage=elements[(elements.indexOf(pet(f).element)+1)%4]===pet(target).element?1.15:1;takeDamage(target,Math.max(1,Math.round(f.atk*(1-target.armor)*advantage*mult)),visible);}
function restore(ally,amount,visible){const gain=Math.min(ally.max-ally.hp,Math.round(amount));ally.hp+=gain;if(visible&&gain>0)effect(ally,gain,true);}
function castSkill(c,f,target,visible){
  const kind=skillFor(pet(f)),allies=c.actors.filter(t=>t.side===f.side&&t.hp>0).sort((a,b)=>a.hp/a.max-b.hp/b.max),near=c.actors.filter(t=>t!==target&&t.side!==f.side&&t.hp>0&&Math.hypot(t.x-target.x,t.y-target.y)<=1.8).slice(0,2);
  let mult=1;
  switch(kind){
    case 'heal':restore(allies[0],f.atk*1.45*f.heal,visible);break;
    case 'guard':f.shield=Math.min(f.max*.5,f.shield+f.atk*1.0);mult=1.2;if(visible)effect(f,Math.round(f.shield),true,'보호막');break;
    case 'quake':mult=1.5;near.forEach(t=>strike(f,t,.75,visible));break;
    case 'freeze':mult=1.55;target.slowUntil=c.time+3;break;
    case 'tide':allies.slice(0,2).forEach(t=>restore(t,f.atk*.85*f.heal,visible));break;
    case 'fireball':mult=1.65;near.forEach(t=>strike(f,t,.65,visible));break;
    case 'burn':mult=1.65;target.burnUntil=c.time+3;target.burnDps=f.atk*.3*(1-target.armor);break;
    case 'flurry':for(let i=0;i<3;i++)strike(f,target,.8,visible);mult=0;break;
    case 'gale':mult=1.5;f.hasteUntil=c.time+3;f.wait=f.cooldown*(f.slowUntil>c.time?1.4:1)*.8;break;
  }
  if(mult)strike(f,target,mult,visible);
  if(visible){const el=document.getElementById('fighter-'+f.uid);if(el){const label=document.createElement('span');label.className='skill-pop';label.textContent=skills[kind].name;el.append(label);setTimeout(()=>label.remove(),900);}c.lastSkill=pet(f).name+' · '+skills[kind].name;c.skillUntil=c.time+1.5;}
}
function effect(f,amount,heal=false,label=''){const el=document.getElementById('fighter-'+f.uid);if(!el)return;const text=document.createElement('span');text.className='damage'+(heal?' heal':'');text.textContent=label||(heal?'+':'−')+amount;el.append(text);setTimeout(()=>text.remove(),650);}
function paint(){for(const f of combat.actors){const el=document.getElementById('fighter-'+f.uid);if(!el)continue;el.style.left=(14+f.x*24)+'%';el.style.top=(12+f.y*18)+'%';el.querySelector('.life i').style.width=Math.max(0,f.hp/f.max*100)+'%';el.classList.toggle('dead',f.hp<=0);el.classList.toggle('shielded',f.shield>0);el.classList.toggle('slowed',f.slowUntil>combat.time);el.classList.toggle('burning',f.burnUntil>combat.time);el.classList.toggle('hasted',f.hasteUntil>combat.time);}$('battle-banner').textContent=`${user().name} vs ${combat.b.name} · ${Math.floor(combat.time)}초${combat.skillUntil>combat.time?' · '+combat.lastSkill:''}`;}
function startBattle(){
  if(busy||state.ended||!units(user()).length)return;if(!profile){$('profile-gate').showModal();return;}prepareAI();busy=true;selected=null;inspected=null;
  const alive=state.players.filter(p=>p.hp>0),others=alive.filter(p=>p!==user()),opponent=others[(state.round-1)%others.length];
  const rest=others.filter(p=>p!==opponent),rotation=rest.length?(state.round-1)%rest.length:0,waiting=[...rest.slice(rotation),...rest.slice(0,rotation)];state.otherBattles=[];
  if(isLootRound())combat=makeCombat(user(),neutral(user()));
  else{
    for(let i=0;i<waiting.length;i+=2){const a=waiting[i],b=waiting[i+1]||JSON.parse(JSON.stringify(opponent));const c=makeCombat(a,b);c.ghost=!waiting[i+1];state.otherBattles.push(c);}
    combat=makeCombat(user(),opponent);
  }render();$('placement').hidden=true;$('battle-stage').hidden=false;$('arena-title').textContent='자동 전투';
  $('fighters').innerHTML=combat.actors.map(f=>`<div data-element="${pet(f).element}" class="fighter ${f.side?'enemy':''}" id="fighter-${f.uid}"><div class="life"><i></i></div><img src="${pet(f).img}" alt="${escape(pet(f).name)}"><span class="unit-label">${escape(pet(f).name)} ${'★'.repeat(f.star)}</span></div>`).join('');
  paint();message(isLootRound()?'탐험 수호자와 대결합니다. 승패와 무관하게 생존 참가자 모두 장비 1개를 받으며 체력을 잃지 않습니다.':`${opponent.name}와 대결합니다. 홀수 인원은 상대의 복제 편성과 대결하며 원본 상대에게는 피해를 주지 않습니다.`);last=performance.now();elapsed=0;animation=requestAnimationFrame(frame);
}
function frame(now){elapsed+=Math.min(.1,(now-last)/1000)*Number($('speed').value);last=now;while(elapsed>=.1&&!combat.done){tick(combat,.1,true);elapsed-=.1;}paint();if(combat.done){setTimeout(settle,650);return;}animation=requestAnimationFrame(frame);}
function applyResult(c){
  const loser=c.winner===0?c.b:c.a,winner=c.winner===0?c.a:c.b;
  if(c.winner===null){c.a.hp=Math.max(0,c.a.hp-3);if(!c.ghost)c.b.hp=Math.max(0,c.b.hp-3);state.log.push(`${state.round}R · ${c.a.name} / ${c.b.name} 무승부`);}
  else{const damage=3+c.survivors+Math.floor(state.round/4);loser.hp=Math.max(0,loser.hp-damage);winner.wins++;winner.gold++;state.log.push(`${state.round}R · ${winner.name} 승리, ${loser.name} 체력 −${damage}`);}
}
function settle(){
  if(isLootRound())grantLoot();else{applyResult(combat);for(const c of state.otherBattles||[]){while(!c.done)tick(c,.1);applyResult(c);}}delete state.otherBattles;
  const alive=state.players.filter(p=>p.hp>0),eliminated=state.players.filter(p=>p.hp<=0&&p.place===null).sort((a,b)=>strength(b)-strength(a));eliminated.forEach((p,i)=>p.place=alive.length+i+1);
  busy=false;$('placement').hidden=false;$('battle-stage').hidden=true;$('arena-title').textContent='나의 전장';
  if(user().hp<=0||alive.length<=1||state.round>=18){endGame();return;}
  for(const p of alive){p.gold+=5+Math.min(3,Math.floor(p.gold/10));gainXP(p,2);shop(p);}state.round++;scoutIndex=null;inspected=null;prepareAI();remember();render();message('전투 종료. 골드와 경험치를 받았어요. 조합을 강화하고 다음 전투를 준비하세요.');
}
function endGame(){
  // Finish the remaining AI tournament after the human is eliminated.
  while(user().hp<=0&&state.players.filter(p=>p.hp>0).length>1&&state.round<18){
    state.round++;const contestants=state.players.filter(p=>p.hp>0);
    for(const p of contestants){p.gold+=5+Math.min(3,Math.floor(p.gold/10));gainXP(p,2);shop(p);aiPrepare(p);}
    if(isLootRound())grantLoot();else{
      const rotation=(state.round-1)%contestants.length,order=[...contestants.slice(rotation),...contestants.slice(0,rotation)],snapshot=JSON.parse(JSON.stringify(order[0]));
      for(let i=0;i<order.length;i+=2){const match=makeCombat(order[i],order[i+1]||snapshot);match.ghost=!order[i+1];while(!match.done)tick(match,.1);applyResult(match);}
    }
    const survivors=state.players.filter(p=>p.hp>0),out=state.players.filter(p=>p.hp<=0&&p.place===null).sort((a,b)=>strength(b)-strength(a));out.forEach((p,i)=>p.place=survivors.length+i+1);
  }
  const remaining=state.players.filter(p=>p.hp>0).sort((a,b)=>b.hp-a.hp||strength(b)-strength(a));remaining.forEach((p,i)=>p.place=i+1);
  state.ended=true;finishRecord(user().place,false);remember();render();showResult();
}
function showResult(){const p=user();$('result-title').textContent=`대회 ${p.place}위`;$('result-text').textContent=`${state.round}라운드 · ${p.wins}승. ${p.place===1?'축하해요! AI 참가자들을 넘어 우승했습니다.':'다른 속성과 배치로 다시 도전해보세요.'}`;if(!$('result').open)$('result').showModal();}
$('scout-tabs').onclick=e=>{const b=e.target.closest('[data-scout]');if(!b)return;scoutIndex=Number(b.dataset.scout);inspected=null;render();$('scout-detail').innerHTML='<p>상대 페트를 누르면 여기에 정보가 표시됩니다.</p>';};
$('scout-board').onclick=e=>{const b=e.target.closest('[data-inspect]');if(!b)return;inspected={index:scoutIndex,uid:b.dataset.inspect};selected=null;shopViewed=null;render();};
$('shop').onclick=e=>{const buyButton=e.target.closest('[data-buy]');if(buyButton){buy(Number(buyButton.dataset.buy));return;}const info=e.target.closest('[data-shop-info]');if(info){shopViewed=Number(info.dataset.shopInfo);selected=null;inspected=null;render();message('구매 전 정보입니다. 구매 버튼을 눌러야 골드가 사용됩니다.');$('pet-detail').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});}};
$('board').onclick=e=>{const button=e.target.closest('[data-slot]');if(!button)return;const u=user().roster.find(u=>u.uid===button.dataset.slot);selectSlot(u?u.slot:button.dataset.slot);};
$('bench').onclick=e=>{const button=e.target.closest('[data-bench]');if(!button||busy||state.ended)return;selected=user().roster.find(u=>u.uid===button.dataset.bench)?.uid||null;inspected=null;shopViewed=null;render();};
$('sell').onclick=()=>{if(busy||state.ended)return;const p=user(),u=p.roster.find(u=>u.uid===selected);if(!u)return;p.gold+=sale(u);if(u.item)p.inventory.push({uid:uid(),id:u.item});p.roster=p.roster.filter(v=>v.uid!==u.uid);selected=null;remember();render();message('페트를 판매하고 골드를 돌려받았습니다.');};
$('reroll').onclick=()=>{if(busy||state.ended||user().gold<2)return;user().gold-=2;shop(user());remember();render();message('상점이 바뀌었습니다.');};
$('experience').onclick=()=>{const p=user();if(busy||state.ended||p.gold<4||p.level>=6)return;p.gold-=4;gainXP(p,4);remember();render();message('경험치 +4. 레벨이 오르면 더 많은 페트를 배치할 수 있습니다.');};
$('ready').onclick=startBattle;$('new-game').onclick=()=>{if(confirm('진행 중인 대회를 포기하고 새 대회를 시작할까요? 중도 포기는 5위로 기록됩니다.'))fresh();};
$('again').onclick=()=>{$('result').close();fresh();};$('close-result').onclick=()=>$('result').close();

function renderEquipment(){
  const p=user(),u=p.roster.find(x=>x.uid===selected);
  const blocked=busy||state.ended||!u||u.item;
  const effect=id=>items[id].text.split(' · ').map(text=>`<span>${escape(text)}</span>`).join('');
  const hint=busy?'전투가 끝나면 장비를 바꿀 수 있어요.':state.ended?'대회가 종료되었습니다.':!u?'내 전장이나 대기석의 페트를 선택하면 장착할 수 있어요.':u.item?`${pet(u).name}의 장비를 해제하면 다른 장비를 장착할 수 있어요.`:`${pet(u).name}에게 장착할 아이템을 고르세요.`;
  $('equipment').innerHTML=`<div class="equipment-heading"><h3>${icon('bag')} 장비 보관함</h3><span class="equipment-count">보유 ${p.inventory.length}개</span></div><p class="equipment-help">${escape(hint)} <b>페트당 1개</b></p>`+
    (u?.item?`<div class="equipped-panel"><img src="assets/gear-${u.item}.png" alt=""><div><small>${escape(pet(u).name)} · 장착 중</small><b>${items[u.item].name}</b><div class="equipment-effect">${effect(u.item)}</div></div><button class="unequip-button" data-unequip="1" ${busy||state.ended?'disabled':''}>장비 해제</button></div>`:'')+
    (p.inventory.length?`<div class="equipment-grid">${p.inventory.map(i=>`<button class="equipment-card" data-item="${i.id}" data-equip="${i.uid}" ${blocked?'disabled':''}><span class="equipment-art"><img src="assets/gear-${i.id}.png" alt=""></span><b>${items[i.id].name}</b><span class="equipment-effect">${effect(i.id)}</span><span class="equipment-action">${blocked?'보관 중':'장착하기'}</span></button>`).join('')}</div>`:'<div class="equipment-empty">보관 중인 장비가 없어요.<span>4·8·12·16라운드 탐험에서 1개씩 획득합니다.</span></div>');
}
function equipAI(p){for(const u of units(p))if(!u.item&&p.inventory.length){const i=p.inventory.findIndex(x=>pet(u).heal?x.id==='spring':role(pet(u))==='수비형'?['shell','stone','vitality'].includes(x.id):['fang','feather'].includes(x.id));u.item=p.inventory.splice(Math.max(0,i),1)[0].id;}}
function neutral(p){const bot=createPlayer('탐험 수호자',null);bot.neutral=true;bot.roster=units(p).slice(0,Math.max(1,Math.floor(units(p).length/2))).map(u=>({id:u.id,uid:uid(),slot:u.slot,star:1}));return bot;}
function grantLoot(){const ids=Object.keys(items),offset=Math.floor(Math.random()*ids.length);state.players.filter(p=>p.hp>0).forEach((p,i)=>{if(p!==user()){const encounter=makeCombat(p,neutral(p));while(!encounter.done)tick(encounter,.1);}const id=ids[(offset+i)%ids.length];p.inventory.push({id,uid:uid()});if(p!==user())equipAI(p);state.log.push(`${state.round}R 탐험 · ${p.name}: ${items[id].name} 획득`);});}
function finishRecord(place,forfeit){
  if(state.resultRecorded)return true;if(!profile)return false;
  const result={id:state.runId||uid(),playerId:profile.id,nickname:profile.name,avatar:profile.avatar,season,place,round:state.round,wins:user().wins,forfeit,ranked:state.rankStarted,at:new Date().toISOString()};
  try{
    const key='manduk-tactics-history-v1',history=JSON.parse(localStorage.getItem(key)||'[]');
    if(!Array.isArray(history))throw Error('전적 저장 오류');
    if(!history.some(r=>r.id===result.id))localStorage.setItem(key,JSON.stringify([...history,result].slice(-100)));
    if(state.rankStarted)TacticsRanking.enqueue({id:result.id,season,place});
    state.resultRecorded=true;state.ended=true;user().place=place;remember();
    seasonRecord.games++;if(place===1)seasonRecord.wins++;seasonRecord.best=Math.min(seasonRecord.best,place);record();
    void refreshSeasonRanking();return true;
  }catch{warn('기록 저장이 차단됐어요. 브라우저 저장 공간을 확인해주세요.');return false;}
}
let rankingRequest=0;
function localRank(){
  try{const rows=JSON.parse(localStorage.getItem('manduk-tactics-history-v1')||'[]').filter(r=>r.season===season&&r.playerId===profile?.id&&r.ranked===true),recent=rows.slice(-20);return {games:rows.length,recent,score:recent.length?recent.reduce((n,r)=>n+[0,100,70,40,15,0][r.place],0)/recent.length:0};}catch{return {games:0,recent:[],score:0};}
}
function rankingMine(){const r=localRank();$('ranking-mine').textContent=profile?`${profile.name} · 최근 평균 ${r.score.toFixed(1)}점 · ${Math.min(10,r.games)} / 10경기${r.games<10?' · '+(10-r.games)+'경기 더 플레이하면 랭킹에 등록됩니다.':' · 순위 등록 조건 달성'}`:'프로필을 저장하면 시즌 기록을 시작합니다.';}
async function refreshSeasonRanking(){
  const request=++rankingRequest,chosen=$('ranking-season').value||season;rankingMine();$('ranking-refresh').disabled=true;
  $('ranking-status').textContent=TacticsRanking.enabled?'시즌 기록을 불러오는 중입니다.':'로컬 미리보기 · 기록은 이 브라우저에만 저장됩니다.';
  let uploadFailed=false;
  try{
    if(TacticsRanking.enabled&&profile)try{await TacticsRanking.flush(profile);}catch{uploadFailed=true;}
    const rows=TacticsRanking.enabled?await TacticsRanking.read(chosen):[];if(request!==rankingRequest)return;
    const selfId=TacticsRanking.enabled&&typeof firebase!=='undefined'&&firebase.apps.length?firebase.auth().currentUser?.uid:null;
    $('ranking-rows').innerHTML=rows.length?rows.slice(0,50).map((r,i)=>{const count=Math.min(20,r.games);return `<tr class="${r.id===selfId?'rank-self':''}"><td>${i+1}위</td><td><span class="rank-profile"><img src="${PETS[r.avatar]?.img||PETS[0].img}" alt="">${escape(r.name)}</span></td><td>${r.score.toFixed(1)}점</td><td>${(r.places/count).toFixed(2)}위</td><td>${Math.round(r.recentWins/count*100)}%</td><td>${r.games}경기</td></tr>`;}).join(''):'<tr><td class="ranking-empty" colspan="6">아직 등록된 조련사가 없어요. 시즌에서 10경기를 플레이하면 순위에 참여합니다.</td></tr>';
    if(TacticsRanking.enabled)$('ranking-status').textContent=uploadFailed||TacticsRanking.pending()?`기록 ${TacticsRanking.pending()}개가 전송 대기 중입니다. 새로고침을 눌러 다시 등록해주세요.`:'전체 이용자 시즌 TOP 50 · 평균 순위·우승률은 최근 20경기 기준입니다.';
  }catch{if(request===rankingRequest){$('ranking-rows').innerHTML='<tr><td class="ranking-empty" colspan="6">랭킹에 연결하지 못했어요. 새로고침을 눌러 다시 시도해주세요.</td></tr>';$('ranking-status').textContent='인터넷 연결을 확인해주세요. 대회 기록은 브라우저에 보관됩니다.';}}
  finally{if(request===rankingRequest)$('ranking-refresh').disabled=false;}
}
const rankingMonths=Array.from({length:12},(_,i)=>{const d=new Date(Number(season.slice(0,4)),Number(season.slice(4))-1-i,1);return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`;});
$('ranking-season').innerHTML=rankingMonths.map(s=>`<option value="${s}">${s.slice(0,4)}.${s.slice(4)}</option>`).join('');
$('ranking-season').onchange=refreshSeasonRanking;$('ranking-refresh').onclick=refreshSeasonRanking;
window.addEventListener('online',()=>void refreshSeasonRanking());
function portraitOptions(){const query=$('portrait-search').value.trim().toLowerCase(),options=PETS.map((p,id)=>({p,id})).filter(({p})=>[p.name,p.element,p.category].some(x=>x.toLowerCase().includes(query)));$('portrait-options').innerHTML=options.length?options.map(({p,id})=>`<button type="button" data-portrait="${id}" aria-pressed="${id===portraitChoice}"><img src="${p.img}" alt=""><span>${escape(p.name)}</span></button>`).join(''):'<p>검색 결과가 없습니다. 다른 이름이나 속성을 입력해주세요.</p>';$('portrait-preview').innerHTML=`<img src="${PETS[portraitChoice].img}" alt=""><b>${escape(PETS[portraitChoice].name)}</b>`;}
$('deselect').onclick=()=>{selected=null;inspected=null;shopViewed=null;render();$('scout-detail').innerHTML='<p>상대 페트를 누르면 여기에 정보가 표시됩니다.</p>';};
$('equipment').onclick=e=>{const b=e.target.closest('button');if(!b||busy||state.ended)return;const p=user(),u=p.roster.find(x=>x.uid===selected);if(!u)return;if(b.dataset.unequip&&u.item){p.inventory.push({uid:uid(),id:u.item});delete u.item;}else{const index=p.inventory.findIndex(i=>i.uid===b.dataset.equip);if(index<0||u.item)return;u.item=p.inventory.splice(index,1)[0].id;}remember();render();};
$('portrait-search').oninput=portraitOptions;
$('portrait-options').onclick=e=>{const b=e.target.closest('[data-portrait]');if(b){portraitChoice=Number(b.dataset.portrait);portraitOptions();}};
$('profile-form').onsubmit=e=>{e.preventDefault();if(profile)return;const name=$('nickname').value.trim();if(!name||name.length>12){$('profile-error').textContent='닉네임을 1~12자로 입력해주세요.';return;}const next={id:uid(),name,avatar:portraitChoice,createdAt:new Date().toISOString()};try{localStorage.setItem(profileKey,JSON.stringify(next));}catch{$('profile-error').textContent='브라우저 저장을 허용한 뒤 다시 시도해주세요.';return;}profile=next;state.rankStarted=true;user().name=name;user().avatar=portraitChoice;remember();$('profile-gate').close();render();void refreshSeasonRanking();};
$('profile-gate').addEventListener('cancel',e=>e.preventDefault());

if(state&&state.shopOddsVersion!==2){for(const p of state.players)p.shop=p.shop.map(id=>id!==null&&!shopOdds[p.level][catalog.get(id).cost-1]?offer(p):id);state.shopOddsVersion=2;remember();}
let repairedStart=false;
if(state&&state.rosterVersion!==3&&!state.ended&&state.round===1){try{localStorage.setItem(saveKey+'-before-equal-start-fix',JSON.stringify(state));state=null;repairedStart=true;}catch{message('진행 백업 저장이 차단되어 기존 대회를 유지합니다. 새 대회부터 수정됩니다.');}}
if(profile&&state){user().name=profile.name;user().avatar=profile.avatar;}
if(state){prepareAI();render();message(state.ended?'이전 대회의 결과가 저장돼 있습니다. 새 대회로 다시 도전하세요.':'진행 중인 대회를 불러왔습니다.');if(state.ended&&profile)showResult();}else fresh();

if(repairedStart)message('시작 편성 오류를 수정해 1라운드를 다시 구성했습니다. 닉네임·시즌 전적은 유지하고 이전 진행은 백업했습니다.');
if(!profile){portraitOptions();$('profile-gate').showModal();}

if(state&&!state.ended&&profile){state.runId=state.runId||uid();state.rankStarted=true;remember();}
void refreshSeasonRanking();

if(state.ended&&state.rankStarted&&!state.resultRecorded&&profile)finishRecord(user().place,false);
