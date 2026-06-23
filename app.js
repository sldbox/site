// ==========================================================================
// [ 넥서스 앱 실행 파일 (app.js) ]
//  1.  내부 기본 설정        앱 정책·등급·탭·저장 키·보드 구조와 사용자 설정 병합
//  2.  초기 상태·상수        전역 상태, DOM 헬퍼, 정규화 헬퍼
//  3.  저장·검색·명령        localStorage, 검색 엔진, 프리셋/명령 처리
//  4.  계산 엔진             재료 파싱, 정수 계산, BFS 필요 수량, 의존성 캐시
//  5.  완료·복구             완료 처리, 그룹 복구, 통합 초기화
//  6.  통합 보드             코스트·정수·매직 슬롯 렌더링과 빈 상태 유지
//  7.  체크리스트            조합 트리, 그룹, 완료 숨김, 하이라이트
//  8.  도감·탭·프리셋        종족 탭, 카드 렌더링, 프리셋 버튼
//  9.  장바구니·툴팁         장바구니 탭/목록, 조합법 툴팁, 폰트 조절
// 10.  이벤트 바인딩         클릭·포인터·키보드·리사이즈 이벤트
// 11.  Boot 연동 초기화      DOM 준비/동적 로드 대응, 성공·실패 상태 전달
// ==========================================================================

(() => {

    // [1] 내부 기본 설정 + config.js 사용자 편집값 병합
    const USER_CONFIG = window.NEXUS_USER_CONFIG || {};
    const APP_DEFAULT_CONFIG = {
        policy: {
            hybridWeight: 3,
            maxUnitCapacity: 16,
            oneTimeMinGrade: "슈퍼히든",
            hiddenGroupMinGrade: "히든",
            minGradeForChecklist: "레어",
            magicComboKey: "갓오타/메시브",
            hideCompletedExcludeGroups: ["최종 목표", "기초 재료"],
            restoreAllBtn: {
                idBtn: "btnRestoreAll",
                idLabel: "btnRestoreAllLabel",
                labelDefault: "통합 초기화",
                labelDone: "초기화됨 ✓",
                classDone: "reset-btn-done"
            }
        },
        grades: {
            order: ["매직", "레어", "에픽", "유니크", "헬", "레전드", "히든", "슈퍼히든"],
            colors: {
                "매직": "var(--grade-magic)", "레어": "var(--grade-rare)", "에픽": "var(--grade-epic)", "유니크": "var(--grade-unique)",
                "헬": "var(--grade-hell)", "레전드": "var(--grade-legend)", "히든": "var(--grade-hidden)", "슈퍼히든": "var(--grade-super)"
            }
        },
        tabs: [
            { key: "테바", name: "테바" }, { key: "테메", name: "테메" },
            { key: "토바", name: "토바" }, { key: "토메", name: "토메" },
            { key: "저그중립", name: "저그중립" }, { key: "혼종", name: "혼종" }
        ],
        essence: {
            mapping: { "테바": "코랄", "테메": "코랄", "토바": "아이어", "토메": "아이어", "저그중립": "제루스", "혼종": "혼종" },
            display: [
                { id: "coral", color: "#FF6B6B", name: "코랄" },
                { id: "aiur", color: "var(--grade-rare)", name: "아이어" },
                { id: "zerus", color: "var(--grade-legend)", name: "제루스" },
                { id: "hybrid", color: "var(--grade-hidden)", name: "혼종" }
            ]
        },
        sorting: { order: { "아몬": 100, "나루드": 97, "유물": 96 } },
        groupDefs: [
            { id: 'group-target',       pid: 'grid-target',       title: '최종 목표', resetLevel: 5, isCol: false, alwaysShow: false, alwaysOpen: true,  resetLabel: '최종 복구' },
            { id: 'group-special',      pid: 'grid-special',      title: '직속 재료', resetLevel: 4, isCol: false, alwaysShow: false, alwaysOpen: true,  resetLabel: '직속 복구' },
            { id: 'group-upper-hidden', pid: 'grid-upper-hidden', title: '상위 히든', resetLevel: 3, isCol: true,  alwaysShow: false, alwaysOpen: false, resetLabel: '상위 복구' },
            { id: 'group-basic-hidden', pid: 'grid-basic-hidden', title: '하위 히든', resetLevel: 2, isCol: true,  alwaysShow: false, alwaysOpen: false, resetLabel: '하위 복구' },
            { id: 'group-top',          pid: 'grid-top',          title: '기초 재료', resetLevel: 1, isCol: true,  alwaysShow: true,  alwaysOpen: false, resetLabel: '기초 복구' }
        ],
        topFixedOrder: [
            ["죽음의머리", "검은망치", "광전사석상", "교란기", "라바사우르스"],
            ["악령", "ARES", "정화자사도", "선동자", "브루탈리스크"],
            ["짐레이너", "대천사", "제라툴", "거신", "케리건"],
            ["스투코프", "오딘", "혼종파멸자", "분노수호자", "혼종약탈자"],
            ["공허포격기", "우르사돈수", "우르사돈암", "테이스틀로프", "아토실로프"],
            ["노바", "히페리온", "보라준", "공허의구도자", "거대괴수"],
            ["특공대레이너", "고르곤전투순양함", "아르타니스", "셀렌디스", "원시케리건"],
            ["자이언트플라워", "유물조각", "자동포탑", "갓오타", "메시브"]
        ],
        dashboardAtoms: [
            "전쟁광", "스파르타중대", "암흑광전사", "암흑파수기", "원시바퀴",
            "저격수", "코브라", "암흑고위기사", "암흑추적자", "변종가시지옥",
            "망치경호대", "공성파괴단", "암흑집정관", "암흑불멸자", "원시히드라리스크",
            "땅거미지뢰", "자동포탑", "우르사돈암", "우르사돈수", "갓오타/메시브"
        ],
        storageKeys: window.NEXUS_STORAGE_KEYS || {
            saveData: "nexusSaveData",
            favorites: "nexusFavorites",
            fontScale: "nexusFontScale"
        },
        search: {
            minGradeForSearch: "레전드",
            hiddenIds: [],
            restrictedIds: [],
            searchAllowIds: []
        }
    };
    const SYSTEM_CONFIG = {
        ...APP_DEFAULT_CONFIG,
        tools: USER_CONFIG.tools || {},
        unitBehaviors: USER_CONFIG.unitBehaviors || {},
        oneTimeIds: USER_CONFIG.oneTimeIds || [],
        specialConditions: USER_CONFIG.specialConditions || {},
        unitConditions: USER_CONFIG.unitConditions || {},
        presets: USER_CONFIG.presets || [],
        search: {
            ...APP_DEFAULT_CONFIG.search,
            ...(USER_CONFIG.search || {})
        }
    };

    // [2] 초기 상태·상수
    const IGNORE_PARSE_RECIPES = ["미발견", "없음", ""];
    const clean = (s) => s ? s.replace(/\s+/g, '').toLowerCase() : '';
    const ATOM_HASH = Object.fromEntries(SYSTEM_CONFIG.dashboardAtoms.map(a => [clean(a), a]));
    const makeCleanSet = (list = []) => new Set(list.map(clean).filter(Boolean));
    const CLEAN_TOOLS_MAP = Object.fromEntries(Object.entries(SYSTEM_CONFIG.tools).map(([k, v]) => [clean(k), v.map(clean)]));
    const CLEAN_HIDDEN_IDS = makeCleanSet(SYSTEM_CONFIG.search.hiddenIds || []);
    const CLEAN_RESTRICTED_IDS = makeCleanSet(SYSTEM_CONFIG.search.restrictedIds || []);
    const CLEAN_SEARCH_ALLOW_IDS = new Set((SYSTEM_CONFIG.search.searchAllowIds || []).map(clean));
    const _behaviors = SYSTEM_CONFIG.unitBehaviors || {};
    const SPECIAL_RENDER_LIST = Object.entries(_behaviors).filter(([, b]) => b.specialRender).map(([id, b]) => ({ id: clean(id), raw: id, batch: b.batch || 1 }));
    const COMBO_SLOT_SET = new Set(Object.entries(_behaviors).filter(([, b]) => b.comboSlot).map(([id]) => clean(id)));
    const COMBO_SLOT_RAWS = Object.entries(_behaviors).filter(([, b]) => b.comboSlot).map(([id]) => id);
    const CLEAN_ONE_TIME_UNITS = new Set((SYSTEM_CONFIG.oneTimeIds || []).map(clean));
    const CLEAN_PRESET_NOSTACK = new Set(Object.entries(_behaviors).filter(([, b]) => b.presetNoStack).map(([id]) => clean(id)));
    const CLEAN_CRAFT_BATCH = Object.fromEntries(SPECIAL_RENDER_LIST.map(e => [e.id, e.batch]));
    const AUTO_COMPLETE_IDS = SPECIAL_RENDER_LIST.filter(e => !COMBO_SLOT_SET.has(e.id)).map(e => e.id);
    const CLEAN_SPECIAL_CONDITIONS = Object.fromEntries(Object.entries(SYSTEM_CONFIG.specialConditions).map(([k, v]) => [clean(k), v]));
    const CLEAN_UNIT_CONDITIONS = Object.fromEntries(Object.entries(SYSTEM_CONFIG.unitConditions || {}).map(([k, v]) => [clean(k), v]));
    const GROUP_DEFS = SYSTEM_CONFIG.groupDefs;
    const titleToGridId = Object.fromEntries(GROUP_DEFS.map(g => [g.title, g.pid]));
    const unitMap = new Map(), activeUnits = new Map(), completedUnits = new Map(), depCache = new Map();
    const completedTargets = new Map(), _unitNativeLevels = new Map();
    const PRESET_COLOR_MAP = {
        '빨강':'red', '주황':'orange', '노랑':'yellow', '연두':'lime',
        '초록':'green', '하늘':'sky', '파랑':'blue', '남색':'navy',
        '보라':'purple', '분홍':'pink', '청록':'cyan',
        '흰색':'white', '검정':'black', '회색':'gray', '금색':'gold'
    };
    const isBrightColor = (name) => ['노랑','연두','하늘','흰색','금색'].includes(name);
    const FAVORITES_KEY = SYSTEM_CONFIG.storageKeys?.favorites || 'nexusFavorites';
    // 변경 빈도가 낮은 내부 안전장치·조작 정책은 config.js 대신 app.js에서 관리한다.
    const APP_INTERNAL = {
        maxLoopQueue: 1000,
        hapticDuration: 15,
        searchFailFeedbackDelay: 1500,
        completeLockDelay: 300,
        appVersionDisplayMs: 1500,
        accelInterval: 80,
        accelMinInterval: 20,
        accelDecreaseStep: 5,
        accelStepUnit: 6,
        accelShiftMultiplier: 5,
        holdStartDelay: 400,
        mouseAfterTouchDelay: 500,
        fontHoldStartDelay: 600,
        fontHoldRepeatDelay: 300,
        fontScaleMin: 0.8,
        fontScaleMax: 2.0,
        fontScaleStep: 0.05,
        mobileBreakpoint: 768,
        tabletPortraitMax: 1024,
        tooltipFallbackWidth: 290,
        tooltipFallbackHeight: 150,
        tooltipOffset: 15,
        tooltipScrollPad: 10,
        tooltipMaxWidthPad: 20,
        restoreAllResetDelay: 1500,
        restoreAllPendingDelay: 2000
    };

    const markNexusAppReady = () => {
        if (typeof window.nexusMarkAppReady === 'function') {
            window.nexusMarkAppReady();
            return;
        }
        try { document.documentElement.classList.remove('nexus-booting', 'nexus-boot-error'); } catch(e) {}
    };
    const markNexusAppError = (code, error) => {
        if (typeof window.nexusShowBootError === 'function') {
            window.nexusShowBootError(code, error);
            return;
        }
        try { window.NEXUS_LAST_INIT_ERROR = { code, error, time: Date.now() }; } catch(e) {}
        try { alert("초기화 중 치명적인 오류가 발생했습니다.\n\n" + (error?.stack || error)); } catch(e) {}
    };

    const _favorites = new Set((() => { try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); } catch(e) { return []; } })());
    let _activeTabIdx = 0, _currentViewMode = 'codex', _currentHighlight = null, _hideCompleted = false;
    let _cartTab = 'active', _cartCollapsed = false, _isTabContentInitialized = false;
    let repeatTimer = null, repeatDelayTimer = null, _lastInteractionTime = 0, _currentAccelInterval = APP_INTERNAL.accelInterval, _touchHoldCount = 0;
    let updateTimer = null, _completeLock = new Set(), _presetUsed = new Map(), _restoreAllCooldown = false;
    let _lastCalcResult = null;
    let _fontRepeatTimer = null, _fontRepeatDelayTimer = null, _swipeTimer = null, _titleVersionTimer = null;
    let _presetTab = '일반 프리셋';

    const getEl = (id) => document.getElementById(id);
    const triggerHaptic = () => navigator.vibrate?.(APP_INTERNAL.hapticDuration);
    const virtualUnitIds = new Set(AUTO_COMPLETE_IDS);
    const isToolRequirement = (parent, child) => CLEAN_TOOLS_MAP[parent]?.includes(child);
    const getToolNeed = (parent) => CLEAN_TOOLS_MAP[parent] || [];
    const isSpecialRender = (id) => SPECIAL_RENDER_LIST.some(e => e.id === id);
    const isSearchAllowed = (id) => CLEAN_SEARCH_ALLOW_IDS.has(id);
    const isHiddenUnit = (id) => CLEAN_HIDDEN_IDS.has(id);
    const isRestrictedUnit = (id) => CLEAN_RESTRICTED_IDS.has(id);
    const getGradeIndex = (grade) => Math.max(SYSTEM_CONFIG.grades.order.indexOf(grade), -99);
    const isOneTime = (u) => u && (CLEAN_ONE_TIME_UNITS.has(u.id) || getGradeIndex(u.grade) >= getGradeIndex(SYSTEM_CONFIG.policy.oneTimeMinGrade || "슈퍼히든"));
    const getUnitId = (rawName) => clean(rawName);
    const calculateTotalCostScore = (u) => u?.parsedCost?.reduce((sum, pc) => sum + (pc.qty || 0), 0) || 0;
    const getNexusVersion = () => window.APP_VERSION || window.NEXUS_BUILD_VERSION || '';
    const normalizeUnitQty = (uid, qty) => {
        const u = unitMap.get(uid);
        if (!u) return 0;
        const n = parseInt(qty, 10);
        if (!Number.isFinite(n) || n <= 0) return 0;
        return isOneTime(u) ? 1 : Math.min(n, SYSTEM_CONFIG.policy.maxUnitCapacity);
    };
    const setPositiveMapValue = (map, uid, qty) => {
        const normalized = normalizeUnitQty(uid, qty);
        if (normalized > 0) map.set(uid, normalized);
    };
    const compareUnitForDisplay = (a, b) =>
        (isOneTime(b) ? 1 : 0) - (isOneTime(a) ? 1 : 0) ||
        getGradeIndex(b.grade) - getGradeIndex(a.grade) ||
        (SYSTEM_CONFIG.sorting.order[b.name] || 0) - (SYSTEM_CONFIG.sorting.order[a.name] || 0) ||
        calculateTotalCostScore(b) - calculateTotalCostScore(a) ||
        (a.name || '').localeCompare(b.name || '');
    const getUnitsFromMap = (map) => Array.from(map.keys()).map(uid => unitMap.get(uid)).filter(Boolean).sort(compareUnitForDisplay);
    const normalizeSavedId = (id) => typeof id === 'string' ? clean(id) : '';
    const applySearchFeedback = (input, message) => {
        if (!input) return;
        const originalPlaceholder = input.placeholder;
        input.value = '';
        input.classList.add('search-input-error');
        input.placeholder = message;
        setTimeout(() => {
            input.placeholder = originalPlaceholder;
            input.classList.remove('search-input-error');
        }, APP_INTERNAL.searchFailFeedbackDelay);
    };
    function sanitizeRuntimeState() {
        const normalizeMap = (map, allowCombo = false) => {
            for (const [rawUid, rawQty] of [...map.entries()]) {
                const uid = normalizeSavedId(rawUid);
                const qty = parseInt(rawQty, 10);
                map.delete(rawUid);
                if (!Number.isFinite(qty) || qty <= 0) continue;
                if (unitMap.has(uid)) setPositiveMapValue(map, uid, qty);
                else if (allowCombo && COMBO_SLOT_SET.has(uid)) map.set(uid, qty);
            }
        };
        normalizeMap(activeUnits);
        normalizeMap(completedTargets);
        normalizeMap(completedUnits, true);
        completedTargets.forEach((_, uid) => activeUnits.delete(uid));
        if (!['active', 'done'].includes(_cartTab)) _cartTab = 'active';
        if (_cartTab === 'done' && completedTargets.size === 0 && activeUnits.size > 0) _cartTab = 'active';
        _cartCollapsed = false;
    }


    // [2] 유틸
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
        depCache.clear();
        unitMap.forEach(u => {
            u.parsedCost = [];
            if (u.cost && !IGNORE_PARSE_RECIPES.includes(u.cost)) {
                u.cost.replace(/\//g, '+').split('+').forEach(p => {
                    const m = p.match(/(.+?)\[(\d+)\]/);
                    let cName = clean(m ? m[1].trim() : p.trim()), qty = m ? parseInt(m[2], 10) : 1;
                    let type = 'atom', key = cName;
                    if (COMBO_SLOT_SET.has(cName)) { type = 'special'; }
                    else {
                        const spKey = AUTO_COMPLETE_IDS.find(k => k === cName || cName.includes(k));
                        if (spKey) key = spKey; else key = ATOM_HASH[getUnitId(cName)] || getUnitId(cName);
                    }
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

    // [3] 저장·불러오기·커맨드
    function loadNexusState() {
        try {
            const data = localStorage.getItem(SYSTEM_CONFIG.storageKeys.saveData);
            if (!data) return;
            const state = JSON.parse(data);
            if (!state || typeof state !== 'object') return;

            activeUnits.clear();
            completedUnits.clear();
            completedTargets.clear();
            _presetUsed.clear();

            state.active?.forEach(([k, v]) => setPositiveMapValue(activeUnits, normalizeSavedId(k), v));
            state.completed?.forEach(([k, v]) => {
                const uid = normalizeSavedId(k);
                const q = parseInt(v, 10);
                if (!Number.isFinite(q) || q <= 0) return;
                if (unitMap.has(uid)) setPositiveMapValue(completedUnits, uid, q);
                else if (COMBO_SLOT_SET.has(uid)) completedUnits.set(uid, q);
            });
            state.completedTargets?.forEach(([k, v]) => setPositiveMapValue(completedTargets, normalizeSavedId(k), v));
            _cartTab = ['active', 'done'].includes(state.cartTab) ? state.cartTab : 'active';
            state.presetUsed?.forEach(([k, v]) => {
                const idx = parseInt(k, 10);
                if (Number.isInteger(idx) && SYSTEM_CONFIG.presets[idx]) _presetUsed.set(idx, !!v);
            });
            _hideCompleted = !!state.hideCompleted;
            _cartCollapsed = false;

            sanitizeRuntimeState();
        } catch(e) {
            console.warn("[오류] 저장된 데이터 로드 실패 — 초기화합니다.", e);
            activeUnits.clear(); completedUnits.clear(); completedTargets.clear(); _presetUsed.clear();
        }
    }

    let _saveFailCount = 0;
    function saveNexusState() {
        try {
            sanitizeRuntimeState();
            localStorage.setItem(SYSTEM_CONFIG.storageKeys.saveData, JSON.stringify({ active: [...activeUnits], completed: [...completedUnits], completedTargets: [...completedTargets], cartTab: _cartTab, presetUsed: [..._presetUsed], hideCompleted: _hideCompleted }));
            _saveFailCount = 0;
        } catch(e) {
            console.warn("[오류] 데이터 저장 실패", e);
            _saveFailCount++;
            if (_saveFailCount === 1) console.error("[경고] 브라우저 저장공간 부족으로 진행상황이 저장되지 않을 수 있습니다.");
        }
    }

    function saveFavorites() {
        try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([..._favorites].sort())); }
        catch(e) { console.warn('[오류] 즐겨찾기 저장 실패', e); }
    }

    function pruneFavorites() {
        let changed = false;
        [..._favorites].forEach(id => {
            if (!unitMap.has(id) || isHiddenUnit(id)) {
                _favorites.delete(id);
                changed = true;
            }
        });
        if (changed) saveFavorites();
    }

    function setupSearchEngine() {
        const inp = getEl('unitSearchInput');
        if (!inp) return;
        inp.addEventListener('keydown', e => {
            if (e.isComposing || e.keyCode === 229) return;
            if (e.key === 'Enter') { e.preventDefault(); processCommand(e.target.value); inp.blur(); }
        });
    }

    function findUnitFlexible(rawName) {
        let cleaned = clean(rawName);
        if (!cleaned) return null;
        const minGradeIdx = getGradeIndex(SYSTEM_CONFIG.search.minGradeForSearch || '레전드');
        let best = null, bestScore = -1;
        for (let [id, u] of unitMap) {
            if (isHiddenUnit(id) || (getGradeIndex(u.grade) < minGradeIdx && !isSearchAllowed(id))) continue;
            if (id === cleaned) return u;
            if (id.includes(cleaned)) {
                const score = 100 - id.indexOf(cleaned) * 10 - (id.length - cleaned.length);
                if (score > bestScore) { bestScore = score; best = u; }
            }
        }
        return best;
    }

    function processCommand(val, fromPreset = false) {
        if (!val.trim()) return;
        let successCount = 0, restrictedCount = 0;
        val.split('/').filter(c => c.trim()).forEach(cmd => {
            let parts = cmd.split('*'), targetName = parts[0].trim();
            if (!targetName) return;
            let qtyRaw = parseInt(parts[1], 10);
            let qty = (isNaN(qtyRaw) || qtyRaw < 1) ? 1 : Math.min(qtyRaw, SYSTEM_CONFIG.policy.maxUnitCapacity);
            const match = findUnitFlexible(targetName);
            if (match) {
                if (isRestrictedUnit(match.id) || isHiddenUnit(match.id)) { restrictedCount++; return; }
                if (fromPreset && CLEAN_PRESET_NOSTACK.has(match.id) && activeUnits.has(match.id)) { successCount++; return; }
                activeUnits.set(match.id, isOneTime(match) ? 1 : Math.min((activeUnits.get(match.id) || 0) + qty, SYSTEM_CONFIG.policy.maxUnitCapacity));
                successCount++;
            }
        });
        if (successCount > 0) {
            debouncedUpdateAllPanels();
            const searchInp = getEl('unitSearchInput');
            if (searchInp) searchInp.value = '';
            if (_currentViewMode === 'deduct') switchLayout('codex');
        } else {
            applySearchFeedback(getEl('unitSearchInput'), restrictedCount > 0 ? '선택제한 유닛입니다.' : '유닛을 찾을 수 없습니다.');
        }
    }

    // [4] 계산
    function calcEssenceRecursiveFast(uid, counts, visited) {
        if (visited.has(uid)) return;
        visited.add(uid);
        const u = unitMap.get(uid); if (!u) return;
        const hiddenGradeIdx = getGradeIndex(SYSTEM_CONFIG.policy.hiddenGroupMinGrade || "히든");
        if (getGradeIndex(u.grade) >= hiddenGradeIdx) {
            const tEssence = SYSTEM_CONFIG.essence.mapping[u.category];
            if (tEssence && counts[tEssence] !== undefined) counts[tEssence]++;
        }
        u.parsedRecipe?.forEach(pr => pr.id && calcEssenceRecursiveFast(pr.id, counts, visited));
    }

    function getEssenceCount(sourceMap) {
        let counts = {};
        Object.values(SYSTEM_CONFIG.essence.mapping).forEach(v => counts[v] = 0);
        let visited = new Set();
        try { sourceMap.forEach((qty, uid) => uid && qty > 0 && calcEssenceRecursiveFast(uid, counts, visited)); }
        catch(e) { console.warn('[정수계산 오류]', e); }
        Object.keys(counts).forEach(k => { if (isNaN(counts[k]) || counts[k] < 0) counts[k] = 0; });
        return counts;
    }

    function calculateDeductedRequirements() {
        let reqMap = new Map(), baseMap = new Map(), reasonMap = new Map();
        let specialReq = {}, baseSpecialReq = {}, specialReason = {};
        COMBO_SLOT_RAWS.forEach(k => { specialReq[k] = 0; baseSpecialReq[k] = 0; specialReason[k] = new Map(); });

        let mergedActive = new Set();
        activeUnits.forEach((_, uid) => unitMap.get(uid)?.parsedRecipe?.forEach(pr => pr.id && activeUnits.has(pr.id) && mergedActive.add(pr.id)));

        const calcBFS = (isDeficit) => {
            let map = new Map(), processed = new Map(), queue = [], inQueue = new Set();
            activeUnits.forEach((qty, uid) => { map.set(uid, isOneTime(unitMap.get(uid)) ? 1 : qty); queue.push(uid); inQueue.add(uid); });
            let loopCount = 0;
            const maxLoop = APP_INTERNAL.maxLoopQueue;
            
            while(queue.length > 0) {
                if (++loopCount > maxLoop) { console.warn('[안전장치] BFS 루프 한계 도달'); break; }
                let uid = queue.shift(); inQueue.delete(uid);
                let tNeed = map.get(uid) || 0;
                if ((!unitMap.has(uid) && !virtualUnitIds.has(uid)) || tNeed <= 0) continue;
                
                let eNeed = tNeed - (isDeficit ? Math.min(mergedActive.has(uid) ? 0 : (completedUnits.get(uid) || 0), tNeed) : 0);
                let delta = eNeed - (processed.get(uid) || 0);
                if (delta <= 0) continue;
                processed.set(uid, eNeed);
                
                getToolNeed(uid).forEach(tid => {
                    if (eNeed > 0) {
                        let nv = (map.get(tid) || 0) + delta;
                        if (isOneTime(unitMap.get(tid))) nv = Math.min(nv, 1);
                        map.set(tid, nv); if (!inQueue.has(tid)) { queue.push(tid); inQueue.add(tid); }
                    }
                });
                
                unitMap.get(uid)?.parsedRecipe?.forEach(c => {
                    if (c.id && !isToolRequirement(uid, c.id) && (unitMap.has(c.id) || virtualUnitIds.has(c.id))) {
                        let nv = (map.get(c.id) || 0) + (delta * c.qty);
                        if (isOneTime(unitMap.get(c.id))) nv = Math.min(nv, 1);
                        map.set(c.id, nv); if (!inQueue.has(c.id)) { queue.push(c.id); inQueue.add(c.id); }
                    }
                });
            }
            return map;
        };

        let baseDeficits = calcBFS(false);
        let deficits = calcBFS(true);

        baseDeficits.forEach((val, k) => val > 0 && baseMap.set(k, val));
        deficits.forEach((val, k) => val > 0 && reqMap.set(k, Math.max(0, val - (completedUnits.get(k) || 0))));

        const updateSpecials = (map, reqObj) => map.forEach((needed, uid) => unitMap.get(uid)?.parsedCost?.forEach(pc => {
            if (COMBO_SLOT_SET.has(pc.key)) reqObj[pc.key] += pc.qty * needed;
        }));
        
        updateSpecials(baseDeficits, baseSpecialReq);
        updateSpecials(deficits, specialReq);
        COMBO_SLOT_RAWS.forEach(k => specialReq[k] = Math.max(0, specialReq[k] - (completedUnits.get(k) || 0)));

        let rootTracking = new Map();
        baseDeficits.forEach((_, uid) => rootTracking.set(uid, new Map()));
        
        baseDeficits.forEach((needed, uid) => {
            if (needed <= 0) return;
            const uData = unitMap.get(uid); if (!uData) return;
            
            getToolNeed(uid).forEach(toolId => {
                let cRoots = rootTracking.get(toolId) || new Map();
                let isDirTarget = activeUnits.has(uid) && !mergedActive.has(uid);
                cRoots.set(`TOOL_${uid}`, { text: `${uData.name} <span class="tool-badge">[도구]</span>`, cond: '', depth: isDirTarget ? 1 : 2, parentUid: uid, reqQty: 1 });
                rootTracking.set(toolId, cRoots);
            });
            
            uData.parsedRecipe?.forEach(child => {
                if (!child.id || isToolRequirement(uid, child.id) || (!unitMap.has(child.id) && !virtualUnitIds.has(child.id))) return;
                let cRoots = rootTracking.get(child.id) || new Map();
                let isDirTarget = activeUnits.has(uid) && !mergedActive.has(uid);
                cRoots.set(`MAT_${uid}`, { text: isDirTarget ? `${uData.name} 직속재료` : `${uData.name} 재료`, cond: child.cond, depth: isDirTarget ? 1 : 2, parentUid: uid, reqQty: child.qty });
                rootTracking.set(child.id, cRoots);
            });
            
            uData.parsedCost?.forEach(pc => {
                if (COMBO_SLOT_SET.has(pc.key)) {
                    if ((deficits.get(uid) || 0) > 0) { // 필요 수량이 남았을 때만 글씨 생성
                        let isDirTarget = activeUnits.has(uid) && !mergedActive.has(uid);
                        specialReason[pc.key].set(`SPEC_${uid}`, { text: isDirTarget ? `${uData.name} 직속재료` : `${uData.name} 재료`, cond: '', depth: isDirTarget ? 1 : 2, parentUid: uid, reqQty: pc.qty });
                    }
                }
            });
        });

        const shouldKeepReason = (info, slotId) => {
            if (info.parentUid === undefined) return true;
            const slotCompleted = completedUnits.get(slotId) || 0;
            if (activeUnits.has(info.parentUid)) {
                return slotCompleted < (info.reqQty || 1) * (activeUnits.get(info.parentUid) || 1);
            }
            if ((reqMap.get(info.parentUid) || 0) <= 0) return false;
            const parentTotalNeeded = baseMap.get(info.parentUid) || 0;
            return !(parentTotalNeeded > 0 && slotCompleted >= (info.reqQty || 1) * parentTotalNeeded);
        };

        rootTracking.forEach((rMap, cId) => {
            let finalMap = new Map();
            rMap.forEach((info, key) => {
                if (shouldKeepReason(info, cId)) finalMap.set(key, info);
            });
            if (activeUnits.has(cId)) finalMap.set('TARGET_' + cId, { text: GROUP_DEFS.find(g => g.pid === 'grid-target')?.title || '', cond: '', depth: 0 });
            reasonMap.set(cId, finalMap);
        });

        COMBO_SLOT_RAWS.forEach(k => {
            const filtered = new Map();
            specialReason[k].forEach((info, key) => {
                if (shouldKeepReason(info, k)) filtered.set(key, info);
            });
            specialReason[k] = filtered;
        });

        return { reqMap, baseMap, reasonMap, specialReq, baseSpecialReq, specialReason };
    }

    const _depVisiting = new Set();
    function getDependencies(uid) {
        if (depCache.has(uid)) return depCache.get(uid);
        if (_depVisiting.has(uid)) return new Set([uid]);
        _depVisiting.add(uid);
        let deps = new Set([uid]);
        try {
            const u = unitMap.get(uid);
            if (u) {
                u.parsedRecipe?.forEach(child => child.id && getDependencies(child.id).forEach(d => deps.add(d)));
                u.parsedCost?.forEach(pc => COMBO_SLOT_SET.has(pc.key) && deps.add(pc.key));
            }
            depCache.set(uid, deps);
        } finally {
            _depVisiting.delete(uid);
        }
        return deps;
    }

    // [5] 완료·복구
    function deleteCompletedRecipe(uid, multiplier) {
        const u = unitMap.get(uid); if (!u) return;
        u.parsedRecipe?.forEach(child => {
            if (!child.id) return;
            const needed = child.qty * multiplier;
            const comp = completedUnits.get(child.id) || 0;
            const consume = Math.min(needed, comp);
            if (consume > 0) {
                const newVal = Math.max(0, comp - consume);
                if (newVal <= 0) completedUnits.delete(child.id); else completedUnits.set(child.id, newVal);
            }
        });
        u.parsedCost?.forEach(pc => {
            if (COMBO_SLOT_SET.has(pc.key) && !SPECIAL_RENDER_LIST.some(e => e.id === pc.key)) {
                const needed = pc.qty * multiplier;
                const comp = completedUnits.get(pc.key) || 0;
                const consume = Math.min(needed, comp);
                if (consume > 0) {
                    const newVal = Math.max(0, comp - consume);
                    if (newVal <= 0) completedUnits.delete(pc.key); else completedUnits.set(pc.key, newVal);
                }
            }
        });
    }

    function completeUnit(uid, amount) {
        if (_completeLock.has(uid)) return;
        _completeLock.add(uid);
        const cWrapEl = document.getElementById(`craft-wrap-${uid}`);
        const lockBtns = cWrapEl ? Array.from(cWrapEl.querySelectorAll('button')) : [];
        lockBtns.forEach(b => b.disabled = true);
        try {
            const { reqMap, baseMap, specialReq } = calculateDeductedRequirements();
            const isTarget = activeUnits.has(uid);
            const isSpecial = COMBO_SLOT_SET.has(uid);
            let isMergedSlot = false;
            if (isTarget && !isSpecial) {
                activeUnits.forEach((_, activeId) => {
                    if (activeId !== uid && unitMap.get(activeId)?.parsedRecipe?.some(pr => pr.id === uid)) isMergedSlot = true;
                });
            }
            const isPureTarget = isTarget && !isMergedSlot && !isSpecial;
            let reqVal = 0;
            if (isPureTarget) reqVal = Math.max(0, (activeUnits.get(uid) || 1) - (completedUnits.get(uid) || 0));
            else if (isSpecial) reqVal = specialReq[uid] || 0;
            else if (isTarget && isMergedSlot) reqVal = Math.max(0, (baseMap.get(uid) || 1) - (completedUnits.get(uid) || 0));
            else reqVal = reqMap.get(uid) || 0;

            const processQty = Math.min(amount !== undefined ? amount : reqVal, reqVal);
            if (processQty > 0) {
                deleteCompletedRecipe(uid, processQty);
                const newComp = (completedUnits.get(uid) || 0) + processQty;
                completedUnits.set(uid, newComp);

                if (isPureTarget) {
                    if (newComp >= (activeUnits.get(uid) || 1)) {
                        completedTargets.set(uid, activeUnits.get(uid) || 1);
                        activeUnits.delete(uid);
                        completedUnits.delete(uid);
                        _cartTab = 'done';
                    }
                } else if (isTarget && isMergedSlot) {
                    const totalQty = baseMap.get(uid) || 1;
                    if (newComp >= totalQty) {
                        const activeQty = activeUnits.get(uid) || 1;
                        const matQty = totalQty - activeQty;
                        completedTargets.set(uid, activeQty);
                        activeUnits.delete(uid);
                        if (matQty > 0) completedUnits.set(uid, matQty);
                        else completedUnits.delete(uid);
                        _cartTab = 'done';
                    }
                }
                toggleHighlight(null);
                triggerHaptic();
                debouncedUpdateAllPanels();
            } else {
                lockBtns.forEach(b => b.disabled = false);
            }
        } catch(e) {
            console.warn('[오류] 완료 처리 실패', e);
            lockBtns.forEach(b => b.disabled = false);
        } finally {
            setTimeout(() => { _completeLock.delete(uid); }, APP_INTERNAL.completeLockDelay);
        }
    }

    function restoreUnit(uid) {
        if (!completedTargets.has(uid)) return;
        const qty = completedTargets.get(uid) || 1;
        completedTargets.delete(uid);
        // 하위 재료 completedUnits도 역산 정리
        deleteCompletedRecipe(uid, qty);
        completedUnits.delete(uid);
        if (!activeUnits.has(uid)) activeUnits.set(uid, qty);
        if (completedTargets.size === 0) _cartTab = 'active';
        triggerHaptic(); debouncedUpdateAllPanels();
    }

    let _restoreAllPendingTimer = null;
    function restoreAllCompleted() {
        if (_restoreAllCooldown) return;
        const cfg = SYSTEM_CONFIG.policy.restoreAllBtn;
        const btn = getEl(cfg.idBtn), label = getEl(cfg.idLabel);

        // 이미 pending 상태면 즉시 취소
        if (_restoreAllPendingTimer) {
            clearTimeout(_restoreAllPendingTimer);
            _restoreAllPendingTimer = null;
            if (label) label.textContent = cfg.labelDefault;
            if (btn) { btn.classList.remove('reset-btn-pending'); btn.disabled = false; }
            return;
        }

        // 첫 클릭: 2초 유예 — 한 번 더 누르면 취소, 유예 종료 시 실행
        if (label) label.textContent = '취소하려면 다시 클릭';
        if (btn) { btn.classList.add('reset-btn-pending'); }

        _restoreAllPendingTimer = setTimeout(() => {
            _restoreAllPendingTimer = null;
            activeUnits.clear(); completedUnits.clear(); completedTargets.clear();
            _cartTab = 'active'; _cartCollapsed = false; syncCartVisibility(); _presetUsed.clear(); updatePresetBtns(); triggerHaptic(); debouncedUpdateAllPanels();
            if (!btn || !label) return;
            _restoreAllCooldown = true;
            btn.classList.remove('reset-btn-pending');
            label.textContent = cfg.labelDone; btn.classList.add(cfg.classDone); btn.disabled = true;
            setTimeout(() => { label.textContent = cfg.labelDefault; btn.classList.remove(cfg.classDone); btn.disabled = false; _restoreAllCooldown = false; }, APP_INTERNAL.restoreAllResetDelay);
        }, APP_INTERNAL.restoreAllPendingDelay);
    }

    // [6] 대시보드
    function updateEssence() {
        let tE = getEssenceCount(activeUnits), cE = getEssenceCount(completedUnits), totalEssence = 0;

        const hybridKey = SYSTEM_CONFIG.essence.mapping["혼종"] || "혼종";
        const hybridWeight = SYSTEM_CONFIG.policy.hybridWeight || 3;

        SYSTEM_CONFIG.essence.display.forEach(d => {
            let base = Math.max(0, (tE[d.name] || 0) - (cE[d.name] || 0));
            let el = getEl(`val-essence-${d.id}`);
            if (el) { let v = base > 0 ? String(base) : ''; if (el.innerHTML !== v) el.innerHTML = v; }
            getEl(`slot-essence-${d.id}`)?.classList.toggle('active', base > 0);
            totalEssence += base * (d.name === hybridKey ? hybridWeight : 1);
        });

        const totalEssEl = getEl('val-total-essence');
        if (totalEssEl) { let v = totalEssence > 0 ? String(totalEssence) : ''; if (totalEssEl.innerHTML !== v) totalEssEl.innerHTML = v; }
        getEl('slot-total-essence')?.classList.toggle('active', totalEssence > 0);
    }

    function renderDashboardAtoms() {
        let db = getEl('magicDashboard'); if (!db) return;
        const comboKey = SYSTEM_CONFIG.policy.magicComboKey;
        db.innerHTML = `<div class="cost-slot total-cost" id="slot-total-essence"><div class="cost-val" id="val-total-essence"></div><div class="cost-name">통합 정수</div></div>` +
            SYSTEM_CONFIG.essence.display.map(d => `<div class="cost-slot is-magic-slot" id="slot-essence-${d.id}"><div class="cost-val" id="val-essence-${d.id}" style="color:${d.color};"></div><div class="cost-name">${d.name}</div></div>`).join('') +
            SYSTEM_CONFIG.dashboardAtoms.map(a => `<div class="cost-slot ${a === comboKey ? 'is-skill-slot' : 'is-magic-slot'}" id="vslot-${clean(a)}"><div class="cost-val"></div><div class="cost-name" id="name-${clean(a)}">${a}</div></div>`).join('');
    }

    function updateMagicDashboard() {
        const tMap = {}, cMap = {}, comboKey = SYSTEM_CONFIG.policy.magicComboKey, specials = COMBO_SLOT_RAWS;
        SYSTEM_CONFIG.dashboardAtoms.forEach(a => {
            if (a === comboKey) { tMap[a] = {}; cMap[a] = {}; specials.forEach(k => { tMap[a][k] = 0; cMap[a][k] = 0; }); }
            else tMap[a] = cMap[a] = 0;
        });

        const flattenUnitToAtoms = (uid, qty, map, path) => {
            if (qty <= 0 || path.has(uid)) return;
            path.add(uid);
            try {
                if (specials.includes(uid)) { map[comboKey][uid] += qty; return; }
                let atomRaw = ATOM_HASH[uid];
                if (atomRaw && atomRaw !== comboKey) { map[atomRaw] = (map[atomRaw] || 0) + qty; return; }
                const u = unitMap.get(uid); if (!u) return;
                if (u.parsedCost?.length) {
                    u.parsedCost.forEach(pc => {
                        if (pc.type === 'special' && specials.includes(pc.key)) map[comboKey][pc.key] += pc.qty * qty;
                        else {
                            let pcRaw = ATOM_HASH[pc.key] || pc.key;
                            if (pcRaw !== comboKey) { if (SYSTEM_CONFIG.dashboardAtoms.includes(pcRaw)) map[pcRaw] = (map[pcRaw] || 0) + pc.qty * qty; else flattenUnitToAtoms(pc.key, pc.qty * qty, map, path); }
                        }
                    });
                    getToolNeed(uid).forEach(toolId => flattenUnitToAtoms(toolId, isOneTime(unitMap.get(toolId)) ? 1 : qty, map, path));
                } else if (u.parsedRecipe?.length) {
                    u.parsedRecipe.forEach(child => {
                        if (!child.id) return;
                        isToolRequirement(uid, child.id) ? flattenUnitToAtoms(child.id, isOneTime(unitMap.get(child.id)) ? 1 : qty, map, path) : flattenUnitToAtoms(child.id, child.qty * qty, map, path);
                    });
                    u.parsedCost?.forEach(pc => specials.includes(pc.key) && (map[comboKey][pc.key] += pc.qty * qty));
                }
            } finally {
                path.delete(uid);
            }
        };

        let activePath = new Set(), compPath = new Set();
        activeUnits.forEach((c, k) => c > 0 && flattenUnitToAtoms(k, c, tMap, activePath));
        completedUnits.forEach((c, k) => c > 0 && flattenUnitToAtoms(k, c, cMap, compPath));

        SYSTEM_CONFIG.dashboardAtoms.forEach(a => {
            const container = getEl(`vslot-${clean(a)}`), e = container?.querySelector('.cost-val'), nEl = container?.querySelector('.cost-name');
            if (!container || !e || !nEl) return;

            if (a === comboKey) {
                let hasValue = specials.some(k => Math.max(0, tMap[a][k] - cMap[a][k]) > 0);
                if (hasValue) {
                    let spHtml = specials.map(k => `<div class="sp-row"><span class="sp-val-num">${Math.max(0, tMap[a][k] - cMap[a][k])}</span></div>`).join('<div class="sp-divider"></div>');
                    if (e.innerHTML !== spHtml) e.innerHTML = spHtml;
                    nEl.style.display = 'block'; container.classList.add('active');
                } else { if (e.innerHTML !== '') e.innerHTML = ''; nEl.style.display = 'block'; container.classList.remove('active'); }
            } else {
                let fV = Math.max(0, tMap[a] - cMap[a]);
                if (fV > 0) { if (e.innerText !== String(fV)) e.innerText = String(fV); nEl.style.display = 'block'; container.classList.add('active'); }
                else { if (e.innerHTML !== '') e.innerHTML = ''; nEl.style.display = 'block'; container.classList.remove('active'); }
            }
        });
    }

    // [7] 체크리스트
    function renderDeductionBoard() {
        const renderSlot = (id, n, g) => `<div class="deduct-slot" id="d-slot-wrap-${id}" data-uid="${id}" style="display:none;"><div class="d-reason-wrap" id="d-reason-${id}"></div><div class="d-slot-main"><div class="d-name" data-action="showRecipeTooltip" data-uid="${id}" data-is-deduction="true"><span class="gtag grade-${g}">${g}</span><span class="d-name-inline">${n}${CLEAN_SPECIAL_CONDITIONS[id]?`<span class="badge-special-cond" style="margin-left:4px; pointer-events:none;">특수조건</span>`:''}</span></div><div id="d-cond-${id}" class="d-cond-inline"></div></div><div id="craft-wrap-${id}" class="craft-wrap"></div></div>`;
        const getGrp = (id, pid, title, resetLevel=0, isCol=false, alwaysShow=false, alwaysOpen=false, resetLabel='완료복구') => `<div class="deduct-group" id="${id}" style="${alwaysShow ? '' : 'display:none;'}" ${alwaysShow ? 'data-always-show="true"' : ''} ${alwaysOpen ? 'data-always-open="true"' : ''}><div class="deduct-group-title" data-action="toggleGroup" data-grid-id="${pid}"><div style="display:flex;align-items:center;gap:7px;pointer-events:none;"><span class="grp-toggle-icon" style="display:inline-block;transition:transform 0.2s;transform:${isCol?'rotate(-90deg)':'rotate(0deg)'};font-size:0.75rem;">▼</span><span class="grp-title-text">${title}</span>${resetLevel > 0 ? `<span class="grp-count-badge" id="grp-count-${pid}" style="margin-left:2px;"></span>` : ''}</div>${resetLevel > 0 ? `<button type="button" class="btn-text-link grp-restore-btn" data-action="resetGroup" data-level="${resetLevel}" style="pointer-events:auto;">${resetLabel}</button>` : ''}</div><div class="deduct-grid" id="${pid}" ${isCol?'style="display:none;"':''}></div></div>`;

        const allUnits = Array.from(unitMap.values());
        const specialSlots = COMBO_SLOT_RAWS.map(k => renderSlot(k, k, '코스트')).join('');
        const unitSlots = allUnits.filter(u => getGradeIndex(u.grade) >= getGradeIndex(SYSTEM_CONFIG.policy.minGradeForChecklist) && !COMBO_SLOT_SET.has(u.id)).map(u => renderSlot(u.id, u.name, u.grade)).join('');
        const autoSlots = SPECIAL_RENDER_LIST.filter(e => !COMBO_SLOT_SET.has(e.id)).map(e => renderSlot(e.id, e.raw, '코스트')).join('');

        const _exIds = new Set((SYSTEM_CONFIG.policy.hideCompletedExcludeGroups || []).map(t => titleToGridId[t]).filter(Boolean));

        const boardEl = getEl('deductionBoard');
        boardEl.innerHTML = `<div id="deduct-empty-msg" class="empty-msg" style="display:none;"></div><div id="deduct-slot-pool" style="display:none;">${specialSlots}${unitSlots}${autoSlots}</div>` + GROUP_DEFS.map(g => getGrp(g.id, g.pid, g.title, g.resetLevel, g.isCol, g.alwaysShow, g.alwaysOpen, g.resetLabel)).join('');
        boardEl.dataset.excludeGridIds = JSON.stringify([..._exIds]);
    }

    function updateDeductionBoard(calcResult) {
        const { reqMap, baseMap, reasonMap, specialReq, baseSpecialReq, specialReason } = calcResult || calculateDeductedRequirements();
        const mergedSlots = new Set();
        
        const targetHighlight = _currentHighlight || null;
        const highlightDeps = targetHighlight ? getDependencies(targetHighlight) : null;
        
        activeUnits.forEach((_, uid) => unitMap.get(uid)?.parsedRecipe?.forEach(pr => pr.id && activeUnits.has(pr.id) && mergedSlots.add(pr.id)));
        const directMaterials = new Set();
        activeUnits.forEach((_, uid) => { if (mergedSlots.has(uid)) return; unitMap.get(uid)?.parsedRecipe?.forEach(pr => pr.id && !activeUnits.has(pr.id) && directMaterials.add(pr.id)); });
        const excludeGridIds = (() => { try { return JSON.parse(getEl('deductionBoard')?.dataset.excludeGridIds || '[]'); } catch(e) { return []; } })();
        const pool = getEl('deduct-slot-pool');
        
        const grids = {
            target: getEl('grid-target'),
            special: getEl('grid-special'),
            upperHidden: getEl('grid-upper-hidden'),
            basicHidden: getEl('grid-basic-hidden'),
            top: getEl('grid-top')
        };

        const exactDepths = new Map();
        let queue = [];
        activeUnits.forEach((_, uid) => {
            if (!mergedSlots.has(uid)) {
                exactDepths.set(uid, 0);
                queue.push(uid);
            }
        });
        if (queue.length === 0) {
            activeUnits.forEach((_, uid) => {
                exactDepths.set(uid, 0);
                queue.push(uid);
            });
        }
        let curDepth = 0;
        while(queue.length > 0 && curDepth < 30) {
            let nextQueue = [];
            curDepth++;
            for (let uid of queue) {
                const u = unitMap.get(uid);
                if (!u) continue;
                u.parsedRecipe?.forEach(pr => {
                    if (pr.id && !exactDepths.has(pr.id)) {
                        exactDepths.set(pr.id, curDepth);
                        nextQueue.push(pr.id);
                    }
                });
                getToolNeed(uid).forEach(toolId => {
                    if (toolId && !exactDepths.has(toolId)) {
                        exactDepths.set(toolId, curDepth);
                        nextQueue.push(toolId);
                    }
                });
                u.parsedCost?.forEach(pc => {
                    if (COMBO_SLOT_SET.has(pc.key) && !exactDepths.has(pc.key)) {
                        exactDepths.set(pc.key, curDepth);
                        nextQueue.push(pc.key);
                    }
                });
            }
            queue = nextQueue;
        }

        document.querySelectorAll('.deduct-slot[data-uid]').forEach(el => {
            el.style.display = 'none'; el.classList.remove('is-visible','has-target','is-completed','is-inactive');
            if (pool && el.parentElement !== pool) pool.appendChild(el);
        });
        document.querySelectorAll('.top-row-blank').forEach(el => el.remove());
        document.querySelectorAll('.deduct-slot-ghost').forEach(el => el.remove());

        const topFixedRows = SYSTEM_CONFIG.topFixedOrder.map(row => row.map(clean));
        const topFixedSet = new Set(topFixedRows.flat());
        const ROW_SIZE = Math.max(...topFixedRows.map(r => r.length));

        const processSlot = (id, isTopFixedCall = false) => {
            const slotEl = getEl(`d-slot-wrap-${id}`); if (!slotEl) return null;
            
            const isSpecialCost = COMBO_SLOT_SET.has(id);
            const isAutoRender = isSpecialRender(id);
            const isAutoApply = isAutoRender || isSpecialCost;
            
            const isTarget = activeUnits.has(id);
            const isCompletedTarget = !isTarget && !isSpecialCost && completedTargets.has(id);
            const isMergedSlot = isTarget && !isSpecialCost && mergedSlots.has(id);
            
            let needed = isSpecialCost ? (specialReq[id]||0) : (reqMap.get(id)||0);
            if (isMergedSlot) needed = Math.max(0, (baseMap.get(id)||0) - (completedUnits.get(id)||0));
            else if (isTarget && !isSpecialCost) needed = Math.max(0, (activeUnits.get(id)||1) - (completedUnits.get(id)||0));
            if (isCompletedTarget) needed = 0;
            
            let baseNeeded = isSpecialCost ? (baseSpecialReq[id]||0) :
                             isTarget && !isSpecialCost ? (isMergedSlot ? (baseMap.get(id)||0) : (activeUnits.get(id)||1)) :
                             isCompletedTarget ? (completedTargets.get(id)||1) :
                             (baseMap.get(id)||0);

            const isInactive = isTopFixedCall && baseNeeded <= 0 && needed <= 0 && !isTarget && !isCompletedTarget;

            if (!isTopFixedCall) {
                if (isSpecialCost && needed <= 0 && baseNeeded <= 0) return null;
                else if (isAutoRender && !baseNeeded && !needed) return null;
                else if (!isAutoRender && !isSpecialCost && !baseNeeded && !isTarget && !isCompletedTarget) return null;
            }

            slotEl.classList.remove('is-inactive');
            if (isInactive) slotEl.classList.add('is-inactive');

            const rCon = slotEl.querySelector(`#d-reason-${id}`);
            if (rCon) {
                let rMap = isSpecialCost ? specialReason[id] : reasonMap.get(id);
                if (!isInactive && rMap && rMap.size > 0 && needed > 0) {
                    let allEntries = [...rMap.entries()];
                    if (isTarget && !isSpecialCost && !isMergedSlot) allEntries = allEntries.filter(([, i]) => i.depth === 0);
                    // 하이라이트 중이면 선택한 태그(targetHighlight) 소속만 표시
                    if (_currentHighlight) {
                        const filtered = allEntries.filter(([, i]) =>
                            i.parentUid === targetHighlight ||
                            (highlightDeps && highlightDeps.has(i.parentUid)) ||
                            i.depth === 0
                        );
                        if (filtered.length > 0) allEntries = filtered;
                    }
                    let sorted = allEntries.sort((a,b)=>(a[1].depth||0)-(b[1].depth||0));
                    rCon.style.display = 'flex';
                    rCon.style.justifyContent = sorted.length === 1 ? 'center' : 'flex-start';
                    rCon.innerHTML = sorted.map(([rId,i]) => {
                        let qtyText = '';
                        // 도구(TOOL_) 태그는 수량 표시 안 함 (항상 1개 고정)
                        if (i.depth !== 0 && i.reqQty) {
                            const parentQty = i.parentUid ? (baseMap.get(i.parentUid) || activeUnits.get(i.parentUid) || 1) : 1;
                            const displayQty = rId.startsWith('TOOL_') ? 1 : i.reqQty * parentQty;
                            qtyText = ` <span class="d-reason-qty">· ${displayQty}개</span>`;
                        }
                        return `<span class="d-reason-tag ${i.depth===0?'tag-target':i.depth===1?'tag-mat':''}" data-action="toggleHighlight" data-uid="${rId.replace(/^(TARGET_|MAT_|TOOL_|SPEC_)/,'')}">${i.text}${qtyText}</span>`;
                    }).join('');
                } else { rCon.style.display='none'; rCon.innerHTML=''; }
            }

            const cEl = slotEl.querySelector(`#d-cond-${id}`);
            if (cEl) {
                let rMap = isSpecialCost ? specialReason[id] : reasonMap.get(id);
                let condMap = new Map();

                if (rMap) {
                    rMap.forEach((info) => {
                        if (!info.cond) return;
                        // 하이라이트 중이면 선택한 태그 소속 조건만 표시, 나머지 숨김
                        if (_currentHighlight) {
                            const pUid = info.parentUid;
                            if (pUid !== targetHighlight && (!highlightDeps || !highlightDeps.has(pUid))) return;
                        }
                        let cleanCond = info.cond.replace(/,/g, ' ').trim();
                        if (!cleanCond) return;
                        let parentTotal = 1;
                        if (info.parentUid) {
                            parentTotal = baseMap.get(info.parentUid) || activeUnits.get(info.parentUid) || 1;
                        }
                        let totalCondQty = (info.reqQty || 1) * parentTotal;
                        condMap.set(cleanCond, (condMap.get(cleanCond) || 0) + totalCondQty);
                    });
                }

                if (condMap.size > 0) {
                    cEl.style.display = 'flex';
                    cEl.style.flexDirection = 'column';
                    cEl.style.gap = '2px';
                    let htmlArr = [];
                    condMap.forEach((qty, condStr) => {
                        htmlArr.push(`<span class="d-cond-tag">${condStr} <span class="d-cond-qty">· ${qty}개</span></span>`);
                    });
                    cEl.innerHTML = htmlArr.join('');
                } else {
                    cEl.style.display = 'none';
                    cEl.innerHTML = '';
                }
            }

            const cWrap = slotEl.querySelector(`#craft-wrap-${id}`);
            const isCompleted = !isInactive && needed === 0;
            slotEl.classList.toggle('has-target', !isInactive && !isCompleted);
            slotEl.classList.toggle('is-completed', !isInactive && isCompleted);

            if (cWrap) {
                if (isInactive) cWrap.innerHTML = '';
                else if (isAutoApply) cWrap.innerHTML = `<span class="auto-complete-label">자동 완료됨</span>`;
                else if (!isCompleted) {
                    const bs = CLEAN_CRAFT_BATCH[id] || 1;
                    cWrap.innerHTML = `<div class="craft-wrap-left"><span class="req-text">${needed}</span><span class="req-label">필요</span></div><div class="craft-wrap-right">${(needed > bs || (bs > 1 && needed > 0)) ? `<button type="button" class="pc-btn" data-action="addComplete" data-uid="${id}" data-batch="${bs}">+ ${bs}개 완료</button>` : needed > 1 ? `<button type="button" class="pc-btn" data-action="addComplete" data-uid="${id}" data-batch="1">+ 1개 완료</button>` : ''}<button type="button" class="btn-complete" data-action="completeUnit" data-uid="${id}">전체완료</button></div>`;
                } else cWrap.innerHTML = `<div class="craft-wrap-left"><span class="req-text">0</span><span class="req-label">필요</span></div><div class="craft-wrap-right"><span class="complete-done-label">완료됨</span></div>`;
            }

            let tGrid = null;
            let sGrid = null;
            let upgradedTitle = "";
            const getGridTitle = (grid) => GROUP_DEFS.find(g => g.pid === grid?.id)?.title || '';

            let uGrade = unitMap.get(id)?.grade;
            let isHiddenGroup = getGradeIndex(uGrade) >= getGradeIndex(SYSTEM_CONFIG.policy.hiddenGroupMinGrade || "히든");
            let depthInTree = exactDepths.has(id) ? exactDepths.get(id) : 99;
            
            let nativeLevel = 1;
            if (isHiddenGroup) nativeLevel = (depthInTree <= 2) ? 3 : 2;
            _unitNativeLevels.set(id, nativeLevel);
            
            let upgradedGrid = null;
            
            if (!isAutoApply) {
                if (isCompletedTarget) { upgradedGrid = grids.target; upgradedTitle = getGridTitle(grids.target); }
                else if (isMergedSlot) { upgradedGrid = grids.special; upgradedTitle = getGridTitle(grids.special); }
                else if (isTarget) { upgradedGrid = grids.target; upgradedTitle = getGridTitle(grids.target); }
                else if (directMaterials.has(id)) { upgradedGrid = grids.special; upgradedTitle = getGridTitle(grids.special); }
                else {
                    const rVals = isSpecialCost ? specialReason[id] : reasonMap.get(id);
                    if (rVals) {
                        for (const i of rVals.values()) {
                            if (i.depth === 1) { upgradedGrid = grids.special; upgradedTitle = getGridTitle(grids.special); break; }
                        }
                    }
                }
            }
            
            let nativeGrid = grids.top;
            if (!isTopFixedCall && isHiddenGroup) {
                nativeGrid = (nativeLevel === 3) ? grids.upperHidden : grids.basicHidden;
            }

            if (upgradedGrid === grids.target && !isMergedSlot) {
                tGrid = grids.target;
                sGrid = isTopFixedCall ? nativeGrid : null;
            } else if (upgradedGrid && upgradedGrid !== nativeGrid) {
                if (isHiddenGroup && !isTopFixedCall) {
                    tGrid = upgradedGrid;
                    sGrid = null;
                } else {
                    tGrid = upgradedGrid;
                    sGrid = nativeGrid;
                }
            } else {
                tGrid = upgradedGrid || nativeGrid;
                sGrid = null;
            }

            let hideT = _hideCompleted && isCompleted && !isInactive && !excludeGridIds.includes(tGrid?.id || '');
            if (tGrid) {
                if (!hideT) {
                    slotEl.classList.add('is-visible');
                } else {
                    slotEl.classList.remove('is-visible');
                }
                slotEl.style.display = hideT ? 'none' : 'flex';
                tGrid.appendChild(slotEl);
            }

            if (sGrid) {
                let hideS = _hideCompleted && isCompleted && !isInactive && !excludeGridIds.includes(sGrid.id || '');
                const ghost = document.createElement('div');
                ghost.className = 'deduct-slot-ghost';
                ghost.dataset.ghostFor = id;
                ghost.dataset.uid = id;
                ghost.innerHTML = `<span class="ghost-name">${unitMap.get(id)?.name || id}</span><span class="ghost-label">→ ${upgradedTitle}</span>`;
                ghost.style.display = hideS ? 'none' : '';
                sGrid.appendChild(ghost);
            }
            
            return tGrid;
        };

        COMBO_SLOT_RAWS.filter(k => !topFixedSet.has(k)).forEach(k => processSlot(k));
        AUTO_COMPLETE_IDS.filter(id => !topFixedSet.has(id)).forEach(id => processSlot(id));
        
        topFixedRows.forEach(row => {
            row.forEach(uid => processSlot(uid, true));
            for (let b = 0; b < ROW_SIZE - row.length; b++) grids.top?.appendChild(Object.assign(document.createElement('div'), {className: 'top-row-blank'}));
        });

        Array.from(activeUnits.keys()).filter(uid => !topFixedSet.has(uid)).map(uid => unitMap.get(uid)).filter(Boolean).sort((a, b) => getGradeIndex(b.grade) - getGradeIndex(a.grade) || (SYSTEM_CONFIG.sorting.order[b.name]||0) - (SYSTEM_CONFIG.sorting.order[a.name]||0) || a.name.localeCompare(b.name)).forEach(u => processSlot(u.id));
        Array.from(completedTargets.keys()).filter(uid => !topFixedSet.has(uid)).map(uid => unitMap.get(uid)).filter(Boolean).sort((a, b) => getGradeIndex(b.grade) - getGradeIndex(a.grade) || a.name.localeCompare(b.name)).forEach(u => processSlot(u.id));

        Array.from(unitMap.values())
            .filter(u => !COMBO_SLOT_SET.has(u.id) && !topFixedSet.has(u.id) && !activeUnits.has(u.id) && !completedTargets.has(u.id) && getGradeIndex(u.grade) >= getGradeIndex(SYSTEM_CONFIG.policy.minGradeForChecklist))
            .sort((a, b) => getGradeIndex(b.grade) - getGradeIndex(a.grade) || (SYSTEM_CONFIG.sorting.order[b.name]||0) - (SYSTEM_CONFIG.sorting.order[a.name]||0) || a.name.localeCompare(b.name))
            .forEach(u => processSlot(u.id));

        [grids.target, grids.special].forEach(grid => {
            if (!grid) return;
            const children = Array.from(grid.children);
            children.sort((a, b) => {
                const uidA = a.dataset.uid || a.id.replace('d-slot-wrap-','');
                const uidB = b.dataset.uid || b.id.replace('d-slot-wrap-','');
                const uA = unitMap.get(uidA);
                const uB = unitMap.get(uidB);
                return getGradeIndex(uB?.grade) - getGradeIndex(uA?.grade) ||
                       (SYSTEM_CONFIG.sorting.order[uB?.name]||0) - (SYSTEM_CONFIG.sorting.order[uA?.name]||0) ||
                       (uA?.name || uidA).localeCompare(uB?.name || uidB);
            });
            children.forEach(el => grid.appendChild(el));
        });

        Object.values(grids).forEach(g => {
            if (!g) return;
            const grp = g.closest('.deduct-group'), icon = grp?.querySelector('.grp-toggle-icon');
            if (!grp) return;
            
            grp.style.display = 'block';
            
            const slots = Array.from(g.querySelectorAll('.deduct-slot')).filter(el => !el.classList.contains('is-inactive'));
            const visibleSlots = slots.filter(el => el.style.display !== 'none');

            if (visibleSlots.length === 0 && grp.dataset.alwaysShow !== 'true') {
                g.style.display = 'none'; grp.classList.add('collapsed'); if (icon) icon.style.transform = 'rotate(-90deg)';
            }
            else if (visibleSlots.length > 0 && grp.dataset.alwaysOpen === 'true') {
                grp.classList.remove('collapsed'); g.style.display = 'grid'; if (icon) icon.style.transform = 'rotate(0deg)';
            }

            const badge = getEl(`grp-count-${g.id}`);
            if (!badge) return;
            const total = slots.length;
            const done = slots.filter(el => el.classList.contains('is-completed')).length;
            badge.textContent = total > 0 ? `${done} / ${total}` : '';
        });

        document.querySelectorAll('.deduct-slot').forEach(el => {
            const cleanId = el.id.replace('d-slot-wrap-', '').replace('d-slot-mirror-', '');
            el.classList.toggle('highlighted-tree', !!_currentHighlight && highlightDeps?.has(cleanId));
        });
    }

    function clampCompletedUnits(calcResult) {
        const { baseMap, baseSpecialReq } = calcResult || calculateDeductedRequirements();
        let changed = false;
        for (let [uid, rawQty] of [...completedUnits.entries()]) {
            const compQty = parseInt(rawQty, 10);
            if (!Number.isFinite(compQty) || compQty <= 0 || (!unitMap.has(uid) && !COMBO_SLOT_SET.has(uid))) {
                completedUnits.delete(uid);
                changed = true;
                continue;
            }
            if (activeUnits.has(uid)) {
                let maxAllow = baseMap.get(uid) || activeUnits.get(uid) || 1;
                if (compQty > maxAllow) { completedUnits.set(uid, maxAllow); changed = true; }
                continue;
            }
            let maxAllow = COMBO_SLOT_SET.has(uid) ? (baseSpecialReq[uid] || 0) : (baseMap.get(uid) || 0);
            if (compQty > maxAllow) {
                if (maxAllow <= 0) completedUnits.delete(uid);
                else completedUnits.set(uid, maxAllow);
                changed = true;
            }
        }
        return changed;
    }

    function debouncedUpdateAllPanels() {
        if (updateTimer) cancelAnimationFrame(updateTimer);
        updateTimer = requestAnimationFrame(() => {
            let calcResult = calculateDeductedRequirements();
            if (clampCompletedUnits(calcResult)) calcResult = calculateDeductedRequirements();
            _lastCalcResult = calcResult;
            updateMagicDashboard();
            updateEssence();
            updateTabsUI();
            updateTabContentUI();
            updateDeductionBoard(calcResult);
            updateCartUI();
            updateEmptyMsg();
            saveNexusState();
        });
    }

    // [8] 탭·카드
    function renderTabs() {
        const t = getEl('codexTabs');
        if (t) { t.innerHTML = SYSTEM_CONFIG.tabs.map((c, i) => `<button type="button" id="tab-btn-${i}" role="tab" aria-selected="${i===_activeTabIdx}" class="tab-btn" data-action="selectTab" data-tab-idx="${i}"><span>${c.name}</span></button>`).join(''); updateTabsUI(); }
    }

    function updateTabsUI() {
        let aCats = new Set([...activeUnits.keys()].map(id => unitMap.get(id)?.category).filter(Boolean));
        const minGradeIdx = getGradeIndex(SYSTEM_CONFIG.search.minGradeForSearch || "레전드");
        SYSTEM_CONFIG.tabs.forEach((c, i) => {
            let btn = getEl(`tab-btn-${i}`), isActive = (i === _activeTabIdx), has = aCats.has(c.key);
            if (!btn) return;
            if (btn.classList.contains('active') !== isActive) { btn.classList.toggle('active', isActive); btn.setAttribute('aria-selected', isActive ? 'true' : 'false'); }
            if (btn.classList.contains('has-active') !== has) btn.classList.toggle('has-active', has);
        });
        const selectAllBtn = getEl('btnSelectAllTab'), currentTab = SYSTEM_CONFIG.tabs[_activeTabIdx];
        if (selectAllBtn && currentTab) {
            selectAllBtn.disabled = false;
            const catItems = Array.from(unitMap.values()).filter(u => u.category === currentTab.key && (getGradeIndex(u.grade) >= minGradeIdx || isSearchAllowed(u.id)) && !isHiddenUnit(u.id) && !isRestrictedUnit(u.id));
            selectAllBtn.innerHTML = (catItems.length > 0 && catItems.every(item => activeUnits.has(item.id))) ? `<span class="btn-select-all-clear-label">✖ ${currentTab.name} 해제</span>` : `✔ ${currentTab.name} 선택`;
        }
    }

    function starBtnHtml(id) {
        const isFav = _favorites.has(id);
        return `<button type="button" class="uc-fav-btn${isFav ? ' is-fav' : ''}" data-action="toggleFavorite" data-uid="${id}" title="${isFav ? '즐겨찾기 해제' : '즐겨찾기 등록'}" aria-label="즐겨찾기">${isFav ? '★' : '☆'}</button>`;
    }

    function buildCardControl(item, prefix, isRestricted, isOT) {
        if (!isOT && !isRestricted) {
            return `<div class="uc-ctrl-area"><div class="smart-stepper active-stepper" id="stepper-${prefix}${item.id}"><button type="button" data-action="smartChange" data-uid="${item.id}" data-delta="-1" aria-label="${item.name} 감소">-</button><div class="ss-val" id="val-unit-${prefix}${item.id}" aria-live="polite">-</div><button type="button" data-action="smartChange" data-uid="${item.id}" data-delta="1" aria-label="${item.name} 추가">+</button></div></div>`;
        }
        return `<div class="uc-ctrl-area uc-ctrl-area-reserved" aria-hidden="true"><div class="smart-stepper smart-stepper-placeholder"><button type="button" disabled>-</button><div class="ss-val">-</div><button type="button" disabled>+</button></div></div>`;
    }

    function buildCard(item, idx, prefix, showRecipe) {
        const isRestricted = isRestrictedUnit(item.id), isOT = isOneTime(item), isFav = _favorites.has(item.id);
        return `<div id="card-${prefix}${item.id}" class="unit-card${isRestricted ? ' is-excluded' : ''}${isFav ? ' is-fav-card' : ''}${showRecipe ? '' : ' no-recipe'}" data-grade="${item.grade}" style="${idx >= 0 ? `animation-delay:${idx*0.02}s;` : ''}${isRestricted ? 'pointer-events:auto;cursor:not-allowed;' : ''}" data-action="toggleUnit" data-uid="${item.id}">` +
            `<div class="uc-card-inner">` +
            `${starBtnHtml(item.id)}` +
            `<div class="uc-head${showRecipe ? '' : ' uc-head-slim'}">` +
            `<span class="gtag grade-${item.grade}">${item.grade}</span>` +
            `<div class="uc-name-row" style="color:${SYSTEM_CONFIG.grades.colors[item.grade]};">${item.name}</div>` +
            `${isRestricted ? `<span class="badge-excluded" data-action="showExcludedTooltip" data-uid="${item.id}">선택제한</span>` : ''}` +
            `</div>` +
            `${showRecipe ? `<div class="uc-recipe-area">${formatRecipe(item, 1, false)}</div>` : ''}` +
            `${showRecipe && CLEAN_UNIT_CONDITIONS[item.id] ? `<div class="tsc-wrap" style="margin:4px 0 2px;"><div class="tsc-item">${CLEAN_UNIT_CONDITIONS[item.id]}</div></div>` : ''}` +
            `${buildCardControl(item, prefix, isRestricted, isOT)}` +
            `</div></div>`;
    }

    function buildUnitCard(item, idx) { return buildCard(item, idx, '', true); }
    function buildFavCard(item, idx, categoryKey) { return buildCard(item, idx, `fav-${categoryKey}-`, true); }

    function getCodexSort(a, b) {
        return (SYSTEM_CONFIG.sorting.order[b.name] || 0) - (SYSTEM_CONFIG.sorting.order[a.name] || 0) ||
            (isOneTime(a) ? -1 : isOneTime(b) ? 1 : 0) ||
            getGradeIndex(b.grade) - getGradeIndex(a.grade) ||
            calculateTotalCostScore(b) - calculateTotalCostScore(a) ||
            a.name.localeCompare(b.name);
    }

    function getCodexVisibleItems() {
        const minGradeIdx = getGradeIndex(SYSTEM_CONFIG.search.minGradeForSearch || "레전드");
        return Array.from(unitMap.values()).filter(u =>
            (getGradeIndex(u.grade) >= minGradeIdx || isSearchAllowed(u.id)) && !isHiddenUnit(u.id)
        );
    }

    function getFavoriteItems() {
        return getCodexVisibleItems().filter(u => _favorites.has(u.id)).sort(getCodexSort);
    }

    function buildFavoriteSection(categoryKey) {
        const favItems = getFavoriteItems();
        if (favItems.length > 0) {
            return `<div class="codex-fav-section">` +
                `<div class="codex-fav-header"><span class="codex-fav-title">⭐ 즐겨찾기</span></div>` +
                `<div class="codex-fav-grid">${favItems.map((item, idx) => buildFavCard(item, idx, categoryKey)).join('')}</div>` +
                `<div class="codex-fav-divider"></div>` +
                `</div>`;
        }
        return `<div class="codex-fav-empty">` +
            `<span class="codex-fav-empty-star">☆</span>` +
            `<span class="codex-fav-empty-text">카드 우측 상단 <b>☆</b>를 누르면 즐겨찾기에 등록됩니다</span>` +
            `</div>`;
    }

    function initAllTabContents() {
        const tc = getEl('tabContent'); if (!tc) return;
        const minGradeIdx = getGradeIndex(SYSTEM_CONFIG.search.minGradeForSearch || "레전드");
        const favSet = new Set(_favorites);
        tc.innerHTML = SYSTEM_CONFIG.tabs.map(cat => {
            const items = Array.from(unitMap.values()).filter(u =>
                (getGradeIndex(u.grade) >= minGradeIdx || isSearchAllowed(u.id)) &&
                u.category === cat.key &&
                !isHiddenUnit(u.id) &&
                !favSet.has(u.id)
            ).sort(getCodexSort);
            const bodyHtml = !items.length
                ? `<div class="codex-empty-msg">즐겨찾기를 제외하고 표시할 유닛이 없습니다.</div>`
                : items.map((item, idx) => buildUnitCard(item, idx)).join('');
            return `<div id="cat-group-${cat.key}" class="cat-group" role="tabpanel">${buildFavoriteSection(cat.key)}<div class="codex-category-grid">${bodyHtml}</div></div>`;
        }).join('');
        _isTabContentInitialized = true;
    }

    function renderCurrentTabContent() {
        if (!_isTabContentInitialized) initAllTabContents();
        SYSTEM_CONFIG.tabs.forEach((c, i) => getEl(`cat-group-${c.key}`)?.classList.toggle('is-visible', i === _activeTabIdx));
        updateTabContentUI();
    }

    function updateTabContentUI() {
        document.querySelectorAll('.unit-card[data-uid]').forEach(card => {
            const uid = card.dataset.uid, item = unitMap.get(uid);
            if (!item) return;
            const isActive = activeUnits.has(uid);
            if (!isOneTime(item)) {
                card.querySelectorAll('.ss-val').forEach(v => {
                    const nv = isActive ? String(activeUnits.get(uid)) : '-';
                    if (v.innerText !== nv) v.innerText = nv;
                });
                card.querySelectorAll('.smart-stepper button').forEach(b => b.disabled = !isActive);
            }
            card.style.display = 'flex';
            card.classList.toggle('active', isActive);
            card.classList.toggle('is-fav-card', _favorites.has(uid));
        });
        document.querySelectorAll('.uc-fav-btn[data-uid]').forEach(btn => {
            const uid = btn.dataset.uid, isFav = _favorites.has(uid);
            btn.classList.toggle('is-fav', isFav);
            btn.textContent = isFav ? '★' : '☆';
            btn.title = isFav ? '즐겨찾기 해제' : '즐겨찾기 등록';
        });
    }

    function toggleFavorite(id, event) {
        event?.stopPropagation();
        if (!unitMap.has(id) || isHiddenUnit(id)) return;
        if (_favorites.has(id)) _favorites.delete(id); else _favorites.add(id);
        saveFavorites();
        triggerHaptic();
        _isTabContentInitialized = false;
        initAllTabContents();
        renderCurrentTabContent();
        updateTabsUI();
    }

    // [9] 장바구니·툴팁
    function toggleCartCollapse() {
        _cartCollapsed = !_cartCollapsed;
        syncCartVisibility();
    }

    function syncCartVisibility() {
        const btn = getEl('cartCollapseBtn');
        if (btn) btn.textContent = _cartCollapsed ? '▶' : '▼';
        [getEl('cartTabBar'), getEl('cartListArea')].forEach(el => {
            if (el) el.style.display = _cartCollapsed ? 'none' : '';
        });
    }


    function updateCartUI() {
        const cartListArea = getEl('cartListArea'); if (!cartListArea) return;
        const tabBar = getEl('cartTabBar');
        if (tabBar) {
            tabBar.innerHTML = `<button type="button" class="cart-tab-btn ${_cartTab === 'active' ? 'active' : ''}" data-action="switchCartTab" data-tab="active">선택 <span class="cart-tab-cnt">${activeUnits.size}</span></button><button type="button" class="cart-tab-btn ${_cartTab === 'done' ? 'active' : ''}" data-action="switchCartTab" data-tab="done">완료 <span class="cart-tab-cnt done">${completedTargets.size}</span></button>`;
            tabBar.style.display = _cartCollapsed ? 'none' : '';
        }
        cartListArea.style.display = _cartCollapsed ? 'none' : '';
        if (_cartCollapsed) return;

        if (_cartTab === 'active') {
            if (activeUnits.size === 0) return cartListArea.innerHTML = `<div class="cart-empty-msg">목표 유닛을 선택하면<br>여기에 표시됩니다.</div>`;
            const items = getUnitsFromMap(activeUnits);
            const existingIds = Array.from(cartListArea.querySelectorAll('.cart-item')).map(el => el.id.replace('ci-', '')), newIds = items.map(i => i.id);
            if (existingIds.length !== newIds.length || existingIds.some((id, i) => id !== newIds[i])) {
                cartListArea.innerHTML = items.map(item => `<div class="cart-item" id="ci-${item.id}"><span class="cart-item-grade"><span class="gtag grade-${item.grade}">${item.grade}</span></span><span class="cart-item-name" style="color:${SYSTEM_CONFIG.grades.colors[item.grade]};">${item.name}</span>${!isOneTime(item) ? `<div class="cart-item-stepper"><button type="button" data-action="smartChange" data-uid="${item.id}" data-delta="-1">-</button><span class="ci-val" id="ci-val-${item.id}">${activeUnits.get(item.id) || 1}</span><button type="button" data-action="smartChange" data-uid="${item.id}" data-delta="1">+</button></div>` : ''}<button type="button" class="cart-item-del" data-action="removeCartItem" data-uid="${item.id}" title="삭제">✕</button></div>`).join('');
            } else items.forEach(item => { const valEl = getEl(`ci-val-${item.id}`); if (valEl) { const qty = activeUnits.get(item.id) || 1; if (valEl.innerText !== String(qty)) valEl.innerText = qty; } });
        } else {
            if (completedTargets.size === 0) return cartListArea.innerHTML = `<div class="cart-empty-msg">완료된 유닛이 없습니다.<br><span class="cart-empty-sub">체크리스트에서 전체완료 시 이곳으로 이동됩니다.</span></div>`;
            cartListArea.innerHTML = getUnitsFromMap(completedTargets).map(item => `<div class="cart-item cart-item-done" id="cid-${item.id}" data-action="restoreUnit" data-uid="${item.id}" title="클릭하면 선택탭으로 복구됩니다"><span class="cart-item-grade"><span class="gtag grade-${item.grade}">${item.grade}</span></span><span class="cart-item-name done-name" style="color:${SYSTEM_CONFIG.grades.colors[item.grade]};">${item.name}</span><span class="ci-onetime done-qty">×${completedTargets.get(item.id) || 1}</span><span class="cart-done-restore-hint always-show">복구</span></div>`).join('');
        }
    }

    function formatRecipe(item, multi = 1, showSep = false) {
        if (!item.recipe || IGNORE_PARSE_RECIPES.includes(item.recipe)) return `<div class="recipe-empty-msg">정보 없음</div>`;
        let foundSpecialIds = [];
        let partsHtml = splitRecipe(item.recipe).map(p => {
            const m = p.match(/^([^([ ]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/);
            if (m) {
                const unitId = getUnitId(m[1].trim()), u = unitMap.get(unitId);
                let condHtml = '';
                if (CLEAN_SPECIAL_CONDITIONS[unitId]) {
                    condHtml = `<span class="badge-special-cond recipe-special-cond">특수조건</span>`;
                    if (!foundSpecialIds.includes(unitId)) foundSpecialIds.push(unitId);
                } else if (m[2]) condHtml = `<span class="badge-cond">${m[2].replace(/,/g, ' ')}</span>`;
                const qtyNum = (m[3] ? parseInt(m[3], 10) : 1) * multi;
                const color = u ? SYSTEM_CONFIG.grades.colors[u.grade] : 'var(--text)';
                if (showSep && m[2] && !CLEAN_SPECIAL_CONDITIONS[unitId]) {
                    return `<div class="recipe-badge" style="color:${color};"><span class="recipe-badge-name">${m[1].trim()}</span><span class="badge-cond recipe-cond-offset">${m[2].replace(/,/g, ' ')}</span><span class="badge-qty-wrap"><span class="badge-qty">· ${qtyNum}개</span></span></div>`;
                }
                return `<div class="recipe-badge" style="color:${color};"><span class="recipe-badge-name">${m[1].trim()}</span><span class="badge-qty-wrap">${condHtml}<span class="badge-qty">· ${qtyNum}개</span></span></div>`;
            }
            return `<div class="recipe-token-muted">${p}</div>`;
        }).join('');
        let specialCondInlineHtml = (!showSep && foundSpecialIds.length > 0) ? `<div class="tsc-wrap tsc-wrap-inline">${foundSpecialIds.map(uid => `<div class="tsc-item tsc-item-inline">${CLEAN_SPECIAL_CONDITIONS[uid]}</div>`).join('')}</div>` : '';
        return `<div class="${showSep ? 'recipe-flex-wrap' : 'recipe-vertical'}">${partsHtml}</div>${specialCondInlineHtml}`;
    }

    function updateEmptyMsg() {
        const msg = getEl('deduct-empty-msg');
        if (!msg) return;
        const isEmpty = activeUnits.size === 0 && completedTargets.size === 0;
        if (isEmpty) {
            msg.style.display = 'block';
            msg.innerHTML = `<div class="empty-msg-enhanced"><div class="empty-arrow">↑</div><div class="empty-main">유닛도감에서 목표 유닛을 선택해 보세요</div><div class="empty-sub">상단 <b class="empty-emphasis">유닛도감</b> 탭 → 종족 선택 → 카드 클릭<br>프리셋 버튼으로 빠르게 시작할 수도 있습니다</div></div>`;
        } else {
            msg.style.display = 'none';
        }
    }

    function updateHideCompletedBtn() {
        const btn = getEl('btnHideCompleted'), label = getEl('btnHideCompletedLabel');
        if (!btn || !label) return;
        label.textContent = _hideCompleted ? '숨기는 중' : '완료 숨기기';
        btn.classList.toggle('hide-completed-active', _hideCompleted);
    }

    function resetCodex() {
        activeUnits.clear(); completedUnits.clear(); completedTargets.clear();
        toggleHighlight(null); _cartTab = 'active'; _cartCollapsed = false; syncCartVisibility();
        _presetUsed.clear(); updatePresetBtns(); debouncedUpdateAllPanels();
    }

    function renderPresetButtons() {
        const tabBar = getEl('presetInlineTabBar'), btnList = getEl('presetInlineBtnList'), wrap = getEl('presetInlineWrap');
        if (!tabBar || !btnList || !wrap) return;
        if (!SYSTEM_CONFIG.presets.length) { wrap.style.display = 'none'; return; }

        const groups = [...new Set(SYSTEM_CONFIG.presets.filter(p => !(p.hidden === true || p.hidden === '비활성')).map(p => p.group || '일반 프리셋'))];
        if (!groups.includes(_presetTab)) _presetTab = groups[0];

        tabBar.style.display = groups.length > 1 ? 'flex' : 'none';
        tabBar.innerHTML = groups.map(g => `<button type="button" class="preset-inline-tab-btn${g === _presetTab ? ' active' : ''}" data-action="switchPresetTab" data-tab="${g}">${g}</button>`).join('');

        btnList.innerHTML = SYSTEM_CONFIG.presets.map((p, i) => {
            const isHidden = p.hidden === true || p.hidden === '비활성';
            if (isHidden || (p.group || '일반 프리셋') !== _presetTab) return '';
            const colorKey = PRESET_COLOR_MAP[p.배경색] || 'red';
            const textKey = PRESET_COLOR_MAP[p.글씨색];
            let styleStr = `--btn-color:var(--preset-color-${colorKey})`;
            if (textKey === 'white') styleStr += `;--btn-text-override:#ffffff`;
            else if (textKey === 'black') styleStr += `;--btn-text-override:#111111`;
            else if (textKey) styleStr += `;--btn-text-override:rgb(var(--preset-color-${textKey}))`;
            else if (isBrightColor(p.배경색)) styleStr += ';--btn-text-override:#111111';
            return `<button type="button" class="btn-gohaeng" data-action="runPreset" data-preset-idx="${i}" title="${p.tooltip || p.label}" style="${styleStr}">${p.icon ? `<span class="gohaeng-icon">${p.icon}</span>` : ''}<span class="gohaeng-label">${p.label}</span></button>`;
        }).join('');

        wrap.style.display = '';
        updatePresetBtns();
    }

    function updatePresetBtns() {
        SYSTEM_CONFIG.presets.forEach((p, i) => {
            const btn = document.querySelector(`[data-action="runPreset"][data-preset-idx="${i}"]`), used = p.oneTime && _presetUsed.get(i);
            if (btn) { btn.disabled = !!used; btn.classList.toggle('gohaeng-used', !!used); btn.title = used ? '초기화 버튼으로 재활성화됩니다' : (p.tooltip || p.label); }
        });
    }

    function resetGroupCompleted(level) {
        if (level >= 5) {
            completedTargets.forEach((qty, uid) => {
                deleteCompletedRecipe(uid, qty);
                completedUnits.delete(uid);
                activeUnits.set(uid, qty);
            });
            completedTargets.clear();
            _cartTab = 'active';
            _presetUsed.clear(); updatePresetBtns();
        } else {
            const uidsToReset = [];
            completedUnits.forEach((_, uid) => {
                if (activeUnits.has(uid)) return;
                let nativeLvl = _unitNativeLevels.get(uid) || 1;
                if (nativeLvl <= level) {
                    uidsToReset.push(uid);
                }
            });
            
            uidsToReset.forEach(uid => completedUnits.delete(uid));
        }
        toggleHighlight(null); debouncedUpdateAllPanels();
    }

    function setupInitialView() { switchLayout('codex'); }

    function switchLayout(mode) {
        hideRecipeTooltip();
        const layout = getEl('mainLayout'); if (!layout) return;
        _currentViewMode = mode; layout.classList.remove('view-codex', 'view-deduct');
        const btnCodex = getEl('btnViewCodex'), btnDeduct = getEl('btnViewDeduct');
        if (mode === 'deduct') { layout.classList.add('view-deduct'); btnCodex?.classList.remove('active'); btnDeduct?.classList.add('active'); }
        else { layout.classList.add('view-codex'); btnCodex?.classList.add('active'); btnDeduct?.classList.remove('active'); }
    }


    function startSmartChange(id, delta, event) {
        if (event) {
            if (event.type === 'touchstart' || event.type === 'pointerdown') _lastInteractionTime = Date.now();
            else if (event.type === 'mousedown' && Date.now() - _lastInteractionTime < (APP_INTERNAL.mouseAfterTouchDelay)) { if (event.cancelable) event.preventDefault(); event.stopPropagation?.(); return; }
        }
        stopSmartChange(); triggerHaptic(); _touchHoldCount = 0;
        const action = () => { let accelDelta = delta * (event?.shiftKey ? (APP_INTERNAL.accelShiftMultiplier) : (Math.floor(++_touchHoldCount / (APP_INTERNAL.accelStepUnit)) + 1)), current = activeUnits.get(id) || 0; if (current === 0 && accelDelta > 0) toggleUnitSelection(id, accelDelta); else setUnitQty(id, current + accelDelta); };
        action(); _currentAccelInterval = APP_INTERNAL.accelInterval;
        const loop = () => { triggerHaptic(); action(); _currentAccelInterval = Math.max(APP_INTERNAL.accelMinInterval, _currentAccelInterval - (APP_INTERNAL.accelDecreaseStep)); repeatTimer = setTimeout(loop, _currentAccelInterval); };
        repeatDelayTimer = setTimeout(loop, APP_INTERNAL.holdStartDelay);
    }
    function stopSmartChange() {
        clearTimeout(repeatDelayTimer);
        clearTimeout(repeatTimer);
        repeatDelayTimer = null;
        repeatTimer = null;
        _touchHoldCount = 0;
    }

    function startFontHold(delta) {
        stopFontHold();
        const action = () => setFontScale(_fontScale + delta);
        action();
        _fontRepeatDelayTimer = setTimeout(() => {
            const loop = () => { action(); _fontRepeatTimer = setTimeout(loop, APP_INTERNAL.fontHoldRepeatDelay); };
            loop();
        }, APP_INTERNAL.fontHoldStartDelay);
    }
    function stopFontHold() {
        clearTimeout(_fontRepeatDelayTimer);
        clearTimeout(_fontRepeatTimer);
        _fontRepeatDelayTimer = null;
        _fontRepeatTimer = null;
    }

    function showTooltipOverlay(tt, event, widthOffset = APP_INTERNAL.tooltipOffset, heightOffset = APP_INTERNAL.tooltipOffset, forceInsideClick = false) {
        let viewWidth = document.documentElement.clientWidth;
        tt.style.maxWidth = `${viewWidth - (APP_INTERNAL.tooltipMaxWidthPad)}px`;
        
        const isClickInside = forceInsideClick || (event?.target?.closest('#recipeTooltip') !== null);
        const isAlreadyActive = tt.classList.contains('active');

        if (!isAlreadyActive) {
            tt.style.left = '-9999px';
            tt.style.top = '-9999px';
        }
        tt.classList.add('active');
        
        requestAnimationFrame(() => {
            if (isAlreadyActive && isClickInside) return;

            let x = (event?.clientX || event?.touches?.[0]?.clientX || viewWidth/2) + window.scrollX;
            let y = (event?.clientY || event?.touches?.[0]?.clientY || window.innerHeight/2) + window.scrollY;
            let ttRect = tt.getBoundingClientRect(), ttWidth = ttRect.width || (APP_INTERNAL.tooltipFallbackWidth), ttHeight = ttRect.height || (APP_INTERNAL.tooltipFallbackHeight);
            const pad = APP_INTERNAL.tooltipScrollPad;
            tt.style.left = `${Math.max(window.scrollX + pad, Math.min(x, viewWidth + window.scrollX - ttWidth - widthOffset))}px`;
            tt.style.top = `${Math.max(window.scrollY + pad, Math.min(y, window.innerHeight + window.scrollY - ttHeight - heightOffset))}px`;
        });
    }

    function showExcludedTooltip(id, event) {
        event?.stopPropagation(); const u = unitMap.get(id), tt = getEl('recipeTooltip'); if (!u || !tt) return;
        
        const isClickInside = event ? (event.target.closest('#recipeTooltip') !== null) : false;
        
        const parentUnits = []; unitMap.forEach(pu => pu.parsedRecipe?.some(pr => pr.id === id) && parentUnits.push(pu));
        tt.innerHTML = `
            <div class="tooltip-header" style="display:flex;align-items:center;gap:6px;">
                <span class="gtag grade-${u.grade}">${u.grade}</span>
                <span style="color:${SYSTEM_CONFIG.grades.colors[u.grade] || '#fbbf24'};">${u.name}</span>
                <span class="badge-excluded" style="pointer-events:none;margin-left:2px;">선택제한</span>
            </div>
            <div class="tooltip-body" style="font-size:0.82rem;color:var(--text);margin-top:8px;display:flex;flex-direction:column;gap:8px;">
                <div style="color:var(--text-sub);line-height:1.5;">이 유닛은 아래 상위 유닛의 <b style="color:var(--text);">조합 재료로 자동 포함</b>되므로<br>직접 선택할 수 없습니다.</div>
                ${parentUnits.length > 0 ? `
                <div style="display:flex;flex-direction:column;gap:4px;">
                    ${parentUnits.map(pu => `
                    <div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;">
                        <span class="gtag grade-${pu.grade}">${pu.grade}</span>
                        <span style="color:${SYSTEM_CONFIG.grades.colors[pu.grade] || 'var(--text)'};font-size:0.85rem;font-weight:900;">${pu.name}</span>
                        <span style="color:var(--text-muted);font-size:0.75rem;margin-left:auto;">의 하위 재료</span>
                    </div>`).join('')}
                </div>` : ''}
            </div>
            <div class="tooltip-footer">터치/클릭 또는 ESC로 닫힙니다.</div>`;
        showTooltipOverlay(tt, event, APP_INTERNAL.tooltipOffset, APP_INTERNAL.tooltipOffset, isClickInside);
    }

    function showRecipeTooltip(id, event, isDeduction = false) {
        event?.stopPropagation(); const u = unitMap.get(id), tt = getEl('recipeTooltip'); if (!u || !tt) return;
        
        const isClickInside = event ? (event.target.closest('#recipeTooltip') !== null) : false;

        let multi = 1;
        if (isDeduction) {
            const { reqMap, baseMap, specialReq } = _lastCalcResult || calculateDeductedRequirements();
            if (COMBO_SLOT_SET.has(id)) {
                multi = specialReq[id] || 0;
            } else if (activeUnits.has(id)) {
                multi = baseMap.get(id) || activeUnits.get(id) || 0;
            } else {
                multi = reqMap.get(id) || 0;
            }
        }
        multi = isOneTime(u) ? 1 : Math.max(multi, 1);
        let foundSpecialConds = new Set(); u.parsedRecipe?.forEach(pr => pr.id && CLEAN_SPECIAL_CONDITIONS[pr.id] && foundSpecialConds.add(pr.id));

        tt.innerHTML = `<div class="tooltip-header" style="color:${SYSTEM_CONFIG.grades.colors[u.grade]}"><div>${u.name} 조합법 ${multi > 1 ? `<span class="tooltip-multi-count">(${multi}개 기준)</span>` : ''}</div></div><div class="tooltip-body">${formatRecipe(u, multi, true)}${foundSpecialConds.size > 0 ? `<div class="tsc-wrap">${Array.from(foundSpecialConds).map(uid => `<div class="tsc-item">${CLEAN_SPECIAL_CONDITIONS[uid]}</div>`).join('')}</div>` : ''}</div>${CLEAN_UNIT_CONDITIONS[u.id] ? `<div class="tsc-wrap tsc-wrap-unit"><div class="tsc-item">${CLEAN_UNIT_CONDITIONS[u.id]}</div></div>` : ''}<div class="tooltip-footer"><span class="tooltip-footer-close">터치/클릭 또는 ESC로 닫기</span></div>`;
        showTooltipOverlay(tt, event, APP_INTERNAL.tooltipOffset, APP_INTERNAL.tooltipOffset, isClickInside);
    }
    
    function hideRecipeTooltip() {
        getEl('recipeTooltip')?.classList.remove('active');
    }

    function toggleUnitSelection(id, forceQty) {
        if (!unitMap.has(id) || isRestrictedUnit(id) || isHiddenUnit(id)) return;
        if (activeUnits.has(id)) activeUnits.delete(id);
        else activeUnits.set(id, normalizeUnitQty(id, forceQty || 1));
        debouncedUpdateAllPanels();
    }
    function setUnitQty(id, val) {
        if (!unitMap.has(id) || isRestrictedUnit(id) || isHiddenUnit(id) || isOneTime(unitMap.get(id))) return;
        const q = normalizeUnitQty(id, val);
        if (q <= 0) return;
        activeUnits.set(id, q);
        debouncedUpdateAllPanels();
    }

    function toggleHighlight(uid, event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        const board = getEl('deductionBoard'); if (!board) return;

        if (!uid || _currentHighlight === uid) {
            _currentHighlight = null;
            board.classList.remove('highlight-mode');
        } else {
            _currentHighlight = uid;
            board.classList.add('highlight-mode');
        }
        
        debouncedUpdateAllPanels();
    }

    function toggleSelectAllTab() {
        const currentTab = SYSTEM_CONFIG.tabs[_activeTabIdx]; if (!currentTab) return;
        const minGradeIdx = getGradeIndex(SYSTEM_CONFIG.search.minGradeForSearch || "레전드");
        const catItems = Array.from(unitMap.values()).filter(u => u.category === currentTab.key && (getGradeIndex(u.grade) >= minGradeIdx || isSearchAllowed(u.id)) && !isHiddenUnit(u.id) && !isRestrictedUnit(u.id));
        if (!catItems.length) return;
        if (catItems.every(item => activeUnits.has(item.id))) catItems.forEach(item => activeUnits.delete(item.id));
        else catItems.forEach(item => !activeUnits.has(item.id) && activeUnits.set(item.id, normalizeUnitQty(item.id, 1)));
        triggerHaptic(); debouncedUpdateAllPanels();
    }

    function selectTab(idx) {
        hideRecipeTooltip();
        _activeTabIdx = Math.max(0, Math.min(parseInt(idx, 10) || 0, SYSTEM_CONFIG.tabs.length - 1));
        updateTabsUI();
        renderCurrentTabContent();
    }

    let _fontScale = 1.0;
    function setFontScale(scale) {
        if (window.innerWidth < (APP_INTERNAL.mobileBreakpoint)) return;
        _fontScale = Math.max(APP_INTERNAL.fontScaleMin, Math.min(APP_INTERNAL.fontScaleMax, scale));
        document.documentElement.style.setProperty('--fs-scale', _fontScale);
        const label = getEl('fontSizeLabel');
        if (label) label.innerText = `${Math.round(_fontScale * 100)}%`;
        try { localStorage.setItem(SYSTEM_CONFIG.storageKeys.fontScale, String(_fontScale)); } catch(e) {}
    }
    function loadFontScale() {
        const ctrl = document.querySelector('.gh-fontsize-ctrl');
        const minWidth = APP_INTERNAL.mobileBreakpoint;
        const tabletMax = APP_INTERNAL.tabletPortraitMax;
        const isTabletPortrait = window.innerWidth >= minWidth && window.innerWidth <= tabletMax && window.innerHeight > window.innerWidth;
        if (window.innerWidth < minWidth || isTabletPortrait) { if (ctrl) ctrl.style.display = 'none'; return; }
        try { const saved = localStorage.getItem(SYSTEM_CONFIG.storageKeys.fontScale); if (saved) setFontScale(parseFloat(saved)); } catch(e) {}
    }

    // [10] 이벤트
    ['pointerup','pointercancel','touchend','touchcancel','mouseup','contextmenu'].forEach(evt => { document.addEventListener(evt, stopSmartChange); document.addEventListener(evt, stopFontHold); });
    
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopSmartChange();
            stopFontHold();
        }
    });

    document.addEventListener('click', e => {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) {
            if (_currentHighlight) toggleHighlight(null);
            if (getEl('recipeTooltip')?.classList.contains('active') && !e.target.closest('#recipeTooltip')) hideRecipeTooltip();
            return;
        }

        const action = actionEl.dataset.action, uid = actionEl.dataset.uid;
        switch (action) {
            case 'switchMainView': switchLayout(actionEl.dataset.view); break;
            case 'runPreset':
                const idx = parseInt(actionEl.dataset.presetIdx, 10), preset = SYSTEM_CONFIG.presets[idx];
                if (preset && !(preset.oneTime && _presetUsed.get(idx))) { processCommand(preset.command, true); if (preset.oneTime) _presetUsed.set(idx, true); updatePresetBtns(); }
                break;
            case 'showAppVersion': {
                const titleRoot = actionEl.closest('.gh-logo-text') || actionEl;
                const t = titleRoot.querySelector('#ghTitleText, .gh-title') || document.getElementById('ghTitleText') || document.querySelector('.gh-title');
                const version = getNexusVersion();
                if (!t || !version || t.dataset.versionShowing) return;
                const original = t.textContent.trim() || '개복디 넥서스';
                t.dataset.versionShowing = '1';
                t.textContent = version;
                clearTimeout(_titleVersionTimer);
                _titleVersionTimer = setTimeout(() => {
                    t.textContent = original;
                    delete t.dataset.versionShowing;
                }, APP_INTERNAL.appVersionDisplayMs);
                break;
            }
            case 'switchPresetTab': _presetTab = actionEl.dataset.tab; renderPresetButtons(); break;
            case 'toggleHideCompleted':
                _hideCompleted = !_hideCompleted;
                updateHideCompletedBtn();
                debouncedUpdateAllPanels();
                break;
            case 'restoreAllCompleted': restoreAllCompleted(); break;
            case 'resetCodex': resetCodex(); break;
            case 'selectTab': selectTab(parseInt(actionEl.dataset.tabIdx, 10)); break;
            case 'toggleSelectAllTab': toggleSelectAllTab(); break;
            case 'removeCartItem': e.stopPropagation(); if (uid) { activeUnits.delete(uid); debouncedUpdateAllPanels(); } break;
            case 'toggleFavorite': toggleFavorite(uid, e); break;
            case 'toggleUnit': toggleUnitSelection(uid, 1); break;
            case 'toggleHighlight': toggleHighlight(uid, e); break;
            case 'toggleGroup':
                const grp = actionEl.closest('.deduct-group'), gridEl = getEl(actionEl.dataset.gridId), icon = actionEl.querySelector('.grp-toggle-icon');
                if (grp) {
                    if (grp.classList.contains('collapsed') || (gridEl && gridEl.style.display === 'none')) { grp.classList.remove('collapsed'); if (gridEl) gridEl.style.display = 'grid'; if (icon) icon.style.transform = 'rotate(0deg)'; }
                    else { grp.classList.add('collapsed'); if (gridEl) gridEl.style.display = 'none'; if (icon) icon.style.transform = 'rotate(-90deg)'; }
                }
                break;
            case 'addComplete': e.stopPropagation(); completeUnit(uid, parseInt(actionEl.dataset.batch || 1, 10)); break;
            case 'completeUnit': e.stopPropagation(); completeUnit(uid); break;
            case 'switchCartTab': _cartTab = actionEl.dataset.tab || 'active'; updateCartUI(); break;
            case 'toggleCartCollapse': toggleCartCollapse(); break;
            case 'restoreUnit': e.stopPropagation(); restoreUnit(uid); break;
            case 'resetGroup': e.stopPropagation(); resetGroupCompleted(parseInt(actionEl.dataset.level, 10)); break;
            case 'showExcludedTooltip': e.stopPropagation(); showExcludedTooltip(uid, e); break;
            case 'showRecipeTooltip': e.stopPropagation(); showRecipeTooltip(uid, e, actionEl.dataset.isDeduction === 'true'); break;
        }
    });

    document.addEventListener('pointerdown', e => {
        const actionEl = e.target.closest('[data-action="smartChange"]');
        if (actionEl) { e.stopPropagation(); startSmartChange(actionEl.dataset.uid, parseInt(actionEl.dataset.delta, 10), e); return; }
        if (e.target.closest('[data-action="increaseFont"]')) { e.preventDefault(); startFontHold(APP_INTERNAL.fontScaleStep); return; }
        if (e.target.closest('[data-action="decreaseFont"]')) { e.preventDefault(); startFontHold(-(APP_INTERNAL.fontScaleStep)); return; }
    });
    document.addEventListener('keydown', e => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target?.closest?.('[data-action="showAppVersion"]')) {
            e.preventDefault();
            e.target.closest('[data-action="showAppVersion"]').click();
            return;
        }
        if (e.key === 'Escape') {
            if (_currentHighlight) toggleHighlight(null);
            hideRecipeTooltip();
            const searchInp = getEl('unitSearchInput');
            if (document.activeElement === searchInp) searchInp?.blur();
        }
    });
    window.addEventListener('orientationchange', hideRecipeTooltip);
    window.addEventListener('resize', hideRecipeTooltip);

    // [11] Boot 연동 초기화
    let _isSwiping = false;
    function startNexusApp(){
        try {
            document.documentElement.lang = 'ko';
            if (typeof UNIT_DATABASE === 'undefined' || !Array.isArray(UNIT_DATABASE)) { markNexusAppError("N1003", new Error("UNIT_DATABASE load failed")); return; }
            UNIT_DATABASE.forEach(kArr => unitMap.set(clean(kArr[0]), { id: clean(kArr[0]), name: kArr[0], grade: kArr[1] || SYSTEM_CONFIG.grades.order[0], category: kArr[2] || SYSTEM_CONFIG.tabs[0].key, recipe: kArr[3], cost: kArr[4] }));
            pruneFavorites();

            initializeCacheEngine(); loadNexusState(); loadFontScale(); renderDashboardAtoms(); renderDeductionBoard(); renderTabs(); selectTab(0); debouncedUpdateAllPanels(); setupSearchEngine(); setupInitialView(); renderPresetButtons();
            updateHideCompletedBtn();
            _cartCollapsed = false;
            syncCartVisibility();
            requestAnimationFrame(() => {
                debouncedUpdateAllPanels();
            });
            const sArea = getEl('tabContent');
            if (sArea) {
                let sX = 0, sY = 0;
                sArea.addEventListener('touchstart', e => { sX = e.changedTouches[0].screenX; sY = e.changedTouches[0].screenY; }, { passive: true });
                sArea.addEventListener('touchend', e => {
                    if (_isSwiping) return;
                    let dX = e.changedTouches[0].screenX - sX, dY = e.changedTouches[0].screenY - sY;
                    if (Math.abs(dX) > 70 && Math.abs(dY) < 50) {
                        _isSwiping = true;
                        if (dX > 0 && _activeTabIdx > 0) selectTab(_activeTabIdx - 1);
                        else if (dX < 0 && _activeTabIdx < SYSTEM_CONFIG.tabs.length - 1) selectTab(_activeTabIdx + 1);
                        if (_swipeTimer) clearTimeout(_swipeTimer);
                        _swipeTimer = setTimeout(() => _isSwiping = false, 300);
                    }
                }, { passive: true });
            }
            // 체크리스트 패널 스와이프: 좌→도감, 우→체크리스트 뷰 전환
            const dBoard = getEl('colRightPanel');
            if (dBoard) {
                let dX0 = 0, dY0 = 0;
                dBoard.addEventListener('touchstart', e => { dX0 = e.changedTouches[0].screenX; dY0 = e.changedTouches[0].screenY; }, { passive: true });
                dBoard.addEventListener('touchend', e => {
                    const dx = e.changedTouches[0].screenX - dX0, dy = e.changedTouches[0].screenY - dY0;
                    if (Math.abs(dx) > 80 && Math.abs(dy) < 50) {
                        if (dx > 0) switchLayout('codex'); else switchLayout('deduct');
                    }
                }, { passive: true });
            }
            markNexusAppReady();
        } catch (err) {
            console.error("[오류] 넥서스 초기화 중 에러 발생:", err);
            markNexusAppError("N1001", err);
        }
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startNexusApp, { once: true });
    else startNexusApp();
})();