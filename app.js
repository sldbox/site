/*
=============================================================================
[파일 설명서] app.js 
=============================================================================
*/

let _activeTabIdx = 0;
let _currentAppMode = 'classic'; // 'expert', 'classic', or 'jewel'
let _currentViewMode = 'codex';
let _previousViewMode = 'codex';

const unitMap = new Map(), activeUnits = new Map(), ownedUnits = new Map(), essenceUnits = new Set(), DOM = {};
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
function resetCodex() { activeUnits.clear(); essenceUnits.clear(); updateAllPanels(); showToast("선택된 유닛이 초기화되었습니다."); }
function resetOwned() { ownedUnits.clear(); updateAllPanels(); showToast("보유 유닛이 초기화되었습니다."); }

// =========================================================
// 인터랙티브 가이드 엔진 (Tutorial)
// =========================================================
const TutorialEngine = {
    isActive: false, stepIndex: 0,
    steps: [
        {
            setup: () => { resetCodex(); initMode('expert', false); },
            target: () => document.querySelector('#expertSearchContainer .search-wrap'),
            text: "<strong style='color:var(--g); font-size:1.2rem; display:block; margin-bottom:8px;'>STEP 1. 초고속 커맨드 입력</strong>명령어 텍스트로 유닛을 한 번에 등록하는 <strong style='color:var(--g)'>[검색 모드]</strong>입니다.<br><br>가운데 검색창에 <strong style='color:#000; background:var(--g); padding:2px 6px; border-radius:4px;'>전쟁광*2</strong> 를 입력하고 키보드의 <strong>[Enter ↵]</strong> 를 쳐보세요!",
            position: 'bottom', requireAction: 'enter',
            onRender: () => { const input = document.getElementById('unitSearchInput'); if(input) { input.value=''; input.focus(); } }
        },
        {
            setup: () => {},
            target: () => document.getElementById('magicDashboard'),
            text: "<strong style='color:var(--grade-epic); font-size:1.2rem; display:block; margin-bottom:8px;'>STEP 2. 코스트 실시간 합산</strong>입력하신 유닛(전쟁광 2개)을 만들기 위해 필요한 <strong>모든 하위 재료 코스트</strong>가 이곳에 실시간 자동 합산됩니다!<br><br>복잡한 계산 없이 한눈에 필요 재료 파악이 가능합니다.",
            position: 'top', requireAction: 'next'
        },
        {
            setup: () => { initMode('classic', false); },
            target: () => document.querySelector('.panel-codex'),
            text: "<strong style='color:var(--grade-rare); font-size:1.2rem; display:block; margin-bottom:8px;'>STEP 3. 직관적인 도감 등록</strong>왼쪽 패널이 활성화되는 이곳은 <strong style='color:var(--grade-rare)'>[도감 모드]</strong>입니다.<br><br>종족 탭에서 원하시는 아무 <strong>유닛 카드나 1번 클릭</strong>하여 직접 추가해 보세요!",
            position: 'right', requireAction: 'click_unit'
        },
        {
            setup: () => {},
            target: () => document.getElementById('btnViewDeduct'),
            text: "<strong style='color:var(--g); font-size:1.2rem; display:block; margin-bottom:8px;'>STEP 4. 차감 모드 전환</strong>현재 내가 게임 내에서 <strong>이미 보유하고 있는 재료</strong>를 빼고 계산하고 싶다면?<br><br>우측 상단의 <strong>[차감 모드]</strong> 버튼을 클릭해 보세요!",
            position: 'bottom', requireAction: 'click_deduct'
        },
        {
            setup: () => {},
            target: () => document.getElementById('deductionBoard'),
            text: "<strong style='color:var(--grade-unique); font-size:1.2rem; display:block; margin-bottom:8px;'>STEP 5. 남은 코스트 자동 계산</strong>이곳은 <strong style='color:var(--grade-unique)'>[차감 데시보드]</strong>입니다.<br><br>각 재료 우측에 <span style='color:var(--text-muted); font-weight:bold; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px;'>+ / -</span> 버튼을 눌러 보유 수량을 입력해 보세요. <strong>자동 차감(마이너스)</strong>되어 뽑아야 할 코스트만 남습니다.<br><br>🎉 <strong>모든 튜토리얼 완료!</strong>",
            position: 'left', requireAction: 'finish'
        }
    ],

    start: function() {
        this.isActive = true; this.stepIndex = 0; document.getElementById('tutOverlay').style.display = 'block'; document.getElementById('modeSelector').classList.remove('active'); document.body.style.overflow = 'hidden'; this.renderStep();
    },
    next: function() { if(!this.isActive) return; this.stepIndex++; if(this.stepIndex >= this.steps.length) { this.end(); } else { this.renderStep(); } },
    end: function() { this.isActive = false; document.getElementById('tutOverlay').style.display = 'none'; document.body.style.overflow = ''; resetCodex(); openModeSelector(); },
    renderStep: function() {
        const step = this.steps[this.stepIndex]; if(step.setup) step.setup();
        setTimeout(() => {
            const targetEl = step.target(); if(!targetEl) { this.next(); return; }
            const hl = document.getElementById('tutHighlight'); const tt = document.getElementById('tutTooltip'); const rect = targetEl.getBoundingClientRect();
            const p = window.innerWidth < 720 ? 4 : 10;
            hl.style.top = (rect.top - p) + 'px'; hl.style.left = (rect.left - p) + 'px'; hl.style.width = (rect.width + p*2) + 'px'; hl.style.height = (rect.height + p*2) + 'px';
            document.getElementById('tutText').innerHTML = step.text; const btnNext = document.getElementById('tutBtnNext');
            
            if(step.requireAction === 'next') { btnNext.style.display = 'block'; btnNext.innerText = '다음 단계 ➔'; btnNext.onclick = () => this.next(); } 
            else if(step.requireAction === 'finish') { btnNext.style.display = 'block'; btnNext.innerText = '가이드 종료 ✔'; btnNext.onclick = () => this.end(); } 
            else { btnNext.style.display = 'none'; }

            let pos = step.position; if (window.innerWidth < 900 && (pos === 'left' || pos === 'right')) { pos = 'bottom'; }
            tt.className = 'tut-tooltip ' + pos; tt.style.top = 'auto'; tt.style.bottom = 'auto'; tt.style.left = 'auto'; tt.style.right = 'auto';

            if(pos === 'bottom') { tt.style.top = (rect.bottom + p + 20) + 'px'; tt.style.left = Math.max(10, rect.left + rect.width/2 - 170) + 'px'; } 
            else if(pos === 'top') { tt.style.bottom = (window.innerHeight - rect.top + p + 20) + 'px'; tt.style.left = Math.max(10, rect.left + rect.width/2 - 170) + 'px'; } 
            else if(pos === 'right') { tt.style.left = (rect.right + p + 20) + 'px'; tt.style.top = Math.max(10, rect.top + rect.height/2 - 100) + 'px'; } 
            else if(pos === 'left') { tt.style.right = (window.innerWidth - rect.left + p + 20) + 'px'; tt.style.top = Math.max(10, rect.top + rect.height/2 - 100) + 'px'; }

            setTimeout(() => { const tBox = tt.getBoundingClientRect(); if(tBox.right > window.innerWidth) tt.style.left = (window.innerWidth - tBox.width - 20) + 'px'; if(tBox.bottom > window.innerHeight) tt.style.top = (window.innerHeight - tBox.height - 20) + 'px'; if(tBox.left < 0) tt.style.left = '20px'; if(tBox.top < 0) tt.style.top = '20px'; }, 10);
            if(step.onRender) step.onRender();
        }, 350); 
    },
    handleEvent: function(actionType) { if(!this.isActive) return; const step = this.steps[this.stepIndex]; if(step.requireAction === actionType) { setTimeout(() => this.next(), 600); } }
};
window.addEventListener('resize', () => { if(TutorialEngine.isActive) TutorialEngine.renderStep(); });


// =========================================================
// 초기 진입 및 모드 컨트롤
// =========================================================
function checkInitialMode() {
    // 이전에는 localStorage 값을 가져와서 모드를 자동 전환했지만,
    // 이제는 접속 시 무조건 모드 선택 창을 활성화합니다.
    document.getElementById('modeSelector').classList.add('active');
}

function openModeSelector() { document.getElementById('modeSelector').classList.add('active'); }

function initMode(mode, showToastMsg = true) {
    _currentAppMode = mode; 
    document.getElementById('modeSelector').classList.remove('active');
    const layout = document.getElementById('mainLayout'), searchWrap = document.getElementById('searchWrap');
    
    layout.classList.remove('mode-expert', 'view-jewel');
    if(mode === 'expert') { layout.classList.add('mode-expert'); document.getElementById('expertSearchContainer').appendChild(searchWrap); if(showToastMsg) showToast("검색 모드가 활성화되었습니다."); } 
    else if(mode === 'classic') { document.getElementById('classicSearchContainer').appendChild(searchWrap); if(showToastMsg) showToast("도감 모드가 활성화되었습니다."); } 
    else if(mode === 'jewel') { layout.classList.add('view-jewel'); if(showToastMsg) showToast("쥬얼 도감 모드가 활성화되었습니다."); }
    if(mode !== 'jewel' && _currentViewMode === 'deduct') switchLayout('codex');
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
// PC 전용 키보드 단축키 (Hotkeys) & 우클릭 메뉴 & 3D 틸트
// =========================================================
window.addEventListener('keydown', e => {
    if ((e.key === '/' || (e.ctrlKey && e.key.toLowerCase() === 'f')) && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        const searchEl = document.getElementById('unitSearchInput');
        if (searchEl && searchEl.offsetParent !== null) searchEl.focus();
    }
    if (e.key === 'Escape') {
        hideRecipeTooltip();
        closeContextMenu();
        const searchEl = document.getElementById('unitSearchInput');
        if (document.activeElement === searchEl) {
            searchEl.value = '';
            document.getElementById('searchResults').classList.remove('active');
            searchEl.blur();
        }
    }
    if (!e.ctrlKey && !e.altKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') {
        const num = parseInt(e.key);
        if (num >= 1 && num <= TAB_CATEGORIES.length) selectTab(num - 1);
    }
});

document.addEventListener('contextmenu', e => {
    const card = e.target.closest('.unit-card');
    if (card) {
        e.preventDefault();
        const unitId = card.id.replace('card-', '');
        showContextMenu(e, unitId);
        return;
    }
    if (!e.target.closest('.smart-stepper') && !e.target.closest('input')) e.preventDefault();
});

function showContextMenu(e, unitId) {
    const cm = document.getElementById('customContextMenu');
    const u = unitMap.get(unitId);
    if(!u || u.grade === "슈퍼히든") return; 
    
    cm.innerHTML = `
        <div class="cm-header">${u.name} 빠른 조작</div>
        <div class="cm-item" onclick="setUnitQty('${unitId}', 16); closeContextMenu();">
            <span style="color:var(--g); font-weight:900;">MAX</span> (16개) 채우기
        </div>
        <div class="cm-item" onclick="setUnitQty('${unitId}', 0); closeContextMenu();">
            <span style="color:var(--grade-unique); font-weight:900;">0</span> 으로 초기화
        </div>
    `;
    
    cm.style.display = 'block';
    const x = Math.min(e.pageX, window.innerWidth - 180);
    const y = Math.min(e.pageY, window.innerHeight - cm.offsetHeight - 20);
    cm.style.left = x + 'px';
    cm.style.top = y + 'px';
}

function closeContextMenu() { const cm = document.getElementById('customContextMenu'); if(cm) cm.style.display = 'none'; }
document.addEventListener('click', closeContextMenu);

function applyTilt(e, elem) {
    if(window.innerWidth < 1200) return; 
    const rect = elem.getBoundingClientRect();
    const dx = e.clientX - rect.left - (rect.width / 2);
    const dy = e.clientY - rect.top - (rect.height / 2);
    elem.style.transform = `perspective(1000px) rotateY(${dx / 15}deg) rotateX(${-dy / 15}deg) translateZ(10px)`;
}
function resetTilt(elem) { elem.style.transform = `perspective(1000px) rotateY(0) rotateX(0) translateZ(0)`; }
document.addEventListener('mousemove', e => {
    if(window.innerWidth < 1200) return;
    const card = e.target.closest('.unit-card') || e.target.closest('.jewel-item');
    document.querySelectorAll('.unit-card, .jewel-item').forEach(el => { if(el !== card) resetTilt(el); });
    if(card) applyTilt(e, card);
});
document.addEventListener('mouseleave', () => { document.querySelectorAll('.unit-card, .jewel-item').forEach(resetTilt); }, true);

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

// 스마트 수량 컨트롤 엔진 (Shift+클릭 다중 증감 지원)
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
        else { setOwnedQty(id, (ownedUnits.get(id) || 0) + finalDelta); }
    };
    action();
    repeatDelayTimer = setTimeout(() => { repeatTimer = setInterval(() => { triggerHaptic(); action(); }, 80); }, 400);
}
function stopSmartChange() { clearTimeout(repeatDelayTimer); clearInterval(repeatTimer); repeatDelayTimer = null; repeatTimer = null; }
document.addEventListener('mouseup', stopSmartChange); document.addEventListener('touchend', stopSmartChange); document.addEventListener('contextmenu', stopSmartChange); 

// 툴팁 글로벌 마우스 트래커
let tooltipTracker = (e) => {
    const tt = document.getElementById('recipeTooltip');
    if(!tt || !tt.classList.contains('active')) return;
    let x = e.pageX, y = e.pageY;
    if(x + 280 > window.innerWidth) x = window.innerWidth - 290;
    tt.style.left = Math.max(10, x + 15) + 'px'; tt.style.top = (y + 15) + 'px';
};
document.addEventListener('mousemove', tooltipTracker);

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

// 초고속 정수 연산
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
    const setVal=(id,v)=>{const el=document.getElementById(id);if(el){el.innerText=v;el.parentElement.className='cost-slot'+(el.parentElement.id.includes('magic')?' is-magic-slot':'')+(id.includes('total')?' total':'')+(v>0?' active':'')}};
    setVal('val-coral',counts.코랄);setVal('val-aiur',counts.아이어);setVal('val-zerus',counts.제루스);setVal('essence-total-val',counts.코랄+counts.아이어+counts.제루스);
}

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
    const layout = document.getElementById('mainLayout'); const btnCodex = document.getElementById('btnViewCodex'); const btnDeduct = document.getElementById('btnViewDeduct');
    if (!layout) return;
    _currentViewMode = mode; layout.classList.remove('view-deduct');
    
    if (mode === 'deduct') {
        layout.classList.add('view-deduct');
        if(btnCodex) btnCodex.classList.remove('active');
        if(btnDeduct) btnDeduct.classList.add('active');
        TutorialEngine.handleEvent('click_deduct');
    } else {
        if(btnCodex) btnCodex.classList.add('active');
        if(btnDeduct) btnDeduct.classList.remove('active');
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

    let totalMagic=0;
    dashboardAtoms.forEach(a=>{
        const val=totalMap[a], owned=ownedMap[a];
        const container=document.getElementById(`vslot-${clean(a)}`);if(!container)return;
        const e=container.querySelector('.cost-val'), nameEl=container.querySelector('.cost-name');

        if(a==="갓오타/메시브"){
            let finalG = Math.max(0, val.갓오타 - owned.갓오타); let finalM = Math.max(0, val.메시브 - owned.메시브);
            if(finalG>0 || finalM>0){
                e.innerHTML=`<div style="display:flex; width:100%; height:100%;">
                    <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; border-right:1px solid rgba(236,72,153,0.3);">
                        <span style="font-size:1.8rem; font-weight:900; color:var(--grade-rare); line-height:1; margin-bottom:4px; text-shadow:0 0 10px rgba(251,191,36,0.5);">${finalG}</span>
                        <span style="font-size:0.7rem; color:rgba(255,255,255,0.7); letter-spacing:-0.5px;">갓오타</span>
                    </div>
                    <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                        <span style="font-size:1.8rem; font-weight:900; color:var(--grade-unique); line-height:1; margin-bottom:4px; text-shadow:0 0 10px rgba(239,68,68,0.5);">${finalM}</span>
                        <span style="font-size:0.7rem; color:rgba(255,255,255,0.7); letter-spacing:-0.5px;">메시브</span>
                    </div>
                </div>`;
                nameEl.style.display='none'; container.classList.add('active');
            } else { 
                if(e.innerHTML !== EMPTY_SVG) { e.innerHTML=EMPTY_SVG; nameEl.style.display='block'; container.classList.remove('active'); }
            }
        } else {
            let finalVal = Math.max(0, val - owned);
            if(finalVal>0){ 
                e.innerText=Math.ceil(finalVal); nameEl.style.display='block'; container.classList.add('active'); totalMagic+=finalVal; 
            } else { 
                if(e.innerHTML !== EMPTY_SVG) { e.innerHTML=EMPTY_SVG; nameEl.style.display='block'; container.classList.remove('active'); }
            }
        }
    });
    const magicTotalEl=document.querySelector('#slot-total-magic .cost-val');
    if(magicTotalEl){magicTotalEl.innerText=Math.ceil(totalMagic);magicTotalEl.parentElement.classList.toggle('active',totalMagic>0);}
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
    if(!g || g.innerHTML!=='') return; 
    
    let h=''; const url="https://raw.githubusercontent.com/sldbox/site/main/image/jw/";
    JEWEL_DATABASE.forEach((koArr) => {
        const kr=koArr[0], krLeg=koArr[1], krMyth=koArr[2], imgName=koArr[3]||kr;
        const c = typeof JEWEL_COLORS !== 'undefined' && JEWEL_COLORS[kr] ? JEWEL_COLORS[kr] : "#ffffff";
        let mythHtml = '';
        if (krMyth && krMyth.trim() !== "") { mythHtml = `<div class="jw-stat mythic"><div class="jw-stat-lbl">신화 능력 <span class="mythic-sparkle">✦</span></div><div class="jw-stat-val">${krMyth}</div></div>`; }
        h+=`<div class="jewel-item"><div class="jewel-header"><div class="jewel-img-wrap" style="border-color:${c}80; color:${c}; box-shadow:inset 0 0 15px rgba(0,0,0,0.8), 0 0 15px ${c}40;"><img src="${url}${imgName}.png" onerror="this.src=''" alt="${kr}"></div><div class="jewel-name-txt" style="text-shadow:0 0 10px ${c}80;">${kr}</div></div><div class="jewel-body"><div class="jw-stat legend"><div class="jw-stat-lbl">전설 능력</div><div class="jw-stat-val">${krLeg}</div></div>${mythHtml}</div></div>`;
    });
    g.innerHTML=h;
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

        // 모바일 제스처 스와이프 등록
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

// 기본 단축키 방지 등
document.addEventListener('dragstart',e=>e.preventDefault());
document.addEventListener('selectstart',e=>{if(!e.target.closest('.smart-stepper') && !e.target.closest('input')) e.preventDefault()});
