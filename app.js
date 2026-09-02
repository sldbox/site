(() => {

    /* 설정 및 정책 병합 */
    const USER_CONFIG = window.NEXUS_USER_CONFIG || {};
    const APP_DEFAULT_CONFIG = {
        policy: {
            maxUnitCapacity: 16,
            oneTimeMinGrade: "슈퍼히든",
            hiddenGroupMinGrade: "히든",
            minGradeForHiddenboard: "레어",
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
            order: ["매직", "레어", "에픽", "유니크", "헬", "레전드", "히든", "고유히든", "슈퍼히든"],
            colors: {
                "매직": "var(--grade-magic)", "레어": "var(--grade-rare)", "에픽": "var(--grade-epic)", "유니크": "var(--grade-unique)",
                "헬": "var(--grade-hell)", "레전드": "var(--grade-legend)", "히든": "var(--grade-hidden)", "고유히든": "var(--grade-unique-hidden)", "슈퍼히든": "var(--grade-super)",
                "스킬사용": "#fff"
            }
        },
        tabs: [
            { key: "테바", name: "테바" }, { key: "테메", name: "테메" },
            { key: "토바", name: "토바" }, { key: "토메", name: "토메" },
            { key: "저그중립", name: "저그중립" }, { key: "혼종", name: "혼종" }
        ],
        essence: {
            mapping: { "테바": "코랄", "테메": "코랄", "토바": "아이어", "토메": "아이어", "저그중립": "제루스", "혼종": "혼종" }
        },
        sorting: { order: { "아몬": 100, "나루드": 97 } },
        groupDefs: [
            { id: 'group-target',       pid: 'grid-target',       title: '최종 목표', resetLevel: 5, isCol: false, alwaysShow: false, alwaysOpen: true,  resetLabel: '최종 복구' },
            { id: 'group-special',      pid: 'grid-special',      title: '직속 재료', resetLevel: 4, isCol: false, alwaysShow: false, alwaysOpen: true,  resetLabel: '직속 복구' },
            { id: 'group-upper-hidden', pid: 'grid-upper-hidden', title: '히든 재료', resetLevel: 3, isCol: true,  alwaysShow: false, alwaysOpen: false, resetLabel: '히든 복구' },
            { id: 'group-basic-hidden', pid: 'grid-basic-hidden', title: '기본 재료', resetLevel: 2, isCol: true,  alwaysShow: false, alwaysOpen: false, resetLabel: '기본 복구' }
        ],
        costboardAtoms: [
            "전쟁광", "스파르타중대", "암흑광전사", "암흑파수기", "원시바퀴",
            "저격수", "코브라", "암흑고위기사", "암흑추적자", "변종가시지옥",
            "망치경호대", "공성파괴단", "암흑집정관", "암흑불멸자", "원시히드라",
            "땅거미지뢰", "자동포탑", "우르사돈암", "우르사돈수", "갓오타", "메시브"
        ],
        costboardSlots: [
            { atoms: ["전쟁광"] },
            { atoms: ["스파르타중대"] },
            { atoms: ["암흑광전사"] },
            { atoms: ["암흑파수기"] },
            { atoms: ["원시바퀴"] },
            { atoms: ["저격수"] },
            { atoms: ["코브라"] },
            { atoms: ["암흑고위기사"] },
            { atoms: ["암흑추적자"] },
            { atoms: ["변종가시지옥"] },
            { atoms: ["망치경호대"] },
            { atoms: ["공성파괴단"] },
            { atoms: ["암흑집정관"] },
            { atoms: ["암흑불멸자"] },
            { atoms: ["원시히드라"] },
            { atoms: ["땅거미지뢰"] },
            { atoms: ["자동포탑"] },
            { atoms: ["우르사돈암"] },
            { atoms: ["우르사돈수"] },
            { atoms: ["갓오타", "메시브"] }
        ],
        storageKeys: window.NEXUS_STORAGE_KEYS || {
            saveData: "nexusSaveData",
            favorites: "nexusFavorites",
            fontScale: "nexusFontScaleV2"
        },
        unitboard: {
            visibleExceptionIds: []
        },
        search: {
            minGradeForSearch: "레전드",
            restrictedIds: []
        }
    };
    const SYSTEM_CONFIG = {
        ...APP_DEFAULT_CONFIG,
        tools: USER_CONFIG.tools || {},
        primaryUnitGroups: USER_CONFIG.primaryUnitGroups || {},
        unitBehaviors: USER_CONFIG.unitBehaviors || {},
        oneTimeIds: USER_CONFIG.oneTimeIds || [],
        specialConditions: USER_CONFIG.specialConditions || {},
        unitConditions: USER_CONFIG.unitConditions || {},
        presets: USER_CONFIG.presets || [],
        storageKeys: {
            ...APP_DEFAULT_CONFIG.storageKeys,
            ...(USER_CONFIG.storageKeys || {})
        },
        unitboard: {
            ...APP_DEFAULT_CONFIG.unitboard,
            ...(USER_CONFIG.unitboard || {})
        },
        search: {
            ...APP_DEFAULT_CONFIG.search,
            ...(USER_CONFIG.search || {})
        }
    };

    /* 정규화·검색·렌더링 상수 */
    const IGNORE_PARSE_RECIPES = ["미발견", "없음", ""];
    const clean = (s) => s ? s.replace(/\s+/g, '').toLowerCase() : '';
    const ATOM_HASH = Object.fromEntries(SYSTEM_CONFIG.costboardAtoms.map(a => [clean(a), a]));
    const makeCleanSet = (list = []) => new Set(list.map(clean).filter(Boolean));
    const CLEAN_TOOLS_MAP = Object.fromEntries(Object.entries(SYSTEM_CONFIG.tools).map(([k, v]) => [clean(k), v.map(clean)]));
    const CLEAN_RESTRICTED_IDS = makeCleanSet(SYSTEM_CONFIG.search.restrictedIds || []);
    const CLEAN_UNITBOARD_VISIBLE_EXCEPTION_IDS = makeCleanSet(SYSTEM_CONFIG.unitboard.visibleExceptionIds || []);
    const _behaviors = SYSTEM_CONFIG.unitBehaviors || {};
    const AUTO_COST_ENTRIES = Object.entries(_behaviors).filter(([, b]) => b.skillUseRender);
    const SPECIAL_RENDER_LIST = AUTO_COST_ENTRIES.map(([id, b]) => ({ id: clean(id), raw: id, batch: b.batch || 1 }));
    const AUTO_COST_SLOT_SET = new Set(AUTO_COST_ENTRIES.map(([id]) => clean(id)));
    const AUTO_COST_SLOT_RAWS = AUTO_COST_ENTRIES.map(([id]) => id);
    const AUTO_COST_RAW_MAP = Object.fromEntries(AUTO_COST_SLOT_RAWS.map(id => [clean(id), id]));
    const INVENBOARD_EXPANSION_ATOMS = [
        "죽음의머리", "검은망치", "광전사석상", "교란기", "라바사우르스",
        "악령", "ARES", "정화자사도", "선동자", "브루탈리스크",
        "짐레이너", "대천사", "제라툴", "거신", "케리건",
        "스투코프", "오딘", "혼종파멸자", "분노수호자", "혼종약탈자",
        "공허포격기"
    ];
    const INVENBOARD_EXPANSION_RAW_MAP = Object.fromEntries(INVENBOARD_EXPANSION_ATOMS.map(atom => [clean(atom), atom]));
    const INVENBOARD_EXPANSION_ATOM_ID_SET = new Set(INVENBOARD_EXPANSION_ATOMS.map(clean));
    const COSTBOARD_ATOM_ID_SET = new Set(SYSTEM_CONFIG.costboardAtoms.map(atom => clean(atom)));
    const INVENBOARD_SLOT_SET = new Set([...COSTBOARD_ATOM_ID_SET, ...AUTO_COST_SLOT_SET]);
    const ALL_INVENBOARD_SLOT_SET = new Set([...INVENBOARD_SLOT_SET, ...INVENBOARD_EXPANSION_ATOM_ID_SET]);
    const CLEAN_ONE_TIME_UNITS = new Set((SYSTEM_CONFIG.oneTimeIds || []).map(clean));
    const CLEAN_PRIMARY_UNIT_IDS = makeCleanSet(Object.values(SYSTEM_CONFIG.primaryUnitGroups || {}).flat());
    const CLEAN_PRESET_NOSTACK = new Set(Object.entries(_behaviors).filter(([, b]) => b.presetNoStack).map(([id]) => clean(id)));
    const CLEAN_PRESET_QTY_CAPS = Object.fromEntries(Object.entries(_behaviors)
        .map(([id, b]) => [clean(id), parseInt(b?.presetMaxQty, 10)])
        .filter(([, cap]) => Number.isFinite(cap) && cap > 0));
    const CLEAN_UNIT_QTY_CAPS = Object.fromEntries(Object.entries(_behaviors)
        .map(([id, b]) => [clean(id), parseInt(b?.maxQty, 10)])
        .filter(([, cap]) => Number.isFinite(cap) && cap > 0));
    const CLEAN_INVENBOARD_INSTANT_COMPLETE = new Set(Object.entries(_behaviors).filter(([, b]) => b.invenboardInstantComplete).map(([id]) => clean(id)));
    const BASIC_HIDDENBOARD_GRADES = new Set(["레어", "에픽", "유니크", "헬", "레전드"]);
    const isBasicHiddenboardGrade = (grade) => BASIC_HIDDENBOARD_GRADES.has(grade);
    const MATERIAL_REASON_LABEL = '재료';
    const TOOL_REASON_LABEL_HTML = '<span class="tool-badge">[도구]</span>';
    const REASON_GRADE_ORDER = ["슈퍼히든", "고유히든", "히든", "레전드", "헬", "유니크", "에픽", "레어", "매직"];
    const REASON_GRADE_RANK = new Map(REASON_GRADE_ORDER.map((grade, index) => [grade, index]));
    const DEFAULT_REASON_TAG_CLASS = 'tag-reason-default';
    const getReasonGradeRank = (grade) => REASON_GRADE_RANK.get(grade) ?? REASON_GRADE_ORDER.length;
    const getReasonTagClassByGrade = (grade) => SYSTEM_CONFIG.grades.order.includes(grade) ? `tag-grade-${grade}` : DEFAULT_REASON_TAG_CLASS;
    const getHiddenboardReasonMeta = (parentUid) => {
        const parentUnit = unitMap.get(parentUid);
        const grade = parentUnit?.grade || '';
        const name = parentUnit?.name || parentUid || '';
        return { name, grade, gradeRank: getReasonGradeRank(grade), tagClass: getReasonTagClassByGrade(grade) };
    };
    const createHiddenboardReasonInfo = (parentUid, centerHtml, { cond = '', depth = 1, reqQty = 1 } = {}) => {
        const reasonMeta = getHiddenboardReasonMeta(parentUid);
        const center = centerHtml(reasonMeta.name);
        return {
            text: center,
            cond,
            depth,
            parentUid,
            reqQty,
            tagClass: reasonMeta.tagClass,
            reasonGrade: reasonMeta.grade,
            reasonGradeRank: reasonMeta.gradeRank,
            reasonCenterHtml: center
        };
    };
    const createMaterialReasonInfo = (parentUid, options = {}) => createHiddenboardReasonInfo(parentUid, name => `${escapeHtml(name)} ${MATERIAL_REASON_LABEL}`, options);
    const createToolReasonInfo = (parentUid, options = {}) => createHiddenboardReasonInfo(parentUid, name => `${escapeHtml(name)} ${TOOL_REASON_LABEL_HTML}`, options);
    const AUTO_COMPLETE_IDS = SPECIAL_RENDER_LIST.map(e => e.id);
    const CLEAN_SPECIAL_CONDITIONS = Object.fromEntries(Object.entries(SYSTEM_CONFIG.specialConditions).map(([k, v]) => [clean(k), v]));
    const CLEAN_UNIT_CONDITIONS = Object.fromEntries(Object.entries(SYSTEM_CONFIG.unitConditions || {}).map(([k, v]) => [clean(k), v]));
    const COSTBOARD_SLOT_DEFS = (Array.isArray(SYSTEM_CONFIG.costboardSlots) && SYSTEM_CONFIG.costboardSlots.length
        ? SYSTEM_CONFIG.costboardSlots
        : (SYSTEM_CONFIG.costboardAtoms || []).map(atom => ({ atoms: [atom] })))
        .map(slot => ({
            atoms: (Array.isArray(slot?.atoms) ? slot.atoms : [slot?.atom]).filter(Boolean)
        }))
        .filter(slot => slot.atoms.length > 0);
    const INVENBOARD_EXPANSION_SLOT_DEFS = [
        ...INVENBOARD_EXPANSION_ATOMS.slice(0, -1).map(atom => ({ atoms: [atom] })),
        { atoms: ["공허포격기"] },
        { atoms: [], empty: true },
        { atoms: [], empty: true },
        { atoms: [], empty: true },
        { atoms: [], empty: true }
    ];
    const GROUP_DEFS = SYSTEM_CONFIG.groupDefs;
    const titleToGridId = Object.fromEntries(GROUP_DEFS.map(g => [g.title, g.pid]));
    const unitMap = new Map(), activeUnits = new Map(), pausedUnits = new Map(), completedUnits = new Map(), depCache = new Map();
    const completedTargets = new Map(), _invenboardAutoCompletedUnits = new Map(), _invenboardManualInputs = new Map(), _unitNativeLevels = new Map(), _unitRestoreLevels = new Map();
    const _depVisiting = new Set();
    const GRADE_INDEX_MAP = new Map(SYSTEM_CONFIG.grades.order.map((grade, index) => [grade, index]));
    const _boardRequirementsCache = new Map(), _costboardTotalsCache = new Map(), _directInvenboardAtomNeedCache = new Map(), _unitEssencePartsCache = new Map();
    const _hiddenboardSlotElsByUid = new Map(), _unitCardElsByUid = new Map(), _favoriteBtnElsByUid = new Map(), _dirtyUnitCardIds = new Set();
    let _unitboardDomIndexed = false, _lastUnitboardQtyByUid = new Map();
    const PRESET_COLOR_MAP = {
        '빨강':'red', '주황':'orange', '노랑':'yellow', '연두':'lime',
        '초록':'green', '하늘':'sky', '파랑':'blue', '남색':'navy',
        '보라':'purple', '분홍':'pink', '청록':'cyan',
        '흰색':'white', '검정':'black', '회색':'gray', '금색':'gold'
    };
    const isBrightColor = (name) => ['노랑','연두','하늘','흰색','금색'].includes(name);
    const FAVORITES_KEY = SYSTEM_CONFIG.storageKeys?.favorites || 'nexusFavorites';
    /* 내부 안전장치·조작 정책 */
    const APP_INTERNAL = {
        maxLoopQueue: 1000,
        maxAutoCompletePasses: 64,
        hapticDuration: 15,
        searchFailFeedbackDelay: 1500,
        completeLockDelay: 300,
        appVersionDisplayMs: 1500,
        titleMainDisplayMs: 5000,
        titleCreatorDisplayMs: 3000,
        titleTransitionMs: 180,
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

    /* 부팅 상태 전달 */
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

    /* 선택·완료·화면 상태 */
    const _favorites = new Set((() => { try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); } catch(e) { return []; } })());
    let _activeTabIdx = 0, _currentViewMode = 'unitboard', _currentHighlight = null, _hideCompleted = false;
    let _invenboardInputMode = 'auto', _isInvenboardSlotsExpanded = false;
    let _cartTab = 'active', _isTabContentInitialized = false, _isHiddenboardRendered = false, _isInvenboardRendered = false;
    let repeatTimer = null, repeatDelayTimer = null, _lastInteractionTime = 0, _currentAccelInterval = APP_INTERNAL.accelInterval, _touchHoldCount = 0;
    let updateTimer = null, _completeLock = new Set(), _presetUsed = new Map(), _restoreAllCooldown = false;
    let _restoreAllPendingTimer = null;
    let _lastCalcResult = null;
    let _fontRepeatTimer = null, _fontRepeatDelayTimer = null, _swipeTimer = null;
    let _titleRotationTimer = null, _titleTransitionTimer = null, _titleVersionTimer = null;
    let _isSwiping = false;
    let _presetTab = '일반 프리셋';
    let _fontScale = 1.0;

    /* DOM·등급·검색 공통 유틸 */
    const getEl = (id) => document.getElementById(id);
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
    const isInsideRecipeTooltip = (event) => event?.target?.closest?.('#recipeTooltip') !== null;

    const triggerHaptic = () => navigator.vibrate?.(APP_INTERNAL.hapticDuration);
    const virtualUnitIds = new Set(AUTO_COMPLETE_IDS);
    const isToolRequirement = (parent, child) => CLEAN_TOOLS_MAP[parent]?.includes(child);
    const getToolNeed = (parent) => CLEAN_TOOLS_MAP[parent] || [];
    const isRestrictedUnit = (id) => CLEAN_RESTRICTED_IDS.has(id);
    const getGradeIndex = (grade) => GRADE_INDEX_MAP.has(grade) ? GRADE_INDEX_MAP.get(grade) : -99;
    const getUnitboardMinGradeIndex = () => getGradeIndex(SYSTEM_CONFIG.search.minGradeForSearch || "레전드");
    const isUnitboardVisibleException = (id) => CLEAN_UNITBOARD_VISIBLE_EXCEPTION_IDS.has(clean(id));
    const isUnitboardVisibleUnit = (u) => !!u && (getGradeIndex(u.grade) >= getUnitboardMinGradeIndex() || isUnitboardVisibleException(u.id));
    const isSelectableUnitboardUnit = (u) => isUnitboardVisibleUnit(u) && !isRestrictedUnit(u.id);
    const isOneTime = (u) => u && (CLEAN_ONE_TIME_UNITS.has(u.id) || getGradeIndex(u.grade) >= getGradeIndex(SYSTEM_CONFIG.policy.oneTimeMinGrade || "슈퍼히든"));
    const isInvenboardInstantCompleteUnit = (uid) => CLEAN_INVENBOARD_INSTANT_COMPLETE.has(clean(uid));
    const getUnitId = (rawName) => clean(rawName);
    const getCostboardAtomRawName = (uid) => ATOM_HASH[uid] || INVENBOARD_EXPANSION_RAW_MAP[uid] || AUTO_COST_RAW_MAP[uid] || uid;
    const getCostboardSlotToneClass = (atoms) => atoms.some(atom => AUTO_COST_SLOT_SET.has(clean(atom))) ? 'is-skill-slot' : 'is-magic-slot';
    const getInvenboardAtomGrade = (atom) => {
        const id = clean(atom);
        return AUTO_COST_SLOT_SET.has(id) ? '스킬사용' : (unitMap.get(id)?.grade || '');
    };
    const renderInvenboardGradeTag = (atom) => {
        const grade = getInvenboardAtomGrade(atom);
        return grade ? `<span class="invenboard-grade gtag grade-${grade}">${escapeHtml(grade)}</span>` : '';
    };
    const getInvenboardAtomNameStyle = (atom) => {
        const grade = getInvenboardAtomGrade(atom);
        const color = SYSTEM_CONFIG.grades.colors[grade];
        return color ? ` style="color:${color};"` : '';
    };
    const getUnitNameStyle = (unit) => {
        const color = SYSTEM_CONFIG.grades.colors[unit?.grade];
        return color ? `style="color:${color};"` : '';
    };
    const calculateTotalCostScore = (u) => u?.parsedCost?.reduce((sum, pc) => sum + (pc.qty || 0), 0) || 0;
    const getNexusVersion = () => window.APP_VERSION || window.NEXUS_BUILD_VERSION || '';
    const NEXUS_TITLE_TEXT = Object.freeze({
        main: { value: '개복디 넥서스' },
        creator: { label: '제작자', value: '회장 | 3-S2-1-2461127' }
    });
    const getNexusTitleViewMeta = mode => {
        if (mode === 'version') {
            return { label: '버전정보', value: getNexusVersion() };
        }
        return NEXUS_TITLE_TEXT[mode] || NEXUS_TITLE_TEXT.main;
    };
    const buildNexusTitleHtml = (mode, { label, value }) => {
        if (mode === 'main') {
            return `<span class="gh-title-mainline">${escapeHtml(value)}</span>`;
        }
        return `<span class="gh-title-stack">
            <span class="gh-title-label">${escapeHtml(label)}</span>
            <span class="gh-title-main">${escapeHtml(value)}</span>
        </span>`;
    };
    const clearNexusTitleRotationTimers = () => {
        clearTimeout(_titleRotationTimer);
        clearTimeout(_titleTransitionTimer);
        _titleRotationTimer = null;
        _titleTransitionTimer = null;
    };
    const renderNexusTitleView = mode => {
        const title = getEl('ghTitleText');
        if (!title) return;
        const meta = getNexusTitleViewMeta(mode);
        const text = meta.label ? `${meta.label} ${meta.value}` : meta.value;
        title.dataset.titleView = mode;
        title.classList.toggle('is-creator-view', mode === 'creator');
        title.classList.toggle('is-version-view', mode === 'version');
        title.innerHTML = buildNexusTitleHtml(mode, meta);
        title.setAttribute('aria-label', `${text} · 앱 버전 보기`);
    };
    const scheduleNexusTitleRotation = mode => {
        const delay = mode === 'creator' ? APP_INTERNAL.titleCreatorDisplayMs : APP_INTERNAL.titleMainDisplayMs;
        _titleRotationTimer = setTimeout(() => {
            const title = getEl('ghTitleText');
            if (!title) return;
            title.classList.add('is-transitioning');
            _titleTransitionTimer = setTimeout(() => {
                const nextMode = mode === 'creator' ? 'main' : 'creator';
                renderNexusTitleView(nextMode);
                title.classList.remove('is-transitioning');
                scheduleNexusTitleRotation(nextMode);
            }, APP_INTERNAL.titleTransitionMs);
        }, delay);
    };
    const restartNexusTitleRotation = () => {
        const title = getEl('ghTitleText');
        if (!title) return;
        clearNexusTitleRotationTimers();
        title.classList.remove('is-transitioning');
        renderNexusTitleView('main');
        scheduleNexusTitleRotation('main');
    };
    const showNexusAppVersion = () => {
        const title = getEl('ghTitleText');
        const version = getNexusVersion();
        if (!title || !version) return;
        clearNexusTitleRotationTimers();
        title.classList.remove('is-transitioning');
        renderNexusTitleView('version');
        clearTimeout(_titleVersionTimer);
        _titleVersionTimer = setTimeout(() => {
            _titleVersionTimer = null;
            restartNexusTitleRotation();
        }, APP_INTERNAL.appVersionDisplayMs);
    };
    const getUnitQtyLimit = (uid) => {
        const u = unitMap.get(uid);
        if (!u) return 0;
        const customCap = CLEAN_UNIT_QTY_CAPS[clean(uid)] || 0;
        if (customCap > 0) return customCap;
        return isOneTime(u) ? 1 : SYSTEM_CONFIG.policy.maxUnitCapacity;
    };
    const normalizeUnitQty = (uid, qty) => {
        const n = parseInt(qty, 10);
        if (!Number.isFinite(n) || n <= 0) return 0;
        const limit = getUnitQtyLimit(uid);
        return limit > 0 ? Math.min(n, limit) : 0;
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
        const limit = getUnitQtyLimit(uid);
        const completedTargetQty = Math.max(0, parseInt(completedTargets.get(uid), 10) || 0);
        const requestedQty = parseInt(qty, 10) || 1;
        const maxActiveQty = Math.max(0, limit - completedTargetQty);
        const baseQty = add ? (activeUnits.get(uid) || 0) : 0;
        const nextQty = Math.min(normalizeUnitQty(uid, baseQty + requestedQty), maxActiveQty);
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
    const compareUnitByHiddenboardPriority = (a, b) =>
        getGradeIndex(b.grade) - getGradeIndex(a.grade) ||
        (SYSTEM_CONFIG.sorting.order[b.name] || 0) - (SYSTEM_CONFIG.sorting.order[a.name] || 0) ||
        a.name.localeCompare(b.name);
    const compareUnitByGradeName = (a, b) =>
        getGradeIndex(b.grade) - getGradeIndex(a.grade) ||
        a.name.localeCompare(b.name);
    const getUnitsFromIds = (ids) => Array.from(ids).map(uid => unitMap.get(uid)).filter(Boolean);
    const getUnitsFromMap = (map) => getUnitsFromIds(map.keys()).sort(compareUnitForDisplay);
    const getInvenboardTrackedTargets = (source = activeUnits) => {
        const tracked = new Map(source instanceof Map ? source : []);
        if (source === activeUnits) completedTargets.forEach((qty, uid) => {
            const amount = Math.max(0, parseInt(qty, 10) || 0);
            if (amount > 0) tracked.set(uid, (tracked.get(uid) || 0) + amount);
        });
        return tracked;
    };
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

    /* 상태 정리·조합식 파싱·데이터 캐시 */
    const makeMapSignature = (map) => [...(map instanceof Map ? map : new Map(map || [])).entries()]
        .map(([uid, qty]) => [uid, Math.max(0, parseInt(qty, 10) || 0)]).filter(([, qty]) => qty > 0)
        .sort(([a], [b]) => String(a).localeCompare(String(b))).map(([uid, qty]) => `${uid}:${qty}`).join('|');
    const makeObjectSignature = (obj, keys) => (keys || Object.keys(obj || {})).map(key => `${key}:${Math.max(0, parseInt(obj?.[key], 10) || 0)}`).join('|');
    const limitCacheSize = (cache, maxSize) => { while (cache.size > maxSize) cache.delete(cache.keys().next().value); };
    const cloneTotals = (totals) => ({ targetMap: { ...totals.targetMap }, completedMap: { ...totals.completedMap }, remainingMap: { ...totals.remainingMap } });

    function writeRuntimeStateEntry(map, rawUid, rawQty, { allowAutoCost = false, keepCompletedQty = false } = {}) {
        const uid = normalizeSavedId(rawUid);
        const qty = parseInt(rawQty, 10);
        if (!Number.isFinite(qty) || qty <= 0) return false;
        if (unitMap.has(uid)) {
            if (keepCompletedQty) map.set(uid, qty);
            else setPositiveMapValue(map, uid, qty);
            return true;
        }
        if (allowAutoCost && INVENBOARD_SLOT_SET.has(uid)) {
            map.set(uid, qty);
            return true;
        }
        return false;
    }

    function consumeInvenboardAutoCompletedUnit(uid, qty) {
        const amount = Math.max(0, parseInt(qty, 10) || 0);
        if (amount <= 0 || !_invenboardAutoCompletedUnits.has(uid)) return;
        const next = Math.max(0, (_invenboardAutoCompletedUnits.get(uid) || 0) - amount);
        if (next > 0) _invenboardAutoCompletedUnits.set(uid, next);
        else _invenboardAutoCompletedUnits.delete(uid);
    }

    function addInvenboardAutoCompletedUnit(uid, qty) {
        const amount = Math.max(0, parseInt(qty, 10) || 0);
        if (amount <= 0 || !unitMap.has(uid)) return;
        _invenboardAutoCompletedUnits.set(uid, Math.max(0, _invenboardAutoCompletedUnits.get(uid) || 0) + amount);
    }

    function pruneInvenboardAutoCompletedUnits() {
        for (const [uid, rawQty] of [..._invenboardAutoCompletedUnits.entries()]) {
            const trackedQty = Math.max(0, parseInt(rawQty, 10) || 0);
            const completedQty = Math.max(0, parseInt(completedUnits.get(uid), 10) || 0);
            const nextQty = Math.min(trackedQty, completedQty);
            if (nextQty > 0 && unitMap.has(uid) && !activeUnits.has(uid) && !completedTargets.has(uid)) {
                _invenboardAutoCompletedUnits.set(uid, nextQty);
            } else {
                _invenboardAutoCompletedUnits.delete(uid);
            }
        }
    }

    function pruneInvenboardManualInputs() {
        let changed = false;
        for (const [rawId, rawQty] of [..._invenboardManualInputs.entries()]) {
            _invenboardManualInputs.delete(rawId);
            const id = normalizeSavedId(rawId);
            const qty = Math.max(0, parseInt(rawQty, 10) || 0);
            if (!id || !ALL_INVENBOARD_SLOT_SET.has(id) || qty <= 0) {
                changed = true;
                continue;
            }
            _invenboardManualInputs.set(id, qty);
            if (id !== rawId || qty !== rawQty) changed = true;
        }
        return changed;
    }

    function clearInvenboardManualInputs(ids = ALL_INVENBOARD_SLOT_SET) {
        let changed = false;
        ids.forEach(id => {
            if (_invenboardManualInputs.delete(id)) changed = true;
        });
        return changed;
    }

    function resetInvenboardAutoCompletedUnits() {
        let changed = false;
        for (const [uid, qty] of [..._invenboardAutoCompletedUnits.entries()]) {
            if (!completedUnits.has(uid)) {
                _invenboardAutoCompletedUnits.delete(uid);
                continue;
            }
            subtractCompletedUnitQty(uid, qty);
            changed = true;
        }
        pruneInvenboardAutoCompletedUnits();
        return changed;
    }

    function sanitizeRuntimeState() {
        const normalizeMap = (map, options = {}) => {
            for (const [rawUid, rawQty] of [...map.entries()]) {
                map.delete(rawUid);
                writeRuntimeStateEntry(map, rawUid, rawQty, options);
            }
        };
        normalizeMap(activeUnits);
        normalizeMap(pausedUnits);
        normalizeMap(completedTargets);
        normalizeMap(completedUnits, { allowAutoCost: true, keepCompletedQty: true });
        normalizeMap(_invenboardAutoCompletedUnits, { keepCompletedQty: true });
        pruneInvenboardManualInputs();
        activeUnits.forEach((_, uid) => pausedUnits.delete(uid));
        completedTargets.forEach((_, uid) => {
            activeUnits.delete(uid);
            pausedUnits.delete(uid);
        });
        pruneInvenboardAutoCompletedUnits();
        if (!isValidCartTab(_cartTab)) _cartTab = 'active';
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

    /* 조합식 표시 생성 */
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
        _boardRequirementsCache.clear(); _costboardTotalsCache.clear(); _directInvenboardAtomNeedCache.clear(); _unitEssencePartsCache.clear();
        unitMap.forEach(u => {
            u.parsedCost = [];
            if (u.cost && !IGNORE_PARSE_RECIPES.includes(u.cost)) {
                u.cost.replace(/\//g, '+').split('+').forEach(p => {
                    const m = p.match(/(.+?)\[(\d+)\]/);
                    let cName = clean(m ? m[1].trim() : p.trim()), qty = m ? parseInt(m[2], 10) : 1;
                    let key = cName;
                    const spKey = AUTO_COMPLETE_IDS.find(k => k === cName || cName.includes(k));
                    if (spKey) key = spKey;
                    else key = ATOM_HASH[getUnitId(cName)] || getUnitId(cName);
                    u.parsedCost.push({ key, qty });
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


    /* 저장·검색·명령 */
    function hydrateSavedUnitMap(entries, targetMap, options = {}) {
        if (!Array.isArray(entries)) return;
        entries.forEach(([rawUid, rawQty]) => writeRuntimeStateEntry(targetMap, rawUid, rawQty, options));
    }

    function getPersistedStatePayload() {
        return {
            active: [...activeUnits],
            paused: [...pausedUnits],
            completed: [...completedUnits],
            completedTargets: [...completedTargets],
            invenboardAutoCompleted: [..._invenboardAutoCompletedUnits],
            invenboardManualInputs: [..._invenboardManualInputs],
            cartTab: _cartTab,
            presetUsed: [..._presetUsed],
            hideCompleted: _hideCompleted
        };
    }

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
            _invenboardAutoCompletedUnits.clear();
            _invenboardManualInputs.clear();
            _presetUsed.clear();

            hydrateSavedUnitMap(state.active, activeUnits);
            hydrateSavedUnitMap(state.paused, pausedUnits);
            hydrateSavedUnitMap(state.completed, completedUnits, { allowAutoCost: true, keepCompletedQty: true });
            hydrateSavedUnitMap(state.completedTargets, completedTargets);
            hydrateSavedUnitMap(state.invenboardAutoCompleted, _invenboardAutoCompletedUnits, { keepCompletedQty: true });
            if (Array.isArray(state.invenboardManualInputs)) {
                state.invenboardManualInputs.forEach(([rawId, rawQty]) => {
                    const id = normalizeSavedId(rawId);
                    const qty = Math.max(0, parseInt(rawQty, 10) || 0);
                    if (id && ALL_INVENBOARD_SLOT_SET.has(id) && qty > 0) _invenboardManualInputs.set(id, qty);
                });
            }
            _cartTab = isValidCartTab(state.cartTab) ? state.cartTab : 'active';
            if (Array.isArray(state.presetUsed)) {
                state.presetUsed.forEach(([k, v]) => {
                    const idx = parseInt(k, 10);
                    if (Number.isInteger(idx) && SYSTEM_CONFIG.presets[idx]) _presetUsed.set(idx, !!v);
                });
            }
            _hideCompleted = !!state.hideCompleted;

            sanitizeRuntimeState();
        } catch(e) {
            activeUnits.clear();
            pausedUnits.clear();
            completedUnits.clear();
            completedTargets.clear();
            _invenboardAutoCompletedUnits.clear();
            _invenboardManualInputs.clear();
            _presetUsed.clear();
        }
    }

    function saveNexusState() {
        try {
            sanitizeRuntimeState();
            localStorage.setItem(SYSTEM_CONFIG.storageKeys.saveData, JSON.stringify(getPersistedStatePayload()));
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
        let best = null, bestScore = -1;
        for (let [id, u] of unitMap) {
            if (!isUnitboardVisibleUnit(u)) continue;
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
                let addQty = qty;
                if (fromPreset) {
                    if ((preventStack || CLEAN_PRESET_NOSTACK.has(match.id)) && activeUnits.has(match.id)) { successCount++; return; }
                    const presetCap = CLEAN_PRESET_QTY_CAPS[match.id] || 0;
                    if (presetCap > 0) {
                        addQty = Math.min(qty, Math.max(0, presetCap - (activeUnits.get(match.id) || 0)));
                        if (addQty <= 0) { successCount++; return; }
                    }
                }
                setActiveUnitQty(match.id, addQty, { add: true });
                successCount++;
            }
        });
        if (successCount > 0) {
            debouncedUpdateAllPanels();
            const searchInp = getEl('unitSearchInput');
            if (searchInp) searchInp.value = '';
            if (_currentViewMode !== 'unitboard') switchLayout('unitboard');
        } else {
            applySearchFeedback(getEl('unitSearchInput'), restrictedCount > 0 ? '선택제한 유닛입니다.' : '유닛을 찾을 수 없습니다.');
        }
    }

    function getPresetCommandTargets(preset) {
        const targets = new Map();
        if (!preset?.command) return targets;
        String(preset.command).split('/').filter(c => c.trim()).forEach(cmd => {
            const parts = cmd.split('*'), targetName = parts[0].trim();
            if (!targetName) return;
            const match = findUnitFlexible(targetName);
            if (!match || isRestrictedUnit(match.id)) return;
            const qtyRaw = parseInt(parts[1], 10);
            const qty = normalizeUnitQty(match.id, Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1);
            if (qty <= 0) return;
            const presetCap = CLEAN_PRESET_QTY_CAPS[match.id] || 0;
            const nextQty = (targets.get(match.id) || 0) + qty;
            targets.set(match.id, presetCap > 0 ? Math.min(nextQty, presetCap) : normalizeUnitQty(match.id, nextQty));
        });
        return targets;
    }

    const isEssencePreset = (preset) => (preset?.group || '일반 프리셋') === '정수 프리셋';
    let _essencePresetTargetIdCache = null;
    const getEssencePresetTargetIds = () => {
        if (_essencePresetTargetIdCache) return _essencePresetTargetIdCache;
        const ids = new Set();
        SYSTEM_CONFIG.presets.filter(isEssencePreset).forEach(preset => getPresetCommandTargets(preset).forEach((_, uid) => ids.add(uid)));
        _essencePresetTargetIdCache = ids;
        return ids;
    };
    const isTargetCoveredByHigherTarget = (uid, targets) => {
        for (const higherUid of targets) {
            if (higherUid !== uid && getDependencies(higherUid).has(uid)) return true;
        }
        return false;
    };
    function filterTopLevelEssenceTargets(targetMap) {
        if (!(targetMap instanceof Map) || targetMap.size === 0) return false;
        const essenceIds = getEssencePresetTargetIds();
        const targets = [...targetMap.keys()].filter(uid => essenceIds.has(uid) && unitMap.has(uid));
        const removeIds = targets.filter(uid => isTargetCoveredByHigherTarget(uid, targets));
        removeIds.forEach(uid => targetMap.delete(uid));
        return removeIds.length > 0;
    }
    function applyEssencePresetTopLevelFilter() {
        const activeChanged = filterTopLevelEssenceTargets(activeUnits);
        const pausedChanged = filterTopLevelEssenceTargets(pausedUnits);
        return activeChanged || pausedChanged;
    }

    function getCartPresetUnitQty(uid) {
        return Math.max(0, activeUnits.get(uid) || 0) + Math.max(0, pausedUnits.get(uid) || 0) + Math.max(0, completedTargets.get(uid) || 0);
    }

    function isPresetActiveInCart(preset) {
        const targets = getPresetCommandTargets(preset);
        if (targets.size === 0) return false;
        const cartTargetIds = new Set([...activeUnits.keys(), ...pausedUnits.keys(), ...completedTargets.keys()].filter(uid => unitMap.has(uid)));
        for (const [uid, qty] of targets.entries()) {
            if (getCartPresetUnitQty(uid) >= qty) continue;
            if (!isEssencePreset(preset) || !isTargetCoveredByHigherTarget(uid, cartTargetIds)) return false;
        }
        return true;
    }

    function syncPresetUsageState() {
        let changed = false;
        SYSTEM_CONFIG.presets.forEach((preset, idx) => {
            if (!preset.oneTime) {
                if (_presetUsed.delete(idx)) changed = true;
                return;
            }
            const used = isPresetActiveInCart(preset);
            if (used) {
                if (!_presetUsed.get(idx)) {
                    _presetUsed.set(idx, true);
                    changed = true;
                }
            } else if (_presetUsed.delete(idx)) {
                changed = true;
            }
        });
        return changed;
    }


    /* 계산 엔진 및 패널 갱신 */
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

    function calculateBoardRequirements() {
        const cacheKey = `${makeMapSignature(activeUnits)}::${makeMapSignature(completedUnits)}`;
        if (_boardRequirementsCache.has(cacheKey)) return _boardRequirementsCache.get(cacheKey);
        let reqMap = new Map(), baseMap = new Map(), reasonMap = new Map();
        let autoCostReq = {}, baseAutoCostReq = {}, autoCostReason = {};
        AUTO_COST_SLOT_RAWS.forEach(k => { autoCostReq[clean(k)] = 0; baseAutoCostReq[clean(k)] = 0; autoCostReason[clean(k)] = new Map(); });

        let mergedActive = new Set();
        activeUnits.forEach((_, uid) => unitMap.get(uid)?.parsedRecipe?.forEach(pr => pr.id && activeUnits.has(pr.id) && mergedActive.add(pr.id)));

        const baseDeficits = new Map(), deficits = new Map(), processedBase = new Map(), processedDeficit = new Map(), queue = [], inQueue = new Set();
        const enqueue = (uid) => { if (uid && !inQueue.has(uid)) { queue.push(uid); inQueue.add(uid); } };
        const addNeed = (map, uid, qty) => {
            if (!uid || qty <= 0) return;
            const prev = map.get(uid) || 0;
            let next = prev + qty;
            if (isOneTime(unitMap.get(uid))) next = Math.min(next, 1);
            if (next > prev) { map.set(uid, next); enqueue(uid); }
        };
        activeUnits.forEach((qty, uid) => {
            const amount = isOneTime(unitMap.get(uid)) ? 1 : qty;
            if (amount > 0) { baseDeficits.set(uid, amount); deficits.set(uid, amount); enqueue(uid); }
        });

        for (let head = 0, loopCount = 0; head < queue.length && ++loopCount <= APP_INTERNAL.maxLoopQueue; head++) {
            const uid = queue[head]; inQueue.delete(uid);
            if (!unitMap.has(uid) && !virtualUnitIds.has(uid)) continue;
            const unit = unitMap.get(uid), tools = getToolNeed(uid);
            const baseNeed = baseDeficits.get(uid) || 0, prevBase = processedBase.get(uid) || 0, baseDelta = baseNeed - prevBase;
            if (baseDelta > 0) {
                processedBase.set(uid, baseNeed);
                if (prevBase <= 0) tools.forEach(tid => addNeed(baseDeficits, tid, 1));
                unit?.parsedRecipe?.forEach(c => c.id && !isToolRequirement(uid, c.id) && (unitMap.has(c.id) || virtualUnitIds.has(c.id)) && addNeed(baseDeficits, c.id, baseDelta * c.qty));
            }
            const rawDeficit = deficits.get(uid) || 0;
            const effectiveDeficit = rawDeficit - Math.min(mergedActive.has(uid) ? 0 : (completedUnits.get(uid) || 0), rawDeficit);
            const prevDeficit = processedDeficit.get(uid) || 0, deficitDelta = effectiveDeficit - prevDeficit;
            if (deficitDelta > 0) {
                processedDeficit.set(uid, effectiveDeficit);
                if (prevDeficit <= 0) tools.forEach(tid => addNeed(deficits, tid, 1));
                unit?.parsedRecipe?.forEach(c => c.id && !isToolRequirement(uid, c.id) && (unitMap.has(c.id) || virtualUnitIds.has(c.id)) && addNeed(deficits, c.id, deficitDelta * c.qty));
            }
        }

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
                let cRoots = rootTracking.get(toolId) || new Map(), isDirTarget = activeUnits.has(uid);
                cRoots.set(`TOOL_${uid}`, createToolReasonInfo(uid, { depth: isDirTarget ? 1 : 2, reqQty: 1 }));
                rootTracking.set(toolId, cRoots);
            });
            uData.parsedRecipe?.forEach(child => {
                if (!child.id || isToolRequirement(uid, child.id) || (!unitMap.has(child.id) && !virtualUnitIds.has(child.id))) return;
                let cRoots = rootTracking.get(child.id) || new Map(), isDirTarget = activeUnits.has(uid);
                cRoots.set(`MAT_${uid}`, createMaterialReasonInfo(uid, { cond: child.cond, depth: isDirTarget ? 1 : 2, reqQty: child.qty }));
                rootTracking.set(child.id, cRoots);
            });
            uData.parsedCost?.forEach(pc => {
                if (AUTO_COST_SLOT_SET.has(pc.key) && (deficits.get(uid) || 0) > 0) {
                    let isDirTarget = activeUnits.has(uid);
                    autoCostReason[pc.key].set(`AUTO_${uid}`, createMaterialReasonInfo(uid, { depth: isDirTarget ? 1 : 2, reqQty: pc.qty }));
                }
            });
        });

        rootTracking.forEach((rMap, cId) => {
            const finalMap = new Map(rMap);
            if (activeUnits.has(cId)) finalMap.set('TARGET_' + cId, { text: GROUP_DEFS.find(g => g.pid === 'grid-target')?.title || '', cond: '', depth: 0 });
            reasonMap.set(cId, finalMap);
        });

        const result = { reqMap, baseMap, reasonMap, autoCostReq, baseAutoCostReq, autoCostReason };
        _boardRequirementsCache.set(cacheKey, result); limitCacheSize(_boardRequirementsCache, 8);
        return result;
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

    function clampCompletedUnits(calcResult, costboardTotals = null) {
        const { baseMap, baseAutoCostReq } = calcResult || calculateBoardRequirements();
        const resolvedCostboardTotals = costboardTotals || (_currentViewMode === 'invenboard' ? calculateInvenboardCostboardTotals() : calculateCostboardAtomTotals());
        let changed = false;
        for (let [uid, rawQty] of [...completedUnits.entries()]) {
            const compQty = parseInt(rawQty, 10);
            const isInvenboardSlot = ALL_INVENBOARD_SLOT_SET.has(uid);
            const isUnitSlot = unitMap.has(uid);
            if (!Number.isFinite(compQty) || compQty <= 0 || (!isUnitSlot && !isInvenboardSlot)) {
                completedUnits.delete(uid);
                changed = true;
                continue;
            }
            if (isInvenboardSlot && _currentViewMode === 'invenboard') continue;
            if (activeUnits.has(uid)) {
                let maxAllow = baseMap.get(uid) || activeUnits.get(uid) || 1;
                if (compQty > maxAllow) { completedUnits.set(uid, maxAllow); changed = true; }
                continue;
            }
            let maxAllow = isUnitSlot ? (baseMap.get(uid) || 0) : (resolvedCostboardTotals.targetMap[getCostboardAtomRawName(uid)] || baseAutoCostReq[uid] || 0);
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
            let calcResult = calculateBoardRequirements();
            let costboardTotals = calculateCostboardAtomTotals();
            let boardTotals = _currentViewMode === 'invenboard' ? calculateInvenboardCostboardTotals() : costboardTotals;
            if (clampCompletedUnits(calcResult, boardTotals)) {
                calcResult = calculateBoardRequirements();
                costboardTotals = calculateCostboardAtomTotals();
                boardTotals = _currentViewMode === 'invenboard' ? calculateInvenboardCostboardTotals() : costboardTotals;
            }
            _lastCalcResult = calcResult;
            updateCostboard(costboardTotals);
            updateTabsUI();
            updateTabContentUI();
            updateBoardPanel(calcResult, boardTotals);
            updateCartUI();
            updatePresetBtns();
            saveNexusState();
        });
    }

    function commitNexusStateChange({ clearHighlight = false } = {}) {
        if (clearHighlight) toggleHighlight(null);
        triggerHaptic();
        debouncedUpdateAllPanels();
    }


    /* 완료·복구·초기화 */
    function subtractCompletedUnitQty(uid, qty) {
        const amount = Math.max(0, parseInt(qty, 10) || 0);
        if (amount <= 0) return;
        const current = Math.max(0, parseInt(completedUnits.get(uid), 10) || 0);
        const next = Math.max(0, current - amount);
        if (next > 0) completedUnits.set(uid, next);
        else completedUnits.delete(uid);
        if (ALL_INVENBOARD_SLOT_SET.has(uid) && _invenboardManualInputs.has(uid)) {
            const manualNext = Math.max(0, (parseInt(_invenboardManualInputs.get(uid), 10) || 0) - amount);
            if (manualNext > next && next > 0) _invenboardManualInputs.set(uid, manualNext);
            else _invenboardManualInputs.delete(uid);
        }
        consumeInvenboardAutoCompletedUnit(uid, amount);
    }

    function deleteCompletedRecipe(uid, multiplier) {
        const u = unitMap.get(uid); if (!u) return;
        const amount = Math.max(0, parseInt(multiplier, 10) || 0);
        if (amount <= 0) return;
        u.parsedRecipe?.forEach(child => {
            if (!child.id) return;
            const perUnitNeed = isToolRequirement(uid, child.id) ? 1 : child.qty;
            subtractCompletedUnitQty(child.id, perUnitNeed * amount);
        });
    }

    function removeActiveUnitState(uid, qty = activeUnits.get(uid) || 1) {
        activeUnits.delete(uid);
        deleteCompletedRecipe(uid, qty || 1);
        completedUnits.delete(uid);
        _invenboardAutoCompletedUnits.delete(uid);
    }

    function resetInvenboardOwnedForUnit(uid, qty) {
        const source = new Map([[uid, normalizeUnitQty(uid, qty) || 1]]);
        const atoms = getInvenboardAtoms();
        const { completedMap } = calculateInvenboardCostboardTotals(source, atoms);
        atoms.forEach(atom => {
            const amount = Math.max(0, parseInt(completedMap[atom], 10) || 0);
            if (amount > 0) subtractCompletedUnitQty(clean(atom), amount);
        });
    }

    function releaseCompletedTarget(uid, { restoreToActive = false } = {}) {
        if (!completedTargets.has(uid) || !unitMap.has(uid)) return false;
        const qty = completedTargets.get(uid) || 1;
        completedTargets.delete(uid);
        if (_currentViewMode === 'invenboard') resetInvenboardOwnedForUnit(uid, qty);
        else deleteCompletedRecipe(uid, qty);
        completedUnits.delete(uid);
        _invenboardAutoCompletedUnits.delete(uid);
        if (restoreToActive) setActiveUnitQty(uid, qty);
        return true;
    }

    function restoreCompletedTarget(uid) {
        return releaseCompletedTarget(uid, { restoreToActive: true });
    }

    function removeCompletedTarget(uid) {
        return releaseCompletedTarget(uid);
    }

    function completeUnit(uid, amount) {
        if (_completeLock.has(uid)) return;
        _completeLock.add(uid);
        const cWrapEl = document.getElementById(`craft-wrap-${uid}`);
        const lockBtns = cWrapEl ? Array.from(cWrapEl.querySelectorAll('button')) : [];
        lockBtns.forEach(b => b.disabled = true);
        try {
            const { reqMap, baseMap, autoCostReq } = calculateBoardRequirements();
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
                const prevCompleted = completedUnits.get(uid) || 0;
                deleteCompletedRecipe(uid, processQty);
                const newComp = Math.max(prevCompleted, completedUnits.get(uid) || 0) + processQty;
                completedUnits.set(uid, newComp);

                if (isPureTarget) {
                    if (newComp >= (activeUnits.get(uid) || 1)) {
                        completedTargets.set(uid, activeUnits.get(uid) || 1);
                        activeUnits.delete(uid);
                        completedUnits.delete(uid);
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
                    }
                }
                completeHiddenboardRecipeUnitsIfReady();
                commitNexusStateChange({ clearHighlight: true });
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
        if (!restoreCompletedTarget(uid)) return;
        commitNexusStateChange();
    }

    function restoreAllCompleted() {
        if (_restoreAllCooldown) return;
        const cfg = SYSTEM_CONFIG.policy.restoreAllBtn;
        const btn = getEl(cfg.idBtn), label = getEl(cfg.idLabel);

        if (_restoreAllPendingTimer) {
            clearTimeout(_restoreAllPendingTimer);
            _restoreAllPendingTimer = null;
            if (label) label.textContent = cfg.labelDefault;
            if (btn) { btn.classList.remove('reset-btn-pending'); btn.disabled = false; }
            return;
        }

        if (label) label.textContent = '취소하려면 다시 클릭';
        if (btn) { btn.classList.add('reset-btn-pending'); }

        _restoreAllPendingTimer = setTimeout(() => {
            _restoreAllPendingTimer = null;
            activeUnits.clear(); pausedUnits.clear(); completedUnits.clear(); completedTargets.clear(); _invenboardAutoCompletedUnits.clear(); _invenboardManualInputs.clear();
            _presetUsed.clear(); updatePresetBtns(); commitNexusStateChange();
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
        uidsToReset.forEach(uid => {
            completedUnits.delete(uid);
            _invenboardAutoCompletedUnits.delete(uid);
        });
    }

    function resetGroupCompleted(level) {
        if (level >= 5) {
            const targetEntries = Array.from(completedTargets.entries());
            completedTargets.clear();
            targetEntries.forEach(([uid, qty]) => {
                setActiveUnitQty(uid, qty);
            });
            completedUnits.clear();
            _invenboardAutoCompletedUnits.clear();
            _invenboardManualInputs.clear();
            _presetUsed.clear(); updatePresetBtns();
        } else {
            resetCompletedMaterialsByLevel(level);
        }
        toggleHighlight(null); debouncedUpdateAllPanels();
    }

    function resetUnitboard() {
        activeUnits.clear(); pausedUnits.clear(); completedUnits.clear(); completedTargets.clear(); _invenboardAutoCompletedUnits.clear(); _invenboardManualInputs.clear();
        toggleHighlight(null);
        _presetUsed.clear(); updatePresetBtns(); debouncedUpdateAllPanels();
    }


    /* 코스트보드 */
    function renderBoardSlots(boardId, atoms, slotTemplate) {
        const board = getEl(boardId);
        if (!board) return;
        board.innerHTML = atoms.map(slotTemplate).join('');
    }

    function renderCostboardAtoms() {
        const buildSlotClassName = (atoms) => `costboard-slot ${getCostboardSlotToneClass(atoms)}`;
        const renderCostboardSlot = (slot) => {
            const atoms = slot.atoms || [];
            if (atoms.length === 1) {
                const atom = atoms[0];
                return `<div class="${buildSlotClassName(atoms)}" id="vslot-${clean(atom)}"><div class="costboard-val"></div><div class="costboard-name" id="name-${clean(atom)}">${atom}</div></div>`;
            }
            const splitItems = atoms.map(atom => `
                <div class="costboard-split-item" id="vslot-${clean(atom)}">
                    <div class="costboard-val"></div>
                    <div class="costboard-name" id="name-${clean(atom)}">${atom}</div>
                </div>
            `).join('<div class="costboard-split-divider" aria-hidden="true"></div>');
            return `<div class="${buildSlotClassName(atoms)} is-split-slot" data-slot-atoms="${atoms.map(clean).join(',')}">${splitItems}</div>`;
        };
        renderBoardSlots('costboardGrid', COSTBOARD_SLOT_DEFS, renderCostboardSlot);
    }

    function calculateCostboardAtomTotals(completedSource = completedUnits, atomList = SYSTEM_CONFIG.costboardAtoms, options = {}) {
        const costboardAtoms = (Array.isArray(atomList) && atomList.length ? atomList : SYSTEM_CONFIG.costboardAtoms).filter(Boolean);
        const activeSource = options.activeSource instanceof Map ? options.activeSource : activeUnits;
        const cacheKey = [costboardAtoms.join(''), options.preferRecipeAtoms ? 1 : 0, options.targetMap ? makeObjectSignature(options.targetMap, costboardAtoms) : makeMapSignature(activeSource), makeMapSignature(completedSource)].join('::');
        if (_costboardTotalsCache.has(cacheKey)) return cloneTotals(_costboardTotalsCache.get(cacheKey));

        const costboardAtomSet = new Set(costboardAtoms), targetMap = {}, completedMap = {}, remainingMap = {};
        costboardAtoms.forEach(atom => { targetMap[atom] = completedMap[atom] = remainingMap[atom] = 0; });
        const addCostboardAtom = (rawName, qty, map) => {
            const normalizedRawName = getCostboardAtomRawName(clean(rawName));
            if (!costboardAtomSet.has(normalizedRawName)) return false;
            map[normalizedRawName] = (map[normalizedRawName] || 0) + qty;
            return true;
        };
        const flattenUnitToAtoms = (uid, qty, map, path) => {
            if (qty <= 0 || path.has(uid)) return;
            path.add(uid);
            try {
                if (addCostboardAtom(getCostboardAtomRawName(uid), qty, map)) return;
                const u = unitMap.get(uid); if (!u) return;
                const flattenRecipe = () => u.parsedRecipe?.forEach(child => child.id && (isToolRequirement(uid, child.id) ? flattenUnitToAtoms(child.id, 1, map, path) : flattenUnitToAtoms(child.id, child.qty * qty, map, path)));
                const flattenCost = () => { u.parsedCost?.forEach(pc => !addCostboardAtom(getCostboardAtomRawName(pc.key), pc.qty * qty, map) && flattenUnitToAtoms(pc.key, pc.qty * qty, map, path)); getToolNeed(uid).forEach(toolId => flattenUnitToAtoms(toolId, 1, map, path)); };
                if (options.preferRecipeAtoms) { if (u.parsedRecipe?.length) return flattenRecipe(); flattenCost(); }
                else { if (u.parsedCost?.length) return flattenCost(); flattenRecipe(); }
            } finally { path.delete(uid); }
        };

        if (options.targetMap) costboardAtoms.forEach(atom => targetMap[atom] = Math.max(0, parseInt(options.targetMap[atom], 10) || 0));
        else activeSource.forEach((count, uid) => count > 0 && flattenUnitToAtoms(uid, count, targetMap, new Set()));
        (completedSource instanceof Map ? completedSource : new Map(completedSource || [])).forEach((count, uid) => count > 0 && flattenUnitToAtoms(uid, count, completedMap, new Set()));
        costboardAtoms.forEach(atom => remainingMap[atom] = Math.max(0, (targetMap[atom] || 0) - (completedMap[atom] || 0)));
        const result = { targetMap, completedMap, remainingMap };
        _costboardTotalsCache.set(cacheKey, cloneTotals(result)); limitCacheSize(_costboardTotalsCache, 24);
        return result;
    }

    function updateCostboard(costboardTotals = null) {
        const { remainingMap } = costboardTotals || calculateCostboardAtomTotals();

        SYSTEM_CONFIG.costboardAtoms.forEach(atom => {
            const container = getEl(`vslot-${clean(atom)}`), valueEl = container?.querySelector('.costboard-val'), nameEl = container?.querySelector('.costboard-name');
            if (!container || !valueEl || !nameEl) return;

            const remainQty = remainingMap[atom] || 0;
            const splitParent = container.closest('.costboard-slot.is-split-slot');
            const isSplitItem = !!splitParent;
            if (remainQty > 0) {
                if (valueEl.innerText !== String(remainQty)) valueEl.innerText = String(remainQty);
                nameEl.style.display = 'block';
                container.classList.add('active');
                if (isSplitItem) return;
            } else {
                if (valueEl.innerHTML !== '') valueEl.innerHTML = '';
                nameEl.style.display = 'block';
                container.classList.remove('active');
            }
        });

        document.querySelectorAll('.costboard-slot.is-split-slot').forEach(slot => {
            slot.classList.toggle('has-active', !!slot.querySelector('.costboard-split-item.active'));
        });
    }


    /* 히든보드 */
    function renderHiddenboard() {
        if (_isHiddenboardRendered) return;
        const boardEl = getEl('boardContent');
        if (!boardEl) return;
        boardEl.classList.remove('invenboard-mode');
        _isInvenboardRendered = false;
        const renderHiddenboardSlot = (id, n, g) => `<div class="hiddenboard-slot" id="d-slot-wrap-${id}" data-uid="${id}"><div class="d-reason-wrap" id="d-reason-${id}"></div><div class="d-slot-main"><div class="d-name" data-action="showRecipeTooltip" data-uid="${id}" data-is-hiddenboard="true"><span class="gtag grade-${g}">${g}</span><span class="d-name-inline">${n}${CLEAN_SPECIAL_CONDITIONS[id]?`<span class="badge-special-cond recipe-special-cond recipe-cond-offset">특수조건</span>`:''}</span></div><div id="d-cond-${id}" class="d-cond-inline"></div></div><div id="craft-wrap-${id}" class="craft-wrap"></div></div>`;
        const getGrp = (id, pid, title, resetLevel=0, isCol=false, alwaysShow=false, alwaysOpen=false, resetLabel='완료복구') => `
            <div class="hiddenboard-group" id="${id}" style="${alwaysShow ? '' : 'display:none;'}" ${alwaysShow ? 'data-always-show="true"' : ''} ${alwaysOpen ? 'data-always-open="true"' : ''}>
                <div class="hiddenboard-group-title" data-action="toggleGroup" data-grid-id="${pid}">
                    <div class="grp-title-main">
                        <span class="grp-toggle-icon" style="transform:${isCol?'rotate(-90deg)':'rotate(0deg)'};">▼</span>
                        <span class="grp-title-text">${title}</span>
                        ${resetLevel > 0 ? `<span class="grp-count-badge" id="grp-count-${pid}"></span>` : ''}
                    </div>
                    <div class="grp-title-actions" id="${id}-actions">
                        ${resetLevel > 0 ? `<button type="button" class="btn-text-link grp-restore-btn" data-action="resetGroup" data-level="${resetLevel}">${resetLabel}</button>` : ''}
                    </div>
                </div>
                <div class="hiddenboard-grid" id="${pid}" ${isCol?'style="display:none;"':''}></div>
            </div>`;

        const allUnits = Array.from(unitMap.values());
        const unitSlots = allUnits.filter(u => getGradeIndex(u.grade) >= getGradeIndex(SYSTEM_CONFIG.policy.minGradeForHiddenboard) && !AUTO_COST_SLOT_SET.has(u.id)).map(u => renderHiddenboardSlot(u.id, u.name, u.grade)).join('');

        const _exIds = new Set((SYSTEM_CONFIG.policy.hideCompletedExcludeGroups || []).map(t => titleToGridId[t]).filter(Boolean));

        returnHiddenboardControlsToHeader();
        boardEl.innerHTML = `<div id="hiddenboard-empty-msg" class="empty-msg"></div><div id="hiddenboard-slot-pool" class="hiddenboard-slot-pool">${unitSlots}</div>` + GROUP_DEFS.map(g => getGrp(g.id, g.pid, g.title, g.resetLevel, g.isCol, g.alwaysShow, g.alwaysOpen, g.resetLabel)).join('');
        boardEl.dataset.excludeGridIds = JSON.stringify([..._exIds]);
        _hiddenboardSlotElsByUid.clear();
        boardEl.querySelectorAll('.hiddenboard-slot[data-uid]').forEach(el => _hiddenboardSlotElsByUid.set(el.dataset.uid, el));
        _isHiddenboardRendered = true;
        placeHiddenboardControls();
    }

    function returnHiddenboardControlsToHeader() {
        const actions = getEl('hiddenboardGlobalActions') || document.querySelector('.hiddenboard-ph-btns');
        const mobileHost = getEl('boardMobileHeader');
        if (!actions || !mobileHost) return;
        if (actions.parentElement !== mobileHost) mobileHost.appendChild(actions);
        actions.classList.remove('hiddenboard-actions-in-group');
        actions.classList.add('hiddenboard-actions-in-header');
    }

    function placeHiddenboardControls() {
        const actions = getEl('hiddenboardGlobalActions') || document.querySelector('.hiddenboard-ph-btns');
        const mobileHost = getEl('boardMobileHeader');
        const desktopHost = getEl('group-target-actions');
        if (!actions || !mobileHost) return;
        const useMobileHeader = window.matchMedia('(max-width: 767px)').matches || !desktopHost;
        if (useMobileHeader) {
            if (actions.parentElement !== mobileHost) mobileHost.appendChild(actions);
            actions.classList.remove('hiddenboard-actions-in-group');
            actions.classList.add('hiddenboard-actions-in-header');
        } else {
            if (actions.parentElement !== desktopHost) desktopHost.insertBefore(actions, desktopHost.firstChild);
            actions.classList.remove('hiddenboard-actions-in-header');
            actions.classList.add('hiddenboard-actions-in-group');
        }
    }

    function updateBoardHeader() {
        const layout = getEl('mainLayout');
        const isHiddenboardView = _currentViewMode === 'hiddenboard';
        const isInvenboardView = _currentViewMode === 'invenboard';
        const hiddenboardActions = getEl('hiddenboardGlobalActions');
        const invenboardActions = getEl('invenboardHeaderActions');
        if (layout) layout.classList.toggle('view-invenboard', isInvenboardView);
        if (hiddenboardActions) hiddenboardActions.hidden = !isHiddenboardView;
        if (invenboardActions) invenboardActions.hidden = !isInvenboardView;
    }

    function getInvenboardAtoms() {
        return _isInvenboardSlotsExpanded ? [...SYSTEM_CONFIG.costboardAtoms, ...INVENBOARD_EXPANSION_ATOMS] : SYSTEM_CONFIG.costboardAtoms;
    }

    function getInvenboardSlotDefs() {
        if (!_isInvenboardSlotsExpanded) return COSTBOARD_SLOT_DEFS;
        const bottomSlotIds = new Set(["땅거미지뢰", "자동포탑", "우르사돈암", "우르사돈수", "갓오타", "메시브"].map(clean));
        const isBottomSlot = (slot) => (slot.atoms || []).some(atom => bottomSlotIds.has(clean(atom)));
        const upperSlots = COSTBOARD_SLOT_DEFS.filter(slot => !isBottomSlot(slot));
        const bottomSlots = COSTBOARD_SLOT_DEFS.filter(isBottomSlot);
        return [...upperSlots, ...INVENBOARD_EXPANSION_SLOT_DEFS, ...bottomSlots];
    }

    function getInvenboardSlotIdSet() {
        return _isInvenboardSlotsExpanded ? ALL_INVENBOARD_SLOT_SET : INVENBOARD_SLOT_SET;
    }

    function getInvenboardInputStep(id) {
        const cleanId = normalizeSavedId(id);
        const special = SPECIAL_RENDER_LIST.find(entry => entry.id === cleanId);
        return Math.max(1, parseInt(special?.batch, 10) || 1);
    }

    function normalizeInvenboardAmount(qty, maxQty) {
        const parsed = parseInt(qty, 10);
        if (!Number.isFinite(parsed) || parsed <= 0) return 0;
        const limit = Math.max(0, parseInt(maxQty, 10) || 0);
        if (limit <= 0) return 0;
        return Math.min(parsed, limit);
    }

    function getEffectiveInvenboardCompletedSource(completedSource = completedUnits, activeSource = getInvenboardTrackedTargets(), targetMap = null) {
        const effective = new Map(completedSource instanceof Map ? completedSource : new Map(completedSource || []));
        const targetSource = activeSource instanceof Map ? activeSource : getInvenboardTrackedTargets();
        const atomTargetMap = targetMap || calculateCostboardAtomTotals(new Map(), getInvenboardAtoms(), { activeSource: targetSource, preferRecipeAtoms: _isInvenboardSlotsExpanded }).targetMap;
        ALL_INVENBOARD_SLOT_SET.forEach(id => {
            if (!effective.has(id)) return;
            const rawQty = Math.max(0, parseInt(effective.get(id), 10) || 0);
            const maxQty = Math.max(0, parseInt(atomTargetMap[getCostboardAtomRawName(id)], 10) || 0);
            const nextQty = Math.min(rawQty, maxQty);
            if (nextQty > 0) effective.set(id, nextQty);
            else effective.delete(id);
        });
        return effective;
    }

    function calculateInvenboardCostboardTotals(completedSource = completedUnits, options = {}) {
        const activeSource = options.activeSource instanceof Map ? options.activeSource : getInvenboardTrackedTargets();
        const atomList = getInvenboardAtoms(), preferRecipeAtoms = _isInvenboardSlotsExpanded;
        const targetMap = options.targetMap || calculateCostboardAtomTotals(new Map(), atomList, { activeSource, preferRecipeAtoms }).targetMap;
        const effectiveCompleted = options.rawCompleted === true ? completedSource : getEffectiveInvenboardCompletedSource(completedSource, activeSource, targetMap);
        return calculateCostboardAtomTotals(effectiveCompleted, atomList, { ...options, activeSource, preferRecipeAtoms, targetMap });
    }

    function updateInvenboardSlotModeButton() {
        const btn = getEl('invenboardSlotModeBtn');
        if (!btn) return;
        btn.textContent = _isInvenboardSlotsExpanded ? '핵심재료' : '전체재료';
        btn.classList.toggle('is-expanded', _isInvenboardSlotsExpanded);
    }

    function toggleInvenboardSlotMode() {
        if (_currentViewMode !== 'invenboard') return;
        _isInvenboardSlotsExpanded = !_isInvenboardSlotsExpanded;
        _isInvenboardRendered = false;
        const boardEl = getEl('boardContent');
        if (boardEl) boardEl.innerHTML = '';
        commitNexusStateChange();
    }

    function ensureInvenboardHeaderActions() {
        const mobileHost = getEl('boardMobileHeader');
        if (!mobileHost) return null;
        let actions = getEl('invenboardHeaderActions');
        if (!actions) {
            actions = document.createElement('div');
            actions.id = 'invenboardHeaderActions';
            actions.className = 'invenboard-actions invenboard-header-actions';
            actions.innerHTML = `<button type="button" class="pc-btn invenboard-mode-input" id="invenboardInputModeBtn" data-action="toggleInvenboardInputMode">수동입력 전환</button>
                <button type="button" class="pc-btn invenboard-reset" data-action="resetInvenboardAmounts">보유량 초기화</button>
                <button type="button" class="pc-btn invenboard-complete-all" id="invenboardCompleteAllBtn" data-action="completeAllInvenboardUnits">전체완료</button>
                <button type="button" class="pc-btn invenboard-slot-toggle" id="invenboardSlotModeBtn" data-action="toggleInvenboardSlotMode">전체재료</button>`;
        }
        if (actions.parentElement !== mobileHost) mobileHost.appendChild(actions);
        updateInvenboardSlotModeButton();
        return actions;
    }

    function renderInvenboard() {
        if (_isInvenboardRendered) return;
        const boardEl = getEl('boardContent');
        if (!boardEl) return;
        _isHiddenboardRendered = false;
        returnHiddenboardControlsToHeader();
        ensureInvenboardHeaderActions();
        boardEl.classList.remove('highlight-mode');
        boardEl.classList.add('invenboard-mode');

        const renderCostItem = (atom) => {
            const id = clean(atom);
            const safeName = escapeHtml(atom);
            const inputStep = getInvenboardInputStep(id);
            return `<div class="invenboard-item" id="invenboard-${id}" data-inven-id="${id}">
                <div class="invenboard-main">
                    <button type="button" class="invenboard-tap" data-action="invenboardAdd" data-inven-id="${id}" data-delta="${inputStep}" aria-label="${safeName} ${inputStep}보유">
                        <span class="invenboard-count" id="inven-owned-${id}">0</span>
                    </button>
                    <div class="invenboard-manual-value">
                        <input type="number" class="invenboard-input" id="inven-input-${id}" data-inven-id="${id}" min="0" step="1" inputmode="numeric" pattern="[0-9]*" aria-label="${safeName} 보유량">
                    </div>
                    ${renderInvenboardGradeTag(atom)}
                    <span class="invenboard-name"${getInvenboardAtomNameStyle(atom)}>${safeName}</span>
                </div>
                <div class="invenboard-controls">
                    <button type="button" class="pc-btn invenboard-plus" data-action="invenboardAdd" data-inven-id="${id}" data-delta="${inputStep}">${inputStep}보유</button>
                    <button type="button" class="pc-btn invenboard-plus invenboard-plus10" data-action="invenboardAdd" data-inven-id="${id}" data-delta="10">10보유</button>
                </div>
            </div>`;
        };
        const renderCostSlot = ({ atoms, empty }) => {
            const atomList = (atoms || []).filter(Boolean);
            if (empty || atomList.length === 0) return '<div class="invenboard-slot is-empty-slot" aria-hidden="true"></div>';
            const slotIds = atomList.map(clean).join(',');
            const slotClass = `invenboard-slot ${getCostboardSlotToneClass(atomList)}`;
            if (atomList.length === 1) return `<div class="${slotClass}" data-slot-atoms="${slotIds}">${renderCostItem(atomList[0])}</div>`;
            return `<div class="${slotClass} is-split-slot" data-slot-atoms="${slotIds}">${atomList.map(renderCostItem).join('<div class="invenboard-split-divider" aria-hidden="true"></div>')}</div>`;
        };

        boardEl.innerHTML = `<div id="invenboardEmpty" class="empty-msg"></div>
            <div class="invenboard-grid" id="invenboardGrid">${getInvenboardSlotDefs().map(renderCostSlot).join('')}</div>`;
        _isInvenboardRendered = true;
    }

    function getInvenboardMaxQty(id, totals = calculateInvenboardCostboardTotals()) {
        if (!getInvenboardSlotIdSet().has(id)) return 0;
        return Math.max(0, totals.targetMap[getCostboardAtomRawName(id)] || 0);
    }

    function getDirectInvenboardAtomNeed(uid, qty = 1) {
        const amount = Math.max(1, parseInt(qty, 10) || 1);
        const cacheKey = `${_isInvenboardSlotsExpanded ? 'expanded' : 'core'}:${uid}:${amount}`;
        if (_directInvenboardAtomNeedCache.has(cacheKey)) return new Map(_directInvenboardAtomNeedCache.get(cacheKey));
        const { targetMap } = calculateInvenboardCostboardTotals(new Map(), { activeSource: new Map([[uid, amount]]), rawCompleted: true });
        const need = new Map(getInvenboardAtoms().map(atom => [clean(atom), Math.max(0, targetMap[atom] || 0)]).filter(([, n]) => n > 0));
        _directInvenboardAtomNeedCache.set(cacheKey, need); limitCacheSize(_directInvenboardAtomNeedCache, 512);
        return new Map(need);
    }

    function getInvenboardOwnedAtomMap({ directOnly = false } = {}) {
        const available = new Map();
        if (!directOnly) {
            const totals = calculateInvenboardCostboardTotals();
            getInvenboardAtoms().forEach(atom => {
                const qty = Math.max(0, parseInt(totals.completedMap[atom], 10) || 0);
                if (qty > 0) available.set(clean(atom), qty);
            });
            return available;
        }

        const effectiveCompleted = getEffectiveInvenboardCompletedSource(completedUnits);
        getInvenboardAtoms().forEach(atom => {
            const id = clean(atom);
            const qty = Math.max(0, parseInt(effectiveCompleted.get(id), 10) || 0);
            if (qty > 0) available.set(id, qty);
        });
        return available;
    }

    function getCompletedRecipeProgress(uid, qty) {
        const unit = unitMap.get(uid);
        if (!unit?.parsedRecipe?.length) return { hasRecipe: false, hasAnyCompleted: false, hasEnoughCompleted: false };
        let hasAnyCompleted = false;
        const hasEnoughCompleted = unit.parsedRecipe.every(child => {
            if (!child.id) return true;
            const needQty = (isToolRequirement(uid, child.id) ? 1 : child.qty) * qty;
            const completedQty = Math.max(0, parseInt(completedUnits.get(child.id), 10) || 0);
            if (completedQty > 0) hasAnyCompleted = true;
            return completedQty >= needQty;
        });
        return { hasRecipe: true, hasAnyCompleted, hasEnoughCompleted };
    }

    function getBoardDependencyDepths(source = activeUnits) {
        const depths = new Map();
        const visit = (uid, depth, path = new Set()) => {
            if (!uid || path.has(uid)) return;
            if ((depths.get(uid) || -1) < depth) depths.set(uid, depth);
            const unit = unitMap.get(uid);
            if (!unit) return;
            path.add(uid);
            unit.parsedRecipe?.forEach(child => child.id && visit(child.id, depth + 1, path));
            getToolNeed(uid).forEach(toolId => visit(toolId, depth + 1, path));
            path.delete(uid);
        };
        (source instanceof Map ? source : activeUnits).forEach((_, uid) => visit(uid, 0));
        return depths;
    }

    function getInvenboardMaterialCompletionCandidates(baseMap) {
        const depths = getBoardDependencyDepths();
        return [...baseMap.entries()]
            .filter(([uid, qty]) =>
                qty > 0 &&
                unitMap.has(uid) &&
                !activeUnits.has(uid) &&
                !completedTargets.has(uid) &&
                !ALL_INVENBOARD_SLOT_SET.has(uid) &&
                (depths.get(uid) || 0) > 0
            )
            .map(([uid, qty]) => ({
                unit: unitMap.get(uid),
                qty,
                depth: depths.get(uid) || 0
            }))
            .sort((a, b) =>
                b.depth - a.depth ||
                getGradeIndex(a.unit.grade) - getGradeIndex(b.unit.grade) ||
                a.unit.name.localeCompare(b.unit.name)
            );
    }

    function addCompletedMaterialUnit(uid, qty, { trackInvenboard = false } = {}) {
        const amount = Math.max(0, parseInt(qty, 10) || 0);
        if (amount <= 0) return;
        completedUnits.set(uid, Math.max(0, completedUnits.get(uid) || 0) + amount);
        if (trackInvenboard) addInvenboardAutoCompletedUnit(uid, amount);
    }

    function getDirectInvenboardReadyQty(uid, maxQty, available = getInvenboardOwnedAtomMap({ directOnly: true })) {
        const limit = Math.max(0, parseInt(maxQty, 10) || 0);
        if (limit <= 0) return 0;
        const perUnitNeed = getDirectInvenboardAtomNeed(uid, 1);
        if (perUnitNeed.size === 0) return 0;
        let readyQty = limit;
        perUnitNeed.forEach((amount, id) => {
            const need = Math.max(1, parseInt(amount, 10) || 1);
            readyQty = Math.min(readyQty, Math.floor((available.get(id) || 0) / need));
        });
        return Math.max(0, readyQty);
    }

    function consumeAvailableInvenboardAtoms(available, uid, qty) {
        const amount = Math.max(0, parseInt(qty, 10) || 0);
        if (amount <= 0) return;
        getDirectInvenboardAtomNeed(uid, 1).forEach((needQty, id) => {
            const usedQty = Math.max(0, parseInt(needQty, 10) || 0) * amount;
            const remain = Math.max(0, (available.get(id) || 0) - usedQty);
            if (remain > 0) available.set(id, remain);
            else available.delete(id);
        });
    }

    function completeInvenboardMaterialUnitsIfReady() {
        const candidates = getInvenboardMaterialCompletionCandidates(calculateBoardRequirements().baseMap);
        if (!candidates.length) return false;
        let changed = false;
        const available = getInvenboardOwnedAtomMap({ directOnly: true });

        for (const { unit, qty: requiredQty } of candidates) {
            const uid = unit.id;
            const currentCompleted = Math.max(0, parseInt(completedUnits.get(uid), 10) || 0);
            const remainingQty = Math.max(0, requiredQty - currentCompleted);
            if (remainingQty <= 0) continue;

            if (isInvenboardInstantCompleteUnit(uid)) {
                addCompletedMaterialUnit(uid, remainingQty, { trackInvenboard: true });
                changed = true;
                continue;
            }

            const recipeReadyQty = getCompletedRecipeReadyQty(uid, remainingQty);
            if (recipeReadyQty > 0) {
                deleteCompletedRecipe(uid, recipeReadyQty);
                addCompletedMaterialUnit(uid, recipeReadyQty, { trackInvenboard: true });
                changed = true;
                continue;
            }

            const recipeProgress = getCompletedRecipeProgress(uid, 1);
            if (recipeProgress.hasAnyCompleted) continue;
            const directReadyQty = getDirectInvenboardReadyQty(uid, remainingQty, available);
            if (directReadyQty <= 0) continue;
            resetInvenboardOwnedForUnit(uid, directReadyQty);
            consumeAvailableInvenboardAtoms(available, uid, directReadyQty);
            addCompletedMaterialUnit(uid, directReadyQty, { trackInvenboard: true });
            changed = true;
        }
        return changed;
    }

    function completeInvenboardTargetsIfReady() {
        if (_currentViewMode !== 'invenboard' || activeUnits.size === 0) return false;

        let changed = completeInvenboardMaterialUnitsIfReady();
        const available = getInvenboardOwnedAtomMap({ directOnly: true });
        const targets = getUnitsFromMap(activeUnits);
        targets.forEach(unit => {
            const uid = unit.id;
            if (!activeUnits.has(uid)) return;
            const activeQty = activeUnits.get(uid) || 1;
            const recipeReadyQty = getCompletedRecipeReadyQty(uid, activeQty);
            const directReadyQty = getDirectInvenboardReadyQty(uid, activeQty, available);
            const hasAutoCompletedCostOnly = unit.parsedCost?.length && unit.parsedCost.every(pc => AUTO_COST_SLOT_SET.has(pc.key) && !COSTBOARD_ATOM_ID_SET.has(pc.key));
            const completeInstantly = isInvenboardInstantCompleteUnit(uid);
            const completeWithRecipe = recipeReadyQty >= activeQty;
            const completeWithDirectAtoms = completeInstantly || (!getCompletedRecipeProgress(uid, 1).hasAnyCompleted && (directReadyQty >= activeQty || (hasAutoCompletedCostOnly && getDirectInvenboardAtomNeed(uid, 1).size === 0)));
            if (!completeWithRecipe && !completeWithDirectAtoms) return;

            if (completeWithRecipe) {
                deleteCompletedRecipe(uid, activeQty);
            } else if (!completeInstantly) {
                resetInvenboardOwnedForUnit(uid, activeQty);
                consumeAvailableInvenboardAtoms(available, uid, activeQty);
            }
            completedTargets.set(uid, activeQty);
            activeUnits.delete(uid);
            pausedUnits.delete(uid);
            completedUnits.delete(uid);
            _invenboardAutoCompletedUnits.delete(uid);
            changed = true;
        });

        if (!changed) return false;
        _currentHighlight = null;
        return true;
    }

    function getCompletedRecipeReadyQty(uid, maxQty = 1) {
        const unit = unitMap.get(uid);
        const limit = Math.max(0, parseInt(maxQty, 10) || 0);
        if (limit <= 0 || !unit?.parsedRecipe?.length) return 0;

        let readyQty = limit;
        let hasRequirement = false;
        unit.parsedRecipe.forEach(child => {
            if (!child.id) return;
            const perUnitNeed = Math.max(1, parseInt(isToolRequirement(uid, child.id) ? 1 : child.qty, 10) || 1);
            const completedQty = Math.max(0, parseInt(completedUnits.get(child.id), 10) || 0);
            readyQty = Math.min(readyQty, Math.floor(completedQty / perUnitNeed));
            hasRequirement = true;
        });
        return hasRequirement ? Math.max(0, readyQty) : 0;
    }

    function getHiddenboardRecipeCompletionCandidates(baseMap) {
        const depths = getBoardDependencyDepths();
        const candidates = new Map();

        const addCandidate = (uid, qty) => {
            const requiredQty = Math.max(0, parseInt(qty, 10) || 0);
            if (requiredQty <= 0 || !unitMap.has(uid) || completedTargets.has(uid)) return;
            const depth = depths.has(uid) ? depths.get(uid) : (activeUnits.has(uid) ? 0 : -1);
            if (depth < 0) return;
            candidates.set(uid, { unit: unitMap.get(uid), qty: requiredQty, depth });
        };

        baseMap.forEach((qty, uid) => addCandidate(uid, qty));
        activeUnits.forEach((qty, uid) => addCandidate(uid, qty));

        return [...candidates.values()].sort((a, b) =>
            b.depth - a.depth ||
            getGradeIndex(a.unit.grade) - getGradeIndex(b.unit.grade) ||
            a.unit.name.localeCompare(b.unit.name)
        );
    }

    function completeHiddenboardRecipeUnitsIfReady() {
        if (_currentViewMode !== 'hiddenboard' || activeUnits.size === 0) return false;

        let changed = false;
        for (let pass = 0; pass < APP_INTERNAL.maxAutoCompletePasses && activeUnits.size > 0; pass++) {
            const activeSizeBefore = activeUnits.size;
            const { baseMap } = calculateBoardRequirements();
            const candidates = getHiddenboardRecipeCompletionCandidates(baseMap);
            let completedThisPass = false;

            for (const { unit, qty: requiredQty } of candidates) {
                const uid = unit.id;
                const currentCompleted = Math.max(0, parseInt(completedUnits.get(uid), 10) || 0);
                const targetQty = activeUnits.has(uid) ? (activeUnits.get(uid) || 1) : requiredQty;
                const remainingQty = Math.max(0, targetQty - currentCompleted);
                if (remainingQty <= 0) continue;

                const readyQty = getCompletedRecipeReadyQty(uid, remainingQty);
                if (readyQty <= 0) continue;

                deleteCompletedRecipe(uid, readyQty);
                if (activeUnits.has(uid)) {
                    const activeQty = activeUnits.get(uid) || 1;
                    const nextCompleted = currentCompleted + readyQty;
                    if (nextCompleted >= activeQty) {
                        completedTargets.set(uid, activeQty);
                        activeUnits.delete(uid);
                        pausedUnits.delete(uid);
                        completedUnits.delete(uid);
                        _invenboardAutoCompletedUnits.delete(uid);
                    } else {
                        completedUnits.set(uid, nextCompleted);
                    }
                } else {
                    addCompletedMaterialUnit(uid, readyQty);
                }

                completedThisPass = changed = true;
                if (activeUnits.size !== activeSizeBefore) break;
            }

            if (!completedThisPass || activeUnits.size === activeSizeBefore) break;
        }

        if (!changed) return false;
        _currentHighlight = null;
        return true;
    }

    function setInvenboardAmount(id, qty, options = {}) {
        const cleanId = normalizeSavedId(id);
        if (!getInvenboardSlotIdSet().has(cleanId)) return;
        const totals = calculateInvenboardCostboardTotals();
        const maxQty = getInvenboardMaxQty(cleanId, totals);
        const rawQty = normalizeInvenboardAmount(qty, Number.MAX_SAFE_INTEGER);
        const nextQty = normalizeInvenboardAmount(rawQty, maxQty);
        if (nextQty > 0) completedUnits.set(cleanId, nextQty);
        else completedUnits.delete(cleanId);
        if (options.preserveOverflow && rawQty > nextQty && maxQty > 0) _invenboardManualInputs.set(cleanId, rawQty);
        else _invenboardManualInputs.delete(cleanId);
        completeInvenboardTargetsIfReady();
        commitNexusStateChange();
    }

    function changeInvenboardAmount(id, delta) {
        const cleanId = normalizeSavedId(id);
        if (!getInvenboardSlotIdSet().has(cleanId)) return;
        const currentQty = completedUnits.get(cleanId) || 0;
        setInvenboardAmount(cleanId, currentQty + (parseInt(delta, 10) || 0));
    }

    function toggleInvenboardInputMode() {
        _invenboardInputMode = _invenboardInputMode === 'manual' ? 'auto' : 'manual';
        updateInvenboard();
    }

    function resetInvenboardAmounts() {
        let changed = false;
        ALL_INVENBOARD_SLOT_SET.forEach(id => {
            if (completedUnits.has(id)) {
                completedUnits.delete(id);
                changed = true;
            }
        });

        if (resetInvenboardAutoCompletedUnits()) changed = true;
        if (clearInvenboardManualInputs()) changed = true;

        const completedTargetEntries = Array.from(completedTargets.entries());
        if (completedTargetEntries.length > 0) {
            completedTargets.clear();
            completedTargetEntries.forEach(([uid, qty]) => {
                if (!unitMap.has(uid)) return;
                const restoreQty = qty || 1;
                completedUnits.delete(uid);
                setActiveUnitQty(uid, restoreQty);
            });
            changed = true;
        }

        if (!changed) return;
        commitNexusStateChange({ clearHighlight: true });
    }

    function completeAllInvenboardUnits() {
        if (_currentViewMode !== 'invenboard' || activeUnits.size === 0) return;
        const totals = calculateInvenboardCostboardTotals();
        ALL_INVENBOARD_SLOT_SET.forEach(id => completedUnits.delete(id));
        clearInvenboardManualInputs();
        getInvenboardAtoms().forEach(atom => {
            const qty = Math.max(0, parseInt(totals.targetMap[atom], 10) || 0);
            if (qty > 0) completedUnits.set(clean(atom), qty);
        });
        const targets = Array.from(activeUnits.entries()).filter(([uid]) => unitMap.has(uid));
        if (targets.length === 0) return;
        targets.forEach(([uid, qty]) => {
            completedTargets.set(uid, normalizeUnitQty(uid, qty) || 1);
            activeUnits.delete(uid);
            pausedUnits.delete(uid);
        });
        commitNexusStateChange({ clearHighlight: true });
    }

    function updateInvenboard(costboardTotals = null) {
        if (!_isInvenboardRendered) return;
        const boardEl = getEl('boardContent');
        if (!boardEl) return;
        boardEl.classList.add('invenboard-mode');
        const totals = costboardTotals || calculateInvenboardCostboardTotals();
        const isManual = _invenboardInputMode === 'manual';

        getInvenboardAtoms().forEach(atom => {
            const id = clean(atom);
            const needQty = Math.max(0, totals.targetMap[atom] || 0);
            const directRawQty = Math.max(0, parseInt(completedUnits.get(id), 10) || 0);
            const directOwnedQty = Math.min(directRawQty, needQty);
            const manualInputQty = Math.max(0, parseInt(_invenboardManualInputs.get(id), 10) || 0);
            const shownInputQty = Math.max(manualInputQty, directRawQty);
            const ownedQty = Math.max(directOwnedQty, Math.max(0, parseInt(totals.completedMap[atom], 10) || 0));
            const isOverLimit = isManual && needQty > 0 && shownInputQty > needQty;
            const remainQty = Math.max(0, needQty - Math.min(ownedQty, needQty));
            const item = getEl(`invenboard-${id}`);
            if (!item) return;
            item.classList.toggle('active', needQty > 0 || ownedQty > 0);
            item.classList.toggle('is-disabled', needQty <= 0 && ownedQty <= 0);
            item.classList.toggle('is-completed', ownedQty > 0 && remainQty === 0);
            item.classList.toggle('is-manual', isManual);
            item.classList.toggle('is-over-limit', isOverLimit);

            const countEl = getEl(`inven-owned-${id}`);
            const input = getEl(`inven-input-${id}`);
            const tapBtn = item.querySelector('.invenboard-tap');
            const plusBtns = item.querySelectorAll('.invenboard-plus');
            const plus10 = item.querySelector('.invenboard-plus10');

            if (countEl) {
                countEl.textContent = String(ownedQty);
            }
            if (input) {
                const displayQty = isManual ? shownInputQty : ownedQty;
                if (document.activeElement !== input) input.value = String(displayQty);
                input.max = String(Math.max(0, needQty));
                input.readOnly = !isManual || needQty <= 0;
                input.disabled = !isManual || (needQty <= 0 && ownedQty <= 0);
                input.tabIndex = isManual && needQty > 0 ? 0 : -1;
                input.classList.toggle('is-over-limit', isOverLimit);
                input.title = isOverLimit ? `필요량 ${needQty} 초과: 계산에는 ${needQty}까지만 반영됩니다.` : '';
                input.setAttribute('aria-invalid', isOverLimit ? 'true' : 'false');
            }
            if (tapBtn) tapBtn.disabled = isManual || needQty <= 0 || remainQty <= 0;
            plusBtns.forEach(btn => { btn.disabled = needQty <= 0 || remainQty <= 0; });
            if (plus10) plus10.disabled = needQty <= 0 || remainQty < 10;
        });

        document.querySelectorAll('.invenboard-slot').forEach(slot => {
            const hasActive = !!slot.querySelector('.invenboard-item.active');
            slot.classList.toggle('active', hasActive);
            slot.classList.toggle('has-active', hasActive);
        });

        const modeBtn = getEl('invenboardInputModeBtn');
        if (modeBtn) {
            modeBtn.textContent = isManual ? '자동입력 전환' : '수동입력 전환';
            modeBtn.classList.toggle('is-manual', isManual);
        }
        updateInvenboardSlotModeButton();
        const completeAllBtn = getEl('invenboardCompleteAllBtn');
        if (completeAllBtn) completeAllBtn.disabled = activeUnits.size === 0;
        const empty = getEl('invenboardEmpty');
        if (empty) {
            const isEmpty = activeUnits.size === 0 && completedTargets.size === 0;
            empty.style.display = isEmpty ? 'block' : 'none';
            if (isEmpty) empty.innerHTML = `<div class="empty-msg-enhanced"><div class="empty-main">유닛도감에서 유닛을 선택하세요</div></div>`;
        }
    }

    function updateBoardPanel(calcResult, costboardTotals = null) {
        updateBoardHeader();
        let autoCompleted = false;
        if (_currentViewMode === 'hiddenboard') {
            if (!_isHiddenboardRendered) renderHiddenboard();
            if (!_isHiddenboardRendered) return autoCompleted;
            if (completeHiddenboardRecipeUnitsIfReady()) {
                calcResult = calculateBoardRequirements();
                autoCompleted = true;
            }
            updateHiddenboard(calcResult || _lastCalcResult || calculateBoardRequirements());
            updateEmptyMsg();
            return autoCompleted;
        }
        if (_currentViewMode === 'invenboard') {
            if (!_isInvenboardRendered) renderInvenboard();
            if (completeInvenboardTargetsIfReady()) {
                calcResult = calculateBoardRequirements();
                costboardTotals = null;
                autoCompleted = true;
            }
            updateInvenboard(costboardTotals);
        }
        return autoCompleted;
    }

    function refreshPanelsAfterBoardAutoComplete() {
        const calcResult = calculateBoardRequirements();
        _lastCalcResult = calcResult;
        updateCostboard(calculateCostboardAtomTotals());
        updateTabsUI();
        updateTabContentUI();
        updateCartUI();
        updatePresetBtns();
        saveNexusState();
    }

    function ensureActiveBoardRendered(calcResult) {
        return updateBoardPanel(calcResult || _lastCalcResult || calculateBoardRequirements());
    }

    function wrapHiddenboardGridPages(grid, pageSize) {
        if (!grid) return;
        const items = Array.from(grid.children).filter(el =>
            el.classList.contains('hiddenboard-slot')
        );
        if (items.length === 0) return;
        const size = Math.max(1, pageSize || items.length);
        const frag = document.createDocumentFragment();
        for (let i = 0; i < items.length; i += size) {
            const page = document.createElement('div');
            page.className = 'hiddenboard-page';
            items.slice(i, i + size).forEach(el => page.appendChild(el));
            frag.appendChild(page);
        }
        grid.appendChild(frag);
    }

    function updateHiddenboard(calcResult) {
        if (!_isHiddenboardRendered) return;
        const { reqMap, baseMap, reasonMap } = calcResult || calculateBoardRequirements();
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
        const getReasonTagClass = (info) => info?.depth === 0 ? 'tag-target' : (info?.tagClass || DEFAULT_REASON_TAG_CLASS);
        const isSplitReason = (info) => info?.depth !== 0 && !!info?.reasonCenterHtml;
        const renderReasonTagContent = (info) => {
            if (!isSplitReason(info)) {
                const qtyText = info?.depth !== 0 && info?.displayQty > 0 ? ` <span class="d-reason-qty">· ${info.displayQty} 개</span>` : '';
                return `${info.text}${qtyText}`;
            }
            return [
                `<span class="d-reason-grade">${escapeHtml(info.reasonGrade || '')}</span>`,
                `<span class="d-reason-main">${info.reasonCenterHtml}</span>`,
                `<span class="d-reason-qty">${info.displayQty} 개</span>`
            ].join('');
        };
        
        const targetHighlight = _currentHighlight || null;
        const highlightDeps = targetHighlight ? getDependencies(targetHighlight) : null;
        
        activeUnits.forEach((_, uid) => unitMap.get(uid)?.parsedRecipe?.forEach(pr => pr.id && activeUnits.has(pr.id) && mergedSlots.add(pr.id)));
        const directMaterials = new Set();
        activeUnits.forEach((_, uid) => { if (mergedSlots.has(uid)) return; unitMap.get(uid)?.parsedRecipe?.forEach(pr => pr.id && !activeUnits.has(pr.id) && directMaterials.add(pr.id)); });
        const excludeGridIds = (() => { try { return JSON.parse(getEl('boardContent')?.dataset.excludeGridIds || '[]'); } catch(e) { return []; } })();
        const pool = getEl('hiddenboard-slot-pool');
        
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

        _hiddenboardSlotElsByUid.forEach(el => {
            el.style.display = 'none'; el.classList.remove('is-visible','has-target','is-completed','highlighted-tree');
            if (pool && el.parentElement !== pool) pool.appendChild(el);
        });
        getEl('boardContent')?.querySelectorAll('.hiddenboard-page').forEach(el => el.remove());
        const gridFragments = new Map(Object.values(grids).filter(Boolean).map(grid => [grid, document.createDocumentFragment()]));
        const reasonEntriesCache = new Map();
        const getCachedReasonEntries = (slotId, rMap) => {
            if (!reasonEntriesCache.has(slotId)) reasonEntriesCache.set(slotId, getReasonDisplayEntries(slotId, rMap));
            return reasonEntriesCache.get(slotId);
        };

        const visibleMaterialIds = new Set([...baseMap.keys(), ...reqMap.keys()]);

        const processSlot = (id) => {
            const slotEl = _hiddenboardSlotElsByUid.get(id); if (!slotEl) return null;
            
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
                    let allEntries = getCachedReasonEntries(id, rMap).slice();
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
                        let sorted = allEntries.sort((a, b) =>
                            (a[1].depth || 0) - (b[1].depth || 0) ||
                            (a[1].reasonGradeRank ?? REASON_GRADE_ORDER.length) - (b[1].reasonGradeRank ?? REASON_GRADE_ORDER.length) ||
                            (a[1]._reasonOrder || 0) - (b[1]._reasonOrder || 0)
                        );
                        rCon.style.display = 'flex';
                        rCon.classList.toggle('is-target-only', sorted.every(([, i]) => i.depth === 0));
                        rCon.innerHTML = sorted.map(([rId,i]) => {
                            const splitTagClass = isSplitReason(i) ? ' is-split-reason' : '';
                            return `<span class="d-reason-tag ${getReasonTagClass(i)}${splitTagClass}" data-action="toggleHighlight" data-uid="${rId.replace(/^(TARGET_|MAT_|TOOL_|AUTO_)/,'')}">${renderReasonTagContent(i)}</span>`;
                        }).join('');
                    } else {
                        rCon.style.display = 'none';
                        rCon.classList.remove('is-target-only');
                        rCon.innerHTML = '';
                    }
                } else { rCon.style.display='none'; rCon.classList.remove('is-target-only'); rCon.innerHTML=''; }
            }

            const cEl = slotEl.querySelector(`#d-cond-${id}`);
            if (cEl) {
                let rMap = reasonMap.get(id);
                let condMap = new Map();

                if (rMap) {
                    getCachedReasonEntries(id, rMap).forEach(([, info]) => {
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
            else if (isBasicHiddenboardGrade(uGrade)) nativeGrid = grids.basicHidden;
            tGrid = upgradedGrid || nativeGrid;
            if (!tGrid) return null;

            const gridId = tGrid?.id || '';
            _unitRestoreLevels.set(id, restoreLevelsByGridId[gridId] || 0);
            const keepCompletedVisible = excludeGridIds.includes(gridId);
            const hideT = _hideCompleted && isCompleted && !keepCompletedVisible;
            if (tGrid) {
                if (!hideT) {
                    slotEl.classList.add('is-visible');
                } else {
                    slotEl.classList.remove('is-visible');
                }
                slotEl.style.display = hideT ? 'none' : 'flex';
                (gridFragments.get(tGrid) || tGrid).appendChild(slotEl);
            }

            
            return tGrid;
        };

        getUnitsFromIds(activeUnits.keys()).sort(compareUnitByHiddenboardPriority).forEach(u => processSlot(u.id));
        getUnitsFromIds(completedTargets.keys()).sort(compareUnitByGradeName).forEach(u => processSlot(u.id));

        getUnitsFromIds(Array.from(visibleMaterialIds)
            .filter(uid => !AUTO_COST_SLOT_SET.has(uid) && !activeUnits.has(uid) && !completedTargets.has(uid)))
            .sort(compareUnitByHiddenboardPriority)
            .forEach(u => processSlot(u.id));

        gridFragments.forEach((frag, grid) => { if (frag.childNodes.length > 0) grid.appendChild(frag); });

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

        Object.values(grids).forEach(g => wrapHiddenboardGridPages(g, 9));

        Object.values(grids).forEach(g => {
            if (!g) return;
            const grp = g.closest('.hiddenboard-group'), icon = grp?.querySelector('.grp-toggle-icon');
            if (!grp) return;
            
            grp.style.display = 'block';
            
            const slots = Array.from(g.querySelectorAll('.hiddenboard-slot'));
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

        _hiddenboardSlotElsByUid.forEach((el, cleanId) => {
            el.classList.toggle('highlighted-tree', !!_currentHighlight && highlightDeps?.has(cleanId));
        });
    }

    function updateEmptyMsg() {
        const msg = getEl('hiddenboard-empty-msg');
        if (!msg) return;
        const isEmpty = activeUnits.size === 0 && completedTargets.size === 0;
        if (isEmpty) {
            msg.style.display = 'block';
            msg.innerHTML = `<div class="empty-msg-enhanced"><div class="empty-main">유닛도감에서 유닛을 선택하세요</div></div>`;
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
        const board = getEl('boardContent'); if (!board) return;

        if (!uid || _currentHighlight === uid) {
            _currentHighlight = null;
            board.classList.remove('highlight-mode');
        } else {
            _currentHighlight = uid;
            board.classList.add('highlight-mode');
        }
        
        debouncedUpdateAllPanels();
    }


    /* 도감·탭·즐겨찾기·프리셋 */
    function renderTabs() {
        const t = getEl('unitboardTabs');
        if (t) { t.innerHTML = SYSTEM_CONFIG.tabs.map((c, i) => `<button type="button" id="tab-btn-${i}" role="tab" aria-selected="${i===_activeTabIdx}" class="tab-btn" data-action="selectTab" data-tab-idx="${i}"><span>${c.name}</span></button>`).join(''); updateTabsUI(); }
    }

    function updateTabsUI() {
        let aCats = new Set([...activeUnits.keys()].map(id => unitMap.get(id)?.category).filter(Boolean));
        SYSTEM_CONFIG.tabs.forEach((c, i) => {
            let btn = getEl(`tab-btn-${i}`), isActive = (i === _activeTabIdx), has = aCats.has(c.key);
            if (!btn) return;
            if (btn.classList.contains('active') !== isActive) { btn.classList.toggle('active', isActive); btn.setAttribute('aria-selected', isActive ? 'true' : 'false'); }
            if (btn.classList.contains('has-active') !== has) btn.classList.toggle('has-active', has);
        });
        const selectAllBtn = getEl('btnSelectAllTab'), currentTab = SYSTEM_CONFIG.tabs[_activeTabIdx];
        if (selectAllBtn && currentTab) {
            selectAllBtn.disabled = false;
            const catItems = Array.from(unitMap.values()).filter(u => u.category === currentTab.key && isSelectableUnitboardUnit(u));
            selectAllBtn.innerHTML = (catItems.length > 0 && catItems.every(item => activeUnits.has(item.id))) ? `<span class="btn-select-all-clear-label">✖ ${currentTab.name} 해제</span>` : `✔ ${currentTab.name} 선택`;
        }
    }

    function starBtnHtml(id) {
        const isFav = _favorites.has(id);
        return `<button type="button" class="uc-fav-btn${isFav ? ' is-fav' : ''}" data-action="toggleFavorite" data-uid="${id}" aria-label="즐겨찾기">${isFav ? '★' : '☆'}</button>`;
    }

    function buildCardControl(item, prefix, isRestricted, isOT) {
        if (!isOT && !isRestricted) {
            return `<div class="uc-ctrl-area"><div class="smart-stepper active-stepper" id="stepper-${prefix}${item.id}"><button type="button" data-action="smartChange" data-uid="${item.id}" data-delta="-1" aria-label="${item.name} 감소">-</button><div class="ss-val" id="val-unit-${prefix}${item.id}" aria-live="polite">-</div><button type="button" data-action="smartChange" data-uid="${item.id}" data-delta="1" aria-label="${item.name} 추가">+</button></div></div>`;
        }
        return `<div class="uc-ctrl-area uc-ctrl-area-reserved" aria-hidden="true"><div class="smart-stepper smart-stepper-placeholder"><button type="button" disabled>-</button><div class="ss-val">-</div><button type="button" disabled>+</button></div></div>`;
    }

    function getUnitEssenceParts(item) {
        if (!item?.id) return [];
        if (_unitEssencePartsCache.has(item.id)) return _unitEssencePartsCache.get(item.id);
        const counts = getEssenceCount(new Map([[item.id, 1]]));
        const hybrid = Math.max(0, counts['혼종'] || 0);
        const parts = [
            ['coral', '코랄', Math.max(0, (counts['코랄'] || 0) + hybrid)],
            ['aiur', '아이어', Math.max(0, (counts['아이어'] || 0) + hybrid)],
            ['zerus', '제루스', Math.max(0, (counts['제루스'] || 0) + hybrid)]
        ].filter(([, , value]) => value > 0);
        _unitEssencePartsCache.set(item.id, parts);
        return parts;
    }

    function getUnitUnitboardEssenceText(item) {
        const parts = getUnitEssenceParts(item);
        if (!parts.length) return '';
        return `<div class="uc-essence-summary" aria-label="${item.name} 정수정보">${parts.map(([id, name, value]) => `<span class="uc-essence-chip uc-essence-${id}"><span class="uc-essence-label">${name}</span><span class="uc-essence-value">${value}</span></span>`).join('')}</div>`;
    }

    function buildCard(item, idx, prefix, showRecipe) {
        const isRestricted = isRestrictedUnit(item.id), isOT = isOneTime(item), isFav = _favorites.has(item.id);
        const isPrimaryUnit = CLEAN_PRIMARY_UNIT_IDS.has(item.id);
        const essenceText = getUnitUnitboardEssenceText(item);
        return `<div id="card-${prefix}${item.id}" class="unit-card${isRestricted ? ' is-excluded' : ''}${isFav ? ' is-fav-card' : ''}${showRecipe ? '' : ' no-recipe'}" data-grade="${item.grade}" style="${idx >= 0 ? `animation-delay:${idx*0.02}s;` : ''}${isRestricted ? 'pointer-events:auto;cursor:not-allowed;' : ''}" data-action="toggleUnit" data-uid="${item.id}">` +
            `<div class="uc-card-inner">` +
            `${starBtnHtml(item.id)}` +
            `<div class="uc-head${showRecipe ? '' : ' uc-head-slim'}">` +
            `<div class="uc-meta-row"><span class="gtag grade-${item.grade}">${item.grade}</span>${isPrimaryUnit ? '<span class="badge-primary-unit">주력</span>' : ''}</div>` +
            `<div class="uc-name-row" ${getUnitNameStyle(item)}>${item.name}</div>` +
            `${essenceText ? `<div class="uc-essence-row">${essenceText}</div>` : ''}` +
            `${isRestricted ? `<span class="badge-excluded" data-action="showExcludedTooltip" data-uid="${item.id}">선택제한</span>` : ''}` +
            `</div>` +
            `${showRecipe ? `<div class="uc-recipe-area">${formatRecipe(item, 1, false)}</div>` : ''}` +
            `${showRecipe && CLEAN_UNIT_CONDITIONS[item.id] ? `<div class="tsc-wrap tsc-wrap-card"><div class="tsc-item">${CLEAN_UNIT_CONDITIONS[item.id]}</div></div>` : ''}` +
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

    function getUnitboardSort(a, b) {
        return (SYSTEM_CONFIG.sorting.order[b.name] || 0) - (SYSTEM_CONFIG.sorting.order[a.name] || 0) ||
            (isOneTime(a) ? -1 : isOneTime(b) ? 1 : 0) ||
            getGradeIndex(b.grade) - getGradeIndex(a.grade) ||
            calculateTotalCostScore(b) - calculateTotalCostScore(a) ||
            a.name.localeCompare(b.name);
    }

    function getUnitboardVisibleItems() {
        return Array.from(unitMap.values()).filter(isUnitboardVisibleUnit);
    }

    function getFavoriteItems() {
        return getUnitboardVisibleItems().filter(u => _favorites.has(u.id)).sort(getUnitboardSort);
    }

    function buildFavoriteSection(categoryKey) {
        const favItems = getFavoriteItems();
        if (favItems.length > 0) {
            return `<div class="unitboard-fav-section">` +
                `<div class="unitboard-fav-header"><span class="unitboard-fav-title">⭐ 즐겨찾기</span></div>` +
                `<div class="unitboard-fav-grid">${buildPagerPages(favItems.map((item, idx) => buildFavCard(item, idx, categoryKey)), 3, 'unitboard-page unitboard-fav-page')}</div>` +
                `<div class="unitboard-fav-divider"></div>` +
                `</div>`;
        }
        return `<div class="unitboard-fav-empty">` +
            `<span class="unitboard-fav-empty-star">☆</span>` +
            `<span class="unitboard-fav-empty-text">카드 우측 상단 <b>☆</b>를 누르면 즐겨찾기에 등록됩니다</span>` +
            `</div>`;
    }

    function initAllTabContents() {
        const tc = getEl('tabContent'); if (!tc) return;
        const favSet = new Set(_favorites);
        tc.innerHTML = SYSTEM_CONFIG.tabs.map(cat => {
            const items = Array.from(unitMap.values()).filter(u =>
                isUnitboardVisibleUnit(u) &&
                u.category === cat.key &&
                !favSet.has(u.id)
            ).sort(getUnitboardSort);
            const bodyHtml = !items.length
                ? `<div class="unitboard-empty-msg">즐겨찾기를 제외하고 표시할 유닛이 없습니다.</div>`
                : buildPagerPages(items.map((item, idx) => buildUnitCard(item, idx)), 9, 'unitboard-page unitboard-category-page');
            return `<div id="cat-group-${cat.key}" class="cat-group" role="tabpanel">${buildFavoriteSection(cat.key)}<div class="unitboard-category-grid">${bodyHtml}</div></div>`;
        }).join('');
        _isTabContentInitialized = true;
        indexUnitboardDom();
    }

    function indexUnitboardDom() {
        _unitCardElsByUid.clear(); _favoriteBtnElsByUid.clear();
        document.querySelectorAll('.unit-card[data-uid]').forEach(card => {
            const uid = card.dataset.uid;
            if (!_unitCardElsByUid.has(uid)) _unitCardElsByUid.set(uid, []);
            _unitCardElsByUid.get(uid).push(card); _dirtyUnitCardIds.add(uid);
        });
        document.querySelectorAll('.uc-fav-btn[data-uid]').forEach(btn => {
            const uid = btn.dataset.uid;
            if (!_favoriteBtnElsByUid.has(uid)) _favoriteBtnElsByUid.set(uid, []);
            _favoriteBtnElsByUid.get(uid).push(btn);
        });
        _unitboardDomIndexed = true;
    }

    function renderCurrentTabContent() {
        if (!_isTabContentInitialized) initAllTabContents();
        SYSTEM_CONFIG.tabs.forEach((c, i) => getEl(`cat-group-${c.key}`)?.classList.toggle('is-visible', i === _activeTabIdx));
        updateTabContentUI();
    }

    function updateTabContentUI() {
        if (!_unitboardDomIndexed) indexUnitboardDom();
        const dirtyIds = new Set(_dirtyUnitCardIds);
        _lastUnitboardQtyByUid.forEach((_, uid) => dirtyIds.add(uid));
        activeUnits.forEach((_, uid) => dirtyIds.add(uid));
        completedTargets.forEach((_, uid) => dirtyIds.add(uid));

        dirtyIds.forEach(uid => {
            const item = unitMap.get(uid), isActive = activeUnits.has(uid), isFav = _favorites.has(uid);
            (_unitCardElsByUid.get(uid) || []).forEach(card => {
                if (!item) return;
                if (!isOneTime(item)) {
                    const nv = isActive ? String(activeUnits.get(uid)) : '-';
                    card.querySelectorAll('.ss-val').forEach(v => { if (v.innerText !== nv) v.innerText = nv; });
                    card.querySelectorAll('.smart-stepper button').forEach(b => { b.disabled = !isActive; });
                }
                card.style.display = 'flex';
                card.classList.toggle('active', isActive);
                card.classList.toggle('is-fav-card', isFav);
            });
            (_favoriteBtnElsByUid.get(uid) || []).forEach(btn => {
                btn.classList.toggle('is-fav', isFav);
                btn.textContent = isFav ? '★' : '☆';
                btn.removeAttribute('title');
            });
        });
        _lastUnitboardQtyByUid = new Map([...activeUnits, ...completedTargets]);
        _dirtyUnitCardIds.clear();
    }

    function toggleFavorite(id, event) {
        event?.stopPropagation();
        if (!unitMap.has(id)) return;
        if (_favorites.has(id)) _favorites.delete(id); else _favorites.add(id);
        saveFavorites();
        triggerHaptic();
        _isTabContentInitialized = false;
        _unitboardDomIndexed = false;
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
            return `<button type="button" class="btn-gohaeng" data-action="runPreset" data-preset-idx="${i}" style="${styleStr}">${p.icon ? `<span class="gohaeng-icon">${p.icon}</span>` : ''}<span class="gohaeng-label">${p.label}</span></button>`;
        }).join('');

        wrap.style.display = '';
        updatePresetBtns();
    }

    function updatePresetBtns() {
        syncPresetUsageState();
        SYSTEM_CONFIG.presets.forEach((p, i) => {
            const btn = document.querySelector(`[data-action="runPreset"][data-preset-idx="${i}"]`), used = p.oneTime && _presetUsed.get(i);
            if (btn) { btn.disabled = !!used; btn.classList.toggle('gohaeng-used', !!used); btn.removeAttribute('title'); }
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
        const catItems = Array.from(unitMap.values()).filter(u => u.category === currentTab.key && isSelectableUnitboardUnit(u));
        if (!catItems.length) return;
        if (catItems.every(item => activeUnits.has(item.id))) catItems.forEach(item => activeUnits.delete(item.id));
        else catItems.forEach(item => !activeUnits.has(item.id) && setActiveUnitQty(item.id, pausedUnits.get(item.id) || 1));
        commitNexusStateChange();
    }

    function selectTab(idx) {
        hideRecipeTooltip();
        _activeTabIdx = Math.max(0, Math.min(parseInt(idx, 10) || 0, SYSTEM_CONFIG.tabs.length - 1));
        updateTabsUI();
        renderCurrentTabContent();
    }


    /* 장바구니 */
    function pauseCartUnit(uid) {
        if (!activeUnits.has(uid) || !unitMap.has(uid)) return;
        const qty = activeUnits.get(uid) || 1;
        activeUnits.delete(uid);
        setPositiveMapValue(pausedUnits, uid, qty);
        commitNexusStateChange();
    }

    function discardActiveCartUnit(uid) {
        if (!activeUnits.has(uid)) return;
        removeActiveUnitState(uid);
        commitNexusStateChange();
    }

    function discardPausedCartUnit(uid) {
        if (!pausedUnits.has(uid)) return;
        pausedUnits.delete(uid);
        commitNexusStateChange();
    }

    function discardCompletedCartUnit(uid) {
        if (!removeCompletedTarget(uid)) return;
        commitNexusStateChange();
    }

    function pauseAllActiveUnits() {
        if (activeUnits.size === 0) return;
        const entries = Array.from(activeUnits.entries()).filter(([uid]) => unitMap.has(uid));
        activeUnits.clear();
        entries.forEach(([uid, qty]) => setPositiveMapValue(pausedUnits, uid, qty));
        commitNexusStateChange({ clearHighlight: true });
    }

    function clearCartItems() {
        let changed = false;

        if (_cartTab === 'active') {
            const entries = Array.from(activeUnits.entries());
            if (entries.length === 0) return;
            entries.forEach(([uid, qty]) => removeActiveUnitState(uid, qty));
            changed = true;
        } else if (_cartTab === 'paused') {
            if (pausedUnits.size === 0) return;
            pausedUnits.clear();
            changed = true;
        } else {
            const entries = Array.from(completedTargets.keys());
            if (entries.length === 0) return;
            entries.forEach(uid => { if (removeCompletedTarget(uid)) changed = true; });
        }

        if (!changed) return;
        commitNexusStateChange({ clearHighlight: true });
    }

    function restorePausedUnit(uid) {
        if (!pausedUnits.has(uid) || !unitMap.has(uid)) return;
        const qty = pausedUnits.get(uid) || 1;
        pausedUnits.delete(uid);
        setActiveUnitQty(uid, qty);
        commitNexusStateChange();
    }

    function restoreAllPausedUnits() {
        if (pausedUnits.size === 0) return;
        const entries = Array.from(pausedUnits.entries()).filter(([uid]) => unitMap.has(uid));
        pausedUnits.clear();
        entries.forEach(([uid, qty]) => setActiveUnitQty(uid, qty));
        commitNexusStateChange();
    }

    function restoreAllCompletedUnits() {
        if (completedTargets.size === 0) return;
        const entries = Array.from(completedTargets.keys());
        let changed = false;
        entries.forEach(uid => { if (restoreCompletedTarget(uid)) changed = true; });
        if (!changed) return;
        commitNexusStateChange();
    }

    function getCartTabDefinitions() {
        return [
            { key: 'active', label: '선택', count: activeUnits.size, countClass: '' },
            { key: 'paused', label: '보류', count: pausedUnits.size, countClass: 'paused' },
            { key: 'done', label: '완료', count: completedTargets.size, countClass: 'done' }
        ];
    }

    function getCurrentCartUnitMap() {
        if (_cartTab === 'paused') return pausedUnits;
        if (_cartTab === 'done') return completedTargets;
        return activeUnits;
    }

    function getCartEssenceTotals(sourceMap) {
        const totals = { coral: 0, aiur: 0, zerus: 0 };
        sourceMap?.forEach((rawQty, uid) => {
            const unit = unitMap.get(uid);
            if (!unit) return;
            const qty = Math.max(1, parseInt(rawQty, 10) || 1);
            getUnitEssenceParts(unit).forEach(([partId, , value]) => {
                if (Object.prototype.hasOwnProperty.call(totals, partId)) totals[partId] += value * qty;
            });
        });
        return totals;
    }

    function renderCartEssenceSummary() {
        const summaryEl = getEl('cartEssenceSummary');
        if (!summaryEl) return;
        const totals = getCartEssenceTotals(getCurrentCartUnitMap());
        const parts = [
            ['coral', '코랄', totals.coral],
            ['aiur', '아이어', totals.aiur],
            ['zerus', '제루스', totals.zerus]
        ];
        summaryEl.innerHTML = `<div class="cart-essence-title"><span class="cart-essence-total-label">정수 합계</span></div><div class="cart-essence-chips">${parts.map(([id, name, value]) => `<span class="cart-essence-chip cart-essence-${id}"><span class="cart-essence-label">${name}</span><span class="cart-essence-value">${value}</span></span>`).join('')}</div>`;
    }

    function renderCartPanel(tabBarId, listAreaId, prefix) {
        const cartListArea = getEl(listAreaId); if (!cartListArea) return;
        const tabBar = getEl(tabBarId);
        if (tabBar) {
            tabBar.innerHTML = getCartTabDefinitions().map(tab => `<button type="button" class="cart-tab-btn ${_cartTab === tab.key ? 'active' : ''}" data-action="switchCartTab" data-tab="${tab.key}">${tab.label} <span class="cart-tab-cnt ${tab.countClass}">${tab.count}</span></button>`).join('');
        }

        if (_cartTab === 'active') {
            const actionHtml = `<div class="cart-tab-action-row"><button type="button" class="cart-tab-action-btn cart-active-pause-all-btn" data-action="pauseAllActiveUnits" ${activeUnits.size === 0 ? 'disabled' : ''}>전체 보류</button><button type="button" class="cart-tab-action-btn cart-active-remove-all-btn" data-action="clearCartItems" ${activeUnits.size === 0 ? 'disabled' : ''}>전체 제거</button></div>`;
            if (activeUnits.size === 0) {
                const subText = pausedUnits.size > 0 ? '보류 탭에서 복구하면 다시 계산에 포함됩니다.' : '목표 유닛을 선택하면 여기에 표시됩니다.';
                cartListArea.innerHTML = `${actionHtml}<div class="cart-empty-msg">선택된 유닛이 없습니다.<br><span class="cart-empty-sub">${subText}</span></div>`;
                return;
            }
            const items = getUnitsFromMap(activeUnits);
            cartListArea.innerHTML = actionHtml + items.map(item => {
                const qty = activeUnits.get(item.id) || 1;
                const qtyHtml = !isOneTime(item) ? `<div class="cart-item-stepper"><button type="button" data-action="smartChange" data-uid="${item.id}" data-delta="-1">-</button><span class="ci-val" id="${prefix}-val-${item.id}">${qty}</span><button type="button" data-action="smartChange" data-uid="${item.id}" data-delta="1">+</button></div>` : `<span class="ci-onetime active-qty">×${qty}</span>`;
                return `<div class="cart-item" id="${prefix}-${item.id}"><span class="cart-item-grade"><span class="gtag grade-${item.grade}">${item.grade}</span></span><span class="cart-item-name" ${getUnitNameStyle(item)}>${item.name}</span>${qtyHtml}<button type="button" class="cart-item-pause-btn" data-action="pauseCartItem" data-uid="${item.id}">보류</button><button type="button" class="cart-item-del cart-item-remove" data-action="removeActiveUnit" data-uid="${item.id}">제거</button></div>`;
            }).join('');
            return;
        }

        if (_cartTab === 'paused') {
            const actionHtml = `<div class="cart-tab-action-row"><button type="button" class="cart-tab-action-btn cart-paused-restore-all-btn" data-action="restoreAllPausedUnits" ${pausedUnits.size === 0 ? 'disabled' : ''}>보류 복구</button><button type="button" class="cart-tab-action-btn cart-paused-remove-all-btn" data-action="clearCartItems" ${pausedUnits.size === 0 ? 'disabled' : ''}>전체 제거</button></div>`;
            if (pausedUnits.size === 0) {
                cartListArea.innerHTML = `${actionHtml}<div class="cart-empty-msg">보류된 유닛이 없습니다.<br><span class="cart-empty-sub">선택 탭의 보류 버튼을 누르면 이곳으로 이동됩니다.</span></div>`;
                return;
            }
            cartListArea.innerHTML = actionHtml + getUnitsFromMap(pausedUnits).map(item => `<div class="cart-item cart-item-paused" id="${prefix}p-${item.id}"><span class="cart-item-grade"><span class="gtag grade-${item.grade}">${item.grade}</span></span><span class="cart-item-name paused-name" ${getUnitNameStyle(item)}>${item.name}</span>${!isOneTime(item) ? `<span class="ci-onetime paused-qty">×${pausedUnits.get(item.id) || 1}</span>` : ''}<button type="button" class="cart-done-restore-hint cart-paused-restore-btn always-show" data-action="restorePausedUnit" data-uid="${item.id}">복구</button><button type="button" class="cart-item-del cart-item-remove" data-action="removePausedUnit" data-uid="${item.id}">제거</button></div>`).join('');
            return;
        }

        const actionHtml = `<div class="cart-tab-action-row"><button type="button" class="cart-tab-action-btn cart-done-restore-all-btn" data-action="restoreAllCompletedUnits" ${completedTargets.size === 0 ? 'disabled' : ''}>완료 복구</button><button type="button" class="cart-tab-action-btn cart-done-remove-all-btn" data-action="clearCartItems" ${completedTargets.size === 0 ? 'disabled' : ''}>전체 제거</button></div>`;
        if (completedTargets.size === 0) {
            cartListArea.innerHTML = `${actionHtml}<div class="cart-empty-msg">완료된 유닛이 없습니다.<br><span class="cart-empty-sub">목표 완료 시 이곳으로 이동됩니다.</span></div>`;
            return;
        }
        cartListArea.innerHTML = actionHtml + getUnitsFromMap(completedTargets).map(item => `<div class="cart-item cart-item-done" id="${prefix}d-${item.id}"><span class="cart-item-grade"><span class="gtag grade-${item.grade}">${item.grade}</span></span><span class="cart-item-name done-name" ${getUnitNameStyle(item)}>${item.name}</span><span class="ci-onetime done-qty">×${completedTargets.get(item.id) || 1}</span><button type="button" class="cart-done-restore-hint cart-restore-btn always-show" data-action="restoreUnit" data-uid="${item.id}">복구</button><button type="button" class="cart-item-del cart-item-remove" data-action="removeCompletedUnit" data-uid="${item.id}">제거</button></div>`).join('');
    }

    function updateCartUI() {
        renderCartEssenceSummary();
        renderCartPanel('cartTabBar', 'cartListArea', 'ci');
    }


    /* 화면·입력·툴팁·폰트 */
    function setupInitialView() { switchLayout('unitboard'); }

    function switchLayout(mode) {
        hideRecipeTooltip();
        const layout = getEl('mainLayout');
        if (!layout) return;
        const nextMode = ['unitboard', 'hiddenboard', 'invenboard'].includes(mode) ? mode : 'unitboard';
        _currentViewMode = nextMode;
        layout.classList.remove('view-unitboard', 'view-hiddenboard', 'view-invenboard');
        layout.classList.add(`view-${nextMode}`);

        const buttons = {
            unitboard: getEl('btnViewUnitboard'),
            hiddenboard: getEl('btnViewHiddenboard'),
            invenboard: getEl('btnViewInvenboard')
        };
        Object.entries(buttons).forEach(([key, btn]) => btn?.classList.toggle('active', key === nextMode));

        const autoCompleted = (nextMode === 'hiddenboard' || nextMode === 'invenboard')
            ? ensureActiveBoardRendered(_lastCalcResult)
            : false;
        updateBoardHeader();
        if (autoCompleted) refreshPanelsAfterBoardAutoComplete();
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
        
        const isClickInside = forceInsideClick || isInsideRecipeTooltip(event);
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
        
        const isClickInside = isInsideRecipeTooltip(event);
        
        const parentUnits = []; unitMap.forEach(pu => pu.parsedRecipe?.some(pr => pr.id === id) && parentUnits.push(pu));
        tt.innerHTML = `
            <div class="tooltip-header excluded-tooltip-header">
                <span class="gtag grade-${u.grade}">${u.grade}</span>
                <span class="excluded-tooltip-name" style="--tooltip-grade-color:${SYSTEM_CONFIG.grades.colors[u.grade] || '#fbbf24'};">${u.name}</span>
                <span class="badge-excluded excluded-tooltip-badge">선택제한</span>
            </div>
            <div class="tooltip-body excluded-tooltip-body">
                <div class="excluded-tooltip-description">이 유닛은 아래 상위 유닛의 <strong>조합 재료로 자동 포함</strong>되므로<br>직접 선택할 수 없습니다.</div>
                ${parentUnits.length > 0 ? `
                <div class="excluded-tooltip-parents">
                    ${parentUnits.map(pu => `
                    <div class="excluded-tooltip-parent">
                        <span class="gtag grade-${pu.grade}">${pu.grade}</span>
                        <span class="excluded-tooltip-parent-name" style="--tooltip-grade-color:${SYSTEM_CONFIG.grades.colors[pu.grade] || 'var(--text)'};">${pu.name}</span>
                        <span class="excluded-tooltip-parent-reason">의 기본 재료</span>
                    </div>`).join('')}
                </div>` : ''}
            </div>
            <div class="tooltip-footer">터치/클릭 또는 ESC로 닫힙니다.</div>`;
        showTooltipOverlay(tt, event, APP_INTERNAL.tooltipOffset, APP_INTERNAL.tooltipOffset, isClickInside);
    }

    function showRecipeTooltip(id, event, isHiddenboard = false) {
        event?.stopPropagation(); const u = unitMap.get(id), tt = getEl('recipeTooltip'); if (!u || !tt) return;
        
        const isClickInside = isInsideRecipeTooltip(event);

        let multi = 1;
        if (isHiddenboard) {
            const { reqMap, baseMap, autoCostReq } = _lastCalcResult || calculateBoardRequirements();
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


    /* 이벤트 바인딩 */
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
            const invenInput = e.target?.closest?.('.invenboard-input[data-inven-id]');
            if (invenInput && !invenInput.readOnly && !invenInput.disabled) invenInput.select();
            if (_currentHighlight) toggleHighlight(null);
            if (getEl('recipeTooltip')?.classList.contains('active') && !e.target.closest('#recipeTooltip')) hideRecipeTooltip();
            return;
        }

        const action = actionEl.dataset.action, uid = actionEl.dataset.uid, invenId = actionEl.dataset.invenId;
        switch (action) {
            case 'switchMainView': switchLayout(actionEl.dataset.view); break;
            case 'invenboardAdd':
                if (_invenboardInputMode === 'manual' && e.target?.closest?.('.invenboard-input')) break;
                e.stopPropagation();
                changeInvenboardAmount(invenId, parseInt(actionEl.dataset.delta || '1', 10));
                break;
            case 'toggleInvenboardInputMode': e.stopPropagation(); toggleInvenboardInputMode(); break;
            case 'resetInvenboardAmounts': e.stopPropagation(); resetInvenboardAmounts(); break;
            case 'completeAllInvenboardUnits': e.stopPropagation(); completeAllInvenboardUnits(); break;
            case 'toggleInvenboardSlotMode': e.stopPropagation(); toggleInvenboardSlotMode(); break;
            case 'runPreset':
                const idx = parseInt(actionEl.dataset.presetIdx, 10), preset = SYSTEM_CONFIG.presets[idx];
                if (preset && !(preset.oneTime && _presetUsed.get(idx))) {
                    processCommand(preset.command, true, preset.preventStack === true);
                    if (isEssencePreset(preset) && applyEssencePresetTopLevelFilter()) debouncedUpdateAllPanels();
                    if (preset.oneTime) _presetUsed.set(idx, true);
                    updatePresetBtns();
                }
                break;
            case 'showAppVersion': showNexusAppVersion(); break;
            case 'switchPresetTab': _presetTab = actionEl.dataset.tab; renderPresetButtons(); break;
            case 'toggleHideCompleted':
                _hideCompleted = !_hideCompleted;
                updateHideCompletedBtn();
                debouncedUpdateAllPanels();
                break;
            case 'restoreAllCompleted': restoreAllCompleted(); break;
            case 'resetUnitboard': resetUnitboard(); break;
            case 'selectTab': selectTab(parseInt(actionEl.dataset.tabIdx, 10)); break;
            case 'toggleSelectAllTab': toggleSelectAllTab(); break;
            case 'pauseCartItem': e.stopPropagation(); if (uid) pauseCartUnit(uid); break;
            case 'removeActiveUnit': e.stopPropagation(); if (uid) discardActiveCartUnit(uid); break;
            case 'removePausedUnit': e.stopPropagation(); if (uid) discardPausedCartUnit(uid); break;
            case 'removeCompletedUnit': e.stopPropagation(); if (uid) discardCompletedCartUnit(uid); break;
            case 'pauseAllActiveUnits': e.stopPropagation(); pauseAllActiveUnits(); break;
            case 'restoreAllPausedUnits': e.stopPropagation(); restoreAllPausedUnits(); break;
            case 'restoreAllCompletedUnits': e.stopPropagation(); restoreAllCompletedUnits(); break;
            case 'clearCartItems': e.stopPropagation(); clearCartItems(); break;
            case 'toggleFavorite': toggleFavorite(uid, e); break;
            case 'toggleUnit': toggleUnitSelection(uid, 1); break;
            case 'toggleHighlight': toggleHighlight(uid, e); break;
            case 'toggleGroup':
                const grp = actionEl.closest('.hiddenboard-group'), gridEl = getEl(actionEl.dataset.gridId), icon = actionEl.querySelector('.grp-toggle-icon');
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
            case 'hideRecipeTooltip': e.stopPropagation(); hideRecipeTooltip(); break;
            case 'showRecipeTooltip': e.stopPropagation(); showRecipeTooltip(uid, e, actionEl.dataset.isHiddenboard === 'true'); break;
        }
    });

    document.addEventListener('input', e => {
        const input = e.target?.closest?.('.invenboard-input[data-inven-id]');
        if (!input || _invenboardInputMode !== 'manual') return;
        setInvenboardAmount(input.dataset.invenId, input.value, { preserveOverflow: true });
    });

    document.addEventListener('focusin', e => {
        const input = e.target?.closest?.('.invenboard-input[data-inven-id]');
        if (!input || input.readOnly || input.disabled) return;
        setTimeout(() => input.select(), 0);
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
    window.addEventListener('orientationchange', () => { hideRecipeTooltip(); placeHiddenboardControls(); updateBoardHeader(); });
    window.addEventListener('resize', () => { hideRecipeTooltip(); placeHiddenboardControls(); updateBoardHeader(); });
    /* 앱 초기화 */
    function startNexusApp(){
        try {
            document.documentElement.lang = 'ko';
            if (typeof UNIT_DATABASE === 'undefined' || !Array.isArray(UNIT_DATABASE)) { markNexusAppError("N1003", new Error("UNIT_DATABASE load failed")); return; }
            UNIT_DATABASE.forEach(kArr => unitMap.set(clean(kArr[0]), { id: clean(kArr[0]), name: kArr[0], grade: kArr[1] || SYSTEM_CONFIG.grades.order[0], category: kArr[2] || SYSTEM_CONFIG.tabs[0].key, recipe: kArr[3], cost: kArr[4] }));
            pruneFavorites();

            initializeCacheEngine();
            loadNexusState();
            loadFontScale();
            renderCostboardAtoms();
            renderTabs();
            selectTab(0);
            debouncedUpdateAllPanels();
            setupSearchEngine();
            setupInitialView();
            renderPresetButtons();
            restartNexusTitleRotation();
            updateHideCompletedBtn();
            requestAnimationFrame(() => {
                debouncedUpdateAllPanels();
            });
            const sArea = getEl('tabContent');
            if (sArea) {
                let sX = 0, sY = 0, sPager = null;
                const getSwipePager = target => {
                    const favPager = target?.closest?.('.unitboard-fav-grid');
                    if (favPager) return { el: favPager, type: 'favorite' };
                    const categoryPager = target?.closest?.('.unitboard-category-grid');
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
            const dBoard = getEl('colRightPanel');
            if (dBoard) {
                let dX0 = 0, dY0 = 0, dPager = false;
                dBoard.addEventListener('touchstart', e => {
                    dX0 = e.changedTouches[0].screenX;
                    dY0 = e.changedTouches[0].screenY;
                    dPager = !!e.target?.closest?.('.hiddenboard-grid');
                }, { passive: true });
                dBoard.addEventListener('touchend', e => {
                    const dx = e.changedTouches[0].screenX - dX0, dy = e.changedTouches[0].screenY - dY0;
                    if (Math.abs(dx) > 80 && Math.abs(dy) < 50) {
                        if (dPager) { dPager = false; return; }
                        if (dx > 0) switchLayout('unitboard'); else switchLayout('hiddenboard');
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
