'use strict';
// Local previews never send records. The public build explicitly enables this.
const RhythmOnline=(()=>{
  const enabled=window.RHYTHM_SHARED_RANKING===true;
  const database='https://pettraining-933c2-default-rtdb.asia-southeast1.firebasedatabase.app';
  const base=database+'/rhythm_rank_v5';
  function browserId(){
    let id=localStorage.getItem('manduk-rhythm-browser-v5');
    if(!id||! /^[a-f0-9-]{36}$/.test(id)){id=crypto.randomUUID();localStorage.setItem('manduk-rhythm-browser-v5',id);}
    return id;
  }
  const ids=['afterglow','blue-hour','sidewalk','stone-pulse'];
  function url(track,level,id=''){
    const index=Rhythm.tracks.findIndex(t=>t.name===track);
    if(index<0||!['easy','normal'].includes(level))throw new Error('Invalid ranking group');
    if(id&&!/^[a-f0-9-]{36}$/.test(id))throw new Error('Invalid record id');
    return `${base}/${ids[index]}/${level}${id?'/'+id:''}.json`;
  }
  async function request(address,options={}){
    const response=await fetch(address,{...options,signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error('Ranking request failed');
    return response.json();
  }
  async function read(track,level){
    const rows=await request(url(track,level)+'?orderBy=%22score%22&limitToLast=5');
    return Object.values(rows||{}).filter(r=>r&&typeof r.name==='string'&&r.name.length<=16&&Number.isInteger(r.score)&&r.score>=0&&r.score<=(level==='easy'?276000:496000)&&Number.isInteger(r.accuracy)&&r.accuracy>=0&&r.accuracy<=100&&Number.isInteger(r.combo)&&r.combo>=0&&r.combo<=(level==='easy'?138:248)).map(r=>({...r,track,level}));
  }
  async function identity(name){
    const address=database+'/rhythm_players_v5/'+browserId()+'.json';
    let profile=await request(address);
    if(!profile){
      try{await request(address,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});profile={name};}
      catch(error){profile=await request(address);if(!profile)throw error;}
    }
    return profile.name;
  }
  const better=(a,b)=>!b||a.score>b.score||(a.score===b.score&&(a.accuracy>b.accuracy||(a.accuracy===b.accuracy&&a.combo>b.combo)));
  async function save(record){
    const id=browserId();
    const body={name:record.name,score:record.score,accuracy:record.accuracy,combo:record.combo,date:record.date};
    body.name=await identity(body.name);
    const address=url(record.track,record.level,id);
    for(let attempt=0;attempt<3;attempt++){
      const current=await fetch(address,{headers:{'X-Firebase-ETag':'true'},signal:AbortSignal.timeout(12000)});
      if(!current.ok)throw new Error('Ranking read failed');
      if(!better(body,await current.json()))return false;
      const response=await fetch(address,{method:'PUT',headers:{'Content-Type':'application/json','if-match':current.headers.get('ETag')},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
      if(response.ok)return true;
      if(response.status!==412)throw new Error('Ranking write failed');
    }
    throw new Error('Ranking changed; retry');
  }
  return {enabled,read,save,identity};
})();
