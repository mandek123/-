// 만득월드 · home panels: a random pet, latest notices, and a random menu pick.
// Reads existing data only (PET_DATABASE, NOTICE_DATABASE); stores nothing.
(function () {
    var ELEMENT_CLASS = { '지': 'earth', '수': 'water', '화': 'fire', '풍': 'wind' };

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function pickOne(list) { return list[Math.floor(Math.random() * list.length)]; }

    var lastPet = null;
    function renderPet() {
        var box = document.querySelector('#th-petday .th-petday-body');
        if (!box || typeof PET_DATABASE === 'undefined') return;
        var pool = PET_DATABASE.filter(function (p) { return p.img && p !== lastPet; });
        if (!pool.length) return;
        var pet = lastPet = pickOne(pool);
        var elements = String(pet.elements || '').split(' ').filter(Boolean).map(function (el) {
            return '<span class="th-el th-el--' + (ELEMENT_CLASS[el.charAt(0)] || 'wind') + '">' + esc(el) + '</span>';
        }).join(' ');
        box.innerHTML =
            '<div class="th-petday-art"><img src="' + esc(pet.img) + '" alt="' + esc(pet.name) + '"></div>' +
            '<div>' +
                '<div class="th-petday-name"><strong>' + esc(pet.name) + '</strong><span class="th-grade" data-grade="' + esc(pet.grade) + '">' + esc(pet.grade) + '</span><small>' + esc(pet.category) + ' · ' + elements + '</small></div>' +
                '<dl class="th-petday-stats">' +
                    '<dt>초기치 (체/공/방/순)</dt><dd>' + [pet.hp, pet.atk, pet.def, pet.spd].map(esc).join(' / ') + '</dd>' +
                    '<dt>성장률 (체/공/방/순)</dt><dd>' + [pet.ghp, pet.gatk, pet.gdef, pet.gspd].map(esc).join(' / ') + '</dd>' +
                '</dl>' +
                '<button type="button" class="th-petday-go" onclick="showPage(\'page-ency\')">펫 도감에서 보기 <i class="fa-solid fa-arrow-right"></i></button>' +
            '</div>';
    }

    function renderNews() {
        var list = document.getElementById('th-news-list');
        if (!list || typeof NOTICE_DATABASE === 'undefined') return;
        list.innerHTML = NOTICE_DATABASE.slice(0, 3).map(function (n) {
            return '<li><button type="button" class="th-news-item" onclick="showPage(\'page-notice\')">' +
                '<time>' + esc(n.date) + '</time><strong>' + esc(n.title) + '</strong><span>' + esc(n.summary) + '</span>' +
                '</button></li>';
        }).join('');
    }

    // the fifth rail slot: any menu not already listed above it
    var PICKS = [
        ['page-acc', 'fa-crosshairs', '명중/회피계산기'],
        ['page-rev', 'fa-arrows-left-right', '순발력범위계산기'],
        ['page-battle', 'fa-khanda', '종합전투시뮬'],
        ['page-weekly-championship', 'fa-trophy', '펫 육성 챔피언십'],
        ['page-arena', 'fa-khanda', '투기장 (PvP)'],
        ['page-raid', 'fa-skull', '1인 레이드'],
        ['page-idle-rpg', 'fa-gamepad', '만득이 키우기'],
        ['survival', 'fa-ghost', '만득서바이벌'],
        ['page-item-sim', 'fa-hammer', '아이템 시뮬레이터'],
        ['page-levelup-sim', 'fa-arrow-up-right-dots', '레벨업 시뮬레이션'],
        ['page-init-sim', 'fa-rotate', '초기화 시뮬레이션'],
        ['page-raid-guide', 'fa-fire', '레이드 패시브 안내'],
        ['page-bot', 'fa-robot', '만득봇 안내']
    ];
    function renderPick() {
        var btn = document.getElementById('th-pick');
        if (!btn) return;
        var p = pickOne(PICKS);
        btn.setAttribute('onclick', p[0] === 'survival' ? 'sv_openSurvivalMode()' : "showPage('" + p[0] + "')");
        btn.innerHTML = '<i class="fa-solid ' + p[1] + '"></i> <span>' + p[2] + '</span><em>추천</em>';
    }

    // top notice: show one notice at a time, fading between the latest three
    var tkTimer;
    function makeTicker() {
        clearInterval(tkTimer);
        var bar = document.getElementById('top-notice-banner');
        if (!bar || typeof NOTICE_DATABASE === 'undefined' || !NOTICE_DATABASE.length) return;
        var items = NOTICE_DATABASE.slice(0, 3), i = 0;
        bar.innerHTML = '<div class="tk"><span class="tk-tag">공지</span><span class="tk-msg" aria-live="polite"></span>' +
            '<button type="button" class="tk-more" onclick="showPage(\'page-notice\')">더보기</button></div>';
        var msg = bar.querySelector('.tk-msg');
        function show() {
            var n = items[i];
            msg.innerHTML = '<b>' + esc(n.date) + '</b>' + esc(n.summary || n.title);
        }
        show();
        if (items.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        tkTimer = setInterval(function () {
            if (bar.matches(':hover')) return;
            msg.classList.add('is-out');
            setTimeout(function () { i = (i + 1) % items.length; show(); msg.classList.remove('is-out'); }, 500);
        }, 6000);
    }
    window.addEventListener('load', function () { setTimeout(makeTicker, 0); });
    // the page's own script may refill the banner later; keep our single-notice version
    var tkBar = document.getElementById('top-notice-banner');
    if (tkBar) new MutationObserver(function () {
        if (!tkBar.querySelector('.tk')) makeTicker();
    }).observe(tkBar, { childList: true });

    renderPet();
    renderNews();
    renderPick();
    var next = document.getElementById('th-petday-next');
    if (next) next.addEventListener('click', renderPet);
})();
