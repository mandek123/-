// 만득월드 · original BGM, synthesized live with Web Audio (no audio files, no license).
// Five tracks. Off by default; the home player and the small corner button start, stop and shuffle.
(function () {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;

    var VOLUME = 0.12;
    var ctx, master, noiseBuf, timer, step = 0, nextTime = 0, playing = false;

    function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

    /* ---------- instruments ---------- */
    function env(g, t, peak, attack, dur) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    function osc(type, freq, t, dur, peak, attack, cutoff) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t);
        env(g, t, peak, attack || 0.01, dur);
        if (cutoff) { var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; o.connect(f); f.connect(g); }
        else o.connect(g);
        g.connect(master); o.start(t); o.stop(t + dur + 0.05);
        return o;
    }
    var I = {
        chip: function (m, t, d) { osc('square', hz(m), t, d, 0.15, 0.01, 2600); },
        bass: function (m, t, d) { osc('triangle', hz(m), t, d, 0.32, 0.01); },
        pad: function (m, t, d) { osc('sawtooth', hz(m), t, d, 0.022, 0.08, 1200); osc('sawtooth', hz(m) * 1.004, t, d, 0.018, 0.08, 1200); },
        // wooden bars: a struck sine with a quick bright overtone
        marimba: function (m, t, d) { osc('sine', hz(m), t, Math.min(d, 0.5), 0.34, 0.004); osc('sine', hz(m) * 4, t, 0.09, 0.07, 0.002); },
        // hollow log drum for bass lines
        log: function (m, t) { var o = osc('sine', hz(m) * 1.5, t, 0.35, 0.5, 0.004); o.frequency.exponentialRampToValueAtTime(hz(m), t + 0.06); },
        // breathy bone flute with vibrato
        flute: function (m, t, d) {
            var o = osc('triangle', hz(m), t, d, 0.2, 0.07, 3000);
            var lfo = ctx.createOscillator(), lg = ctx.createGain();
            lfo.frequency.value = 5.2; lg.gain.value = hz(m) * 0.008;
            lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + d + 0.05);
            noise(t, Math.min(d, 0.25), 0.025, 3500);
        },
        tom: function (t, f) { var o = osc('sine', f, t, 0.32, 0.55, 0.003); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.3); },
        kick: function (t) { var o = osc('sine', 140, t, 0.17, 0.6, 0.002); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); },
        snare: function (t) { noise(t, 0.13, 0.24, 1800); },
        hat: function (t) { noise(t, 0.03, 0.05, 7000); },
        shaker: function (t, g) { noise(t, 0.06, g || 0.06, 5200); },
        clack: function (t) { noise(t, 0.04, 0.22, 2600); osc('square', 1800, t, 0.015, 0.05, 0.001); }
    };
    function noise(t, dur, gain, hp) {
        var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp;
        g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
    }

    /* ---------- tracks: 4 bars of eighth notes (32 steps), 0 = rest ---------- */
    function lengthAt(arr, i, max) { var n = 1; while (n < max && !arr[(i + n) % arr.length]) n++; return n; }

    var TRACKS = [
        {
            name: 'BGM_1', bpm: 124,
            lead: [69, 0, 72, 74, 76, 0, 74, 72,  74, 0, 76, 79, 76, 74, 72, 0,  69, 0, 72, 74, 76, 79, 81, 79,  76, 0, 74, 72, 69, 0, 0, 0],
            roots: [45, 50, 45, 52],
            play: function (i, t, S) {
                var b = i % 8, bar = Math.floor(i / 8) % 4, n = this.lead[i];
                if (n) I.marimba(n, t, S * lengthAt(this.lead, i, 3));
                if ([0, 3, 4, 6].indexOf(b) > -1) I.log(this.roots[bar] + (b === 6 ? 12 : 0), t);
                if (b === 0 || b === 4) I.tom(t, 95);
                if (b === 3 || b === 7) I.tom(t, 170);
                if (b === 2 || b === 6) I.clack(t);
                I.shaker(t, b % 2 ? 0.07 : 0.04);
            }
        },
        {
            name: 'BGM_2', bpm: 96,
            lead: [74, 0, 0, 77, 76, 0, 74, 0,  72, 0, 69, 0, 0, 0, 0, 0,  74, 0, 77, 0, 79, 0, 81, 79,  77, 0, 76, 0, 74, 0, 0, 0],
            play: function (i, t, S) {
                var b = i % 8, n = this.lead[i];
                if (n) I.flute(n, t, S * lengthAt(this.lead, i, 6) * 0.95);
                if (b === 0) { I.pad(50, t, S * 7.5); I.pad(57, t, S * 7.5); I.log(38, t); }
                if (b === 0 || b === 3) I.tom(t, 80);
                if (b === 6) I.clack(t);
                if (b % 2) I.shaker(t, 0.05);
            }
        },
        {
            name: 'BGM_3', bpm: 116,
            lead: [72, 0, 76, 0, 79, 0, 76, 74,  72, 0, 69, 0, 72, 76, 74, 0,  77, 0, 76, 74, 72, 0, 69, 0,  71, 72, 74, 0, 79, 0, 0, 0],
            roots: [48, 45, 41, 43],
            chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
            play: function (i, t, S) {
                var b = i % 8, bar = Math.floor(i / 8) % 4, n = this.lead[i];
                if (n) I.chip(n, t, S * 1.6);
                I.bass(b % 2 ? this.roots[bar] + 12 : this.roots[bar], t, S * 0.9);
                if (b === 0) this.chords[bar].forEach(function (m) { I.pad(m, t, S * 7.5); });
                if (b === 0 || b === 4) I.kick(t);
                if (b === 2 || b === 6) I.snare(t);
                I.hat(t);
            }
        },
        {
            name: 'BGM_4', bpm: 140,
            lead: [76, 0, 76, 79, 0, 76, 74, 71,  72, 0, 72, 74, 0, 72, 71, 67,  69, 0, 69, 72, 0, 74, 76, 0,  71, 0, 74, 0, 78, 0, 0, 0],
            roots: [40, 36, 33, 35],
            play: function (i, t, S) {
                var b = i % 8, bar = Math.floor(i / 8) % 4, n = this.lead[i];
                if (n) I.chip(n, t, S * 1.3);
                I.bass(this.roots[bar] + (b === 3 || b === 7 ? 12 : 0), t, S * 0.8);
                if (b === 0 || b === 3 || b === 4) I.kick(t);
                if (b === 2 || b === 6) I.snare(t);
                if (b === 0 || b === 4) I.tom(t, 120);
                I.hat(t);
            }
        },
        {
            name: 'BGM_5', bpm: 84,
            chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
            lead: new Array(32).fill(1),
            play: function (i, t, S) {
                var b = i % 8, bar = Math.floor(i / 8) % 4, c = this.chords[bar];
                var tones = [c[0], c[1], c[2], c[0] + 12];
                I.marimba(tones[[0, 1, 2, 3, 2, 1, 2, 1][b]], t, S * 1.4);
                if (b === 0) { I.log(c[0] - 12, t); I.pad(c[0], t, S * 7.5); }
                if (b === 4) I.shaker(t, 0.05);
            }
        }
    ];

    var trackIndex = 0;
    try {
        var savedTrack = parseInt(localStorage.getItem('manduk_bgm_track'), 10);
        if (savedTrack >= 0 && savedTrack < TRACKS.length) trackIndex = savedTrack;
    } catch (e) {}

    function tick() {
        var tr = TRACKS[trackIndex], S = 60 / tr.bpm / 2;
        while (nextTime < ctx.currentTime + 0.15) {
            tr.play(step, nextTime, S);
            step = (step + 1) % tr.lead.length;
            nextTime += S;
        }
    }

    function ensureCtx() {
        if (ctx) return;
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        var d = noiseBuf.getChannelData(0);
        for (var k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
    }
    function start() {
        ensureCtx();
        ctx.resume();
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(VOLUME, ctx.currentTime, 0.08);
        step = 0; nextTime = ctx.currentTime + 0.06;
        clearInterval(timer); timer = setInterval(tick, 25);
        playing = true; sync(true);
    }
    function stop() {
        playing = false; sync(true);
        if (!ctx) return;
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
        clearInterval(timer);
        setTimeout(function () { if (!playing) ctx.suspend(); }, 400);
    }
    function toggle() { playing ? stop() : start(); }
    function shuffle() {
        var next;
        do { next = Math.floor(Math.random() * TRACKS.length); } while (next === trackIndex && TRACKS.length > 1);
        trackIndex = next;
        try { localStorage.setItem('manduk_bgm_track', String(trackIndex)); } catch (e) {}
        if (playing) {   // quick fade, then start the new track on the beat
            master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04);
            clearInterval(timer);
            setTimeout(start, 180);
        } else {
            start();
        }
        sync(false);
    }

    /* ---------- UI: corner button (inner pages) + home player ---------- */
    var corner = document.createElement('button');
    corner.type = 'button';
    corner.className = 'bgm-toggle';
    corner.innerHTML = '<span class="bgm-ic"><i class="fa-solid fa-music"></i></span><span class="bgm-label">BGM</span><span class="bgm-bars" aria-hidden="true"><i></i><i></i><i></i></span>';
    corner.addEventListener('click', toggle);
    document.body.appendChild(corner);

    var home = document.getElementById('th-bgm');
    if (home) {
        home.addEventListener('click', function (e) {
            var b = e.target.closest('[data-bgm]');
            if (!b) return;
            if (b.dataset.bgm === 'toggle') toggle();
            if (b.dataset.bgm === 'shuffle') shuffle();
        });
    }

    function sync(save) {
        var label = playing ? '배경음악 끄기' : '배경음악 켜기';
        corner.setAttribute('aria-pressed', String(playing));
        corner.setAttribute('aria-label', label); corner.title = label;
        if (home) {
            home.classList.toggle('is-playing', playing);
            var tg = home.querySelector('[data-bgm="toggle"]');
            tg.setAttribute('aria-pressed', String(playing));
            tg.innerHTML = playing ? '<i class="fa-solid fa-stop"></i><span>BGM 끄기</span>' : '<i class="fa-solid fa-play"></i><span>BGM 켜기</span>';
            home.querySelector('[data-bgm-title]').textContent = TRACKS[trackIndex].name;
        }
        if (save) { try { localStorage.setItem('manduk_bgm', playing ? 'on' : 'off'); } catch (e) {} }
    }
    sync(false);

    // browsers block sound until the visitor interacts: resume a saved "on" at the first click
    var saved = null;
    try { saved = localStorage.getItem('manduk_bgm'); } catch (e) {}
    if (saved === 'on') {
        var resume = function (e) {
            document.removeEventListener('pointerdown', resume, true);
            if (!playing && !e.target.closest('.bgm-toggle, #th-bgm')) start();
        };
        document.addEventListener('pointerdown', resume, true);
    }
})();
