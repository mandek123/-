'use strict';
const $=id=>document.getElementById(id),keys=['d','f','j','k'],colors=['#f4ce77','#9cdfff','#ffad92','#b1e595'];
let team=[],patternSeed=0,charges=[0,0,0,0],stamina=100,maxStamina=100,totalDamage=0;
let rival,rivalHp=0,rivalMax=0,defeated=0;
// 패턴과 곡 속도가 달라졌으므로 이전 기록을 보존하고 새 규칙으로 별도 집계한다.
const rankKey='manduk-rhythm-local-music-v6';
let sharedRecords=[],sharedState={},pendingRank=null;
$('rank-scope').textContent=RhythmOnline.enabled?'전체 이용자 기록':'이 기기 기록';
if(RhythmOnline.enabled)$('nickname-status').textContent='닉네임은 이 브라우저에 저장돼요. 완주하면 닉네임·점수·정확도·콤보가 전체 이용자 랭킹에 공개됩니다.';
const nicknameKey='manduk-rhythm-nickname';
const fixedNicknameKey='manduk-rhythm-fixed-nickname-v5';
let savedNickname='',performanceNickname='',fixedNickname='';
try{savedNickname=localStorage.getItem(nicknameKey)?.trim().slice(0,16)||savedNickname;}catch{}
try{fixedNickname=localStorage.getItem(fixedNicknameKey)||'';}catch{}
if(fixedNickname)savedNickname=fixedNickname;
$('nickname').value=savedNickname;
function lockNickname(name){
  localStorage.setItem(fixedNicknameKey,name);localStorage.setItem(nicknameKey,name);
  fixedNickname=savedNickname=name;$('nickname').value=name;$('nickname').readOnly=true;$('save-nickname').hidden=true;
  $('nickname-status').textContent=`랭킹 닉네임: ${name} · 이 브라우저의 최초 이름을 사용하며, 곡·난이도별 최고 기록 하나만 등록합니다.`;
}
if(fixedNickname)lockNickname(fixedNickname);
function saveNickname(announce=true){
  if(fixedNickname){$('nickname').value=fixedNickname;return true;}
  const name=$('nickname').value.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,16);
  if(!name){$('nickname-status').textContent='닉네임을 입력해주세요. 빈 이름으로는 기록을 등록하지 않습니다.';return false;}
  savedNickname=name;
  $('nickname').value=savedNickname;
  try{localStorage.setItem(nicknameKey,savedNickname);if(announce)$('nickname-status').textContent=`“${savedNickname}” 저장 완료. 다음 완주 기록부터 이 이름을 사용해요. 이전 기록 이름은 유지됩니다.`;}
  catch{$('nickname-status').textContent='이 공연에는 적용했지만, 브라우저 저장이 차단되어 다음에 다시 입력해야 해요.';}
  try{lockNickname(savedNickname);}catch{$('nickname-status').textContent='브라우저 저장을 허용해야 닉네임을 유지할 수 있어요.';return false;}
  return true;
}
$('nickname-form').onsubmit=e=>{e.preventDefault();saveNickname();};
$('nickname').addEventListener('change',()=>saveNickname(false));
const nicknameGate=document.createElement('dialog');
nicknameGate.className='nickname-gate';
nicknameGate.setAttribute('aria-labelledby','nickname-gate-title');
nicknameGate.innerHTML='<form><h2 id="nickname-gate-title">어떤 이름으로 공연할까요?</h2><p>랭킹에 표시할 닉네임을 입력해주세요.<br>다음 방문에도 이 브라우저에서 기억합니다.</p><label for="first-nickname">닉네임</label><input id="first-nickname" maxlength="16" required placeholder="예: 만득" autocomplete="nickname"><button type="submit">저장하고 입장</button><p class="nickname-gate-error" role="status"></p></form>';
document.body.append(nicknameGate);
nicknameGate.querySelector('form').onsubmit=e=>{
  e.preventDefault();$('nickname').value=$('first-nickname').value;
  if(saveNickname()){nicknameGate.close();$('start').focus();}
  else nicknameGate.querySelector('.nickname-gate-error').textContent='닉네임을 입력해주세요.';
};
if(!fixedNickname){$('first-nickname').value=savedNickname==='플레이어'?'':savedNickname;nicknameGate.showModal();}
let ctx,gain,fxGain,source,buffer,notes=[],running=false,paused=false,loading=false,finished=false,startAt=0,duration=0;
let score=0,combo=0,best=0,perfect=0,good=0,miss=0,ghost=0,feverUntil=-1,offset=0,lastSecond=-99;
let flashes=[0,0,0,0],particles=[],cache=new Map(),W=400,H=480,dpr=1;
let inputs=Array.from({length:4},()=>new Set()),impacts=[],holdGrace=0;
const canvas=$('canvas'),draw=canvas.getContext('2d');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const time=()=>ctx?ctx.currentTime-startAt:0;
$('track').innerHTML=Rhythm.tracks.map((t,i)=>`<option value="${i}">${t.name} · ${t.genre}</option>`).join('');
function randomize(){
  if(running||loading)return;
  score=combo=best=perfect=good=miss=ghost=0;notes=[];feverUntil=-1;
  if(finished){finished=false;$('cover').hidden=false;$('cover').innerHTML='<b class="stamp">LET’S RUSH!</b><h2>새로운 페트<br>새로운 비트!</h2><p>편성을 확인하고 공연을 시작하세요.</p><button id="start">공연 시작</button>';$('start').onclick=start;}
  team=['지','수','화','풍'].map(e=>{const pool=PETS.filter(p=>p.element===e);return pool[Math.floor(Math.random()*pool.length)];});
  charges=[0,0,0,0];maxStamina=Math.round(100+team.reduce((s,p)=>s+p.hp,0)/8);stamina=maxStamina;totalDamage=0;
  defeated=0;nextRival();
  $('actors').innerHTML=team.map((p,i)=>`<div class="actor" id="actor-${i}" style="--color:${colors[i]}"><img src="${p.img}" alt="${p.name}"><span>${p.name} · ${p.elements}</span></div>`).join('');
  $('pads').innerHTML=team.map((p,i)=>`<button class="pad" data-lane="${i}" style="--color:${colors[i]}" aria-label="${keys[i].toUpperCase()} 레인 ${p.name}"><b>${keys[i].toUpperCase()}</b><span>${p.name}</span></button>`).join('');
  $('pet-info').innerHTML=team.map((p,i)=>`<article><b>${keys[i].toUpperCase()} · ${p.name}</b><span>${p.category} · ${p.grade}</span><p>체력 ${p.hp} · 공격 ${p.atk}<br>방어 ${p.def} · 순발력 ${p.spd}</p><small>${p.passive.includes('치유')?'강화 타격 ×3 · 회복 +15':'강화 타격 ×3 · 회복 +5'} · 충전 <span id="pet-charge-${i}">0</span>/${skillCost(p)}</small></article>`).join('');
  $('roster-count').textContent=`도감 ${PETS.length}종 · 매 공연 새 편성`;
  $('track').onchange?.();dataStats();stats();$('stage-message').textContent='랜덤 페트 합동 공연';
  $('status').textContent='페트를 새로 편성했어요. 선택한 곡과 난이도는 유지됩니다.';
}
const skillCost=p=>Math.max(6,Math.min(12,Math.round(12-p.spd*.35)));
function nextRival(){rival=PETS[Math.floor(Math.random()*PETS.length)];rivalMax=rivalHp=Math.round(rival.hp*10);$('rival-img').src=rival.img;$('rival-img').alt=rival.name;}
function dataStats(){
  $('stamina').textContent=`${Math.max(0,stamina)} / ${maxStamina}`;$('damage').textContent=totalDamage.toLocaleString();
  team.forEach((p,i)=>{const el=$(`pet-charge-${i}`);if(el)el.textContent=charges[i];});
  $('rival-name').textContent=`라이벌 · ${rival.name} (${rival.elements})`;$('rival-health').textContent=`체력 ${rivalHp} / ${rivalMax} · 방어 ${rival.def}`;$('rival-bar').style.width=`${rivalHp/rivalMax*100}%`;$('defeated').textContent=`${defeated}승`;
}
function readRanks(){
  try{const data=JSON.parse(localStorage.getItem(rankKey)||'[]');return Array.isArray(data)?data.filter(r=>r&&typeof r.name==='string'&&typeof r.track==='string'&&['easy','normal'].includes(r.level)&&Number.isFinite(r.score)&&r.score>=0&&r.score<=1000000&&Number.isFinite(r.accuracy)&&r.accuracy>=0&&r.accuracy<=100&&Number.isInteger(r.combo)&&r.combo>=0&&r.combo<=1000):[];}catch{return [];}
}
function renderRanks(){
  const name=Rhythm.tracks[Number($('track').value)].name,level=$('level').value,records=RhythmOnline.enabled?sharedRecords:readRanks();
  $('rank-level').textContent=level==='easy'?'쉬움':'보통';
  $('rank-list').replaceChildren();
  for(const track of Rhythm.tracks){
    const section=document.createElement('article'),heading=document.createElement('h3'),list=document.createElement('ol');
    section.className='song-ranking'+(track.name===name?' current':'');heading.textContent=track.name;section.append(heading,list);
    const rows=records.filter(r=>r.track===track.name&&r.level===level).sort((a,b)=>b.score-a.score||b.accuracy-a.accuracy).slice(0,5);
    for(let i=0;i<5;i++){
      const row=rows[i],li=document.createElement('li'),position=document.createElement('span'),info=document.createElement('div'),player=document.createElement('strong'),details=document.createElement('small');
      if(i<3){const color=['#e6b332','#b5c2d0','#ba8052'][i],label=['금','은','동'][i];position.innerHTML=`<svg class="rank-medal" viewBox="0 0 32 40" role="img" aria-label="${i+1}위 ${label}메달${row?'':' 자리'}"><path d="M8 2h7l4 17-7 3Z" fill="#2368a4"/><path d="M17 2h7l-4 20-7-3Z" fill="#a33f2b"/><circle cx="16" cy="26" r="12" fill="${color}" stroke="#5b4328" stroke-width="1.5"/><circle cx="16" cy="26" r="9" fill="none" stroke="#fff9"/><text x="16" y="30" text-anchor="middle" font-size="12" font-weight="800" fill="#34291e">${i+1}</text></svg>`;}
      else{position.className='rank-number';position.textContent=String(i+1);}
      const state=sharedState[track.name+'/'+level];
      player.textContent=row?row.name.slice(0,16):RhythmOnline.enabled&&state!=='ready'?(state==='error'?'연결 실패':'불러오는 중'):'기록 없음';details.textContent=row?`${row.score.toLocaleString()}점 · ${row.accuracy}% · ${row.combo}콤보`:state==='error'?'랭킹 새로고침을 눌러주세요':'완주하면 여기에 기록됩니다';
      if(!row)li.className='rank-empty';info.append(player,details);li.append(position,info);list.append(li);
    }
    $('rank-list').append(section);
  }
}
async function refreshRanks(){
  if(!RhythmOnline.enabled){renderRanks();return;}
  const level=$('level').value;$('refresh-ranks').disabled=true;
  $('rank-status').textContent='전체 이용자 기록을 불러오는 중입니다.';
  const results=await Promise.allSettled(Rhythm.tracks.map(async track=>{
    const key=track.name+'/'+level;sharedState[key]='loading';
    try{const records=await RhythmOnline.read(track.name,level);sharedRecords=sharedRecords.filter(r=>r.track!==track.name||r.level!==level).concat(records);sharedState[key]='ready';}
    catch(error){sharedState[key]='error';sharedRecords=sharedRecords.filter(r=>r.track!==track.name||r.level!==level);throw error;}
  }));
  $('refresh-ranks').disabled=false;renderRanks();
  $('rank-status').textContent=results.some(r=>r.status==='rejected')?'전체 랭킹에 연결하지 못했어요. 인터넷 연결을 확인한 뒤 랭킹 새로고침을 눌러주세요.':'전체 이용자 기록 · 곡·난이도별 TOP5입니다.';
}
async function uploadRank(){
  if(!pendingRank)return;
  const entry=pendingRank;$('retry-rank').hidden=true;$('rank-status').textContent='완주 기록을 전체 랭킹에 등록하는 중입니다.';
  try{const updated=await RhythmOnline.save(entry.record);if(pendingRank===entry)pendingRank=null;await refreshRanks();$('rank-status').textContent=updated?'최고 기록이 등록·갱신됐어요. 곡·난이도별 한 자리만 사용합니다.':'기존 최고 기록을 유지합니다. 추가 순위는 등록하지 않습니다.';}
  catch{$('retry-rank').hidden=false;$('rank-status').textContent='전체 랭킹 등록에 실패했어요. 이 화면을 닫기 전에 기록 등록 다시 시도를 눌러주세요.';}
}
function saveRank(acc){
  const r={name:performanceNickname,track:Rhythm.tracks[Number($('track').value)].name,level:$('level').value,score,accuracy:Math.round(acc*100),combo:best,pets:team.map(p=>p.name),date:new Date().toISOString()};
  try{const rows=[...readRanks(),r].sort((a,b)=>b.score-a.score||b.accuracy-a.accuracy||b.combo-a.combo),groups=new Set();const kept=rows.filter(x=>{const key=x.track+'/'+x.level;if(groups.has(key))return false;groups.add(key);return true;});localStorage.setItem(rankKey,JSON.stringify(kept));$('rank-status').textContent='이 브라우저의 곡·난이도별 최고 기록을 저장했습니다.';renderRanks();}
  catch{$('rank-status').textContent='브라우저 저장이 차단되어 기록을 저장하지 못했어요.';}
  if(RhythmOnline.enabled){pendingRank={record:r};uploadRank();}
}
async function audioReady(){if(!ctx){ctx=new (window.AudioContext||window.webkitAudioContext)();gain=ctx.createGain();gain.connect(ctx.destination);fxGain=ctx.createGain();fxGain.connect(ctx.destination);}await ctx.resume();gain.gain.value=Number($('volume').value)/100;}
function impactSound(lane,strong=true,skill=false){
  if(!ctx||ctx.state!=='running')return;
  const track=Rhythm.tracks[Number($('track').value)],jazz=track.genre==='재즈',hip=track.genre==='힙합',tribal=track.genre==='트라이벌';
  const t=ctx.currentTime,root=Rhythm.chordRoot(track,running?time():0),intervals=track.mode==='minor'?[0,3,7,10]:[0,4,7,12];
  const f=440*2**((root+intervals[lane]+(hip?-12:0)-69)/12),len=jazz?.13:hip?.10:.085,volume=Number($('sfx-volume').value)/100;
  if(!volume)return;
  for(const [harmonic,amp] of [[1,1],[2,jazz?.22:.09]]){
    const osc=ctx.createOscillator(),g=ctx.createGain(),filter=ctx.createBiquadFilter();osc.type=jazz||hip?'sine':'triangle';filter.type='lowpass';filter.frequency.value=jazz?2100:hip?1000:2600;
    osc.frequency.value=f*harmonic;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0001,(strong?.065:.018)*amp*volume),t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+len);osc.connect(filter);filter.connect(g);g.connect(fxGain);osc.start(t);osc.stop(t+len+.01);
  }
  if((tribal||skill)&&strong){const osc=ctx.createOscillator(),g=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(tribal?105:80,t);osc.frequency.exponentialRampToValueAtTime(50,t+.07);g.gain.setValueAtTime(Math.max(.0001,.03*volume),t);g.gain.exponentialRampToValueAtTime(.0001,t+.09);osc.connect(g);g.connect(fxGain);osc.start(t);osc.stop(t+.1);}
}
function leap(lane,skill=false){const actor=$(`actor-${lane}`);actor.classList.remove('attack','skill');void actor.offsetWidth;actor.classList.add(skill?'skill':'attack');}
function resize(){const r=canvas.getBoundingClientRect();W=r.width;H=r.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=W*dpr;canvas.height=H*dpr;draw.setTransform(dpr,0,0,dpr,0,0);}
new ResizeObserver(resize).observe(canvas);
function stats(){
  $('score').textContent=String(score).padStart(6,'0');$('combo').textContent=combo;$('best').textContent=best;
  const all=perfect+good+miss+ghost;$('accuracy').textContent=all?`${Math.round((perfect+good*.65)/all*100)}%`:'—';
  $('charge').textContent=`${15-combo%15}회`;
}
function judge(text,color,isPerfect=false){const el=$('judgement');el.textContent=text;el.style.color=color;el.classList.remove('show','perfect-impact');void el.offsetWidth;el.classList.add('show');if(isPerfect)el.classList.add('perfect-impact');}
function failed(lane,count=1,text='MISS'){
  miss+=count;combo=0;stamina=Math.max(0,stamina-count*Math.max(1,5-Math.floor(team[lane].def/4)));judge(text,'#eeadbd');stats();dataStats();
}
function successful(lane,result,tail=false){
  combo++;best=Math.max(best,combo);if(result==='perfect')perfect++;else good++;
  if(combo%15===0){feverUntil=time()+5;celebrate();$('status').textContent='15회 연속 성공! 5초간 점수 2배!';}
  score+=(result==='perfect'?1000:650)*(time()<feverUntil?2:1);
  judge(result==='perfect'?(tail?'HOLD PERFECT!':'PERFECT!'):'GOOD',result==='perfect'?'#ffda42':'#b1e595',result==='perfect');
  if(result==='perfect'&&!reduced)impacts.push({lane,born:performance.now()});
  leap(lane);impactSound(lane,true);
  let damage=Math.max(1,Math.round((team[lane].atk*(result==='perfect'?3:2)-rival.def*.35)*(stamina?1:.5)));charges[lane]++;
  stamina=Math.min(maxStamina,stamina+(result==='perfect'?2:1));
  const skill=charges[lane]>=skillCost(team[lane]);
  if(skill){charges[lane]=0;damage*=3;leap(lane,true);impactSound(lane,true,true);stamina=Math.min(maxStamina,stamina+(team[lane].passive.includes('치유')?15:5));celebrate();}
  totalDamage+=damage;rivalHp=Math.max(0,rivalHp-damage);
  if(!rivalHp){defeated++;nextRival();celebrate();}dataStats();
  if(!reduced)for(let i=0;i<(result==='perfect'?18:6);i++)particles.push({x:(lane+.5)*W/4,y:H-45,vx:(Math.random()-.5)*240,vy:-80-Math.random()*190,born:performance.now(),color:result==='perfect'?'#ffdf70':colors[lane]});
  $('stage-message').textContent=`${team[lane].name} ${skill?(team[lane].passive.includes('치유')?'강화 타격 + 회복!':'강화 타격!'):'타격!'} −${damage}`;stats();
}
function hit(lane){
  if(paused||loading)return;
  if(!running){audioReady().then(()=>impactSound(lane)).catch(()=>$('status').textContent='브라우저에서 소리 재생을 허용해 주세요.');leap(lane);flashes[lane]=performance.now();return;}
  if(time()<0)return;
  if(notes.some(n=>n.state===1&&n.lane===lane))return;
  const t=time()-offset;
  const candidate=notes.filter(n=>!n.state&&n.lane===lane&&Math.abs(n.time-t)<=Rhythm.GOOD_WINDOW).sort((a,b)=>Math.abs(a.time-t)-Math.abs(b.time-t))[0];
  flashes[lane]=performance.now();
  if(!candidate){impactSound(lane,false);leap(lane);combo=0;ghost++;judge('EMPTY','#e9dce0');stats();return;}
  const result=Rhythm.judge(t-candidate.time);candidate.state=candidate.end?1:2;successful(lane,result);
  if(candidate.end)$('status').textContent=`${keys[lane].toUpperCase()}를 끝까지 누르고 유지하세요!`;
}
function pressLane(lane,token){if(inputs[lane].has(token))return;const first=!inputs[lane].size;inputs[lane].add(token);if(first)hit(lane);}
function releaseLane(lane,token){
  inputs[lane].delete(token);if(inputs[lane].size||!running||paused)return;
  const note=notes.find(n=>n.state===1&&n.lane===lane);if(!note)return;
  const outcome=Rhythm.holdOutcome(note,time()-offset);note.state=outcome==='complete'?2:3;
  if(outcome==='complete')successful(lane,'perfect',true);else{failed(lane,1,'HOLD BREAK');$('status').textContent=`${keys[lane].toUpperCase()}를 너무 일찍 떼었어요. 길쭉한 꼬리 끝까지 유지하세요.`;}
}
function celebrate(){
  if(reduced)return;
  $('burst').innerHTML=Array.from({length:16},(_,i)=>`<i style="--x:${10+i*5}%;--c:${colors[i%4]};--dx:${(i%2?1:-1)*40}px"></i>`).join('');
}
function lock(value){$('track').disabled=value;$('level').disabled=value;$('offset').disabled=value;$('shuffle').disabled=value;$('nickname').disabled=value;$('save-nickname').disabled=value;}
async function start(){
  if(loading||running)return;
  if(!saveNickname(false)){if(!nicknameGate.open)nicknameGate.showModal();$('status').textContent='랭킹에 사용할 닉네임을 먼저 입력해주세요.';return;}
  performanceNickname=savedNickname;
  if(finished)randomize();patternSeed=crypto.getRandomValues(new Uint32Array(1))[0];loading=true;finished=false;lock(true);
  const button=$('start');button.disabled=true;button.textContent='음악 준비 중…';$('status').textContent='음악을 불러오는 중입니다.';
  try{
    await audioReady();
    if(RhythmOnline.enabled){performanceNickname=await RhythmOnline.identity(performanceNickname);lockNickname(performanceNickname);}
    const track=Rhythm.tracks[Number($('track').value)];
    if(!cache.has(track.name)){if(cache.size>=2)cache.clear();cache.set(track.name,await Rhythm.music(track,ctx));}buffer=cache.get(track.name);
    if(source){try{source.stop();}catch{}source.disconnect();}
    notes=Rhythm.chart(track,$('level').value,patternSeed);duration=buffer.duration;offset=Number($('offset').value)/1000;
    inputs.forEach(s=>s.clear());impacts=[];holdGrace=0;charges=[0,0,0,0];stamina=maxStamina;totalDamage=0;defeated=0;nextRival();dataStats();
    score=combo=best=perfect=good=miss=ghost=0;feverUntil=-1;particles=[];lastSecond=-99;
    startAt=ctx.currentTime+2.5;source=ctx.createBufferSource();source.buffer=buffer;source.connect(gain);source.start(startAt);
    running=true;paused=false;$('pause').disabled=false;$('pause').textContent='일시정지';$('cover').hidden=true;
    $('track-label').textContent=`${track.name} · ${track.bpm} BPM`;$('status').textContent=`랭킹 닉네임: ${performanceNickname} · 노란 판정선에 맞춰 D · F · J · K를 누르세요.`;stats();
  }catch(e){lock(false);$('cover').hidden=false;button.disabled=false;button.textContent='다시 시작';$('status').textContent='음악을 시작하지 못했어요. Chrome 또는 Edge에서 다시 열어주세요.';console.error(e);}
  finally{loading=false;}
}
async function togglePause(){
  if(!running||loading)return;
  try{
    if(!paused){await ctx.suspend();paused=true;$('cover').hidden=false;$('cover').innerHTML='<b class="stamp">PAUSED</b><h2>잠시 쉬어가요</h2><p>음악과 노트가 함께 멈췄어요.</p><button id="resume">계속 플레이</button>';$('resume').onclick=togglePause;$('pause').textContent='계속 플레이';}
    else{await ctx.resume();paused=false;holdGrace=time()-offset+.35;$('cover').hidden=true;$('pause').textContent='일시정지';}
  }catch(e){$('status').textContent='음악 재생을 다시 허용해 주세요.';console.error(e);}
}
function finish(){
  if(!running)return;
  running=false;finished=true;paused=false;lock(false);$('pause').disabled=true;$('fever').hidden=true;
  const acc=(perfect+good*.65)/Math.max(1,Rhythm.units(notes)+ghost),rank=acc>=.95?'S':acc>=.85?'A':acc>=.7?'B':acc>=.5?'C':'D';
  $('cover').hidden=false;$('cover').innerHTML=`<b class="stamp">${rank} RANK</b><h2>공연 완료!</h2><p>${score.toLocaleString()}점 · 최고 콤보 ${best}<br>PERFECT ${perfect} · GOOD ${good} · MISS ${miss}<br>빈 레인 입력 ${ghost}</p><button id="start">다시 공연하기</button>`;
  $('start').onclick=start;$('status').textContent=`누적 타격 ${totalDamage.toLocaleString()}! 다시 시작하면 페트와 패턴이 새로 편성됩니다.`;stats();saveRank(acc);
}
function frame(){
  requestAnimationFrame(frame);const now=performance.now(),t=running?time():finished?duration:0,travel=1.8,line=H-45,laneW=W/4;
  draw.clearRect(0,0,W,H);
  for(let i=0;i<4;i++){
    draw.fillStyle=i%2?'#302839':'#272230';draw.fillRect(i*laneW,0,laneW,H);
    draw.strokeStyle='#ffffff18';draw.lineWidth=1;draw.beginPath();draw.moveTo(i*laneW,0);draw.lineTo(i*laneW,H);draw.stroke();
    if(now-flashes[i]<130||inputs[i].size){draw.fillStyle=colors[i]+'44';draw.fillRect(i*laneW,line-90,laneW,130);}
    $('pads').children[i].classList.toggle('pressed',now-flashes[i]<130||inputs[i].size>0);
  }
  const beat=60/Rhythm.tracks[Number($('track').value)].bpm;
  for(let b=Math.floor((t-offset)/beat);b*beat<t-offset+travel;b++){
    const y=line-(b*beat-(t-offset))/travel*line;if(y<0||y>H)continue;
    draw.strokeStyle=b%4===0?'#ffffff39':'#ffffff16';draw.beginPath();draw.moveTo(0,y);draw.lineTo(W,y);draw.stroke();
  }
  draw.fillStyle='#ffda42';draw.fillRect(0,line-3,W,6);
  for(const n of notes){
    if(n.state>=2)continue;
    if(running&&!paused){
      if(n.state===1){
        if(!inputs[n.lane].size&&t-offset>holdGrace){n.state=3;failed(n.lane,1,'HOLD BREAK');continue;}
        if(t-offset>=n.end){n.state=2;successful(n.lane,'perfect',true);continue;}
      }else if(t-offset-n.time>Rhythm.GOOD_WINDOW){n.state=3;failed(n.lane,n.end?2:1);continue;}
    }
    const y=n.state===1?line:line-(n.time-(t-offset))/travel*line;
    const tailY=n.end?line-(n.end-(t-offset))/travel*line:y;
    if(y< -25||tailY>H+20)continue;
    const x=n.lane*laneW+8,w=laneW-16;
    if(n.end){
      draw.fillStyle=n.state===1?colors[n.lane]:colors[n.lane]+'88';draw.fillRect(x+w*.22,tailY,w*.56,Math.max(0,y-tailY));
      draw.strokeStyle=n.state===1?'#fff7bd':colors[n.lane];draw.lineWidth=3;draw.strokeRect(x+w*.22,tailY,w*.56,Math.max(0,y-tailY));
      draw.fillStyle='#fff7bd';draw.fillRect(x+3,tailY-3,w-6,6);
    }
    draw.fillStyle=colors[n.lane];draw.beginPath();draw.roundRect(x,y-11,w,22,6);draw.fill();
    draw.fillStyle='#ffffff8a';draw.fillRect(x+7,y-7,w-14,3);draw.fillStyle='#302230';draw.font='bold 12px sans-serif';draw.textAlign='center';draw.fillText(keys[n.lane].toUpperCase(),x+w/2,y+4);
  }
  particles=particles.filter(p=>now-p.born<420);for(const p of particles){const dt=(now-p.born)/1000;draw.globalAlpha=1-dt/.42;draw.fillStyle=p.color;draw.fillRect(p.x+p.vx*dt,p.y+p.vy*dt+150*dt*dt,5,5);}draw.globalAlpha=1;
  impacts=impacts.filter(p=>now-p.born<260);for(const p of impacts){const k=(now-p.born)/260,x=(p.lane+.5)*laneW;draw.globalAlpha=1-k;draw.strokeStyle='#fff6b7';draw.lineWidth=6*(1-k)+1;draw.beginPath();draw.ellipse(x,line,12+k*laneW*.47,7+k*26,0,0,Math.PI*2);draw.stroke();draw.fillStyle='#fff6b7';draw.fillRect(p.lane*laneW+5,line-2,laneW-10,4);}draw.globalAlpha=1;
  if(running&&!paused){
    if(t<0){draw.fillStyle='#ffda42';draw.font='bold 65px sans-serif';draw.textAlign='center';draw.fillText(String(Math.ceil(-t)),W/2,H*.45);}
    $('fever').hidden=!(t<feverUntil);
    $('progress').style.width=`${Math.min(100,Math.max(0,t)/duration*100)}%`;
    const sec=Math.floor(Math.max(0,t));if(sec!==lastSecond){lastSecond=sec;$('clock').textContent=`00:${String(sec).padStart(2,'0')} / 00:${Math.ceil(duration)}`;}
    if(t>=duration)finish();
  }
}
$('start').onclick=start;$('pause').onclick=togglePause;
$('volume').oninput=()=>{if(gain)gain.gain.setTargetAtTime(Number($('volume').value)/100,ctx.currentTime,.03);};
$('offset').oninput=()=>$('offset-label').textContent=`${$('offset').value} ms`;
$('track').onchange=()=>{const track=Rhythm.tracks[Number($('track').value)];$('track-label').textContent=`${track.name} · ${track.genre} · 약 ${Math.round(track.bpm)} BPM`;$('clock').textContent=`00:00 / 00:${Math.ceil(track.duration)}`;renderRanks();};
$('level').onchange=()=>{renderRanks();refreshRanks();};$('shuffle').onclick=randomize;
$('refresh-ranks').onclick=refreshRanks;$('retry-rank').onclick=uploadRank;
$('pads').addEventListener('pointerdown',e=>{const btn=e.target.closest('[data-lane]');if(btn){e.preventDefault();btn.setPointerCapture(e.pointerId);pressLane(Number(btn.dataset.lane),'pointer:'+e.pointerId);}});
for(const type of ['pointerup','pointercancel'])$('pads').addEventListener(type,e=>{const btn=e.target.closest('[data-lane]');if(btn)releaseLane(Number(btn.dataset.lane),'pointer:'+e.pointerId);});
$('pads').addEventListener('click',e=>{const btn=e.target.closest('[data-lane]');if(btn&&e.detail===0)hit(Number(btn.dataset.lane));});
for(const type of ['keydown','keyup'])$('pads').addEventListener(type,e=>{const btn=e.target.closest('[data-lane]');if(btn&&['Space','Enter'].includes(e.code)){e.preventDefault();if(type==='keydown'&&!e.repeat)pressLane(Number(btn.dataset.lane),'button:'+e.code);if(type==='keyup')releaseLane(Number(btn.dataset.lane),'button:'+e.code);}});
document.addEventListener('keydown',e=>{
  if(/INPUT|SELECT/.test(e.target.tagName))return;
  const lane=keys.indexOf(e.key.toLowerCase());if(lane>=0){e.preventDefault();if(!e.repeat)pressLane(lane,'key:'+keys[lane]);}
  if(e.code==='Space'&&running&&e.target.tagName!=='BUTTON'){e.preventDefault();if(!e.repeat)togglePause();}
});
document.addEventListener('keyup',e=>{const lane=keys.indexOf(e.key.toLowerCase());if(lane>=0)releaseLane(lane,'key:'+keys[lane]);});
window.addEventListener('blur',()=>{inputs.forEach(s=>s.clear());if(running&&!paused)togglePause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!paused)togglePause();});
randomize();resize();frame();
refreshRanks();
