/*
=============================================================================
[파일 설명서] app.js 
=============================================================================
*/

/* =============================================================================
   [AI DO NOT EDIT] 🔒 코어 방어 엔진 (물리적 헤드락 적용)
   ============================================================================= */
(function initHeadlock() {
    // 브라우저 개발자 도구 및 소스코드 열람 단축키 차단
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', e => {
        if (e.keyCode === 123 || // F12
            (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) || // Ctrl+Shift+I/J/C
            (e.ctrlKey && e.keyCode === 85)) { // Ctrl+U
            e.preventDefault();
            console.warn("🔒 [개복디 넥서스 가이드] 핵심 계산 데이터는 임의 조작 방지를 위해 보호(헤드락) 처리되어 있습니다.");
        }
    });
    
    // 디버거 무한 루프 (개발자 도구가 열려있을 시 정상 분석 방해)
    setInterval(() => {
        const before = new Date().getTime();
        debugger;
        const after = new Date().getTime();
        if (after - before > 100) {
            // 디버거 지연 감지 시 추가 조치를 취할 수 있음
        }
    }, 100);
    console.log("%c🔒 넥서스 핵심 엔진 보호(헤드락) 가동 중", "color: #00e5ff; font-size: 14px; font-weight: bold; background: #000; padding: 6px 12px; border: 1px solid #00e5ff; border-radius: 4px;");
})();
/* ============================================================================= */


let _activeTabIdx = 0;
let _currentAppMode = 'classic'; // 'expert', 'classic', 'jewel', 'unitcodex'
let _currentViewMode = 'codex';

/* =============================================================================
   [AI DO NOT EDIT] 🔒 핵심 계산 엔진 시작 - 절대 수정 불가 (헤드락 적용 구간)
   (unitMap, activeUnits 데이터 및 수량 상태는 결과 무결성을 위해 변조를 금합니다.)
   ============================================================================= */
const unitMap = new Map(), activeUnits = new Map(), ownedUnits = new Map(), essenceUnits = new Set(), DOM = {};
/* ============================================================================= */

const clean = s => s ? s.replace(/\s+/g, '').toLowerCase() : '';

const GRADE_ORDER = ["매직", "레어", "에픽", "유니크", "헬", "레전드", "히든", "슈퍼히든"];
const gradeColorsRaw = { "매직":"var(--grade-magic)", "레어":"var(--grade-rare)", "에픽":"var(--grade-epic)", "유니크":"var(--grade-unique)", "헬":"var(--grade-hell)", "레전드":"var(--grade-legend)", "히든":"var(--grade-hidden)", "슈퍼히든":"var(--grade-super)" };

const TAB_CATEGORIES = [
    {key:"테바", name:"테바", sym:"♆"}, {key:"테메", name:"테메", sym:"⚙︎"},
    {key:"토바", name:"토바", sym:"⟡"}, {key:"토메", name:"토메", sym:"⟁"},
    {key:"저그중립", name:"저그중립", sym:"☣︎"}, {key:"혼종", name:"혼종", sym:"⌬"}
];

const IGNORE_PARSE_RECIPES = ["미발견", "없음", "", "100라운드이전까지저그업20↑ [(타 종족 업 0)[1],역전 복권10회[1],인생 복권3회시-소환[1]]"];
const dashboardAtoms = ["전쟁광", "스파르타중대", "암흑광전사", "암흑파수기", "원시바퀴", "저격수", "코브라", "암흑고위기사", "암흑추적자", "변종가시지옥", "망치경호대", "공성파괴단", "암흑집정관", "암흑불멸자", "원시히드라리스크", "땅거미지뢰", "자동포탑", "우르사돈[암]", "우르사돈[수]", "갓오타/메시브"];

const EMPTY_SVG = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.2;"><rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect><line x1="3" y1="21" x2="21" y2="3"></line></svg>`;

function getUnitId(rawName){ const c=clean(rawName); const u=unitMap.get(c); return u ? u.id : c; }

// --- 햅틱 피드백 엔진 ---
function triggerHaptic() { if (typeof navigator !== 'undefined' && navigator.vibrate) { navigator.vibrate(15); } }

// --- 데이터 초기화 모듈 ---
function resetCodex(silent = false) { activeUnits.clear(); essenceUnits.clear(); updateAllPanels(); if(!silent) showToast("선택된 유닛이 초기화되었습니다."); }
function resetOwned() { ownedUnits.clear(); updateAllPanels(); showToast("보유 유닛이 초기화되었습니다."); }

// =========================================================
// 인터랙티브 가이드 엔진 v5.1 (모바일 터치 완벽 대응, 헤드락 제외)
// =========================================================
const TutorialEngine = {
    isActive: false,
    stepIndex: 0,
    _listeners: [],
    _flashTimer: null,

    PANEL_W: 280,
    PANEL_GAP: 16,
    HL_PAD: 8,

    steps: [
        {
            id: 'intro',
            setup: () => { resetCodex(true); },
            target: () => document.querySelector('.ms-card.classic'),
            prefer: 'bottom',
            badge: 'GUIDE START', badgeColor: 'cyan',
            title: '개복디 넥서스 가이드',
            titleColor: 'var(--grade-rare)',
            body: `이 가이드는 <strong style="color:var(--grade-rare);">도감 모드</strong>를 중심으로<br>
유닛 추가 → 코스트 확인 → 차감 계산까지<br>
<strong>직접 따라하며</strong> 익히는 실습형 튜토리얼입니다.`,
            action: `👇 <strong style="color:var(--grade-rare);">[도감 모드]</strong> 카드를 직접 클릭하세요!`,
            requireAction: 'click_classic_card', pulseTarget: true,
        },
        {
            id: 'tab_select',
            setup: () => {},
            target: () => document.getElementById('codexTabsWrap'),
            prefer: 'bottom',
            badge: 'STEP 1 / 6', badgeColor: 'cyan',
            title: '종족 탭 선택',
            titleColor: 'var(--grade-rare)',
            body: `왼쪽 패널 상단의 <strong>종족 탭</strong>을 클릭하면<br>해당 종족의 유닛 카드가 표시됩니다.`,
            action: `👆 아무 <strong>종족 탭</strong>이나 클릭하세요!`,
            requireAction: 'click_tab', pulseTarget: true,
        },
        {
            id: 'unit_click',
            setup: () => {},
            target: () => document.getElementById('tabContent'),
            prefer: 'right',
            badge: 'STEP 2 / 6', badgeColor: 'cyan',
            title: '유닛 추가하기',
            titleColor: 'var(--grade-rare)',
            body: `유닛 목록에서 원하는 카드를 <strong>클릭</strong>하여<br>
코스트 계산에 추가하세요.<br>
<span class="tut-mini-tip">✔ 클릭 시 카드가 <span style="color:var(--g);">청록색</span>으로 활성화</span>`,
            action: `👆 아무 <strong>유닛 카드</strong>나 클릭하세요!`,
            requireAction: 'click_unit', pulseTarget: false,
        },
        {
            id: 'dashboard_view',
            setup: () => {},
            target: () => document.getElementById('magicDashboard'),
            prefer: 'right',
            badge: 'STEP 3 / 6', badgeColor: 'epic',
            title: '코스트 대시보드',
            titleColor: 'var(--grade-epic)',
            body: `선택한 유닛에 필요한 <strong>모든 재료 코스트</strong>가<br>
여기에 자동 합산됩니다!<br>
<span class="tut-mini-tip">✔ 빛나는 숫자 = 필요한 재료 수량</span>`,
            action: null,
            requireAction: 'next', nextLabel: '확인했습니다 ➔',
            pulseTarget: true,
            onRender: () => {
                setTimeout(() => {
                    document.querySelectorAll('.cost-slot.active').forEach((s, i) =>
                        setTimeout(() => { s.classList.add('tut-flash'); setTimeout(() => s.classList.remove('tut-flash'), 900); }, i * 60)
                    );
                }, 300);
            },
        },
        {
            id: 'deduct_toggle',
            setup: () => {},
            target: () => document.getElementById('btnToggleMode'),
            prefer: 'bottom',
            badge: 'STEP 4 / 6', badgeColor: 'cyan',
            title: '차감 모드 전환',
            titleColor: 'var(--g)',
            body: `보유한 재료를 제외하고<br>
남은 코스트만 계산하려면?<br>
<span class="tut-mini-tip">💡 클릭 시 오른쪽 차감 패널이 열립니다</span>`,
            action: `👆 <strong style="color:var(--g);">[차감 모드 전환]</strong> 버튼을 클릭!`,
            requireAction: 'click_deduct', pulseTarget: true,
        },
        {
            id: 'owned_plus',
            setup: () => {},
            target: () =>
                document.querySelector('.deduct-slot.is-visible .owned-stepper button:last-child')
                || document.getElementById('deductionBoard'),
            prefer: 'left',
            badge: 'STEP 5 / 6', badgeColor: 'unique',
            title: '보유 수량 입력',
            titleColor: 'var(--grade-unique)',
            body: `차감 대시보드에서 보유 재료의<br>
<strong style="color:var(--grade-rare);">[+] 버튼</strong>을 눌러<br>
보유 수량을 입력해보세요.<br>
<span class="tut-mini-tip">✔ 즉시 왼쪽 코스트 숫자가 줄어듭니다</span>`,
            action: `👆 재료의 <strong style="color:var(--grade-rare);">[+]</strong> 를 클릭!`,
            requireAction: 'click_plus', pulseTarget: true,
        },
        {
            id: 'deduct_result',
            setup: () => {},
            target: () => document.getElementById('magicDashboard'),
            prefer: 'right',
            badge: 'STEP 6 / 6', badgeColor: 'cyan',
            title: '실시간 차감 반영 ✦',
            titleColor: 'var(--g)',
            body: `보유 수량만큼 <strong style="color:var(--g);">코스트 숫자가 줄었습니다!</strong><br><br>
<div class="tut-formula">
  <div class="tf-hdr"><span>필요</span><span>−</span><span style="color:var(--grade-rare);">보유</span><span>=</span><span style="color:var(--g);">잔여</span></div>
  <div class="tf-eg"><span>16개</span><span>−</span><span style="color:var(--grade-rare);">4개</span><span>=</span><span class="tf-result">12개</span></div>
</div><br>
<span class="tut-mini-tip">✔ [+]를 더 눌러 추가 차감 가능</span>`,
            action: null,
            requireAction: 'next', nextLabel: '이해했습니다! ➔',
            pulseTarget: true,
            onRender: () => {
                const flash = () => document.querySelectorAll('.cost-slot.active').forEach((s, i) =>
                    setTimeout(() => { s.classList.add('tut-flash'); setTimeout(() => s.classList.remove('tut-flash'), 900); }, i * 55)
                );
                setTimeout(flash, 200);
                TutorialEngine._flashTimer = setTimeout(flash, 2600);
            },
        },
        {
            id: 'finish',
            setup: () => {},
            target: null,
            prefer: 'center',
            badge: 'COMPLETE ✦', badgeColor: 'gold',
            title: '튜토리얼 완료! 🎉',
            titleColor: 'var(--g)',
            body: `<div class="tut-summary">
  <div class="tut-si"><span>📖</span><span>도감 모드 — 유닛 카드 클릭 등록</span></div>
  <div class="tut-si"><span>📊</span><span>코스트 대시보드 — 재료 자동 합산</span></div>
  <div class="tut-si"><span>⊖</span><span>차감 모드 — 보유 수량 입력 후 차감</span></div>
  <div class="tut-si"><span>✦</span><span>잔여 코스트 실시간 반영 확인</span></div>
</div>`,
            action: null,
            requireAction: 'finish', pulseTarget: false,
        },
    ],

    start() {
        this.isActive = true;
        this.stepIndex = 0;
        document.getElementById('modeSelector').classList.add('active');
        document.getElementById('tutOverlay').style.display = 'block';
        document.body.style.overflow = 'hidden';
        this._renderStep();
    },

    next() {
        if (!this.isActive) return;
        this._cleanListeners();
        if (this._flashTimer) { clearTimeout(this._flashTimer); this._flashTimer = null; }
        this.stepIndex++;
        if (this.stepIndex >= this.steps.length) { this.end(); return; }
        this._renderStep();
    },

    end() {
        this.isActive = false;
        this._cleanListeners();
        if (this._flashTimer) { clearTimeout(this._flashTimer); this._flashTimer = null; }
        const ov = document.getElementById('tutOverlay');
        if (ov) ov.style.display = 'none';
        document.body.style.overflow = '';
        resetCodex(true);
        openModeSelector();
    },

    handleEvent(actionType) {
        if (!this.isActive) return;
        const step = this.steps[this.stepIndex];
        if (step && step.requireAction === actionType) setTimeout(() => this.next(), 400);
    },

    _renderStep() {
        try {
            const step = this.steps[this.stepIndex];
            if (!step) { this.end(); return; }
            if (step.setup) step.setup();
            setTimeout(() => this._doRender(step), step.id === 'intro' ? 60 : 380);
        } catch (e) { console.error('[Tut]', e); this.end(); }
    },

    _doRender(step) {
        const hl    = document.getElementById('tutHighlight');
        const panel = document.getElementById('tutPanel');
        const bar   = document.getElementById('tutProgressBar');
        const lbl   = document.getElementById('tutStepLabel');
        const badge = document.getElementById('tutBadge');
        const title = document.getElementById('tutTitle');
        const body  = document.getElementById('tutBody');
        const act   = document.getElementById('tutAction');
        const btnN  = document.getElementById('tutBtnNext');

        if (!panel) return;

        const total = this.steps.length;
        if (bar) bar.style.width = ((this.stepIndex + 1) / total * 100) + '%';
        if (lbl) lbl.textContent = ['INTRO','1/6','2/6','3/6','4/6','5/6','6/6','DONE'][this.stepIndex] || '';

        if (badge) { badge.textContent = step.badge || ''; badge.className = 'tut-badge tut-badge--' + (step.badgeColor || 'cyan'); }
        if (title) { title.innerHTML = step.title || ''; title.style.color = step.titleColor || 'var(--text)'; }
        if (body)  body.innerHTML  = step.body  || '';
        if (act)   { act.innerHTML = step.action || ''; act.style.display = step.action ? 'block' : 'none'; }

        if (step.requireAction === 'next') {
            btnN.style.display = 'inline-flex';
            btnN.textContent = step.nextLabel || '다음 단계 ➔';
            btnN.onclick = () => this.next();
        } else if (step.requireAction === 'finish') {
            btnN.style.display = 'inline-flex';
            btnN.textContent = '가이드 완료 ✔';
            btnN.onclick = () => { this.end(); };
        } else {
            btnN.style.display = 'none';
        }

        let targetEl = null;
        try { targetEl = step.target ? step.target() : null; } catch (e) {}

        if (targetEl) {
            this._positionHighlight(hl, targetEl, step.pulseTarget);
            requestAnimationFrame(() => this._anchorPanel(panel, targetEl, step.prefer || 'right'));
        } else {
            hl.style.display = 'none';
            panel.style.cssText = `
                position:fixed; top:50%; left:50%;
                transform:translate(-50%,-50%);
                opacity:1; transition:opacity 0.25s;
            `;
        }

        this._setupActionListeners(step);
        if (step.onRender) step.onRender();
    },

    _positionHighlight(hl, el, pulse) {
        if (!el) { hl.style.display = 'none'; return; }
        const r = el.getBoundingClientRect();
        const p = this.HL_PAD;
        hl.style.cssText = `
            display:block;
            top:${r.top - p}px; left:${r.left - p}px;
            width:${r.width + p * 2}px; height:${r.height + p * 2}px;
        `;
        hl.className = 'tut-highlight' + (pulse ? ' pulse' : '');
    },

    _anchorPanel(panel, el, prefer) {
        const isMobile = window.innerWidth < 700 || (window.innerWidth < window.innerHeight && window.innerWidth < 900);
        if (isMobile) {
            panel.style.cssText = `
                position:fixed; left:0; right:0; bottom:0;
                width:100%; max-height:52vh;
                border-radius:16px 16px 0 0;
                transform:none; opacity:1;
                transition:opacity 0.22s;
            `;
            return;
        }

        const r    = el.getBoundingClientRect();
        const p    = this.HL_PAD;
        const gap  = this.PANEL_GAP;
        const pw   = this.PANEL_W;
        const ph   = panel.offsetHeight || 360;
        const vw   = window.innerWidth;
        const vh   = window.innerHeight;
        const margin = 12;

        const space = {
            right:  vw - (r.right  + p + gap),
            left:   r.left  - p - gap,
            bottom: vh - (r.bottom + p + gap),
            top:    r.top   - p - gap,
        };

        const dirs = [prefer, 'right', 'left', 'bottom', 'top'].filter(Boolean);
        let chosen = dirs.find(d => {
            if (d === 'right'  || d === 'left')   return space[d] >= pw + margin;
            if (d === 'bottom' || d === 'top')     return space[d] >= ph * 0.6;
            return false;
        }) || dirs[0];

        let top, left;

        if (chosen === 'right') {
            left = r.right + p + gap;
            top  = r.top + r.height / 2 - ph / 2;
        } else if (chosen === 'left') {
            left = r.left - p - gap - pw;
            top  = r.top + r.height / 2 - ph / 2;
        } else if (chosen === 'bottom') {
            top  = r.bottom + p + gap;
            left = r.left + r.width / 2 - pw / 2;
        } else {
            top  = r.top - p - gap - ph;
            left = r.left + r.width / 2 - pw / 2;
        }

        top  = Math.max(margin, Math.min(top,  vh - ph   - margin));
        left = Math.max(margin, Math.min(left, vw - pw   - margin));

        panel.style.cssText = `
            position:fixed;
            top:${top}px; left:${left}px;
            width:${pw}px;
            transform:none; opacity:1;
            transition:opacity 0.22s, top 0.28s cubic-bezier(0.4,0,0.2,1), left 0.28s cubic-bezier(0.4,0,0.2,1);
        `;
    },

    _addListener(el, ev, fn) { el.addEventListener(ev, fn, { passive: false }); this._listeners.push({el, ev, fn}); },

    _cleanListeners() {
        this._listeners.forEach(({el, ev, fn}) => { try { el.removeEventListener(ev, fn); } catch (e) {} });
        this._listeners = [];
    },

    _setupActionListeners(step) {
        // 모바일/태블릿 터치 환경 대응용 이중 바인딩 헬퍼
        const bindInteraction = (el, evName) => {
            this._addListener(el, 'click', () => this.handleEvent(evName));
            this._addListener(el, 'touchend', (e) => { this.handleEvent(evName); });
        };

        if (step.requireAction === 'click_classic_card') {
            const c = document.querySelector('.ms-card.classic');
            if (c) bindInteraction(c, 'click_classic_card');
        }
        if (step.requireAction === 'click_tab') {
            // [오류 수정] 폴링(setInterval) 대신 상위 컨테이너에 이벤트 위임(Event Delegation) 적용
            const tabsWrap = document.getElementById('codexTabsWrap');
            if (tabsWrap) {
                const tabHandler = (e) => {
                    if (e.target.closest('.tab-btn')) {
                        this.handleEvent('click_tab');
                    }
                };
                this._addListener(tabsWrap, 'click', tabHandler);
                this._addListener(tabsWrap, 'touchend', tabHandler);
            }
        }
        if (step.requireAction === 'click_deduct') {
            const b = document.getElementById('btnToggleMode');
            if (b) bindInteraction(b, 'click_deduct');
        }
    },
};

let _tutResizeTimer = null;
window.addEventListener('resize', () => {
    if (!TutorialEngine.isActive) return;
    clearTimeout(_tutResizeTimer);
    _tutResizeTimer = setTimeout(() => {
        const step = TutorialEngine.steps[TutorialEngine.stepIndex];
        if (step) TutorialEngine._doRender(step);
    }, 120);
});

// 초기 진입 및 모드 컨트롤
function checkInitialMode() {
    document.getElementById('modeSelector').classList.add('active');
}

function openModeSelector() { 
    _currentAppMode = 'classic';
    document.getElementById('modeSelector').classList.add('active');
    const layout = document.getElementById('mainLayout');
    if (layout) layout.classList.remove('view-jewel', 'view-unitcodex');
}

function initMode(mode, showToastMsg = true) {
    _currentAppMode = mode; 
    document.getElementById('modeSelector').classList.remove('active');
    const layout = document.getElementById('mainLayout'), searchWrap = document.getElementById('searchWrap');
    
    layout.classList.remove('mode-expert', 'view-jewel', 'view-unitcodex');
    if(mode === 'expert') { layout.classList.add('mode-expert'); document.getElementById('expertSearchContainer').appendChild(searchWrap); if(showToastMsg) showToast("검색 모드가 활성화되었습니다."); } 
    else if(mode === 'classic') { document.getElementById('classicSearchContainer').appendChild(searchWrap); if(showToastMsg) showToast("도감 모드가 활성화되었습니다."); } 
    else if(mode === 'jewel') { layout.classList.add('view-jewel'); if(showToastMsg) showToast("쥬얼 도감 모드가 활성화되었습니다."); }
    else if(mode === 'unitcodex') { 
        layout.classList.add('view-unitcodex'); 
        // 상태 초기화 후 재렌더
        _ucActiveTab = '전체';
        _ucSearchQuery = '';
        const tabsWrap = document.getElementById('unitCodexTabsWrap');
        const grid = document.getElementById('unitCodexGrid');
        const searchInput = document.getElementById('unitCodexSearch');
        if(tabsWrap) tabsWrap.innerHTML = '';
        if(grid) grid.innerHTML = '';
        if(searchInput) searchInput.value = '';
        renderUnitCodexGrid(); 
        if(showToastMsg) showToast("유닛 도감 모드가 활성화되었습니다."); 
    }
    
    switchLayout(_currentViewMode === 'deduct' ? 'deduct' : 'codex');
}


// =========================================================
// 검색 및 커맨드 엔진 (Search & Command) 
// =========================================================
let searchTimeout = null;
const ALIAS_MAP = { "타커": "타이커스", "타이": "타이커스", "닥템": "암흑기사", "다칸": "암흑집정관", "스투": "스투코프", "디젯": "디제스터", "메십": "메시브", "마랩": "마스터랩" };

function setupSearchEngine() {
    const inputEl = document.getElementById('unitSearchInput');
    if(!inputEl) return;
    inputEl.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const val = e.target.value;
        searchTimeout = setTimeout(() => performSearch(val), 150); 
    });
    inputEl.addEventListener('keydown', (e) => { if(e.key === 'Enter') { e.preventDefault(); processCommand(e.target.value); } });
    document.addEventListener('click', (e) => { const sr = document.getElementById('searchResults'); if(sr && !e.target.closest('#searchWrap')) sr.classList.remove('active'); });
}

function isSubsequence(query, target) { let qIdx = 0; for(let i = 0; i < target.length; i++) { if(target[i] === query[qIdx]) qIdx++; if(qIdx === query.length) return true; } return false; }
function findUnitFlexible(rawName) {
    let qClean = clean(rawName); if(!qClean) return null;
    for(let [id, u] of unitMap) { if(clean(u.name) === qClean || id === qClean) return u; }
    let aliased = ALIAS_MAP[rawName]; if(!aliased) { for(let key in ALIAS_MAP) { if(clean(key) === qClean) { aliased = ALIAS_MAP[key]; break; } } }
    if(aliased) { for(let [id, u] of unitMap) { if(clean(u.name) === clean(aliased)) return u; } }
    for(let [id, u] of unitMap) { if(clean(u.name).includes(qClean)) return u; }
    for(let [id, u] of unitMap) { if(isSubsequence(qClean, clean(u.name))) return u; }
    return null;
}

function performSearch(query) {
    const sr = document.getElementById('searchResults'); if(!query.trim()) { sr.classList.remove('active'); return; }
    const parts = query.split('/'); let currentQuery = parts[parts.length - 1].trim(); if(!currentQuery) { sr.classList.remove('active'); return; }

    let searchName = currentQuery.split('*')[0].trim(); let qClean = clean(searchName);
    let exactMatches = []; let partialMatches = [];

    unitMap.forEach(u => {
        let uClean = clean(u.name);
        if(uClean === qClean || u.name === searchName) exactMatches.push(u);
        else if(uClean.includes(qClean) || isSubsequence(qClean, uClean)) partialMatches.push(u);
    });

    exactMatches.sort((a,b) => GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade));
    partialMatches.sort((a,b) => GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade));
    let combined = [...new Set([...exactMatches, ...partialMatches])].slice(0, 10);

    if(combined.length > 0) {
        sr.innerHTML = combined.map(u => `
            <div class="sr-item" onclick="applySearchAutocomplete('${u.name}')">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="color:${gradeColorsRaw[u.grade]}; font-size:0.8rem; font-weight:900;">[${u.grade}]</span>
                    <span class="sr-name" style="color:var(--text);">${u.name}</span>
                </div>
                <span class="sr-cmd">↵ 자동완성</span>
            </div>
        `).join('');
        sr.classList.add('active');
    } else {
        sr.innerHTML = `<div style="padding:15px; text-align:center; color:var(--text-muted); font-size:0.9rem;">검색 결과가 없습니다.</div>`;
        sr.classList.add('active');
    }
}

function applySearchAutocomplete(unitName) {
    const inputEl = document.getElementById('unitSearchInput'); let parts = inputEl.value.split('/'); parts[parts.length - 1] = unitName;
    inputEl.value = parts.join('/') + '*1'; inputEl.focus(); document.getElementById('searchResults').classList.remove('active');
}

function processCommand(val) {
    if(!val.trim()) return;
    const commands = val.split('/'); let successCount = 0;
    
    commands.forEach(cmd => {
        let targetName = cmd.trim(); let qty = 1;
        if(cmd.includes('*')) { const parts = cmd.split('*'); targetName = parts[0].trim(); let parsedQty = parseInt(parts[1]); if(!isNaN(parsedQty) && parsedQty > 0) qty = parsedQty; }
        const match = findUnitFlexible(targetName);

        if(match) {
            let currentQty = activeUnits.get(match.id) || 0; let newQty = currentQty + qty;
            if(newQty > 16 && match.grade !== "슈퍼히든") newQty = 16; if(match.grade === "슈퍼히든") newQty = 1;
            activeUnits.set(match.id, newQty); essenceUnits.add(match.id); successCount++;
        }
    });

    if(successCount > 0) {
        updateAllPanels(); showToast(`<span class="t-icon">⚡</span> ${successCount}건의 커맨드 등록 완료`);
        const inputEl = document.getElementById('unitSearchInput'); if(inputEl) inputEl.value = '';
        document.getElementById('searchResults').classList.remove('active');
        if(_currentViewMode === 'deduct') switchLayout('codex');
        TutorialEngine.handleEvent('enter');
    } else { showToast(`<span class="t-icon">⚠</span> 유효한 유닛을 찾을 수 없습니다.`, true); }
}

function showToast(msg, isError = false) {
    const container = document.getElementById('toastContainer'); if(!container) return;
    const t = document.createElement('div'); t.className = 'toast' + (isError ? ' error' : ''); t.innerHTML = msg;
    container.appendChild(t); setTimeout(() => { if(t.parentElement) t.remove(); }, 1800);
}

// =========================================================
// 공통 리스너 및 유틸리티
// =========================================================
window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        hideRecipeTooltip();
        const searchEl = document.getElementById('unitSearchInput');
        if (document.activeElement === searchEl) {
            searchEl.value = '';
            document.getElementById('searchResults').classList.remove('active');
            searchEl.blur();
        }
    }
});

// =========================================================
// 코어 데이터 사전 파싱 
// =========================================================
function initializeCacheEngine() {
    unitMap.forEach(u => {
        u.parsedCost = [];
        if(u.cost && !IGNORE_PARSE_RECIPES.includes(u.cost)) {
            u.cost.split(',').forEach(p => {
                const m = p.match(/(.+?)\[(\d+(?:\.\d+)?)\]/);
                let name = m ? m[1].trim() : p.trim(); let qty = m ? parseFloat(m[2]) : 1; let cName = clean(name); let type = 'atom', key = cName;
                if(cName.includes('메시브') || cName.includes('디제스터')) { type='special'; key='메시브'; }
                else if(cName.includes('갓오브타임') || cName.includes('갓오타')) { type='special'; key='갓오타'; }
                else if(cName.includes('땅거미지뢰')) { key='땅거미지뢰'; }
                else if(cName.includes('우르사돈[암]')||cName.includes('우르사돈암')) { key='우르사돈[암]'; }
                else if(cName.includes('우르사돈[수]')||cName.includes('우르사돈수')) { key='우르사돈[수]'; }
                else if(cName.includes('자동포탑')) { key='자동포탑'; }
                else if(cName.includes('잠복')) { key='잠복'; }
                else { const uid = getUnitId(cName); key = dashboardAtoms.find(a => clean(a) === uid) || uid; }
                u.parsedCost.push({ type, key, qty, name: u.name });
            });
        }
        u.parsedRecipe = [];
        if(u.recipe && !IGNORE_PARSE_RECIPES.includes(u.recipe)) {
            u.recipe.split(/\+(?![^()]*\))/).forEach(p => {
                const m = p.trim().match(/^([^(\[]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/);
                if(m) u.parsedRecipe.push({ id: getUnitId(m[1]), qty: m[3] ? parseInt(m[3]) : 1 });
            });
        }
    });
}

function calculateTotalCostScore(costStr){
    if(!costStr||IGNORE_PARSE_RECIPES.includes(costStr))return 0;
    let score=0; costStr.split(',').forEach(p=>{const m=p.match(/\[(\d+(?:\.\d+)?)\]/);if(m)score+=parseFloat(m[1]);else score+=1}); return score;
}

let repeatTimer = null, repeatDelayTimer = null;
function startSmartChange(id, delta, type, event) {
    if(event) { event.preventDefault(); event.stopPropagation(); }
    stopSmartChange(); 
    triggerHaptic(); 

    let shiftMulti = (event && event.shiftKey) ? 5 : 1;
    let finalDelta = delta * shiftMulti;

    const action = () => {
        if(type === 'active') { 
            let current = activeUnits.get(id) || 0;
            if(current === 0 && finalDelta > 0) toggleUnitSelection(id, finalDelta);
            else setUnitQty(id, current + finalDelta); 
        } 
        else { 
            setOwnedQty(id, (ownedUnits.get(id) || 0) + finalDelta); 
            if(finalDelta > 0) TutorialEngine.handleEvent('click_plus');
        }
    };
    action();
    repeatDelayTimer = setTimeout(() => { repeatTimer = setInterval(() => { triggerHaptic(); action(); }, 80); }, 400);
}
function stopSmartChange() { clearTimeout(repeatDelayTimer); clearInterval(repeatTimer); repeatDelayTimer = null; repeatTimer = null; }
document.addEventListener('mouseup', stopSmartChange); document.addEventListener('touchend', stopSmartChange); 

function showRecipeTooltip(id, event, isDeduction = false) {
    if(event && event.type !== 'mousemove') event.stopPropagation();
    const u = unitMap.get(id); if(!u) return;
    let multi = 1;
    if(isDeduction) { const reqEl = document.getElementById(`d-req-${id}`); if(reqEl) { let reqVal = parseInt(reqEl.innerText); if(reqVal > 1) multi = reqVal; } }
    const tt = document.getElementById('recipeTooltip');
    tt.innerHTML = `<div class="tooltip-header" style="color:${gradeColorsRaw[u.grade]}">${u.name} 조합법 ${multi > 1 ? `<span style="font-size:0.8rem; color:var(--text-sub);">(${multi}개 기준)</span>` : ''}</div><div class="tooltip-body">${formatRecipeHorizontal(u, multi)}</div><div class="tooltip-footer">화면을 터치하거나 외부 클릭 시 닫힙니다.</div>`;
    tt.classList.add('active');
    
    let x = event.pageX || (event.touches && event.touches[0].pageX) || window.innerWidth/2;
    let y = event.pageY || (event.touches && event.touches[0].pageY) || window.innerHeight/2;
    if(x + 280 > window.innerWidth) x = window.innerWidth - 290;
    tt.style.left = Math.max(10, x + 15) + 'px'; tt.style.top = (y + 15) + 'px';
}
function hideRecipeTooltip() { const tt = document.getElementById('recipeTooltip'); if(tt) tt.classList.remove('active'); }
document.addEventListener('click', hideRecipeTooltip); document.addEventListener('touchstart', hideRecipeTooltip);

/* =============================================================================
   [AI DO NOT EDIT] 🔒 핵심 계산 엔진 - 절대 수정 불가 (헤드락 적용 구간)
   (정수 스코어 및 매직 코스트 합산/차감 결과에 관여하는 핵심 로직)
   ============================================================================= */
function calcEssenceRecursiveFast(uid, counts, visited) {
    if(visited.has(uid)) return; visited.add(uid);
    const u = unitMap.get(uid); if(!u) return;
    if(["히든", "슈퍼히든"].includes(u.grade)) {
        if(["테바","테메"].includes(u.category)) counts.코랄 += 1;
        else if(["토바","토메"].includes(u.category)) counts.아이어 += 1;
        else if(u.category === "저그중립") counts.제루스 += 1;
        else if(u.category === "혼종") { counts.코랄 += 1; counts.아이어 += 1; counts.제루스 += 1; }
    }
    if(u.parsedRecipe) u.parsedRecipe.forEach(pr => { if(pr.id) calcEssenceRecursiveFast(pr.id, counts, visited); });
}

function getUnitEssenceTotal(uid) {
    const u = unitMap.get(uid); if (!u || !["히든", "슈퍼히든"].includes(u.grade)) return 0;
    let counts = {코랄:0, 아이어:0, 제루스:0}, visited = new Set();
    calcEssenceRecursiveFast(uid, counts, visited); return counts.코랄 + counts.아이어 + counts.제루스;
}

function updateEssence(){
    let counts={코랄:0, 아이어:0, 제루스:0}, visited = new Set();
    activeUnits.forEach((qty, key) => { const u = unitMap.get(key); if(u && ["히든", "슈퍼히든"].includes(u.grade)) calcEssenceRecursiveFast(key, counts, visited); });
    const setVal=(id,v)=>{
        const el=document.getElementById(id);
        if(el){
            if(el.innerText !== String(v)) el.innerText=v;
            const parent = el.parentElement;
            const newClass = 'cost-slot'+(parent.id.includes('magic')?' is-magic-slot':'')+(id.includes('total')?' total':'')+(v>0?' active':'');
            if(parent.className !== newClass) parent.className=newClass;
        }
    };
    setVal('val-coral',counts.코랄);setVal('val-aiur',counts.아이어);setVal('val-zerus',counts.제루스);setVal('essence-total-val',counts.코랄+counts.아이어+counts.제루스);
}

function updateMagicDashboard(){
    const totalMap={}; dashboardAtoms.forEach(a=>{if(a==="갓오타/메시브")totalMap[a]={갓오타:0,메시브:0};else totalMap[a]=0;});
    
    Array.from(activeUnits.keys()).forEach(k=>{
        const u=unitMap.get(k); if(!u) return; const c=activeUnits.get(k)||1;
        if(u.parsedCost && u.parsedCost.length > 0) {
            u.parsedCost.forEach(pc => {
                if(pc.type === 'special') totalMap['갓오타/메시브'][pc.key] += pc.qty * c;
                else totalMap[pc.key] = (totalMap[pc.key] || 0) + pc.qty * c;
            });
        }
    });

    const ownedMap={}; dashboardAtoms.forEach(a=>{if(a==="갓오타/메시브")ownedMap[a]={갓오타:0,메시브:0};else ownedMap[a]=0;});
    Array.from(ownedUnits.keys()).forEach(k=>{
        const c=ownedUnits.get(k)||0;
        if(c > 0) {
            if(k === '갓오타') { ownedMap['갓오타/메시브'].갓오타 += c; return; }
            if(k === '메시브') { ownedMap['갓오타/메시브'].메시브 += c; return; }
            const u=unitMap.get(k); if(!u) return;
            if(u.parsedCost && u.parsedCost.length > 0) {
                u.parsedCost.forEach(pc => {
                    if(pc.type === 'special') ownedMap['갓오타/메시브'][pc.key] += pc.qty * c;
                    else ownedMap[pc.key] = (ownedMap[pc.key] || 0) + pc.qty * c;
                });
            }
        }
    });

    // [개선 반영] innerHTML 남용을 줄이고 텍스트(innerText) 타겟팅으로 reflow 병목 최소화
    let totalMagic=0;
    dashboardAtoms.forEach(a=>{
        const val=totalMap[a], owned=ownedMap[a];
        const container=document.getElementById(`vslot-${clean(a)}`);if(!container)return;
        const e=container.querySelector('.cost-val'), nameEl=container.querySelector('.cost-name');

        if(a==="갓오타/메시브"){
            let finalG = Math.max(0, val.갓오타 - owned.갓오타); let finalM = Math.max(0, val.메시브 - owned.메시브);
            if(finalG>0 || finalM>0){
                if(e.innerHTML === EMPTY_SVG || e.innerHTML === '') {
                    e.innerHTML=`<div id="sp-wrap" style="display:flex; width:100%; height:100%;">
                        <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; border-right:1px solid rgba(236,72,153,0.3);">
                            <span id="sp-val-g" style="font-size:1.8rem; font-weight:900; color:var(--grade-rare); line-height:1; margin-bottom:4px; text-shadow:0 0 10px rgba(251,191,36,0.5);"></span>
                            <span style="font-size:0.7rem; color:rgba(255,255,255,0.7); letter-spacing:-0.5px;">갓오타</span>
                        </div>
                        <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                            <span id="sp-val-m" style="font-size:1.8rem; font-weight:900; color:var(--grade-unique); line-height:1; margin-bottom:4px; text-shadow:0 0 10px rgba(239,68,68,0.5);"></span>
                            <span style="font-size:0.7rem; color:rgba(255,255,255,0.7); letter-spacing:-0.5px;">메시브</span>
                        </div>
                    </div>`;
                }
                document.getElementById('sp-val-g').innerText = finalG;
                document.getElementById('sp-val-m').innerText = finalM;
                if(nameEl.style.display !== 'none') nameEl.style.display='none';
                if(!container.classList.contains('active')) container.classList.add('active');
            } else { 
                if(e.innerHTML !== EMPTY_SVG) { e.innerHTML=EMPTY_SVG; nameEl.style.display='block'; container.classList.remove('active'); }
            }
        } else {
            let finalVal = Math.max(0, val - owned);
            if(finalVal>0){ 
                let targetText = String(Math.ceil(finalVal));
                if(e.innerText !== targetText) e.innerText = targetText; 
                if(nameEl.style.display !== 'block') nameEl.style.display='block'; 
                if(!container.classList.contains('active')) container.classList.add('active'); 
                totalMagic+=finalVal; 
            } else { 
                if(e.innerHTML !== EMPTY_SVG) { e.innerHTML=EMPTY_SVG; nameEl.style.display='block'; container.classList.remove('active'); }
            }
        }
    });
    
    const magicTotalEl=document.querySelector('#slot-total-magic .cost-val');
    if(magicTotalEl){
        let targetText = String(Math.ceil(totalMagic));
        if(magicTotalEl.innerText !== targetText) magicTotalEl.innerText = targetText;
        let isActive = totalMagic > 0;
        if(magicTotalEl.parentElement.classList.contains('active') !== isActive) {
            magicTotalEl.parentElement.classList.toggle('active', isActive);
        }
    }
}
/* =============================================================================
   [AI DO NOT EDIT] 🔒 핵심 계산 엔진 종료
   ============================================================================= */

function calculateIntermediateRequirements() {
    const reqMap = new Map(); const reasonMap = new Map();
    function traverse(uid, m, rootId) {
        reqMap.set(uid, (reqMap.get(uid)||0) + m);
        if (rootId && uid !== rootId) {
            if (!reasonMap.has(uid)) reasonMap.set(uid, new Set());
            const rootUnit = unitMap.get(rootId); if (rootUnit) reasonMap.get(uid).add(rootUnit.name);
        }
        const u = unitMap.get(uid);
        if(u && u.parsedRecipe) u.parsedRecipe.forEach(child => { if(child.id) traverse(child.id, m * child.qty, rootId); });
    }
    activeUnits.forEach((qty, uid) => { traverse(uid, qty, uid); });
    return { reqMap, reasonMap };
}

function renderActiveRoster() {
    const roster = document.getElementById('activeRoster');
    if(!roster) return;
    
    let html = '';
    activeUnits.forEach((qty, id) => {
        const u = unitMap.get(id);
        if(u) {
            html += `<div class="roster-tag" onclick="toggleUnitSelection('${id}')" style="border-color:${gradeColorsRaw[u.grade]}66;">
                <span style="color:${gradeColorsRaw[u.grade]}; font-weight:bold;">${u.name}</span>
                <span class="roster-qty">×${qty}</span>
            </div>`;
        }
    });
    
    if(html === '') roster.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">선택된 유닛 대기열 (검색 후 엔터)</span>';
    else roster.innerHTML = html;
}

function updateAllPanels() { 
    updateMagicDashboard(); updateEssence(); updateTabsUI(); updateTabContentUI(); updateDeductionBoard(); renderActiveRoster();
}

function switchLayout(mode) {
    const layout = document.getElementById('mainLayout');
    const btnToggle = document.getElementById('btnToggleMode');
    
    if (!layout || !btnToggle) return;
    _currentViewMode = mode; 
    
    layout.classList.remove('view-deduct');
    if (mode === 'deduct') {
        layout.classList.add('view-deduct');
        btnToggle.classList.remove('active');
        btnToggle.innerHTML = '<span class="toggle-icon">◧</span> 입력 모드 전환';
        TutorialEngine.handleEvent('click_deduct');
    } else {
        btnToggle.classList.add('active');
        btnToggle.innerHTML = '<span class="toggle-icon">◨</span> 차감 모드 전환';
    }
}

function toggleViewMode() {
    if (_currentViewMode === 'deduct') {
        switchLayout('codex');
    } else {
        switchLayout('deduct');
    }
}

function toggleUnitSelection(id, forceQty){
    if(activeUnits.has(id)){
        activeUnits.delete(id); essenceUnits.delete(id);
    } else {
        const u = unitMap.get(id); const initQty = (u && u.grade === "슈퍼히든") ? 1 : (forceQty || 1);
        activeUnits.set(id, initQty); essenceUnits.add(id);
    }
    updateAllPanels();
    TutorialEngine.handleEvent('click_unit');
}

function setUnitQty(id, val) {
    let q = parseInt(val);
    if (q === 0 || isNaN(q) || q < 1) {
        if (activeUnits.has(id)) { activeUnits.delete(id); essenceUnits.delete(id); }
        updateAllPanels();
        return;
    }
    const u = unitMap.get(id); if (!u || u.grade === "슈퍼히든") return;
    if (q > 16) q = 16;
    activeUnits.set(id, q); updateAllPanels();
    TutorialEngine.handleEvent('click_unit');
}

function handleWheel(e, id) {
    if (!activeUnits.has(id)) return;
    const u = unitMap.get(id); if (!u || u.grade === "슈퍼히든") return;
    e.preventDefault(); 
    let qty = activeUnits.get(id) || 1;
    let shiftMulti = e.shiftKey ? 5 : 1;
    let delta = e.deltaY < 0 ? shiftMulti : -shiftMulti; 
    qty += delta;
    
    if (qty > 16) qty = 16; 
    if (qty < 1) { activeUnits.delete(id); essenceUnits.delete(id); updateAllPanels(); return; }
    if (activeUnits.get(id) !== qty) { activeUnits.set(id, qty); updateAllPanels(); TutorialEngine.handleEvent('click_unit'); }
}

function setOwnedQty(id, val) {
    let q = parseInt(val); if (isNaN(q) || q < 0) q = 0;
    const inEl = document.getElementById(`d-in-${id}`);
    let maxQty = 99;
    if(inEl && inEl.hasAttribute('data-req')) { const reqVal = parseInt(inEl.getAttribute('data-req')); if(reqVal > 0) maxQty = reqVal; }
    if (q > maxQty) q = maxQty;
    ownedUnits.set(id, q); updateAllPanels();
}

function handleOwnedWheel(e, id) {
    e.preventDefault();
    const inEl = document.getElementById(`d-in-${id}`); let maxQty = 99;
    if(inEl && inEl.hasAttribute('data-req')) { const reqVal = parseInt(inEl.getAttribute('data-req')); if(reqVal > 0) maxQty = reqVal; }
    let qty = ownedUnits.get(id) || 0;
    let shiftMulti = e.shiftKey ? 5 : 1;
    let delta = e.deltaY < 0 ? shiftMulti : -shiftMulti;
    qty += delta;

    if (qty < 0) qty = 0; if (qty > maxQty) qty = maxQty;
    if (ownedUnits.get(id) !== qty) { ownedUnits.set(id, qty); updateAllPanels(); }
}

function renderDeductionBoard() {
    if (!DOM.deductionBoard) return;
    const renderSlot = (id, name, grade) => {
        const color = gradeColorsRaw[grade] || "var(--text)";
        return `<div class="deduct-slot" id="d-slot-wrap-${id}" style="display:none;">
            <div class="d-reason-wrap" id="d-reason-${id}" style="display:none;"></div>
            <div class="d-name" style="color: ${color}; cursor:help;" onclick="showRecipeTooltip('${id}', event, true)">
                <span class="gtag" style="border-color:${color}44; color:${color}; margin-right:6px;">${grade}</span>${name}
            </div>
            <div class="d-inputs">
                <div class="smart-stepper owned-stepper" onwheel="handleOwnedWheel(event, '${id}')">
                    <button onmousedown="startSmartChange('${id}', -1, 'owned', event)" ontouchstart="startSmartChange('${id}', -1, 'owned', event)">-</button>
                    <div class="ss-val" id="d-in-${id}" data-req="0">${ownedUnits.get(id)||0}</div>
                    <button onmousedown="startSmartChange('${id}', 1, 'owned', event)" ontouchstart="startSmartChange('${id}', 1, 'owned', event)">+</button>
                </div>
                <span class="d-sep">/</span>
                <span class="d-req" id="d-req-${id}">0</span>
            </div>
        </div>`;
    };

    let h = '';
    h += `<div id="deduct-empty-msg" style="text-align:center; padding:30px; color:var(--text-sub); font-weight:bold; width:100%; display:none;">목표 유닛을 선택하거나, 차감 맵핑에 보유 유닛을 입력하세요.</div>`;
    h += `<div class="deduct-group"><div class="deduct-group-title"><span style="color:var(--grade-unique);">★</span> 특수 및 기초 자원 맵핑</div><div class="deduct-grid">
            ${renderSlot('갓오타', '갓오타', '레어')} ${renderSlot('메시브', '메시브', '유니크')} ${renderSlot('자동포탑', '자동포탑', '매직')} ${renderSlot('땅거미지뢰', '땅거미지뢰', '히든')}
          </div></div>`;

    const topGrades = ["레전드", "헬", "유니크", "에픽", "레어"];
    let topItems = Array.from(unitMap.values()).filter(u => topGrades.includes(u.grade));
    topItems.sort((a, b) => GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade));
    
    h += `<div class="deduct-group"><div class="deduct-group-title"><span style="color:var(--grade-legend);">▲</span> 상위 등급 맵핑 (레전드 ~ 레어)</div><div class="deduct-grid">
            ${topItems.map(u => renderSlot(u.id, u.name, u.grade)).join('')}
          </div></div>`;

    let hiddenItems = Array.from(unitMap.values()).filter(u => u.grade === "히든");
    h += `<div class="deduct-group" style="margin-bottom:0;"><div class="deduct-group-title"><span style="color:var(--grade-hidden);">♦</span> 히든 등급 맵핑</div><div class="deduct-grid">
            ${hiddenItems.map(u => renderSlot(u.id, u.name, u.grade)).join('')}
          </div></div>`;
    DOM.deductionBoard.innerHTML = h;
}

function updateDeductionBoard() {
    if (!DOM.deductionBoard) return;
    const { reqMap, reasonMap } = calculateIntermediateRequirements();
    
    const totalMap={}; dashboardAtoms.forEach(a=>{if(a==="갓오타/메시브")totalMap[a]={갓오타:0,메시브:0};else totalMap[a]=0;});
    let specialReq = { 갓오타: 0, 메시브: 0 }, specialReason = { 갓오타: new Set(), 메시브: new Set() };
    
    Array.from(activeUnits.keys()).forEach(k=>{
        const u = unitMap.get(k); const qty = activeUnits.get(k) || 1;
        if(u && u.parsedCost) {
            u.parsedCost.forEach(pc => {
                if(pc.type === 'special') {
                    if(pc.key === '메시브') { specialReq.메시브 += pc.qty * qty; specialReason.메시브.add(u.name); }
                    if(pc.key === '갓오타') { specialReq.갓오타 += pc.qty * qty; specialReason.갓오타.add(u.name); }
                    totalMap['갓오타/메시브'][pc.key] += pc.qty * qty;
                } else {
                    totalMap[pc.key] = (totalMap[pc.key] || 0) + pc.qty * qty;
                }
            });
        }
    });

    const updateSlot = (id, targetVal, reasons) => {
        const reqEl = document.getElementById(`d-req-${id}`), wrapEl = document.getElementById(`d-slot-wrap-${id}`), inEl = document.getElementById(`d-in-${id}`), reasonContainer = document.getElementById(`d-reason-${id}`);
        if(reqEl && wrapEl && inEl) {
            reqEl.innerText = targetVal; inEl.setAttribute('data-req', targetVal);
            let ownedVal = parseInt(inEl.innerText) || 0;
            if (targetVal > 0 && ownedVal > targetVal) { ownedVal = targetVal; ownedUnits.set(id, ownedVal); inEl.innerText = ownedVal; } 
            else { inEl.innerText = ownedUnits.get(id) || 0; ownedVal = parseInt(inEl.innerText) || 0; }
            
            if (targetVal > 0 || ownedVal > 0) { wrapEl.style.display = 'flex'; wrapEl.classList.add('is-visible'); } 
            else { wrapEl.style.display = 'none'; wrapEl.classList.remove('is-visible'); }

            if (reasonContainer) {
                if (reasons && reasons.size > 0 && targetVal > 0) { let rHtml = Array.from(reasons).map(r => `<span class="d-reason-tag">${r} 재료</span>`).join(''); reasonContainer.innerHTML = rHtml; reasonContainer.style.display = 'flex'; } 
                else { reasonContainer.style.display = 'none'; reasonContainer.innerHTML = ''; }
            }

            if(targetVal > 0) {
                wrapEl.classList.add('has-target'); wrapEl.style.order = "-1"; 
                if(ownedVal >= targetVal) wrapEl.classList.add('satisfied'); else wrapEl.classList.remove('satisfied');
            } else {
                wrapEl.classList.remove('has-target', 'satisfied'); wrapEl.style.order = "0"; 
                if(ownedVal > 0) wrapEl.classList.add('has-owned'); else wrapEl.classList.remove('has-owned');
            }
        }
    };

    updateSlot('갓오타', specialReq.갓오타, specialReason.갓오타); updateSlot('메시브', specialReq.메시브, specialReason.메시브);
    updateSlot('자동포탑', Math.max(reqMap.get('자동포탑') || 0, Math.ceil(totalMap['자동포탑'] || 0)), reasonMap.get('자동포탑'));
    updateSlot('땅거미지뢰', Math.max(reqMap.get('땅거미지뢰') || 0, Math.ceil(totalMap['땅거미지뢰'] || 0)), reasonMap.get('땅거미지뢰'));

    const targetGrades = ["레어", "에픽", "유니크", "헬", "레전드", "히든"];
    unitMap.forEach(u => { if(targetGrades.includes(u.grade) && u.id !== '자동포탑' && u.id !== '땅거미지뢰') updateSlot(u.id, reqMap.get(u.id) || 0, reasonMap.get(u.id)); });

    let hasAnyVisible = false;
    document.querySelectorAll('.deduct-group').forEach(group => { const visibleSlots = group.querySelectorAll('.deduct-slot.is-visible'); if (visibleSlots.length === 0) group.style.display = 'none'; else { group.style.display = 'block'; hasAnyVisible = true; } });
    const emptyMsg = document.getElementById('deduct-empty-msg'); if (emptyMsg) { if (!hasAnyVisible) emptyMsg.style.display = 'block'; else emptyMsg.style.display = 'none'; }
}

function renderTabs(){
    if (!DOM.codexTabs) return;
    let h='';
    TAB_CATEGORIES.forEach((cat,idx)=>{
        h+=`<button id="tab-btn-${idx}" class="tab-btn" onclick="selectTab(${idx})">
                <span class="tab-sym" style="font-size:1.1rem; padding:2px 5px; border-radius:3px; background:rgba(0,0,0,0.3); border:1px solid var(--border-light); color:var(--text-sub);">${cat.sym}</span>
                <span>${cat.name}</span>
            </button>`;
    });
    DOM.codexTabs.innerHTML=h;
    updateTabsUI();
}

function updateTabsUI() {
    TAB_CATEGORIES.forEach((cat, idx) => {
        let hasSelected = false; 
        activeUnits.forEach((qty, id) => { const u = unitMap.get(id); if(u && u.category === cat.key) hasSelected = true; });
        const btn = document.getElementById(`tab-btn-${idx}`);
        if(!btn) return;
        
        if(idx === _activeTabIdx) btn.classList.add('active'); else btn.classList.remove('active');
        if(hasSelected) btn.classList.add('has-active'); else btn.classList.remove('has-active');
        
        const sym = btn.querySelector('.tab-sym');
        if(sym) {
            if(hasSelected) {
                sym.style.color = 'var(--g)'; sym.style.borderColor = 'var(--g-border)'; sym.style.boxShadow = '0 0 5px var(--g-faint)'; sym.style.textShadow = '0 0 5px var(--g-glow)';
            } else {
                sym.style.color = 'var(--text-sub)'; sym.style.borderColor = 'var(--border-light)'; sym.style.boxShadow = 'none'; sym.style.textShadow = 'none';
            }
        }
    });
}

function formatRecipeHorizontal(item, multiplier = 1) {
    if (!item.recipe || IGNORE_PARSE_RECIPES.includes(item.recipe)) return `<div style="color:var(--text-muted);font-size:0.85rem;">정보 없음</div>`;
    let html = '<div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">';
    item.recipe.split(/\+(?![^()]*\))/).forEach((part, index, arr) => {
        const match = part.trim().match(/^([^(\[]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/);
        if (match) {
            const rawKo = match[1].trim(), u = unitMap.get(getUnitId(rawKo));
            let condTxt = match[2] ? `(${match[2]})` : '';
            let baseQty = match[3] ? parseInt(match[3]) : 1; let finalQty = baseQty * multiplier; let qtyTxt = `[${finalQty}]`;
            const color = u && gradeColorsRaw[u.grade] ? gradeColorsRaw[u.grade] : "var(--text)";
            html += `<div class="recipe-badge" style="color:${color}; border-color:${color}44;">${rawKo} <span class="badge-cond">${condTxt}${qtyTxt}</span></div>`;
        } else { html += `<div style="color:var(--text-sub); font-size:0.85rem; white-space:nowrap;">${part}</div>`; }
        if (index < arr.length - 1) { html += `<div style="color:var(--text-muted); font-size:0.9rem; font-weight:bold;">+</div>`; }
    });
    return html + '</div>';
}

function selectTab(idx){ _activeTabIdx=idx; updateTabsUI(); renderCurrentTabContent(); }

function renderCurrentTabContent() {
    const catKey = TAB_CATEGORIES[_activeTabIdx].key;
    let items = Array.from(unitMap.values()).filter(u => ["슈퍼히든","히든","레전드"].includes(u.grade) && u.category === catKey);
    items.sort((a,b) => { if(a.grade !== b.grade) return GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade); return calculateTotalCostScore(b.cost) - calculateTotalCostScore(a.cost); });

    let h='<div style="display:flex;flex-direction:column;gap:4px;">';
    if (items.length === 0) h += `<div style="text-align:center; padding:30px; color:var(--text-sub); font-weight:bold; font-size:1.05rem;">해당 분류에 유닛이 없습니다.</div>`;

    items.forEach((item, index) => {
        const unitEssence = getUnitEssenceTotal(item.id);
        
        let gradeHtml = '';
        if (unitEssence > 0) gradeHtml = `<span class="gtag sh-integrated" style="border-color:${gradeColorsRaw[item.grade]}44; color:${gradeColorsRaw[item.grade]};">${item.grade} <span class="badge-sep">/</span> <span style="color:var(--grade-super); text-shadow:0 0 8px rgba(255,215,0,0.6);">정수 ${unitEssence}</span></span>`;
        else gradeHtml = `<span class="gtag" style="border-color:${gradeColorsRaw[item.grade]}44; color:${gradeColorsRaw[item.grade]};">${item.grade}</span>`;

        let rightControls = '';
        if (item.grade !== "슈퍼히든") {
            rightControls = `<div class="uc-ctrl" onclick="event.stopPropagation()">
                <div class="smart-stepper active-stepper" onwheel="handleWheel(event, '${item.id}')">
                    <button id="btn-minus-${item.id}" onmousedown="startSmartChange('${item.id}', -1, 'active', event)" ontouchstart="startSmartChange('${item.id}', -1, 'active', event)">-</button>
                    <div class="ss-val" id="val-${item.id}">-</div>
                    <button id="btn-plus-${item.id}" onmousedown="startSmartChange('${item.id}', 1, 'active', event)" ontouchstart="startSmartChange('${item.id}', 1, 'active', event)">+</button>
                </div>
            </div>`;
        }

        h+=`<div id="card-${item.id}" class="unit-card" style="animation-delay:${index * 0.03}s" onclick="toggleUnitSelection('${item.id}', 1)">
            <div class="uc-wrap">
                <div class="uc-info-stack">
                    <div class="uc-grade">${gradeHtml}</div>
                    <div class="uc-name-row" style="color:${gradeColorsRaw[item.grade]};">${item.name}</div>
                    <div class="uc-recipe-row">${formatRecipeHorizontal(item)}</div>
                </div>
                ${rightControls}
            </div>
        </div>`;
    });
    h+='</div>'; DOM.tabContent.innerHTML=h;
    
    updateTabContentUI();
}

function updateTabContentUI() {
    const catKey = TAB_CATEGORIES[_activeTabIdx].key;
    unitMap.forEach(item => {
        if(item.category !== catKey) return;
        const card = document.getElementById(`card-${item.id}`);
        if(!card) return;
        
        const isActive = activeUnits.has(item.id);
        const qty = activeUnits.get(item.id) || 0;
        
        if(isActive) card.classList.add('active'); else card.classList.remove('active');
        
        if(item.grade !== "슈퍼히든") {
            const valEl = document.getElementById(`val-${item.id}`);
            if(valEl) valEl.innerText = isActive ? qty : '-';
            
            const btnMinus = document.getElementById(`btn-minus-${item.id}`);
            const btnPlus = document.getElementById(`btn-plus-${item.id}`);
            if(btnMinus) btnMinus.disabled = !isActive;
            if(btnPlus) btnPlus.disabled = !isActive;
        }
    });
}

function renderDashboardAtoms(){
    // [개선 반영] 비어있는 SVG 삽입부를 정적으로 변경
    DOM.magicDashboard.innerHTML=`<div class="cost-slot total" id="slot-total-magic"><div class="cost-val"></div><div class="cost-name">총 매직 코스트</div></div><div class="cost-slot total" id="slot-total-essence"><div class="cost-val" id="essence-total-val"></div><div class="cost-name">총 정수 코스트</div></div><div class="cost-slot"><div class="cost-val" id="val-coral" style="color:#FF6B6B;"></div><div class="cost-name">코랄</div></div><div class="cost-slot"><div class="cost-val" id="val-aiur" style="color:var(--grade-rare);"></div><div class="cost-name">아이어</div></div><div class="cost-slot"><div class="cost-val" id="val-zerus" style="color:var(--grade-legend);"></div><div class="cost-name">제루스</div></div>`;
    dashboardAtoms.forEach(a=>{
        const isSkill = (a === "갓오타/메시브"), isMagic = !isSkill;
        const d=document.createElement('div');
        d.className='cost-slot'+(isMagic?' is-magic-slot':'')+(isSkill?' is-skill-slot':''); d.id=`vslot-${clean(a)}`;
        d.innerHTML=`<div class="cost-val"></div><div class="cost-name" id="name-${clean(a)}">${a}</div>`;
        DOM.magicDashboard.appendChild(d);
    });
}

function renderJewelGrid(){
    const g=document.getElementById('jewelGrid'); 
    if(!g) return;
    
    const url="https://sldbox.github.io/site/image/jw/";
    let h='';

    JEWEL_DATABASE.forEach((koArr, idx) => {
        const kr=koArr[0], krLeg=koArr[1], krMyth=koArr[2], imgName=koArr[3]||kr;
        const c = typeof JEWEL_COLORS !== 'undefined' && JEWEL_COLORS[kr] ? JEWEL_COLORS[kr] : "#ffffff";
        const cA = c + '28';
        const cB = c + '44';
        const cShadow = c + '55';
        const hasMythic = krMyth && krMyth.trim() !== "";
        const mythHtml = hasMythic
            ? `<div class="jw-stat mythic"><div class="jw-stat-lbl">신화 능력 <span class="mythic-sparkle">✦</span></div><div class="jw-stat-val">${krMyth}</div></div>`
            : '';
        const delay = (idx * 0.04).toFixed(2);

        h += `<div class="jewel-item" style="--jw-color:${c};--jw-color-a:${cA};--jw-color-b:${cB};--jw-shadow:${cShadow};--jw-glow:radial-gradient(ellipse 80% 60% at 50% 0%,${cA} 0%,transparent 70%);animation:jwFadeIn 0.45s ${delay}s both ease-out;">
            <div class="jewel-banner">
                <div class="jewel-banner-bg"></div>
                <div class="jewel-hex"></div>
                <div class="jewel-hex-inner"></div>
                <div class="jewel-img-wrap">
                    <img src="${url}${imgName}.png" alt="${kr}" onerror="this.style.opacity='0'">
                </div>
                <div class="jewel-name-txt">${kr}</div>
                <div class="jewel-banner-line"></div>
            </div>
            <div class="jewel-body">
                <div class="jw-stat legend"><div class="jw-stat-lbl">전설 능력</div><div class="jw-stat-val">${krLeg}</div></div>
                ${mythHtml}
            </div>
        </div>`;
    });
    g.innerHTML = h;
}

// =========================================================
// 유닛 도감 엔진
// =========================================================
let _ucActiveTab = '전체';
let _ucSearchQuery = '';
const UC_IMG_BASE = 'https://sldbox.github.io/site/image/ctg/';

function renderUnitCodexGrid() {
    const grid = document.getElementById('unitCodexGrid');
    const tabsWrap = document.getElementById('unitCodexTabsWrap');
    if (!grid) return;

    // 탭 초기 렌더
    if (tabsWrap && tabsWrap.innerHTML === '') {
        const allTabs = ['전체', ...TAB_CATEGORIES.map(c => c.key)];
        tabsWrap.innerHTML = allTabs.map(t => 
            `<button class="uc-codex-tab-btn${t === _ucActiveTab ? ' active' : ''}" onclick="selectUnitCodexTab('${t}')">${t}</button>`
        ).join('');
    }

    _renderUnitCodexCards();
}

function selectUnitCodexTab(tabKey) {
    _ucActiveTab = tabKey;
    // 탭 버튼 active 갱신
    document.querySelectorAll('.uc-codex-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === tabKey);
    });
    _renderUnitCodexCards();
}

function filterUnitCodex(query) {
    _ucSearchQuery = query;
    _renderUnitCodexCards();
}

function _renderUnitCodexCards() {
    const grid = document.getElementById('unitCodexGrid');
    if (!grid) return;

    // 슈퍼히든 · 히든 · 레전드만 표시
    const SHOW_GRADES = ["슈퍼히든", "히든", "레전드"];

    let items = Array.from(unitMap.values()).filter(u => SHOW_GRADES.includes(u.grade));
    if (_ucActiveTab !== '전체') items = items.filter(u => u.category === _ucActiveTab);
    if (_ucSearchQuery.trim()) {
        const q = _ucSearchQuery.trim().toLowerCase();
        items = items.filter(u => u.name.includes(q) || clean(u.name).includes(q));
    }

    items.sort((a, b) => GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade));

    if (items.length === 0) {
        grid.innerHTML = `<div class="uc-codex-empty">조건에 맞는 유닛이 없습니다.</div>`;
        return;
    }

    let h = '';
    items.forEach((item, idx) => {
        const color = gradeColorsRaw[item.grade] || 'var(--text)';
        const colorBg = color + '12';
        const imgUrl = `${UC_IMG_BASE}${encodeURIComponent(item.name)}.png`;
        // IGNORE_PARSE_RECIPES 공통 상수 사용
        const recipeText = (item.recipe && !IGNORE_PARSE_RECIPES.includes(item.recipe))
            ? item.recipe : '조합 정보 없음';
        const delay = (idx * 0.025).toFixed(2);

        h += `<div class="uc-codex-card" id="uccard-${item.id}"
                style="--uc-color:${color};--uc-bg:${colorBg};animation-delay:${delay}s;display:none;">
            <div class="uc-codex-img-wrap">
                <img src="${imgUrl}" alt="${item.name}"
                    onload="this.closest('.uc-codex-card').style.display='flex';"
                    onerror="this.closest('.uc-codex-card').style.display='none';">
                <div class="uc-codex-grade-bar"></div>
            </div>
            <div class="uc-codex-info">
                <span class="uc-codex-grade-badge" style="color:${color};border-color:${color}55;">${item.grade}</span>
                <div class="uc-codex-name">${item.name}</div>
                <div class="uc-codex-cat">${item.category}</div>
                <div class="uc-codex-recipe">
                    <div class="uc-codex-recipe-lbl">조합 조건</div>
                    <div class="uc-codex-recipe-val">${recipeText}</div>
                </div>
            </div>
        </div>`;
    });

    grid.innerHTML = h;
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        document.documentElement.lang = 'ko'; document.documentElement.setAttribute('data-theme', 'dark');
        DOM.tabContent = document.getElementById('tabContent'); DOM.deductionBoard = document.getElementById('deductionBoard');
        DOM.codexTabs = document.getElementById('codexTabs'); DOM.magicDashboard = document.getElementById('magicDashboard');
        if (typeof UNIT_DATABASE === 'undefined') { console.error("[오류]"); return; }
        
        UNIT_DATABASE.forEach((kArr) => { const g = kArr[1] || "매직", cat = kArr[2] || "테바"; unitMap.set(clean(kArr[0]), { id:clean(kArr[0]), name:kArr[0], grade:g, category:cat, recipe:kArr[3], cost:kArr[4] }); });
        
        initializeCacheEngine();
        
        renderDashboardAtoms(); 
        renderDeductionBoard(); 
        renderTabs();
        selectTab(0); 
        updateAllPanels();
        renderJewelGrid();
        
        setupSearchEngine();
        checkInitialMode();

        let touchStartX = 0; let touchEndX = 0;
        const swipeArea = document.getElementById('tabContent');
        if(swipeArea) {
            swipeArea.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
            swipeArea.addEventListener('touchend', e => { 
                touchEndX = e.changedTouches[0].screenX; 
                const diff = touchEndX - touchStartX;
                if (Math.abs(diff) > 70) { 
                    if (diff > 0 && _activeTabIdx > 0) selectTab(_activeTabIdx - 1); 
                    else if (diff < 0 && _activeTabIdx < TAB_CATEGORIES.length - 1) selectTab(_activeTabIdx + 1); 
                }
            }, {passive: true});
        }

    } catch (err) { console.error("[오류] 넥서스 초기화 중 에러 발생:", err); }
});

document.addEventListener('dragstart',e=>e.preventDefault());
document.addEventListener('selectstart',e=>{if(!e.target.closest('.smart-stepper') && !e.target.closest('input')) e.preventDefault()});