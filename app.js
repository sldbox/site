// app.js
/*
=============================================================================
[파일 설명서] app.js 
=============================================================================
*/

// [핵심 데이터 맵]
const unitMap = new Map(), activeUnits = new Map(), ownedUnits = new Map(), essenceUnits = new Set(), DOM = {};
const reverseRecipeMap = new Map(); // 상위 계보 역추적용 캐시 맵

// [핵심 상수 및 유틸]
const clean = s => s ? s.replace(/\s+/g, '').toLowerCase() : '';
const IGNORE_PARSE_RECIPES = ["미발견", "없음", ""];
const dashboardAtoms = ["전쟁광", "스파르타중대", "암흑광전사", "암흑파수기", "원시바퀴", "저격수", "코브라", "암흑고위기사", "암흑추적자", "변종가시지옥", "망치경호대", "공성파괴단", "암흑집정관", "암흑불멸자", "원시히드라리스크", "땅거미지뢰", "자동포탑", "우르사돈암", "우르사돈수", "갓오타/메시브"];
const EMPTY_SVG = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.2;"><rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect><line x1="3" y1="21" x2="21" y2="3"></line></svg>`;

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
                    
                    // 상위 계보 역추적 트리 빌드 (1ms 미만 소요)
                    if(childId) {
                        if(!reverseRecipeMap.has(childId)) reverseRecipeMap.set(childId, new Set());
                        reverseRecipeMap.get(childId).add(u.id);
                    }
                }
            });
        }
    });
}

function calcEssenceRecursiveFast(uid, counts, visited) {
    if(visited.has(uid)) return; visited.add(uid);
    const u = unitMap.get(uid); if(!u) return;
    if(["히든", "슈퍼히든"].includes(u.grade)) {
        if(u.category === "테바테메") counts.코랄 += 1;
        else if(u.category === "토바토메") counts.아이어 += 1;
        else if(u.category === "저그중립") counts.제루스 += 1;
        else if(u.category === "혼종") counts.혼종 += 1; 
    }
    if(u.parsedRecipe) u.parsedRecipe.forEach(pr => { if(pr.id) calcEssenceRecursiveFast(pr.id, counts, visited); });
}

function getUnitEssenceTotal(uid) {
    const u = unitMap.get(uid); if (!u || !["히든", "슈퍼히든"].includes(u.grade)) return 0;
    let counts = {코랄:0, 아이어:0, 제루스:0, 혼종:0}, visited = new Set();
    calcEssenceRecursiveFast(uid, counts, visited); 
    return counts.코랄 + counts.아이어 + counts.제루스 + (counts.혼종 * 3);
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
let _currentAppMode = 'classic'; // 'expert', 'classic', 'jewel', 'genealogy'
let _currentViewMode = 'codex';
let _activeGenealogyTabIdx = 0;
let _selectedGenealogyUnitId = null;
let _gnHistory = []; // 계보 탐색 히스토리 추적용 배열

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
function resetCodex(silent = false) { activeUnits.clear(); essenceUnits.clear(); debouncedUpdateAllPanels(); if(!silent) showToast("선택된 유닛이 초기화되었습니다."); }
function resetOwned() { ownedUnits.clear(); debouncedUpdateAllPanels(); showToast("보유 유닛이 초기화되었습니다."); }

// 초기 진입: 바로 도감 모드로 시작
function checkInitialMode() {
    const layout = document.getElementById('mainLayout');
    if (layout) layout.style.display = '';
    _currentAppMode = 'classic';
    document.getElementById('classicSearchContainer').appendChild(document.getElementById('searchWrap'));
    switchLayout('codex');
    startTitleCycle();
}

// 제목 순환 애니메이션
const _cycleTitles = ['개복디 넥서스', '제작자 | 회장', 'ID : 3-S2-1-2461127'];
let _cycleTitleIdx = 0;
function startTitleCycle() {
    const els = [document.getElementById('nexusCycleTitle'), document.getElementById('nexusCycleTitleExpert')].filter(Boolean);
    setInterval(() => {
        _cycleTitleIdx = (_cycleTitleIdx + 1) % _cycleTitles.length;
        els.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(-8px)';
            setTimeout(() => {
                el.textContent = _cycleTitles[_cycleTitleIdx];
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, 350);
        });
    }, 3000);
}

function initMode(mode, showToastMsg = true) {
    _currentAppMode = mode; 
    const layout = document.getElementById('mainLayout'), searchWrap = document.getElementById('searchWrap');
    if (layout) layout.style.display = '';
    layout.classList.remove('mode-expert', 'view-jewel', 'view-genealogy');
    if(mode === 'expert') { 
        layout.classList.add('mode-expert'); 
        document.getElementById('expertSearchContainer').appendChild(searchWrap); 
        if(showToastMsg) showToast("검색 모드가 활성화되었습니다."); 
    } else if(mode === 'classic') { 
        document.getElementById('classicSearchContainer').appendChild(searchWrap); 
        if(showToastMsg) showToast("도감 모드가 활성화되었습니다."); 
    }
    switchLayout(_currentViewMode === 'deduct' ? 'deduct' : 'codex');
}

// 쥬얼 인라인 패널 토글
let _jewelPanelOpen = false;
function toggleJewelPanel() {
    _jewelPanelOpen = !_jewelPanelOpen;
    const layout = document.getElementById('mainLayout');
    const costPanel = document.getElementById('costDashboardPanel');
    const rightPanel = document.getElementById('rightPanel'); // 차감 데시보드
    const jewelPanel = document.getElementById('jewelInlinePanel');
    const btn = document.getElementById('btnJewelToggle');
    
    if(_jewelPanelOpen) {
        layout.classList.add('view-jewel');
        costPanel.style.display = 'none';
        if(rightPanel) rightPanel.style.display = 'none'; // 차감 보드 완벽하게 숨김
        jewelPanel.style.display = 'flex';
        if(btn) { btn.innerHTML = '⬅ 돌아가기'; btn.style.borderColor='rgba(255,215,0,0.7)'; btn.style.background='rgba(255,215,0,0.1)'; }
        renderJewelMiniGrid();
    } else {
        layout.classList.remove('view-jewel');
        costPanel.style.display = '';
        if(rightPanel) rightPanel.style.display = ''; // 복구
        jewelPanel.style.display = 'none';
        if(btn) { btn.innerHTML = '✦ 쥬얼도감'; btn.style.borderColor='rgba(255,215,0,0.35)'; btn.style.background=''; }
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
    if (_currentViewMode === 'deduct') {
        switchLayout('codex');
    } else {
        switchLayout('deduct');
    }
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
        debouncedUpdateAllPanels(); showToast(`<span class="t-icon">⚡</span> ${successCount}건의 커맨드 등록 완료`);
        const inputEl = document.getElementById('unitSearchInput'); if(inputEl) inputEl.value = '';
        document.getElementById('searchResults').classList.remove('active');
        if(_currentViewMode === 'deduct') switchLayout('codex');
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
        activeUnits.delete(id); essenceUnits.delete(id);
    } else {
        const u = unitMap.get(id); const initQty = (u && u.grade === "슈퍼히든") ? 1 : (forceQty || 1);
        activeUnits.set(id, initQty); essenceUnits.add(id);
    }
    debouncedUpdateAllPanels();
}

function setUnitQty(id, val) {
    let q = parseInt(val);
    if (q === 0 || isNaN(q) || q < 1) {
        if (activeUnits.has(id)) { activeUnits.delete(id); essenceUnits.delete(id); }
        debouncedUpdateAllPanels();
        return;
    }
    const u = unitMap.get(id); if (!u || u.grade === "슈퍼히든") return;
    if (q > 16) q = 16;
    activeUnits.set(id, q); debouncedUpdateAllPanels();
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
    if (qty < 1) { activeUnits.delete(id); essenceUnits.delete(id); debouncedUpdateAllPanels(); return; }
    if (activeUnits.get(id) !== qty) { activeUnits.set(id, qty); debouncedUpdateAllPanels(); }
}

function setOwnedQty(id, val) {
    let q = parseInt(val); if (isNaN(q) || q < 0) q = 0;
    const inEl = document.getElementById(`d-in-${id}`);
    let maxQty = 99;
    if(inEl && inEl.hasAttribute('data-req')) { const reqVal = parseInt(inEl.getAttribute('data-req')); if(reqVal > 0) maxQty = reqVal; }
    if (q > maxQty) q = maxQty;
    ownedUnits.set(id, q); debouncedUpdateAllPanels();
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
    if (ownedUnits.get(id) !== qty) { ownedUnits.set(id, qty); debouncedUpdateAllPanels(); }
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

// 스로틀링된 DOM 업데이트
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
    let html = '<div class="recipe-vertical">';
    item.recipe.split(/\+(?![^()]*\))/).forEach((part) => {
        const match = part.trim().match(/^([^(\[]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/);
        if (match) {
            const rawKo = match[1].trim(), u = unitMap.get(getUnitId(rawKo));
            let condTxt = match[2] ? `(${match[2]})` : '';
            let baseQty = match[3] ? parseInt(match[3]) : 1; let finalQty = baseQty * multiplier; let qtyTxt = `[${finalQty}]`;
            const color = u && gradeColorsRaw[u.grade] ? gradeColorsRaw[u.grade] : "var(--text)";
            html += `<div class="recipe-badge" style="color:${color}; border-color:${color}44;">${rawKo} <span class="badge-cond">${condTxt}${qtyTxt}</span></div>`;
        } else { html += `<div style="color:var(--text-sub); font-size:0.85rem; white-space:nowrap;">${part}</div>`; }
    });
    return html + '</div>';
}

function formatRecipeTooltip(item, multiplier = 1) {
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
window.selectTab = selectTab;

function renderCurrentTabContent() {
    const catKey = TAB_CATEGORIES[_activeTabIdx].key;
    let items = Array.from(unitMap.values()).filter(u => ["슈퍼히든","히든","레전드"].includes(u.grade) && u.category === catKey);
    items.sort((a,b) => { if(a.grade !== b.grade) return GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade); return calculateTotalCostScore(b.cost) - calculateTotalCostScore(a.cost); });

    let h='<div style="display:flex;flex-direction:column;gap:4px;">';
    if (items.length === 0) h += `<div style="text-align:center; padding:30px; color:var(--text-sub); font-weight:bold; font-size:1.05rem;">해당 분류에 유닛이 없습니다.</div>`;

    items.forEach((item, index) => {
        const unitEssence = getUnitEssenceTotal(item.id);
        const unitCost = Math.ceil(calculateTotalCostScore(item.cost));
        
        let gradeHtml = `<span class="gtag" style="border-color:${gradeColorsRaw[item.grade]}44; color:${gradeColorsRaw[item.grade]};">${item.grade}</span>`;

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

function renderJewelMiniGrid(){
    const g=document.getElementById('jewelMiniGrid'); 
    if(!g || g.dataset.rendered) return;
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
function renderGenealogyTabs(){
    const gnTabs = document.getElementById('gnTabs');
    if (!gnTabs) return;
    let h='';
    TAB_CATEGORIES.forEach((cat,idx)=>{
        h+=`<button id="gn-tab-btn-${idx}" class="tab-btn" onclick="selectGenealogyTab(${idx})">
                <span class="tab-sym" style="font-size:1.1rem; padding:2px 5px; border-radius:3px; background:rgba(0,0,0,0.3); border:1px solid var(--border-light); color:var(--text-sub);">${cat.sym}</span>
                <span>${cat.name}</span>
            </button>`;
    });
    gnTabs.innerHTML=h;
}

function selectGenealogyTab(idx) {
    _activeGenealogyTabIdx = idx;
    TAB_CATEGORIES.forEach((_, i) => {
        const btn = document.getElementById(`gn-tab-btn-${i}`);
        if(btn) { if(i === idx) btn.classList.add('active'); else btn.classList.remove('active'); }
    });
    renderGenealogyList();
}
window.selectGenealogyTab = selectGenealogyTab;

function renderGenealogyList() {
    const gnList = document.getElementById('gnUnitList');
    if(!gnList) return;
    const catKey = TAB_CATEGORIES[_activeGenealogyTabIdx].key;
    
    let items = Array.from(unitMap.values()).filter(u => ["슈퍼히든","히든","레전드"].includes(u.grade) && u.category === catKey);
    items.sort((a,b) => { if(a.grade !== b.grade) return GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade); return calculateTotalCostScore(b.cost) - calculateTotalCostScore(a.cost); });

    if(items.length === 0) {
        gnList.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-sub); font-size:0.9rem;">해당 분류에 표시할 유닛이 없습니다.</div>`;
        return;
    }

    let h = '';
    items.forEach((u, idx) => {
        const isSelected = _selectedGenealogyUnitId === u.id;
        const color = gradeColorsRaw[u.grade];
        const delay = (idx * 0.03).toFixed(2);
        h += `<div class="gn-list-item ${isSelected ? 'active' : ''}" style="--g-color:${color}; animation-delay:${delay}s;" onclick="selectGenealogyUnit('${u.id}', true)">
                <div class="gn-li-grade" style="color:${color}; border-color:${color}44;">${u.grade}</div>
                <div class="gn-li-name">${u.name}</div>
              </div>`;
    });
    gnList.innerHTML = h;

    if(!_selectedGenealogyUnitId || !items.find(u => u.id === _selectedGenealogyUnitId)) {
        if(items.length > 0) selectGenealogyUnit(items[0].id, true);
    }
}

function selectGenealogyUnit(unitId, isRoot = false) {
    try {
        if (isRoot) {
            _gnHistory = [unitId];
        } else {
            if (_gnHistory[_gnHistory.length - 1] !== unitId) {
                _gnHistory.push(unitId);
            }
        }
        _selectedGenealogyUnitId = unitId;
        renderGenealogyList(); 
        renderGenealogyTree(unitId);
    } catch (error) {
        console.error("계보 트리 렌더링 중 오류 발생:", error);
    }
}
window.selectGenealogyUnit = selectGenealogyUnit;

window.goBackGenealogy = function() {
    if (_gnHistory.length > 1) {
        _gnHistory.pop();
        const prevId = _gnHistory[_gnHistory.length - 1];
        _selectedGenealogyUnitId = prevId;
        renderGenealogyList();
        renderGenealogyTree(prevId);
    }
};

window.jumpGenealogyHistory = function(index) {
    if (index >= 0 && index < _gnHistory.length) {
        _gnHistory = _gnHistory.slice(0, index + 1);
        const targetId = _gnHistory[_gnHistory.length - 1];
        _selectedGenealogyUnitId = targetId;
        renderGenealogyList();
        renderGenealogyTree(targetId);
    }
};

function buildGenealogyNodeHTML(unitId, role = 'lower', relationQty = 1, relationCond = '') {
    const u = unitMap.get(unitId);
    if(!u) return '';
    const color = gradeColorsRaw[u.grade] || "var(--text)";
    const imgUrl = `https://sldbox.github.io/site/image/ctg/${u.name}.png`;
    
    const unitCost = Math.ceil(calculateTotalCostScore(u.cost));
    const costHtml = unitCost > 0 ? `<div class="gn-node-cost">코스트 ${unitCost}</div>` : '';
    
    let relationHtml = '';
    const qtyTxt = relationQty > 1 ? `x${relationQty}` : '';
    const condTxt = relationCond ? `(${relationCond})` : '';
    if(qtyTxt || condTxt) {
        relationHtml = `<div class="gn-node-relation">${condTxt} <span style="color:var(--text);font-weight:900;">${qtyTxt}</span></div>`;
    }

    const fallbackSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6;"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`;

    return `<div class="gn-node ${role}" style="--n-color:${color};" onclick="selectGenealogyUnit('${u.id}')">
        ${relationHtml}
        <div class="gn-node-inner">
            <div class="gn-img-box">
                <img src="${imgUrl}" alt="${u.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="gn-img-fallback" style="display:none; color:${color};">${fallbackSvg}</div>
            </div>
            <div class="gn-node-info">
                <div class="gn-node-grade" style="color:${color};">${u.grade}</div>
                <div class="gn-node-name">${u.name}</div>
                ${costHtml}
            </div>
        </div>
    </div>`;
}

function renderGenealogyTree(unitId) {
    const area = document.getElementById('gnTreeArea');
    if(!area) return;
    const targetUnit = unitMap.get(unitId);
    if(!targetUnit) return;

    let breadcrumbHtml = '';
    if (_gnHistory.length > 1) {
        breadcrumbHtml = `<div class="gn-breadcrumb" style="display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom: 10px; width: 100%; justify-content:flex-start; background:rgba(0,0,0,0.5); padding:10px 16px; border-radius:12px; border:1px solid rgba(255,255,255,0.05); box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);">`;
        
        breadcrumbHtml += `<button onclick="goBackGenealogy()" style="background:linear-gradient(180deg, rgba(255,255,255,0.1), rgba(0,0,0,0.2)); border:1px solid rgba(255,255,255,0.1); color:#fff; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:0.85rem; font-weight:bold; margin-right:8px; display:flex; align-items:center; gap:6px; transition:all 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.5);" onmouseover="this.style.background='rgba(255,255,255,0.15)'; this.style.borderColor='rgba(255,255,255,0.3)';" onmouseout="this.style.background='linear-gradient(180deg, rgba(255,255,255,0.1), rgba(0,0,0,0.2))'; this.style.borderColor='rgba(255,255,255,0.1)';"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg> 뒤로가기</button>`;

        _gnHistory.forEach((hId, idx) => {
            const hUnit = unitMap.get(hId);
            if (!hUnit) return;
            const isLast = idx === _gnHistory.length - 1;
            const color = gradeColorsRaw[hUnit.grade] || 'var(--text)';
            
            if (!isLast) {
                breadcrumbHtml += `<span onclick="jumpGenealogyHistory(${idx})" style="color:${color}; cursor:pointer; font-size:0.9rem; font-weight:bold; opacity:0.6; transition:0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">${hUnit.name}</span>`;
                breadcrumbHtml += `<span style="color:var(--text-muted); font-size:0.8rem; font-weight:900;">></span>`;
            } else {
                breadcrumbHtml += `<span style="color:${color}; font-size:0.95rem; font-weight:900; text-shadow:0 0 8px ${color}66; padding-left:2px;">${hUnit.name}</span>`;
            }
        });
        breadcrumbHtml += `</div>`;
    }

    const upperIds = reverseRecipeMap.get(unitId);
    let upperHtml = '';
    if(upperIds && upperIds.size > 0) {
        upperHtml = `<div class="gn-tree-section">
            <div class="gn-section-title"><span style="color:var(--grade-rare);">▲</span> 상위 계보 (사용처)</div>
            <div class="gn-node-row">
                ${Array.from(upperIds).map(pid => {
                    const parentUnit = unitMap.get(pid);
                    let reqQty = 1, reqCond = '';
                    if(parentUnit && parentUnit.parsedRecipe) {
                        const recipePart = parentUnit.parsedRecipe.find(r => r.id === unitId);
                        if(recipePart) { reqQty = recipePart.qty; reqCond = recipePart.cond; }
                    }
                    return buildGenealogyNodeHTML(pid, 'upper', reqQty, reqCond);
                }).join('')}
            </div>
            <div class="gn-link-down"></div>
        </div>`;
    }

    const targetColor = gradeColorsRaw[targetUnit.grade] || "var(--text)";
    const imgUrl = `https://sldbox.github.io/site/image/ctg/${targetUnit.name}.png`;
    const fallbackSvg = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6;"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`;

    let condHtml = '';
    if(targetUnit.recipe && !IGNORE_PARSE_RECIPES.includes(targetUnit.recipe)){
        targetUnit.recipe.split(/\+(?![^()]*\))/).forEach(p => {
            const match = p.trim().match(/^([^(\[]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/);
            if(match && match[2]) {
                condHtml += `<div class="gn-cond-badge"><span class="gn-cb-name">${match[1].trim()}</span><span class="gn-cb-cond">${match[2]}</span></div>`;
            } else if(!match && p.trim() && !p.includes('[')) {
                condHtml += `<div class="gn-cond-badge" style="justify-content:center;"><span class="gn-cb-name">${p.trim()}</span></div>`;
            }
        });
    }
    if(!condHtml) condHtml = `<div style="color:var(--text-muted);font-size:0.85rem; text-align:center; padding: 10px;">특수 조건 없음</div>`;

    let counts = {코랄:0, 아이어:0, 제루스:0, 혼종:0}, visited = new Set();
    if (["히든", "슈퍼히든"].includes(targetUnit.grade)) {
        calcEssenceRecursiveFast(targetUnit.id, counts, visited);
    }
    let finalCoral = counts.코랄 + counts.혼종;
    let finalAiur = counts.아이어 + counts.혼종;
    let finalZerus = counts.제루스 + counts.혼종;
    let totalEssence = finalCoral + finalAiur + finalZerus;

    let essenceHtml = '';
    if (totalEssence > 0) {
        essenceHtml = `
        <div class="gn-detail-row">
            <div class="gn-detail-title"><span style="color:var(--grade-super);">✦</span> 필요 정수</div>
            <div class="gn-essence-grid">
                <div class="gn-es-slot"><span class="gn-es-val" style="color:#FF6B6B;">${finalCoral}</span><span class="gn-es-lbl">코랄</span></div>
                <div class="gn-es-slot"><span class="gn-es-val" style="color:var(--grade-rare);">${finalAiur}</span><span class="gn-es-lbl">아이어</span></div>
                <div class="gn-es-slot"><span class="gn-es-val" style="color:var(--grade-legend);">${finalZerus}</span><span class="gn-es-lbl">제루스</span></div>
                <div class="gn-es-slot"><span class="gn-es-val" style="color:var(--g);">${counts.혼종}</span><span class="gn-es-lbl">혼종</span></div>
                <div class="gn-es-slot total"><span class="gn-es-val">${totalEssence}</span><span class="gn-es-lbl">총합</span></div>
            </div>
        </div>`;
    }

    const unitCost = Math.ceil(calculateTotalCostScore(targetUnit.cost));
    let costMap = {};
    dashboardAtoms.forEach(a => {
        if(a === "갓오타/메시브") { costMap['갓오타'] = 0; costMap['메시브'] = 0; }
        else { costMap[clean(a)] = 0; }
    });

    if (targetUnit.parsedCost && targetUnit.parsedCost.length > 0) {
        targetUnit.parsedCost.forEach(pc => {
            let key = clean(pc.key);
            if (costMap[key] !== undefined) costMap[key] += pc.qty;
        });
    }

    let costGridHtml = '';
    dashboardAtoms.forEach(a => {
        let isSpecial = (a === "갓오타/메시브");
        let displayHtml = '';
        let isActive = false;

        if (isSpecial) {
            let g = costMap['갓오타'] || 0;
            let m = costMap['메시브'] || 0;
            isActive = (g > 0 || m > 0);
            if(isActive) {
                displayHtml = `<div style="display:flex; justify-content:center; gap:3px; font-size:0.95rem; align-items:center;"><span style="color:var(--grade-rare);">${g}</span><span style="color:#555; font-size:0.8rem;">/</span><span style="color:var(--grade-unique);">${m}</span></div>`;
            } else {
                displayHtml = `<span style="opacity:0.2;">-</span>`;
            }
        } else {
            let v = costMap[clean(a)] || 0;
            isActive = (v > 0);
            displayHtml = isActive ? v : `<span style="opacity:0.2;">-</span>`;
        }

        costGridHtml += `<div class="gn-mc-slot ${isActive ? 'active' : ''}">
            <span class="gn-mc-val">${displayHtml}</span>
            <span class="gn-mc-lbl">${a}</span>
        </div>`;
    });
    
    let costHtml = '';
    if (unitCost > 0 || totalEssence > 0) {
        costHtml = `
        <div class="gn-detail-row">
            <div class="gn-detail-title"><span style="color:var(--grade-epic);">❖</span> 코스트 데시보드 (총 ${unitCost})</div>
            <div class="gn-cost-grid">
                ${costGridHtml}
            </div>
        </div>`;
    }

    const targetHtml = `<div class="gn-tree-section target-section">
        <div class="gn-target-dashboard" style="--t-color:${targetColor};">
            <div class="gn-td-top">
                <div class="gn-td-profile">
                    <div class="gn-td-img-box" style="border-color:${targetColor}; box-shadow:0 0 15px ${targetColor}44;">
                        <img src="${imgUrl}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="gn-img-fallback" style="display:none; color:${targetColor};">${fallbackSvg}</div>
                    </div>
                    <div class="gn-td-info">
                        <div class="gn-td-grade" style="color:${targetColor}; border-color:${targetColor}66;">${targetUnit.grade}</div>
                        <div class="gn-td-name">${targetUnit.name}</div>
                    </div>
                </div>
                <div class="gn-td-conds-wrap">
                    <div class="gn-detail-title"><span style="color:var(--grade-unique);">⚠</span> 특수 조합 조건</div>
                    <div class="gn-tdd-conds">${condHtml}</div>
                </div>
            </div>
            ${essenceHtml}
            ${costHtml}
        </div>
    </div>`;

    let lowerHtml = '';
    if(targetUnit.parsedRecipe && targetUnit.parsedRecipe.length > 0) {
        lowerHtml = `<div class="gn-tree-section">
            <div class="gn-link-up"></div>
            <div class="gn-section-title"><span style="color:var(--grade-magic);">▼</span> 하위 계보 (요구 재료)</div>
            <div class="gn-node-row">
                ${targetUnit.parsedRecipe.map(pr => {
                    if(pr.id) return buildGenealogyNodeHTML(pr.id, 'lower', pr.qty, pr.cond);
                    return ''; 
                }).join('')}
            </div>
        </div>`;
    }

    area.innerHTML = `<div class="gn-tree-wrapper" style="animation: jwFadeIn 0.4s cubic-bezier(0.2,0.8,0.2,1);">
        ${breadcrumbHtml}
        ${upperHtml}
        ${targetHtml}
        ${lowerHtml}
    </div>`;
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        document.documentElement.lang = 'ko'; document.documentElement.setAttribute('data-theme', 'dark');
        DOM.tabContent = document.getElementById('tabContent'); DOM.deductionBoard = document.getElementById('deductionBoard');
        DOM.codexTabs = document.getElementById('codexTabs'); DOM.magicDashboard = document.getElementById('magicDashboard');
        if (typeof UNIT_DATABASE === 'undefined') { console.error("[오류]"); return; }
        
        UNIT_DATABASE.forEach((kArr) => { const g = kArr[1] || "매직", cat = kArr[2] || "테바테메"; unitMap.set(clean(kArr[0]), { id:clean(kArr[0]), name:kArr[0], grade:g, category:cat, recipe:kArr[3], cost:kArr[4] }); });
        
        initializeCacheEngine();
        
        renderDashboardAtoms(); 
        renderDeductionBoard(); 
        renderTabs();
        selectTab(0); 
        debouncedUpdateAllPanels();
        
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