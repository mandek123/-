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

    // top notice: the latest notice scrolls right to left, one line, looping
    function makeTicker() {
        var bar = document.getElementById('top-notice-banner');
        if (!bar || typeof NOTICE_DATABASE === 'undefined' || !NOTICE_DATABASE.length) return;
        var n = NOTICE_DATABASE[0];
        bar.innerHTML = '<div class="tk"><span class="tk-tag">공지</span>' +
            '<div class="tk-lane"><span class="tk-run"><b>' + esc(n.date) + '</b>' + esc(n.summary || n.title) + '</span></div>' +
            '<button type="button" class="tk-more" onclick="showPage(\'page-notice\')">더보기</button></div>';
    }
    window.addEventListener('load', function () { setTimeout(makeTicker, 0); });
    // the page's own script may refill the banner later; keep our single-notice version
    var tkBar = document.getElementById('top-notice-banner');
    if (tkBar) new MutationObserver(function () {
        if (!tkBar.querySelector('.tk')) makeTicker();
    }).observe(tkBar, { childList: true });

    // inner pages: a title header on each page
    var PAGE_HEADS = {
        'page-exp': ['calc', 'fa-chart-simple', '경험치계산기', '레벨 구간과 사냥터로 필요한 경험치와 시간을 계산해요.'],
        'page-acc': ['calc', 'fa-crosshairs', '명중/회피계산기', '공격자와 방어자의 순발력으로 명중률을 계산해요.'],
        'page-rev': ['calc', 'fa-arrows-left-right', '순발력범위계산기', '전투 순발력 범위를 거꾸로 계산해요.'],
        'page-battle': ['calc', 'fa-khanda', '종합전투시뮬', '스탯과 속성으로 전투 결과를 시뮬레이션해요.'],
        'page-ency': ['ency', 'fa-book-open', '펫 도감', '모든 페트의 스탯과 능력을 찾고 도감 등록을 관리해요.'],
        'page-ency-status': ['ency', 'fa-square-check', '나의 도감 현황', '등록한 페트와 도감 능력 달성 현황을 확인해요.'],
        'page-item-sim': ['ency', 'fa-hammer', '아이템 시뮬레이터', '장비 감정과 인챈트를 미리 시뮬레이션해요.'],
        'page-levelup-sim': ['ency', 'fa-arrow-up-right-dots', '레벨업 시뮬레이션', '레벨업에 따른 스탯 변화를 미리 확인해요.'],
        'page-init-sim': ['ency', 'fa-rotate', '초기화 시뮬레이션', '페트 초기화 결과를 미리 시뮬레이션해요.'],
        'page-weekly-championship': ['game', 'fa-trophy', '펫 육성 챔피언십', '주간 실시간 랭킹 대전'],
        'page-arena': ['game', 'fa-khanda', '투기장', '월간 실시간 랭킹 대전'],
        'page-raid': ['game', 'fa-skull', '1인 레이드', '실시간으로 저장되는 레이드'],
        'page-idle-rpg': ['game', 'fa-gamepad', '만득이 키우기', '방치형 자동사냥 미니게임'],
        'page-notice': ['info', 'fa-bullhorn', '공지사항', '업데이트와 안내 소식'],
        'page-raid-guide': ['info', 'fa-fire', '레이드 패시브 안내', '레이드 전투 패시브 효과를 한눈에 봐요.'],
        'page-bot': ['info', 'fa-robot', '만득봇 안내', '디스코드에서도 만득월드 기능을 써요.']
    };
    function renderPageHeads() {
        Object.keys(PAGE_HEADS).forEach(function (id) {
            var page = document.getElementById(id), h = PAGE_HEADS[id];
            if (!page || page.querySelector(':scope > .pg-head')) return;
            var head = document.createElement('header');
            head.className = 'pg-head';
            head.innerHTML = '<span class="pg-ic pg-ic--' + h[0] + '"><i class="fa-solid ' + h[1] + '"></i></span>' +
                '<div class="pg-titles"><h1 class="pg-title">' + h[2] + '</h1><p class="pg-desc">' + h[3] + '</p></div>' +
                '<button type="button" class="pg-home" onclick="showPage(\'page-home\')"><i class="fa-solid fa-house"></i> 홈</button>';
            page.insertBefore(head, page.firstChild);
            // the page's first card often repeats the same title: keep its buttons, drop the words
            var first = page.querySelector('.card .card-header');
            if (first && first.textContent.replace(/\s+/g, '').indexOf(h[2].replace(/\s+/g, '')) === 0) {
                first.classList.add('is-dup');
                Array.prototype.slice.call(first.childNodes).forEach(function (node) {
                    if (node.nodeType === 1 && node.tagName !== 'I' && !node.querySelector('button, a, input, select') &&
                        node.textContent.replace(/\s+/g, '') === h[2].replace(/\s+/g, '')) {
                        node.classList.add('dup-txt');
                    } else if (node.nodeType === 3 && node.nodeValue.trim()) {
                        var span = document.createElement('span'); span.className = 'dup-txt';
                        span.textContent = node.nodeValue; first.replaceChild(span, node);
                    }
                });
                var rest = Array.prototype.some.call(first.children, function (c) { return !c.classList.contains('dup-txt') && c !== first.firstElementChild; });
                if (!rest) first.classList.add('is-empty');
            }
        });
    }

    // emoji in headings and labels become drawn icons
    var EMOJI_ICON = {
        '🏆': 'fa-trophy', '📜': 'fa-scroll', '💎': 'fa-gem', '⚔': 'fa-khanda', '🛡': 'fa-shield-halved', '⚡': 'fa-bolt',
        '🎯': 'fa-crosshairs', '📊': 'fa-chart-simple', '📑': 'fa-book', '📍': 'fa-location-dot', '💤': 'fa-moon',
        '🏋': 'fa-dumbbell', '😈': 'fa-skull', '⚠': 'fa-triangle-exclamation', '🔄': 'fa-rotate', '🐾': 'fa-paw',
        '⏱': 'fa-clock', '🕒': 'fa-clock', '💰': 'fa-coins', '🎁': 'fa-gift', '🔥': 'fa-fire', '📢': 'fa-bullhorn',
        '✅': 'fa-check', '🥚': 'fa-egg', '🐶': 'fa-dog', '🦇': 'fa-ghost', '💀': 'fa-skull', '⭐': 'fa-star',
        '📈': 'fa-arrow-trend-up', '🔍': 'fa-magnifying-glass', '📦': 'fa-box', '🎲': 'fa-dice', '💢': 'fa-burst',
        '🍖': 'fa-drumstick-bite', '📚': 'fa-book-open', '🎮': 'fa-gamepad', '🤖': 'fa-robot', '👑': 'fa-crown',
        '💡': 'fa-lightbulb', '📌': 'fa-thumbtack', '🔒': 'fa-lock', '🔓': 'fa-lock-open', '🧪': 'fa-flask',
        '🪙': 'fa-coins', '🗡': 'fa-khanda', '🏹': 'fa-bullseye', '❤': 'fa-heart', '💖': 'fa-heart', '✨': 'fa-wand-magic-sparkles',
        '📅': 'fa-calendar', '📝': 'fa-pen', '🔧': 'fa-wrench', '🔨': 'fa-hammer', '🎉': 'fa-champagne-glasses', '❗': 'fa-circle-exclamation'
    };
    var EMOJI_RE = new RegExp('(' + Object.keys(EMOJI_ICON).join('|') + ')\\uFE0F?', 'g');
    var ICON_SCOPE = '.card-header, .card-title, .res-label, .input-group-title, summary, label, h1, h2, h3, h4, h5, .notice-banner';
    function iconize(root) {
        (root || document).querySelectorAll(ICON_SCOPE).forEach(function (el) {
            if (el.closest('#page-home, select, option, textarea')) return;
            var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [], n;
            while ((n = walker.nextNode())) { EMOJI_RE.lastIndex = 0; if (EMOJI_RE.test(n.nodeValue)) nodes.push(n); }
            nodes.forEach(function (node) {
                var frag = document.createDocumentFragment(), last = 0, text = node.nodeValue, m;
                EMOJI_RE.lastIndex = 0;
                while ((m = EMOJI_RE.exec(text))) {
                    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
                    var i = document.createElement('i');
                    i.className = 'fa-solid ' + EMOJI_ICON[m[1]] + ' te-ic';
                    i.setAttribute('aria-hidden', 'true');
                    frag.appendChild(i);
                    last = m.index + m[0].length;
                }
                if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
                node.parentNode.replaceChild(frag, node);
            });
        });
    }
    if (typeof window.showPage === 'function') {
        var originalShowPage = window.showPage;
        window.showPage = function (id) {
            var r = originalShowPage.apply(this, arguments);
            var page = document.getElementById(id);
            if (page && id !== 'page-home') { iconize(page); window.scrollTo(0, 0); }
            return r;
        };
    }

    renderPageHeads();
    window.addEventListener('load', function () { setTimeout(function () { iconize(); }, 0); });
    renderPet();
    renderNews();
    renderPick();
    var next = document.getElementById('th-petday-next');
    if (next) next.addEventListener('click', renderPet);
})();
