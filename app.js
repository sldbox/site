// ============================================================================
// 넥서스 앱 실행 (app.js)
// 00. 설정·정책 병합        01. 런타임 상수·상태
// 02. 공통 유틸·데이터      03. 저장·검색·명령
// 04. 계산 엔진             05. 완료·복구·초기화
// 06. 코스트 보드           07. 체크리스트
// 08. 도감·탭·프리셋       09. 장바구니
// 10. 화면·입력·툴팁       11. 이벤트 바인딩
// 12. 앱 초기화
// ============================================================================

(() => {

    // ── 00. 설정 및 정책 병합 ────────────────────────────────────────────────
    const USER_CONFIG = window.NEXUS_USER_CONFIG || {};
    const PRIMARY_UNIT_GROUPS = Object.freeze({
        "테바": ["비밀작전노바", "타이커스핀들레이", "마일스블레이즈루이스", "광부", "특공대레이너"],
        "테메": ["테라트론", "해적주력함", "아우구스트그라드의자랑"],
        "토바": ["아몬", "말라쉬", "테사다르"],
        "토메": ["아둔의창", "정화자감시자", "탈다림모선", "셀렌디스"],
        "저그중립": ["불새케리건", "초월체", "땅굴파괴자", "원시케리건", "데하카"],
        "혼종": ["나루드", "아몬의젤나가피조물", "혼종종언자", "사라케리건"]
    });
    const APP_DEFAULT_CONFIG = {
        policy: {
            hybridWeight: 3,
            maxUnitCapacity: 16,
            oneTimeMinGrade: "슈퍼히든",
            hiddenGroupMinGrade: "히든",
            minGradeForChecklist: "레어",
            hideCompletedExcludeGroups: ["최종 목표"],
            restoreAllBtn: {
                idBtn: "btnRestoreAll",
                idLabel: "btnRestoreAllLabel",
                labelDefault: "전체 초기화",
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
        sorting: { order: { "아몬": 100, "나루드": 97 } },
        groupDefs: [
            { id: 'group-target',       pid: 'grid-target',       title: '최종 목표', resetLevel: 5, isCol: false, alwaysShow: false, alwaysOpen: true,  resetLabel: '최종 복구' },
            { id: 'group-special',      pid: 'grid-special',      title: '직속 재료', resetLevel: 4, isCol: false, alwaysShow: false, alwaysOpen: true,  resetLabel: '직속 복구' },
            { id: 'group-upper-hidden', pid: 'grid-upper-hidden', title: '히든 재료', resetLevel: 3, isCol: true,  alwaysShow: false, alwaysOpen: false, resetLabel: '히든 복구' },
            { id: 'group-basic-hidden', pid: 'grid-basic-hidden', title: '기본 재료', resetLevel: 2, isCol: true,  alwaysShow: false, alwaysOpen: false, resetLabel: '기본 복구' }
        ],
        dashboardAtoms: [
            "전쟁광", "스파르타중대", "암흑광전사", "암흑파수기", "원시바퀴",
            "저격수", "코브라", "암흑고위기사", "암흑추적자", "변종가시지옥",
            "망치경호대", "공성파괴단", "암흑집정관", "암흑불멸자", "원시히드라리스크",
            "땅거미지뢰", "자동포탑", "우르사돈암", "갓오타", "메시브"
        ],
        storageKeys: window.NEXUS_STORAGE_KEYS || {
            saveData: "nexusSaveData",
            favorites: "nexusFavorites",
            fontScale: "nexusFontScale"
        },
        search: {
            minGradeForSearch: "레전드",
            restrictedIds: []
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

    // ── 01-1. 정규화·검색·렌더링 상수 ───────────────────────────────────────
    const IGNORE_PARSE_RECIPES = ["미발견", "없음", ""];
    const clean = (s) => s ? s.replace(/\s+/g, '').toLowerCase() : '';
    const ATOM_HASH = Object.fromEntries(SYSTEM_CONFIG.dashboardAtoms.map(a => [clean(a), a]));
    const makeCleanSet = (list = []) => new Set(list.map(clean).filter(Boolean));
    const CLEAN_TOOLS_MAP = Object.fromEntries(Object.entries(SYSTEM_CONFIG.tools).map(([k, v]) => [clean(k), v.map(clean)]));
    const CLEAN_RESTRICTED_IDS = makeCleanSet(SYSTEM_CONFIG.search.restrictedIds || []);
    const _behaviors = SYSTEM_CONFIG.unitBehaviors || {};
    const SPECIAL_RENDER_LIST = Object.entries(_behaviors).filter(([, b]) => b.specialRender).map(([id, b]) => ({ id: clean(id), raw: id, batch: b.batch || 1 }));
    const AUTO_COST_SLOT_SET = new Set(Object.entries(_behaviors).filter(([, b]) => b.specialRender).map(([id]) => clean(id)));
    const AUTO_COST_SLOT_RAWS = Object.entries(_behaviors).filter(([, b]) => b.specialRender).map(([id]) => id);
    const AUTO_COST_RAW_MAP = Object.fromEntries(AUTO_COST_SLOT_RAWS.map(id => [clean(id), id]));
    const CLEAN_ONE_TIME_UNITS = new Set((SYSTEM_CONFIG.oneTimeIds || []).map(clean));
    const CLEAN_PRIMARY_UNIT_IDS = makeCleanSet(Object.values(PRIMARY_UNIT_GROUPS).flat());
    const CLEAN_PRESET_NOSTACK = new Set(Object.entries(_behaviors).filter(([, b]) => b.presetNoStack).map(([id]) => clean(id)));
    const CLEAN_CRAFT_BATCH = Object.fromEntries(SPECIAL_RENDER_LIST.map(e => [e.id, e.batch]));
    const BASIC_VISIBLE_GRADES = new Set(["레어", "에픽", "유니크", "헬"]);
    const AUTO_COMPLETE_IDS = SPECIAL_RENDER_LIST.map(e => e.id);
    const CLEAN_SPECIAL_CONDITIONS = Object.fromEntries(Object.entries(SYSTEM_CONFIG.specialConditions).map(([k, v]) => [clean(k), v]));
    const CLEAN_UNIT_CONDITIONS = Object.fromEntries(Object.entries(SYSTEM_CONFIG.unitConditions || {}).map(([k, v]) => [clean(k), v]));
    const GROUP_DEFS = SYSTEM_CONFIG.groupDefs;
    const titleToGridId = Object.fromEntries(GROUP_DEFS.map(g => [g.title, g.pid]));
    const unitMap = new Map(), activeUnits = new Map(), pausedUnits = new Map(), completedUnits = new Map(), depCache = new Map();
    const completedTargets = new Map(), _unitNativeLevels = new Map(), _unitRestoreLevels = new Map();
    const _depVisiting = new Set();
    const PRESET_COLOR_MAP = {
        '빨강':'red', '주황':'orange', '노랑':'yellow', '연두':'lime',
        '초록':'green', '하늘':'sky', '파랑':'blue', '남색':'navy',
        '보라':'purple', '분홍':'pink', '청록':'cyan',
        '흰색':'white', '검정':'black', '회색':'gray', '금색':'gold'
    };
    const isBrightColor = (name) => ['노랑','연두','하늘','흰색','금색'].includes(name);
    const FAVORITES_KEY = SYSTEM_CONFIG.storageKeys?.favorites || 'nexusFavorites';
    // ── 01-2. 내부 안전장치·조작 정책 ───────────────────────────────────────
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

    // ── 01-3. 부팅 상태 전달 ────────────────────────────────────────────────
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

    // ── 01-4. 선택·완료·화면 상태 ──────────────────────────────────────────
    const _favorites = new Set((() => { try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); } catch(e) { return []; } })());
    let _activeTabIdx = 0, _currentViewMode = 'codex', _currentHighlight = null, _hideCompleted = false;
    let _cartTab = 'active', _isTabContentInitialized = false, _isDeductionBoardRendered = false;
    let repeatTimer = null, repeatDelayTimer = null, _lastInteractionTime = 0, _currentAccelInterval = APP_INTERNAL.accelInterval, _touchHoldCount = 0;
    let updateTimer = null, _completeLock = new Set(), _presetUsed = new Map(), _restoreAllCooldown = false;
    let _restoreAllPendingTimer = null;
    let _lastCalcResult = null;
    let _fontRepeatTimer = null, _fontRepeatDelayTimer = null, _swipeTimer = null, _titleVersionTimer = null;
    let _presetTab = '일반 프리셋';
    let _fontScale = 1.0;

    // ── 02-1. DOM·등급·검색 공통 유틸 ──────────────────────────────────────
    const getEl = (id) => document.getElementById(id);
    const triggerHaptic = () => navigator.vibrate?.(APP_INTERNAL.hapticDuration);
    const virtualUnitIds = new Set(AUTO_COMPLETE_IDS);
    const isToolRequirement = (parent, child) => CLEAN_TOOLS_MAP[parent]?.includes(child);
    const getToolNeed = (parent) => CLEAN_TOOLS_MAP[parent] || [];
    const isSpecialRender = (id) => SPECIAL_RENDER_LIST.some(e => e.id === id);
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
    const CART_TABS = ['active', 'paused', 'done'];
    const isValidCartTab = (tab) => CART_TABS.includes(tab);
    const setCartTab = (tab) => { _cartTab = isValidCartTab(tab) ? tab : 'active'; };
    const setActiveUnitQty = (uid, qty, { add = false } = {}) => {
        const unit = unitMap.get(uid);
        if (!unit || isRestrictedUnit(uid)) return false;
        const baseQty = add ? (activeUnits.get(uid) || 0) : 0;
        const nextQty = normalizeUnitQty(uid, baseQty + (parseInt(qty, 10) || 1));
        if (nextQty <= 0) return false;
        activeUnits.set(uid, nextQty);
        pausedUnits.delete(uid);
        return true;
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
    // ── 02-2. 상태 정리·조합식 파싱·데이터 캐시 ────────────────────────────
    function sanitizeRuntimeState() {
        const normalizeMap = (map, allowAutoCost = false) => {
            for (const [rawUid, rawQty] of [...map.entries()]) {
                const uid = normalizeSavedId(rawUid);
                const qty = parseInt(rawQty, 10);
                map.delete(rawUid);
                if (!Number.isFinite(qty) || qty <= 0) continue;
                if (unitMap.has(uid)) setPositiveMapValue(map, uid, qty);
                else if (allowAutoCost && AUTO_COST_SLOT_SET.has(uid)) map.set(uid, qty);
            }
        };
        normalizeMap(activeUnits);
        normalizeMap(pausedUnits);
        normalizeMap(completedTargets);
        normalizeMap(completedUnits, true);
        activeUnits.forEach((_, uid) => pausedUnits.delete(uid));
        completedTargets.forEach((_, uid) => {
            activeUnits.delete(uid);
            pausedUnits.delete(uid);
        });
        if (!isValidCartTab(_cartTab)) _cartTab = 'active';
        if (_cartTab === 'paused' && pausedUnits.size === 0 && activeUnits.size > 0) _cartTab = 'active';
        if (_cartTab === 'done' && completedTargets.size === 0 && activeUnits.size > 0) _cartTab = 'active';
    }

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

    // ── 02-3. 조합식 표시 생성 ─────────────────────────────────────────────
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
                const isTool = isToolRequirement(item.id, unitId);
                const qtyNum = isTool ? 1 : (m[3] ? parseInt(m[3], 10) : 1) * multi;
                const color = u ? SYSTEM_CONFIG.grades.colors[u.grade] : 'var(--text)';
                const toolHtml = isTool ? `<span class="tool-badge">[도구]</span>` : '';
                if (showSep && m[2] && !CLEAN_SPECIAL_CONDITIONS[unitId]) {
                    return `<div class="recipe-badge" style="color:${color};"><span class="recipe-badge-name">${m[1].trim()}</span>${toolHtml}<span class="badge-cond recipe-cond-offset">${m[2].replace(/,/g, ' ')}</span><span class="badge-qty-wrap"><span class="badge-qty">· ${qtyNum}개</span></span></div>`;
                }
                return `<div class="recipe-badge" style="color:${color};"><span class="recipe-badge-name">${m[1].trim()}</span>${toolHtml}<span class="badge-qty-wrap">${condHtml}<span class="badge-qty">· ${qtyNum}개</span></span></div>`;
            }
            return `<div class="recipe-token-muted">${p}</div>`;
        }).join('');
        let specialCondInlineHtml = (!showSep && foundSpecialIds.length > 0) ? `<div class="tsc-wrap tsc-wrap-inline">${foundSpecialIds.map(uid => `<div class="tsc-item tsc-item-inline">${CLEAN_SPECIAL_CONDITIONS[uid]}</div>`).join('')}</div>` : '';
        return `<div class="${showSep ? 'recipe-flex-wrap' : 'recipe-vertical'}">${partsHtml}</div>${specialCondInlineHtml}`;
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
                    const spKey = AUTO_COMPLETE_IDS.find(k => k === cName || cName.includes(k));
                    if (spKey) { type = 'autoCost'; key = spKey; }
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


    // ── 03. 저장·검색·명령 ─────────────────────────────────────────────────
    function loadNexusState() {
        try {
            const data = localStorage.getItem(SYSTEM_CONFIG.storageKeys.saveData);
            if (!data) return;
            const state = JSON.parse(data);
            if (!state || typeof state !== 'object') return;

            activeUnits.clear();
            pausedUnits.clear();
            completedUnits.clear();
            completedTargets.clear();
            _presetUsed.clear();

            state.active?.forEach(([k, v]) => setPositiveMapValue(activeUnits, normalizeSavedId(k), v));
            state.paused?.forEach?.(([k, v]) => setPositiveMapValue(pausedUnits, normalizeSavedId(k), v));
            state.completed?.forEach(([k, v]) => {
                const uid = normalizeSavedId(k);
                const q = parseInt(v, 10);
                if (!Number.isFinite(q) || q <= 0) return;
                if (unitMap.has(uid)) setPositiveMapValue(completedUnits, uid, q);
                else if (AUTO_COST_SLOT_SET.has(uid)) completedUnits.set(uid, q);
            });
            state.completedTargets?.forEach(([k, v]) => setPositiveMapValue(completedTargets, normalizeSavedId(k), v));
            _cartTab = isValidCartTab(state.cartTab) ? state.cartTab : 'active';
            state.presetUsed?.forEach(([k, v]) => {
                const idx = parseInt(k, 10);
                if (Number.isInteger(idx) && SYSTEM_CONFIG.presets[idx]) _presetUsed.set(idx, !!v);
            });
            _hideCompleted = !!state.hideCompleted;

            sanitizeRuntimeState();
        } catch(e) {
            activeUnits.clear(); pausedUnits.clear(); completedUnits.clear(); completedTargets.clear(); _presetUsed.clear();
        }
    }

    function saveNexusState() {
        try {
            sanitizeRuntimeState();
            localStorage.setItem(SYSTEM_CONFIG.storageKeys.saveData, JSON.stringify({ active: [...activeUnits], paused: [...pausedUnits], completed: [...completedUnits], completedTargets: [...completedTargets], cartTab: _cartTab, presetUsed: [..._presetUsed], hideCompleted: _hideCompleted }));
        } catch(e) {}
    }

    function saveFavorites() {
        try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([..._favorites].sort())); }
        catch(e) {}
    }

    function pruneFavorites() {
        let changed = false;
        [..._favorites].forEach(id => {
            if (!unitMap.has(id)) {
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
            if (getGradeIndex(u.grade) < minGradeIdx) continue;
            if (id === cleaned) return u;
            if (id.includes(cleaned)) {
                const score = 100 - id.indexOf(cleaned) * 10 - (id.length - cleaned.length);
                if (score > bestScore) { bestScore = score; best = u; }
            }
        }
        return best;
    }

    function processCommand(val, fromPreset = false, preventStack = false) {
        if (!val.trim()) return;
        let successCount = 0, restrictedCount = 0;
        val.split('/').filter(c => c.trim()).forEach(cmd => {
            let parts = cmd.split('*'), targetName = parts[0].trim();
            if (!targetName) return;
            let qtyRaw = parseInt(parts[1], 10);
            let qty = (isNaN(qtyRaw) || qtyRaw < 1) ? 1 : Math.min(qtyRaw, SYSTEM_CONFIG.policy.maxUnitCapacity);
            const match = findUnitFlexible(targetName);
            if (match) {
                if (isRestrictedUnit(match.id)) { restrictedCount++; return; }
                if (fromPreset && (preventStack || CLEAN_PRESET_NOSTACK.has(match.id)) && activeUnits.has(match.id)) { successCount++; return; }
                setActiveUnitQty(match.id, qty, { add: true });
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


    // ── 04. 계산 엔진 및 패널 갱신 ─────────────────────────────────────────
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
        catch(e) {}
        Object.keys(counts).forEach(k => { if (isNaN(counts[k]) || counts[k] < 0) counts[k] = 0; });
        return counts;
    }

    function calculateDeductedRequirements() {
        let reqMap = new Map(), baseMap = new Map(), reasonMap = new Map();
        let autoCostReq = {}, baseAutoCostReq = {}, autoCostReason = {};
        AUTO_COST_SLOT_RAWS.forEach(k => { autoCostReq[clean(k)] = 0; baseAutoCostReq[clean(k)] = 0; autoCostReason[clean(k)] = new Map(); });

        let mergedActive = new Set();
        activeUnits.forEach((_, uid) => unitMap.get(uid)?.parsedRecipe?.forEach(pr => pr.id && activeUnits.has(pr.id) && mergedActive.add(pr.id)));

        const calcBFS = (isDeficit) => {
            let map = new Map(), processed = new Map(), queue = [], inQueue = new Set();
            activeUnits.forEach((qty, uid) => { map.set(uid, isOneTime(unitMap.get(uid)) ? 1 : qty); queue.push(uid); inQueue.add(uid); });
            let loopCount = 0;
            const maxLoop = APP_INTERNAL.maxLoopQueue;
            
            while(queue.length > 0) {
                if (++loopCount > maxLoop) break;
                let uid = queue.shift(); inQueue.delete(uid);
                let tNeed = map.get(uid) || 0;
                if ((!unitMap.has(uid) && !virtualUnitIds.has(uid)) || tNeed <= 0) continue;
                
                let eNeed = tNeed - (isDeficit ? Math.min(mergedActive.has(uid) ? 0 : (completedUnits.get(uid) || 0), tNeed) : 0);
                const prevNeed = processed.get(uid) || 0;
                let delta = eNeed - prevNeed;
                if (delta <= 0) continue;
                processed.set(uid, eNeed);
                
                getToolNeed(uid).forEach(tid => {
                    if (eNeed > 0 && prevNeed <= 0) {
                        let nv = (map.get(tid) || 0) + 1;
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

        const updateAutoCosts = (map, reqObj) => map.forEach((needed, uid) => unitMap.get(uid)?.parsedCost?.forEach(pc => {
            if (AUTO_COST_SLOT_SET.has(pc.key)) reqObj[pc.key] += pc.qty * needed;
        }));
        
        updateAutoCosts(baseDeficits, baseAutoCostReq);
        updateAutoCosts(deficits, autoCostReq);
        AUTO_COST_SLOT_RAWS.forEach(k => { const id = clean(k); autoCostReq[id] = Math.max(0, autoCostReq[id] - (completedUnits.get(id) || 0)); });

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
                if (AUTO_COST_SLOT_SET.has(pc.key) && (deficits.get(uid) || 0) > 0) {
                    let isDirTarget = activeUnits.has(uid) && !mergedActive.has(uid);
                    autoCostReason[pc.key].set(`AUTO_${uid}`, { text: isDirTarget ? `${uData.name} 직속재료` : `${uData.name} 재료`, cond: '', depth: isDirTarget ? 1 : 2, parentUid: uid, reqQty: pc.qty });
                }
            });
        });

        rootTracking.forEach((rMap, cId) => {
            const finalMap = new Map(rMap);
            if (activeUnits.has(cId)) finalMap.set('TARGET_' + cId, { text: GROUP_DEFS.find(g => g.pid === 'grid-target')?.title || '', cond: '', depth: 0 });
            reasonMap.set(cId, finalMap);
        });

        return { reqMap, baseMap, reasonMap, autoCostReq, baseAutoCostReq, autoCostReason };
    }

    function getDependencies(uid) {
        if (depCache.has(uid)) return depCache.get(uid);
        if (_depVisiting.has(uid)) return new Set([uid]);
        _depVisiting.add(uid);
        let deps = new Set([uid]);
        try {
            const u = unitMap.get(uid);
            if (u) {
                u.parsedRecipe?.forEach(child => child.id && getDependencies(child.id).forEach(d => deps.add(d)));
                u.parsedCost?.forEach(pc => AUTO_COST_SLOT_SET.has(pc.key) && deps.add(pc.key));
            }
            depCache.set(uid, deps);
        } finally {
            _depVisiting.delete(uid);
        }
        return deps;
    }

    function clampCompletedUnits(calcResult) {
        const { baseMap, baseAutoCostReq } = calcResult || calculateDeductedRequirements();
        let changed = false;
        for (let [uid, rawQty] of [...completedUnits.entries()]) {
            const compQty = parseInt(rawQty, 10);
            if (!Number.isFinite(compQty) || compQty <= 0 || (!unitMap.has(uid) && !AUTO_COST_SLOT_SET.has(uid))) {
                completedUnits.delete(uid);
                changed = true;
                continue;
            }
            if (activeUnits.has(uid)) {
                let maxAllow = baseMap.get(uid) || activeUnits.get(uid) || 1;
                if (compQty > maxAllow) { completedUnits.set(uid, maxAllow); changed = true; }
                continue;
            }
            let maxAllow = AUTO_COST_SLOT_SET.has(uid) ? (baseAutoCostReq[uid] || 0) : (baseMap.get(uid) || 0);
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
            updateTabsUI();
            updateTabContentUI();
            updateDeductionBoard(calcResult);
            updateCartUI();
            updateEmptyMsg();
            saveNexusState();
        });
    }


    // ── 05. 완료·복구·초기화 ───────────────────────────────────────────────
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
            if (AUTO_COST_SLOT_SET.has(pc.key) && !SPECIAL_RENDER_LIST.some(e => e.id === pc.key)) {
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
            const { reqMap, baseMap, autoCostReq } = calculateDeductedRequirements();
            const isTarget = activeUnits.has(uid);
            const isAutoCost = AUTO_COST_SLOT_SET.has(uid);
            let isMergedSlot = false;
            if (isTarget && !isAutoCost) {
                activeUnits.forEach((_, activeId) => {
                    if (activeId !== uid && unitMap.get(activeId)?.parsedRecipe?.some(pr => pr.id === uid)) isMergedSlot = true;
                });
            }
            const isPureTarget = isTarget && !isMergedSlot && !isAutoCost;
            let reqVal = 0;
            if (isPureTarget) reqVal = Math.max(0, (activeUnits.get(uid) || 1) - (completedUnits.get(uid) || 0));
            else if (isAutoCost) reqVal = autoCostReq[uid] || 0;
            else if (isTarget && isMergedSlot) reqVal = Math.max(0, (baseMap.get(uid) || 1) - (completedUnits.get(uid) || 0));
            else reqVal = reqMap.get(uid) || 0;

            const requestedQty = amount !== undefined ? parseInt(amount, 10) : reqVal;
            const processQty = requestedQty === 10 && reqVal < 10 ? 0 : Math.min(requestedQty, reqVal);
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
            lockBtns.forEach(b => b.disabled = false);
        } finally {
            setTimeout(() => { _completeLock.delete(uid); }, APP_INTERNAL.completeLockDelay);
        }
    }

    function restoreUnit(uid) {
        if (!completedTargets.has(uid)) return;
        const qty = completedTargets.get(uid) || 1;
        completedTargets.delete(uid);
        // 완료 취소 시 기본 재료 기록도 함께 역산한다.
        deleteCompletedRecipe(uid, qty);
        completedUnits.delete(uid);
        if (!activeUnits.has(uid)) setActiveUnitQty(uid, qty);
        if (completedTargets.size === 0) _cartTab = 'active';
        triggerHaptic(); debouncedUpdateAllPanels();
    }

    function restoreAllCompleted() {
        if (_restoreAllCooldown) return;
        const cfg = SYSTEM_CONFIG.policy.restoreAllBtn;
        const btn = getEl(cfg.idBtn), label = getEl(cfg.idLabel);

        // 확인 대기 중 재클릭하면 초기화를 취소한다.
        if (_restoreAllPendingTimer) {
            clearTimeout(_restoreAllPendingTimer);
            _restoreAllPendingTimer = null;
            if (label) label.textContent = cfg.labelDefault;
            if (btn) { btn.classList.remove('reset-btn-pending'); btn.disabled = false; }
            return;
        }

        // 첫 클릭 후 확인 대기를 거쳐 초기화를 실행한다.
        if (label) label.textContent = '취소하려면 다시 클릭';
        if (btn) { btn.classList.add('reset-btn-pending'); }

        _restoreAllPendingTimer = setTimeout(() => {
            _restoreAllPendingTimer = null;
            activeUnits.clear(); pausedUnits.clear(); completedUnits.clear(); completedTargets.clear();
            _cartTab = 'active'; _presetUsed.clear(); updatePresetBtns(); triggerHaptic(); debouncedUpdateAllPanels();
            if (!btn || !label) return;
            _restoreAllCooldown = true;
            btn.classList.remove('reset-btn-pending');
            label.textContent = cfg.labelDone; btn.classList.add(cfg.classDone); btn.disabled = true;
            setTimeout(() => { label.textContent = cfg.labelDefault; btn.classList.remove(cfg.classDone); btn.disabled = false; _restoreAllCooldown = false; }, APP_INTERNAL.restoreAllResetDelay);
        }, APP_INTERNAL.restoreAllPendingDelay);
    }

    function resetCompletedMaterialsByLevel(level) {
        const uidsToReset = [];
        completedUnits.forEach((_, uid) => {
            if (activeUnits.has(uid)) return;
            const restoreLevel = _unitRestoreLevels.get(uid) || 0;
            if (restoreLevel > 0 && restoreLevel <= level) uidsToReset.push(uid);
        });
        uidsToReset.forEach(uid => completedUnits.delete(uid));
    }

    function resetGroupCompleted(level) {
        if (level >= 5) {
            completedTargets.forEach((qty, uid) => {
                setActiveUnitQty(uid, qty);
            });
            completedTargets.clear();
            completedUnits.clear();
            _cartTab = 'active';
            _presetUsed.clear(); updatePresetBtns();
        } else {
            resetCompletedMaterialsByLevel(level);
        }
        toggleHighlight(null); debouncedUpdateAllPanels();
    }

    function resetCodex() {
        activeUnits.clear(); pausedUnits.clear(); completedUnits.clear(); completedTargets.clear();
        toggleHighlight(null); _cartTab = 'active';
        _presetUsed.clear(); updatePresetBtns(); debouncedUpdateAllPanels();
    }


    // ── 06. 코스트 보드 및 대시보드 ─────────────────────────────────────────
    function renderBoardSlots(boardId, atoms, slotTemplate) {
        const board = getEl(boardId);
        if (!board) return;
        board.innerHTML = atoms.map(slotTemplate).join('');
    }

    function renderDashboardAtoms() {
        renderBoardSlots('magicDashboard', SYSTEM_CONFIG.dashboardAtoms, a =>
            `<div class="cost-slot ${AUTO_COST_SLOT_SET.has(clean(a)) ? 'is-skill-slot' : 'is-magic-slot'}" id="vslot-${clean(a)}"><div class="cost-val"></div><div class="cost-name" id="name-${clean(a)}">${a}</div></div>`
        );
    }

    function updateMagicDashboard() {
        const tMap = {}, cMap = {};
        SYSTEM_CONFIG.dashboardAtoms.forEach(a => { tMap[a] = 0; cMap[a] = 0; });

        const getDashboardAtomName = (uid) => ATOM_HASH[uid] || AUTO_COST_RAW_MAP[uid] || uid;
        const addDashboardAtom = (rawName, qty, map) => {
            if (!SYSTEM_CONFIG.dashboardAtoms.includes(rawName)) return false;
            map[rawName] = (map[rawName] || 0) + qty;
            return true;
        };
        const flattenUnitToAtoms = (uid, qty, map, path) => {
            if (qty <= 0 || path.has(uid)) return;
            path.add(uid);
            try {
                const directAtom = getDashboardAtomName(uid);
                if (addDashboardAtom(directAtom, qty, map)) return;

                const u = unitMap.get(uid);
                if (!u) return;
                if (u.parsedCost?.length) {
                    u.parsedCost.forEach(pc => {
                        const pcRaw = getDashboardAtomName(pc.key);
                        if (!addDashboardAtom(pcRaw, pc.qty * qty, map)) flattenUnitToAtoms(pc.key, pc.qty * qty, map, path);
                    });
                    getToolNeed(uid).forEach(toolId => flattenUnitToAtoms(toolId, 1, map, path));
                } else if (u.parsedRecipe?.length) {
                    u.parsedRecipe.forEach(child => {
                        if (!child.id) return;
                        isToolRequirement(uid, child.id) ? flattenUnitToAtoms(child.id, 1, map, path) : flattenUnitToAtoms(child.id, child.qty * qty, map, path);
                    });
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

            let fV = Math.max(0, tMap[a] - cMap[a]);
            if (fV > 0) {
                if (e.innerText !== String(fV)) e.innerText = String(fV);
                nEl.style.display = 'block'; container.classList.add('active');
            } else {
                if (e.innerHTML !== '') e.innerHTML = '';
                nEl.style.display = 'block'; container.classList.remove('active');
            }
        });
    }


    // ── 07. 체크리스트 보드 ────────────────────────────────────────────────
    function renderDeductionBoard() {
        if (_isDeductionBoardRendered) return;
        const boardEl = getEl('deductionBoard');
        if (!boardEl) return;
        // 07-1. 슬롯·그룹 템플릿
        const renderSlot = (id, n, g) => `<div class="deduct-slot" id="d-slot-wrap-${id}" data-uid="${id}" style="display:none;"><div class="d-reason-wrap" id="d-reason-${id}"></div><div class="d-slot-main"><div class="d-name" data-action="showRecipeTooltip" data-uid="${id}" data-is-deduction="true"><span class="gtag grade-${g}">${g}</span><span class="d-name-inline">${n}${CLEAN_SPECIAL_CONDITIONS[id]?`<span class="badge-special-cond" style="margin-left:4px; pointer-events:none;">특수조건</span>`:''}</span></div><div id="d-cond-${id}" class="d-cond-inline"></div></div><div id="craft-wrap-${id}" class="craft-wrap"></div></div>`;
        const getGrp = (id, pid, title, resetLevel=0, isCol=false, alwaysShow=false, alwaysOpen=false, resetLabel='완료복구') => `
            <div class="deduct-group" id="${id}" style="${alwaysShow ? '' : 'display:none;'}" ${alwaysShow ? 'data-always-show="true"' : ''} ${alwaysOpen ? 'data-always-open="true"' : ''}>
                <div class="deduct-group-title" data-action="toggleGroup" data-grid-id="${pid}">
                    <div class="grp-title-main">
                        <span class="grp-toggle-icon" style="transform:${isCol?'rotate(-90deg)':'rotate(0deg)'};">▼</span>
                        <span class="grp-title-text">${title}</span>
                        ${resetLevel > 0 ? `<span class="grp-count-badge" id="grp-count-${pid}"></span>` : ''}
                    </div>
                    <div class="grp-title-actions" id="${id}-actions">
                        ${resetLevel > 0 ? `<button type="button" class="btn-text-link grp-restore-btn" data-action="resetGroup" data-level="${resetLevel}">${resetLabel}</button>` : ''}
                    </div>
                </div>
                <div class="deduct-grid" id="${pid}" ${isCol?'style="display:none;"':''}></div>
            </div>`;

        const allUnits = Array.from(unitMap.values());
        // 07-2. 슬롯 유형별 HTML 생성
        const unitSlots = allUnits.filter(u => getGradeIndex(u.grade) >= getGradeIndex(SYSTEM_CONFIG.policy.minGradeForChecklist) && !AUTO_COST_SLOT_SET.has(u.id)).map(u => renderSlot(u.id, u.name, u.grade)).join('');

        const _exIds = new Set((SYSTEM_CONFIG.policy.hideCompletedExcludeGroups || []).map(t => titleToGridId[t]).filter(Boolean));

        boardEl.innerHTML = `<div id="deduct-empty-msg" class="empty-msg" style="display:none;"></div><div id="deduct-slot-pool" style="display:none;">${unitSlots}</div>` + GROUP_DEFS.map(g => getGrp(g.id, g.pid, g.title, g.resetLevel, g.isCol, g.alwaysShow, g.alwaysOpen, g.resetLabel)).join('');
        boardEl.dataset.excludeGridIds = JSON.stringify([..._exIds]);
        _isDeductionBoardRendered = true;
        placeChecklistControls();
    }

    function placeChecklistControls() {
        const actions = getEl('checklistGlobalActions') || document.querySelector('.checklist-ph-btns');
        const mobileHost = getEl('checklistMobileHeader');
        const desktopHost = getEl('group-target-actions');
        if (!actions || !mobileHost) return;
        const useMobileHeader = window.matchMedia('(max-width: 767px)').matches || !desktopHost;
        if (useMobileHeader) {
            if (actions.parentElement !== mobileHost) mobileHost.appendChild(actions);
            actions.classList.remove('checklist-actions-in-group');
            actions.classList.add('checklist-actions-in-header');
        } else {
            if (actions.parentElement !== desktopHost) desktopHost.insertBefore(actions, desktopHost.firstChild);
            actions.classList.remove('checklist-actions-in-header');
            actions.classList.add('checklist-actions-in-group');
        }
    }

    function ensureDeductionBoardRendered(calcResult) {
        if (!_isDeductionBoardRendered) renderDeductionBoard();
        if (!_isDeductionBoardRendered) return false;
        updateDeductionBoard(calcResult || _lastCalcResult || calculateDeductedRequirements());
        updateEmptyMsg();
        return true;
    }

    function wrapDeductGridPages(grid, pageSize) {
        if (!grid) return;
        const items = Array.from(grid.children).filter(el =>
            el.classList.contains('deduct-slot')
        );
        if (items.length === 0) return;
        const size = Math.max(1, pageSize || items.length);
        const frag = document.createDocumentFragment();
        for (let i = 0; i < items.length; i += size) {
            const page = document.createElement('div');
            page.className = 'deduct-page';
            items.slice(i, i + size).forEach(el => page.appendChild(el));
            frag.appendChild(page);
        }
        grid.appendChild(frag);
    }

    function updateDeductionBoard(calcResult) {
        if (!_isDeductionBoardRendered) return;
        // 07-3. 계산 결과·하이라이트 기준 수집
        const { reqMap, baseMap, reasonMap } = calcResult || calculateDeductedRequirements();
        const mergedSlots = new Set();

        const getReasonParentNeed = (info) => {
            if (!info?.parentUid) return 0;
            return Math.max(0, reqMap.get(info.parentUid) || 0);
        };
        const getReasonBaseQty = (rId, info) => {
            if (!info || info.depth === 0 || !info.reqQty) return 0;
            const parentNeed = getReasonParentNeed(info);
            if (parentNeed <= 0) return 0;
            return rId.startsWith('TOOL_') ? 1 : (info.reqQty || 1) * parentNeed;
        };
        const getReasonDisplayEntries = (slotId, rMap) => {
            if (!rMap) return [];
            const entries = [...rMap.entries()].map(([rId, info], index) => ({
                rId,
                info,
                index,
                baseQty: getReasonBaseQty(rId, info),
                displayQty: info?.depth === 0 ? 0 : getReasonBaseQty(rId, info)
            }));
            let remainingCompleted = Math.max(0, completedUnits.get(slotId) || 0);
            entries
                .filter(entry => entry.baseQty > 0)
                .sort((a, b) => a.baseQty - b.baseQty || a.index - b.index)
                .forEach(entry => {
                    if (remainingCompleted <= 0) return;
                    const consumed = Math.min(entry.displayQty, remainingCompleted);
                    entry.displayQty -= consumed;
                    remainingCompleted -= consumed;
                });
            return entries
                .filter(entry => entry.info?.depth === 0 || entry.displayQty > 0)
                .map(entry => [entry.rId, { ...entry.info, displayQty: entry.displayQty, _reasonOrder: entry.index }]);
        };
        
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
            basicHidden: getEl('grid-basic-hidden')
        };
        const restoreLevelsByGridId = {
            'grid-basic-hidden': 2,
            'grid-upper-hidden': 3,
            'grid-special': 4,
            'grid-target': 5
        };
        _unitRestoreLevels.clear();

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
                    if (AUTO_COST_SLOT_SET.has(pc.key) && !exactDepths.has(pc.key)) {
                        exactDepths.set(pc.key, curDepth);
                        nextQueue.push(pc.key);
                    }
                });
            }
            queue = nextQueue;
        }

        // 07-4. 슬롯 배치 초기화
        document.querySelectorAll('.deduct-slot[data-uid]').forEach(el => {
            el.style.display = 'none'; el.classList.remove('is-visible','has-target','is-completed');
            if (pool && el.parentElement !== pool) pool.appendChild(el);
        });
        document.querySelectorAll('.deduct-page').forEach(el => el.remove());

        // 07-5. 실제 필요 슬롯 배치 준비
        const visibleMaterialIds = new Set([...baseMap.keys(), ...reqMap.keys()]);

        // 07-6. 슬롯 수량·완료·강조 상태 반영
        const processSlot = (id) => {
            const slotEl = getEl(`d-slot-wrap-${id}`); if (!slotEl) return null;
            
            const isAutoCost = AUTO_COST_SLOT_SET.has(id);
            if (isAutoCost) return null;
            
            const isTarget = activeUnits.has(id);
            const isCompletedTarget = !isTarget && !isAutoCost && completedTargets.has(id);
            const isMergedSlot = isTarget && !isAutoCost && mergedSlots.has(id);
            
            let needed = reqMap.get(id) || 0;
            if (isMergedSlot) needed = Math.max(0, (baseMap.get(id)||0) - (completedUnits.get(id)||0));
            else if (isTarget && !isAutoCost) needed = Math.max(0, (activeUnits.get(id)||1) - (completedUnits.get(id)||0));
            if (isCompletedTarget) needed = 0;
            
            let baseNeeded = isTarget ? (isMergedSlot ? (baseMap.get(id)||0) : (activeUnits.get(id)||1)) :
                             isCompletedTarget ? (completedTargets.get(id)||1) :
                             (baseMap.get(id)||0);

            if (!baseNeeded && !isTarget && !isCompletedTarget) return null;

            const rCon = slotEl.querySelector(`#d-reason-${id}`);
            if (rCon) {
                let rMap = reasonMap.get(id);
                if (rMap && rMap.size > 0 && needed > 0) {
                    let allEntries = getReasonDisplayEntries(id, rMap);
                    if (isTarget && !isAutoCost && !isMergedSlot) allEntries = allEntries.filter(([, i]) => i.depth === 0);
                    if (_currentHighlight) {
                        const filtered = allEntries.filter(([, i]) =>
                            i.parentUid === targetHighlight ||
                            (highlightDeps && highlightDeps.has(i.parentUid)) ||
                            i.depth === 0
                        );
                        if (filtered.length > 0) allEntries = filtered;
                    }
                    if (allEntries.length > 0) {
                        let sorted = allEntries.sort((a,b)=>(a[1].depth||0)-(b[1].depth||0) || (a[1]._reasonOrder||0)-(b[1]._reasonOrder||0));
                        rCon.style.display = 'flex';
                        rCon.style.justifyContent = 'flex-start';
                        rCon.innerHTML = sorted.map(([rId,i]) => {
                            let qtyText = '';
                            if (i.depth !== 0 && i.displayQty > 0) {
                                qtyText = ` <span class="d-reason-qty">· ${i.displayQty}개</span>`;
                            }
                            return `<span class="d-reason-tag ${i.depth===0?'tag-target':i.depth===1?'tag-mat':''}" data-action="toggleHighlight" data-uid="${rId.replace(/^(TARGET_|MAT_|TOOL_|AUTO_)/,'')}">${i.text}${qtyText}</span>`;
                        }).join('');
                    } else {
                        rCon.style.display = 'none';
                        rCon.innerHTML = '';
                    }
                } else { rCon.style.display='none'; rCon.innerHTML=''; }
            }

            const cEl = slotEl.querySelector(`#d-cond-${id}`);
            if (cEl) {
                let rMap = reasonMap.get(id);
                let condMap = new Map();

                if (rMap) {
                    getReasonDisplayEntries(id, rMap).forEach(([, info]) => {
                        if (!info.cond || info.displayQty <= 0) return;
                        if (_currentHighlight) {
                            const pUid = info.parentUid;
                            if (pUid !== targetHighlight && (!highlightDeps || !highlightDeps.has(pUid))) return;
                        }
                        let cleanCond = info.cond.replace(/,/g, ' ').trim();
                        if (!cleanCond) return;
                        condMap.set(cleanCond, (condMap.get(cleanCond) || 0) + info.displayQty);
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
            const isCompleted = needed === 0;
            slotEl.classList.toggle('has-target', !isCompleted);
            slotEl.classList.toggle('is-completed', isCompleted);

            if (cWrap) {
                if (!isCompleted) {
                    const tenDisabled = needed >= 10 ? '' : ' disabled';
                    cWrap.innerHTML = `<div class="craft-wrap-left"><span class="req-text">${needed}</span><span class="req-label">개</span></div><div class="craft-wrap-right"><button type="button" class="pc-btn" data-action="addComplete" data-uid="${id}" data-batch="1">1개</button><button type="button" class="pc-btn" data-action="addComplete" data-uid="${id}" data-batch="10"${tenDisabled}>10개</button><button type="button" class="btn-complete" data-action="completeUnit" data-uid="${id}">완료</button></div>`;
                } else cWrap.innerHTML = `<div class="craft-wrap-left"><span class="req-text">0</span><span class="req-label">개</span></div><div class="craft-wrap-right"><span class="complete-done-label">완료됨</span></div>`;
            }

            let tGrid = null;

            let uGrade = unitMap.get(id)?.grade;
            let isHiddenGroup = getGradeIndex(uGrade) >= getGradeIndex(SYSTEM_CONFIG.policy.hiddenGroupMinGrade || "히든");
            let depthInTree = exactDepths.has(id) ? exactDepths.get(id) : 99;
            
            let nativeLevel = isHiddenGroup ? (depthInTree <= 2 ? 3 : 2) : 1;
            _unitNativeLevels.set(id, nativeLevel);
            
            let upgradedGrid = null;
            
            if (isCompletedTarget) upgradedGrid = grids.target;
            else if (isMergedSlot) upgradedGrid = grids.special;
            else if (isTarget) upgradedGrid = grids.target;
            else if (directMaterials.has(id)) upgradedGrid = grids.special;
            else {
                const rVals = reasonMap.get(id);
                if (rVals) {
                    for (const i of rVals.values()) {
                        if (i.depth === 1) { upgradedGrid = grids.special; break; }
                    }
                }
            }
            
            let nativeGrid = null;
            if (isHiddenGroup) nativeGrid = grids.upperHidden;
            else if (BASIC_VISIBLE_GRADES.has(uGrade)) nativeGrid = grids.basicHidden;
            tGrid = upgradedGrid || nativeGrid;
            if (!tGrid) return null;

            const gridId = tGrid?.id || '';
            _unitRestoreLevels.set(id, restoreLevelsByGridId[gridId] || 0);
            const keepCompletedVisible = excludeGridIds.includes(gridId);
            const hideCompletedMaterial = isCompleted && !keepCompletedVisible;
            const hideT = hideCompletedMaterial || (_hideCompleted && isCompleted && !keepCompletedVisible);
            if (tGrid) {
                if (!hideT) {
                    slotEl.classList.add('is-visible');
                } else {
                    slotEl.classList.remove('is-visible');
                }
                slotEl.style.display = hideT ? 'none' : 'flex';
                tGrid.appendChild(slotEl);
            }

            
            return tGrid;
        };

        Array.from(activeUnits.keys()).map(uid => unitMap.get(uid)).filter(Boolean).sort((a, b) => getGradeIndex(b.grade) - getGradeIndex(a.grade) || (SYSTEM_CONFIG.sorting.order[b.name]||0) - (SYSTEM_CONFIG.sorting.order[a.name]||0) || a.name.localeCompare(b.name)).forEach(u => processSlot(u.id));
        Array.from(completedTargets.keys()).map(uid => unitMap.get(uid)).filter(Boolean).sort((a, b) => getGradeIndex(b.grade) - getGradeIndex(a.grade) || a.name.localeCompare(b.name)).forEach(u => processSlot(u.id));

        Array.from(visibleMaterialIds)
            .filter(uid => !AUTO_COST_SLOT_SET.has(uid) && !activeUnits.has(uid) && !completedTargets.has(uid))
            .map(uid => unitMap.get(uid))
            .filter(Boolean)
            .sort((a, b) => getGradeIndex(b.grade) - getGradeIndex(a.grade) || (SYSTEM_CONFIG.sorting.order[b.name]||0) - (SYSTEM_CONFIG.sorting.order[a.name]||0) || a.name.localeCompare(b.name))
            .forEach(u => processSlot(u.id));

        [grids.target, grids.special, grids.upperHidden, grids.basicHidden].forEach(grid => {
            if (!grid) return;
            const children = Array.from(grid.children);
            children.sort((a, b) => {
                const uidA = a.dataset.uid || a.id.replace('d-slot-wrap-','');
                const uidB = b.dataset.uid || b.id.replace('d-slot-wrap-','');
                const uA = unitMap.get(uidA);
                const uB = unitMap.get(uidB);
                if (grid === grids.upperHidden) {
                    const levelDiff = (_unitNativeLevels.get(uidB) || 1) - (_unitNativeLevels.get(uidA) || 1);
                    if (levelDiff !== 0) return levelDiff;
                }
                return getGradeIndex(uB?.grade) - getGradeIndex(uA?.grade) ||
                       (SYSTEM_CONFIG.sorting.order[uB?.name]||0) - (SYSTEM_CONFIG.sorting.order[uA?.name]||0) ||
                       (uA?.name || uidA).localeCompare(uB?.name || uidB);
            });
            children.forEach(el => grid.appendChild(el));
        });

        // 07-7. 그룹 페이지·표시 상태 갱신
        Object.values(grids).forEach(g => wrapDeductGridPages(g, 9));

        Object.values(grids).forEach(g => {
            if (!g) return;
            const grp = g.closest('.deduct-group'), icon = grp?.querySelector('.grp-toggle-icon');
            if (!grp) return;
            
            grp.style.display = 'block';
            
            const slots = Array.from(g.querySelectorAll('.deduct-slot'));
            const visibleSlots = slots.filter(el => el.style.display !== 'none');

            if (visibleSlots.length === 0 && grp.dataset.alwaysShow !== 'true') {
                g.style.display = 'none'; grp.classList.add('collapsed'); if (icon) icon.style.transform = 'rotate(-90deg)';
            }
            else if (visibleSlots.length > 0 && grp.dataset.alwaysOpen === 'true') {
                grp.classList.remove('collapsed'); g.style.display = 'grid'; if (icon) icon.style.transform = 'rotate(0deg)';
            }

            const badge = getEl(`grp-count-${g.id}`);
            if (!badge) return;
            const countBase = excludeGridIds.includes(g.id) ? slots : visibleSlots;
            const total = countBase.length;
            const done = countBase.filter(el => el.classList.contains('is-completed')).length;
            badge.textContent = total > 0 ? `${done} / ${total}` : '';
        });

        document.querySelectorAll('.deduct-slot').forEach(el => {
            const cleanId = el.id.replace('d-slot-wrap-', '');
            el.classList.toggle('highlighted-tree', !!_currentHighlight && highlightDeps?.has(cleanId));
        });
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


    // ── 08. 도감·탭·즐겨찾기·프리셋 ───────────────────────────────────────
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
            const catItems = Array.from(unitMap.values()).filter(u => u.category === currentTab.key && getGradeIndex(u.grade) >= minGradeIdx && !isRestrictedUnit(u.id));
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

    function getUnitCodexEssenceText(item) {
        if (!item?.id) return '';
        const counts = getEssenceCount(new Map([[item.id, 1]]));
        const hybrid = Math.max(0, counts['혼종'] || 0);
        const parts = [
            ['coral', '코랄', Math.max(0, (counts['코랄'] || 0) + hybrid)],
            ['aiur', '아이어', Math.max(0, (counts['아이어'] || 0) + hybrid)],
            ['zerus', '제루스', Math.max(0, (counts['제루스'] || 0) + hybrid)]
        ].filter(([, , value]) => value > 0);
        return parts.map(([id, name, value]) => `<span class="uc-essence-chip uc-essence-${id}"><span class="uc-essence-label">${name}</span><span class="uc-essence-value">${value}</span></span>`).join('');
    }

    function buildCard(item, idx, prefix, showRecipe) {
        const isRestricted = isRestrictedUnit(item.id), isOT = isOneTime(item), isFav = _favorites.has(item.id);
        const isPrimaryUnit = CLEAN_PRIMARY_UNIT_IDS.has(item.id);
        const essenceText = getUnitCodexEssenceText(item);
        return `<div id="card-${prefix}${item.id}" class="unit-card${isRestricted ? ' is-excluded' : ''}${isFav ? ' is-fav-card' : ''}${showRecipe ? '' : ' no-recipe'}" data-grade="${item.grade}" style="${idx >= 0 ? `animation-delay:${idx*0.02}s;` : ''}${isRestricted ? 'pointer-events:auto;cursor:not-allowed;' : ''}" data-action="toggleUnit" data-uid="${item.id}">` +
            `<div class="uc-card-inner">` +
            `${starBtnHtml(item.id)}` +
            `<div class="uc-head${showRecipe ? '' : ' uc-head-slim'}">` +
            `<div class="uc-meta-row"><span class="gtag grade-${item.grade}">${item.grade}</span>${isPrimaryUnit ? '<span class="badge-primary-unit">주력</span>' : ''}</div>` +
            `<div class="uc-name-row" style="color:${SYSTEM_CONFIG.grades.colors[item.grade]};">${item.name}</div>` +
            `${essenceText ? `<div class="uc-essence-row">${essenceText}</div>` : ''}` +
            `${isRestricted ? `<span class="badge-excluded" data-action="showExcludedTooltip" data-uid="${item.id}">선택제한</span>` : ''}` +
            `</div>` +
            `${showRecipe ? `<div class="uc-recipe-area">${formatRecipe(item, 1, false)}</div>` : ''}` +
            `${showRecipe && CLEAN_UNIT_CONDITIONS[item.id] ? `<div class="tsc-wrap" style="margin:4px 0 2px;"><div class="tsc-item">${CLEAN_UNIT_CONDITIONS[item.id]}</div></div>` : ''}` +
            `${buildCardControl(item, prefix, isRestricted, isOT)}` +
            `</div></div>`;
    }

    function buildUnitCard(item, idx) { return buildCard(item, idx, '', true); }

    function buildFavCard(item, idx, categoryKey) { return buildCard(item, idx, `fav-${categoryKey}-`, true); }

    function buildPagerPages(htmlItems, pageSize, pageClass) {
        if (!Array.isArray(htmlItems) || htmlItems.length === 0) return '';
        const size = Math.max(1, pageSize || htmlItems.length);
        let html = '';
        for (let i = 0; i < htmlItems.length; i += size) {
            html += `<div class="${pageClass}">${htmlItems.slice(i, i + size).join('')}</div>`;
        }
        return html;
    }

    function getCodexSort(a, b) {
        return (SYSTEM_CONFIG.sorting.order[b.name] || 0) - (SYSTEM_CONFIG.sorting.order[a.name] || 0) ||
            (isOneTime(a) ? -1 : isOneTime(b) ? 1 : 0) ||
            getGradeIndex(b.grade) - getGradeIndex(a.grade) ||
            calculateTotalCostScore(b) - calculateTotalCostScore(a) ||
            a.name.localeCompare(b.name);
    }

    function getCodexVisibleItems() {
        const minGradeIdx = getGradeIndex(SYSTEM_CONFIG.search.minGradeForSearch || "레전드");
        return Array.from(unitMap.values()).filter(u => getGradeIndex(u.grade) >= minGradeIdx);
    }

    function getFavoriteItems() {
        return getCodexVisibleItems().filter(u => _favorites.has(u.id)).sort(getCodexSort);
    }

    function buildFavoriteSection(categoryKey) {
        const favItems = getFavoriteItems();
        if (favItems.length > 0) {
            return `<div class="codex-fav-section">` +
                `<div class="codex-fav-header"><span class="codex-fav-title">⭐ 즐겨찾기</span></div>` +
                `<div class="codex-fav-grid">${buildPagerPages(favItems.map((item, idx) => buildFavCard(item, idx, categoryKey)), 3, 'codex-page codex-fav-page')}</div>` +
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
                getGradeIndex(u.grade) >= minGradeIdx &&
                u.category === cat.key &&
                !favSet.has(u.id)
            ).sort(getCodexSort);
            const bodyHtml = !items.length
                ? `<div class="codex-empty-msg">즐겨찾기를 제외하고 표시할 유닛이 없습니다.</div>`
                : buildPagerPages(items.map((item, idx) => buildUnitCard(item, idx)), 9, 'codex-page codex-category-page');
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
        if (!unitMap.has(id)) return;
        if (_favorites.has(id)) _favorites.delete(id); else _favorites.add(id);
        saveFavorites();
        triggerHaptic();
        _isTabContentInitialized = false;
        initAllTabContents();
        renderCurrentTabContent();
        updateTabsUI();
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

    function toggleUnitSelection(id, forceQty) {
        if (!unitMap.has(id) || isRestrictedUnit(id)) return;
        if (activeUnits.has(id)) activeUnits.delete(id);
        else setActiveUnitQty(id, forceQty || pausedUnits.get(id) || 1);
        debouncedUpdateAllPanels();
    }

    function setUnitQty(id, val) {
        if (!unitMap.has(id) || isRestrictedUnit(id) || isOneTime(unitMap.get(id))) return;
        if (setActiveUnitQty(id, val)) debouncedUpdateAllPanels();
    }

    function toggleSelectAllTab() {
        const currentTab = SYSTEM_CONFIG.tabs[_activeTabIdx]; if (!currentTab) return;
        const minGradeIdx = getGradeIndex(SYSTEM_CONFIG.search.minGradeForSearch || "레전드");
        const catItems = Array.from(unitMap.values()).filter(u => u.category === currentTab.key && getGradeIndex(u.grade) >= minGradeIdx && !isRestrictedUnit(u.id));
        if (!catItems.length) return;
        if (catItems.every(item => activeUnits.has(item.id))) catItems.forEach(item => activeUnits.delete(item.id));
        else catItems.forEach(item => !activeUnits.has(item.id) && setActiveUnitQty(item.id, pausedUnits.get(item.id) || 1));
        triggerHaptic(); debouncedUpdateAllPanels();
    }

    function selectTab(idx) {
        hideRecipeTooltip();
        _activeTabIdx = Math.max(0, Math.min(parseInt(idx, 10) || 0, SYSTEM_CONFIG.tabs.length - 1));
        updateTabsUI();
        renderCurrentTabContent();
    }


    // ── 09. 장바구니 ──────────────────────────────────────────────────────
    function pauseCartUnit(uid) {
        if (!activeUnits.has(uid) || !unitMap.has(uid)) return;
        const qty = activeUnits.get(uid) || 1;
        activeUnits.delete(uid);
        setPositiveMapValue(pausedUnits, uid, qty);
        triggerHaptic();
        debouncedUpdateAllPanels();
    }

    function discardActiveCartUnit(uid) {
        if (!activeUnits.has(uid)) return;
        const qty = activeUnits.get(uid) || 1;
        activeUnits.delete(uid);
        deleteCompletedRecipe(uid, qty);
        completedUnits.delete(uid);
        triggerHaptic();
        debouncedUpdateAllPanels();
    }

    function discardPausedCartUnit(uid) {
        if (!pausedUnits.has(uid)) return;
        pausedUnits.delete(uid);
        triggerHaptic();
        debouncedUpdateAllPanels();
    }

    function discardCompletedCartUnit(uid) {
        if (!completedTargets.has(uid)) return;
        const qty = completedTargets.get(uid) || 1;
        completedTargets.delete(uid);
        deleteCompletedRecipe(uid, qty);
        completedUnits.delete(uid);
        triggerHaptic();
        debouncedUpdateAllPanels();
    }

    function clearCartItems() {
        const hasCartItems = activeUnits.size > 0 || pausedUnits.size > 0 || completedTargets.size > 0 || completedUnits.size > 0;
        if (!hasCartItems && _cartTab === 'active') return;
        activeUnits.clear();
        pausedUnits.clear();
        completedTargets.clear();
        completedUnits.clear();
        _cartTab = 'active';
        toggleHighlight(null);
        triggerHaptic();
        debouncedUpdateAllPanels();
    }

    function restorePausedUnit(uid) {
        if (!pausedUnits.has(uid) || !unitMap.has(uid)) return;
        const qty = pausedUnits.get(uid) || 1;
        pausedUnits.delete(uid);
        setActiveUnitQty(uid, qty);
        triggerHaptic();
        debouncedUpdateAllPanels();
    }

    function restoreAllPausedUnits() {
        if (pausedUnits.size === 0) return;
        Array.from(pausedUnits.keys()).forEach(uid => restorePausedUnit(uid));
        debouncedUpdateAllPanels();
    }

    function restoreAllCompletedUnits() {
        if (completedTargets.size === 0) return;
        Array.from(completedTargets.keys()).forEach(uid => restoreUnit(uid));
        debouncedUpdateAllPanels();
    }

    function getCartTabDefinitions() {
        return [
            { key: 'active', label: '선택', count: activeUnits.size, countClass: '' },
            { key: 'paused', label: '보류', count: pausedUnits.size, countClass: 'paused' },
            { key: 'done', label: '완료', count: completedTargets.size, countClass: 'done' }
        ];
    }

    function renderCartPanel(tabBarId, listAreaId, prefix) {
        const cartListArea = getEl(listAreaId); if (!cartListArea) return;
        const tabBar = getEl(tabBarId);
        if (tabBar) {
            tabBar.innerHTML = getCartTabDefinitions().map(tab => `<button type="button" class="cart-tab-btn ${_cartTab === tab.key ? 'active' : ''}" data-action="switchCartTab" data-tab="${tab.key}">${tab.label} <span class="cart-tab-cnt ${tab.countClass}">${tab.count}</span></button>`).join('');
        }

        if (_cartTab === 'active') {
            if (activeUnits.size === 0) {
                const subText = pausedUnits.size > 0 ? '보류 탭에서 복구하면 다시 계산에 포함됩니다.' : '목표 유닛을 선택하면 여기에 표시됩니다.';
                cartListArea.innerHTML = `<div class="cart-empty-msg">선택된 유닛이 없습니다.<br><span class="cart-empty-sub">${subText}</span></div>`;
                return;
            }
            const items = getUnitsFromMap(activeUnits);
            const actionHtml = `<div class="cart-tab-action-row"><button type="button" class="cart-tab-action-btn cart-active-remove-all-btn" data-action="clearCartItems">전체 제거</button></div>`;
            cartListArea.innerHTML = actionHtml + items.map(item => {
                const qty = activeUnits.get(item.id) || 1;
                const qtyHtml = !isOneTime(item) ? `<div class="cart-item-stepper"><button type="button" data-action="smartChange" data-uid="${item.id}" data-delta="-1">-</button><span class="ci-val" id="${prefix}-val-${item.id}">${qty}</span><button type="button" data-action="smartChange" data-uid="${item.id}" data-delta="1">+</button></div>` : `<span class="ci-onetime active-qty">×${qty}</span>`;
                return `<div class="cart-item" id="${prefix}-${item.id}"><span class="cart-item-grade"><span class="gtag grade-${item.grade}">${item.grade}</span></span><span class="cart-item-name" style="color:${SYSTEM_CONFIG.grades.colors[item.grade]};">${item.name}</span>${qtyHtml}<button type="button" class="cart-item-pause-btn" data-action="pauseCartItem" data-uid="${item.id}">보류</button><button type="button" class="cart-item-del cart-item-remove" data-action="removeActiveUnit" data-uid="${item.id}">제거</button></div>`;
            }).join('');
            return;
        }

        if (_cartTab === 'paused') {
            const actionHtml = `<div class="cart-tab-action-row"><button type="button" class="cart-tab-action-btn cart-paused-restore-all-btn" data-action="restoreAllPausedUnits" ${pausedUnits.size === 0 ? 'disabled' : ''}>전체보류 복구</button></div>`;
            if (pausedUnits.size === 0) {
                cartListArea.innerHTML = `${actionHtml}<div class="cart-empty-msg">보류된 유닛이 없습니다.<br><span class="cart-empty-sub">선택 탭의 보류 버튼을 누르면 이곳으로 이동됩니다.</span></div>`;
                return;
            }
            cartListArea.innerHTML = actionHtml + getUnitsFromMap(pausedUnits).map(item => `<div class="cart-item cart-item-paused" id="${prefix}p-${item.id}"><span class="cart-item-grade"><span class="gtag grade-${item.grade}">${item.grade}</span></span><span class="cart-item-name paused-name" style="color:${SYSTEM_CONFIG.grades.colors[item.grade]};">${item.name}</span>${!isOneTime(item) ? `<span class="ci-onetime paused-qty">×${pausedUnits.get(item.id) || 1}</span>` : ''}<button type="button" class="cart-done-restore-hint cart-paused-restore-btn always-show" data-action="restorePausedUnit" data-uid="${item.id}">복구</button><button type="button" class="cart-item-del cart-item-remove" data-action="removePausedUnit" data-uid="${item.id}">제거</button></div>`).join('');
            return;
        }

        const actionHtml = `<div class="cart-tab-action-row"><button type="button" class="cart-tab-action-btn cart-done-restore-all-btn" data-action="restoreAllCompletedUnits" ${completedTargets.size === 0 ? 'disabled' : ''}>완료 복구</button></div>`;
        if (completedTargets.size === 0) {
            cartListArea.innerHTML = `${actionHtml}<div class="cart-empty-msg">완료된 유닛이 없습니다.<br><span class="cart-empty-sub">목표 완료 시 이곳으로 이동됩니다.</span></div>`;
            return;
        }
        cartListArea.innerHTML = actionHtml + getUnitsFromMap(completedTargets).map(item => `<div class="cart-item cart-item-done" id="${prefix}d-${item.id}"><span class="cart-item-grade"><span class="gtag grade-${item.grade}">${item.grade}</span></span><span class="cart-item-name done-name" style="color:${SYSTEM_CONFIG.grades.colors[item.grade]};">${item.name}</span><span class="ci-onetime done-qty">×${completedTargets.get(item.id) || 1}</span><button type="button" class="cart-done-restore-hint cart-restore-btn always-show" data-action="restoreUnit" data-uid="${item.id}">복구</button><button type="button" class="cart-item-del cart-item-remove" data-action="removeCompletedUnit" data-uid="${item.id}">제거</button></div>`).join('');
    }

    function updateCartUI() {
        renderCartPanel('cartTabBar', 'cartListArea', 'ci');
    }


    // ── 10. 화면·입력·툴팁·폰트 ───────────────────────────────────────────
    function setupInitialView() { switchLayout('codex'); }

    function switchLayout(mode) {
        hideRecipeTooltip();
        const layout = getEl('mainLayout'); if (!layout) return;
        _currentViewMode = mode; layout.classList.remove('view-codex', 'view-deduct');
        const btnCodex = getEl('btnViewCodex'), btnDeduct = getEl('btnViewDeduct');
        if (mode === 'deduct') {
            layout.classList.add('view-deduct');
            btnCodex?.classList.remove('active');
            btnDeduct?.classList.add('active');
            ensureDeductionBoardRendered(_lastCalcResult);
        }
        else { layout.classList.add('view-codex'); btnCodex?.classList.add('active'); btnDeduct?.classList.remove('active'); }
    }

    function startSmartChange(id, delta, event) {
        if (event) {
            if (event.type === 'touchstart' || event.type === 'pointerdown') {
                _lastInteractionTime = Date.now();
            } else if (event.type === 'mousedown' && Date.now() - _lastInteractionTime < APP_INTERNAL.mouseAfterTouchDelay) {
                if (event.cancelable) event.preventDefault();
                event.stopPropagation?.();
                return;
            }
        }
        stopSmartChange();
        triggerHaptic();
        _touchHoldCount = 0;
        const runSmartStep = () => {
            const multiplier = event?.shiftKey ? APP_INTERNAL.accelShiftMultiplier : Math.floor(++_touchHoldCount / APP_INTERNAL.accelStepUnit) + 1;
            const accelDelta = delta * multiplier;
            const current = activeUnits.get(id) || 0;
            if (current === 0 && accelDelta > 0) toggleUnitSelection(id, accelDelta);
            else setUnitQty(id, current + accelDelta);
        };
        const scheduleSmartRepeat = () => {
            triggerHaptic();
            runSmartStep();
            _currentAccelInterval = Math.max(APP_INTERNAL.accelMinInterval, _currentAccelInterval - APP_INTERNAL.accelDecreaseStep);
            repeatTimer = setTimeout(scheduleSmartRepeat, _currentAccelInterval);
        };
        runSmartStep();
        _currentAccelInterval = APP_INTERNAL.accelInterval;
        repeatDelayTimer = setTimeout(scheduleSmartRepeat, APP_INTERNAL.holdStartDelay);
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
                        <span style="color:var(--text-muted);font-size:0.75rem;margin-left:auto;">의 기본 재료</span>
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
            const { reqMap, baseMap, autoCostReq } = _lastCalcResult || calculateDeductedRequirements();
            if (AUTO_COST_SLOT_SET.has(id)) {
                multi = autoCostReq[id] || 0;
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


    // ── 11. 이벤트 바인딩 ─────────────────────────────────────────────────
    // 11-1. 반복 입력 종료
    ['pointerup','pointercancel','touchend','touchcancel','mouseup','contextmenu'].forEach(evt => { document.addEventListener(evt, stopSmartChange); document.addEventListener(evt, stopFontHold); });
    
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopSmartChange();
            stopFontHold();
        }
    });

    // 11-2. 클릭 이벤트 위임
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
                if (preset && !(preset.oneTime && _presetUsed.get(idx))) { processCommand(preset.command, true, preset.preventStack === true); if (preset.oneTime) _presetUsed.set(idx, true); updatePresetBtns(); }
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
            case 'pauseCartItem': e.stopPropagation(); if (uid) pauseCartUnit(uid); break;
            case 'removeActiveUnit': e.stopPropagation(); if (uid) discardActiveCartUnit(uid); break;
            case 'removePausedUnit': e.stopPropagation(); if (uid) discardPausedCartUnit(uid); break;
            case 'removeCompletedUnit': e.stopPropagation(); if (uid) discardCompletedCartUnit(uid); break;
            case 'restoreAllPausedUnits': e.stopPropagation(); restoreAllPausedUnits(); break;
            case 'restoreAllCompletedUnits': e.stopPropagation(); restoreAllCompletedUnits(); break;
            case 'clearCartItems': e.stopPropagation(); clearCartItems(); break;
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
            case 'switchCartTab': setCartTab(actionEl.dataset.tab || 'active'); updateCartUI(); break;
            case 'restoreUnit': e.stopPropagation(); restoreUnit(uid); break;
            case 'restorePausedUnit': e.stopPropagation(); restorePausedUnit(uid); break;
            case 'resetGroup': e.stopPropagation(); resetGroupCompleted(parseInt(actionEl.dataset.level, 10)); break;
            case 'showExcludedTooltip': e.stopPropagation(); showExcludedTooltip(uid, e); break;
            case 'showRecipeTooltip': e.stopPropagation(); showRecipeTooltip(uid, e, actionEl.dataset.isDeduction === 'true'); break;
        }
    });

    // 11-3. 포인터 입력
    document.addEventListener('pointerdown', e => {
        const actionEl = e.target.closest('[data-action="smartChange"]');
        if (actionEl) { e.stopPropagation(); startSmartChange(actionEl.dataset.uid, parseInt(actionEl.dataset.delta, 10), e); return; }
        if (e.target.closest('[data-action="increaseFont"]')) { e.preventDefault(); startFontHold(APP_INTERNAL.fontScaleStep); return; }
        if (e.target.closest('[data-action="decreaseFont"]')) { e.preventDefault(); startFontHold(-(APP_INTERNAL.fontScaleStep)); return; }
    });
    // 11-4. 키보드 접근성·단축 처리
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
    window.addEventListener('orientationchange', () => { hideRecipeTooltip(); placeChecklistControls(); });
    window.addEventListener('resize', () => { hideRecipeTooltip(); placeChecklistControls(); });
    // ── 12. 앱 초기화 ──────────────────────────────────────────────────────
    let _isSwiping = false;

    function startNexusApp(){
        try {
            document.documentElement.lang = 'ko';
            if (typeof UNIT_DATABASE === 'undefined' || !Array.isArray(UNIT_DATABASE)) { markNexusAppError("N1003", new Error("UNIT_DATABASE load failed")); return; }
            UNIT_DATABASE.forEach(kArr => unitMap.set(clean(kArr[0]), { id: clean(kArr[0]), name: kArr[0], grade: kArr[1] || SYSTEM_CONFIG.grades.order[0], category: kArr[2] || SYSTEM_CONFIG.tabs[0].key, recipe: kArr[3], cost: kArr[4] }));
            pruneFavorites();

            initializeCacheEngine(); loadNexusState(); loadFontScale(); renderDashboardAtoms(); renderTabs(); selectTab(0); debouncedUpdateAllPanels(); setupSearchEngine(); setupInitialView(); renderPresetButtons();
            updateHideCompletedBtn();
            requestAnimationFrame(() => {
                debouncedUpdateAllPanels();
            });
            const sArea = getEl('tabContent');
            if (sArea) {
                let sX = 0, sY = 0, sPager = null;
                const getSwipePager = target => {
                    const favPager = target?.closest?.('.codex-fav-grid');
                    if (favPager) return { el: favPager, type: 'favorite' };
                    const categoryPager = target?.closest?.('.codex-category-grid');
                    return categoryPager ? { el: categoryPager, type: 'category' } : null;
                };
                const canPagerMove = (pagerState, dX) => {
                    const pager = pagerState?.el;
                    if (!pager) return false;
                    const max = Math.max(0, pager.scrollWidth - pager.clientWidth);
                    if (max <= 2) return false;
                    const start = Math.max(0, Math.min(pagerState.scrollLeft, max));
                    if (dX < 0) return start < max - 2;
                    if (dX > 0) return start > 2;
                    return false;
                };
                sArea.addEventListener('touchstart', e => {
                    const touch = e.changedTouches[0];
                    sX = touch.screenX; sY = touch.screenY;
                    const pager = getSwipePager(e.target);
                    sPager = pager ? { ...pager, scrollLeft: pager.el.scrollLeft } : null;
                }, { passive: true });
                sArea.addEventListener('touchend', e => {
                    if (_isSwiping) return;
                    let dX = e.changedTouches[0].screenX - sX, dY = e.changedTouches[0].screenY - sY;
                    if (Math.abs(dX) > 70 && Math.abs(dY) < 50) {
                        if (sPager?.type === 'favorite') { sPager = null; return; }
                        if (sPager?.type === 'category' && canPagerMove(sPager, dX)) { sPager = null; return; }
                        _isSwiping = true;
                        if (dX > 0 && _activeTabIdx > 0) selectTab(_activeTabIdx - 1);
                        else if (dX < 0 && _activeTabIdx < SYSTEM_CONFIG.tabs.length - 1) selectTab(_activeTabIdx + 1);
                        if (_swipeTimer) clearTimeout(_swipeTimer);
                        _swipeTimer = setTimeout(() => _isSwiping = false, 300);
                    }
                    sPager = null;
                }, { passive: true });
            }
            // 체크리스트 카드 내부 스와이프는 페이지 이동을 우선한다.
            const dBoard = getEl('colRightPanel');
            if (dBoard) {
                let dX0 = 0, dY0 = 0, dPager = false;
                dBoard.addEventListener('touchstart', e => {
                    dX0 = e.changedTouches[0].screenX;
                    dY0 = e.changedTouches[0].screenY;
                    dPager = !!e.target?.closest?.('.deduct-grid');
                }, { passive: true });
                dBoard.addEventListener('touchend', e => {
                    const dx = e.changedTouches[0].screenX - dX0, dy = e.changedTouches[0].screenY - dY0;
                    if (Math.abs(dx) > 80 && Math.abs(dy) < 50) {
                        if (dPager) { dPager = false; return; }
                        if (dx > 0) switchLayout('codex'); else switchLayout('deduct');
                    }
                    dPager = false;
                }, { passive: true });
            }
            markNexusAppReady();
        } catch (err) {
            markNexusAppError("N1001", err);
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startNexusApp, { once: true });
    else startNexusApp();
})();
