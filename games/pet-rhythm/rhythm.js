'use strict';
const Rhythm = (()=>{
  const tracks=[{name:'Afterglow',genre:'팝',bpm:156,root:60,seed:17},{name:'Blue Hour',genre:'재즈',bpm:142,root:62,seed:29,swing:.64},{name:'Sidewalk',genre:'힙합',bpm:150,root:57,seed:43},{name:'Stone Pulse',genre:'트라이벌',bpm:164,root:62,seed:59}];
  const BEATS=128;
  const PERFECT_WINDOW=.10,GOOD_WINDOW=.185;
  const judge=delta=>Math.abs(delta)<=PERFECT_WINDOW?'perfect':Math.abs(delta)<=GOOD_WINDOW?'good':null;
  function chart(track,level,seed=track.seed){
    const b=60/track.bpm,notes=[],occupied=[0,0,0,0],last=[-10,-10,-10,-10];
    const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    function add(at,length=0){
      const lanes=[0,1,2,3].filter(l=>occupied[l]<=at&&at-last[l]>=.45*b);
      if(!lanes.length)throw new Error('No playable lane');
      const lane=lanes[Math.floor(random()*lanes.length)],end=length?at+length*b:0;
      notes.push({time:at,lane,end,state:0});occupied[lane]=end?end+.15*b:at+.15*b;last[lane]=at;
    }
    for(let beat=4;beat<BEATS-4;beat++){
      add(beat*b,beat%8===6?(level==='normal'?1.25:1):0);
      if(beat%(level==='normal'?8:32)===0)add(beat*b);
      if(level==='normal'&&beat>=12&&beat%8!==7)add((beat+(track.swing||.5))*b);
    }
    return notes;
  }
  const units=notes=>notes.reduce((s,n)=>s+(n.end?2:1),0);
  const holdOutcome=(note,t)=>t>=note.end-.12?'complete':'break';
  function section(beat){
    return beat<8?{name:'intro',start:0}:beat<40?{name:'verse',start:8}:beat<56?{name:'lift',start:40}:beat<88?{name:'chorus',start:56}:beat<104?{name:'bridge',start:88}:beat<124?{name:'final',start:104}:{name:'outro',start:124};
  }
  const tunes={
    '팝':{verse:[0,2,4,null,7,4,2,0,2,4,5,7,null,4,2,0],lift:[4,5,7,9,7,9,11,12,9,11,12,14,12,11,9,7],chorus:[7,7,9,7,4,2,4,7,9,12,11,9,7,null,4,7,9,9,7,4,5,7,9,12,14,12,11,9,7,4,2,0],bridge:[9,null,7,4,5,null,4,2,0,2,4,null,7,5,2,0]},
    '재즈':{verse:[0,4,7,null,11,9,7,4,2,5,9,12,11,7,4,null],lift:[4,7,9,11,12,11,9,7,5,9,12,14,12,9,7,4],chorus:[7,9,11,12,11,7,6,7,9,12,14,12,11,9,7,4,2,4,5,9,12,11,9,7,5,4,2,1,2,4,7,0],bridge:[0,null,4,7,11,null,9,7,2,null,5,9,12,9,5,2]},
    '힙합':{verse:[0,null,3,7,10,null,7,3,0,3,null,5,7,5,3,null],lift:[3,5,7,10,7,null,10,12,10,7,5,7,10,12,10,7],chorus:[7,7,10,12,10,7,3,5,7,null,10,7,5,3,0,null,3,5,7,10,12,10,7,5,3,0,3,7,5,null,3,0],bridge:[0,null,null,3,7,null,5,3,10,null,7,5,3,null,0,null]},
    '트라이벌':{verse:[0,2,4,null,7,9,7,4,2,0,2,4,7,null,4,2],lift:[4,7,9,12,9,7,9,12,14,12,9,7,4,7,9,12],chorus:[7,9,12,9,7,4,2,4,7,12,14,12,9,7,4,2,0,4,7,9,12,9,7,4,2,4,7,9,7,4,2,0],bridge:[0,null,7,4,2,null,9,7,4,null,2,0,7,4,2,null]}
  };
  function melodyAt(track,beat){const part=section(beat),bank=tunes[track.genre],phrase=bank[part.name==='final'?'chorus':part.name]||bank.verse;return phrase[(beat-part.start)%phrase.length];}
  const chordRoot=(track,t)=>{
    const beat=Math.floor(Math.max(0,t)/(60/track.bpm)),part=section(beat);
    const offsets=track.genre==='재즈'?(part.name==='lift'?[5,2,7,0]:[0,-3,-5,-2]):track.genre==='힙합'?(part.name==='bridge'?[0,-3,-5,0]:[0,-5,-3,-5]):part.name==='lift'?[5,7,9,7]:part.name==='bridge'?[9,5,0,7]:[0,7,9,5];
    return track.root+offsets[Math.floor((beat-part.start)/8)%4];
  };
  async function music(track){
    const b=60/track.bpm,duration=BEATS*b,sr=44100;
    const offline=new OfflineAudioContext(2,Math.ceil(duration*sr),sr);
    const master=offline.createGain();master.gain.value=.65;
    const compressor=offline.createDynamicsCompressor();master.connect(compressor);compressor.connect(offline.destination);
    const delay=offline.createDelay(1),wet=offline.createGain();delay.delayTime.value=b*.75;wet.gain.value=.12;master.connect(delay);delay.connect(wet);wet.connect(compressor);
    const noise=offline.createBuffer(1,sr,sr),data=noise.getChannelData(0);
    let seed=track.seed;for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1;}
    function voice(t,f,len,gain,type='triangle',slide){
      const osc=offline.createOscillator(),g=offline.createGain();osc.type=type;osc.frequency.setValueAtTime(f,t);
      if(slide)osc.frequency.exponentialRampToValueAtTime(slide,t+len);
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+len);
      osc.connect(g);g.connect(master);osc.start(t);osc.stop(t+len+.01);
    }
    const hz=n=>440*2**((n-69)/12);
    function piano(t,n,len,g){for(const [harmonic,amp] of [[1,1],[2,.25],[3,.075],[4,.03]])voice(t,hz(n)*harmonic,len/(1+harmonic*.12),g*amp,'sine');}
    function drum(t,len,gain,freq){
      const src=offline.createBufferSource(),filter=offline.createBiquadFilter(),g=offline.createGain();src.buffer=noise;filter.type='bandpass';filter.frequency.value=freq;
      g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+len);src.connect(filter);filter.connect(g);g.connect(master);src.start(t);src.stop(t+len);
    }
    for(let beat=0;beat<BEATS;beat++){
      const t=beat*b;
      const jazz=track.genre==='재즈',hip=track.genre==='힙합',pop=track.genre==='팝';
      const part=section(beat),chorus=part.name==='chorus'||part.name==='final',bridge=part.name==='bridge';
      const root=chordRoot(track,t);
      if(jazz){drum(t,.12,.075,6500);drum(t+b*.64,.06,.05,7100);if(beat%4===1||beat%4===3)drum(t,.18,.14,1900);voice(t,hz(root-24+[0,4,7,9][beat%4]),b*.8,.23,'sine');}
      else{
        if(beat%2===0||hip&&beat%8===7)voice(t,hip?160:125,hip?.3:.2,.55,'sine',hip?34:45);
        if(beat%4===1||beat%4===3){drum(t,.16,.32,1800);drum(t+.014,.08,.11,2800);if(!hip)voice(t,210,.1,.12,'sine',80);}
        drum(t,.04,.075,8200);if(beat>=8)drum(t+b/2,.04,.05,8800);
        voice(t,hz(root-24),hip?b*.92:b*.6,.22,hip?'sine':'triangle');
      }
      if(beat%4===0){for(const n of jazz?[0,4,7,11]:hip?[0,3,7,10]:[0,4,7])piano(t+(jazz?.02:0),root+n-12,b*2.8,jazz?.07:chorus?.06:.035);}
      if(beat<BEATS-4){
        const step=melodyAt(track,beat);
        if(step!==null){
          const n=root+step+(jazz||hip||bridge?0:12);
          if(jazz||hip||bridge||part.name==='verse')piano(t,n,b*(bridge?1.6:hip?.7:1.1),hip?.10:.12);
          else{voice(t,hz(n),b*.85,chorus?.13:.10,'triangle');voice(t,hz(n)*2,b*.6,.025,'sine');}
          if(chorus&&beat%2===0)piano(t,n-12,b*1.3,.05);
          if(beat>=12&&beat%4!==3&&!bridge){const half=t+b*(track.swing||.5),next=melodyAt(track,beat+1);if(next!==null)piano(half,root+next+(chorus?12:0),b*.45,.055);}
          if(pop&&chorus&&beat%4===3)for(const h of [0,7])voice(t+b*.75,hz(n+h),b*.22,.025,'triangle');
        }
        if(chorus&&beat%8===0)for(const n of [0,4,7])voice(t,hz(root+n),b*5,.025,'sine');
        if(part.name==='lift'&&beat%4===3){drum(t+b*.5,.045,.10,3400);drum(t+b*.75,.04,.12,3400);}
      }
    }
    return offline.startRendering();
  }
  return {tracks,chart,judge,music,units,holdOutcome,chordRoot,melodyAt,section,BEATS,PERFECT_WINDOW,GOOD_WINDOW};
})();
if(typeof module!=='undefined')module.exports=Rhythm;
