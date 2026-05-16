(() => {
    // --- [시스템 환경 통제 설정 센터] ---
    const SYSTEM_CONFIG = {
        tools: {
            '로리스완': ['낮까마귀']
        },
        specialRenderIds: ['갓오타', '메시브', '자동포탑'],
        specialCostKeys: ['갓오타', '메시브'],
        search: {
            excludeIds: ['데하카고치', '데하카의오른팔'],
            strictMatchTerms: ['아몬', '데하카']
        },
        essence: {
            excludedIds: ['미니성큰']
        },
        guide: {
            defaultUnitId: '비밀작전노바',
            defaultChildId: '타이커스핀들레이'
        },
        sorting: {
            order: { "아몬": 100, "나루드": 97, "유물": 96 }
        },
        policy: {
            oneTimeUnits: ["데하카", "데하카고치", "데하카의오른팔", "유물"],
            hybridWeight: 3,
            maxLoopQueue: 1000,
            maxLoopMerge: 30,
            maxUnitCapacity: 16,
            craftBatch: {
                "자동포탑": 5
            }
        },
        dashboardAtoms: [
            "전쟁광", "스파르타중대", "암흑광전사", "암흑파수기", "원시바퀴", "저격수", "코브라", "암흑고위기사",
            "암흑추적자", "변종가시지옥", "망치경호대", "공성파괴단", "암흑집정관", "암흑불멸자", "원시히드라리스크",
            "땅거미지뢰", "자동포탑", "우르사돈암", "우르사돈수", "갓오타/메시브"
        ],
        aliases: {
            "타이커스":"타이커스핀들레이", "타커":"타이커스핀들레이", "타이":"타이커스핀들레이",
            "닥템":"암흑기사", "닼템":"암흑기사", "다칸":"암흑집정관",
            "스투":"스투코프", "디젯":"메시브", "메십":"메시브", "히페":"히페리온",
            "고전순":"고르곤전투순양함", "특레":"특공대레이너", "드레천":"드라켄레이저천공기",
            "공허":"공허포격기", "분수":"분노수호자", "원히":"원시히드라리스크", "젤나가":"아몬의젤나가피조물"
        },
        parseKeywords: {
            massive: ['메시브', '디제스터'],
            godota: ['갓오타', '갓오브타임'],
            specials: ['땅거미지뢰', '자동포탑', '잠복']
        }
    };

    const isToolRequirement = (parent, child) => SYSTEM_CONFIG.tools[parent]?.includes(child);
    const getToolNeed = (parent) => SYSTEM_CONFIG.tools[parent] || [];
    const isSpecialRender = (id) => SYSTEM_CONFIG.specialRenderIds.includes(id);

    const unitMap = new Map(), activeUnits = new Map(), completedUnits = new Map(), depCache = new Map();
    const getEl = (id) => document.getElementById(id);
    const clean = (s) => s ? s.replace(/\s+/g, '').toLowerCase() : '';

    const IGNORE_PARSE_RECIPES = ["미발견", "없음", ""];

    const CLEANED_DASHBOARD_ATOMS = SYSTEM_CONFIG.dashboardAtoms.map(a => ({ raw: a, clean: clean(a) }));
    const ATOM_HASH = Object.fromEntries(CLEANED_DASHBOARD_ATOMS.map(a => [a.clean, a.raw]));

    const CLEAN_ALIAS_MAP = Object.fromEntries(Object.entries(SYSTEM_CONFIG.aliases).map(([k, v]) => [clean(k), clean(v)]));
    if (typeof CUSTOM_ALIASES !== 'undefined') {
        Object.assign(CLEAN_ALIAS_MAP, Object.fromEntries(Object.entries(CUSTOM_ALIASES).map(([k, v]) => [clean(k), clean(v)])));
    }

    const EMPTY_SVG = `<svg class="empty-icon"><use href="#icon-empty"></use></svg>`;
    const isOneTime = (u) => u && (SYSTEM_CONFIG.policy.oneTimeUnits.includes(u.name) || u.grade === "슈퍼히든");
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

                    if (SYSTEM_CONFIG.parseKeywords.massive.some(k => cName.includes(k))) { type = 'special'; key = '메시브'; }
                    else if (SYSTEM_CONFIG.parseKeywords.godota.some(k => cName.includes(k))) { type = 'special'; key = '갓오타'; }
                    else if (SYSTEM_CONFIG.parseKeywords.specials.some(k => cName.includes(k))) key = SYSTEM_CONFIG.parseKeywords.specials.find(k => k === cName ? k : cName.includes(k));
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

    function calcEssenceRecursiveFast(uid, counts, visited) {
        if (visited.has(uid)) return;
        visited.add(uid);

        const u = unitMap.get(uid); if (!u) return;

        if (["히든", "슈퍼히든"].includes(u.grade)) {
            if (["테바", "테메"].includes(u.category)) counts.코랄++;
            else if (["토바", "토메"].includes(u.category)) counts.아이어++;
            else if (["저그", "중립"].includes(u.category) && !SYSTEM_CONFIG.essence.excludedIds.includes(u.name)) counts.제루스++;
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
        let totalEssence = fC + fA + fZ + (fH * SYSTEM_CONFIG.policy.hybridWeight);
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
        SYSTEM_CONFIG.dashboardAtoms.forEach(a => { tMap[a] = a === "갓오타/메시브" ? {갓오타:0, 메시브:0} : 0; cMap[a] = a === "갓오타/메시브" ? {갓오타:0, 메시브:0} : 0; });

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

        SYSTEM_CONFIG.dashboardAtoms.forEach(a => {
            const container = getEl(`vslot-${clean(a)}`), e = container?.querySelector('.cost-val'), nEl = container?.querySelector('.cost-name');
            if (!container || !e || !nEl) return;

            if (a === "갓오타/메시브") {
                let fG = Math.max(0, tMap[a].갓오타 - cMap[a].갓오타), fM = Math.max(0, tMap[a].메시브 - cMap[a].메시브);
                if (fG > 0 || fM > 0) {
                    if (e.innerHTML === EMPTY_SVG || e.innerHTML === '') {
                        e.innerHTML = `<div class="sp-wrap"><div class="sp-col sp-col-border"><span class="sp-val sp-val-g"></span><span class="sp-label">갓오타</span></div><div class="sp-col"><span class="sp-val sp-val-m"></span><span class="sp-label">메시브</span></div></div>`;
                    }
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

    let _activeTabIdx = 0, _currentViewMode = 'codex', _currentHighlight = null, _isCartMode = false;
    const GRADE_ORDER = ["매직", "레어", "에픽", "유니크", "헬", "레전드", "히든", "슈퍼히든"];
    const gradeColorsRaw = {"매직":"var(--grade-magic)", "레어":"var(--grade-rare)", "에픽":"var(--grade-epic)", "유니크":"var(--grade-unique)", "헬":"var(--grade-hell)", "레전드":"var(--grade-legend)", "히든":"var(--grade-hidden)", "슈퍼히든":"var(--grade-super)"};
    const getGradeIndex = (grade) => { let i = GRADE_ORDER.indexOf(grade); return i !== -1 ? i : -99; };

    const TAB_CATEGORIES = [
        {key:"테바", name:"테바"}, {key:"테메", name:"테메"},
        {key:"토바", name:"토바"}, {key:"토메", name:"토메"},
        {key:"저그", name:"저그"}, {key:"중립", name:"중립"}, {key:"혼종", name:"혼종"}
    ];

    function triggerHaptic() { navigator.vibrate?.(15); }
    function resetCodex(silent = false) { activeUnits.clear(); completedUnits.clear(); toggleHighlight(null); debouncedUpdateAllPanels(); if(!silent) showToast("목표 유닛이 초기화되었습니다."); }
    function resetCompleted() { completedUnits.clear(); debouncedUpdateAllPanels(); showToast("완료 기록이 모두 초기화되었습니다."); }
    function setupInitialView() { switchLayout('codex'); startTitleCycle(); }

    function resetGroupCompleted(level) {
        if (level === 3) {
            completedUnits.clear();
            showToast("목표 및 하위 전체가 초기화되었습니다.");
        } else {
            const topGrades = ["레어", "에픽", "유니크", "헬", "레전드", "슈퍼히든"];
            const hiddenGrades = ["히든"];
            let directMats = new Set();
            activeUnits.forEach((_, uid) => unitMap.get(uid)?.parsedRecipe?.forEach(pr => pr.id && directMats.add(pr.id)));

            for (let uid of completedUnits.keys()) {
                if (level < 3 && (activeUnits.has(uid) || directMats.has(uid) || isSpecialRender(uid))) continue;

                let u = unitMap.get(uid);
                if (!u) continue;
                if (topGrades.includes(u.grade)) completedUnits.delete(uid);
                else if (level >= 2 && hiddenGrades.includes(u.grade)) completedUnits.delete(uid);
            }
            showToast(`해당 그룹 및 하위 재료가 모두 초기화되었습니다.<br><span style="font-size:0.75rem;color:#94a3b8;">소모된 재료는 복구되지 않습니다.</span>`);
        }
        toggleHighlight(null);
        attemptAutoMerge();
        debouncedUpdateAllPanels();
    }

    const _cycleTitles = [
        '개복디 넥서스',
        '<div style="line-height:1.2; padding-top:2px;">제작자 <span style="font-weight:400;opacity:0.6;">|</span> 회장<br><span style="font-size:0.65rem; color:var(--text-sub); font-family:var(--font-mono); font-weight:normal;">ID : 3-S2-1-2461127</span></div>'
    ];
    let _cycleTitleIdx = 0, _titleInterval = null, _jewelPanelOpen = false;

    function startTitleCycle() {
        const el = getEl('nexusCycleTitle');
        if (!el) return;
        clearInterval(_titleInterval);
        _titleInterval = setInterval(() => {
            _cycleTitleIdx = (_cycleTitleIdx + 1) % _cycleTitles.length;
            el.classList.add('cycle-fade-out');
            setTimeout(() => { el.innerHTML = _cycleTitles[_cycleTitleIdx]; el.classList.remove('cycle-fade-out'); }, 250);
        }, 4000);
    }

    function toggleJewelPanel() {
        hideRecipeTooltip();
        const layout = getEl('mainLayout');
        if (layout?.classList.contains('view-jewel')) closeJewelPanel();
        else if (layout) { layout.classList.add('view-jewel'); getEl('btnJewelToggle')?.setAttribute('aria-expanded', 'true'); _jewelPanelOpen = true; renderJewelMiniGrid(); }
    }

    function closeJewelPanel() { getEl('mainLayout')?.classList.remove('view-jewel'); getEl('btnJewelToggle')?.setAttribute('aria-expanded', 'false'); _jewelPanelOpen = false; }

    function switchLayout(mode) {
        hideRecipeTooltip();
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

        let isStrictTerm = SYSTEM_CONFIG.search.strictMatchTerms.includes(searchTarget);

        for (let [id, u] of unitMap) {
            const isTargetGrade = ["슈퍼히든", "히든", "레전드"].includes(u.grade);
            if (SYSTEM_CONFIG.search.excludeIds.includes(id)) continue;
            if (!isTargetGrade) continue;

            if (id === searchTarget) { exactMatch = u; break; }
            if (!isStrictTerm && !prefixMatch && id.startsWith(searchTarget)) prefixMatch = u;
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
            let qty = (isNaN(qtyRaw) || qtyRaw < 1) ? 1 : Math.min(qtyRaw, SYSTEM_CONFIG.policy.maxUnitCapacity);
            const match = findUnitFlexible(targetName);
            if (match) { activeUnits.set(match.id, isOneTime(match) ? 1 : Math.min((activeUnits.get(match.id) || 0) + qty, SYSTEM_CONFIG.policy.maxUnitCapacity)); successCount++; }
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

    let _previousFocus = null;
    function openNoticeModal() { _previousFocus = document.activeElement; const m = getEl('noticeModal'); if(m) { m.style.display = 'flex'; m.focus(); m.addEventListener('keydown', trapModalFocus); } }
    function closeNoticeModal() { const m = getEl('noticeModal'); if(m) { m.style.display = 'none'; m.removeEventListener('keydown', trapModalFocus); } if(_previousFocus) _previousFocus.focus(); }
    function trapModalFocus(e) { if (e.key === 'Escape') closeNoticeModal(); }

    let _guideStepIdx = 0, _resizeTimer = null, _guideBackupActive = new Map(), _guideBackupCompleted = new Map();
    let _currentGuideSteps = [], _guideDemoUnitId = '', _guideDemoChildId = '', _autoGuideTimer = null, _autoActionTimer = null;

    const getGuideSteps = () => [
        {id:'jewel', targetId:'jewelPanel', text:'💎 <b>쥬얼 도감</b><br>상단 버튼을 통해 진입할 수 있으며, 인게임 쥬얼들의 옵션과 정보를 넓은 화면에서 한눈에 확인할 수 있습니다.', onEnter:()=> { if(!_jewelPanelOpen) toggleJewelPanel(); }},
        {id:'search', targetId:'searchWrap', text:'🔍 <b>검색 및 커맨드</b><br>원하는 유닛을 검색하거나 단축 커맨드(예: 저격수*8/아몬/전쟁광*4)를 입력해 빠르게 목표에 추가할 수 있습니다.', onEnter:()=> { if(_jewelPanelOpen) closeJewelPanel(); if(_currentViewMode !== 'codex') switchLayout('codex'); }},
        {id:'click-unit', targetId:_guideDemoUnitId?`card-${_guideDemoUnitId}`:'tabContent', fallbackId:'tabContent', text:`📖 <b>도감 및 유닛 추가</b><br>아래 도감에서 <b>${unitMap.get(_guideDemoUnitId)?.name||'유닛'}</b> 카드를 <b>직접 클릭</b>해서 목표 보드에 추가해 보세요!`, isWaitAction:true, onEnter:()=> { if(_currentViewMode !== 'codex') switchLayout('codex'); let catIdx = TAB_CATEGORIES.findIndex(c => c.key === unitMap.get(_guideDemoUnitId)?.category); if(catIdx !== -1 && _activeTabIdx !== catIdx) selectTab(catIdx); }, action:()=> { if(_guideDemoUnitId) toggleUnitSelection(_guideDemoUnitId, 1); }},
        {id:'cost-dashboard', targetId:'costDashboardPanel', text:`🔮 <b>코스트 전체 조망</b><br>방금 <b>직접 추가한</b> 목표 유닛의 필요 자원이 대시보드 전체에 <b>즉시 계산</b>되어 나타납니다.`},
        {id:'switch-mode', targetId:'btnToggleMode', text:'🔄 <b>체크리스트 모드 진입</b><br>화면 상단의 <b>[체크리스트 전환]</b> 버튼을 <b>직접 눌러서</b> 조립 모드로 진입해 보세요.', isWaitAction:true, action:()=>toggleViewMode()},
        {id:'click-complete', targetId:_guideDemoChildId?`d-slot-wrap-${_guideDemoChildId}`:'deductionBoard', fallbackId:'deductionBoard', exposeIds:['centerPanel', 'rightPanel', 'costDashboardPanel'], text:`✅ <b>재료 완료 처리</b><br>하위 재료를 확보했다면 완료 처리를 합니다.<br><b>${unitMap.get(_guideDemoChildId)?.name||'재료'}</b>의 <b>[✔ 완료]</b> 버튼을 <b>직접 눌러보세요!</b>`, isWaitAction:true, onEnter:()=>{ if(_currentViewMode !== 'deduct') switchLayout('deduct'); }, action:()=> { if(_guideDemoChildId) completeUnit(_guideDemoChildId); }},
        {id:'auto-deduct', targetId:'costDashboardPanel', exposeIds:['centerPanel', 'rightPanel', 'costDashboardPanel'], text:`📉 <b>실시간 자동 차감</b><br>보시다시피 방금 완료 처리된 ${unitMap.get(_guideDemoChildId)?.name||'재료'}의 코스트만큼 대시보드 전체 코스트가 정확히 <b>차감되어 실시간 반영</b>되었습니다!<br>이제 튜토리얼을 종료합니다.`, onEnter:()=>{ if(_currentViewMode !== 'deduct') switchLayout('deduct'); getEl('costDashboardPanel')?.classList.add('cost-reduction-flash'); setTimeout(()=>getEl('costDashboardPanel')?.classList.remove('cost-reduction-flash'), 1000); }}
    ];

    function startGuideTour() {
        clearTimeout(_autoGuideTimer); clearTimeout(_autoActionTimer);
        if (window.innerWidth < 1200) return showToast("모바일 환경에서는 가이드를 지원하지 않습니다.", true);
        _guideBackupActive = new Map(activeUnits); _guideBackupCompleted = new Map(completedUnits);
        activeUnits.clear(); completedUnits.clear(); debouncedUpdateAllPanels();

        let defUnit = SYSTEM_CONFIG.guide.defaultUnitId;
        let defChild = SYSTEM_CONFIG.guide.defaultChildId;

        let demo = unitMap.has(defUnit) ? unitMap.get(defUnit) : Array.from(unitMap.values()).find(u => (u.grade==='유니크'||u.grade==='에픽'||u.grade==='레전드') && u.parsedRecipe?.length > 0 && !isSpecialRender(u.id));
        if (demo) {
            _guideDemoUnitId = demo.id;
            _guideDemoChildId = demo.parsedRecipe.some(r => r.id === defChild) ? defChild : (demo.parsedRecipe.find(r => r.id && !SYSTEM_CONFIG.specialCostKeys.includes(r.id))?.id || null);
        }

        _currentGuideSteps = getGuideSteps(); _guideStepIdx = 0;
        ['guideBlocker', 'guideHighlight', 'guideTooltip'].forEach(id => getEl(id).style.display = 'block');
        window.addEventListener('resize', handleGuideResize); window.addEventListener('scroll', handleGuideResize, {passive: true});
        setTimeout(() => showGuideStep(), 50);
    }

    function endGuideTour() {
        clearTimeout(_autoGuideTimer); clearTimeout(_autoActionTimer); clearTimeout(_resizeTimer);
        _autoGuideTimer = _autoActionTimer = null;
        ['guideBlocker', 'guideHighlight', 'guideClickCatcher', 'guideTooltip'].forEach(id => getEl(id).style.display = 'none');
        document.querySelectorAll('.guide-exposed').forEach(el => el.classList.remove('guide-exposed'));
        window.removeEventListener('resize', handleGuideResize); window.removeEventListener('scroll', handleGuideResize);
        activeUnits.clear(); _guideBackupActive.forEach((v, k) => activeUnits.set(k, v));
        completedUnits.clear(); _guideBackupCompleted.forEach((v, k) => completedUnits.set(k, v));
        debouncedUpdateAllPanels();
        if (_jewelPanelOpen) closeJewelPanel();
        if (_currentViewMode === 'deduct') switchLayout('codex');
        showToast("가이드 종료. 이전 상태로 복구되었습니다. ✔");
    }

    function nextGuideStep() { clearTimeout(_autoGuideTimer); clearTimeout(_autoActionTimer); _guideStepIdx++; _guideStepIdx >= _currentGuideSteps.length ? endGuideTour() : showGuideStep(); }

    function showGuideStep() {
        let step = _currentGuideSteps[_guideStepIdx]; step.onEnter?.(step); getEl('guideTooltip').style.opacity = '0';

        document.querySelectorAll('.guide-exposed').forEach(el => el.classList.remove('guide-exposed'));
        if (step.exposeIds) {
            step.exposeIds.forEach(id => {
                let el = getEl(id);
                if (el) el.classList.add('guide-exposed');
            });
        }

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
        if (event) {
            if (event.type === 'touchstart' || event.type === 'pointerdown') {
                _lastInteractionTime = Date.now();
            } else if (event.type === 'mousedown') {
                if (Date.now() - _lastInteractionTime < 500) {
                    if (event.cancelable) event.preventDefault();
                    event.stopPropagation?.();
                    return;
                }
            }
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

        tt.innerHTML = `<div class="tooltip-header" style="color:${gradeColorsRaw[u.grade]}">${u.name} 조합법 ${multi > 1 ? `<span style="font-size:0.8rem; color:var(--text-sub);">(${multi}개 기준)</span>` : ''}</div><div class="tooltip-body">${formatRecipeTooltip(u, multi)}</div><div class="tooltip-footer">화면 터치/클릭 또는 ESC로 닫힙니다.</div>`;

        let viewWidth = document.documentElement.clientWidth; tt.style.maxWidth = `${viewWidth - 20}px`; tt.classList.add('active');
        let x = (event?.clientX || event?.touches?.[0]?.clientX || viewWidth/2) + window.scrollX, y = (event?.clientY || event?.touches?.[0]?.clientY || window.innerHeight/2) + window.scrollY;
        let ttRect = tt.getBoundingClientRect(), ttWidth = ttRect.width || 300, ttHeight = ttRect.height || 150;
        tt.style.left = `${Math.max(window.scrollX + 10, Math.min(x, viewWidth + window.scrollX - ttWidth - 15))}px`;
        tt.style.top = `${Math.max(window.scrollY + 10, Math.min(y, window.innerHeight + window.scrollY - ttHeight - 15))}px`;
    }
    function hideRecipeTooltip() { getEl('recipeTooltip')?.classList.remove('active'); }

    function toggleUnitSelection(id, forceQty) {
        if (activeUnits.has(id)) activeUnits.delete(id); else activeUnits.set(id, isOneTime(unitMap.get(id)) ? 1 : Math.min(forceQty || 1, SYSTEM_CONFIG.policy.maxUnitCapacity));
        debouncedUpdateAllPanels();
    }

    function setUnitQty(id, val) {
        let q = parseInt(val, 10);
        if (q === 0 || isNaN(q) || q < 1) activeUnits.delete(id);
        else if(unitMap.get(id) && !isOneTime(unitMap.get(id))) activeUnits.set(id, Math.min(q, SYSTEM_CONFIG.policy.maxUnitCapacity));
        debouncedUpdateAllPanels();
    }

    function getDependencies(uid) {
        if (depCache.has(uid)) return depCache.get(uid);
        let deps = new Set([uid]);
        const u = unitMap.get(uid);
        if (u) {
            u.parsedRecipe?.forEach(child => { if (child.id) getDependencies(child.id).forEach(d => deps.add(d)); });
            u.parsedCost?.forEach(pc => { if (SYSTEM_CONFIG.specialCostKeys.includes(pc.key)) deps.add(pc.key); });
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
            let processedMap = new Map();

            while (queue.length > 0) {
                if (guard++ >= SYSTEM_CONFIG.policy.maxLoopQueue) break;
                let currentLevel = [...queue]; queue = []; queueSet.clear();
                currentLevel.forEach(uid => {
                    let totalNeeded = defMap.get(uid) || 0;
                    if (!unitMap.has(uid) || totalNeeded <= 0) return;

                    let effectiveNeeded = totalNeeded;
                    if (updateRoots) effectiveNeeded -= Math.min(completedUnits.get(uid) || 0, totalNeeded);

                    let alreadyProcessed = processedMap.get(uid) || 0;
                    let delta = effectiveNeeded - alreadyProcessed;

                    if (delta <= 0) return;
                    processedMap.set(uid, effectiveNeeded);

                    let toolDependencies = getToolNeed(uid);
                    if (toolDependencies.length > 0) {
                        toolDependencies.forEach(toolId => {
                            let toolNeed = effectiveNeeded > 0 ? 1 : 0;
                            if (toolNeed > (defMap.get(toolId) || 0)) {
                                defMap.set(toolId, toolNeed);
                                if (!queueSet.has(toolId)) { queue.push(toolId); queueSet.add(toolId); }
                            }
                        });
                    }

                    if (unitMap.get(uid).parsedRecipe) {
                        unitMap.get(uid).parsedRecipe.forEach(child => {
                            if (!child.id || !unitMap.has(child.id)) return;
                            let isTool = isToolRequirement(uid, child.id);

                            if (updateRoots) {
                                let cRoots = rootTracking.get(child.id) || new Map(); rootTracking.set(child.id, cRoots);
                                rootTracking.get(uid)?.forEach((_, rId) => cRoots.set(rId, { id: rId, text: isTool ? `${unitMap.get(rId)?.name || rId} <span class="tool-badge">[도구]</span>` : `${unitMap.get(rId)?.name || rId} 재료`, cond: child.cond }));
                            }
                            if (!isTool) {
                                defMap.set(child.id, (defMap.get(child.id) || 0) + (delta * child.qty));
                                if (!queueSet.has(child.id)) { queue.push(child.id); queueSet.add(child.id); }
                            }
                        });
                    }
                });
            }
        };

        processQueueLoop(Array.from(activeUnits.keys()), baseDeficits, false);
        processQueueLoop(Array.from(activeUnits.keys()), deficits, true);

        baseDeficits.forEach((val, k) => { if (val > 0) baseMap.set(k, val); });
        deficits.forEach((needed, uid) => { if (needed > 0) reqMap.set(uid, Math.max(0, needed - (completedUnits.get(uid) || 0))); });

        const updateSpecials = (map, reqObj, isBase) => map.forEach((needed, uid) => unitMap.get(uid)?.parsedCost?.forEach(pc => { if (SYSTEM_CONFIG.specialCostKeys.includes(pc.key)) { reqObj[pc.key] += pc.qty * needed; if (!isBase && activeUnits.has(uid)) specialReason[pc.key].set(uid, { text: `${unitMap.get(uid).name} 재료`, cond: '' }); } }));
        updateSpecials(baseDeficits, baseSpecialReq, true); updateSpecials(deficits, specialReq, false);

        SYSTEM_CONFIG.specialCostKeys.forEach(k => specialReq[k] = Math.max(0, specialReq[k] - (completedUnits.get(k) || 0)));
        rootTracking.forEach((rMap, cId) => reasonMap.set(cId, activeUnits.has(cId) ? new Map([[cId, { text: '목표 유닛', cond: '' }]]) : rMap));

        return { reqMap, baseMap, reasonMap, specialReq, baseSpecialReq, specialReason };
    }

    function attemptAutoMerge() {
        let merged = false, loopCount = 0;
        do {
            merged = false; if (loopCount++ >= SYSTEM_CONFIG.policy.maxLoopMerge) break;
            let { reqMap } = calculateDeductedRequirements();
            unitMap.forEach((u, uid) => {
                if (activeUnits.has(uid) || !u.parsedRecipe?.length || (reqMap.get(uid) || 0) <= 0) return;
                let maxCraftable = Number.MAX_SAFE_INTEGER, hasValidRecipe = false;
                const check = (id, qty, isTool) => { hasValidRecipe = true; let comp = completedUnits.get(id) || 0; if (isTool) { if (comp < 1) maxCraftable = 0; } else maxCraftable = Math.min(maxCraftable, Math.floor(comp / qty)); };

                u.parsedRecipe.forEach(child => child.id && check(child.id, child.qty, isToolRequirement(uid, child.id)));
                u.parsedCost?.forEach(pc => SYSTEM_CONFIG.specialCostKeys.includes(pc.key) && check(pc.key, pc.qty, false));

                let mergeAmount = Math.min(hasValidRecipe ? maxCraftable : 0, reqMap.get(uid));
                if (mergeAmount > 0) {
                    u.parsedRecipe.forEach(child => { if (child.id && !isToolRequirement(uid, child.id)) completedUnits.set(child.id, (completedUnits.get(child.id) || 0) - (child.qty * mergeAmount)); });
                    u.parsedCost?.forEach(pc => { if (SYSTEM_CONFIG.specialCostKeys.includes(pc.key)) completedUnits.set(pc.key, (completedUnits.get(pc.key) || 0) - (pc.qty * mergeAmount)); });
                    completedUnits.set(uid, (completedUnits.get(uid) || 0) + mergeAmount); merged = true;
                }
            });
        } while (merged);
    }

    function consumeCompletedRecipe(uid, multiplier) {
        const u = unitMap.get(uid); if (!u) return;
        u.parsedRecipe?.forEach(child => {
            if (child.id && !isToolRequirement(uid, child.id)) {
                let needed = child.qty * multiplier, comp = completedUnits.get(child.id) || 0, consume = Math.min(needed, comp);
                if (consume > 0) completedUnits.set(child.id, comp - consume);
                if (needed - consume > 0) consumeCompletedRecipe(child.id, needed - consume);
            }
        });
        u.parsedCost?.forEach(pc => {
            if (SYSTEM_CONFIG.specialCostKeys.includes(pc.key)) {
                let needed = pc.qty * multiplier, comp = completedUnits.get(pc.key) || 0, consume = Math.min(needed, comp);
                if (consume > 0) completedUnits.set(pc.key, comp - consume);
            }
        });
    }

    let _completeLock = new Set();

    function completeUnit(uid, amount) {
        if (_completeLock.has(uid)) return; _completeLock.add(uid);
        const reqVal = parseInt(getEl(`d-req-${uid}`)?.innerText || 0);
        const processQty = amount !== undefined ? amount : reqVal;

        if (processQty > 0 && reqVal >= processQty) {
            consumeCompletedRecipe(uid, processQty);
            completedUnits.set(uid, (completedUnits.get(uid) || 0) + processQty);
            toggleHighlight(null); attemptAutoMerge(); triggerHaptic(); debouncedUpdateAllPanels();
        }
        setTimeout(() => _completeLock.delete(uid), 250);
    }

    function renderActiveRoster() {
        getEl('activeRoster').innerHTML = Array.from(activeUnits.entries()).map(([id, qty]) => {
            const u = unitMap.get(id); return u ? `<div class="roster-tag" data-action="toggleUnit" data-uid="${id}" style="border-color:${gradeColorsRaw[u.grade]}66;"><span style="color:${gradeColorsRaw[u.grade]}; font-weight:bold;">${u.name}</span><span class="roster-qty">×${qty}</span></div>` : '';
        }).join('') || '<span style="color:var(--text-muted); font-size:0.85rem;">선택된 유닛 대기열 (검색 후 엔터)</span>';
    }

    let updateTimer = null;

    // 🌟 1. 버그 픽스: 액티브 유닛 수량이 변경될 때 완료 수량을 자동으로 깎는 스마트 보정 함수
    function clampCompletedUnits() {
        const { baseMap, baseSpecialReq } = calculateDeductedRequirements();
        for (let [uid, compQty] of completedUnits.entries()) {
            let maxAllowed = SYSTEM_CONFIG.specialCostKeys.includes(uid) ? (baseSpecialReq[uid] || 0) : (baseMap.get(uid) || 0);
            if (compQty > maxAllowed) {
                if (maxAllowed <= 0) completedUnits.delete(uid);
                else completedUnits.set(uid, maxAllowed);
            }
        }
    }

    function debouncedUpdateAllPanels() {
        if (updateTimer) cancelAnimationFrame(updateTimer);
        updateTimer = requestAnimationFrame(() => {
            clampCompletedUnits(); // 업데이트 직전에 초과된 완료 수량 자동 교정
            updateMagicDashboard(); updateEssence(); updateTabsUI(); updateTabContentUI(); updateDeductionBoard(); renderActiveRoster(); saveNexusState();
        });
    }

    function renderDeductionBoard() {
        const renderSlot = (id, n, g, pid) => `<div class="deduct-slot" id="d-slot-wrap-${id}" data-orig-parent="${pid}" data-uid="${id}"><div class="d-reason-wrap" id="d-reason-${id}"></div><div class="d-name" data-action="showRecipeTooltip" data-uid="${id}" data-is-deduction="true"><span class="gtag grade-${g}">${g}</span>${n}</div><div id="d-cond-${id}" class="d-cond-text"></div><div class="d-bottom-area"><div class="req-text"><span id="d-req-${id}">0</span><span class="req-label">필요</span></div><div id="craft-wrap-${id}" class="craft-wrap"></div></div></div>`;

        const getGrp = (id, t, items, pid, exClass='', resetLevel=0) => `
        <div class="deduct-group ${exClass}" id="${id}">
            <div class="deduct-group-title" style="justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:10px;">${t}</div>
                ${resetLevel > 0 ? `<button class="btn-text-link" data-action="resetGroup" data-level="${resetLevel}" style="color:#f87171; text-decoration:none; padding:4px 8px; background:rgba(239,68,68,0.1); border-radius:6px; border:1px solid rgba(239,68,68,0.3);">⟲ 하위 통합 초기화</button>` : ''}
            </div>
            <div class="deduct-grid" id="${pid}">${items.map(u => renderSlot(u.id, u.name, u.grade, pid)).join('')}</div>
        </div>`;

        const allUnits = Array.from(unitMap.values());
        const specialUnits = SYSTEM_CONFIG.specialRenderIds.map(id => unitMap.get(id) || { id, name: id, grade: '레어' });

        getEl('deductionBoard').innerHTML = `<div id="deduct-empty-msg" class="empty-msg"><div class="empty-icon-text">✨</div> 목표 유닛을 선택하면<br>필요한 재료 목록이 이곳에 생성됩니다.</div>`
        + getGrp('group-special', `<span class="grp-icon grp-icon-super">✦</span> 목표 유닛 및 직속 재료`, specialUnits, 'grid-special', 'grp-special', 3)
        + getGrp('group-hidden', `<span class="grp-icon grp-icon-hidden">♦</span> 히든 등급 재료`, allUnits.filter(u => u.grade === "히든" && !isSpecialRender(u.id)), 'grid-hidden', '', 2)
        + getGrp('group-top', `<span class="grp-icon grp-icon-legend">▲</span> 레어 - 레전드 재료`, allUnits.filter(u => ["슈퍼히든", "레전드", "헬", "유니크", "에픽", "레어"].includes(u.grade) && !isSpecialRender(u.id)).sort((a,b)=>getGradeIndex(b.grade)-getGradeIndex(a.grade)), 'grid-top', 'grp-top', 1);
    }

    function updateDeductionBoard() {
        const { reqMap, baseMap, reasonMap, specialReq, baseSpecialReq, specialReason } = calculateDeductedRequirements();
        const directMaterials = new Set(), fragmentMap = new Map();
        activeUnits.forEach((_, uid) => unitMap.get(uid)?.parsedRecipe?.forEach(pr => pr.id && directMaterials.add(pr.id)));

        const updateSlot = (id, netReq, baseReq, reasons) => {
            const wrapEl = getEl(`d-slot-wrap-${id}`); if (!wrapEl) return;
            if (baseReq > 0) {
                wrapEl.classList.add('is-visible');
                const rCon = getEl(`d-reason-${id}`), cEl = getEl(`d-cond-${id}`), isTarget = activeUnits.has(id);
                if (reasons?.size > 0 && netReq > 0) {
                    if (rCon) { rCon.innerHTML = Array.from(reasons.entries()).map(([rId, i]) => `<span class="d-reason-tag" data-action="toggleHighlight" data-uid="${rId}">${i.text || i}</span>`).join(''); rCon.style.display = 'flex'; }
                    if (cEl) { let conds = [...new Set(Array.from(reasons.values()).map(i => i.cond).filter(Boolean))]; cEl.style.display = conds.length ? 'block' : 'none'; cEl.innerHTML = conds.map(c => `[${c}]`).join(' / '); }
                } else { if (rCon) rCon.style.display = 'none'; if (cEl) cEl.style.display = 'none'; }
                wrapEl.style.order = isTarget ? "-999" : (isSpecialRender(id) ? "999" : "-1");
                const reqEl = getEl(`d-req-${id}`), cWrap = getEl(`craft-wrap-${id}`);

                if (netReq > 0) {
                    wrapEl.classList.remove('is-completed'); wrapEl.classList.add('has-target'); if (reqEl) reqEl.innerText = netReq;
                    if (cWrap) {
                        let isFinalReady = isTarget && !unitMap.get(id)?.parsedRecipe?.some(pr => (completedUnits.get(pr.id)||0) < (isToolRequirement(id, pr.id)?1:pr.qty*netReq)) && !unitMap.get(id)?.parsedCost?.some(pc => SYSTEM_CONFIG.specialCostKeys.includes(pc.key) && (completedUnits.get(pc.key)||0)<pc.qty*netReq);
                        let completeBtnHtml = isFinalReady ? `<button class="btn-complete final-target" data-action="completeUnit" data-uid="${id}">✨ 최종완료</button>` : `<button class="btn-complete" data-action="completeUnit" data-uid="${id}">✔ 전체완료</button>`;

                        let batchSize = SYSTEM_CONFIG.policy.craftBatch?.[id] || 1;

                        if (netReq > batchSize || (batchSize > 1 && netReq > 0)) {
                            cWrap.innerHTML = `
                                <div class="partial-ctrl">
                                    <button class="pc-btn" data-action="addComplete" data-uid="${id}" data-batch="${batchSize}" title="${batchSize}개씩 조립 완료">+ ${batchSize}개 완료</button>
                                </div>
                                ${completeBtnHtml}
                            `;
                        } else if (netReq > 1) {
                            cWrap.innerHTML = `
                                <div class="partial-ctrl">
                                    <button class="pc-btn" data-action="addComplete" data-uid="${id}" data-batch="1" title="1개씩 조립 완료">+ 1개 완료</button>
                                </div>
                                ${completeBtnHtml}
                            `;
                        } else {
                            cWrap.innerHTML = completeBtnHtml;
                        }
                    }
                } else {
                    wrapEl.classList.remove('has-target'); wrapEl.classList.add('is-completed');
                    if (reqEl) reqEl.innerText = '0';
                    if (cWrap) cWrap.innerHTML = `<span style="font-size:0.85rem; color:var(--g-dim); font-weight:bold; padding-right:4px;">✨ 완료됨</span>`;
                }

                let tParent = (directMaterials.has(id) || isTarget) ? getEl('grid-special') : (getEl(wrapEl.dataset.origParent) || getEl('grid-hidden'));
                if (tParent && wrapEl.parentElement !== tParent) { if (!fragmentMap.has(tParent)) fragmentMap.set(tParent, document.createDocumentFragment()); fragmentMap.get(tParent).appendChild(wrapEl); }
            } else { wrapEl.classList.remove('is-visible'); }
        };

        SYSTEM_CONFIG.specialCostKeys.forEach(k => {
            updateSlot(k, specialReq[k], baseSpecialReq[k], specialReason[k]);
        });

        unitMap.forEach(u => {
            if (["레어", "에픽", "유니크", "헬", "레전드", "히든", "슈퍼히든"].includes(u.grade) || isSpecialRender(u.id)) {
                if (SYSTEM_CONFIG.specialCostKeys.includes(u.id)) return;
                updateSlot(u.id, reqMap.get(u.id) || 0, baseMap.get(u.id) || 0, reasonMap.get(u.id));
            }
        });

        fragmentMap.forEach((frag, parent) => parent.appendChild(frag));
        let hasVisible = false; document.querySelectorAll('.deduct-group').forEach(g => { let isVis = g.querySelectorAll('.deduct-slot.is-visible').length > 0; g.style.display = isVis ? 'block' : 'none'; if(isVis) hasVisible = true; });
        getEl('deduct-empty-msg').style.display = hasVisible ? 'none' : 'block';
        if (_currentHighlight) { let deps = getDependencies(_currentHighlight); document.querySelectorAll('.deduct-slot').forEach(el => el.classList.toggle('highlighted-tree', deps.has(el.id.replace('d-slot-wrap-', '')))); }
    }

    function renderTabs() {
        const t = getEl('codexTabs');
        if (t) {
            t.innerHTML = TAB_CATEGORIES.map((c, i) => `<button id="tab-btn-${i}" role="tab" aria-selected="${i===_activeTabIdx}" class="tab-btn" data-action="selectTab" data-tab-idx="${i}"><span>${c.name}</span></button>`).join('');
            updateTabsUI();
        }
    }

    function updateTabsUI() {
        let aCats = new Set();
        for (let id of activeUnits.keys()) {
            let u = unitMap.get(id);
            if (u?.category) aCats.add(u.category);
            if (aCats.size === TAB_CATEGORIES.length) break;
        }
        TAB_CATEGORIES.forEach((c, i) => {
            let btn = getEl(`tab-btn-${i}`), has = aCats.has(c.key);
            if (!btn) return;
            let isActiveTab = (!_isCartMode && i === _activeTabIdx);
            if (btn.classList.contains('active') !== isActiveTab) { btn.classList.toggle('active', isActiveTab); btn.setAttribute('aria-selected', isActiveTab ? 'true' : 'false'); }
            if (btn.classList.contains('has-active') !== has) btn.classList.toggle('has-active', has);
        });

        let typeCount = activeUnits.size;
        let cartBtn = getEl('btnCartMode');
        if (cartBtn) {
            if (typeCount > 0) {
                cartBtn.style.display = 'flex';
                getEl('cartCount').innerText = `${typeCount}종`;
            } else {
                cartBtn.style.display = 'none';
                if (_isCartMode) toggleCartMode();
            }
            if (_isCartMode) {
                cartBtn.classList.add('active');
            } else {
                cartBtn.classList.remove('active');
            }
        }
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

    function selectTab(idx) {
        hideRecipeTooltip();
        _isCartMode = false;
        _activeTabIdx = idx;
        updateTabsUI();
        renderCurrentTabContent();
        if (_jewelPanelOpen) closeJewelPanel();
    }

    function toggleCartMode() {
        hideRecipeTooltip();
        _isCartMode = !_isCartMode;
        if (_isCartMode) _activeTabIdx = -1;
        else _activeTabIdx = 0;
        updateTabsUI();
        renderCurrentTabContent();
    }

    let _isTabContentInitialized = false;
    function initAllTabContents() {
        const tc = getEl('tabContent'); if (!tc) return;
        tc.innerHTML = TAB_CATEGORIES.map(cat => {
            let items = Array.from(unitMap.values()).filter(u => getGradeIndex(u.grade) >= getGradeIndex("레전드") && u.category === cat.key).sort((a,b) => (SYSTEM_CONFIG.sorting.order[b.name]||0)-(SYSTEM_CONFIG.sorting.order[a.name]||0) || (isOneTime(a)?-1:isOneTime(b)?1:0) || getGradeIndex(b.grade)-getGradeIndex(a.grade) || calculateTotalCostScore(b)-calculateTotalCostScore(a));

            return `<div id="cat-group-${cat.key}" class="cat-group" role="tabpanel" style="display:none; flex-direction:column; gap:4px;">${!items.length ? `<div style="text-align:center; padding:30px; color:var(--text-sub); font-weight:bold; font-size:1.05rem;">해당 분류에 유닛이 없습니다.</div>` : items.map((item, idx) => `<div id="card-${item.id}" class="unit-card" style="animation-delay:${idx*0.03}s" data-action="toggleUnit" data-uid="${item.id}"><div class="uc-wrap"><div class="uc-identity"><div class="uc-grade"><span class="gtag grade-${item.grade}">${item.grade}</span></div><div class="uc-name-row" style="color:${gradeColorsRaw[item.grade]};">${item.name}</div></div><div class="uc-recipe-col">${formatRecipeHorizontal(item)}</div><div class="uc-ctrl"><div class="uc-cart-badge" id="cart-badge-${item.id}" style="display:none;">🛒 <span class="cb-val">1</span>개</div>${isOneTime(item)?'':`<div class="smart-stepper active-stepper"><button data-action="smartChange" data-uid="${item.id}" data-delta="-1" aria-label="${item.name} 감소">-</button><div class="ss-val" id="val-unit-${item.id}" aria-live="polite">-</div><button data-action="smartChange" data-uid="${item.id}" data-delta="1" aria-label="${item.name} 추가">+</button></div>`}</div></div></div>`).join('')}</div>`;
        }).join('');
        _isTabContentInitialized = true;
    }

    function renderCurrentTabContent() {
        if (!_isTabContentInitialized) initAllTabContents();
        TAB_CATEGORIES.forEach((c, i) => {
            let g = getEl(`cat-group-${c.key}`);
            if (g) g.style.display = (_isCartMode || i === _activeTabIdx) ? 'flex' : 'none';
        });
        updateTabContentUI();
    }

    function updateTabContentUI() {
        unitMap.forEach(item => {
            let card = getEl(`card-${item.id}`);
            if (!card) return;
            let isActive = activeUnits.has(item.id);

            let badge = getEl(`cart-badge-${item.id}`);
            if (badge) {
                badge.style.display = (isActive && !_isCartMode) ? 'flex' : 'none';
                if (isActive) badge.querySelector('.cb-val').innerText = activeUnits.get(item.id);
            }

            if (!isOneTime(item)) {
                let v = getEl(`val-unit-${item.id}`);
                if (v) v.innerText = isActive ? activeUnits.get(item.id) : '-';
                card.querySelectorAll('.smart-stepper button').forEach(b => b.disabled = !isActive);
            }

            if (_isCartMode) {
                card.style.display = isActive ? 'flex' : 'none';
            } else {
                card.style.display = 'flex';
            }

            card.classList.toggle('active', isActive);
        });
    }

    function renderDashboardAtoms() {
        let db = getEl('magicDashboard'); if (!db) return;
        db.innerHTML = `<div class="cost-slot total" id="slot-total-magic"><div class="cost-val" id="magic-total-val">0</div><div class="cost-name">통합 코스트</div></div><div class="cost-slot total" id="slot-total-essence"><div class="cost-val" id="essence-total-val">0</div><div class="cost-name">통합 정수</div></div>${['coral|#FF6B6B|코랄', 'aiur|var(--grade-rare)|아이어', 'zerus|var(--grade-legend)|제루스'].map(d => { let [id, c, n] = d.split('|'); return `<div class="cost-slot" id="slot-essence-${id}"><div class="cost-val" id="val-essence-${id}" style="color:${c};">0</div><div class="cost-sub" id="sub-essence-${id}" style="font-size:0.8rem; margin:-2px 0 2px; height:14px; font-family:var(--font-mono); line-height:1; display:flex; gap:4px; align-items:center; justify-content:center;"></div><div class="cost-name">${n}</div></div>`; }).join('')}${SYSTEM_CONFIG.dashboardAtoms.map(a => `<div class="cost-slot ${a === '갓오타/메시브' ? 'is-skill-slot' : 'is-magic-slot'}" id="vslot-${clean(a)}"><div class="cost-val"></div><div class="cost-name" id="name-${clean(a)}">${a}</div></div>`).join('')}`;
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

    document.addEventListener('click', e => {
        const actionEl = e.target.closest('[data-action]');

        if (!actionEl) {
            if (_currentHighlight && !e.target.closest('.deduct-slot') && !e.target.closest('.d-reason-tag') && !e.target.closest('#recipeTooltip')) {
                toggleHighlight(null);
            }
            if (e.target.id === 'noticeModal') closeNoticeModal();
            if (getEl('recipeTooltip')?.classList.contains('active') && !e.target.closest('#recipeTooltip')) {
                hideRecipeTooltip();
            }
            return;
        }

        const action = actionEl.dataset.action;
        const uid = actionEl.dataset.uid;

        switch (action) {
            case 'startGuideTour': startGuideTour(); break;
            case 'openNoticeModal': openNoticeModal(); break;
            case 'closeNoticeModal': closeNoticeModal(); break;
            case 'toggleJewelPanel': toggleJewelPanel(); break;
            case 'closeJewelPanel': closeJewelPanel(); break;
            case 'resetCodex': resetCodex(); break;
            case 'resetCompleted': resetCompleted(); break;
            case 'toggleViewMode': toggleViewMode(); break;
            case 'endGuideTour': endGuideTour(); break;
            case 'nextGuideStep': nextGuideStep(); break;
            case 'selectTab': selectTab(parseInt(actionEl.dataset.tabIdx, 10)); break;
            case 'toggleCartMode': toggleCartMode(); break;
            case 'toggleUnit': toggleUnitSelection(uid, 1); break;
            case 'toggleHighlight': toggleHighlight(uid, e); break;
            case 'addComplete':
                e.stopPropagation();
                let batch = parseInt(actionEl.dataset.batch || 1, 10);
                completeUnit(uid, batch);
                break;
            case 'completeUnit':
                e.stopPropagation();
                completeUnit(uid);
                break;
            case 'resetGroup':
                e.stopPropagation();
                resetGroupCompleted(parseInt(actionEl.dataset.level, 10));
                break;
            case 'showRecipeTooltip':
                e.stopPropagation();
                showRecipeTooltip(uid, e, actionEl.dataset.isDeduction === 'true');
                break;
        }
    });

    document.addEventListener('pointerdown', e => {
        const actionEl = e.target.closest('[data-action="smartChange"]');
        if (actionEl) {
            e.stopPropagation();
            startSmartChange(actionEl.dataset.uid, parseInt(actionEl.dataset.delta, 10), 'active', e);
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (getEl('noticeModal')?.style.display === 'flex') return closeNoticeModal();
            hideRecipeTooltip(); if (getEl('mainLayout')?.classList.contains('view-jewel')) closeJewelPanel();
            if (document.activeElement === getEl('unitSearchInput')) getEl('unitSearchInput').blur();
        }
    });

    window.addEventListener('orientationchange', hideRecipeTooltip);

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
                    if (_isSwiping || _isCartMode) return;
                    let dX = e.changedTouches[0].screenX - sX, dY = e.changedTouches[0].screenY - sY;
                    if (Math.abs(dX) > 70 && Math.abs(dY) < 50) { _isSwiping = true; if (dX > 0 && _activeTabIdx > 0) selectTab(_activeTabIdx - 1); else if (dX < 0 && _activeTabIdx < TAB_CATEGORIES.length - 1) selectTab(_activeTabIdx + 1); setTimeout(() => _isSwiping = false, 300); }
                }, { passive: true });
            }
        } catch (err) { console.error("[오류] 넥서스 초기화 중 에러 발생:", err); }
    });

})();