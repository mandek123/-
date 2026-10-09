'use strict';
const Rhythm = (()=>{
  const tracks=typeof MUSIC_TRACKS!=='undefined'?MUSIC_TRACKS:require('./songs.js');
  const PERFECT_WINDOW=.10,GOOD_WINDOW=.185;
  const judge=delta=>Math.abs(delta)<=PERFECT_WINDOW?'perfect':Math.abs(delta)<=GOOD_WINDOW?'good':null;
  function chart(track,level,seed=track.seed){
    const lanes=[0,1,2,3];
    const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let i=3;i>0;i--){const j=Math.floor(random()*(i+1));[lanes[i],lanes[j]]=[lanes[j],lanes[i]];}
    return track.charts[level].map(([time,lane,end])=>({time,lane:lanes[lane],end,state:0}));
  }
  const units=notes=>notes.reduce((s,n)=>s+(n.end?2:1),0);
  const holdOutcome=(note,t)=>t>=note.end-.12?'complete':'break';
  async function music(track,context){
    const response=await fetch(track.src);
    if(!response.ok)throw Error('음악 파일을 불러오지 못했어요.');
    return context.decodeAudioData(await response.arrayBuffer());
  }
  // Match the estimated key, not the previous synthetic song's progression.
  const chordRoot=track=>track.root;
  return {tracks,chart,judge,music,units,holdOutcome,chordRoot,PERFECT_WINDOW,GOOD_WINDOW};
})();
if(typeof module!=='undefined')module.exports=Rhythm;
