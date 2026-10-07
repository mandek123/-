'use strict';
// The public release enables uploads. Local previews keep the same scoring offline.
const TacticsRanking=(()=>{
  const enabled=window.TACTICS_SHARED_RANKING===true,points=[0,100,70,40,15,0];
  const database='https://pettraining-933c2-default-rtdb.asia-southeast1.firebasedatabase.app';
  const queueKey='manduk-tactics-rank-outbox-v1';
  let login,flushing=false;
  const empty=()=>Object.fromEntries(Array.from({length:20},(_,i)=>[i,{id:'',place:0}]));
  function append(old,match,identity){
    if(Object.values(old?.recent||{}).some(r=>r.id===match.id))return old;
    const games=(old?.games||0)+1,recent={...empty(),...old?.recent};recent[(games-1)%20]={id:match.id,place:match.place};
    const rows=Object.values(recent).filter(r=>r.place>0),sum=rows.reduce((n,r)=>n+points[r.place],0);
    return {name:identity.name,avatar:identity.avatar,games,wins:(old?.wins||0)+(match.place===1?1:0),recent,points:sum,places:rows.reduce((n,r)=>n+r.place,0),recentWins:rows.filter(r=>r.place===1).length,score:sum/rows.length,updatedAt:{'.sv':'timestamp'}};
  }
  function queue(){try{const rows=JSON.parse(localStorage.getItem(queueKey)||'[]');return Array.isArray(rows)?rows.filter(r=>r&&/^[0-9]{6}$/.test(r.season)&&/^[a-f0-9-]{36}$/.test(r.id)&&Number.isInteger(r.place)&&r.place>=1&&r.place<=5):[];}catch{return [];}}
  function enqueue(match){const rows=queue();if(!rows.some(r=>r.id===match.id))rows.push(match);localStorage.setItem(queueKey,JSON.stringify(rows));}
  async function auth(){
    if(!login)login=(async()=>{if(typeof firebase==='undefined')throw Error('로그인 연결을 확인해주세요.');if(!firebase.apps.length)firebase.initializeApp(window.TACTICS_FIREBASE_CONFIG);const a=firebase.auth();await a.setPersistence(firebase.auth.Auth.Persistence.LOCAL);return (await a.signInAnonymously()).user;})().catch(e=>{login=null;throw e;});
    return login;
  }
  async function request(path,options={},authenticated=false){
    const token=authenticated?await (await auth()).getIdToken():null;
    const response=await fetch(database+'/'+path+'.json'+(token?'?auth='+encodeURIComponent(token):''),{...options,signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('랭킹 연결 실패');return response.json();
  }
  async function identity(profile){const u=await auth(),path='tactics_players_v1/'+u.uid;let stored=await request(path,{},true);if(!stored){try{stored=await request(path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:profile.name,avatar:profile.avatar})},true);}catch(e){stored=await request(path,{},true);if(!stored)throw e;}}return {uid:u.uid,...stored};}
  async function save(match,profile){
    const owner=await identity(profile),path='tactics_seasons_v1/'+match.season+'/'+owner.uid;
    for(let i=0;i<3;i++){
      const token=await (await auth()).getIdToken(),url=database+'/'+path+'.json?auth='+encodeURIComponent(token);
      const current=await fetch(url,{headers:{'X-Firebase-ETag':'true'},signal:AbortSignal.timeout(12000)});if(!current.ok)throw Error('랭킹 조회 실패');
      const old=await current.json(),next=append(old,match,owner);if(next===old)return;
      const response=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json','if-match':current.headers.get('ETag')},body:JSON.stringify(next),signal:AbortSignal.timeout(12000)});if(response.ok)return;if(response.status!==412)throw Error('랭킹 저장 실패');
    }throw Error('기록이 변경됐어요. 다시 시도해주세요.');
  }
  async function flush(profile){if(!enabled||!profile||flushing)return;flushing=true;try{for(const match of queue()){await save(match,profile);localStorage.setItem(queueKey,JSON.stringify(queue().filter(r=>r.id!==match.id)));}}finally{flushing=false;}}
  async function read(season){const rows=await request('tactics_seasons_v1/'+season);return Object.entries(rows||{}).map(([id,r])=>({id,...r})).filter(r=>typeof r.name==='string'&&Number.isInteger(r.games)&&r.games>=10&&r.games<=10000&&Number.isFinite(r.score)&&r.score>=0&&r.score<=100&&Number.isInteger(r.recentWins)&&Number.isInteger(r.places)).sort((a,b)=>b.score-a.score||b.recentWins/Math.min(20,b.games)-a.recentWins/Math.min(20,a.games)||a.places/Math.min(20,a.games)-b.places/Math.min(20,b.games)||a.updatedAt-b.updatedAt);}
  return {enabled,append,enqueue,flush,read,pending:()=>queue().length};
})();
