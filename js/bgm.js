// Supplied music shared with Pet Rhythm Rush. Playback begins on a user gesture.
(function () {
    var TRACKS = MUSIC_TRACKS, audio = new Audio(), playing = false, version = 0;
    audio.loop = true; audio.preload = 'none'; audio.volume = 0.25;
    var trackIndex = 0;
    try {
        var savedTrack = parseInt(localStorage.getItem('manduk_bgm_track'), 10);
        if (savedTrack >= 0 && savedTrack < TRACKS.length) trackIndex = savedTrack;
    } catch (e) {}
    function setTrack() { audio.src = './games/pet-rhythm/' + TRACKS[trackIndex].src; }
    setTrack();
    async function start() {
        var request = ++version;
        try {
            await audio.play();
            if (request !== version) return;
            playing = true; sync(true);
        } catch (e) {
            if (request !== version) return;
            playing = false; sync(false);
            corner.title = '음악을 불러오지 못했어요. 다시 눌러주세요.';
            if (home) home.querySelector('[data-bgm-title]').textContent = '재생 실패 · 다시 눌러주세요';
        }
    }
    function stop() { ++version; audio.pause(); playing = false; sync(true); }
    function toggle() { audio.paused ? start() : stop(); }
    function shuffle() {
        var next;
        do { next = Math.floor(Math.random() * TRACKS.length); } while (next === trackIndex && TRACKS.length > 1);
        ++version; audio.pause(); playing = false; trackIndex = next; setTrack();
        try { localStorage.setItem('manduk_bgm_track', String(trackIndex)); } catch (e) {}
        sync(false); start();
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
