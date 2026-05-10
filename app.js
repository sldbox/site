/*
=============================================================================
[파일 설명서] app.js
=============================================================================
*/

let _activeTabIdx = 0;
const unitMap = new Map(), activeUnits = new Map(), ownedUnits = new Map(), essenceUnits = new Set(), DOM = {};
const clean = s => s ? s.replace(/\s+/g, '').toLowerCase() : '';

const GRADE_ORDER = ["매직", "레어", "에픽", "유니크", "헬", "레전드", "히든", "슈퍼히든"];
const gradeColorsRaw = { "매직":"var(--grade-magic)", "레어":"var(--grade-rare)", "에픽":"var(--grade-epic)", "유니크":"var(--grade-unique)", "헬":"var(--grade-hell)", "레전드":"var(--grade-legend)", "히든":"var(--grade-hidden)", "슈퍼히든":"var(--grade-super)" };

const TAB_CATEGORIES = [
    {key:"테바", name:"테바", sym:"♆"},
    {key:"테메", name:"테메", sym:"⚙︎"},
    {key:"토바", name:"토바", sym:"⟡"},
    {key:"토메", name:"토메", sym:"⟁"},
    {key:"저그중립", name:"저그중립", sym:"☣︎"},
    {key:"혼종", name:"혼종", sym:"⌬"}
];

const IGNORE_PARSE_RECIPES = ["미발견", "없음", "", "100라운드이전까지저그업20↑ [(타 종족 업 0)[1],역전 복권10회[1],인생 복권3회시-소환[1]]"];

const dashboardAtoms = ["전쟁광", "스파르타중대", "암흑광전사", "암흑파수기", "원시바퀴", "저격수", "코브라", "암흑고위기사", "암흑추적자", "변종가시지옥", "망치경호대", "공성파괴단", "암흑집정관", "암흑불멸자", "원시히드라리스크", "땅거미지뢰", "자동포탑", "우르사돈[암]", "우르사돈[수]", "갓오타/메시브"];

const EMPTY_SVG = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.2;"><rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect><line x1="3" y1="21" x2="21" y2="3"></line></svg>`;
const MINI_EMPTY_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.2;"><rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect><line x1="3" y1="21" x2="21" y2="3"></line></svg>`;

function getUnitId(rawName){ const c=clean(rawName); const u=unitMap.get(c); return u ? u.id : c; }

const AI_DO_NOT_MODIFY_CORE_ENGINE = true;

function calculateTotalCostScore(costStr){
    if(!costStr||IGNORE_PARSE_RECIPES.includes(costStr))return 0;
    let score=0; costStr.split(',').forEach(p=>{const m=p.match(/\[(\d+(?:\.\d+)?)\]/);if(m)score+=parseFloat(m[1]);else score+=1}); return score;
}

function processCostKeyword(rawName, amount, map) {
    const cName = clean(rawName);

    if (cName.includes('메시브') || cName.includes('디제스터')) {
        if (typeof map['갓오타/메시브'] !== 'object') map['갓오타/메시브'] = { 갓오타: 0, 메시브: 0 };
        map['갓오타/메시브'].메시브 += amount;
        return true;
    }
    if (cName.includes('갓오브타임') || cName.includes('갓오타')) {
        if (typeof map['갓오타/메시브'] !== 'object') map['갓오타/메시브'] = { 갓오타: 0, 메시브: 0 };
        map['갓오타/메시브'].갓오타 += amount;
        return true;
    }
    if (cName.includes('땅거미지뢰')) {
        map['땅거미지뢰'] = (map['땅거미지뢰'] || 0) + amount;
        return true;
    }
    if (cName.includes('우르사돈[암]') || cName.includes('우르사돈암')) {
        map['우르사돈[암]'] = (map['우르사돈[암]'] || 0) + amount;
        return true;
    }
    if (cName.includes('우르사돈[수]') || cName.includes('우르사돈수')) {
        map['우르사돈[수]'] = (map['우르사돈[수]'] || 0) + amount;
        return true;
    }
    if (cName.includes('자동포탑')) {
        map['자동포탑'] = (map['자동포탑'] || 0) + amount;
        return true;
    }
    if (cName.includes('잠복')) {
        map['잠복'] = (map['잠복'] || 0) + amount;
        return true;
    }

    const uid = getUnitId(cName);
    const atomId = dashboardAtoms.find(a => clean(a) === uid) || uid;
    
    map[atomId] = (map[atomId] || 0) + amount;
    return true;
}

function parseFixedCost(costStr,multiplier,map){
    if(!costStr||IGNORE_PARSE_RECIPES.includes(costStr))return;
    costStr.split(',').forEach(p=>{
        const m=p.match(/(.+?)\[(\d+(?:\.\d+)?)\]/);
        if(m)processCostKeyword(m[1].trim(),parseFloat(m[2])*multiplier,map);
        else processCostKeyword(p.trim(),multiplier,map);
    });
}

function calculateRecursiveCost(nameKo,m,map,visited=new Set()){
    const uid = getUnitId(nameKo.split(/[(\[]/)[0]); if(visited.has(uid))return;
    const curV=new Set(visited);curV.add(uid); if(processCostKeyword(uid,m,map))return;
    const u=unitMap.get(uid);
    if(u&&u.recipe&&!IGNORE_PARSE_RECIPES.includes(u.recipe)){
        u.recipe.split(/\+(?![^()]*\))/).forEach(part=>{
            const match=part.trim().match(/^([^(\[]+)/);
            if(match){
                const ingName=match[1].trim(),cntMatch=part.match(/\[(\d+)\]/),cnt=cntMatch?parseInt(cntMatch[1]):1,childUid=getUnitId(ingName), childU=unitMap.get(childUid);
                if(childU&&childU.cost&&!IGNORE_PARSE_RECIPES.includes(childU.cost))parseFixedCost(childU.cost,cnt*m,map);
                else calculateRecursiveCost(ingName,cnt*m,map,curV);
            }else calculateRecursiveCost(part.trim(),m,map,curV);
        });
    }
}

function calcEssenceRecursive(uid, counts, visited) {
    if(visited.has(uid)) return; visited.add(uid);
    const u = unitMap.get(uid); if(!u) return;
    if(["히든", "슈퍼히든"].includes(u.grade)) {
        if(["테바","테메"].includes(u.category)) counts.코랄 += 1;
        else if(["토바","토메"].includes(u.category)) counts.아이어 += 1;
        else if(u.category === "저그중립") counts.제루스 += 1;
        else if(u.category === "혼종") { counts.코랄 += 1; counts.아이어 += 1; counts.제루스 += 1; }
    }
    if(u.recipe && !IGNORE_PARSE_RECIPES.includes(u.recipe)) {
        u.recipe.split(/\+(?![^()]*\))/).forEach(part => {
            const match = part.trim().match(/^([^(\[]+)/);
            if(match) calcEssenceRecursive(getUnitId(match[1]), counts, visited);
        });
    }
}

function getUnitEssenceTotal(uid) {
    const u = unitMap.get(uid); if (!u || !["히든", "슈퍼히든"].includes(u.grade)) return 0;
    let counts = {코랄:0, 아이어:0, 제루스:0}, visited = new Set();
    calcEssenceRecursive(uid, counts, visited); return counts.코랄 + counts.아이어 + counts.제루스;
}

function updateEssence(){
    let counts={코랄:0, 아이어:0, 제루스:0}, visited = new Set();
    activeUnits.forEach((qty, key) => { const u = unitMap.get(key); if(u && ["히든", "슈퍼히든"].includes(u.grade)) calcEssenceRecursive(key, counts, visited); });
    const setVal=(id,v)=>{const el=document.getElementById(id);if(el){el.innerText=v;el.parentElement.className='cost-slot'+(el.parentElement.id.includes('magic')?' is-magic-slot':'')+(id.includes('total')?' total':'')+(v>0?' active':'')}};
    setVal('val-coral',counts.코랄);setVal('val-aiur',counts.아이어);setVal('val-zerus',counts.제루스);setVal('essence-total-val',counts.코랄+counts.아이어+counts.제루스);
}

function calculateIntermediateRequirements() {
    const reqMap = new Map();
    const reasonMap = new Map();

    function traverse(uid, m, rootId) {
        reqMap.set(uid, (reqMap.get(uid)||0) + m);
        
        if (rootId && uid !== rootId) {
            if (!reasonMap.has(uid)) reasonMap.set(uid, new Set());
            const rootUnit = unitMap.get(rootId);
            if (rootUnit) reasonMap.get(uid).add(rootUnit.name);
        }

        const u = unitMap.get(uid);
        if(u && u.recipe && !IGNORE_PARSE_RECIPES.includes(u.recipe)) {
            u.recipe.split(/\+(?![^()]*\))/).forEach(part=>{
                const match=part.trim().match(/^([^(\[]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/);
                if(match){
                    const childUid=getUnitId(match[1]);
                    const childQty = match[3] ? parseInt(match[3]) : 1;
                    traverse(childUid, m * childQty, rootId);
                } else {
                    const childUid=getUnitId(part);
                    traverse(childUid, m, rootId);
                }
            });
        }
    }
    
    activeUnits.forEach((qty, uid) => {
        traverse(uid, qty, uid);
    });
    
    return { reqMap, reasonMap };
}

function updateAllPanels() { 
    updateMagicDashboard(); 
    updateEssence(); 
    renderTabs(); 
    renderCurrentTabContent(); 
    updateDeductionBoard();
}

// [초기화 기능 분리]
function resetCodex() { activeUnits.clear(); essenceUnits.clear(); updateAllPanels(); }
function resetOwned() { ownedUnits.clear(); updateAllPanels(); }

function toggleDeduction() {
    const layout = document.getElementById('mainLayout');
    if (layout) {
        layout.classList.toggle('is-expanded');
    }
}

function toggleUnitSelection(id, forceQty){
    if(activeUnits.has(id)){
        activeUnits.delete(id); essenceUnits.delete(id);
    } else {
        const u = unitMap.get(id);
        const initQty = (u && u.grade === "슈퍼히든") ? 1 : (forceQty || 1);
        activeUnits.set(id, initQty); 
        essenceUnits.add(id);
    }
    updateAllPanels();
}

function setUnitQty(id, val) {
    if (!activeUnits.has(id)) return;
    const u = unitMap.get(id);
    if (!u || u.grade === "슈퍼히든") return;
    
    let q = parseInt(val);
    if (isNaN(q) || q < 1) q = 1;
    if (q > 16) q = 16;
    
    activeUnits.set(id, q);
    updateAllPanels();
}

function handleWheel(e, id) {
    if (!activeUnits.has(id)) return;
    const u = unitMap.get(id);
    if (!u || u.grade === "슈퍼히든") return;
    e.preventDefault(); 
    let qty = activeUnits.get(id) || 1;
    if (e.deltaY < 0) qty++; else qty--; 
    if (qty > 16) qty = 16;
    if (qty < 1) qty = 1;
    if (activeUnits.get(id) !== qty) {
        activeUnits.set(id, qty);
        e.currentTarget.value = qty; 
        updateAllPanels(); 
    }
}

function setOwnedQty(id, val) {
    let q = parseInt(val);
    if (isNaN(q) || q < 0) q = 0;
    
    const inEl = document.getElementById(`d-in-${id}`);
    let maxQty = 99;
    if(inEl && inEl.hasAttribute('data-req')) {
        const reqVal = parseInt(inEl.getAttribute('data-req'));
        if(reqVal > 0) maxQty = reqVal;
    }
    
    if (q > maxQty) q = maxQty;
    ownedUnits.set(id, q);
    updateAllPanels();
}

function handleOwnedWheel(e, id) {
    e.preventDefault();
    
    const inEl = document.getElementById(`d-in-${id}`);
    let maxQty = 99;
    if(inEl && inEl.hasAttribute('data-req')) {
        const reqVal = parseInt(inEl.getAttribute('data-req'));
        if(reqVal > 0) maxQty = reqVal;
    }

    let qty = ownedUnits.get(id) || 0;
    if (e.deltaY < 0) qty++; else qty--;
    
    if (qty < 0) qty = 0;
    if (qty > maxQty) qty = maxQty;
    
    if (ownedUnits.get(id) !== qty) {
        ownedUnits.set(id, qty);
        if(inEl) inEl.value = qty;
        updateAllPanels();
    }
}

function updateMagicDashboard(){
    resetMagicDashboard(); 
    if(activeUnits.size===0 && ownedUnits.size===0) return;
    
    const totalMap={}; 
    dashboardAtoms.forEach(a=>{if(a==="갓오타/메시브")totalMap[a]={갓오타:0,메시브:0};else totalMap[a]=0;});

    Array.from(activeUnits.keys()).forEach(k=>{
        const u=unitMap.get(k);if(!u)return; const c=activeUnits.get(k)||1;
        if(u.cost&&!IGNORE_PARSE_RECIPES.includes(u.cost)) parseFixedCost(u.cost,c,totalMap);
        else calculateRecursiveCost(u.name,c,totalMap);
    });

    const ownedMap={};
    dashboardAtoms.forEach(a=>{if(a==="갓오타/메시브")ownedMap[a]={갓오타:0,메시브:0};else ownedMap[a]=0;});
    
    Array.from(ownedUnits.keys()).forEach(k=>{
        const c=ownedUnits.get(k)||0;
        if(c > 0) {
            if(k === '갓오타') { ownedMap['갓오타/메시브'].갓오타 += c; return; }
            if(k === '메시브') { ownedMap['갓오타/메시브'].메시브 += c; return; }
            const u=unitMap.get(k); if(!u) return;
            if(u.cost&&!IGNORE_PARSE_RECIPES.includes(u.cost)) parseFixedCost(u.cost,c,ownedMap);
            else calculateRecursiveCost(u.name,c,ownedMap);
        }
    });

    let totalMagic=0;
    dashboardAtoms.forEach(a=>{
        const val=totalMap[a], owned=ownedMap[a];
        const container=document.getElementById(`vslot-${clean(a)}`);if(!container)return;
        const e=container.querySelector('.cost-val'), nameEl=container.querySelector('.cost-name');

        if(a==="갓오타/메시브"){
            let finalG = Math.max(0, val.갓오타 - owned.갓오타);
            let finalM = Math.max(0, val.메시브 - owned.메시브);
            
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
                nameEl.style.display='none';
                container.classList.add('active');
            } else {
                e.innerHTML=EMPTY_SVG;
                nameEl.style.display='block';
            }
        } else {
            let finalVal = Math.max(0, val - owned);
            if(finalVal>0){
                e.innerText=Math.ceil(finalVal);
                nameEl.style.display='block';
                container.classList.add('active');
                totalMagic+=finalVal;
            } else {
                e.innerHTML=EMPTY_SVG;
                nameEl.style.display='block';
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
            <div class="d-name" style="color: ${color}">
                <span class="gtag" style="border-color:${color}44; color:${color}; margin-right:6px;">${grade}</span>${name}
            </div>
            <div class="d-inputs">
                <input type="number" id="d-in-${id}" min="0" max="99" value="${ownedUnits.get(id)||0}" 
                    onchange="setOwnedQty('${id}', this.value)" 
                    onwheel="handleOwnedWheel(event, '${id}')">
                <span class="d-sep">/</span>
                <span class="d-req" id="d-req-${id}">0</span>
            </div>
        </div>`;
    };

    let h = '';
    
    h += `<div id="deduct-empty-msg" style="text-align:center; padding:30px; color:var(--text-sub); font-weight:bold; width:100%; display:none;">
            좌측 유닛도감에서 목표 유닛을 선택하거나, 차감 맵핑에 보유 유닛을 입력하세요.
          </div>`;

    h += `<div class="deduct-group">
            <div class="deduct-group-title"><span style="color:var(--grade-unique);">★</span> 특수 및 기초 자원 맵핑</div>
            <div class="deduct-grid">
                ${renderSlot('갓오타', '갓오타', '레어')}
                ${renderSlot('메시브', '메시브', '유니크')}
                ${renderSlot('자동포탑', '자동포탑', '매직')}
                ${renderSlot('땅거미지뢰', '땅거미지뢰', '히든')}
            </div>
          </div>`;

    const topGrades = ["레전드", "헬", "유니크", "에픽", "레어"];
    let topItems = Array.from(unitMap.values()).filter(u => topGrades.includes(u.grade));
    topItems.sort((a, b) => GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade));
    
    h += `<div class="deduct-group">
            <div class="deduct-group-title"><span style="color:var(--grade-legend);">▲</span> 상위 등급 맵핑 (레전드 ~ 레어)</div>
            <div class="deduct-grid">
                ${topItems.map(u => renderSlot(u.id, u.name, u.grade)).join('')}
            </div>
          </div>`;

    let hiddenItems = Array.from(unitMap.values()).filter(u => u.grade === "히든");
    h += `<div class="deduct-group" style="margin-bottom:0;">
            <div class="deduct-group-title"><span style="color:var(--grade-hidden);">♦</span> 히든 등급 맵핑</div>
            <div class="deduct-grid">
                ${hiddenItems.map(u => renderSlot(u.id, u.name, u.grade)).join('')}
            </div>
          </div>`;

    DOM.deductionBoard.innerHTML = h;
}

function updateDeductionBoard() {
    if (!DOM.deductionBoard) return;
    const { reqMap, reasonMap } = calculateIntermediateRequirements();
    
    const totalMap={}; 
    dashboardAtoms.forEach(a=>{if(a==="갓오타/메시브")totalMap[a]={갓오타:0,메시브:0};else totalMap[a]=0;});
    Array.from(activeUnits.keys()).forEach(k=>{
        const u=unitMap.get(k);if(!u)return; const c=activeUnits.get(k)||1;
        if(u.cost&&!IGNORE_PARSE_RECIPES.includes(u.cost)) parseFixedCost(u.cost,c,totalMap);
        else calculateRecursiveCost(u.name,c,totalMap);
    });

    let specialReq = { 갓오타: 0, 메시브: 0 };
    let specialReason = { 갓오타: new Set(), 메시브: new Set() };
    
    Array.from(activeUnits.keys()).forEach(k=>{
        const u = unitMap.get(k); const qty = activeUnits.get(k) || 1;
        if(u && u.cost && !IGNORE_PARSE_RECIPES.includes(u.cost)) {
            u.cost.split(',').forEach(p=>{
                const m=p.match(/(.+?)\[(\d+(?:\.\d+)?)\]/);
                let name = m ? m[1].trim() : p.trim();
                let amount = m ? parseFloat(m[2])*qty : qty;
                if(clean(name).includes('메시브')||clean(name).includes('디제스터')){
                    specialReq.메시브 += amount;
                    specialReason.메시브.add(u.name);
                }
                if(clean(name).includes('갓오브타임')||clean(name).includes('갓오타')){
                    specialReq.갓오타 += amount;
                    specialReason.갓오타.add(u.name);
                }
            });
        }
    });

    const updateSlot = (id, targetVal, reasons) => {
        const reqEl = document.getElementById(`d-req-${id}`);
        const wrapEl = document.getElementById(`d-slot-wrap-${id}`);
        const inEl = document.getElementById(`d-in-${id}`);
        const reasonContainer = document.getElementById(`d-reason-${id}`);
        
        if(reqEl && wrapEl && inEl) {
            reqEl.innerText = targetVal;
            inEl.setAttribute('data-req', targetVal);
            
            let ownedVal = parseInt(inEl.value) || 0;
            if (targetVal > 0 && ownedVal > targetVal) {
                ownedVal = targetVal;
                ownedUnits.set(id, ownedVal);
                inEl.value = ownedVal;
            } else {
                inEl.value = ownedUnits.get(id) || 0;
                ownedVal = parseInt(inEl.value) || 0;
            }
            
            if (targetVal > 0 || ownedVal > 0) {
                wrapEl.style.display = 'flex';
                wrapEl.classList.add('is-visible');
            } else {
                wrapEl.style.display = 'none';
                wrapEl.classList.remove('is-visible');
            }

            if (reasonContainer) {
                if (reasons && reasons.size > 0 && targetVal > 0) {
                    let rHtml = Array.from(reasons).map(r => `<span class="d-reason-tag">${r} 재료</span>`).join('');
                    reasonContainer.innerHTML = rHtml;
                    reasonContainer.style.display = 'flex';
                } else {
                    reasonContainer.style.display = 'none';
                    reasonContainer.innerHTML = '';
                }
            }

            if(targetVal > 0) {
                wrapEl.classList.add('has-target');
                wrapEl.style.order = "-1"; 
                
                if(ownedVal >= targetVal) {
                    wrapEl.classList.add('satisfied');
                } else {
                    wrapEl.classList.remove('satisfied');
                }
            } else {
                wrapEl.classList.remove('has-target', 'satisfied');
                wrapEl.style.order = "0"; 
                
                if(ownedVal > 0) wrapEl.classList.add('has-owned');
                else wrapEl.classList.remove('has-owned');
            }
        }
    };

    updateSlot('갓오타', specialReq.갓오타, specialReason.갓오타);
    updateSlot('메시브', specialReq.메시브, specialReason.메시브);
    updateSlot('자동포탑', Math.max(reqMap.get('자동포탑') || 0, Math.ceil(totalMap['자동포탑'] || 0)), reasonMap.get('자동포탑'));
    updateSlot('땅거미지뢰', Math.max(reqMap.get('땅거미지뢰') || 0, Math.ceil(totalMap['땅거미지뢰'] || 0)), reasonMap.get('땅거미지뢰'));

    const targetGrades = ["레어", "에픽", "유니크", "헬", "레전드", "히든"];
    unitMap.forEach(u => {
        if(targetGrades.includes(u.grade) && u.id !== '자동포탑' && u.id !== '땅거미지뢰') {
            updateSlot(u.id, reqMap.get(u.id) || 0, reasonMap.get(u.id));
        }
    });

    let hasAnyVisible = false;
    document.querySelectorAll('.deduct-group').forEach(group => {
        const visibleSlots = group.querySelectorAll('.deduct-slot.is-visible');
        if (visibleSlots.length === 0) {
            group.style.display = 'none';
        } else {
            group.style.display = 'block';
            hasAnyVisible = true;
        }
    });

    const emptyMsg = document.getElementById('deduct-empty-msg');
    if (emptyMsg) {
        if (!hasAnyVisible) emptyMsg.style.display = 'block';
        else emptyMsg.style.display = 'none';
    }
}

function resetAll(){ activeUnits.clear(); ownedUnits.clear(); essenceUnits.clear(); updateAllPanels(); }

function renderTabs(){
    let h='';
    TAB_CATEGORIES.forEach((cat,idx)=>{
        let hasSelected = false;
        activeUnits.forEach((qty, id) => {
            const u = unitMap.get(id);
            if(u && u.category === cat.key) hasSelected = true;
        });

        const activeClass = idx === _activeTabIdx ? 'active' : '';
        const glowClass = hasSelected ? 'has-active' : '';

        const symColor = hasSelected ? 'var(--g)' : 'var(--text-sub)';
        const symBorder = hasSelected ? 'var(--g-border)' : 'var(--border-light)';
        const symGlow = hasSelected ? 'text-shadow:0 0 5px var(--g-glow); box-shadow:0 0 5px var(--g-faint);' : '';

        h+=`<button class="tab-btn ${activeClass} ${glowClass}" onclick="selectTab(${idx})">
                <span style="font-size:1.1rem; color:${symColor}; border:1px solid ${symBorder}; padding:2px 5px; border-radius:3px; background:rgba(0,0,0,0.3); ${symGlow}">${cat.sym}</span>
                <span>${cat.name}</span>
            </button>`;
    });
    DOM.codexTabs.innerHTML=h;
}

function formatRecipeHorizontal(item) {
    if (!item.recipe || IGNORE_PARSE_RECIPES.includes(item.recipe)) return `<div style="color:var(--text-muted);font-size:0.85rem;">정보 없음</div>`;

    let html = '<div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">';
    item.recipe.split(/\+(?![^()]*\))/).forEach((part, index, arr) => {
        const match = part.trim().match(/^([^(\[]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/);

        if (match) {
            const rawKo = match[1].trim();
            const u = unitMap.get(getUnitId(rawKo));

            let condTxt = match[2] ? `(${match[2]})` : '';
            let qtyTxt = match[3] ? `[${match[3]}]` : '[1]';

            const color = u && gradeColorsRaw[u.grade] ? gradeColorsRaw[u.grade] : "var(--text)";

            html += `
                <div class="recipe-badge" style="color:${color}; border-color:${color}44;">
                    ${rawKo} <span class="badge-cond">${condTxt}${qtyTxt}</span>
                </div>`;
        } else {
            html += `<div style="color:var(--text-sub); font-size:0.85rem; white-space:nowrap;">${part}</div>`;
        }
        
        if (index < arr.length - 1) {
            html += `<div style="color:var(--text-muted); font-size:0.9rem; font-weight:bold;">+</div>`;
        }
    });
    return html + '</div>';
}

function selectTab(idx){ _activeTabIdx=idx; renderTabs(); renderCurrentTabContent(); }

function renderCurrentTabContent() {
    const catKey = TAB_CATEGORIES[_activeTabIdx].key;

    let items = Array.from(unitMap.values()).filter(u => ["슈퍼히든","히든","레전드"].includes(u.grade) && u.category === catKey);

    items.sort((a,b) => {
        if(a.grade !== b.grade) return GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade);
        return calculateTotalCostScore(b.cost) - calculateTotalCostScore(a.cost);
    });

    let h='<div style="display:flex;flex-direction:column;gap:4px;">';

    if (items.length === 0) {
        h += `<div style="text-align:center; padding:30px; color:var(--text-sub); font-weight:bold; font-size:1.05rem;">해당 분류에 유닛이 없습니다.</div>`;
    }

    items.forEach((item, index) => {
        const isActive = activeUnits.has(item.id), qty = activeUnits.get(item.id) || 0;
        const unitEssence = getUnitEssenceTotal(item.id);
        const nameDisp = item.name;
        const multi = 1;

        // [UI 개선] 통합 뱃지 적용: 정수가 있으면 하나의 뱃지로 묶어 표기
        let gradeHtml = '';
        if (unitEssence > 0) {
            gradeHtml = `<span class="gtag sh-integrated" style="border-color:${gradeColorsRaw[item.grade]}44; color:${gradeColorsRaw[item.grade]};">${item.grade} <span class="badge-sep">/</span> <span style="color:var(--grade-super); text-shadow:0 0 8px rgba(255,215,0,0.6);">정수 ${unitEssence}</span></span>`;
        } else {
            gradeHtml = `<span class="gtag" style="border-color:${gradeColorsRaw[item.grade]}44; color:${gradeColorsRaw[item.grade]};">${item.grade}</span>`;
        }

        let rightControls = '';
        if (item.grade !== "슈퍼히든") {
            rightControls = `<div class="uc-ctrl" onclick="event.stopPropagation()">
                <div class="ctrl-qty">
                    <input type="number" class="ctrl-val-input" 
                        value="${isActive ? qty : ''}" 
                        placeholder="${isActive ? '' : '-'}"
                        min="1" max="16" 
                        onchange="setUnitQty('${item.id}', this.value)" 
                        onwheel="handleWheel(event, '${item.id}')"
                        ${!isActive ? 'disabled' : ''}>
                </div>
            </div>`;
        }

        h+=`<div class="unit-card ${isActive?'active':''}" style="animation-delay:${index * 0.03}s" onclick="toggleUnitSelection('${item.id}', ${multi})">
            <div class="uc-wrap">
                <div class="uc-info-stack">
                    <div class="uc-grade">
                        ${gradeHtml}
                    </div>
                    <div class="uc-name-row" style="color:${gradeColorsRaw[item.grade]};">
                        ${nameDisp}
                    </div>
                    <div class="uc-recipe-row">
                        ${formatRecipeHorizontal(item)}
                    </div>
                </div>
                ${rightControls}
            </div>
        </div>`;
    });
    h+='</div>'; DOM.tabContent.innerHTML=h;
}

function renderDashboardAtoms(){
    DOM.magicDashboard.innerHTML=`<div class="cost-slot total" id="slot-total-magic"><div class="cost-val"></div><div class="cost-name">총 매직 코스트</div></div><div class="cost-slot total" id="slot-total-essence"><div class="cost-val" id="essence-total-val"></div><div class="cost-name">총 정수 코스트</div></div><div class="cost-slot"><div class="cost-val" id="val-coral" style="color:#FF6B6B;"></div><div class="cost-name">코랄</div></div><div class="cost-slot"><div class="cost-val" id="val-aiur" style="color:var(--grade-rare);"></div><div class="cost-name">아이어</div></div><div class="cost-slot"><div class="cost-val" id="val-zerus" style="color:var(--grade-legend);"></div><div class="cost-name">제루스</div></div>`;
    dashboardAtoms.forEach(a=>{
        const isSkill = (a === "갓오타/메시브");
        const isMagic = !isSkill;

        const d=document.createElement('div');
        d.className='cost-slot'+(isMagic?' is-magic-slot':'')+(isSkill?' is-skill-slot':'');
        d.id=`vslot-${clean(a)}`;
        d.innerHTML=`<div class="cost-val"></div><div class="cost-name" id="name-${clean(a)}">${a}</div>`;
        DOM.magicDashboard.appendChild(d);
    });
}

function resetMagicDashboard(){
    document.querySelectorAll('#magicDashboard .cost-slot .cost-val').forEach(e => { e.innerHTML=EMPTY_SVG; e.style.display=""; });
    document.querySelectorAll('#magicDashboard .cost-slot .cost-name').forEach(e => e.style.display='block');
    document.querySelectorAll('#magicDashboard .cost-slot').forEach(e => e.classList.remove('active'));

    dashboardAtoms.forEach(a=>{
        const el = document.getElementById(`name-${clean(a)}`);
        if(el) el.innerHTML = a;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        document.documentElement.lang = 'ko';
        document.documentElement.setAttribute('data-theme', 'dark');

        DOM.tabContent = document.getElementById('tabContent');
        DOM.deductionBoard = document.getElementById('deductionBoard');
        DOM.codexTabs = document.getElementById('codexTabs');
        DOM.magicDashboard = document.getElementById('magicDashboard');

        if (typeof UNIT_DATABASE === 'undefined') {
            console.error("[오류] UNIT_DATABASE가 정의되지 않았습니다. data.js 파일 로드를 확인해주세요.");
            if (DOM.tabContent) DOM.tabContent.innerHTML = `<div style="padding:20px; color:var(--grade-unique); text-align:center; font-weight:bold;">시스템 데이터를 불러올 수 없습니다.<br>data.js 파일이 누락되었거나 오류가 있습니다.</div>`;
            return;
        }

        UNIT_DATABASE.forEach((kArr) => {
            const g = kArr[1] || "매직", cat = kArr[2] || "테바";
            const u={ id:clean(kArr[0]), name:kArr[0], grade:g, category:cat, recipe:kArr[3], cost:kArr[4] };
            unitMap.set(clean(kArr[0]), u);
        });

        renderDashboardAtoms();
        renderDeductionBoard();
        selectTab(0);
        
        updateAllPanels();
        
    } catch (err) {
        console.error("[오류] 넥서스 초기화 중 에러 발생:", err);
        if (DOM.tabContent) {
            DOM.tabContent.innerHTML = `<div style="padding:20px; color:var(--grade-unique); text-align:center; font-weight:bold;">치명적 오류 발생:<br>${err.message}</div>`;
        }
    }
});

document.addEventListener('contextmenu',e=>e.preventDefault());document.addEventListener('dragstart',e=>e.preventDefault());document.addEventListener('selectstart',e=>{if(e.target.tagName!=='INPUT')e.preventDefault()});window.addEventListener('keydown',e=>{if(e.keyCode===123||(e.ctrlKey&&e.shiftKey&&[73,74,67].includes(e.keyCode))||(e.ctrlKey&&e.keyCode===85))e.preventDefault()});

function openJewelModal(){document.getElementById('jewelModal').classList.add('active'); renderJewelGrid();}
function closeJewelModal(e){if(!e||e.target===document.getElementById('jewelModal'))document.getElementById('jewelModal').classList.remove('active');}

function renderJewelGrid(){
    const g=document.getElementById('jewelGrid'); if(g.innerHTML!=='') { g.innerHTML=''; }
    let h=''; const url="https://raw.githubusercontent.com/sldbox/site/main/image/jw/";

    JEWEL_DATABASE.forEach((koArr) => {
        const kr=koArr[0], krLeg=koArr[1], krMyth=koArr[2], imgName=koArr[3]||kr;
        const c = typeof JEWEL_COLORS !== 'undefined' && JEWEL_COLORS[kr] ? JEWEL_COLORS[kr] : "#ffffff";

        let mythHtml = '';
        if (krMyth && krMyth.trim() !== "") {
            mythHtml = `
                <div class="jw-stat mythic">
                    <div class="jw-stat-lbl">신화 능력 <span class="mythic-sparkle">✦</span></div>
                    <div class="jw-stat-val">${krMyth}</div>
                </div>
            `;
        }

        h+=`<div class="jewel-item">
            <div class="jewel-header">
                <div class="jewel-img-wrap" style="border-color:${c}80; color:${c}; box-shadow:inset 0 0 15px rgba(0,0,0,0.8), 0 0 15px ${c}40;">
                    <img src="${url}${imgName}.png" onerror="this.src=''" alt="${kr}">
                </div>
                <div class="jewel-name-txt" style="text-shadow:0 0 10px ${c}80;">${kr}</div>
            </div>
            <div class="jewel-body">
                <div class="jw-stat legend">
                    <div class="jw-stat-lbl">전설 능력</div>
                    <div class="jw-stat-val">${krLeg}</div>
                </div>
                ${mythHtml}
            </div>
        </div>`;
    });
    g.innerHTML=h;
}