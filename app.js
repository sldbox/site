const unitMap = new Map();
const activeUnits = new Map();
const completedUnits = new Map();

const getEl = (id) => document.getElementById(id);
const clean = (s) => s ? s.replace(/\s+/g, '').toLowerCase() : '';

const IGNORE_PARSE_RECIPES = ["미발견", "없음", ""];
const dashboardAtoms = [
    "전쟁광", "스파르타중대", "암흑광전사", "암흑파수기", "원시바퀴", "저격수",
    "코브라", "암흑고위기사", "암흑추적자", "변종가시지옥", "망치경호대", "공성파괴단",
    "암흑집정관", "암흑불멸자", "원시히드라리스크", "땅거미지뢰", "자동포탑",
    "우르사돈암", "우르사돈수", "갓오타/메시브"
];
const CLEANED_DASHBOARD_ATOMS = dashboardAtoms.map(a => ({ raw: a, clean: clean(a) }));
const SPECIAL_UNIT_IDS = ['갓오타', '메시브', '자동포탑'];

const EMPTY_SVG = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.2;"><rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect><line x1="3" y1="21" x2="21" y2="3"></line></svg>`;

const isOneTime = (u) => u && (u.grade === "슈퍼히든" || ["데하카", "데하카고치", "데하카의오른팔", "유물"].includes(u.name));
const isTargetGrade = (u) => ["슈퍼히든", "히든", "레전드"].includes(u.grade);

function getUnitId(rawName) {
    return clean(rawName);
}

// [개선] 실시간 정규식 파싱 제거 및 캐싱 엔진 최적화
function calculateTotalCostScore(u) {
    if (!u || !u.parsedCost) return 0;
    return u.parsedCost.reduce((sum, pc) => sum + (pc.qty || 0), 0);
}

function initializeCacheEngine() {
    unitMap.forEach(u => {
        u.parsedCost = [];
        if (u.cost && !IGNORE_PARSE_RECIPES.includes(u.cost)) {
            const safeCost = u.cost.replace(/\//g, '+');
            safeCost.split('+').forEach(p => {
                const m = p.match(/(.+?)\[(\d+)\]/);
                let name = m ? m[1].trim() : p.trim();
                let qty = m ? parseInt(m[2], 10) : 1;
                let cName = clean(name);
                let type = 'atom', key = cName;

                if (cName.includes('메시브') || cName.includes('디제스터')) { type = 'special'; key = '메시브'; }
                else if (cName.includes('갓오타') || cName.includes('갓오브타임')) { type = 'special'; key = '갓오타'; }
                else if (cName.includes('땅거미지뢰')) { key = '땅거미지뢰'; }
                else if (cName.includes('자동포탑')) { key = '자동포탑'; }
                else if (cName.includes('잠복')) { key = '잠복'; }
                else {
                    const uid = getUnitId(cName);
                    key = dashboardAtoms.find(a => clean(a) === uid) || uid;
                }
                u.parsedCost.push({ type, key, qty, name: u.name });
            });
        }

        u.parsedRecipe = [];
        if (u.recipe && !IGNORE_PARSE_RECIPES.includes(u.recipe)) {
            u.recipe.split(/\+(?![^()]*\))/).forEach(p => {
                const m = p.trim().match(/^([^(\[]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/);
                if (m) {
                    const childId = getUnitId(m[1]);
                    u.parsedRecipe.push({ id: childId, qty: m[3] ? parseFloat(m[3]) : 1, cond: m[2] || '' });
                }
            });
        }
    });
}

function calcEssenceRecursiveFast(uid, counts, visited) {
    if (visited.has(uid)) return;
    visited.add(uid);
    const u = unitMap.get(uid);
    if (!u) return;

    if (["히든", "슈퍼히든"].includes(u.grade)) {
        if (["테바", "테메"].includes(u.category)) counts.코랄 += 1;
        else if (["토바", "토메"].includes(u.category)) counts.아이어 += 1;
        else if (["저그", "중립"].includes(u.category) && u.name !== "미니성큰") counts.제루스 += 1;
        else if (u.category === "혼종") counts.혼종 += 1;
    }

    if (u.parsedRecipe) {
        u.parsedRecipe.forEach(pr => { if (pr.id) calcEssenceRecursiveFast(pr.id, counts, visited); });
    }
}

function getEssenceCount(sourceMap) {
    let counts = { 코랄: 0, 아이어: 0, 제루스: 0, 혼종: 0 };
    sourceMap.forEach((qty, uid) => {
        for (let i = 0; i < qty; i++) {
            calcEssenceRecursiveFast(uid, counts, new Set());
        }
    });
    return counts;
}

function updateEssence() {
    let targetE = getEssenceCount(activeUnits);
    let compE = getEssenceCount(completedUnits);

    let finalCoral = Math.max(0, targetE.코랄 - compE.코랄);
    let finalAiur = Math.max(0, targetE.아이어 - compE.아이어);
    let finalZerus = Math.max(0, targetE.제루스 - compE.제루스);
    let finalHybrid = Math.max(0, targetE.혼종 - compE.혼종);

    const setVal = (id, totalVal, baseVal, hybridVal) => {
        const el = getEl(`val-${id}`);
        const subEl = getEl(`sub-${id}`);
        const parent = getEl(`slot-${id}`);

        if (el) {
            if (el.innerText !== String(totalVal)) el.innerText = totalVal;
            if (subEl) {
                if (hybridVal > 0) {
                    subEl.innerHTML = `<span style="opacity:0.6;">${baseVal}</span><span style="color:var(--g); font-weight:bold;"> +${hybridVal}</span>`;
                } else {
                    subEl.innerHTML = '';
                }
            }
            if (parent) parent.classList.toggle('active', totalVal > 0);
        }
    };

    setVal('coral', finalCoral + finalHybrid, finalCoral, finalHybrid);
    setVal('aiur', finalAiur + finalHybrid, finalAiur, finalHybrid);
    setVal('zerus', finalZerus + finalHybrid, finalZerus, finalHybrid);

    const totalEl = getEl('essence-total-val');
    if (totalEl) {
        let totalEssence = finalCoral + finalAiur + finalZerus + finalHybrid * 3;
        totalEl.innerText = totalEssence;
        const parent = getEl('slot-total-essence');
        if (parent) parent.classList.toggle('active', totalEssence > 0);
    }
}

function updateMagicDashboard() {
    let activeScore = 0, compScore = 0;
    activeUnits.forEach((qty, uid) => { activeScore += calculateTotalCostScore(unitMap.get(uid)) * qty; });
    completedUnits.forEach((qty, uid) => { compScore += calculateTotalCostScore(unitMap.get(uid)) * qty; });
    let finalTotalCost = Math.max(0, activeScore - compScore);

    const magicTotalEl = getEl('magic-total-val');
    if (magicTotalEl) magicTotalEl.innerText = Math.ceil(finalTotalCost);
    getEl('slot-total-magic')?.classList.toggle('active', finalTotalCost > 0);

    const totalMap = {}, compMap = {};
    dashboardAtoms.forEach(a => {
        totalMap[a] = a === "갓오타/메시브" ? { 갓오타: 0, 메시브: 0 } : 0;
        compMap[a] = a === "갓오타/메시브" ? { 갓오타: 0, 메시브: 0 } : 0;
    });

    activeUnits.forEach((c, k) => {
        const u = unitMap.get(k);
        if (u?.parsedCost) {
            u.parsedCost.forEach(pc => {
                if (pc.type === 'special') totalMap['갓오타/메시브'][pc.key] += pc.qty * c;
                else totalMap[pc.key] = (totalMap[pc.key] || 0) + pc.qty * c;
            });
        }
    });

    completedUnits.forEach((c, k) => {
        if (c <= 0) return;
        const atomKeyObj = CLEANED_DASHBOARD_ATOMS.find(a => a.clean === k);
        const atomKey = atomKeyObj ? atomKeyObj.raw : undefined;

        if (atomKey && atomKey !== '갓오타/메시브') compMap[atomKey] = (compMap[atomKey] || 0) + c;
        else if (k === '갓오타' || k === '메시브') compMap['갓오타/메시브'][k] += c;
        else {
            const u = unitMap.get(k);
            if (u?.parsedCost) {
                u.parsedCost.forEach(pc => {
                    if (pc.type === 'special') compMap['갓오타/메시브'][pc.key] += pc.qty * c;
                    else compMap[pc.key] = (compMap[pc.key] || 0) + pc.qty * c;
                });
            }
        }
    });

    dashboardAtoms.forEach(a => {
        const container = getEl(`vslot-${clean(a)}`);
        if (!container) return;

        const e = container.querySelector('.cost-val');
        const nameEl = container.querySelector('.cost-name');
        if (!e || !nameEl) return;

        if (a === "갓오타/메시브") {
            let finalG = Math.max(0, totalMap[a].갓오타 - compMap[a].갓오타);
            let finalM = Math.max(0, totalMap[a].메시브 - compMap[a].메시브);

            if (finalG > 0 || finalM > 0) {
                if (e.innerHTML === EMPTY_SVG || e.innerHTML === '') {
                    e.innerHTML = `
                        <div class="sp-wrap" style="display:flex; width:100%; height:100%;">
                            <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; border-right:1px solid rgba(251,191,36,0.3);">
                                <span class="sp-val-g" style="font-size:1.8rem; font-weight:900; color:var(--grade-rare); line-height:1; margin-bottom:4px; text-shadow:0 0 10px rgba(251,191,36,0.5);"></span>
                                <span style="font-size:0.7rem; color:rgba(255,255,255,0.7); letter-spacing:-0.5px;">갓오타</span>
                            </div>
                            <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                                <span class="sp-val-m" style="font-size:1.8rem; font-weight:900; color:var(--grade-rare); line-height:1; margin-bottom:4px; text-shadow:0 0 10px rgba(251,191,36,0.5);"></span>
                                <span style="font-size:0.7rem; color:rgba(255,255,255,0.7); letter-spacing:-0.5px;">메시브</span>
                            </div>
                        </div>`;
                }
                const spG = e.querySelector('.sp-val-g');
                const spM = e.querySelector('.sp-val-m');
                if (spG) spG.innerText = finalG;
                if (spM) spM.innerText = finalM;
                nameEl.style.display = 'none';
                container.classList.add('active');
            } else {
                if (e.innerHTML !== EMPTY_SVG) {
                    e.innerHTML = EMPTY_SVG;
                    nameEl.style.display = 'block';
                    container.classList.remove('active');
                }
            }
        } else {
            let finalVal = Math.max(0, totalMap[a] - compMap[a]);
            if (finalVal > 0) {
                if (e.innerText !== String(Math.ceil(finalVal))) e.innerText = Math.ceil(finalVal);
                nameEl.style.display = 'block';
                container.classList.add('active');
            } else {
                if (e.innerHTML !== EMPTY_SVG) {
                    e.innerHTML = EMPTY_SVG;
                    nameEl.style.display = 'block';
                    container.classList.remove('active');
                }
            }
        }
    });
}

let _activeTabIdx = 0;
let _currentViewMode = 'codex';
let _currentHighlight = null;

const GRADE_ORDER = ["매직", "레어", "에픽", "유니크", "헬", "레전드", "히든", "슈퍼히든"];
const gradeColorsRaw = {
    "매직":"var(--grade-magic)", "레어":"var(--grade-rare)", "에픽":"var(--grade-epic)",
    "유니크":"var(--grade-unique)", "헬":"var(--grade-hell)", "레전드":"var(--grade-legend)",
    "히든":"var(--grade-hidden)", "슈퍼히든":"var(--grade-super)"
};

const getGradeIndex = (grade) => {
    const idx = GRADE_ORDER.indexOf(grade);
    return idx !== -1 ? idx : -99;
};

const TAB_CATEGORIES = [
    {key:"테바", name:"테바", sym:"♆"},
    {key:"테메", name:"테메", sym:"♆"},
    {key:"토바", name:"토바", sym:"⟡"},
    {key:"토메", name:"토메", sym:"⟡"},
    {key:"저그", name:"저그", sym:"☣︎"},
    {key:"중립", name:"중립", sym:"❂"},
    {key:"혼종", name:"혼종", sym:"⌬"}
];

function triggerHaptic() { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15); }

function resetCodex(silent = false) {
    activeUnits.clear(); completedUnits.clear(); toggleHighlight(null);
    debouncedUpdateAllPanels();
    if (!silent) showToast("목표 유닛이 초기화되었습니다.");
}

function resetCompleted() {
    completedUnits.clear(); debouncedUpdateAllPanels();
    showToast("완료 기록이 모두 초기화되었습니다.");
}

function setupInitialView() {
    switchLayout('codex');
    startTitleCycle();
}

const _cycleTitles = ['개복디 넥서스', '제작자 | 회장', 'ID : 3-S2-1-2461127'];
let _cycleTitleIdx = 0;
function startTitleCycle() {
    const el = getEl('nexusCycleTitle');
    if (!el) return;
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

let _jewelPanelOpen = false;
window.toggleJewelPanel = function() {
    const layout = getEl('mainLayout');
    if (layout && layout.classList.contains('view-jewel')) {
        closeJewelPanel();
    } else if (layout) {
        layout.classList.add('view-jewel');
        _jewelPanelOpen = true;
        renderJewelMiniGrid();
    }
};

window.closeJewelPanel = function() {
    const layout = getEl('mainLayout');
    if (layout) layout.classList.remove('view-jewel');
    _jewelPanelOpen = false;
};

function switchLayout(mode) {
    const layout = getEl('mainLayout');
    const btnToggle = getEl('btnToggleMode');
    if (!layout || !btnToggle) return;

    _currentViewMode = mode;
    layout.classList.remove('view-deduct', 'view-jewel');
    _jewelPanelOpen = false;

    if (mode === 'deduct') {
        layout.classList.add('view-deduct');
        btnToggle.classList.remove('active');
        btnToggle.innerHTML = '<span class="toggle-icon">◧</span> 도감 모드 전환';
    } else if (mode === 'codex') {
        btnToggle.classList.add('active');
        btnToggle.innerHTML = '<span class="toggle-icon">◨</span> 체크리스트 전환';
    }
}

function toggleViewMode() {
    switchLayout(_currentViewMode === 'deduct' ? 'codex' : 'deduct');
}

let searchTimeout = null;
const ALIAS_MAP = {
    "타커": "타이커스", "타이": "타이커스", "닥템": "암흑기사", "닼템": "암흑기사", "다칸": "암흑집정관",
    "스투": "스투코프", "디젯": "디제스터", "메십": "메시브", "마랩": "마스터랩", "히페": "히페리온",
    "고전순": "고르곤전투순양함", "특레": "특공대레이너", "드레천": "드라켄레이저천공기",
    "공허": "공허포격기", "분수": "분노수호자", "원히": "원시히드라리스크"
};

function setupSearchEngine() {
    const inputEl = getEl('unitSearchInput');
    if (!inputEl) return;

    inputEl.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => performSearch(e.target.value), 150);
    });
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); processCommand(e.target.value); }
    });
    document.addEventListener('click', (e) => {
        const sr = getEl('searchResults');
        if (sr && !e.target.closest('#searchWrap')) sr.classList.remove('active');
    });
}

function findUnitFlexible(rawName) {
    let qClean = clean(rawName);
    if (!qClean) return null;

    let aliased = ALIAS_MAP[rawName] || ALIAS_MAP[qClean];
    if (aliased) qClean = clean(aliased);

    for (let [id, u] of unitMap) {
        if (id === qClean) return u;
    }
    for (let [id, u] of unitMap) {
        if (id.includes(qClean)) return u;
    }
    return null;
}

function performSearch(query) {
    const sr = getEl('searchResults');
    if (!sr) return;

    const parts = query.split('/');
    const currentQuery = parts[parts.length - 1].trim();

    if (!currentQuery) { sr.classList.remove('active'); return; }

    const searchName = currentQuery.split('*')[0].trim();
    const qClean = clean(searchName);
    const aliasClean = ALIAS_MAP[searchName] ? clean(ALIAS_MAP[searchName]) : null;

    let exactMatches = [], partialMatches = [];

    unitMap.forEach(u => {
        if (isTargetGrade(u)) {
            if (u.id === qClean || (aliasClean && u.id === aliasClean)) exactMatches.push(u);
            else if (u.id.includes(qClean) || (aliasClean && u.id.includes(aliasClean))) partialMatches.push(u);
        }
    });

    const sortByGrade = (a, b) => getGradeIndex(b.grade) - getGradeIndex(a.grade);

    let sortedExact = [...exactMatches].sort(sortByGrade);
    let sortedPartial = [...partialMatches].sort(sortByGrade);
    let combined = [...sortedExact, ...sortedPartial].slice(0, 10);

    if (combined.length > 0) {
        sr.innerHTML = combined.map(u => `
            <div class="sr-item" onclick="applySearchAutocomplete('${u.name}')">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="color:${gradeColorsRaw[u.grade]}; font-size:0.8rem; font-weight:900;">[${u.grade}]</span>
                    <span class="sr-name" style="color:var(--text);">${u.name}</span>
                </div>
                <span class="sr-cmd">↵ 자동완성</span>
            </div>
        `).join('');
    } else {
        sr.innerHTML = `<div style="padding:15px; text-align:center; color:var(--text-muted); font-size:0.9rem;">해당 등급 결과 없음</div>`;
    }
    sr.classList.add('active');
}

function applySearchAutocomplete(unitName) {
    const inputEl = getEl('unitSearchInput');
    if (!inputEl) return;

    let parts = inputEl.value.split('/');
    let multiplierMatch = parts[parts.length - 1].match(/\*\d+/);

    parts[parts.length - 1] = unitName + (multiplierMatch ? multiplierMatch[0] : '');
    inputEl.value = parts.join('/');
    inputEl.focus();
    getEl('searchResults')?.classList.remove('active');
}

function processCommand(val) {
    if (!val.trim()) return;
    let successCount = 0;

    val.split('/').forEach(cmd => {
        let parts = cmd.split('*');
        let targetName = parts[0].trim();
        if (!targetName) return;

        let qty = parts.length > 1 ? parseInt(parts[1]) || 1 : 1;

        const match = findUnitFlexible(targetName);
        if (match) {
            let newQty = (activeUnits.get(match.id) || 0) + qty;
            newQty = isOneTime(match) ? 1 : Math.min(newQty, 16);
            activeUnits.set(match.id, newQty);
            successCount++;
        }
    });

    if (successCount > 0) {
        debouncedUpdateAllPanels();
        showToast(`<span class="t-icon">⚡</span> ${successCount}건 커맨드 등록 완료`);
        const inputEl = getEl('unitSearchInput');
        if (inputEl) inputEl.value = '';
        getEl('searchResults')?.classList.remove('active');
        if (_currentViewMode === 'deduct') switchLayout('codex');
    } else {
        showToast(`<span class="t-icon">⚠</span> 유효한 유닛을 찾을 수 없습니다.`, true);
    }
}

function showToast(msg, isError = false) {
    const container = getEl('toastContainer');
    if (!container) return;

    const t = document.createElement('div');
    t.className = 'toast' + (isError ? ' error' : '');
    t.innerHTML = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 2100);
}

window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        hideRecipeTooltip();
        const layout = getEl('mainLayout');
        if (layout?.classList.contains('view-jewel')) closeJewelPanel();

        closeNoticeModal();

        const searchEl = getEl('unitSearchInput');
        if (document.activeElement === searchEl) {
            searchEl.value = '';
            getEl('searchResults')?.classList.remove('active');
            searchEl.blur();
        }
    }
});

document.addEventListener('click', (e) => {
    if (_currentHighlight && !e.target.closest('.deduct-slot') && !e.target.closest('.d-reason-tag') && !e.target.closest('#recipeTooltip')) {
        toggleHighlight(null);
    }
    if (e.target.id === 'noticeModal') {
        closeNoticeModal();
    }
});

window.openNoticeModal = function() {
    const modal = getEl('noticeModal');
    if(modal) modal.style.display = 'flex';
};
window.closeNoticeModal = function() {
    const modal = getEl('noticeModal');
    if(modal) modal.style.display = 'none';
};

let _guideStepIdx = 0;
let _resizeTimer = null;
let _guideBackupActive = new Map();
let _guideBackupCompleted = new Map();
let _currentGuideSteps = [];
let _guideDemoUnitId = '비밀작전노바';
let _guideDemoChildId = '자동포탑';

let _autoGuideTimer = null;
let _autoActionTimer = null;

const getGuideSteps = () => {
    let unitName = unitMap.get(_guideDemoUnitId)?.name || '유닛';
    let childName = unitMap.get(_guideDemoChildId)?.name || '재료';

    return [
        {
            id: 'jewel',
            targetId: 'jewelPanel',
            text: '💎 <b>쥬얼 도감</b><br>상단 버튼을 통해 진입할 수 있으며, 인게임 쥬얼들의 옵션과 정보를 넓은 화면에서 한눈에 확인할 수 있습니다.',
            onEnter: (step) => {
                if(!_jewelPanelOpen) toggleJewelPanel();
            }
        },
        {
            id: 'search',
            targetId: 'searchWrap',
            text: '🔍 <b>검색 및 커맨드</b><br>원하는 유닛을 검색하거나 단축 커맨드(예: 저격수*8/아몬/전쟁광*4)를 입력해 빠르게 목표에 추가할 수 있습니다.',
            onEnter: (step) => {
                if(_jewelPanelOpen) closeJewelPanel();
                if(_currentViewMode !== 'codex') switchLayout('codex');
            }
        },
        {
            id: 'click-unit',
            targetId: _guideDemoUnitId ? `card-${_guideDemoUnitId}` : 'tabContent',
            fallbackId: 'tabContent',
            text: `📖 <b>도감 및 유닛 추가</b><br>아래 도감에서 <b>${unitName}</b> 카드를 <b>직접 클릭</b>해서 목표 보드에 추가해 보세요!`,
            isWaitAction: true,
            onEnter: (step) => {
                if(_currentViewMode !== 'codex') switchLayout('codex');
                if (_guideDemoUnitId) {
                    let u = unitMap.get(_guideDemoUnitId);
                    if (u) {
                        let catIdx = TAB_CATEGORIES.findIndex(c => c.key === u.category);
                        if (catIdx !== -1 && _activeTabIdx !== catIdx) selectTab(catIdx);
                    }
                }
            },
            action: () => {
                if (_guideDemoUnitId) toggleUnitSelection(_guideDemoUnitId, 1);
            }
        },
        {
            id: 'cost-dashboard',
            targetId: 'costDashboardPanel',
            text: `🔮 <b>코스트 전체 조망</b><br>방금 <b>직접 추가한</b> 목표 유닛의 필요 자원이 대시보드 전체에 <b>즉시 계산</b>되어 나타납니다.`,
        },
        {
            id: 'switch-mode',
            targetId: 'btnToggleMode',
            text: '🔄 <b>체크리스트 모드 진입</b><br>화면 상단의 <b>[체크리스트 전환]</b> 버튼을 <b>직접 눌러서</b> 조립 모드로 진입해 보세요.',
            isWaitAction: true,
            action: () => toggleViewMode()
        },
        {
            id: 'click-complete',
            targetId: _guideDemoChildId ? `d-slot-wrap-${_guideDemoChildId}` : 'deductionBoard',
            fallbackId: 'deductionBoard',
            text: `✅ <b>재료 완료 처리</b><br>하위 재료를 확보했다면 완료 처리를 합니다.<br><b>${childName}</b>의 <b>[✔ 완료]</b> 버튼을 <b>직접 눌러보세요!</b>`,
            isWaitAction: true,
            onEnter: (step) => {
                if(_currentViewMode !== 'deduct') switchLayout('deduct');
            },
            action: () => {
                if (_guideDemoChildId) completeUnit(_guideDemoChildId);
            }
        },
        {
            id: 'auto-deduct',
            targetId: 'costDashboardPanel',
            text: `📉 <b>실시간 자동 차감</b><br>보시다시피 방금 완료 처리된 ${childName}의 코스트만큼 대시보드 전체 코스트가 정확히 <b>차감되어 실시간 반영</b>되었습니다!<br>이제 튜토리얼을 종료합니다.`,
            onEnter: (step) => {
                if(_currentViewMode !== 'deduct') switchLayout('deduct');
                getEl('costDashboardPanel')?.classList.add('cost-reduction-flash');
                setTimeout(() => getEl('costDashboardPanel')?.classList.remove('cost-reduction-flash'), 1000);
            }
        }
    ];
};

window.startGuideTour = function() {
    clearTimeout(_autoGuideTimer);
    clearTimeout(_autoActionTimer);

    if (window.innerWidth < 1200) {
        showToast("모바일 환경에서는 가이드를 지원하지 않습니다.", true);
        return;
    }

    _guideBackupActive = new Map(activeUnits);
    _guideBackupCompleted = new Map(completedUnits);

    activeUnits.clear();
    completedUnits.clear();
    debouncedUpdateAllPanels();

    if (!unitMap.has('비밀작전노바')) {
        const demo = Array.from(unitMap.values()).find(u =>
            (u.grade === '유니크' || u.grade === '에픽' || u.grade === '레전드') &&
            u.parsedRecipe && u.parsedRecipe.length > 0 && u.id !== '자동포탑'
        );
        if (demo) {
            _guideDemoUnitId = demo.id;
            const child = demo.parsedRecipe.find(r => r.id && !['갓오타', '메시브'].includes(r.id));
            _guideDemoChildId = child ? child.id : null;
        } else {
            _guideDemoUnitId = null;
            _guideDemoChildId = null;
        }
    } else {
        _guideDemoUnitId = '비밀작전노바';
        _guideDemoChildId = '자동포탑';
    }

    _currentGuideSteps = getGuideSteps();
    _guideStepIdx = 0;

    getEl('guideBlocker').style.display = 'block';
    getEl('guideHighlight').style.display = 'block';
    getEl('guideTooltip').style.display = 'block';

    window.addEventListener('resize', handleGuideResize);
    window.addEventListener('scroll', handleGuideResize, {passive: true});

    setTimeout(() => showGuideStep(), 50);
};

window.endGuideTour = function() {
    clearTimeout(_autoGuideTimer);
    clearTimeout(_autoActionTimer);

    getEl('guideBlocker').style.display = 'none';
    getEl('guideHighlight').style.display = 'none';
    getEl('guideClickCatcher').style.display = 'none';
    getEl('guideTooltip').style.display = 'none';
    window.removeEventListener('resize', handleGuideResize);
    window.removeEventListener('scroll', handleGuideResize);

    activeUnits.clear();
    _guideBackupActive.forEach((v, k) => activeUnits.set(k, v));
    completedUnits.clear();
    _guideBackupCompleted.forEach((v, k) => completedUnits.set(k, v));
    debouncedUpdateAllPanels();

    if (_jewelPanelOpen) closeJewelPanel();
    if (_currentViewMode === 'deduct') switchLayout('codex');
    showToast("가이드 종료. 이전 상태로 복구되었습니다. ✔");
};

window.nextGuideStep = function() {
    clearTimeout(_autoGuideTimer);
    clearTimeout(_autoActionTimer);

    _guideStepIdx++;
    if (_guideStepIdx >= _currentGuideSteps.length) {
        endGuideTour();
    } else {
        showGuideStep();
    }
};

function showGuideStep() {
    let step = _currentGuideSteps[_guideStepIdx];

    if (step.onEnter) step.onEnter(step);

    getEl('guideTooltip').style.opacity = '0';

    requestAnimationFrame(() => {
        setTimeout(() => {
            positionGuideHighlight(step);
            getEl('guideTooltip').style.opacity = '1';
        }, 150);
    });
}

function positionGuideHighlight(step) {
    if (!step) return;
    let target = getEl(step.targetId);
    if (!target && step.fallbackId) target = getEl(step.fallbackId);

    if (!target) {
         const hl = getEl('guideHighlight');
         hl.style.width = '0'; hl.style.height = '0';
         getEl('guideText').innerHTML = step.text;
         getEl('btnGuideNext').style.display = 'block';
         getEl('btnGuideNext').innerText = _guideStepIdx === _currentGuideSteps.length - 1 ? '가이드 종료 ✔' : '다음 ➔';

         clearTimeout(_autoGuideTimer);
         clearTimeout(_autoActionTimer);
         _autoGuideTimer = setTimeout(() => {
             nextGuideStep();
         }, 4000);
         return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setTimeout(() => {
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const hl = getEl('guideHighlight');
        const tt = getEl('guideTooltip');
        const catcher = getEl('guideClickCatcher');

        let pad = 8;
        hl.style.top = `${rect.top + window.scrollY - pad}px`;
        hl.style.left = `${rect.left + window.scrollX - pad}px`;
        hl.style.width = `${rect.width + pad * 2}px`;
        hl.style.height = `${rect.height + pad * 2}px`;

        getEl('guideText').innerHTML = step.text;

        if (step.isWaitAction) {
            catcher.style.top = hl.style.top;
            catcher.style.left = hl.style.left;
            catcher.style.width = hl.style.width;
            catcher.style.height = hl.style.height;
            catcher.style.display = 'block';

            catcher.onclick = () => {
                clearTimeout(_autoGuideTimer);
                clearTimeout(_autoActionTimer);
                catcher.style.display = 'none';
                if (step.action) step.action();
                setTimeout(nextGuideStep, 250);
            };

            getEl('btnGuideNext').style.display = 'block';
            getEl('btnGuideNext').innerText = '다음 ➔';
        } else {
            catcher.style.display = 'none';
            getEl('btnGuideNext').style.display = 'block';
            getEl('btnGuideNext').innerText = _guideStepIdx === _currentGuideSteps.length - 1 ? '가이드 종료 ✔' : '다음 ➔';
        }

        tt.style.display = 'block';
        let ttW = tt.getBoundingClientRect().width || 320;
        let ttH = tt.getBoundingClientRect().height || 150;

        let ttTop = rect.bottom + window.scrollY + pad + 20;
        let ttLeft = rect.left + window.scrollX + (rect.width / 2) - (ttW / 2);

        if (rect.height > window.innerHeight * 0.4) {
            if (rect.left > ttW + 20) {
                ttLeft = rect.left + window.scrollX - ttW - 20;
                ttTop = rect.top + window.scrollY + (rect.height / 2) - (ttH / 2);
            }
            else if (window.innerWidth - rect.right > ttW + 20) {
                ttLeft = rect.right + window.scrollX + 20;
                ttTop = rect.top + window.scrollY + (rect.height / 2) - (ttH / 2);
            }
        } else {
            if (ttTop + ttH > window.scrollY + window.innerHeight) {
                ttTop = rect.top + window.scrollY - pad - ttH - 20;
            }
        }

        const screenMargin = 15;
        if (ttLeft < screenMargin) ttLeft = screenMargin;
        if (ttLeft + ttW > window.innerWidth - screenMargin) ttLeft = window.innerWidth - ttW - screenMargin;
        if (ttTop < window.scrollY + screenMargin) ttTop = window.scrollY + screenMargin;

        tt.style.top = `${ttTop}px`;
        tt.style.left = `${ttLeft}px`;

        clearTimeout(_autoGuideTimer);
        clearTimeout(_autoActionTimer);
        let autoDelay = 4000;

        if (step.isWaitAction) {
            _autoGuideTimer = setTimeout(() => {
                catcher.style.display = 'none';
                if (step.action) step.action();
                _autoActionTimer = setTimeout(nextGuideStep, 600);
            }, autoDelay);
        } else {
            _autoGuideTimer = setTimeout(() => {
                nextGuideStep();
            }, autoDelay + (_guideStepIdx === _currentGuideSteps.length - 1 ? 1500 : 0));
        }

    }, 150);
}

function handleGuideResize() {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
        if (getEl('guideHighlight')?.style.display === 'block') {
            positionGuideHighlight(_currentGuideSteps[_guideStepIdx]);
        }
    }, 50);
}

let repeatTimer = null, repeatDelayTimer = null, _lastInteractionTime = 0;

function startSmartChange(id, delta, type, event) {
    if (event) {
        if (event.type === 'touchstart') _lastInteractionTime = Date.now();
        else if (event.type === 'mousedown' && Date.now() - _lastInteractionTime < 300) return;
        event.preventDefault();
        event.stopPropagation();
    }
    stopSmartChange();
    triggerHaptic();

    let finalDelta = delta * (event?.shiftKey ? 5 : 1);
    const action = () => {
        let current = activeUnits.get(id) || 0;
        if (current === 0 && finalDelta > 0) toggleUnitSelection(id, finalDelta);
        else setUnitQty(id, current + finalDelta);
    };

    action();
    repeatDelayTimer = setTimeout(() => {
        repeatTimer = setInterval(() => { triggerHaptic(); action(); }, 80);
    }, 400);
}

function stopSmartChange() {
    clearTimeout(repeatDelayTimer); clearInterval(repeatTimer);
}
document.addEventListener('mouseup', stopSmartChange);
document.addEventListener('touchend', stopSmartChange);
window.addEventListener('mouseleave', stopSmartChange);

function showRecipeTooltip(id, event, isDeduction = false) {
    if (event) event.stopPropagation();

    const u = unitMap.get(id);
    if (!u) return;

    let multi = 1;
    if (isDeduction) {
        const reqVal = parseInt(getEl(`d-req-${id}`)?.innerText || 0);
        if (reqVal > 1) multi = reqVal;
    }

    const tt = getEl('recipeTooltip');
    if (!tt) return;

    tt.innerHTML = `
        <div class="tooltip-header" style="color:${gradeColorsRaw[u.grade]}">
            ${u.name} 조합법 ${multi > 1 ? `<span style="font-size:0.8rem; color:var(--text-sub);">(${multi}개 기준)</span>` : ''}
        </div>
        <div class="tooltip-body">${formatRecipeTooltip(u, multi)}</div>
        <div class="tooltip-footer">화면을 터치하거나 외부 클릭 시 닫힙니다.</div>`;
    tt.classList.add('active');

    let x = event.pageX || event.touches?.[0]?.pageX || window.innerWidth/2;
    let y = event.pageY || event.touches?.[0]?.pageY || window.innerHeight/2;

    if (x + 280 > window.innerWidth) x = window.innerWidth - 290;
    if (y + 150 > window.innerHeight) y = window.innerHeight - 160;

    tt.style.left = `${Math.max(10, x + 15)}px`;
    tt.style.top = `${Math.max(10, y + 15)}px`;
}

function hideRecipeTooltip() {
    getEl('recipeTooltip')?.classList.remove('active');
}
document.addEventListener('click', hideRecipeTooltip);
document.addEventListener('touchstart', hideRecipeTooltip);

function toggleUnitSelection(id, forceQty) {
    if (activeUnits.has(id)) activeUnits.delete(id);
    else activeUnits.set(id, isOneTime(unitMap.get(id)) ? 1 : (forceQty || 1));
    debouncedUpdateAllPanels();
}

function setUnitQty(id, val) {
    let q = parseInt(val);
    if (q === 0 || isNaN(q) || q < 1) {
        activeUnits.delete(id);
    } else {
        const u = unitMap.get(id);
        if (!u || isOneTime(u)) return;
        activeUnits.set(id, Math.min(q, 16));
    }
    debouncedUpdateAllPanels();
}

function getDependencies(uid, deps = new Set()) {
    if (deps.has(uid)) return deps;
    deps.add(uid);

    const u = unitMap.get(uid);
    u?.parsedRecipe?.forEach(child => { if (child.id) getDependencies(child.id, deps); });
    u?.parsedCost?.forEach(pc => { if (['갓오타', '메시브'].includes(pc.key)) deps.add(pc.key); });

    return deps;
}

function toggleHighlight(uid, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const board = getEl('deductionBoard');
    if (!board) return;

    document.querySelectorAll('.deduct-slot').forEach(el => el.classList.remove('highlighted-tree'));

    if (!uid || _currentHighlight === uid) {
        _currentHighlight = null;
        board.classList.remove('highlight-mode');
        return;
    }

    _currentHighlight = uid;
    board.classList.add('highlight-mode');

    getDependencies(uid).forEach(depId => {
        getEl(`d-slot-wrap-${depId}`)?.classList.add('highlighted-tree');
    });
}

function calculateDeductedRequirements() {
    let reqMap = new Map(), baseMap = new Map(), reasonMap = new Map();
    let specialReq = { 갓오타: 0, 메시브: 0 }, baseSpecialReq = { 갓오타: 0, 메시브: 0 };
    let specialReason = { 갓오타: new Map(), 메시브: new Map() };
    let deficits = new Map(), baseDeficits = new Map(), rootTracking = new Map();

    activeUnits.forEach((qty, uid) => {
        deficits.set(uid, (deficits.get(uid) || 0) + qty);
        baseDeficits.set(uid, (baseDeficits.get(uid) || 0) + qty);
        rootTracking.set(uid, new Map([[uid, { id: uid, text: '목표 유닛', cond: '' }]]));
    });

    const processQueueLoop = (queue, deficitsMap, updateRoots = false) => {
        let guard = 0;
        while (queue.length > 0 && guard++ < 1000) {
            let currentLevel = [...queue];
            queue = [];
            currentLevel.forEach(uid => {
                const u = unitMap.get(uid);
                let needed = deficitsMap.get(uid) || 0;
                if (!u || needed <= 0) return;

                if (updateRoots) {
                    let consume = Math.min(completedUnits.get(uid) || 0, needed);
                    needed -= consume;
                }

                if (uid === '로리스완') {
                    let toolNeeded = needed > 0 ? 1 : 0;
                    if (toolNeeded > (deficitsMap.get('낮까마귀') || 0)) {
                        deficitsMap.set('낮까마귀', toolNeeded);
                        if (!queue.includes('낮까마귀')) queue.push('낮까마귀');
                    }
                }

                if (needed > 0 && u.parsedRecipe) {
                    u.parsedRecipe.forEach(child => {
                        if (!child.id || !unitMap.has(child.id)) return;
                        let isTool = (uid === '로리스완' && child.id === '낮까마귀');

                        if (updateRoots) {
                            if (!rootTracking.has(child.id)) rootTracking.set(child.id, new Map());
                            let childRoots = rootTracking.get(child.id);

                            rootTracking.get(uid)?.forEach((_, rootId) => {
                                let baseName = unitMap.get(rootId)?.name || rootId;
                                let newText = isTool ? `${baseName} <span style="margin-left:4px; font-size:0.75rem; color:#10b981; font-weight:900;">[도구]</span>` : `${baseName} 재료`;
                                childRoots.set(rootId, { id: rootId, text: newText, cond: child.cond });
                            });
                        }

                        if (!isTool) {
                            deficitsMap.set(child.id, (deficitsMap.get(child.id) || 0) + needed * child.qty);
                            if (!queue.includes(child.id)) queue.push(child.id);
                        }
                    });
                }
            });
        }
    };

    processQueueLoop(Array.from(activeUnits.keys()), baseDeficits, false);
    processQueueLoop(Array.from(activeUnits.keys()), deficits, true);

    baseDeficits.forEach((val, k) => { if (val > 0) baseMap.set(k, val); });

    deficits.forEach((needed, uid) => {
        if (needed > 0) reqMap.set(uid, Math.max(0, needed - (completedUnits.get(uid) || 0)));
    });

    const updateSpecials = (map, reqObj, isBase = false) => {
        map.forEach((needed, uid) => {
            unitMap.get(uid)?.parsedCost?.forEach(pc => {
                if (['갓오타', '메시브'].includes(pc.key)) {
                    reqObj[pc.key] += pc.qty * needed;
                    if (!isBase && activeUnits.has(uid)) {
                        specialReason[pc.key].set(uid, { text: `${unitMap.get(uid).name} 재료`, cond: '' });
                    }
                }
            });
        });
    };

    updateSpecials(baseDeficits, baseSpecialReq, true);
    updateSpecials(deficits, specialReq, false);

    ['갓오타', '메시브'].forEach(k => {
        specialReq[k] = Math.max(0, specialReq[k] - (completedUnits.get(k) || 0));
    });

    rootTracking.forEach((rootsMap, childId) => {
        reasonMap.set(childId, activeUnits.has(childId) ? new Map([[childId, { text: '목표 유닛', cond: '' }]]) : rootsMap);
    });

    return { reqMap, baseMap, reasonMap, specialReq, baseSpecialReq, specialReason };
}

function attemptAutoMerge() {
    let merged = false, loopCount = 0;

    do {
        merged = false;
        let { reqMap } = calculateDeductedRequirements();

        unitMap.forEach((u, uid) => {
            if (activeUnits.has(uid) || !u.parsedRecipe?.length || (reqMap.get(uid) || 0) <= 0) return;

            let maxCraftable = 999;
            let checkCraftable = (id, qty, isTool) => {
                let comp = completedUnits.get(id) || 0;
                if (isTool) { if (comp < 1) maxCraftable = 0; }
                else {
                    let possible = Math.floor(comp / qty);
                    if (possible < maxCraftable) maxCraftable = possible;
                }
            };

            u.parsedRecipe.forEach(child => child.id && checkCraftable(child.id, child.qty, uid === '로리스완' && child.id === '낮까마귀'));
            u.parsedCost?.forEach(pc => ['갓오타', '메시브'].includes(pc.key) && checkCraftable(pc.key, pc.qty, false));

            let mergeAmount = Math.min(maxCraftable, reqMap.get(uid));
            if (mergeAmount > 0) {
                u.parsedRecipe.forEach(child => {
                    if (child.id && !(uid === '로리스완' && child.id === '낮까마귀')) {
                        completedUnits.set(child.id, (completedUnits.get(child.id) || 0) - (child.qty * mergeAmount));
                    }
                });
                u.parsedCost?.forEach(pc => {
                    if (['갓오타', '메시브'].includes(pc.key)) {
                        completedUnits.set(pc.key, (completedUnits.get(pc.key) || 0) - (pc.qty * mergeAmount));
                    }
                });
                completedUnits.set(uid, (completedUnits.get(uid) || 0) + mergeAmount);
                merged = true;
            }
        });
    } while (merged && loopCount++ < 30);
}

function consumeCompletedRecipe(uid, multiplier) {
    const u = unitMap.get(uid);
    if (!u) return;

    u.parsedRecipe?.forEach(child => {
        if (child.id && !(uid === '로리스완' && child.id === '낮까마귀')) {
            let needed = child.qty * multiplier;
            let comp = completedUnits.get(child.id) || 0;
            let consume = Math.min(needed, comp);

            if (consume > 0) completedUnits.set(child.id, comp - consume);
            if (needed - consume > 0) consumeCompletedRecipe(child.id, needed - consume);
        }
    });

    u.parsedCost?.forEach(pc => {
        if (['갓오타', '메시브'].includes(pc.key)) {
            let comp = completedUnits.get(pc.key) || 0;
            let consume = Math.min(pc.qty * multiplier, comp);
            if (consume > 0) completedUnits.set(pc.key, comp - consume);
        }
    });
}

window.completeUnit = function(uid) {
    const reqVal = parseInt(getEl(`d-req-${uid}`)?.innerText || 0);
    if (reqVal > 0) {
        consumeCompletedRecipe(uid, reqVal);
        completedUnits.set(uid, (completedUnits.get(uid) || 0) + reqVal);
        if (_currentHighlight) toggleHighlight(null);
        attemptAutoMerge();
        triggerHaptic();
        debouncedUpdateAllPanels();
    }
}

// [개선] 로스터 썸네일 코드 완전 제거
function renderActiveRoster() {
    const roster = getEl('activeRoster');
    if (!roster) return;

    let html = '';
    activeUnits.forEach((qty, id) => {
        const u = unitMap.get(id);
        if (u) {
            html += `
                <div class="roster-tag" onclick="toggleUnitSelection('${id}')" style="border-color:${gradeColorsRaw[u.grade]}66;">
                    <span style="color:${gradeColorsRaw[u.grade]}; font-weight:bold;">${u.name}</span>
                    <span class="roster-qty">×${qty}</span>
                </div>`;
        }
    });

    roster.innerHTML = html || '<span style="color:var(--text-muted); font-size:0.85rem;">선택된 유닛 대기열 (검색 후 엔터)</span>';
}

let updateTimer = null;
function debouncedUpdateAllPanels() {
    if (updateTimer) cancelAnimationFrame(updateTimer);
    updateTimer = requestAnimationFrame(() => {
        updateMagicDashboard(); updateEssence(); updateTabsUI();
        updateTabContentUI(); updateDeductionBoard(); renderActiveRoster();
    });
}

function renderDeductionBoard() {
    const board = getEl('deductionBoard');
    if (!board) return;

    const renderSlot = (id, name, grade, parentId) => `
        <div class="deduct-slot" id="d-slot-wrap-${id}" data-orig-parent="${parentId}" style="display:none;" onclick="toggleHighlight('${id}', event)">
            <div class="d-reason-wrap" id="d-reason-${id}" style="display:none;"></div>
            <div class="d-name" style="color:${gradeColorsRaw[grade] || 'var(--text)'}; cursor:help;" onclick="showRecipeTooltip('${id}', event, true)">
                <span class="gtag" style="border-color:${gradeColorsRaw[grade]}44; color:${gradeColorsRaw[grade]}; margin-right:6px;">${grade}</span>${name}
            </div>
            <div id="d-cond-${id}" style="display:none; text-align:center; font-size:0.8rem; color:#fde047; font-weight:bold; margin-top:2px; margin-bottom:6px; letter-spacing:-0.5px; word-break:keep-all;"></div>
            <div class="d-bottom-area" style="position:relative; padding:10px 12px; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.4); border-top:1px solid rgba(255,255,255,0.05);">
                <div class="req-text" style="font-family:var(--font-mono); font-size:1.2rem; color:#fbbf24; font-weight:900; text-shadow:0 1px 3px rgba(0,0,0,1);">
                    <span id="d-req-${id}">0</span><span style="font-size:0.8rem; color:var(--text-sub); margin-left:4px;">필요</span>
                </div>
                <div id="craft-wrap-${id}" style="position:absolute; right:12px;"></div>
            </div>
        </div>`;

    const getGroupHtml = (id, title, items, parentId, extraStyle = '') => `
        <div class="deduct-group" id="${id}" ${extraStyle}>
            <div class="deduct-group-title">${title}</div>
            <div class="deduct-grid" id="${parentId}">
                ${items.map(u => renderSlot(u.id, u.name, u.grade, parentId)).join('')}
            </div>
        </div>`;

    const allUnits = Array.from(unitMap.values());

    let html = `<div id="deduct-empty-msg" style="text-align:center; padding:40px 20px; color:var(--text-sub); font-weight:bold; width:100%; display:none; line-height:1.6; font-size:1.05rem;">
                  <div style="font-size:2rem; margin-bottom:12px; color:var(--g-dim);">✨</div> 목표 유닛을 선택하면<br>필요한 재료 목록이 이곳에 생성됩니다.
                </div>`;

    html += getGroupHtml('group-special',
        `<span style="color:var(--grade-super); text-shadow:0 0 10px var(--grade-super);">✦</span> 목표 유닛 및 직속 재료`,
        [{id:'갓오타', name:'갓오타', grade:'레어'}, {id:'메시브', name:'메시브', grade:'레어'}, {id:'자동포탑', name:'자동포탑', grade:'매직'}],
        'grid-special', 'style="border-color:rgba(251,191,36,0.3); background:linear-gradient(to bottom, rgba(30,25,10,0.6), rgba(15,10,5,0.8));"');

    html += getGroupHtml('group-hidden',
        `<span style="color:var(--grade-hidden);">♦</span> 히든 등급 재료`,
        allUnits.filter(u => u.grade === "히든" && !SPECIAL_UNIT_IDS.includes(u.id)), 'grid-hidden');

    const topGrades = ["슈퍼히든", "레전드", "헬", "유니크", "에픽", "레어"];
    const topItems = allUnits.filter(u => topGrades.includes(u.grade) && !SPECIAL_UNIT_IDS.includes(u.id))
                             .sort((a, b) => getGradeIndex(b.grade) - getGradeIndex(a.grade));
    html += getGroupHtml('group-top', `<span style="color:var(--grade-legend);">▲</span> 레어 - 레전드 재료`, topItems, 'grid-top', 'style="margin-bottom:0;"');

    board.innerHTML = html;
}

function updateDeductionBoard() {
    const board = getEl('deductionBoard');
    if (!board) return;

    const { reqMap, baseMap, reasonMap, specialReq, baseSpecialReq, specialReason } = calculateDeductedRequirements();
    const directMaterials = new Set();

    activeUnits.forEach((_, uid) => unitMap.get(uid)?.parsedRecipe?.forEach(pr => pr.id && directMaterials.add(pr.id)));

    const updateSlot = (id, netReq, baseReq, reasons) => {
        const wrapEl = getEl(`d-slot-wrap-${id}`);
        if (!wrapEl) return;

        if (baseReq > 0) {
            wrapEl.style.display = 'flex';
            wrapEl.classList.add('is-visible');

            const reasonContainer = getEl(`d-reason-${id}`);
            const condEl = getEl(`d-cond-${id}`);

            if (reasons?.size > 0 && netReq > 0) {
                if (reasonContainer) {
                    reasonContainer.innerHTML = Array.from(reasons.entries())
                        .map(([rId, info]) => `<span class="d-reason-tag" onclick="toggleHighlight('${rId}', event)">${info.text || info}</span>`).join('');
                    reasonContainer.style.display = 'flex';
                }
                if (condEl) {
                    let conds = [...new Set(Array.from(reasons.values()).map(i => i.cond).filter(c => c))];
                    if (conds.length > 0) {
                        condEl.innerHTML = conds.map(c => `[${c}]`).join(' / ');
                        condEl.style.display = 'block';
                    } else condEl.style.display = 'none';
                }
            } else {
                if (reasonContainer) reasonContainer.style.display = 'none';
                if (condEl) condEl.style.display = 'none';
            }

            const isTarget = activeUnits.has(id);
            wrapEl.style.order = isTarget ? "-999" : (SPECIAL_UNIT_IDS.includes(id) ? "999" : "-1");

            const reqEl = getEl(`d-req-${id}`);
            const craftWrap = getEl(`craft-wrap-${id}`);

            if (netReq > 0) {
                wrapEl.classList.remove('is-completed');
                wrapEl.classList.add('has-target');
                if (reqEl) reqEl.innerText = netReq;

                if (craftWrap) {
                    let isTargetReady = isTarget && !unitMap.get(id)?.parsedRecipe?.some(pr => {
                        let requiredQty = (id === '로리스완' && pr.id === '낮까마귀') ? 1 : pr.qty * netReq;
                        return (completedUnits.get(pr.id) || 0) < requiredQty;
                    }) && !unitMap.get(id)?.parsedCost?.some(pc => ['갓오타','메시브'].includes(pc.key) && (completedUnits.get(pc.key) || 0) < pc.qty * netReq);

                    craftWrap.innerHTML = isTargetReady
                        ? `<button class="btn-complete final-target" onclick="completeUnit('${id}'); event.stopPropagation();">✨ 최종 제작 완료</button>`
                        : `<button class="btn-complete" onclick="completeUnit('${id}'); event.stopPropagation();">✔ 완료</button>`;
                }
            } else {
                wrapEl.classList.remove('has-target');
                wrapEl.classList.add('is-completed');
                if (reqEl) reqEl.innerText = '0';
                if (craftWrap) craftWrap.innerHTML = `<span style="font-size:0.85rem; color:var(--g-dim); font-weight:bold; padding-right:4px;">✨ 완료됨</span>`;
            }

            const targetParent = (directMaterials.has(id) || isTarget) ? getEl('grid-special') : getEl(wrapEl.dataset.origParent);
            if (targetParent && wrapEl.parentElement !== targetParent) targetParent.appendChild(wrapEl);
        } else {
            wrapEl.style.display = 'none';
            wrapEl.classList.remove('is-visible');
        }
    };

    updateSlot('갓오타', specialReq.갓오타, baseSpecialReq.갓오타, specialReason.갓오타);
    updateSlot('메시브', specialReq.메시브, baseSpecialReq.메시브, specialReason.메시브);
    updateSlot('자동포탑', reqMap.get('자동포탑') || 0, baseMap.get('자동포탑') || 0, reasonMap.get('자동포탑'));

    unitMap.forEach(u => {
        if (["레어", "에픽", "유니크", "헬", "레전드", "히든", "슈퍼히든"].includes(u.grade) && u.id !== '자동포탑') {
            updateSlot(u.id, reqMap.get(u.id) || 0, baseMap.get(u.id) || 0, reasonMap.get(u.id));
        }
    });

    let hasVisible = false;
    document.querySelectorAll('.deduct-group').forEach(group => {
        const isVisible = group.querySelectorAll('.deduct-slot.is-visible').length > 0;
        group.style.display = isVisible ? 'block' : 'none';
        if (isVisible) hasVisible = true;
    });

    getEl('deduct-empty-msg').style.display = hasVisible ? 'none' : 'block';

    if (_currentHighlight) {
        const deps = getDependencies(_currentHighlight);
        document.querySelectorAll('.deduct-slot').forEach(el => el.classList.toggle('highlighted-tree', deps.has(el.id.replace('d-slot-wrap-', ''))));
    }
}

function renderTabs() {
    const tabs = getEl('codexTabs');
    if (tabs) {
        tabs.innerHTML = TAB_CATEGORIES.map((cat, idx) => `
            <button id="tab-btn-${idx}" class="tab-btn" onclick="selectTab(${idx})">
                <span class="tab-sym" style="font-size:1.1rem; padding:2px 5px; border-radius:3px; background:rgba(0,0,0,0.3); border:1px solid var(--border-light); color:var(--text-sub);">${cat.sym}</span>
                <span>${cat.name}</span>
            </button>`).join('');
        updateTabsUI();
    }
}

function updateTabsUI() {
    TAB_CATEGORIES.forEach((cat, idx) => {
        let hasSelected = Array.from(activeUnits.keys()).some(id => unitMap.get(id)?.category === cat.key);
        const btn = getEl(`tab-btn-${idx}`);
        if (!btn) return;

        btn.classList.toggle('active', idx === _activeTabIdx);
        btn.classList.toggle('has-active', hasSelected);

        const sym = btn.querySelector('.tab-sym');
        if (sym) {
            sym.style.color = hasSelected ? 'var(--g)' : 'var(--text-sub)';
            sym.style.borderColor = hasSelected ? 'var(--g-border)' : 'var(--border-light)';
            sym.style.boxShadow = hasSelected ? '0 0 5px var(--g-faint)' : 'none';
            sym.style.textShadow = hasSelected ? '0 0 5px var(--g-glow)' : 'none';
        }
    });
}

function formatRecipe(item, multiplier = 1, showSep = false) {
    if (!item.recipe || IGNORE_PARSE_RECIPES.includes(item.recipe)) return `<div style="color:var(--text-muted);font-size:0.85rem;">정보 없음</div>`;

    let partsHtml = item.recipe.split(/\+(?![^()]*\))/).map((part, i, arr) => {
        const m = part.trim().match(/^([^(\[]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/);
        let html = '';
        if (m) {
            const raw = m[1].trim(), u = unitMap.get(getUnitId(raw)), color = u ? gradeColorsRaw[u.grade] : "var(--text)";
            let qty = (m[3] ? parseFloat(m[3]) : 1) * multiplier;
            html = `<div class="recipe-badge" style="color:${color}; border-color:${color}44;">${raw} <span class="badge-cond">${m[2] ? `(${m[2]})` : ''}[${qty}]</span></div>`;
        } else html = `<div style="color:var(--text-sub); font-size:0.85rem; white-space:nowrap;">${part}</div>`;

        if (showSep && i < arr.length - 1) html += `<div style="color:var(--text-muted); font-size:0.9rem; font-weight:bold;">+</div>`;
        return html;
    }).join('');

    return `<div class="${showSep ? '' : 'recipe-vertical'}" ${showSep ? 'style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;"' : ''}>${partsHtml}</div>`;
}

const formatRecipeHorizontal = (item, m = 1) => formatRecipe(item, m, false);
const formatRecipeTooltip = (item, m = 1) => formatRecipe(item, m, true);

function selectTab(idx) {
    _activeTabIdx = idx;
    updateTabsUI(); renderCurrentTabContent();
    if (_jewelPanelOpen) closeJewelPanel();
}

let _isTabContentInitialized = false;

// [개선] 탭 콘텐츠 내 썸네일 노드 (uc-thumb-box) 완전 제거
function initAllTabContents() {
    const tc = getEl('tabContent');
    if (!tc) return;

    let html = '';
    TAB_CATEGORIES.forEach((cat) => {
        let items = Array.from(unitMap.values()).filter(u => isTargetGrade(u) && u.category === cat.key);

        items.sort((a, b) => {
            const specialOrders = { "아몬": 100, "어두운목소리": 99, "나루드": 97, "유물": 96 };
            if (specialOrders[a.name] || specialOrders[b.name]) return (specialOrders[b.name] || 0) - (specialOrders[a.name] || 0);
            if (isOneTime(a) !== isOneTime(b)) return isOneTime(a) ? -1 : 1;
            if (a.grade !== b.grade) return getGradeIndex(b.grade) - getGradeIndex(a.grade);
            return calculateTotalCostScore(b) - calculateTotalCostScore(a);
        });

        html += `<div id="cat-group-${cat.key}" class="cat-group" style="display:none; flex-direction:column; gap:4px;">`;
        if (items.length === 0) {
            html += `<div style="text-align:center; padding:30px; color:var(--text-sub); font-weight:bold; font-size:1.05rem;">해당 분류에 유닛이 없습니다.</div>`;
        } else {
            html += items.map((item, idx) => {
                const stepper = isOneTime(item) ? '' : `
                    <div class="smart-stepper active-stepper">
                        <button id="btn-minus-${item.id}" onmousedown="startSmartChange('${item.id}', -1, 'active', event)" ontouchstart="startSmartChange('${item.id}', -1, 'active', event)">-</button>
                        <div class="ss-val" id="val-${item.id}">-</div>
                        <button id="btn-plus-${item.id}" onmousedown="startSmartChange('${item.id}', 1, 'active', event)" ontouchstart="startSmartChange('${item.id}', 1, 'active', event)">+</button>
                    </div>`;

                return `
                <div id="card-${item.id}" class="unit-card" style="animation-delay:${idx * 0.03}s" onclick="toggleUnitSelection('${item.id}', 1)">
                    <div class="uc-wrap">
                        <div class="uc-identity">
                            <div class="uc-grade"><span class="gtag" style="border-color:${gradeColorsRaw[item.grade]}44; color:${gradeColorsRaw[item.grade]};">${item.grade}</span></div>
                            <div class="uc-name-row" style="color:${gradeColorsRaw[item.grade]};">${item.name}</div>
                        </div>
                        <div class="uc-recipe-col">${formatRecipeHorizontal(item)}</div>
                        <div class="uc-ctrl" onclick="event.stopPropagation()">${stepper}</div>
                    </div>
                </div>`;
            }).join('');
        }
        html += `</div>`;
    });

    tc.innerHTML = html;
    _isTabContentInitialized = true;
}

function renderCurrentTabContent() {
    if (!_isTabContentInitialized) initAllTabContents();

    TAB_CATEGORIES.forEach((cat, idx) => {
        const group = getEl(`cat-group-${cat.key}`);
        if (group) group.style.display = (idx === _activeTabIdx) ? 'flex' : 'none';
    });

    updateTabContentUI();
}

function updateTabContentUI() {
    unitMap.forEach(item => {
        if (item.category !== TAB_CATEGORIES[_activeTabIdx].key) return;
        const card = getEl(`card-${item.id}`);
        if (!card) return;

        const isActive = activeUnits.has(item.id);
        card.classList.toggle('active', isActive);

        if (!isOneTime(item)) {
            const valEl = getEl(`val-${item.id}`);
            if (valEl) valEl.innerText = isActive ? activeUnits.get(item.id) : '-';
            ['minus', 'plus'].forEach(t => {
                const btn = getEl(`btn-${t}-${item.id}`);
                if (btn) btn.disabled = !isActive;
            });
        }
    });
}

function renderDashboardAtoms() {
    const db = getEl('magicDashboard');
    if (!db) return;

    db.innerHTML = `
        <div class="cost-slot total" id="slot-total-magic">
            <div class="cost-val" id="magic-total-val">0</div>
            <div class="cost-name">통합 코스트</div>
        </div>
        <div class="cost-slot total" id="slot-total-essence">
            <div class="cost-val" id="essence-total-val">0</div>
            <div class="cost-name">통합 정수</div>
        </div>
        ${['coral|#FF6B6B|코랄', 'aiur|var(--grade-rare)|아이어', 'zerus|var(--grade-legend)|제루스'].map(d => {
            let [id, color, name] = d.split('|');
            return `<div class="cost-slot" id="slot-${id}">
                        <div class="cost-val" id="val-${id}" style="color:${color};">0</div>
                        <div class="cost-sub" id="sub-${id}" style="font-size:0.8rem; margin:-2px 0 2px; height:14px; font-family:var(--font-mono); line-height:1; display:flex; gap:4px; align-items:center; justify-content:center;"></div>
                        <div class="cost-name">${name}</div>
                    </div>`;
        }).join('')}
        ${dashboardAtoms.map(a => `
            <div class="cost-slot ${a === '갓오타/메시브' ? 'is-skill-slot' : 'is-magic-slot'}" id="vslot-${clean(a)}">
                <div class="cost-val"></div>
                <div class="cost-name" id="name-${clean(a)}">${a}</div>
            </div>`).join('')}`;
}

// [개선] 쥬얼 도감 썸네일은 유지하고 loading="lazy" 적용
function renderJewelMiniGrid() {
    const g = getEl('jewelMiniGrid');
    if (!g || g.dataset.rendered || typeof JEWEL_DATABASE === 'undefined') return;

    g.dataset.rendered = '1';
    g.innerHTML = JEWEL_DATABASE.map(arr => {
        const kr = arr[0], c = (typeof JEWEL_COLORS !== 'undefined' ? JEWEL_COLORS[kr] : null) || "#ffffff";
        return `
        <div class="jwm-item" style="--jw-color:${c};--jw-color-a:${c}22;">
            <div class="jwm-img-wrap"><img src="https://sldbox.github.io/site/image/jw/${arr[3] || kr}.png" loading="lazy" onerror="this.style.opacity='0'"></div>
            <div class="jwm-name">${kr}</div>
            <div class="jwm-stat legend"><span>${arr[1]}</span></div>
            ${arr[2]?.trim() ? `<div class="jwm-stat mythic"><span>✦ ${arr[2]}</span></div>` : ''}
        </div>`;
    }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        document.documentElement.lang = 'ko';
        document.documentElement.setAttribute('data-theme', 'dark');

        const intro = getEl('introCinematic');
        const main = getEl('mainLayout');
        const counterEl = getEl('introCounter');
        const fillEl = document.querySelector('.loader-fill');

        if (intro && main && counterEl && fillEl) {
            let progress = 0;
            const duration = 2000;
            const interval = 30;
            const step = 100 / (duration / interval);

            setTimeout(() => {
                const timer = setInterval(() => {
                    progress += step + (Math.random() * 2.5);
                    if (progress >= 100) {
                        progress = 100;
                        clearInterval(timer);
                        counterEl.innerText = "100%";
                        fillEl.style.width = "100%";

                        setTimeout(() => {
                            intro.classList.add('hidden');
                            setTimeout(() => {
                                main.style.opacity = '1';
                                main.style.transform = 'scale(1)';
                            }, 400);
                        }, 500);
                    } else {
                        counterEl.innerText = Math.floor(progress) + "%";
                        fillEl.style.width = progress + "%";
                    }
                }, interval);
            }, 600);
        }

        if (typeof UNIT_DATABASE === 'undefined') { console.error("[오류] 데이터베이스 로드 실패"); return; }

        UNIT_DATABASE.forEach(kArr => unitMap.set(clean(kArr[0]), {
            id: clean(kArr[0]), name: kArr[0], grade: kArr[1] || "매직",
            category: kArr[2] || "테바", recipe: kArr[3], cost: kArr[4]
        }));

        initializeCacheEngine();
        renderDashboardAtoms(); renderDeductionBoard(); renderTabs();
        selectTab(0); debouncedUpdateAllPanels();
        setupSearchEngine(); setupInitialView();

        const swipeArea = getEl('tabContent');
        if (swipeArea) {
            let startX = 0;
            swipeArea.addEventListener('touchstart', e => startX = e.changedTouches[0].screenX, { passive: true });
            swipeArea.addEventListener('touchend', e => {
                const diff = e.changedTouches[0].screenX - startX;
                if (Math.abs(diff) > 70) selectTab(_activeTabIdx + (diff > 0 ? ( _activeTabIdx > 0 ? -1 : 0) : ( _activeTabIdx < TAB_CATEGORIES.length - 1 ? 1 : 0)));
            }, { passive: true });
        }
    } catch (err) { console.error("[오류] 넥서스 초기화 중 에러 발생:", err); }
});