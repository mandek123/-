'use strict';
// Local previews never send records. The public build explicitly enables this.
const RhythmOnline=(()=>{
  const enabled=window.RHYTHM_SHARED_RANKING===true;
  const base='https://pettraining-933c2-default-rtdb.asia-southeast1.firebasedatabase.app/rhythm_rank_v4';
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
  async function save(record,id){
    const body={name:record.name,score:record.score,accuracy:record.accuracy,combo:record.combo,date:record.date};
    try{await request(url(record.track,record.level,id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
    catch(error){
      // A timed-out successful write can be retried without creating a duplicate.
      const saved=await request(url(record.track,record.level,id)).catch(()=>null);
      if(!saved||Object.keys(body).some(key=>saved[key]!==body[key]))throw error;
    }
  }
  return {enabled,read,save};
})();
