/*
=============================================================================
  개복디 넥서스 — app.js
=============================================================================
*/

// [핵심 데이터 맵]
const unitMap = new Map(), activeUnits = new Map(), ownedUnits = new Map(), DOM = {};

// [핵심 상수 및 유틸]
const clean = s => s ? s.replace(/\s+/g, '').toLowerCase() : '';
const IGNORE_PARSE_RECIPES = ["미발견", "없음", ""];
const dashboardAtoms = ["전쟁광", "스파르타중대", "암흑광전사", "암흑파수기", "원시바퀴", "저격수", "코브라", "암흑고위기사", "암흑추적자", "변종가시지옥", "망치경호대", "공성파괴단", "암흑집정관", "암흑불멸자", "원시히드라리스크", "땅거미지뢰", "자동포탑", "우르사돈암", "우르사돈수", "갓오타/메시브"];
const EMPTY_SVG = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.2;"><rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect><line x1="3" y1="21" x2="21" y2="3"></line></svg>`;

const isOneTime = (u) => u && (u.grade === "슈퍼히든" || ["데하카", "데하카고치", "데하카의오른팔"].includes(u.name));

function getUnitId(rawName){ const c=clean(rawName); const u=unitMap.get(c); return u ? u.id : c; }

function calculateTotalCostScore(costStr){
    if(!costStr||IGNORE_PARSE_RECIPES.includes(costStr))return 0;
    let score=0;
    costStr.split('+').forEach(p=>{const m=p.match(/\[(\d+(?:\.\d+)?)\]/);if(m)score+=parseFloat(m[1]);else score+=1});
    return score;
}

function initializeCacheEngine() {
    unitMap.forEach(u => {
        u.parsedCost = [];
        if(u.cost && !IGNORE_PARSE_RECIPES.includes(u.cost)) {
            const safeCost = u.cost.replace(/[.\/]/g, '+');
            safeCost.split('+').forEach(p => {
                const m = p.match(/(.+?)\[(\d+(?:\.\d+)?)\]/);
                let name = m ? m[1].trim() : p.trim(); let qty = m ? parseFloat(m[2]) : 1; let cName = clean(name); let type = 'atom', key = cName;
                if(cName.includes('메시브') || cName.includes('디제스터')) { type='special'; key='메시브'; }
                else if(cName.includes('갓오브타임') || cName.includes('갓오타')) { type='special'; key='갓오타'; }
                else if(cName.includes('땅거미지뢰')) { key='땅거미지뢰'; }
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
                if(m) {
                    const childId = getUnitId(m[1]);
                    u.parsedRecipe.push({ id: childId, qty: m[3] ? parseInt(m[3]) : 1, cond: m[2] || '' });
                }
            });
        }
    });
}

// =====================================================================
// 정수 코스트 계산 로직
// =====================================================================

function calcEssenceRecursiveFast(uid, counts, visited) {
    if(visited.has(uid)) return; visited.add(uid);
    const u = unitMap.get(uid); if(!u) return;
    if(["히든", "슈퍼히든"].includes(u.grade)) {
        if(u.category === "테바테메") counts.코랄 += 1;
        else if(u.category === "토바토메") counts.아이어 += 1;
        else if(u.category === "저그중립" && u.name !== "미니성큰") counts.제루스 += 1;
        else if(u.category === "혼종") counts.혼종 += 1;
    }
    if(u.parsedRecipe) u.parsedRecipe.forEach(pr => { if(pr.id) calcEssenceRecursiveFast(pr.id, counts, visited); });
}

function updateEssence(){
    let counts={코랄:0, 아이어:0, 제루스:0, 혼종:0}, visited = new Set();
    activeUnits.forEach((qty, key) => { const u = unitMap.get(key); if(u && ["히든", "슈퍼히든"].includes(u.grade)) calcEssenceRecursiveFast(key, counts, visited); });

    const finalCoral = counts.코랄 + counts.혼종;
    const finalAiur = counts.아이어 + counts.혼종;
    const finalZerus = counts.제루스 + counts.혼종;
    const totalEssence = finalCoral + finalAiur + finalZerus;

    const setVal = (id, totalVal, baseVal, hybridVal) => {
        const el = document.getElementById(`val-${id}`);
        const subEl = document.getElementById(`sub-${id}`);
        const parent = document.getElementById(`slot-${id}`);

        if(el) {
            if(el.innerText !== String(totalVal)) el.innerText = totalVal;
            if(subEl) {
                if (hybridVal > 0 && id !== 'hybrid') {
                    subEl.innerText = `${baseVal} + ${hybridVal}`;
                } else {
                    subEl.innerText = '';
                }
            }
            if(parent) {
                const isActive = totalVal > 0;
                parent.classList.toggle('active', isActive);
            }
        }
    };

    setVal('coral', finalCoral, counts.코랄, counts.혼종);
    setVal('aiur', finalAiur, counts.아이어, counts.혼종);
    setVal('zerus', finalZerus, counts.제루스, counts.혼종);
    setVal('hybrid', counts.혼종, counts.혼종, 0);

    const totalEl = document.getElementById('essence-total-val');
    if(totalEl) {
        totalEl.innerText = totalEssence;
        const parent = document.getElementById('slot-total-essence');
        if(parent) parent.classList.toggle('active', totalEssence > 0);
    }
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

    dashboardAtoms.forEach(a=>{
        const val=totalMap[a], owned=ownedMap[a];
        const container=document.getElementById(`vslot-${clean(a)}`);if(!container)return;
        const e=container.querySelector('.cost-val'), nameEl=container.querySelector('.cost-name');

        if(a==="갓오타/메시브"){
            let finalG = Math.max(0, val.갓오타 - owned.갓오타); let finalM = Math.max(0, val.메시브 - owned.메시브);
            if(finalG>0 || finalM>0){
                if(e.innerHTML === EMPTY_SVG || e.innerHTML === '') {
                    e.innerHTML=`<div class="sp-wrap" style="display:flex; width:100%; height:100%;">
                        <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; border-right:1px solid rgba(236,72,153,0.3);">
                            <span class="sp-val-g" style="font-size:1.8rem; font-weight:900; color:var(--grade-rare); line-height:1; margin-bottom:4px; text-shadow:0 0 10px rgba(251,191,36,0.5);"></span>
                            <span style="font-size:0.7rem; color:rgba(255,255,255,0.7); letter-spacing:-0.5px;">갓오타</span>
                        </div>
                        <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                            <span class="sp-val-m" style="font-size:1.8rem; font-weight:900; color:var(--grade-unique); line-height:1; margin-bottom:4px; text-shadow:0 0 10px rgba(239,68,68,0.5);"></span>
                            <span style="font-size:0.7rem; color:rgba(255,255,255,0.7); letter-spacing:-0.5px;">메시브</span>
                        </div>
                    </div>`;
                }
                const spG = e.querySelector('.sp-val-g');
                const spM = e.querySelector('.sp-val-m');
                if(spG) spG.innerText = finalG;
                if(spM) spM.innerText = finalM;

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
            } else {
                if(e.innerHTML !== EMPTY_SVG) { e.innerHTML=EMPTY_SVG; nameEl.style.display='block'; container.classList.remove('active'); }
            }
        }
    });
}

// =========================================================
// UI 상태 및 설정 변수
// =========================================================
let _activeTabIdx = 0;
let _currentViewMode = 'codex';

const GRADE_ORDER = ["매직", "레어", "에픽", "유니크", "헬", "레전드", "히든", "슈퍼히든"];
const gradeColorsRaw = { "매직":"var(--grade-magic)", "레어":"var(--grade-rare)", "에픽":"var(--grade-epic)", "유니크":"var(--grade-unique)", "헬":"var(--grade-hell)", "레전드":"var(--grade-legend)", "히든":"var(--grade-hidden)", "슈퍼히든":"var(--grade-super)" };

const TAB_CATEGORIES = [
    {key:"테바테메", name:"테바테메", sym:"♆"},
    {key:"토바토메", name:"토바토메", sym:"⟡"},
    {key:"저그중립", name:"저그중립", sym:"☣︎"},
    {key:"혼종", name:"혼종", sym:"⌬"}
];

// --- 햅틱 피드백 엔진 ---
function triggerHaptic() { if (typeof navigator !== 'undefined' && navigator.vibrate) { navigator.vibrate(15); } }

// --- 데이터 초기화 모듈 ---
function resetCodex(silent = false) { activeUnits.clear(); debouncedUpdateAllPanels(); if(!silent) showToast("선택된 유닛이 초기화되었습니다."); }
function resetOwned() { ownedUnits.clear(); debouncedUpdateAllPanels(); showToast("보유 유닛이 초기화되었습니다."); }

// 초기 진입 설정
function setupInitialView() {
    const layout = document.getElementById('mainLayout');
    if (layout) layout.style.display = '';
    switchLayout('codex');
    startTitleCycle();
}

// 제목 순환 애니메이션
const _cycleTitles = ['개복디 넥서스', '제작자 | 회장', 'ID : 3-S2-1-2461127'];
let _cycleTitleIdx = 0;
function startTitleCycle() {
    const el = document.getElementById('nexusCycleTitle');
    if(!el) return;
    setInterval(() => {
        _cycleTitleIdx = (_cycleTitleIdx + 1) % _cycleTitles.length;
        el.style.opacity = '0';
        el.style.transform = 'translateY(-8px)';
        setTimeout(() => {
            el.textContent = _cycleTitles[_cycleTitleIdx];
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, 350);
    }, 3000);
}

// 쥬얼 모달 패널 토글
let _jewelPanelOpen = false;
function toggleJewelPanel() {
    _jewelPanelOpen = !_jewelPanelOpen;
    const modal = document.getElementById('jewelModalOverlay');

    if(_jewelPanelOpen) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        renderJewelMiniGrid();
    } else {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}
function closeJewelModal(e) {
    if(e.target === document.getElementById('jewelModalOverlay')) {
        if(_jewelPanelOpen) toggleJewelPanel();
    }
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
    } else {
        btnToggle.classList.add('active');
        btnToggle.innerHTML = '<span class="toggle-icon">◨</span> 차감 모드 전환';
    }
}

function toggleViewMode() {
    if (_currentViewMode === 'deduct') switchLayout('codex');
    else switchLayout('deduct');
}

// =========================================================
// 검색 및 커맨드 엔진 (Search & Command)
// =========================================================
let searchTimeout = null;
const ALIAS_MAP = {
    "타커": "타이커스", "타이": "타이커스", "닥템": "암흑기사", "닼템": "암흑기사", "다칸": "암흑집정관",
    "스투": "스투코프", "디젯": "디제스터", "메십": "메시브", "마랩": "마스터랩", "히페": "히페리온",
    "고전순": "고르곤전투순양함", "특레": "특공대레이너", "드레천": "드라켄레이저천공기",
    "공허": "공허포격기", "분수": "분노수호자", "원히": "원시히드라리스크"
};

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

function findUnitFlexible(rawName) {
    let qClean = clean(rawName); if(!qClean) return null;
    let aliased = ALIAS_MAP[rawName] || ALIAS_MAP[qClean];
    if(aliased) qClean = clean(aliased);

    for(let [id, u] of unitMap) {
        let uClean = clean(u.name);
        if(uClean === qClean || id === qClean || uClean.includes(qClean)) return u;
    }
    return null;
}

function performSearch(query) {
    const sr = document.getElementById('searchResults'); if(!query.trim()) { sr.classList.remove('active'); return; }
    const parts = query.split('/'); let currentQuery = parts[parts.length - 1].trim(); if(!currentQuery) { sr.classList.remove('active'); return; }

    let searchName = currentQuery.split('*')[0].trim(); let qClean = clean(searchName);
    let matchedUnits = [];

    unitMap.forEach(u => {
        let uClean = clean(u.name);
        if(uClean.includes(qClean) || (ALIAS_MAP[searchName] && uClean === clean(ALIAS_MAP[searchName]))) {
            matchedUnits.push(u);
        }
    });

    matchedUnits.sort((a,b) => GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade));
    let combined = matchedUnits.slice(0, 10);

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
    const inputEl = document.getElementById('unitSearchInput');
    let val = inputEl.value;
    let parts = val.split('/');
    let lastPart = parts[parts.length - 1];
    let multiplierMatch = lastPart.match(/\*\d+/);
    let multiplier = multiplierMatch ? multiplierMatch[0] : '*1';

    parts[parts.length - 1] = unitName + multiplier;
    inputEl.value = parts.join('/');
    inputEl.focus();
    document.getElementById('searchResults').classList.remove('active');
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
            if(newQty > 16 && !isOneTime(match)) newQty = 16;
            if(isOneTime(match)) newQty = 1;
            activeUnits.set(match.id, newQty); successCount++;
        }
    });

    if(successCount > 0) {
        debouncedUpdateAllPanels(); showToast(`<span class="t-icon">⚡</span> ${successCount}건의 커맨드 등록 완료`);
        const inputEl = document.getElementById('unitSearchInput'); if(inputEl) inputEl.value = '';
        document.getElementById('searchResults').classList.remove('active');
        if(_currentViewMode === 'deduct') switchLayout('codex');
    } else { showToast(`<span class="t-icon">⚠</span> 유효한 유닛을 찾을 수 없습니다.`, true); }
}

function showToast(msg, isError = false) {
    const container = document.getElementById('toastContainer'); if(!container) return;
    const t = document.createElement('div'); t.className = 'toast' + (isError ? ' error' : ''); t.innerHTML = msg;
    container.appendChild(t); setTimeout(() => { if(t.parentElement) t.remove(); }, 2100);
}

// =========================================================
// 공통 리스너 및 유틸리티
// =========================================================
window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        hideRecipeTooltip();
        if (_jewelPanelOpen) toggleJewelPanel();
        const searchEl = document.getElementById('unitSearchInput');
        if (document.activeElement === searchEl) {
            searchEl.value = '';
            document.getElementById('searchResults').classList.remove('active');
            searchEl.blur();
        }
    }
});

let repeatTimer = null, repeatDelayTimer = null;
let _lastInteractionTime = 0;

function startSmartChange(id, delta, type, event) {
    if(event) {
        if(event.type === 'touchstart') {
            _lastInteractionTime = Date.now();
        } else if(event.type === 'mousedown' && Date.now() - _lastInteractionTime < 300) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
    }
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
        }
    };
    action();
    repeatDelayTimer = setTimeout(() => { repeatTimer = setInterval(() => { triggerHaptic(); action(); }, 80); }, 400);
}

function stopSmartChange() { clearTimeout(repeatDelayTimer); clearInterval(repeatTimer); repeatDelayTimer = null; repeatTimer = null; }
document.addEventListener('mouseup', stopSmartChange);
document.addEventListener('touchend', stopSmartChange);
window.addEventListener('mouseleave', stopSmartChange);

function showRecipeTooltip(id, event, isDeduction = false) {
    if(event && event.type !== 'mousemove') event.stopPropagation();
    const u = unitMap.get(id); if(!u) return;
    let multi = 1;
    if(isDeduction) { const reqEl = document.getElementById(`d-req-${id}`); if(reqEl) { let reqVal = parseInt(reqEl.innerText); if(reqVal > 1) multi = reqVal; } }
    const tt = document.getElementById('recipeTooltip');
    tt.innerHTML = `<div class="tooltip-header" style="color:${gradeColorsRaw[u.grade]}">${u.name} 조합법 ${multi > 1 ? `<span style="font-size:0.8rem; color:var(--text-sub);">(${multi}개 기준)</span>` : ''}</div><div class="tooltip-body">${formatRecipeTooltip(u, multi)}</div><div class="tooltip-footer">화면을 터치하거나 외부 클릭 시 닫힙니다.</div>`;
    tt.classList.add('active');

    let x = event.pageX || (event.touches && event.touches[0].pageX) || window.innerWidth/2;
    let y = event.pageY || (event.touches && event.touches[0].pageY) || window.innerHeight/2;
    if(x + 280 > window.innerWidth) x = window.innerWidth - 290;
    tt.style.left = Math.max(10, x + 15) + 'px'; tt.style.top = (y + 15) + 'px';
}
function hideRecipeTooltip() { const tt = document.getElementById('recipeTooltip'); if(tt) tt.classList.remove('active'); }
document.addEventListener('click', hideRecipeTooltip); document.addEventListener('touchstart', hideRecipeTooltip);

function toggleUnitSelection(id, forceQty){
    if(activeUnits.has(id)){
        activeUnits.delete(id);
    } else {
        const u = unitMap.get(id); const initQty = isOneTime(u) ? 1 : (forceQty || 1);
        activeUnits.set(id, initQty);
    }
    debouncedUpdateAllPanels();
}

function setUnitQty(id, val) {
    let q = parseInt(val);
    if (q === 0 || isNaN(q) || q < 1) {
        if (activeUnits.has(id)) { activeUnits.delete(id); }
        debouncedUpdateAllPanels();
        return;
    }
    const u = unitMap.get(id); if (!u || isOneTime(u)) return;
    if (q > 16) q = 16;
    activeUnits.set(id, q); debouncedUpdateAllPanels();
}

function setOwnedQty(id, val) {
    let q = parseInt(val); if (isNaN(q) || q < 0) q = 0;
    const inEl = document.getElementById(`d-in-${id}`);
    let maxQty = 99;
    if(inEl && inEl.hasAttribute('data-req')) { const reqVal = parseInt(inEl.getAttribute('data-req')); if(reqVal > 0) maxQty = reqVal; }
    if (q > maxQty) q = maxQty;
    ownedUnits.set(id, q); debouncedUpdateAllPanels();
}

// =========================================================
// 차감 연동 계산기
// =========================================================
function calculateDeductedRequirements() {
    let deficits = new Map();
    let reqMap = new Map();
    let reasonMap = new Map();

    let specialReq = { 갓오타: 0, 메시브: 0, 자동포탑: 0, 땅거미지뢰: 0 };
    let specialReason = { 갓오타: new Set(), 메시브: new Set(), 자동포탑: new Set(), 땅거미지뢰: new Set() };

    activeUnits.forEach((qty, uid) => {
        deficits.set(uid, (deficits.get(uid) || 0) + qty);
        reqMap.set(uid, (reqMap.get(uid) || 0) + qty);
        if (!reasonMap.has(uid)) reasonMap.set(uid, new Set());
        reasonMap.get(uid).add('목표 유닛');
    });

    let availableOwned = new Map(ownedUnits);
    let safetyCounter = 0;

    while(deficits.size > 0 && safetyCounter < 2000) {
        safetyCounter++;
        let highestUid = null, highestScore = -1;

        for (let uid of deficits.keys()) {
            const u = unitMap.get(uid);
            const score = u ? calculateTotalCostScore(u.cost) : 0;
            if (score > highestScore) { highestScore = score; highestUid = uid; }
        }
        if (!highestUid) break;

        let needed = deficits.get(highestUid);
        deficits.delete(highestUid);
        if (needed <= 0) continue;

        let owned = availableOwned.get(highestUid) || 0;
        let consumed = Math.min(needed, owned);
        availableOwned.set(highestUid, owned - consumed);
        let remaining = needed - consumed;

        if (remaining > 0) {
            const u = unitMap.get(highestUid);
            if (u) {
                if (u.parsedRecipe) {
                    u.parsedRecipe.forEach(child => {
                        if (child.id) {
                            let childNeed = remaining * child.qty;
                            deficits.set(child.id, (deficits.get(child.id) || 0) + childNeed);
                            reqMap.set(child.id, (reqMap.get(child.id) || 0) + childNeed);
                            if (!reasonMap.has(child.id)) reasonMap.set(child.id, new Set());
                            reasonMap.get(child.id).add(u.name);
                        }
                    });
                }
                if (u.parsedCost) {
                     u.parsedCost.forEach(pc => {
                         let pcNeed = pc.qty * remaining;
                         if (pc.type === 'special') {
                             if (pc.key === '메시브') { specialReq.메시브 += pcNeed; specialReason.메시브.add(u.name); }
                             if (pc.key === '갓오타') { specialReq.갓오타 += pcNeed; specialReason.갓오타.add(u.name); }
                         } else if (pc.key === '자동포탑') {
                             specialReq.자동포탑 += pcNeed; specialReason.자동포탑.add(u.name);
                         } else if (pc.key === '땅거미지뢰') {
                             specialReq.땅거미지뢰 += pcNeed; specialReason.땅거미지뢰.add(u.name);
                         }
                     });
                }
            }
        }
    }

    return { reqMap, reasonMap, specialReq, specialReason };
}

function renderActiveRoster() {
    const roster = document.getElementById('activeRoster');
    if(!roster) return;

    let html = '';
    activeUnits.forEach((qty, id) => {
        const u = unitMap.get(id);
        if(u) {
            html += `<div class="roster-tag" onclick="toggleUnitSelection('${id}')" style="border-color:${gradeColorsRaw[u.grade]}66;">
                <div style="width:20px;height:20px;border-radius:4px;overflow:hidden;flex-shrink:0;">
                    <img src="https://sldbox.github.io/site/image/ctg/${u.name}.png" style="width:100%;height:100%;object-fit:cover;clip-path:inset(1px);transform:scale(1.1);" onerror="this.style.display='none'">
                </div>
                <span style="color:${gradeColorsRaw[u.grade]}; font-weight:bold;">${u.name}</span>
                <span class="roster-qty">×${qty}</span>
            </div>`;
        }
    });

    if(html === '') roster.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">선택된 유닛 대기열 (검색 후 엔터)</span>';
    else roster.innerHTML = html;
}

let updateTimer = null;
function debouncedUpdateAllPanels() {
    if (updateTimer) cancelAnimationFrame(updateTimer);
    updateTimer = requestAnimationFrame(() => {
        updateMagicDashboard();
        updateEssence();
        updateTabsUI();
        updateTabContentUI();
        updateDeductionBoard();
        renderActiveRoster();
    });
}

function renderDeductionBoard() {
    if (!DOM.deductionBoard) return;

    const renderSlot = (id, name, grade, parentId) => {
        const color = gradeColorsRaw[grade] || "var(--text)";
        return `<div class="deduct-slot" id="d-slot-wrap-${id}" data-orig-parent="${parentId}" style="display:none;">
            <div class="d-reason-wrap" id="d-reason-${id}" style="display:none;"></div>
            <div class="d-name" style="color: ${color}; cursor:help;" onclick="showRecipeTooltip('${id}', event, true)">
                <span class="gtag" style="border-color:${color}44; color:${color}; margin-right:6px;">${grade}</span>${name}
            </div>
            <div class="d-inputs">
                <div class="smart-stepper owned-stepper">
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

    h += `<div class="deduct-group" id="group-final" style="display:none; border-color:rgba(251,191,36,0.3); background:linear-gradient(to bottom, rgba(30,25,10,0.6), rgba(15,10,5,0.8));">
            <div class="deduct-group-title" style="color:var(--grade-super); border-bottom-color:rgba(251,191,36,0.2);">
                <span style="color:var(--grade-super); text-shadow:0 0 10px var(--grade-super);">✦</span> 직속 재료 (최종 조합)
            </div>
            <div class="deduct-grid" id="grid-final"></div>
          </div>`;

    const specialIds = ['갓오타', '메시브', '자동포탑', '땅거미지뢰'];

    h += `<div class="deduct-group" id="group-special"><div class="deduct-group-title"><span style="color:var(--grade-unique);">★</span> 특수 및 기초 자원 맵핑</div><div class="deduct-grid" id="grid-special">
            ${renderSlot('갓오타', '갓오타', '레어', 'grid-special')} ${renderSlot('메시브', '메시브', '유니크', 'grid-special')} ${renderSlot('자동포탑', '자동포탑', '매직', 'grid-special')} ${renderSlot('땅거미지뢰', '땅거미지뢰', '히든', 'grid-special')}
          </div></div>`;

    const topGrades = ["레전드", "헬", "유니크", "에픽", "레어"];
    let topItems = Array.from(unitMap.values()).filter(u => topGrades.includes(u.grade) && !specialIds.includes(u.id));
    topItems.sort((a, b) => GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade));

    h += `<div class="deduct-group" id="group-top"><div class="deduct-group-title"><span style="color:var(--grade-legend);">▲</span> 상위 등급 맵핑 (레전드 ~ 레어)</div><div class="deduct-grid" id="grid-top">
            ${topItems.map(u => renderSlot(u.id, u.name, u.grade, 'grid-top')).join('')}
          </div></div>`;

    let hiddenItems = Array.from(unitMap.values()).filter(u => u.grade === "히든" && !specialIds.includes(u.id));
    h += `<div class="deduct-group" id="group-hidden" style="margin-bottom:0;"><div class="deduct-group-title"><span style="color:var(--grade-hidden);">♦</span> 히든 등급 맵핑</div><div class="deduct-grid" id="grid-hidden">
            ${hiddenItems.map(u => renderSlot(u.id, u.name, u.grade, 'grid-hidden')).join('')}
          </div></div>`;

    DOM.deductionBoard.innerHTML = h;
}

function updateDeductionBoard() {
    if (!DOM.deductionBoard) return;

    const { reqMap, reasonMap, specialReq, specialReason } = calculateDeductedRequirements();

    const directMaterials = new Set();
    activeUnits.forEach((qty, uid) => {
        const u = unitMap.get(uid);
        if(u && u.parsedRecipe) {
            u.parsedRecipe.forEach(pr => { if(pr.id) directMaterials.add(pr.id); });
        }
    });

    const updateSlot = (id, targetVal, reasons) => {
        const reqEl = document.getElementById(`d-req-${id}`), wrapEl = document.getElementById(`d-slot-wrap-${id}`), inEl = document.getElementById(`d-in-${id}`), reasonContainer = document.getElementById(`d-reason-${id}`);
        if(reqEl && wrapEl && inEl) {
            reqEl.innerText = targetVal; inEl.setAttribute('data-req', targetVal);
            let ownedVal = parseInt(inEl.innerText) || 0;

            if (targetVal > 0 && ownedVal > targetVal) {
                ownedVal = targetVal;
                ownedUnits.set(id, ownedVal);
                inEl.innerText = ownedVal;
            } else if (targetVal === 0 && ownedVal > 0) {
                ownedVal = 0;
                ownedUnits.set(id, 0);
                inEl.innerText = 0;
            } else {
                inEl.innerText = ownedUnits.get(id) || 0;
                ownedVal = parseInt(inEl.innerText) || 0;
            }

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

            if ((targetVal > 0 || ownedVal > 0) && directMaterials.has(id)) {
                const finalGrid = document.getElementById('grid-final');
                if (finalGrid && wrapEl.parentElement !== finalGrid) finalGrid.appendChild(wrapEl);
            } else {
                const origParentId = wrapEl.getAttribute('data-orig-parent');
                const origParent = document.getElementById(origParentId);
                if (origParent && wrapEl.parentElement !== origParent) origParent.appendChild(wrapEl);
            }
        }
    };

    updateSlot('갓오타', specialReq.갓오타, specialReason.갓오타);
    updateSlot('메시브', specialReq.메시브, specialReason.메시브);
    updateSlot('자동포탑', Math.max(reqMap.get('자동포탑') || 0, Math.ceil(specialReq.자동포탑 || 0)), reasonMap.get('자동포탑'));
    updateSlot('땅거미지뢰', Math.max(reqMap.get('땅거미지뢰') || 0, Math.ceil(specialReq.땅거미지뢰 || 0)), reasonMap.get('땅거미지뢰'));

    const targetGrades = ["레어", "에픽", "유니크", "헬", "레전드", "히든"];
    unitMap.forEach(u => { if(targetGrades.includes(u.grade) && u.id !== '자동포탑' && u.id !== '땅거미지뢰') updateSlot(u.id, reqMap.get(u.id) || 0, reasonMap.get(u.id)); });

    let hasAnyVisible = false;
    document.querySelectorAll('.deduct-group').forEach(group => {
        const visibleSlots = group.querySelectorAll('.deduct-slot.is-visible');
        if (visibleSlots.length === 0) group.style.display = 'none';
        else { group.style.display = 'block'; hasAnyVisible = true; }
    });
    const emptyMsg = document.getElementById('deduct-empty-msg');
    if (emptyMsg) {
        if (!hasAnyVisible) emptyMsg.style.display = 'block';
        else emptyMsg.style.display = 'none';
    }
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

function formatRecipe(item, multiplier = 1, showSeparator = false) {
    if (!item.recipe || IGNORE_PARSE_RECIPES.includes(item.recipe)) return `<div style="color:var(--text-muted);font-size:0.85rem;">정보 없음</div>`;
    const wrapClass = showSeparator ? '' : 'recipe-vertical';
    const wrapStyle = showSeparator ? 'display:flex; flex-wrap:wrap; gap:6px; align-items:center;' : '';
    let html = `<div class="${wrapClass}" style="${wrapStyle}">`;
    item.recipe.split(/\+(?![^()]*\))/).forEach((part, index, arr) => {
        const match = part.trim().match(/^([^(\[]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/);
        if (match) {
            const rawKo = match[1].trim(), u = unitMap.get(getUnitId(rawKo));
            let condTxt = match[2] ? `(${match[2]})` : '';
            let baseQty = match[3] ? parseInt(match[3]) : 1; let finalQty = baseQty * multiplier; let qtyTxt = `[${finalQty}]`;
            const color = u && gradeColorsRaw[u.grade] ? gradeColorsRaw[u.grade] : "var(--text)";
            html += `<div class="recipe-badge" style="color:${color}; border-color:${color}44;">${rawKo} <span class="badge-cond">${condTxt}${qtyTxt}</span></div>`;
        } else { html += `<div style="color:var(--text-sub); font-size:0.85rem; white-space:nowrap;">${part}</div>`; }
        if (showSeparator && index < arr.length - 1) { html += `<div style="color:var(--text-muted); font-size:0.9rem; font-weight:bold;">+</div>`; }
    });
    return html + '</div>';
}
function formatRecipeHorizontal(item, multiplier = 1) { return formatRecipe(item, multiplier, false); }
function formatRecipeTooltip(item, multiplier = 1) { return formatRecipe(item, multiplier, true); }

function selectTab(idx){ _activeTabIdx=idx; updateTabsUI(); renderCurrentTabContent(); }

function renderCurrentTabContent() {
    const catKey = TAB_CATEGORIES[_activeTabIdx].key;
    let items = Array.from(unitMap.values()).filter(u => ["슈퍼히든","히든","레전드"].includes(u.grade) && u.category === catKey);

    items.sort((a,b) => {
        const aOne = isOneTime(a);
        const bOne = isOneTime(b);
        if (aOne && !bOne) return -1;
        if (!aOne && bOne) return 1;

        if(a.grade !== b.grade) return GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade);
        return calculateTotalCostScore(b.cost) - calculateTotalCostScore(a.cost);
    });

    let h='<div style="display:flex;flex-direction:column;gap:4px;">';
    if (items.length === 0) h += `<div style="text-align:center; padding:30px; color:var(--text-sub); font-weight:bold; font-size:1.05rem;">해당 분류에 유닛이 없습니다.</div>`;

    items.forEach((item, index) => {
        const unitCost = Math.ceil(calculateTotalCostScore(item.cost));
        let gradeHtml = `<span class="gtag" style="border-color:${gradeColorsRaw[item.grade]}44; color:${gradeColorsRaw[item.grade]};">${item.grade}</span>`;

        let rightControls = '';

        if (!isOneTime(item)) {
            rightControls = `<div class="uc-ctrl" onclick="event.stopPropagation()">
                <div class="smart-stepper active-stepper">
                    <button id="btn-minus-${item.id}" onmousedown="startSmartChange('${item.id}', -1, 'active', event)" ontouchstart="startSmartChange('${item.id}', -1, 'active', event)">-</button>
                    <div class="ss-val" id="val-${item.id}">-</div>
                    <button id="btn-plus-${item.id}" onmousedown="startSmartChange('${item.id}', 1, 'active', event)" ontouchstart="startSmartChange('${item.id}', 1, 'active', event)">+</button>
                </div>
            </div>`;
        }

        h+=`<div id="card-${item.id}" class="unit-card" style="animation-delay:${index * 0.03}s" onclick="toggleUnitSelection('${item.id}', 1)">
            <div class="uc-wrap">
                <div class="uc-thumb-box">
                    <img src="https://sldbox.github.io/site/image/ctg/${item.name}.png" alt="${item.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" style="width:100%;height:100%;object-fit:cover;clip-path:inset(1px);transform:scale(1.08);">
                    <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;color:${gradeColorsRaw[item.grade]};opacity:0.3;">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                    </div>
                </div>
                <div class="uc-identity">
                    <div class="uc-grade">${gradeHtml}</div>
                    <div class="uc-name-row" style="color:${gradeColorsRaw[item.grade]};">${item.name}</div>
                </div>
                <div class="uc-recipe-col">${formatRecipeHorizontal(item)}</div>
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

        if(!isOneTime(item)) {
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
    DOM.magicDashboard.innerHTML=`
        <div class="cost-slot total" id="slot-total-essence">
            <div class="cost-val" id="essence-total-val">0</div>
            <div class="cost-name">총 정수 코스트</div>
        </div>
        <div class="cost-slot" id="slot-coral">
            <div class="cost-val" id="val-coral" style="color:#FF6B6B;">0</div>
            <div class="cost-sub" id="sub-coral" style="font-size:0.75rem; color:var(--text-sub); margin:-4px 0 4px; height:12px; font-family:var(--font-mono); letter-spacing:1px; line-height:1;"></div>
            <div class="cost-name">코랄</div>
        </div>
        <div class="cost-slot" id="slot-aiur">
            <div class="cost-val" id="val-aiur" style="color:var(--grade-rare);">0</div>
            <div class="cost-sub" id="sub-aiur" style="font-size:0.75rem; color:var(--text-sub); margin:-4px 0 4px; height:12px; font-family:var(--font-mono); letter-spacing:1px; line-height:1;"></div>
            <div class="cost-name">아이어</div>
        </div>
        <div class="cost-slot" id="slot-zerus">
            <div class="cost-val" id="val-zerus" style="color:var(--grade-legend);">0</div>
            <div class="cost-sub" id="sub-zerus" style="font-size:0.75rem; color:var(--text-sub); margin:-4px 0 4px; height:12px; font-family:var(--font-mono); letter-spacing:1px; line-height:1;"></div>
            <div class="cost-name">제루스</div>
        </div>
        <div class="cost-slot" id="slot-hybrid">
            <div class="cost-val" id="val-hybrid" style="color:var(--g);">0</div>
            <div class="cost-sub" id="sub-hybrid" style="font-size:0.75rem; color:var(--text-sub); margin:-4px 0 4px; height:12px; font-family:var(--font-mono); letter-spacing:1px; line-height:1;"></div>
            <div class="cost-name">혼종</div>
        </div>
    `;
    dashboardAtoms.forEach(a=>{
        const isSkill = (a === "갓오타/메시브"), isMagic = !isSkill;
        const d=document.createElement('div');
        d.className='cost-slot'+(isMagic?' is-magic-slot':'')+(isSkill?' is-skill-slot':''); d.id=`vslot-${clean(a)}`;
        d.innerHTML=`<div class="cost-val"></div><div class="cost-name" id="name-${clean(a)}">${a}</div>`;
        DOM.magicDashboard.appendChild(d);
    });
}

function renderJewelMiniGrid(){
    const g=document.getElementById('jewelMiniGrid');
    if(!g || g.dataset.rendered) return;
    if (typeof JEWEL_DATABASE === 'undefined') return;
    g.dataset.rendered = '1';

    const url="https://sldbox.github.io/site/image/jw/";
    let h='';
    JEWEL_DATABASE.forEach((koArr) => {
        const kr=koArr[0], krLeg=koArr[1], krMyth=koArr[2], imgName=koArr[3]||kr;
        const c = typeof JEWEL_COLORS !== 'undefined' && JEWEL_COLORS[kr] ? JEWEL_COLORS[kr] : "#ffffff";
        const cA = c + '22';
        const hasMythic = krMyth && krMyth.trim() !== "";
        h += `<div class="jwm-item" style="--jw-color:${c};--jw-color-a:${cA};">
            <div class="jwm-img-wrap">
                <img src="${url}${imgName}.png" alt="${kr}" onerror="this.style.opacity='0'">
            </div>
            <div class="jwm-name">${kr}</div>
            <div class="jwm-stat legend"><span>${krLeg}</span></div>
            ${hasMythic ? `<div class="jwm-stat mythic"><span>✦ ${krMyth}</span></div>` : ''}
        </div>`;
    });
    g.innerHTML = h;
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        document.documentElement.lang = 'ko'; document.documentElement.setAttribute('data-theme', 'dark');
        DOM.tabContent = document.getElementById('tabContent'); DOM.deductionBoard = document.getElementById('deductionBoard');
        DOM.codexTabs = document.getElementById('codexTabs'); DOM.magicDashboard = document.getElementById('magicDashboard');
        if (typeof UNIT_DATABASE === 'undefined') { console.error("[오류] 데이터베이스 로드 실패"); return; }

        UNIT_DATABASE.forEach((kArr) => { const g = kArr[1] || "매직", cat = kArr[2] || "테바테메"; unitMap.set(clean(kArr[0]), { id:clean(kArr[0]), name:kArr[0], grade:g, category:cat, recipe:kArr[3], cost:kArr[4] }); });

        initializeCacheEngine();

        renderDashboardAtoms();
        renderDeductionBoard();
        renderTabs();
        selectTab(0);
        debouncedUpdateAllPanels();

        setupSearchEngine();
        setupInitialView();

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