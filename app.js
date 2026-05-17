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
            excludedIds: [],
            mapping: {
                "테바": "코랄", "테메": "코랄",
                "토바": "아이어", "토메": "아이어",
                "저그": "제루스", "중립": "제루스",
                "혼종": "혼종"
            },
            display: [
                { id: 'coral', color: '#FF6B6B', name: '코랄' },
                { id: 'aiur', color: 'var(--grade-rare)', name: '아이어' },
                { id: 'zerus', color: 'var(--grade-legend)', name: '제루스' }
            ]
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
            },
            resetGroups: {
                top: ["레어", "에픽", "유니크", "헬", "레전드", "슈퍼히든"],
                hidden: ["히든"]
            }
        },
        grades: {
            order: ["매직", "레어", "에픽", "유니크", "헬", "레전드", "히든", "슈퍼히든"],
            colors: {
                "매직": "var(--grade-magic)",
                "레어": "var(--grade-rare)",
                "에픽": "var(--grade-epic)",
                "유니크": "var(--grade-unique)",
                "헬": "var(--grade-hell)",
                "레전드": "var(--grade-legend)",
                "히든": "var(--grade-hidden)",
                "슈퍼히든": "var(--grade-super)"
            }
        },
        tabs: [
            { key: "테바", name: "테바" },
            { key: "테메", name: "테메" },
            { key: "토바", name: "토바" },
            { key: "토메", name: "토메" },
            { key: "저그", name: "저그" },
            { key: "중립", name: "중립" },
            { key: "혼종", name: "혼종" }
        ],
        dashboardAtoms: [
            "전쟁광", "스파르타중대", "암흑광전사", "암흑파수기", "원시바퀴", "저격수", "코브라", "암흑고위기사",
            "암흑추적자", "변종가시지옥", "망치경호대", "공성파괴단", "암흑집정관", "암흑불멸자", "원시히드라리스크",
            "땅거미지뢰", "자동포탑", "우르사돈암", "우르사돈수", "갓오타/메시브"
        ],
        aliases: {
            "타이커스":"타이커스핀들레이", "타커":"타이커스핀들레이", "타이":"타이커스핀들레이",
            "닥템":"암흑기사", "닼템":"암흑기사", "다칸":"암흑집정관",
            "스투코프":"스투코프", "디젯":"메시브", "메십":"메시브", "히페":"히페리온",
            "고전순":"고르곤전투순양함", "특레":"특공대레이너", "드레천":"드라켄레이저천공기",
            "공허":"공허포격기", "분수":"분노수호자", "원히":"원시히드라리스크", "젤나가":"아몬의젤나가피조물"
        },
        commandKeywords: {
            불새: "불새케리건"
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
    const getGradeIndex = (grade) => { let i = SYSTEM_CONFIG.grades.order.indexOf(grade); return i !== -1 ? i : -99; };

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
                    else if (SYSTEM_CONFIG.parseKeywords.specials.some(k => k === cName ? k : cName.includes(k))) key = SYSTEM_CONFIG.parseKeywords.specials.find(k => k === cName ? k : cName.includes(k));
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
        } catch(e) {
            console.warn("[오류] 데이터 저장 실패", e);
            showToast("저장 공간이 부족하여 데이터를 저장할 수 없습니다.", true);
        }
    }

    function calcEssenceRecursiveFast(uid, counts, visited) {
        if (visited.has(uid)) return;
        visited.add(uid);

        const u = unitMap.get(uid); if (!u) return;

        if (["히든", "슈퍼히든"].includes(u.grade)) {
            const targetEssence = SYSTEM_CONFIG.essence.mapping[u.category];
            if (targetEssence) {
                if (!(targetEssence === "제루스" && SYSTEM_CONFIG.essence.excludedIds.includes(u.name))) {
                    counts[targetEssence]++;
                }
            }
        }
        u.parsedRecipe?.forEach(pr => { if (pr.id) calcEssenceRecursiveFast(pr.id, counts, visited); });
    }

    function getEssenceCount(sourceMap) {
        let counts = { 코랄: 0, 아이어: 0, 제루스: 0, 혼종: 0 };
        let visited = new Set();
        sourceMap.forEach((qty, uid) => { calcEssenceRecursiveFast(uid, counts, visited); });
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

    function triggerHaptic() { navigator.vibrate?.(15); }
    function resetCodex(silent = false) { activeUnits.clear(); completedUnits.clear(); toggleHighlight(null); debouncedUpdateAllPanels(); if(!silent) showToast("목표 유닛이 초기화되었습니다."); }
    function resetCompleted() { completedUnits.clear(); debouncedUpdateAllPanels(); showToast("완료 기록이 모두 초기화되었습니다."); }
    function setupInitialView() { switchLayout('codex'); startTitleCycle(); }

    function resetGroupCompleted(level) {
        if (level === 3) {
            completedUnits.clear();
            showToast("목표 및 하위 전체가 초기화되었습니다.");
        } else {
            const topGrades = SYSTEM_CONFIG.policy.resetGroups.top;
            const hiddenGrades = SYSTEM_CONFIG.policy.resetGroups.hidden;
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
        '<div class="nexus-creator-info"><span class="cr-role">제작자</span><span class="cr-sep">|</span><span class="cr-name">회장</span><span class="cr-id">ID : 3-S2-1-2461127</span></div>'
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
        const modal = getEl('jewelModalOverlay');
        if (modal?.style.display === 'flex') {
            closeJewelPanel();
        } else if (modal) {
            modal.style.display = 'flex';
            getEl('btnJewelToggle')?.setAttribute('aria-expanded', 'true');
            _jewelPanelOpen = true;
            renderJewelMiniGrid();
            document.body.style.overflow = 'hidden';
            modal.focus();
        }
    }

    function closeJewelPanel() {
        const modal = getEl('jewelModalOverlay');
        if (modal) modal.style.display = 'none';
        getEl('btnJewelToggle')?.setAttribute('aria-expanded', 'false');
        _jewelPanelOpen = false;
        document.body.style.overflow = '';
    }

    function switchLayout(mode) {
        hideRecipeTooltip();
        const layout = getEl('mainLayout'), btn = getEl('btnToggleMode');
        if (!layout || !btn) return;
        _currentViewMode = mode;
        layout.classList.remove('view-deduct');
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
        let cleaned = clean(rawName);
        let searchTarget = SYSTEM_CONFIG.commandKeywords[cleaned] || CLEAN_ALIAS_MAP[cleaned] || cleaned;
        if(!searchTarget) return null;

        let isStrictTerm = SYSTEM_CONFIG.search.strictMatchTerms.includes(searchTarget);
        let exactMatch = null, prefixMatch = null;

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

    function openStaticGuide() {
        _previousFocus = document.activeElement;
        const m = getEl('staticGuideModalOverlay');
        if(m) {
            m.style.display = 'flex';
            m.focus();
            m.addEventListener('keydown', trapModalFocus);
            selectGuideTab('g-search');
        }
    }
    function closeStaticGuide() { const m = getEl('staticGuideModalOverlay'); if(m) { m.style.display = 'none'; m.removeEventListener('keydown', trapModalFocus); } if(_previousFocus) _previousFocus.focus(); }

    function selectGuideTab(gtid) {
        document.querySelectorAll('.guide-tab-btn').forEach(b => {
            let isAct = b.dataset.gtid === gtid;
            b.classList.toggle('active', isAct);
            b.setAttribute('aria-selected', isAct ? 'true' : 'false');
        });
        document.querySelectorAll('.guide-panel').forEach(p => p.style.display = p.id === `g-panel-${gtid}` ? 'block' : 'none');
    }

    function trapModalFocus(e) {
        if (e.key === 'Escape') {
            closeNoticeModal();
            closeStaticGuide();
        }
    }

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

        tt.innerHTML = `<div class="tooltip-header" style="color:${SYSTEM_CONFIG.grades.colors[u.grade]}">${u.name} 조합법 ${multi > 1 ? `<span style="font-size:0.8rem; color:var(--text-sub);">(${multi}개 기준)</span>` : ''}</div><div class="tooltip-body">${formatRecipeTooltip(u, multi)}</div><div class="tooltip-footer">화면 터치/클릭 또는 ESC로 닫힙니다.</div>`;

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
                if (guard++ >= SYSTEM_CONFIG.policy.maxLoopQueue) {
                    console.warn("[시스템 경고] 재료 탐색 엔진 무한 루프 가드 발동 (순환 참조 의심)");
                    break;
                }
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

    // [개선] 스킬류 자동 병합 프리패스 기능 추가
    function attemptAutoMerge() {
        let merged = false, loopCount = 0;
        do {
            merged = false;
            if (loopCount++ >= SYSTEM_CONFIG.policy.maxLoopMerge) {
                console.warn("[시스템 경고] 자동 조립 엔진 무한 루프 가드 발동");
                break;
            }
            let { reqMap } = calculateDeductedRequirements();
            unitMap.forEach((u, uid) => {
                if (activeUnits.has(uid) || !u.parsedRecipe?.length || (reqMap.get(uid) || 0) <= 0) return;
                let maxCraftable = Number.MAX_SAFE_INTEGER, hasValidRecipe = false;

                const check = (id, qty, isTool) => {
                    hasValidRecipe = true;
                    if (SYSTEM_CONFIG.specialRenderIds.includes(id)) return;

                    let comp = completedUnits.get(id) || 0;
                    if (isTool) { if (comp < 1) maxCraftable = 0; }
                    else maxCraftable = Math.min(maxCraftable, Math.floor(comp / qty));
                };

                u.parsedRecipe.forEach(child => child.id && check(child.id, child.qty, isToolRequirement(uid, child.id)));
                u.parsedCost?.forEach(pc => SYSTEM_CONFIG.specialCostKeys.includes(pc.key) && check(pc.key, pc.qty, false));

                let mergeAmount = Math.min(hasValidRecipe ? maxCraftable : 0, reqMap.get(uid));
                if (mergeAmount > 0) {
                    u.parsedRecipe.forEach(child => {
                        if (child.id && !isToolRequirement(uid, child.id) && !SYSTEM_CONFIG.specialRenderIds.includes(child.id)) {
                            completedUnits.set(child.id, (completedUnits.get(child.id) || 0) - (child.qty * mergeAmount));
                        }
                    });
                    u.parsedCost?.forEach(pc => {
                        if (SYSTEM_CONFIG.specialCostKeys.includes(pc.key) && !SYSTEM_CONFIG.specialRenderIds.includes(pc.key)) {
                            completedUnits.set(pc.key, (completedUnits.get(pc.key) || 0) - (pc.qty * mergeAmount));
                        }
                    });
                    completedUnits.set(uid, (completedUnits.get(uid) || 0) + mergeAmount); merged = true;
                }
            });
        } while (merged);
    }

    // [개선] 스킬류 수동 완료 시 차감 방지 로직 적용
    function deleteCompletedRecipe(uid, multiplier) {
        const u = unitMap.get(uid); if (!u) return;
        u.parsedRecipe?.forEach(child => {
            if (child.id && !isToolRequirement(uid, child.id) && !SYSTEM_CONFIG.specialRenderIds.includes(child.id)) {
                let needed = child.qty * multiplier, comp = completedUnits.get(child.id) || 0, consume = Math.min(needed, comp);
                if (consume > 0) completedUnits.set(child.id, comp - consume);
                if (needed - consume > 0) deleteCompletedRecipe(child.id, needed - consume);
            }
        });
        u.parsedCost?.forEach(pc => {
            if (SYSTEM_CONFIG.specialCostKeys.includes(pc.key) && !SYSTEM_CONFIG.specialRenderIds.includes(pc.key)) {
                let needed = pc.qty * multiplier, comp = completedUnits.get(pc.key) || 0, consume = Math.min(needed, comp);
                if (consume > 0) completedUnits.set(pc.key, comp - consume);
            }
        });
    }

    let _completeLock = new Set();

    function completeUnit(uid, amount) {
        if (_completeLock.has(uid)) return;
        _completeLock.add(uid);

        const reqVal = parseInt(getEl(`d-req-${uid}`)?.innerText || 0);
        const requestedQty = amount !== undefined ? amount : reqVal;
        const processQty = Math.min(requestedQty, reqVal);

        if (processQty > 0) {
            deleteCompletedRecipe(uid, processQty);
            completedUnits.set(uid, (completedUnits.get(uid) || 0) + processQty);
            toggleHighlight(null);
            attemptAutoMerge();
            triggerHaptic();
            debouncedUpdateAllPanels();
        }
        setTimeout(() => _completeLock.delete(uid), 250);
    }

    function renderActiveRoster() {
        getEl('activeRoster').innerHTML = Array.from(activeUnits.entries()).map(([id, qty]) => {
            const u = unitMap.get(id); return u ? `<div class="roster-tag" data-action="toggleUnit" data-uid="${id}" style="border-color:${SYSTEM_CONFIG.grades.colors[u.grade]}66;"><span style="color:${SYSTEM_CONFIG.grades.colors[u.grade]}; font-weight:bold;">${u.name}</span><span class="roster-qty">×${qty}</span></div>` : '';
        }).join('') || '<span style="color:var(--text-muted); font-size:0.85rem;">선택된 유닛 대기열 (검색 후 엔터)</span>';
    }

    let updateTimer = null;

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
            clampCompletedUnits();
            updateMagicDashboard(); updateEssence(); updateTabsUI(); updateTabContentUI(); updateDeductionBoard(); renderActiveRoster(); saveNexusState();
        });
    }

    function renderDeductionBoard() {
        const renderSlot = (id, n, g, pid) => `<div class="deduct-slot" id="d-slot-wrap-${id}" data-orig-parent="${pid}" data-uid="${id}"><div class="d-reason-wrap" id="d-reason-${id}"></div><div class="d-name" data-action="showRecipeTooltip" data-uid="${id}" data-is-deduction="true"><span class="gtag grade-${g}">${g}</span>${n}</div><div id="d-cond-${id}" class="d-cond-text"></div><div class="d-bottom-area"><div class="req-text"><span id="d-req-${id}">0</span><span class="req-label">필요</span></div><div id="craft-wrap-${id}" class="craft-wrap"></div></div></div>`;

        const getGrp = (id, t, items, pid, exClass='', resetLevel=0) => `
        <div class="deduct-group ${exClass}" id="${id}">
            <div class="deduct-group-title" style="justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:10px;"><span class="grp-icon grp-icon-super">✨</span> ${t}</div>
                ${resetLevel > 0 ? `<button class="btn-text-link" data-action="resetGroup" data-level="${resetLevel}" style="color:#f87171; text-decoration:none; padding:4px 8px; background:rgba(239,68,68,0.1); border-radius:6px; border:1px solid rgba(239,68,68,0.3);">⟲ 하위 통합 초기화</button>` : ''}
            </div>
            <div class="deduct-grid" id="${pid}">${items.map(u => renderSlot(u.id, u.name, u.grade, pid)).join('')}</div>
        </div>`;

        const allUnits = Array.from(unitMap.values());
        const specialUnits = SYSTEM_CONFIG.specialRenderIds.map(id => unitMap.get(id) || { id, name: id, grade: '레어' });

        getEl('deductionBoard').innerHTML = `<div id="deduct-empty-msg" class="empty-msg"><div class="empty-icon-text">✨</div> 목표 유닛을 선택하면<br>필요한 재료 목록이 이곳에 생성됩니다.</div>`
        + getGrp('group-special', `목표 유닛 및 직속 재료`, specialUnits, 'grid-special', 'grp-special', 3)
        + getGrp('group-hidden', `히든 등급 재료`, allUnits.filter(u => u.grade === "히든" && !isSpecialRender(u.id)), 'grid-hidden', '', 2)
        + getGrp('group-top', `레어 - 레전드 재료`, allUnits.filter(u => ["슈퍼히든", "레전드", "헬", "유니크", "에픽", "레어"].includes(u.grade) && !isSpecialRender(u.id)).sort((a,b)=>getGradeIndex(b.grade)-getGradeIndex(a.grade)), 'grid-top', 'grp-top', 1);
    }

    // [개선] 스킬류 자동 완료 시각적 피드백 연동
    function updateDeductionBoard() {
        const { reqMap, baseMap, reasonMap, specialReq, baseSpecialReq, specialReason } = calculateDeductedRequirements();
        const directMaterials = new Set(), fragmentMap = new Map();
        activeUnits.forEach((_, uid) => unitMap.get(uid)?.parsedRecipe?.forEach(pr => pr.id && directMaterials.add(pr.id)));

        const updateSlot = (id, netReq, baseReq, reasons) => {
            const wrapEl = getEl(`d-slot-wrap-${id}`); if (!wrapEl) return;
            const isTarget = activeUnits.has(id);
            const isSkill = SYSTEM_CONFIG.specialRenderIds.includes(id);

            if (baseReq > 0 && !isTarget) {
                wrapEl.classList.add('is-visible');
                wrapEl.style.display = 'flex';
                const rCon = getEl(`d-reason-${id}`), cEl = getEl(`d-cond-${id}`);

                if (reasons?.size > 0 && netReq > 0) {
                    if (rCon) { rCon.innerHTML = Array.from(reasons.entries()).map(([rId, i]) => `<span class="d-reason-tag" data-action="toggleHighlight" data-uid="${rId}">${i.text || i}</span>`).join(''); rCon.style.display = 'flex'; }
                    if (cEl) { let conds = [...new Set(Array.from(reasons.values()).map(i => i.cond).filter(Boolean))]; cEl.style.display = conds.length ? 'block' : 'none'; cEl.innerHTML = conds.map(c => `[${c}]`).join(' / '); }
                } else { if (rCon) rCon.style.display = 'none'; if (cEl) cEl.style.display = 'none'; }
                wrapEl.style.order = isSkill ? "999" : "-1";
                const reqEl = getEl(`d-req-${id}`), cWrap = getEl(`craft-wrap-${id}`);

                if (isSkill) {
                    wrapEl.classList.remove('has-target');
                    wrapEl.classList.add('is-completed');
                    if (reqEl) reqEl.innerText = '0';
                    if (cWrap) {
                        const displayQty = netReq > 0 ? ` (${netReq}개)` : '';
                        cWrap.innerHTML = `<span style="font-size:0.85rem; color:#f472b6; font-weight:bold; padding-right:4px;">⚡ 자동 적용됨${displayQty}</span>`;
                    }
                } else if (netReq > 0) {
                    wrapEl.classList.remove('is-completed'); wrapEl.classList.add('has-target'); if (reqEl) reqEl.innerText = netReq;
                    if (cWrap) {
                        let completeBtnHtml = `<button class="btn-complete" data-action="completeUnit" data-uid="${id}">✔ 전체완료</button>`;
                        let batchSize = SYSTEM_CONFIG.policy.craftBatch?.[id] || 1;

                        if (netReq > batchSize || (batchSize > 1 && netReq > 0)) {
                            cWrap.innerHTML = `<div class="partial-ctrl"><button class="pc-btn" data-action="addComplete" data-uid="${id}" data-batch="${batchSize}" title="${batchSize}개씩 조립 완료">+ ${batchSize}개 완료</button></div>${completeBtnHtml}`;
                        } else if (netReq > 1) {
                            cWrap.innerHTML = `<div class="partial-ctrl"><button class="pc-btn" data-action="addComplete" data-uid="${id}" data-batch="1" title="1개씩 조립 완료">+ 1개 완료</button></div>${completeBtnHtml}`;
                        } else {
                            cWrap.innerHTML = completeBtnHtml;
                        }
                    }
                } else {
                    wrapEl.classList.remove('has-target'); wrapEl.classList.add('is-completed');
                    if (reqEl) reqEl.innerText = '0';
                    if (cWrap) cWrap.innerHTML = `<span style="font-size:0.85rem; color:var(--g-dim); font-weight:bold; padding-right:4px;">✨ 완료됨</span>`;
                }

                let tParent = directMaterials.has(id) ? getEl('grid-special') : (getEl(wrapEl.dataset.origParent) || getEl('grid-hidden'));
                if (tParent && wrapEl.parentElement !== tParent) { if (!fragmentMap.has(tParent)) fragmentMap.set(tParent, document.createDocumentFragment()); fragmentMap.get(tParent).appendChild(wrapEl); }
            } else {
                wrapEl.classList.remove('is-visible');
                wrapEl.style.display = 'none';
            }
        };

        SYSTEM_CONFIG.specialCostKeys.forEach(k => { updateSlot(k, specialReq[k], baseSpecialReq[k], specialReason[k]); });
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
            t.innerHTML = SYSTEM_CONFIG.tabs.map((c, i) => `<button id="tab-btn-${i}" role="tab" aria-selected="${i===_activeTabIdx}" class="tab-btn" data-action="selectTab" data-tab-idx="${i}"><span>${c.name}</span></button>`).join('');
            updateTabsUI();
        }
    }

    function updateTabsUI() {
        let aCats = new Set();
        for (let id of activeUnits.keys()) {
            let u = unitMap.get(id);
            if (u?.category) aCats.add(u.category);
            if (aCats.size === SYSTEM_CONFIG.tabs.length) break;
        }
        SYSTEM_CONFIG.tabs.forEach((c, i) => {
            let btn = getEl(`tab-btn-${i}`), has = aCats.has(c.key);
            if (!btn) return;
            let isActiveTab = (!_isCartMode && i === _activeTabIdx);
            if (btn.classList.contains('active') !== isActiveTab) { btn.classList.toggle('active', isActiveTab); btn.setAttribute('aria-selected', isActiveTab ? 'true' : 'false'); }
            if (btn.classList.contains('has-active') !== has) btn.classList.toggle('has-active', has);
        });

        let typeCount = activeUnits.size;
        let cartBtn = getEl('btnCartMode');
        if (cartBtn) {
            getEl('cartCount').innerText = `${typeCount}종`;
            if (typeCount > 0) {
                cartBtn.disabled = false;
                cartBtn.classList.add('has-items');
            } else {
                cartBtn.disabled = true;
                cartBtn.classList.remove('has-items');
                if (_isCartMode) toggleCartMode();
            }
            if (_isCartMode) {
                cartBtn.classList.add('active');
            } else {
                cartBtn.classList.remove('active');
            }
        }

        const selectAllBtn = getEl('btnSelectAllTab');
        if (selectAllBtn) {
            if (_isCartMode) {
                selectAllBtn.disabled = true;
                selectAllBtn.innerHTML = `<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%;">✔ 전체 선택</span>`;
            } else {
                selectAllBtn.disabled = false;
                const currentTab = SYSTEM_CONFIG.tabs[_activeTabIdx];
                if (currentTab) {
                    const catItems = Array.from(unitMap.values()).filter(u => u.category === currentTab.key && getGradeIndex(u.grade) >= getGradeIndex("레전드"));
                    const allSelected = catItems.length > 0 && catItems.every(item => activeUnits.has(item.id));

                    if (allSelected) {
                        selectAllBtn.innerHTML = `<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; color:var(--grade-unique);">✖ ${currentTab.name} 전체 해제</span>`;
                    } else {
                        selectAllBtn.innerHTML = `<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%;">✔ ${currentTab.name} 전체 선택</span>`;
                    }
                }
            }
        }
    }

    function toggleSelectAllTab() {
        if (_isCartMode) return;
        const currentTab = SYSTEM_CONFIG.tabs[_activeTabIdx];
        if (!currentTab) return;

        const catItems = Array.from(unitMap.values()).filter(u => u.category === currentTab.key && getGradeIndex(u.grade) >= getGradeIndex("레전드"));
        if (!catItems.length) return;

        const allSelected = catItems.every(item => activeUnits.has(item.id));

        if (allSelected) {
            catItems.forEach(item => activeUnits.delete(item.id));
            showToast(`✖ ${currentTab.name} 분류 전체 선택 해제`);
        } else {
            catItems.forEach(item => {
                if (!activeUnits.has(item.id)) {
                    activeUnits.set(item.id, 1);
                }
            });
            showToast(`✔ ${currentTab.name} 분류 전체 선택 완료`);
        }
        triggerHaptic();
        debouncedUpdateAllPanels();
    }

    const formatRecipeHorizontal = (item, m = 1) => formatRecipe(item, m, false);
    const formatRecipeTooltip = (item, m = 1) => formatRecipe(item, m, true);
    function formatRecipe(item, multi = 1, showSep = false) {
        if (!item.recipe || IGNORE_PARSE_RECIPES.includes(item.recipe)) return `<div style="color:var(--text-muted);font-size:0.85rem;">정보 없음</div>`;
        let partsHtml = splitRecipe(item.recipe).map((p, i, arr) => {
            const m = p.match(/^([^(\[ ]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/); let html = '';
            if (m) { const u = unitMap.get(getUnitId(m[1].trim())), c = u ? SYSTEM_CONFIG.grades.colors[u.grade] : "var(--text)"; html = `<div class="recipe-badge" style="color:${c}; border-color:${c}44;">${m[1].trim()} <span class="badge-cond">${m[2] ? `(${m[2]})` : ''}[${(m[3] ? parseInt(m[3], 10) : 1) * multi}]</span></div>`; }
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
        tc.innerHTML = SYSTEM_CONFIG.tabs.map(cat => {
            let items = Array.from(unitMap.values()).filter(u => getGradeIndex(u.grade) >= getGradeIndex("레전드") && u.category === cat.key).sort((a,b) => (SYSTEM_CONFIG.sorting.order[b.name]||0)-(SYSTEM_CONFIG.sorting.order[a.name]||0) || (isOneTime(a)?-1:isOneTime(b)?1:0) || getGradeIndex(b.grade)-getGradeIndex(a.grade) || calculateTotalCostScore(b)-calculateTotalCostScore(a));

            return `<div id="cat-group-${cat.key}" class="cat-group" role="tabpanel" style="display:none; flex-direction:column; gap:4px;">${!items.length ? `<div style="text-align:center; padding:30px; color:var(--text-sub); font-weight:bold; font-size:1.05rem;">해당 분류에 유닛이 없습니다.</div>` : items.map((item, idx) => `<div id="card-${item.id}" class="unit-card" style="animation-delay:${idx*0.03}s" data-action="toggleUnit" data-uid="${item.id}"><div class="uc-wrap"><div class="uc-identity"><div class="uc-grade"><span class="gtag grade-${item.grade}">${item.grade}</span></div><div class="uc-name-row" style="color:${SYSTEM_CONFIG.grades.colors[item.grade]};">${item.name}</div></div><div class="uc-recipe-col">${formatRecipeHorizontal(item)}</div><div class="uc-ctrl">${isOneTime(item)?'':`<div class="smart-stepper active-stepper"><button data-action="smartChange" data-uid="${item.id}" data-delta="-1" aria-label="${item.name} 감소">-</button><div class="ss-val" id="val-unit-${item.id}" aria-live="polite">-</div><button data-action="smartChange" data-uid="${item.id}" data-delta="1" aria-label="${item.name} 추가">+</button></div>`}</div></div></div>`).join('')}</div>`;
        }).join('');
        _isTabContentInitialized = true;
    }

    function renderCurrentTabContent() {
        if (!_isTabContentInitialized) initAllTabContents();
        SYSTEM_CONFIG.tabs.forEach((c, i) => {
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
        db.innerHTML = `<div class="cost-slot total" id="slot-total-magic"><div class="cost-val" id="magic-total-val">0</div><div class="cost-name">통합 코스트</div></div><div class="cost-slot total" id="slot-total-essence"><div class="cost-val" id="essence-total-val">0</div><div class="cost-name">통합 정수</div></div>${SYSTEM_CONFIG.essence.display.map(d => `<div class="cost-slot" id="slot-essence-${d.id}"><div class="cost-val" id="val-essence-${d.id}" style="color:${d.color};">0</div><div class="cost-sub" id="sub-essence-${d.id}" style="font-size:0.8rem; margin:-2px 0 2px; height:14px; font-family:var(--font-mono); line-height:1; display:flex; gap:4px; align-items:center; justify-content:center;"></div><div class="cost-name">${d.name}</div></div>`).join('')}${SYSTEM_CONFIG.dashboardAtoms.map(a => `<div class="cost-slot ${a === '갓오타/메시브' ? 'is-skill-slot' : 'is-magic-slot'}" id="vslot-${clean(a)}"><div class="cost-val"></div><div class="cost-name" id="name-${clean(a)}">${a}</div></div>`).join('')}`;
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
            if (e.target.id === 'staticGuideModalOverlay') closeStaticGuide();
            if (e.target.id === 'jewelModalOverlay') closeJewelPanel();
            if (getEl('recipeTooltip')?.classList.contains('active') && !e.target.closest('#recipeTooltip')) {
                hideRecipeTooltip();
            }
            return;
        }

        const action = actionEl.dataset.action;
        const uid = actionEl.dataset.uid;

        switch (action) {
            case 'openStaticGuide': openStaticGuide(); break;
            case 'closeStaticGuide': closeStaticGuide(); break;
            case 'selectGuideTab': selectGuideTab(actionEl.dataset.gtid); break;
            case 'openNoticeModal': openNoticeModal(); break;
            case 'closeNoticeModal': closeNoticeModal(); break;
            case 'toggleJewelPanel': toggleJewelPanel(); break;
            case 'closeJewelPanel': closeJewelPanel(); break;
            case 'resetCodex': resetCodex(); break;
            case 'resetCompleted': resetCompleted(); break;
            case 'toggleViewMode': toggleViewMode(); break;
            case 'selectTab': selectTab(parseInt(actionEl.dataset.tabIdx, 10)); break;
            case 'toggleCartMode': toggleCartMode(); break;
            case 'toggleSelectAllTab': toggleSelectAllTab(); break;
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
            if (getEl('staticGuideModalOverlay')?.style.display === 'flex') return closeStaticGuide();
            if (_jewelPanelOpen) return closeJewelPanel();
            hideRecipeTooltip();
            if (document.activeElement === getEl('unitSearchInput')) getEl('unitSearchInput').blur();
        }
    });

    window.addEventListener('orientationchange', hideRecipeTooltip);

    let _isSwiping = false;
    document.addEventListener('DOMContentLoaded', () => {
        try {
            document.documentElement.lang = 'ko'; document.documentElement.setAttribute('data-theme', 'dark');

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
                    if (Math.abs(dX) > 70 && Math.abs(dY) < 50) { _isSwiping = true; if (dX > 0 && _activeTabIdx > 0) selectTab(_activeTabIdx - 1); else if (dX < 0 && _activeTabIdx < SYSTEM_CONFIG.tabs.length - 1) selectTab(_activeTabIdx + 1); setTimeout(() => _isSwiping = false, 300); }
                }, { passive: true });
            }
        } catch (err) { console.error("[오류] 넥서스 초기화 중 에러 발생:", err); }
    });

})();