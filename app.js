const unitMap = new Map(), activeUnits = new Map(), completedUnits = new Map(), depCache = new Map();
const getEl = (id) => document.getElementById(id);
const clean = (s) => s ? s.replace(/\s+/g, '').toLowerCase() : '';

const IGNORE_PARSE_RECIPES = ["미발견", "없음", ""];
const dashboardAtoms = [
    "전쟁광", "스파르타중대", "암흑광전사", "암흑파수기", "원시바퀴", "저격수", "코브라", "암흑고위기사",
    "암흑추적자", "변종가시지옥", "망치경호대", "공성파괴단", "암흑집정관", "암흑불멸자", "원시히드라리스크",
    "땅거미지뢰", "자동포탑", "우르사돈암", "우르사돈수", "갓오타/메시브"
];

const CLEANED_DASHBOARD_ATOMS = dashboardAtoms.map(a => ({ raw: a, clean: clean(a) }));
const ATOM_HASH = Object.fromEntries(CLEANED_DASHBOARD_ATOMS.map(a => [a.clean, a.raw]));

const ALIAS_MAP = {
    "타커":"타이커스", "타이":"타이커스", "닥템":"암흑기사", "닼템":"암흑기사", "다칸":"암흑집정관",
    "스투":"스투코프", "디젯":"디제스터", "메십":"메시브", "마랩":"마스터랩", "히페":"히페리온",
    "고전순":"고르곤전투순양함", "특레":"특공대레이너", "드레천":"드라켄레이저천공기",
    "공허":"공허포격기", "분수":"분노수호자", "원히":"원시히드라리스크", "젤나가":"아몬의젤나가피조물"
};

const CLEAN_ALIAS_MAP = Object.fromEntries(Object.entries(ALIAS_MAP).map(([k, v]) => [clean(k), clean(v)]));
if (typeof CUSTOM_ALIASES !== 'undefined') {
    Object.assign(CLEAN_ALIAS_MAP, Object.fromEntries(Object.entries(CUSTOM_ALIASES).map(([k, v]) => [clean(k), clean(v)])));
}

const SPECIAL_UNIT_IDS = ['갓오타', '메시브', '자동포탑'];
const EMPTY_SVG = `<svg class="empty-icon"><use href="#icon-empty"></use></svg>`;
const MAX_LOOP_QUEUE = 1000, MAX_LOOP_MERGE = 30, MAX_UNIT_CAPACITY = 16;
const CONFIG_SORT_ORDER = { "아몬": 100, "어두운목소리": 99, "나루드": 97, "유물": 96 };
const ONE_TIME_UNITS = ["데하카", "데하카고치", "데하카의오른팔", "유물"];
const HYBRID_WEIGHT = 3;

const isOneTime = (u) => u && (u.grade === "슈퍼히든" || ONE_TIME_UNITS.includes(u.name));
const getUnitId = (rawName) => clean(rawName);
const calculateTotalCostScore = (u) => u?.parsedCost?.reduce((sum, pc) => sum + (pc.qty || 0), 0) || 0;

function splitRecipe(recipeStr) {
    let parts = [], current = '', depth = 0;
    for (let char of recipeStr) {
        if (char === '(' || char === '[') depth++;
        else if (char === ')' || char === ']') depth = Math.max(0, depth - 1);
        if (char === '+' && depth === 0) { if (current.trim()) parts.push(current.trim()); current = ''; }
        else current += char;
    }
    if (current.trim()) parts.push(current.trim());
    if (depth > 0 && parts.length === 1 && recipeStr.includes('+')) return recipeStr.split('+').map(s => s.trim()).filter(Boolean);
    return parts;
}

function initializeCacheEngine() {
    unitMap.forEach(u => {
        u.parsedCost = [];
        if (u.cost && !IGNORE_PARSE_RECIPES.includes(u.cost)) {
            u.cost.replace(/\//g, '+').split('+').forEach(p => {
                const m = p.match(/(.+?)\[(\d+)\]/);
                let cName = clean(m ? m[1].trim() : p.trim()), qty = m ? parseInt(m[2], 10) : 1;
                let type = 'atom', key = cName;

                if (cName.includes('메시브') || cName.includes('디제스터')) { type = 'special'; key = '메시브'; }
                else if (cName.includes('갓오타') || cName.includes('갓오브타임')) { type = 'special'; key = '갓오타'; }
                else if (['땅거미지뢰', '자동포탑', '잠복'].some(k => cName.includes(k))) key = ['땅거미지뢰', '자동포탑', '잠복'].find(k => k === cName ? k : cName.includes(k));
                else key = ATOM_HASH[getUnitId(cName)] || getUnitId(cName);

                u.parsedCost.push({ type, key, qty, name: u.name });
            });
        }
        u.parsedRecipe = [];
        if (u.recipe && !IGNORE_PARSE_RECIPES.includes(u.recipe)) {
            splitRecipe(u.recipe).forEach(p => {
                const m = p.match(/^([^(\[ ]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/);
                if (m) u.parsedRecipe.push({ id: getUnitId(m[1]), qty: m[3] ? parseInt(m[3], 10) : 1, cond: m[2] || '' });
            });
        }
    });
}

function loadNexusState() {
    try {
        const data = localStorage.getItem('nexusSaveData');
        if (data) {
            const state = JSON.parse(data);
            state.active?.forEach(([k, v]) => activeUnits.set(k, v));
            state.completed?.forEach(([k, v]) => completedUnits.set(k, v));
        }
    } catch(e) { console.warn("[오류] 저장된 데이터 로드 실패", e); }
}

function saveNexusState() {
    try {
        localStorage.setItem('nexusSaveData', JSON.stringify({ active: [...activeUnits], completed: [...completedUnits] }));
    } catch(e) { console.warn("[오류] 데이터 저장 실패", e); }
}

// [개선/기획의도] 정수 계산 시 동일 재료의 중복 합산을 방지하기 위한 visited 활용 (정규 로직)
function calcEssenceRecursiveFast(uid, counts, visited) {
    if (visited.has(uid)) return; 
    visited.add(uid);
    
    const u = unitMap.get(uid); if (!u) return;

    if (["히든", "슈퍼히든"].includes(u.grade)) {
        if (["테바", "테메"].includes(u.category)) counts.코랄++;
        else if (["토바", "토메"].includes(u.category)) counts.아이어++;
        else if (["저그", "중립"].includes(u.category) && u.name !== "미니성큰") counts.제루스++;
        else if (u.category === "혼종") counts.혼종++;
    }
    u.parsedRecipe?.forEach(pr => { if (pr.id) calcEssenceRecursiveFast(pr.id, counts, visited); });
}

function getEssenceCount(sourceMap) {
    let counts = { 코랄: 0, 아이어: 0, 제루스: 0, 혼종: 0 };
    sourceMap.forEach((qty, uid) => { for(let i=0; i<qty; i++) calcEssenceRecursiveFast(uid, counts, new Set()); });
    return counts;
}

function updateEssence() {
    let tE = getEssenceCount(activeUnits), cE = getEssenceCount(completedUnits);
    let fH = Math.max(0, tE.혼종 - cE.혼종);

    const setV = (id, target, comp) => {
        let base = Math.max(0, target - comp), total = base + fH;
        let el = getEl(`val-essence-${id}`), subEl = getEl(`sub-essence-${id}`);
        if(el) {
            if(el.innerText !== String(total)) el.innerText = total;
            if(subEl) subEl.innerHTML = fH > 0 ? `<span style="opacity:0.6;">${base}</span><span style="color:var(--g); font-weight:bold;"> +${fH}</span>` : '';
            getEl(`slot-essence-${id}`)?.classList.toggle('active', total > 0);
        }
        return base;
    };

    let fC = setV('coral', tE.코랄, cE.코랄), fA = setV('aiur', tE.아이어, cE.아이어), fZ = setV('zerus', tE.제루스, cE.제루스);
    let totalEssence = fC + fA + fZ + (fH * HYBRID_WEIGHT);
    let tEl = getEl('essence-total-val');

    if (tEl) {
        tEl.innerText = totalEssence;
        getEl('slot-total-essence')?.classList.toggle('active', totalEssence > 0);
    }
}

function updateMagicDashboard() {
    let activeScore = 0, compScore = 0;
    activeUnits.forEach((qty, uid) => { activeScore += calculateTotalCostScore(unitMap.get(uid)) * qty; });
    completedUnits.forEach((qty, uid) => { compScore += calculateTotalCostScore(unitMap.get(uid)) * qty; });

    let finalTotalCost = Math.max(0, activeScore - compScore);
    if(getEl('magic-total-val')) getEl('magic-total-val').innerText = finalTotalCost;
    getEl('slot-total-magic')?.classList.toggle('active', finalTotalCost > 0);

    const tMap = {}, cMap = {};
    dashboardAtoms.forEach(a => { tMap[a] = a === "갓오타/메시브" ? {갓오타:0, 메시브:0} : 0; cMap[a] = a === "갓오타/메시브" ? {갓오타:0, 메시브:0} : 0; });

    const applyToMap = (map, uid, multi) => {
        unitMap.get(uid)?.parsedCost?.forEach(pc => {
            if (pc.type === 'special') map['갓오타/메시브'][['갓오타','메시브'].includes(pc.key)?pc.key:'갓오타'] += pc.qty * multi;
            else map[pc.key] = (map[pc.key] || 0) + pc.qty * multi;
        });
    };

    activeUnits.forEach((c, k) => applyToMap(tMap, k, c));
    completedUnits.forEach((c, k) => {
        if(c <= 0) return;
        let atom = CLEANED_DASHBOARD_ATOMS.find(a => a.clean === k)?.raw;
        if(atom && atom !== '갓오타/메시브') cMap[atom] = (cMap[atom] || 0) + c;
        else if(k === '갓오타' || k === '메시브') cMap['갓오타/메시브'][k] += c;
        else applyToMap(cMap, k, c);
    });

    dashboardAtoms.forEach(a => {
        const container = getEl(`vslot-${clean(a)}`), e = container?.querySelector('.cost-val'), nEl = container?.querySelector('.cost-name');
        if (!container || !e || !nEl) return;

        if (a === "갓오타/메시브") {
            let fG = Math.max(0, tMap[a].갓오타 - cMap[a].갓오타), fM = Math.max(0, tMap[a].메시브 - cMap[a].메시브);
            if (fG > 0 || fM > 0) {
                if (e.innerHTML === EMPTY_SVG || e.innerHTML === '') e.innerHTML = `<div class="sp-wrap" style="display:flex; width:100%; height:100%;"><div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; border-right:1px solid rgba(251,191,36,0.3);"><span class="sp-val-g" style="font-size:1.8rem; font-weight:900; color:var(--grade-rare); line-height:1; margin-bottom:4px; text-shadow:0 0 10px rgba(251,191,36,0.5);"></span><span style="font-size:0.7rem; color:rgba(255,255,255,0.7); letter-spacing:-0.5px;">갓오타</span></div><div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center;"><span class="sp-val-m" style="font-size:1.8rem; font-weight:900; color:var(--grade-rare); line-height:1; margin-bottom:4px; text-shadow:0 0 10px rgba(251,191,36,0.5);"></span><span style="font-size:0.7rem; color:rgba(255,255,255,0.7); letter-spacing:-0.5px;">메시브</span></div></div>`;
                const spG = e.querySelector('.sp-val-g'), spM = e.querySelector('.sp-val-m');
                if (spG) spG.innerText = fG; if (spM) spM.innerText = fM;
                nEl.style.display = 'none'; container.classList.add('active');
            } else { e.innerHTML = EMPTY_SVG; nEl.style.display = 'block'; container.classList.remove('active'); }
        } else {
            let fV = Math.max(0, tMap[a] - cMap[a]);
            if (fV > 0) {
                if(e.innerText !== String(fV)) e.innerText = fV;
                nEl.style.display = 'block'; container.classList.add('active');
            } else { e.innerHTML = EMPTY_SVG; nEl.style.display = 'block'; container.classList.remove('active'); }
        }
    });
}

let _activeTabIdx = 0, _currentViewMode = 'codex', _currentHighlight = null;
const GRADE_ORDER = ["매직", "레어", "에픽", "유니크", "헬", "레전드", "히든", "슈퍼히든"];
const gradeColorsRaw = {"매직":"var(--grade-magic)", "레어":"var(--grade-rare)", "에픽":"var(--grade-epic)", "유니크":"var(--grade-unique)", "헬":"var(--grade-hell)", "레전드":"var(--grade-legend)", "히든":"var(--grade-hidden)", "슈퍼히든":"var(--grade-super)"};
const getGradeIndex = (grade) => { let i = GRADE_ORDER.indexOf(grade); return i !== -1 ? i : -99; };

const TAB_CATEGORIES = [
    {key:"테바", name:"테바", sym:"♆"}, {key:"테메", name:"테메", sym:"♆"},
    {key:"토바", name:"토바", sym:"⟡"}, {key:"토메", name:"토메", sym:"⟡"},
    {key:"저그", name:"저그", sym:"☣︎"}, {key:"중립", name:"중립", sym:"❂"}, {key:"혼종", name:"혼종", sym:"⌬"}
];

function triggerHaptic() { navigator.vibrate?.(15); }
function resetCodex(silent = false) { activeUnits.clear(); completedUnits.clear(); toggleHighlight(null); debouncedUpdateAllPanels(); if(!silent) showToast("목표 유닛이 초기화되었습니다."); }
function resetCompleted() { completedUnits.clear(); debouncedUpdateAllPanels(); showToast("완료 기록이 모두 초기화되었습니다."); }
function setupInitialView() { switchLayout('codex'); startTitleCycle(); }

const _cycleTitles = ['개복디 넥서스', '제작자 | 회장', 'ID : 3-S2-1-2461127'];
let _cycleTitleIdx = 0, _titleInterval = null, _jewelPanelOpen = false;

function startTitleCycle() {
    const el = getEl('nexusCycleTitle');
    if (!el) return;
    clearInterval(_titleInterval);
    _titleInterval = setInterval(() => {
        _cycleTitleIdx = (_cycleTitleIdx + 1) % _cycleTitles.length;
        el.classList.add('cycle-fade-out');
        setTimeout(() => { el.textContent = _cycleTitles[_cycleTitleIdx]; el.classList.remove('cycle-fade-out'); }, 350);
    }, 3000);
}

window.toggleJewelPanel = () => {
    const layout = getEl('mainLayout');
    if (layout?.classList.contains('view-jewel')) closeJewelPanel();
    else if (layout) { layout.classList.add('view-jewel'); getEl('btnJewelToggle')?.setAttribute('aria-expanded', 'true'); _jewelPanelOpen = true; renderJewelMiniGrid(); }
};

window.closeJewelPanel = () => { getEl('mainLayout')?.classList.remove('view-jewel'); getEl('btnJewelToggle')?.setAttribute('aria-expanded', 'false'); _jewelPanelOpen = false; };

function switchLayout(mode) {
    const layout = getEl('mainLayout'), btn = getEl('btnToggleMode');
    if (!layout || !btn) return;
    _currentViewMode = mode; layout.classList.remove('view-deduct', 'view-jewel'); _jewelPanelOpen = false;
    if (mode === 'deduct') {
        layout.classList.add('view-deduct'); btn.classList.remove('active'); btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = '<span class="toggle-icon" aria-hidden="true">◧</span> 도감 모드 전환';
    } else {
        btn.classList.add('active'); btn.setAttribute('aria-expanded', 'true');
        btn.innerHTML = '<span class="toggle-icon" aria-hidden="true">◨</span> 체크리스트 전환';
    }
}
function toggleViewMode() { switchLayout(_currentViewMode === 'deduct' ? 'codex' : 'deduct'); }

function setupSearchEngine() {
    getEl('unitSearchInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); processCommand(e.target.value); } });
}

function findUnitFlexible(rawName) {
    let searchTarget = CLEAN_ALIAS_MAP[clean(rawName)] || clean(rawName), exactMatch = null, prefixMatch = null;
    if(!searchTarget) return null;
    
    for (let [id, u] of unitMap) {
        // [개선/기획의도] 레전드 미만 하위 등급 유닛 및 특수 유닛은 보드에 직접 추가하지 못하도록 검색 대상에서 명시적으로 제외
        const isTargetGrade = ["슈퍼히든", "히든", "레전드"].includes(u.grade);
        const isExcludedUnit = ['데하카고치', '데하카의오른팔'].includes(id);
        
        if (!isTargetGrade || isExcludedUnit) continue;
        
        if (id === searchTarget) { exactMatch = u; break; }
        if (!prefixMatch && id.startsWith(searchTarget) && !(searchTarget === '아몬' && id === '아몬의젤나가피조물')) prefixMatch = u;
    }
    return exactMatch || prefixMatch;
}

function processCommand(val) {
    if (!val.trim()) return;
    let successCount = 0;
    val.split('/').filter(c => c.trim()).forEach(cmd => {
        let parts = cmd.split('*'), targetName = parts[0].trim();
        if (!targetName) return;
        let qtyRaw = parts.length > 1 ? parseInt(parts[1], 10) : 1;
        let qty = (isNaN(qtyRaw) || qtyRaw < 1) ? 1 : Math.min(qtyRaw, MAX_UNIT_CAPACITY);
        const match = findUnitFlexible(targetName);
        if (match) { activeUnits.set(match.id, isOneTime(match) ? 1 : Math.min((activeUnits.get(match.id) || 0) + qty, MAX_UNIT_CAPACITY)); successCount++; }
    });
    if (successCount > 0) {
        debouncedUpdateAllPanels();
        showToast(`<span class="t-icon" aria-hidden="true">⚡</span> ${successCount}건 커맨드 등록 완료`);
        if(getEl('unitSearchInput')) getEl('unitSearchInput').value = '';
        if (_currentViewMode === 'deduct') switchLayout('codex');
    } else showToast(`<span class="t-icon" aria-hidden="true">⚠</span> 유효한 유닛을 찾을 수 없습니다.`, true);
}

function showToast(msg, isError = false) {
    const container = getEl('toastContainer');
    if (!container) return;
    if (container.children.length >= 4) {
        let f = container.firstChild; f.classList.add('hiding');
        setTimeout(() => f.remove(), 350);
    }
    const t = document.createElement('div');
    t.className = `toast ${isError ? 'error' : ''}`; t.innerHTML = msg; container.appendChild(t);
    setTimeout(() => { t.classList.add('hiding'); setTimeout(() => t.remove(), 350); }, 2100);
}

window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        if (getEl('noticeModal')?.style.display === 'flex') return closeNoticeModal();
        hideRecipeTooltip(); if (getEl('mainLayout')?.classList.contains('view-jewel')) closeJewelPanel();
        if (document.activeElement === getEl('unitSearchInput')) getEl('unitSearchInput').blur();
    }
});
window.addEventListener('orientationchange', hideRecipeTooltip);
document.addEventListener('click', e => {
    if (_currentHighlight && !e.target.closest('.deduct-slot') && !e.target.closest('.d-reason-tag') && !e.target.closest('#recipeTooltip')) toggleHighlight(null);
    if (e.target.id === 'noticeModal') closeNoticeModal();
});

let _previousFocus = null;
window.openNoticeModal = () => { _previousFocus = document.activeElement; const m = getEl('noticeModal'); if(m) { m.style.display = 'flex'; m.focus(); m.addEventListener('keydown', trapModalFocus); } };
window.closeNoticeModal = () => { const m = getEl('noticeModal'); if(m) { m.style.display = 'none'; m.removeEventListener('keydown', trapModalFocus); } if(_previousFocus) _previousFocus.focus(); };
function trapModalFocus(e) { if (e.key === 'Escape') closeNoticeModal(); }

/* (Guide Logic Preserved for Compatibility) */
let _guideStepIdx = 0, _resizeTimer = null, _guideBackupActive = new Map(), _guideBackupCompleted = new Map();
let _currentGuideSteps = [], _guideDemoUnitId = '비밀작전노바', _guideDemoChildId = '자동포탑', _autoGuideTimer = null, _autoActionTimer = null;

const getGuideSteps = () => [{id:'jewel', targetId:'jewelPanel', text:'💎 <b>쥬얼 도감</b><br>상단 버튼을 통해 진입할 수 있으며, 인게임 쥬얼들의 옵션과 정보를 넓은 화면에서 한눈에 확인할 수 있습니다.', onEnter:()=> { if(!_jewelPanelOpen) toggleJewelPanel(); }}, {id:'search', targetId:'searchWrap', text:'🔍 <b>검색 및 커맨드</b><br>원하는 유닛을 검색하거나 단축 커맨드(예: 저격수*8/아몬/전쟁광*4)를 입력해 빠르게 목표에 추가할 수 있습니다.', onEnter:()=> { if(_jewelPanelOpen) closeJewelPanel(); if(_currentViewMode !== 'codex') switchLayout('codex'); }}, {id:'click-unit', targetId:_guideDemoUnitId?`card-${_guideDemoUnitId}`:'tabContent', fallbackId:'tabContent', text:`📖 <b>도감 및 유닛 추가</b><br>아래 도감에서 <b>${unitMap.get(_guideDemoUnitId)?.name||'유닛'}</b> 카드를 <b>직접 클릭</b>해서 목표 보드에 추가해 보세요!`, isWaitAction:true, onEnter:()=> { if(_currentViewMode !== 'codex') switchLayout('codex'); let catIdx = TAB_CATEGORIES.findIndex(c => c.key === unitMap.get(_guideDemoUnitId)?.category); if(catIdx !== -1 && _activeTabIdx !== catIdx) selectTab(catIdx); }, action:()=> { if(_guideDemoUnitId) toggleUnitSelection(_guideDemoUnitId, 1); }}, {id:'cost-dashboard', targetId:'costDashboardPanel', text:`🔮 <b>코스트 전체 조망</b><br>방금 <b>직접 추가한</b> 목표 유닛의 필요 자원이 대시보드 전체에 <b>즉시 계산</b>되어 나타납니다.`}, {id:'switch-mode', targetId:'btnToggleMode', text:'🔄 <b>체크리스트 모드 진입</b><br>화면 상단의 <b>[체크리스트 전환]</b> 버튼을 <b>직접 눌러서</b> 조립 모드로 진입해 보세요.', isWaitAction:true, action:()=>toggleViewMode()}, {id:'click-complete', targetId:_guideDemoChildId?`d-slot-wrap-${_guideDemoChildId}`:'deductionBoard', fallbackId:'deductionBoard', text:`✅ <b>재료 완료 처리</b><br>하위 재료를 확보했다면 완료 처리를 합니다.<br><b>${unitMap.get(_guideDemoChildId)?.name||'재료'}</b>의 <b>[✔ 완료]</b> 버튼을 <b>직접 눌러보세요!</b>`, isWaitAction:true, onEnter:()=>{ if(_currentViewMode !== 'deduct') switchLayout('deduct'); }, action:()=> { if(_guideDemoChildId) completeUnit(_guideDemoChildId); }}, {id:'auto-deduct', targetId:'costDashboardPanel', text:`📉 <b>실시간 자동 차감</b><br>보시다시피 방금 완료 처리된 ${unitMap.get(_guideDemoChildId)?.name||'재료'}의 코스트만큼 대시보드 전체 코스트가 정확히 <b>차감되어 실시간 반영</b>되었습니다!<br>이제 튜토리얼을 종료합니다.`, onEnter:()=>{ if(_currentViewMode !== 'deduct') switchLayout('deduct'); getEl('costDashboardPanel')?.classList.add('cost-reduction-flash'); setTimeout(()=>getEl('costDashboardPanel')?.classList.remove('cost-reduction-flash'), 1000); }}];

window.startGuideTour = () => {
    clearTimeout(_autoGuideTimer); clearTimeout(_autoActionTimer);
    if (window.innerWidth < 1200) return showToast("모바일 환경에서는 가이드를 지원하지 않습니다.", true);
    _guideBackupActive = new Map(activeUnits); _guideBackupCompleted = new Map(completedUnits);
    activeUnits.clear(); completedUnits.clear(); debouncedUpdateAllPanels();

    let demo = unitMap.has('비밀작전노바') ? unitMap.get('비밀작전노바') : Array.from(unitMap.values()).find(u => (u.grade==='유니크'||u.grade==='에픽'||u.grade==='레전드') && u.parsedRecipe?.length > 0 && u.id!=='자동포탑');
    if (demo) { _guideDemoUnitId = demo.id; _guideDemoChildId = demo.parsedRecipe.find(r => r.id && !['갓오타','메시브'].includes(r.id))?.id || null; }

    _currentGuideSteps = getGuideSteps(); _guideStepIdx = 0;
    ['guideBlocker', 'guideHighlight', 'guideTooltip'].forEach(id => getEl(id).style.display = 'block');
    window.addEventListener('resize', handleGuideResize); window.addEventListener('scroll', handleGuideResize, {passive: true});
    setTimeout(() => showGuideStep(), 50);
};

window.endGuideTour = () => {
    clearTimeout(_autoGuideTimer); clearTimeout(_autoActionTimer); clearTimeout(_resizeTimer);
    _autoGuideTimer = _autoActionTimer = null;
    ['guideBlocker', 'guideHighlight', 'guideClickCatcher', 'guideTooltip'].forEach(id => getEl(id).style.display = 'none');
    window.removeEventListener('resize', handleGuideResize); window.removeEventListener('scroll', handleGuideResize);
    activeUnits.clear(); _guideBackupActive.forEach((v, k) => activeUnits.set(k, v));
    completedUnits.clear(); _guideBackupCompleted.forEach((v, k) => completedUnits.set(k, v));
    debouncedUpdateAllPanels();
    if (_jewelPanelOpen) closeJewelPanel();
    if (_currentViewMode === 'deduct') switchLayout('codex');
    showToast("가이드 종료. 이전 상태로 복구되었습니다. ✔");
};

window.nextGuideStep = () => { clearTimeout(_autoGuideTimer); clearTimeout(_autoActionTimer); _guideStepIdx++; _guideStepIdx >= _currentGuideSteps.length ? endGuideTour() : showGuideStep(); };

function showGuideStep() {
    let step = _currentGuideSteps[_guideStepIdx]; step.onEnter?.(step); getEl('guideTooltip').style.opacity = '0';
    requestAnimationFrame(() => setTimeout(() => { positionGuideHighlight(step); getEl('guideTooltip').style.opacity = '1'; }, 150));
}

function positionGuideHighlight(step) {
    let target = getEl(step?.targetId) || getEl(step?.fallbackId);
    if (!target) {
         let hl = getEl('guideHighlight'); hl.style.width = hl.style.height = '0';
         getEl('guideText').innerHTML = step.text; getEl('btnGuideNext').style.display = 'block'; getEl('btnGuideNext').innerText = _guideStepIdx === _currentGuideSteps.length - 1 ? '가이드 종료 ✔' : '다음 ➔';
         clearTimeout(_autoGuideTimer); clearTimeout(_autoActionTimer); _autoGuideTimer = setTimeout(() => nextGuideStep(), 4000); return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
        let rect = target.getBoundingClientRect(), hl = getEl('guideHighlight'), tt = getEl('guideTooltip'), catcher = getEl('guideClickCatcher'), pad = 8;
        hl.style.top = `${rect.top + window.scrollY - pad}px`; hl.style.left = `${rect.left + window.scrollX - pad}px`; hl.style.width = `${rect.width + pad * 2}px`; hl.style.height = `${rect.height + pad * 2}px`;
        getEl('guideText').innerHTML = step.text;

        if (step.isWaitAction) {
            catcher.style.top = hl.style.top; catcher.style.left = hl.style.left; catcher.style.width = hl.style.width; catcher.style.height = hl.style.height; catcher.style.display = 'block';
            catcher.onclick = () => { clearTimeout(_autoGuideTimer); clearTimeout(_autoActionTimer); catcher.style.display = 'none'; step.action?.(); setTimeout(nextGuideStep, 250); };
            getEl('btnGuideNext').style.display = 'block'; getEl('btnGuideNext').innerText = '다음 ➔';
        } else {
            catcher.style.display = 'none'; getEl('btnGuideNext').style.display = 'block'; getEl('btnGuideNext').innerText = _guideStepIdx === _currentGuideSteps.length - 1 ? '가이드 종료 ✔' : '다음 ➔';
        }

        tt.style.display = 'block'; let ttW = tt.getBoundingClientRect().width || 320, ttH = tt.getBoundingClientRect().height || 150;
        let ttTop = rect.bottom + window.scrollY + pad + 20, ttLeft = rect.left + window.scrollX + (rect.width / 2) - (ttW / 2);
        if (rect.height > window.innerHeight * 0.4) {
            if (rect.left > ttW + 20) { ttLeft = rect.left + window.scrollX - ttW - 20; ttTop = rect.top + window.scrollY + (rect.height / 2) - (ttH / 2); }
            else if (window.innerWidth - rect.right > ttW + 20) { ttLeft = rect.right + window.scrollX + 20; ttTop = rect.top + window.scrollY + (rect.height / 2) - (ttH / 2); }
        } else if (ttTop + ttH > window.scrollY + window.innerHeight) ttTop = rect.top + window.scrollY - pad - ttH - 20;

        let screenMargin = 15; ttLeft = Math.max(screenMargin, Math.min(ttLeft, window.innerWidth - ttW - screenMargin)); ttTop = Math.max(window.scrollY + screenMargin, ttTop);
        tt.style.top = `${ttTop}px`; tt.style.left = `${ttLeft}px`;

        clearTimeout(_autoGuideTimer); clearTimeout(_autoActionTimer);
        let autoDelay = 4000;
        if (step.isWaitAction) _autoGuideTimer = setTimeout(() => { catcher.style.display = 'none'; step.action?.(); _autoActionTimer = setTimeout(nextGuideStep, 600); }, autoDelay);
        else _autoGuideTimer = setTimeout(() => nextGuideStep(), autoDelay + (_guideStepIdx === _currentGuideSteps.length - 1 ? 1500 : 0));
    }, 150);
}

function handleGuideResize() { clearTimeout(_resizeTimer); _resizeTimer = setTimeout(() => { if (getEl('guideHighlight')?.style.display === 'block') positionGuideHighlight(_currentGuideSteps[_guideStepIdx]); }, 50); }

let repeatTimer = null, repeatDelayTimer = null, _lastInteractionTime = 0, _currentAccelInterval = 80, _touchHoldCount = 0;
function startSmartChange(id, delta, type, event) {
    if (event?.cancelable) {
        if (event.type === 'touchstart' || event.type === 'pointerdown') _lastInteractionTime = Date.now();
        else if (event.type === 'mousedown') { if (Date.now() - _lastInteractionTime < 300) return; event.preventDefault(); event.stopPropagation?.(); }
    }
    stopSmartChange(); triggerHaptic(); _touchHoldCount = 0;
    const action = () => {
        let accelDelta = delta * (event?.shiftKey ? 5 : (Math.floor(++_touchHoldCount / 6) + 1));
        let current = activeUnits.get(id) || 0;
        if (current === 0 && accelDelta > 0) toggleUnitSelection(id, accelDelta); else setUnitQty(id, current + accelDelta);
    };
    action(); _currentAccelInterval = 80;
    const loop = () => { triggerHaptic(); action(); _currentAccelInterval = Math.max(20, _currentAccelInterval - 5); repeatTimer = setTimeout(loop, _currentAccelInterval); };
    repeatDelayTimer = setTimeout(loop, 400);
}

function stopSmartChange() { clearTimeout(repeatDelayTimer); clearTimeout(repeatTimer); _touchHoldCount = 0; }
['pointerup', 'pointercancel', 'touchend', 'touchcancel', 'mouseup', 'mouseleave', 'contextmenu'].forEach(evt => document.addEventListener(evt, stopSmartChange));

function showRecipeTooltip(id, event, isDeduction = false) {
    event?.stopPropagation(); const u = unitMap.get(id), tt = getEl('recipeTooltip'); if (!u || !tt) return;
    let multi = isDeduction ? parseInt(getEl(`d-req-${id}`)?.innerText || 0) : 1; multi = multi > 1 ? multi : 1;
    tt.innerHTML = `<div class="tooltip-header" style="color:${gradeColorsRaw[u.grade]}">${u.name} 조합법 ${multi > 1 ? `<span style="font-size:0.8rem; color:var(--text-sub);">(${multi}개 기준)</span>` : ''}</div><div class="tooltip-body">${formatRecipeTooltip(u, multi)}</div><div class="tooltip-footer">화면 터치/클릭 시 닫힙니다.</div>`;
    let viewWidth = document.documentElement.clientWidth; tt.style.maxWidth = `${viewWidth - 20}px`; tt.classList.add('active');
    let x = (event?.clientX || event?.touches?.[0]?.clientX || viewWidth/2) + window.scrollX, y = (event?.clientY || event?.touches?.[0]?.clientY || window.innerHeight/2) + window.scrollY;
    let ttRect = tt.getBoundingClientRect(), ttWidth = ttRect.width || 300, ttHeight = ttRect.height || 150;
    tt.style.left = `${Math.max(window.scrollX + 10, Math.min(x, viewWidth + window.scrollX - ttWidth - 15))}px`;
    tt.style.top = `${Math.max(window.scrollY + 10, Math.min(y, window.innerHeight + window.scrollY - ttHeight - 15))}px`;
}
function hideRecipeTooltip() { getEl('recipeTooltip')?.classList.remove('active'); }
document.addEventListener('click', hideRecipeTooltip); document.addEventListener('touchstart', hideRecipeTooltip);

function toggleUnitSelection(id, forceQty) {
    if (activeUnits.has(id)) activeUnits.delete(id); else activeUnits.set(id, isOneTime(unitMap.get(id)) ? 1 : Math.min(forceQty || 1, MAX_UNIT_CAPACITY));
    debouncedUpdateAllPanels();
}

function setUnitQty(id, val) {
    let q = parseInt(val, 10);
    if (q === 0 || isNaN(q) || q < 1) activeUnits.delete(id);
    else if(unitMap.get(id) && !isOneTime(unitMap.get(id))) activeUnits.set(id, Math.min(q, MAX_UNIT_CAPACITY));
    debouncedUpdateAllPanels();
}

function getDependencies(uid) {
    if (depCache.has(uid)) return depCache.get(uid);
    let deps = new Set([uid]);
    const u = unitMap.get(uid);
    if (u) {
        u.parsedRecipe?.forEach(child => { if (child.id) getDependencies(child.id).forEach(d => deps.add(d)); });
        u.parsedCost?.forEach(pc => { if (['갓오타', '메시브'].includes(pc.key)) deps.add(pc.key); });
    }
    depCache.set(uid, deps);
    return deps;
}

function toggleHighlight(uid, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const board = getEl('deductionBoard'); if (!board) return;
    document.querySelectorAll('.deduct-slot').forEach(el => el.classList.remove('highlighted-tree'));
    if (!uid || _currentHighlight === uid) { _currentHighlight = null; board.classList.remove('highlight-mode'); return; }
    _currentHighlight = uid; board.classList.add('highlight-mode');
    getDependencies(uid).forEach(depId => getEl(`d-slot-wrap-${depId}`)?.classList.add('highlighted-tree'));
}

function calculateDeductedRequirements() {
    let reqMap = new Map(), baseMap = new Map(), reasonMap = new Map(), deficits = new Map(), baseDeficits = new Map(), rootTracking = new Map();
    let specialReq = { 갓오타: 0, 메시브: 0 }, baseSpecialReq = { 갓오타: 0, 메시브: 0 }, specialReason = { 갓오타: new Map(), 메시브: new Map() };

    activeUnits.forEach((qty, uid) => { deficits.set(uid, (deficits.get(uid) || 0) + qty); baseDeficits.set(uid, (baseDeficits.get(uid) || 0) + qty); rootTracking.set(uid, new Map([[uid, { id: uid, text: '목표 유닛', cond: '' }]])); });

    const processQueueLoop = (queueArr, defMap, updateRoots) => {
        let queue = [...queueArr], queueSet = new Set(queue), guard = 0;
        while (queue.length > 0) {
            if (guard++ >= MAX_LOOP_QUEUE) break;
            let currentLevel = [...queue]; queue = []; queueSet.clear();
            currentLevel.forEach(uid => {
                let needed = defMap.get(uid) || 0;
                if (!unitMap.has(uid) || needed <= 0) return;
                if (updateRoots) needed -= Math.min(completedUnits.get(uid) || 0, needed);
                if (uid === '로리스완') { let toolNeed = needed > 0 ? 1 : 0; if (toolNeed > (defMap.get('낮까마귀') || 0)) { defMap.set('낮까마귀', toolNeed); if (!queueSet.has('낮까마귀')) { queue.push('낮까마귀'); queueSet.add('낮까마귀'); } } }
                if (needed > 0 && unitMap.get(uid).parsedRecipe) {
                    unitMap.get(uid).parsedRecipe.forEach(child => {
                        if (!child.id || !unitMap.has(child.id)) return;
                        let isTool = (uid === '로리스완' && child.id === '낮까마귀');
                        if (updateRoots) {
                            let cRoots = rootTracking.get(child.id) || new Map(); rootTracking.set(child.id, cRoots);
                            rootTracking.get(uid)?.forEach((_, rId) => cRoots.set(rId, { id: rId, text: isTool ? `${unitMap.get(rId)?.name || rId} <span style="margin-left:4px; font-size:0.75rem; color:#10b981; font-weight:900;">[도구]</span>` : `${unitMap.get(rId)?.name || rId} 재료`, cond: child.cond }));
                        }
                        if (!isTool) { defMap.set(child.id, (defMap.get(child.id) || 0) + needed * child.qty); if (!queueSet.has(child.id)) { queue.push(child.id); queueSet.add(child.id); } }
                    });
                }
            });
        }
    };

    processQueueLoop(Array.from(activeUnits.keys()), baseDeficits, false);
    processQueueLoop(Array.from(activeUnits.keys()), deficits, true);

    baseDeficits.forEach((val, k) => { if (val > 0) baseMap.set(k, val); });
    deficits.forEach((needed, uid) => { if (needed > 0) reqMap.set(uid, Math.max(0, needed - (completedUnits.get(uid) || 0))); });

    const updateSpecials = (map, reqObj, isBase) => map.forEach((needed, uid) => unitMap.get(uid)?.parsedCost?.forEach(pc => { if (['갓오타', '메시브'].includes(pc.key)) { reqObj[pc.key] += pc.qty * needed; if (!isBase && activeUnits.has(uid)) specialReason[pc.key].set(uid, { text: `${unitMap.get(uid).name} 재료`, cond: '' }); } }));
    updateSpecials(baseDeficits, baseSpecialReq, true); updateSpecials(deficits, specialReq, false);

    ['갓오타', '메시브'].forEach(k => specialReq[k] = Math.max(0, specialReq[k] - (completedUnits.get(k) || 0)));
    rootTracking.forEach((rMap, cId) => reasonMap.set(cId, activeUnits.has(cId) ? new Map([[cId, { text: '목표 유닛', cond: '' }]]) : rMap));

    return { reqMap, baseMap, reasonMap, specialReq, baseSpecialReq, specialReason };
}

function attemptAutoMerge() {
    let merged = false, loopCount = 0;
    do {
        merged = false; if (loopCount++ >= MAX_LOOP_MERGE) break;
        let { reqMap } = calculateDeductedRequirements();
        unitMap.forEach((u, uid) => {
            if (activeUnits.has(uid) || !u.parsedRecipe?.length || (reqMap.get(uid) || 0) <= 0) return;
            let maxCraftable = Number.MAX_SAFE_INTEGER, hasValidRecipe = false;
            const check = (id, qty, isTool) => { hasValidRecipe = true; let comp = completedUnits.get(id) || 0; if (isTool) { if (comp < 1) maxCraftable = 0; } else maxCraftable = Math.min(maxCraftable, Math.floor(comp / qty)); };
            u.parsedRecipe.forEach(child => child.id && check(child.id, child.qty, uid === '로리스완' && child.id === '낮까마귀'));
            u.parsedCost?.forEach(pc => ['갓오타', '메시브'].includes(pc.key) && check(pc.key, pc.qty, false));
            let mergeAmount = Math.min(hasValidRecipe ? maxCraftable : 0, reqMap.get(uid));
            if (mergeAmount > 0) {
                u.parsedRecipe.forEach(child => { if (child.id && !(uid === '로리스완' && child.id === '낮까마귀')) completedUnits.set(child.id, (completedUnits.get(child.id) || 0) - (child.qty * mergeAmount)); });
                u.parsedCost?.forEach(pc => { if (['갓오타', '메시브'].includes(pc.key)) completedUnits.set(pc.key, (completedUnits.get(pc.key) || 0) - (pc.qty * mergeAmount)); });
                completedUnits.set(uid, (completedUnits.get(uid) || 0) + mergeAmount); merged = true;
            }
        });
    } while (merged);
}

function consumeCompletedRecipe(uid, multiplier) {
    const u = unitMap.get(uid); if (!u) return;
    u.parsedRecipe?.forEach(child => {
        if (child.id && !(uid === '로리스완' && child.id === '낮까마귀')) {
            let needed = child.qty * multiplier, comp = completedUnits.get(child.id) || 0, consume = Math.min(needed, comp);
            if (consume > 0) completedUnits.set(child.id, comp - consume);
            if (needed - consume > 0) consumeCompletedRecipe(child.id, needed - consume);
        }
    });
    u.parsedCost?.forEach(pc => {
        if (['갓오타', '메시브'].includes(pc.key)) {
            let needed = pc.qty * multiplier, comp = completedUnits.get(pc.key) || 0, consume = Math.min(needed, comp);
            if (consume > 0) completedUnits.set(pc.key, comp - consume);
        }
    });
}

let _completeLock = new Set();
window.completeUnit = (uid) => {
    if (_completeLock.has(uid)) return; _completeLock.add(uid);
    const reqVal = parseInt(getEl(`d-req-${uid}`)?.innerText || 0);
    if (reqVal > 0) { consumeCompletedRecipe(uid, reqVal); completedUnits.set(uid, (completedUnits.get(uid) || 0) + reqVal); toggleHighlight(null); attemptAutoMerge(); triggerHaptic(); debouncedUpdateAllPanels(); }
    setTimeout(() => _completeLock.delete(uid), 250);
};

function renderActiveRoster() {
    getEl('activeRoster').innerHTML = Array.from(activeUnits.entries()).map(([id, qty]) => {
        const u = unitMap.get(id); return u ? `<div class="roster-tag" onclick="toggleUnitSelection('${id}')" style="border-color:${gradeColorsRaw[u.grade]}66;"><span style="color:${gradeColorsRaw[u.grade]}; font-weight:bold;">${u.name}</span><span class="roster-qty">×${qty}</span></div>` : '';
    }).join('') || '<span style="color:var(--text-muted); font-size:0.85rem;">선택된 유닛 대기열 (검색 후 엔터)</span>';
}

let updateTimer = null;
function debouncedUpdateAllPanels() {
    if (updateTimer) cancelAnimationFrame(updateTimer);
    updateTimer = requestAnimationFrame(() => { updateMagicDashboard(); updateEssence(); updateTabsUI(); updateTabContentUI(); updateDeductionBoard(); renderActiveRoster(); saveNexusState(); });
}

function renderDeductionBoard() {
    const renderSlot = (id, n, g, pid) => `<div class="deduct-slot" id="d-slot-wrap-${id}" data-orig-parent="${pid}" style="display:none;" onclick="toggleHighlight('${id}', event)"><div class="d-reason-wrap" id="d-reason-${id}" style="display:none;"></div><div class="d-name" style="color:${gradeColorsRaw[g]||'var(--text)'}; cursor:help;" onclick="showRecipeTooltip('${id}', event, true)"><span class="gtag" style="border-color:${gradeColorsRaw[g]}44; color:${gradeColorsRaw[g]}; margin-right:6px;">${g}</span>${n}</div><div id="d-cond-${id}" style="display:none; text-align:center; font-size:0.8rem; color:#fde047; font-weight:bold; margin-top:2px; margin-bottom:6px; letter-spacing:-0.5px; word-break:keep-all;"></div><div class="d-bottom-area" style="position:relative; padding:10px 12px; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.4); border-top:1px solid rgba(255,255,255,0.05);"><div class="req-text" style="font-family:var(--font-mono); font-size:1.2rem; color:#fbbf24; font-weight:900; text-shadow:0 1px 3px rgba(0,0,0,1);"><span id="d-req-${id}">0</span><span style="font-size:0.8rem; color:var(--text-sub); margin-left:4px;">필요</span></div><div id="craft-wrap-${id}" style="position:absolute; right:12px;"></div></div></div>`;
    const getGrp = (id, t, items, pid, ex='') => `<div class="deduct-group" id="${id}" ${ex}><div class="deduct-group-title">${t}</div><div class="deduct-grid" id="${pid}">${items.map(u => renderSlot(u.id, u.name, u.grade, pid)).join('')}</div></div>`;
    const allUnits = Array.from(unitMap.values());

    getEl('deductionBoard').innerHTML = `<div id="deduct-empty-msg" style="text-align:center; padding:40px 20px; color:var(--text-sub); font-weight:bold; width:100%; display:none; line-height:1.6; font-size:1.05rem;"><div style="font-size:2rem; margin-bottom:12px; color:var(--g-dim);">✨</div> 목표 유닛을 선택하면<br>필요한 재료 목록이 이곳에 생성됩니다.</div>`
    + getGrp('group-special', `<span style="color:var(--grade-super); text-shadow:0 0 10px var(--grade-super);">✦</span> 목표 유닛 및 직속 재료`, [{id:'갓오타',name:'갓오타',grade:'레어'}, {id:'메시브',name:'메시브',grade:'레어'}, {id:'자동포탑',name:'자동포탑',grade:'매직'}], 'grid-special', 'style="border-color:rgba(251,191,36,0.3); background:linear-gradient(to bottom, rgba(30,25,10,0.6), rgba(15,10,5,0.8));"')
    + getGrp('group-hidden', `<span style="color:var(--grade-hidden);">♦</span> 히든 등급 재료`, allUnits.filter(u => u.grade === "히든" && !SPECIAL_UNIT_IDS.includes(u.id)), 'grid-hidden')
    + getGrp('group-top', `<span style="color:var(--grade-legend);">▲</span> 레어 - 레전드 재료`, allUnits.filter(u => ["슈퍼히든", "레전드", "헬", "유니크", "에픽", "레어"].includes(u.grade) && !SPECIAL_UNIT_IDS.includes(u.id)).sort((a,b)=>getGradeIndex(b.grade)-getGradeIndex(a.grade)), 'grid-top', 'style="margin-bottom:0;"');
}

function updateDeductionBoard() {
    const { reqMap, baseMap, reasonMap, specialReq, baseSpecialReq, specialReason } = calculateDeductedRequirements();
    const directMaterials = new Set(), fragmentMap = new Map();
    activeUnits.forEach((_, uid) => unitMap.get(uid)?.parsedRecipe?.forEach(pr => pr.id && directMaterials.add(pr.id)));

    const updateSlot = (id, netReq, baseReq, reasons) => {
        const wrapEl = getEl(`d-slot-wrap-${id}`); if (!wrapEl) return;
        if (baseReq > 0) {
            wrapEl.style.display = 'flex'; wrapEl.classList.add('is-visible');
            const rCon = getEl(`d-reason-${id}`), cEl = getEl(`d-cond-${id}`), isTarget = activeUnits.has(id);
            if (reasons?.size > 0 && netReq > 0) {
                if (rCon) { rCon.innerHTML = Array.from(reasons.entries()).map(([rId, i]) => `<span class="d-reason-tag" onclick="toggleHighlight('${rId}', event)">${i.text || i}</span>`).join(''); rCon.style.display = 'flex'; }
                if (cEl) { let conds = [...new Set(Array.from(reasons.values()).map(i => i.cond).filter(Boolean))]; cEl.style.display = conds.length ? 'block' : 'none'; cEl.innerHTML = conds.map(c => `[${c}]`).join(' / '); }
            } else { if (rCon) rCon.style.display = 'none'; if (cEl) cEl.style.display = 'none'; }
            wrapEl.style.order = isTarget ? "-999" : (SPECIAL_UNIT_IDS.includes(id) ? "999" : "-1");
            const reqEl = getEl(`d-req-${id}`), cWrap = getEl(`craft-wrap-${id}`);
            if (netReq > 0) {
                wrapEl.classList.remove('is-completed'); wrapEl.classList.add('has-target'); if (reqEl) reqEl.innerText = netReq;
                if (cWrap) cWrap.innerHTML = isTarget && !unitMap.get(id)?.parsedRecipe?.some(pr => (completedUnits.get(pr.id)||0) < ((id==='로리스완'&&pr.id==='낮까마귀')?1:pr.qty*netReq)) && !unitMap.get(id)?.parsedCost?.some(pc => ['갓오타','메시브'].includes(pc.key) && (completedUnits.get(pc.key)||0)<pc.qty*netReq) ? `<button class="btn-complete final-target" onclick="completeUnit('${id}'); event.stopPropagation();">✨ 최종 제작 완료</button>` : `<button class="btn-complete" onclick="completeUnit('${id}'); event.stopPropagation();">✔ 완료</button>`;
            } else { wrapEl.classList.remove('has-target'); wrapEl.classList.add('is-completed'); if (reqEl) reqEl.innerText = '0'; if (cWrap) cWrap.innerHTML = `<span style="font-size:0.85rem; color:var(--g-dim); font-weight:bold; padding-right:4px;">✨ 완료됨</span>`; }
            let tParent = (directMaterials.has(id) || isTarget) ? getEl('grid-special') : (getEl(wrapEl.dataset.origParent) || getEl('grid-hidden'));
            if (tParent && wrapEl.parentElement !== tParent) { if (!fragmentMap.has(tParent)) fragmentMap.set(tParent, document.createDocumentFragment()); fragmentMap.get(tParent).appendChild(wrapEl); }
        } else { wrapEl.style.display = 'none'; wrapEl.classList.remove('is-visible'); }
    };

    updateSlot('갓오타', specialReq.갓오타, baseSpecialReq.갓오타, specialReason.갓오타); updateSlot('메시브', specialReq.메시브, baseSpecialReq.메시브, specialReason.메시브); updateSlot('자동포탑', reqMap.get('자동포탑') || 0, baseMap.get('자동포탑') || 0, reasonMap.get('자동포탑'));
    unitMap.forEach(u => { if (["레어", "에픽", "유니크", "헬", "레전드", "히든", "슈퍼히든"].includes(u.grade) && u.id !== '자동포탑') updateSlot(u.id, reqMap.get(u.id) || 0, baseMap.get(u.id) || 0, reasonMap.get(u.id)); });
    fragmentMap.forEach((frag, parent) => parent.appendChild(frag));
    let hasVisible = false; document.querySelectorAll('.deduct-group').forEach(g => { let isVis = g.querySelectorAll('.deduct-slot.is-visible').length > 0; g.style.display = isVis ? 'block' : 'none'; if(isVis) hasVisible = true; });
    getEl('deduct-empty-msg').style.display = hasVisible ? 'none' : 'block';
    if (_currentHighlight) { let deps = getDependencies(_currentHighlight); document.querySelectorAll('.deduct-slot').forEach(el => el.classList.toggle('highlighted-tree', deps.has(el.id.replace('d-slot-wrap-', '')))); }
}

function renderTabs() { const t = getEl('codexTabs'); if (t) { t.innerHTML = TAB_CATEGORIES.map((c, i) => `<button id="tab-btn-${i}" role="tab" aria-selected="${i===_activeTabIdx}" class="tab-btn" onclick="selectTab(${i})"><span class="tab-sym" aria-hidden="true" style="font-size:1.1rem; padding:2px 5px; border-radius:3px; background:rgba(0,0,0,0.3); border:1px solid var(--border-light); color:var(--text-sub);">${c.sym}</span><span>${c.name}</span></button>`).join(''); updateTabsUI(); } }

function updateTabsUI() {
    let aCats = new Set(); for (let id of activeUnits.keys()) { let u = unitMap.get(id); if (u?.category) aCats.add(u.category); if (aCats.size === TAB_CATEGORIES.length) break; }
    TAB_CATEGORIES.forEach((c, i) => {
        let btn = getEl(`tab-btn-${i}`), has = aCats.has(c.key);
        if (!btn) return;
        if (btn.classList.contains('active') !== (i === _activeTabIdx)) { btn.classList.toggle('active', i === _activeTabIdx); btn.setAttribute('aria-selected', i === _activeTabIdx ? 'true' : 'false'); }
        if (btn.classList.contains('has-active') !== has) btn.classList.toggle('has-active', has);
    });
}

const formatRecipeHorizontal = (item, m = 1) => formatRecipe(item, m, false);
const formatRecipeTooltip = (item, m = 1) => formatRecipe(item, m, true);
function formatRecipe(item, multi = 1, showSep = false) {
    if (!item.recipe || IGNORE_PARSE_RECIPES.includes(item.recipe)) return `<div style="color:var(--text-muted);font-size:0.85rem;">정보 없음</div>`;
    let partsHtml = splitRecipe(item.recipe).map((p, i, arr) => {
        const m = p.match(/^([^(\[ ]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/); let html = '';
        if (m) { const u = unitMap.get(getUnitId(m[1].trim())), c = u ? gradeColorsRaw[u.grade] : "var(--text)"; html = `<div class="recipe-badge" style="color:${c}; border-color:${c}44;">${m[1].trim()} <span class="badge-cond">${m[2] ? `(${m[2]})` : ''}[${(m[3] ? parseInt(m[3], 10) : 1) * multi}]</span></div>`; }
        else html = `<div style="color:var(--text-sub); font-size:0.85rem; white-space:nowrap;">${p}</div>`;
        return html + (showSep && i < arr.length - 1 ? `<div style="color:var(--text-muted); font-size:0.9rem; font-weight:bold;">+</div>` : '');
    }).join('');
    return `<div class="${showSep?'':'recipe-vertical'}" ${showSep?'style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;"':''}>${partsHtml}</div>`;
}

function selectTab(idx) { _activeTabIdx = idx; updateTabsUI(); renderCurrentTabContent(); if (_jewelPanelOpen) closeJewelPanel(); }

let _isTabContentInitialized = false;
function initAllTabContents() {
    const tc = getEl('tabContent'); if (!tc) return;
    tc.innerHTML = TAB_CATEGORIES.map(cat => {
        let items = Array.from(unitMap.values()).filter(u => getGradeIndex(u.grade) >= getGradeIndex("레전드") && u.category === cat.key).sort((a,b) => (CONFIG_SORT_ORDER[b.name]||0)-(CONFIG_SORT_ORDER[a.name]||0) || (isOneTime(a)?-1:isOneTime(b)?1:0) || getGradeIndex(b.grade)-getGradeIndex(a.grade) || calculateTotalCostScore(b)-calculateTotalCostScore(a));
        return `<div id="cat-group-${cat.key}" class="cat-group" role="tabpanel" style="display:none; flex-direction:column; gap:4px;">${!items.length ? `<div style="text-align:center; padding:30px; color:var(--text-sub); font-weight:bold; font-size:1.05rem;">해당 분류에 유닛이 없습니다.</div>` : items.map((item, idx) => `<div id="card-${item.id}" class="unit-card" style="animation-delay:${idx*0.03}s" onclick="toggleUnitSelection('${item.id}', 1)"><div class="uc-wrap"><div class="uc-identity"><div class="uc-grade"><span class="gtag" style="border-color:${gradeColorsRaw[item.grade]}44; color:${gradeColorsRaw[item.grade]};">${item.grade}</span></div><div class="uc-name-row" style="color:${gradeColorsRaw[item.grade]};">${item.name}</div></div><div class="uc-recipe-col">${formatRecipeHorizontal(item)}</div><div class="uc-ctrl" onclick="event.stopPropagation()">${isOneTime(item)?'':`<div class="smart-stepper active-stepper"><button id="btn-minus-${item.id}" aria-label="${item.name} 감소" onmousedown="startSmartChange('${item.id}', -1, 'active', event)" ontouchstart="startSmartChange('${item.id}', -1, 'active', event)">-</button><div class="ss-val" id="val-unit-${item.id}" aria-live="polite">-</div><button id="btn-plus-${item.id}" aria-label="${item.name} 추가" onmousedown="startSmartChange('${item.id}', 1, 'active', event)" ontouchstart="startSmartChange('${item.id}', 1, 'active', event)">+</button></div>`}</div></div></div>`).join('')}</div>`;
    }).join('');
    _isTabContentInitialized = true;
}

function renderCurrentTabContent() {
    if (!_isTabContentInitialized) initAllTabContents();
    TAB_CATEGORIES.forEach((c, i) => { let g = getEl(`cat-group-${c.key}`); if (g) g.style.display = i === _activeTabIdx ? 'flex' : 'none'; });
    updateTabContentUI();
}

function updateTabContentUI() {
    unitMap.forEach(item => {
        if (item.category !== TAB_CATEGORIES[_activeTabIdx].key) return;
        let card = getEl(`card-${item.id}`), isActive = activeUnits.has(item.id);
        card?.classList.toggle('active', isActive);
        if (!isOneTime(item)) {
            let v = getEl(`val-unit-${item.id}`); if (v) v.innerText = isActive ? activeUnits.get(item.id) : '-';
            ['minus','plus'].forEach(t => { let b = getEl(`btn-${t}-${item.id}`); if (b) b.disabled = !isActive; });
        }
    });
}

function renderDashboardAtoms() {
    let db = getEl('magicDashboard'); if (!db) return;
    db.innerHTML = `<div class="cost-slot total" id="slot-total-magic"><div class="cost-val" id="magic-total-val">0</div><div class="cost-name">통합 코스트</div></div><div class="cost-slot total" id="slot-total-essence"><div class="cost-val" id="essence-total-val">0</div><div class="cost-name">통합 정수</div></div>${['coral|#FF6B6B|코랄', 'aiur|var(--grade-rare)|아이어', 'zerus|var(--grade-legend)|제루스'].map(d => { let [id, c, n] = d.split('|'); return `<div class="cost-slot" id="slot-essence-${id}"><div class="cost-val" id="val-essence-${id}" style="color:${c};">0</div><div class="cost-sub" id="sub-essence-${id}" style="font-size:0.8rem; margin:-2px 0 2px; height:14px; font-family:var(--font-mono); line-height:1; display:flex; gap:4px; align-items:center; justify-content:center;"></div><div class="cost-name">${n}</div></div>`; }).join('')}${dashboardAtoms.map(a => `<div class="cost-slot ${a === '갓오타/메시브' ? 'is-skill-slot' : 'is-magic-slot'}" id="vslot-${clean(a)}"><div class="cost-val"></div><div class="cost-name" id="name-${clean(a)}">${a}</div></div>`).join('')}`;
}

function renderJewelMiniGrid() {
    let g = getEl('jewelMiniGrid'); if (!g || g.dataset.rendered) return;
    if (typeof JEWEL_DATABASE === 'undefined' || !Array.isArray(JEWEL_DATABASE)) return g.innerHTML = `<div style="text-align:center; width:100%; grid-column:1/-1; padding:20px; color:var(--text-sub);">쥬얼 데이터가 로드되지 않았습니다.</div>`;
    g.dataset.rendered = '1';
    g.innerHTML = JEWEL_DATABASE.map(arr => {
        let kr = arr[0], c = typeof JEWEL_COLORS !== 'undefined' ? JEWEL_COLORS[kr] || "#ffffff" : "#ffffff";
        return `<div class="jwm-item" style="--jw-color:${c};--jw-color-a:${c}22;"><div class="jwm-img-wrap"><img src="https://sldbox.github.io/site/image/jw/${arr[3]||kr}.png" alt="${kr} 이미지" loading="lazy" onerror="this.style.opacity='0'"></div><div class="jwm-name">${kr}</div><div class="jwm-stat legend"><span>${arr[1]}</span></div>${arr[2]?.trim() ? `<div class="jwm-stat mythic"><span>✦ ${arr[2]}</span></div>` : ''}</div>`;
    }).join('');
}

let _isSwiping = false;
document.addEventListener('DOMContentLoaded', () => {
    try {
        document.documentElement.lang = 'ko'; document.documentElement.setAttribute('data-theme', 'dark');
        const intro = getEl('introCinematic'), main = getEl('mainLayout'), cEl = getEl('introCounter'), fEl = document.querySelector('.loader-fill');
        if (intro && main && cEl && fEl) {
            let progress = 0; setTimeout(() => {
                let timer = setInterval(() => {
                    progress += (100/(2000/30)) + (Math.random()*2.5); let cur = Math.min(100, Math.floor(progress));
                    if (progress >= 100) { clearInterval(timer); cEl.innerText="100%"; cEl.setAttribute('aria-valuenow','100'); fEl.style.width="100%"; setTimeout(() => { intro.classList.add('hidden'); setTimeout(() => { main.style.opacity='1'; main.style.transform='scale(1)'; }, 400); }, 500); }
                    else { cEl.innerText=cur+"%"; cEl.setAttribute('aria-valuenow', cur); fEl.style.width=cur+"%"; }
                }, 30);
            }, 600);
        }

        if (typeof UNIT_DATABASE === 'undefined' || !Array.isArray(UNIT_DATABASE)) return console.error("[오류] 데이터베이스 배열 로드 실패");
        UNIT_DATABASE.forEach(kArr => unitMap.set(clean(kArr[0]), { id: clean(kArr[0]), name: kArr[0], grade: kArr[1] || "매직", category: kArr[2] || "테바", recipe: kArr[3], cost: kArr[4] }));

        initializeCacheEngine(); loadNexusState(); renderDashboardAtoms(); renderDeductionBoard(); renderTabs(); selectTab(0); debouncedUpdateAllPanels(); setupSearchEngine(); setupInitialView();

        const sArea = getEl('tabContent');
        if (sArea) {
            let sX = 0, sY = 0;
            sArea.addEventListener('touchstart', e => { sX = e.changedTouches[0].screenX; sY = e.changedTouches[0].screenY; }, { passive: true });
            sArea.addEventListener('touchend', e => {
                if (_isSwiping) return;
                let dX = e.changedTouches[0].screenX - sX, dY = e.changedTouches[0].screenY - sY;
                if (Math.abs(dX) > 70 && Math.abs(dY) < 50) { _isSwiping = true; if (dX > 0 && _activeTabIdx > 0) selectTab(_activeTabIdx - 1); else if (dX < 0 && _activeTabIdx < TAB_CATEGORIES.length - 1) selectTab(_activeTabIdx + 1); setTimeout(() => _isSwiping = false, 300); }
            }, { passive: true });
        }
    } catch (err) { console.error("[오류] 넥서스 초기화 중 에러 발생:", err); }
});
