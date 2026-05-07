/*
=============================================================================
[파일 설명서] app.js (핵심 기능 엔진)
- 용도: 유닛 코스트 계산, 쥬얼 도감 팝업, 다크/라이트모드 전환 등 
       화면의 모든 '움직임'과 '수학적 계산'을 담당하는 넥서스의 두뇌(엔진)입니다.
- 주의 사항: 이 파일은 초보자가 수정할 경우 전체 앱이 먹통이 될 수 있으므로 
           절대 내용을 지우거나 수정하지 마시길 강력히 권장합니다.
           (새로운 유닛 추가는 data.js에서 하시면 됩니다)
=============================================================================
*/

let _activeTabIdx=0,globalLineageState=false;
const unitMap=new Map(),activeUnits=new Map(),essenceUnits=new Set(),expandedTrees=new Set(),DOM={};
const clean=s=>s?s.replace(/\s+/g,'').toLowerCase():'';

function getUnitColor(name){
    const u=unitMap.get(clean(String(name).split(/[(\[▶▼]/)[0]));
    return u&&gradeColorsRaw[u.grade]?gradeColorsRaw[u.grade]:"var(--text)"
}
function gradeTag(grade){
    return `<span class="gtag" style="color:${gradeColorsRaw[grade]||'#fff'};border-color:${gradeColorsRaw[grade]||'#fff'}44;">${GRADE_SHORT[grade]||grade}</span>`
}

function calculateTotalCostScore(costStr){
    if(!costStr||["정보 부족","미발견","없음",""].includes(costStr))return 0;
    let score=0;
    costStr.split(',').forEach(p=>{const m=p.match(/\[(\d+(?:\.\d+)?)\]/);if(m)score+=parseFloat(m[1]);else score+=1});
    return score;
}

function processCostKeyword(rawName,amount,map){
    let matched=false;const cName=clean(rawName);
    for(const conf of specialKeywordMap){
        if(conf.keys.some(k=>cName.includes(clean(k)))){
            const val=conf.divider?amount/conf.divider:amount;
            if(conf.subKey){
                if(!map[conf.atom])map[conf.atom]={갓오타:0,메시브:0};
                map[conf.atom][conf.subKey]+=val
            }else map[conf.atom]=(map[conf.atom]||0)+val;
            matched=true;break
        }
    }
    if(!matched){
        const atom=dashboardAtoms.find(a=>clean(a.name)===cName);
        if(atom){map[atom.name]=(map[atom.name]||0)+amount;matched=true}
    }
    return matched
}

function parseFixedCost(costStr,multiplier,map){
    if(!costStr||["정보 부족","미발견","없음",""].includes(costStr))return;
    costStr.split(',').forEach(p=>{
        const m=p.match(/(.+?)\[(\d+(?:\.\d+)?)\]/);
        if(m)processCostKeyword(m[1].trim(),parseFloat(m[2])*multiplier,map);
        else processCostKeyword(p.trim(),multiplier,map)
    })
}

function calculateRecursiveCost(name,m,map,visited=new Set()){
    const pName=clean(name.split(/[(\[]/)[0]);
    if(visited.has(pName))return;
    const curV=new Set(visited);curV.add(pName);
    if(processCostKeyword(pName,m,map))return;
    const u=unitMap.get(pName);
    if(u&&u.recipe&&!IGNORE_PARSE_RECIPES.includes(u.recipe)){
        u.recipe.split('+').forEach(part=>{
            const match=part.trim().match(/^([^(\[]+)/);
            if(match){
                const ingName=match[1].trim(),cntMatch=part.match(/\[(\d+)\]/),cnt=cntMatch?parseInt(cntMatch[1]):1,childU=unitMap.get(clean(ingName));
                if(childU&&childU.cost&&!["정보 부족","미발견","없음",""].includes(childU.cost))parseFixedCost(childU.cost,cnt*m,map);
                else calculateRecursiveCost(ingName,cnt*m,map,curV)
            }else calculateRecursiveCost(part.trim(),m,map,curV)
        })
    }
}

function updateAllPanels() { updateMagicDashboard(); updateEssence(); renderTabs(); renderCurrentTabContent(); }

function toggleSelectAllInCurrentTab() {
    const catKey = TAB_CATEGORIES[_activeTabIdx].key;
    const items = Array.from(unitMap.values()).filter(u => u.category === catKey && ["슈퍼히든","히든","레전드"].includes(u.grade));
    const allSelected = items.length > 0 && items.every(u => activeUnits.has(clean(u.name)));

    items.forEach(u => {
        const cName = clean(u.name);
        if (allSelected) {
            activeUnits.delete(cName); essenceUnits.delete(cName); expandedTrees.delete(u.name);
        } else if (!activeUnits.has(cName)) {
            activeUnits.set(cName, 1); essenceUnits.add(cName); if(globalLineageState) expandedTrees.add(u.name);
        }
    });
    updateAllPanels();
}

function toggleGlobalLineage() {
    globalLineageState = !globalLineageState;
    const btn = document.getElementById('btnToggleLineage');
    if(btn) btn.classList.toggle('active', globalLineageState);
    expandedTrees.clear();
    if(globalLineageState) { for(let key of activeUnits.keys()) { const u = unitMap.get(key); if(u) expandedTrees.add(u.name); } }
    renderCurrentTabContent();
}

function toggleUnitSelection(name){
    const cName=clean(name);
    if(activeUnits.has(cName)){
        activeUnits.delete(cName); essenceUnits.delete(cName); expandedTrees.delete(name);
    }else{
        activeUnits.set(cName,1); essenceUnits.add(cName); if(globalLineageState) expandedTrees.add(name);
    }
    updateAllPanels();
}

function changeUnitQty(name,delta){
    const cName=clean(name); 
    const u = unitMap.get(cName);
    if(u && u.grade === "슈퍼히든") return; 
    
    let qty=activeUnits.get(cName)||0; qty+=delta;
    if(qty<1){ activeUnits.delete(cName); essenceUnits.delete(cName); expandedTrees.delete(name);
    }else{ if(qty>8)qty=8; activeUnits.set(cName,qty); essenceUnits.add(cName); if(globalLineageState) expandedTrees.add(name); }
    updateAllPanels();
}

function calcEssenceRecursive(uName, counts, visited) {
    const cleanName = clean(uName); if(visited.has(cleanName)) return; visited.add(cleanName);
    const u = unitMap.get(cleanName); if(!u) return;
    if(["히든", "슈퍼히든"].includes(u.grade)) {
        let cat = u.category;
        if(["테바","테메"].includes(cat)) counts.coral += 1; else if(["토바","토메"].includes(cat)) counts.aiur += 1; else if(cat === "저그중립") counts.zerus += 1; else if(cat === "혼종") { counts.coral += 1; counts.aiur += 1; counts.zerus += 1; }
    }
    if(u.recipe && !IGNORE_PARSE_RECIPES.includes(u.recipe)) {
        u.recipe.split('+').forEach(part => { const match = part.trim().match(/^([^(\[]+)/); if(match) calcEssenceRecursive(match[1], counts, visited); });
    }
}

function getUnitEssenceTotal(uName) {
    const u = unitMap.get(clean(uName));
    if (!u || !["히든", "슈퍼히든"].includes(u.grade)) return 0;
    let counts = {coral:0, aiur:0, zerus:0}, visited = new Set();
    calcEssenceRecursive(uName, counts, visited);
    return counts.coral + counts.aiur + counts.zerus;
}

function updateEssence(){
    let counts={coral:0, aiur:0, zerus:0}, visited = new Set();
    activeUnits.forEach((qty, key) => { 
        const u = unitMap.get(key);
        if(u && ["히든", "슈퍼히든"].includes(u.grade)) {
            calcEssenceRecursive(key, counts, visited); 
        }
    });
    const setVal=(id,v)=>{const el=document.getElementById(id);if(el){el.innerText=v;el.parentElement.className='cost-slot'+(el.parentElement.id.includes('magic')?' is-magic-slot':'')+(id.includes('total')?' total':'')+(v>0?' active':'')}};
    setVal('val-coral',counts.coral);setVal('val-aiur',counts.aiur);setVal('val-zerus',counts.zerus);setVal('essence-total-val',counts.coral+counts.aiur+counts.zerus);
}

function updateMagicDashboard(){
    resetMagicDashboard(); if(activeUnits.size===0) return;
    const totalMap={}; dashboardAtoms.forEach(a=>{if(a.name==="갓오타/메시브")totalMap[a.name]={갓오타:0,메시브:0};else totalMap[a.name]=0;});
    Array.from(activeUnits.keys()).forEach(k=>{
        const u=unitMap.get(k);if(!u)return; const c=activeUnits.get(k)||1;
        if(u.cost&&!["정보 부족","미발견","없음",""].includes(u.cost)) parseFixedCost(u.cost,c,totalMap); else calculateRecursiveCost(u.name,c,totalMap);
    });
    let totalMagic=0;
    dashboardAtoms.forEach(a=>{
        const val=totalMap[a.name], container=document.getElementById(`vslot-${a.name}`);if(!container)return;
        const e=container.querySelector('.cost-val'), nameEl=container.querySelector('.cost-name');
        if(a.name==="갓오타/메시브"){
            if(val.갓오타>0||val.메시브>0){
                let h=""; if(val.갓오타>0){h+=`<div style="font-size:0.9rem;color:var(--grade-rare);">갓오타 ${Math.ceil(val.갓오타)}</div>`;totalMagic+=val.갓오타;}
                if(val.메시브>0){h+=`<div style="font-size:0.9rem;color:var(--grade-unique);">메시브 ${Math.ceil(val.메시브)}</div>`;totalMagic+=val.메시브;}
                e.innerHTML=h;nameEl.style.display='none';container.classList.add('active');
            }
        }else if(val>0){ e.innerText=Math.ceil(val);nameEl.style.display='block';container.classList.add('active');totalMagic+=val; }
    });
    const magicTotalEl=document.querySelector('#slot-total-magic .cost-val');
    if(magicTotalEl){magicTotalEl.innerText=Math.ceil(totalMagic);magicTotalEl.parentElement.classList.toggle('active',totalMagic>0);}
}

function buildTree(key,visited=new Set(),isRoot=false,conditionStr='',depth=0){const u=unitMap.get(key);if(!u)return`<li class="tree-li"><div class="tree-node-wrapper"><div class="unit-badge">${key}</div><span style="color:var(--text-sub);font-size:0.85rem;">${conditionStr}</span></div></li>`;if(visited.has(key))return`<li class="tree-li"><div class="tree-node-wrapper"><div class="unit-badge" style="color:var(--text-muted);opacity:0.5;">${u.name} (중복)</div></div></li>`;const newV=new Set(visited);newV.add(key);let ch='';if(u.recipe&&!IGNORE_PARSE_RECIPES.includes(u.recipe)){u.recipe.split('+').forEach(part=>{const match=part.trim().match(/^([^(\[]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/);if(match){const childName=clean(match[1]),cond=match[2]?`(${match[2]})`:'',cnt=match[3]?`[${match[3]}]`:'',combined=`${cond}${cnt}`,target=unitMap.get(childName);if(target&&target.key!==u.key)ch+=buildTree(target.key||childName,newV,false,combined,depth+1);else ch+=`<li class="tree-li"><div class="tree-node-wrapper"><div class="unit-badge" style="color:var(--text-muted);">${match[1].trim()}</div><span style="color:var(--text-sub);font-size:0.85rem;">${combined}</span></div></li>`}else{const childName=clean(part),target=unitMap.get(childName);if(target&&target.key!==u.key)ch+=buildTree(target.key||childName,newV,false,'',depth+1)}})}const ulStyle=depth===0?'block':'none',mark=depth===0?'▼':'▶',bulletDisplay=depth===0?'block':'none',isRedundant=u.recipe&&u.cost&&clean(u.recipe).replace(/\+/g,',')===clean(u.cost).replace(/\+/g,',');return`<li class="tree-li"><div class="tree-node-wrapper"><div class="unit-badge" style="color:${getUnitColor(u.name)};" onclick="toggleTreeNode(this)">${u.name}${ch?`<span class="toggle-mark">${mark}</span>`:''}</div>${conditionStr?`<span style="color:var(--text-sub);font-size:0.82rem;">${conditionStr}</span>`:''}</div>${(u.recipe&&!["미발견","없음",""].includes(u.recipe))?`<div class="bullet-recipe" style="display:${bulletDisplay};">조합: ${u.recipe}</div>`:''}${(u.cost&&!isRedundant&&!["미발견","없음",""].includes(u.cost))?`<div class="bullet-cost" style="display:${bulletDisplay};">비용: ${u.cost}</div>`:''}${ch?`<ul class="tree-ul ${isRoot?'root-ul':''}" style="display:${ulStyle};">${ch}</ul>`:''}</li>`}
function toggleAllTree(btn){const card=btn.closest('.analysis-card'),isExpanded=btn.getAttribute('data-expanded')==='true';if(isExpanded){const rootNode=card.querySelector('.tree-ul.root-ul > .tree-li');if(rootNode){const firstLevelUl=rootNode.querySelector(':scope > .tree-ul');if(firstLevelUl){firstLevelUl.querySelectorAll('.tree-ul').forEach(el=>el.style.display='none');firstLevelUl.querySelectorAll('.bullet-recipe,.bullet-cost').forEach(el=>el.style.display='none');firstLevelUl.querySelectorAll('.toggle-mark').forEach(el=>el.innerText='▶')}}btn.innerText='모두 펼치기'}else{card.querySelectorAll('.tree-ul').forEach(el=>el.style.display='block');card.querySelectorAll('.bullet-recipe,.bullet-cost').forEach(el=>el.style.display='block');card.querySelectorAll('.toggle-mark').forEach(el=>el.innerText='▼');btn.innerText='모두 접기'}btn.setAttribute('data-expanded',!isExpanded)}
function toggleTreeNode(el){const p=el.closest('.tree-li'),r=p.querySelector(':scope>.bullet-recipe'),c=p.querySelector(':scope>.bullet-cost'),t=p.querySelector(':scope>.tree-ul'),m=p.querySelector(':scope>.tree-node-wrapper .toggle-mark');if(t)t.style.display=t.style.display==='none'?'block':'none';if(r)r.style.display=r.style.display==='none'?'block':'none';if(c)c.style.display=c.style.display==='none'?'block':'none';if(m)m.innerText=m.innerText==='▶'?'▼':'▶'}

function resetAll(){ activeUnits.clear(); essenceUnits.clear(); expandedTrees.clear(); globalLineageState=false; const btn=document.getElementById('btnToggleLineage'); if(btn)btn.classList.remove('active'); updateAllPanels(); }

function renderTabs(){
    let h=''; TAB_CATEGORIES.forEach((cat,idx)=>{
        const items=Array.from(unitMap.values()).filter(u=>u.category===cat.key&&["슈퍼히든","히든","레전드"].includes(u.grade)), total=items.length, sel=items.filter(u=>activeUnits.has(clean(u.name))).length;
        h+=`<button class="tab-btn ${idx===_activeTabIdx?'active':''}" onclick="selectTab(${idx})"><span>${cat.label}</span><span style="font-size:0.75rem; opacity:0.8; margin-top:2px; ${sel>0?'color:var(--g);':'color:inherit;'}">(${sel}/${total})</span></button>`;
    });
    document.getElementById('codexTabs').innerHTML=h;
}

function formatRecipeVertical(recipeStr) {
    if (!recipeStr || ["정보 부족","미발견","없음",""].includes(recipeStr)) return '<div style="color:var(--text-muted);font-size:0.9rem;display:flex;align-items:center;height:100%;">정보 없음</div>';
    let html = '<div style="display:flex;flex-direction:column;gap:6px;width:100%;">';
    recipeStr.split('+').forEach(part => {
        const match = part.trim().match(/^([^(\[]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/);
        if (match) {
            const name=match[1].trim(), cond=match[2]?`(${match[2]})`:'', cnt=match[3]?`[${match[3]}]`:'[1]', color=getUnitColor(name);
            html+=`<div style="display:flex;align-items:center;gap:8px;justify-content:flex-start; word-break:keep-all;"><div style="border:1px solid var(--border-light); border-radius:3px; padding:4px 10px; background:var(--slot-bg); color:${color}; font-size:0.9rem; font-weight:bold; display:flex; align-items:center; gap:6px; white-space:nowrap;">${name} <span style="font-size:0.65rem;opacity:0.7;">▶</span></div><span style="color:var(--text-sub);font-size:0.95rem; word-break:break-word;">${cond}${cnt}</span></div>`;
        } else html+=`<div style="color:var(--text-sub);font-size:0.95rem; word-break:break-word;">${part}</div>`;
    });
    return html + '</div>';
}

function selectTab(idx){ _activeTabIdx=idx; renderTabs(); renderCurrentTabContent(); }

function renderCurrentTabContent() {
    const catKey = TAB_CATEGORIES[_activeTabIdx].key;
    let items = Array.from(unitMap.values()).filter(u => u.category === catKey && ["슈퍼히든","히든","레전드"].includes(u.grade));
    
    items.sort((a,b) => { 
        if(a.grade !== b.grade) return GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade);
        return calculateTotalCostScore(b.cost) - calculateTotalCostScore(a.cost); 
    });
    
    let h='<div style="display:flex;flex-direction:column;gap:6px;">';
    items.forEach(item => {
        const cName = clean(item.name), isActive = activeUnits.has(cName), qty = activeUnits.get(cName) || 0;
        const unitEssence = getUnitEssenceTotal(item.name);
        
        let treeHtml = '';
        if (expandedTrees.has(item.name) && globalLineageState) {
            let upperHtml = '';
            if (["레전드","히든","헬","슈퍼히든"].includes(item.grade)) {
                const parents = Array.from(unitMap.values()).filter(u => ["히든","슈퍼히든"].includes(u.grade) && u.name !== item.name && u.recipe && u.recipe.includes(item.name));
                if (parents.length > 0) {
                    parents.sort((a,b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade));
                    upperHtml += `<div style="margin-bottom:12px;"><div style="color:var(--grade-rare); font-size:0.85rem; margin-bottom:6px;">> 상위 조합 가능</div><div style="display:flex; flex-wrap:wrap; gap:6px;">`;
                    parents.forEach(p => { upperHtml += `<div class="unit-badge" style="color:${getUnitColor(p.name)}; padding:4px 8px; font-size:0.8rem;" onclick="event.stopPropagation(); toggleUnitSelection('${p.name}')">${p.name}</div>`; });
                    upperHtml += `</div></div>`;
                }
            }
            treeHtml = `<div class="analysis-card" style="margin-top:10px; margin-bottom:0; width:100%; border-left-color:var(--g); background:var(--badge-bg);" onclick="event.stopPropagation()"><h3 style="border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--g); font-size:0.9rem;">[계보]</span><button class="btn-small" data-expanded="false" onclick="event.stopPropagation(); toggleAllTree(this)">모두 펼치기</button></h3>${upperHtml}<ul class="tree-ul root-ul" style="display:block; padding-left:0;">${buildTree(item.key, new Set(), true, '', 0)}</ul></div>`;
        }
        
        const cardBg = isActive ? 'var(--g-faint)' : 'var(--card-bg)';
        const cardBorder = isActive ? 'var(--g-border)' : 'var(--border)';

        let rightControls = '';
        const badgeClass = item.grade === "슈퍼히든" ? "badge-essence sh" : "badge-essence";
        const essenceBox = unitEssence > 0 ? `<div class="${badgeClass}">정수[${unitEssence}]</div>` : '';

        if (item.grade === "슈퍼히든") {
            rightControls = `
            <div style="flex:0 0 auto; padding:10px; display:flex; gap:8px; align-items:center; justify-content:flex-end;" onclick="event.stopPropagation()">
                ${essenceBox}
            </div>`;
        } else {
            rightControls = `
            <div style="flex:0 0 auto; padding:10px; display:flex; gap:8px; align-items:center; justify-content:flex-end;" onclick="event.stopPropagation()">
                ${essenceBox}
                <div class="ctrl-qty">
                    <button class="ctrl-btn minus" onclick="changeUnitQty('${item.name}', -1)">−</button>
                    <div class="ctrl-val">${qty}</div>
                    <button class="ctrl-btn plus" onclick="changeUnitQty('${item.name}', 1)">+</button>
                </div>
            </div>`;
        }

        h+=`<div class="unit-card ${isActive?'active':''}" style="display:flex; flex-direction:column; padding:0; background:${cardBg}; border:1px solid ${cardBorder}; border-left:3px solid ${isActive?'var(--g)':'transparent'}; border-radius:3px; min-height:85px; margin-bottom:4px; cursor:pointer; transition:all 0.2s;" onclick="toggleUnitSelection('${item.name}')">
            <div style="display:flex; align-items:stretch; width:100%; flex-wrap:wrap;">
                
                <div style="flex:0 0 160px; padding:10px 12px; display:flex; align-items:center;">
                    <div style="color:${getUnitColor(item.name)}; font-weight:bold; font-size:1.2rem; display:flex; align-items:center; gap:8px;">${gradeTag(item.grade)} ${item.name}</div>
                </div>
                <div style="width:1px; background:var(--border); margin:10px 0;"></div>
                
                <div style="flex:1; min-width:200px; padding:10px 12px; display:flex; flex-direction:column; justify-content:center;">${formatRecipeVertical(item.recipe)}</div>
                <div style="width:1px; background:var(--border); margin:10px 0;"></div>
                
                ${rightControls}

            </div>${treeHtml}
        </div>`;
    });
    h+='</div>'; document.getElementById('tabContent').innerHTML=h;
}

function renderDashboardAtoms(){
    DOM.magicDashboard.innerHTML=`<div class="cost-slot total" id="slot-total-magic"><div class="cost-val">0</div><div class="cost-name">총매직코스트</div></div><div class="cost-slot total" id="slot-total-essence"><div class="cost-val" id="essence-total-val">0</div><div class="cost-name">총정수코스트</div></div><div class="cost-slot"><div class="cost-val" id="val-coral" style="color:#FF6B6B;">0</div><div class="cost-name">코랄</div></div><div class="cost-slot"><div class="cost-val" id="val-aiur" style="color:var(--grade-rare);">0</div><div class="cost-name">아이어</div></div><div class="cost-slot"><div class="cost-val" id="val-zerus" style="color:var(--grade-legend);">0</div><div class="cost-name">제루스</div></div>`;
    dashboardAtoms.forEach(a=>{ const u=unitMap.get(clean(a.name)), isMagic=u&&u.grade==='매직', d=document.createElement('div'); d.className='cost-slot'+(isMagic?' is-magic-slot':''); d.id=`vslot-${a.name}`; d.innerHTML=`<div class="cost-val">0</div><div class="cost-name">${a.name}</div>`; DOM.magicDashboard.appendChild(d); });
}

function resetMagicDashboard(){
    document.querySelectorAll('#magicDashboard .cost-slot .cost-val').forEach(e => { e.innerHTML="0"; e.style.display=""; });
    document.querySelectorAll('#magicDashboard .cost-slot .cost-name').forEach(e => e.style.display='block');
    document.querySelectorAll('#magicDashboard .cost-slot').forEach(e => e.classList.remove('active'));
}

function openHelpModal(){document.getElementById('helpModal').classList.add('active')}
function closeHelpModal(e){if(e===undefined||e.target.id==='helpModal')document.getElementById('helpModal').classList.remove('active')}

function toggleTheme() {
    const doc = document.documentElement;
    const currentTheme = doc.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    doc.setAttribute('data-theme', newTheme);
    localStorage.setItem('nexus_obd_theme', newTheme);
    const btn = document.getElementById('btnTheme');
    if (btn) btn.innerHTML = newTheme === 'light' ? '🌙 다크' : '☀️ 라이트';
}

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('nexus_obd_theme');
    const btnTheme = document.getElementById('btnTheme');
    if (btnTheme && savedTheme === 'light') btnTheme.innerHTML = '🌙 다크';

    setTimeout(() => {
        const intro = document.getElementById('introCinematic');
        if(intro) { intro.style.opacity = '0'; setTimeout(() => intro.remove(), 500); }
    }, 1500);

    RAW_UNIT_DATABASE.forEach(arr=>{ const u={name:arr[0],grade:arr[1],category:arr[2],recipe:arr[3],cost:arr[4],key:clean(arr[0])}; unitMap.set(u.key,u); });
    DOM.magicDashboard=document.getElementById('magicDashboard');
    renderDashboardAtoms();
    document.getElementById('mainLayout').classList.add('visible');
    selectTab(0); 

    const titles=['개복디 넥서스','DATA MATRIX','SYSTEM ONLINE','ACCESS GRANTED'];
    let titleIdx=0;const brandEl=document.getElementById('brandCycle');
    setInterval(()=>{titleIdx=(titleIdx+1)%titles.length;brandEl.style.animation='none';void brandEl.offsetWidth;brandEl.innerText=titles[titleIdx];brandEl.style.animation=''},8000);
});

document.addEventListener('contextmenu',e=>e.preventDefault());document.addEventListener('dragstart',e=>e.preventDefault());document.addEventListener('selectstart',e=>{if(e.target.tagName!=='INPUT')e.preventDefault()});window.addEventListener('keydown',e=>{if(e.keyCode===123||(e.ctrlKey&&e.shiftKey&&[73,74,67].includes(e.keyCode))||(e.ctrlKey&&e.keyCode===85))e.preventDefault()});

function openJewelModal(){document.getElementById('jewelModal').classList.add('active'); renderJewelGrid();}
function closeJewelModal(e){if(!e||e.target===document.getElementById('jewelModal'))document.getElementById('jewelModal').classList.remove('active');}
function renderJewelGrid(){
    const g=document.getElementById('jewelGrid'); if(g.innerHTML!=='')return;
    let h=''; const url="https://raw.githubusercontent.com/sldbox/site/main/image/jw/";
    const cMap={"가넷":"#ff1e1e","아메시스트":"#9d4edd","아쿠아마린":"#4cc9f0","다이아몬드":"#ffffff","에메랄드":"#2ecc71","펄":"#fefae0","루비":"#e63946","페리도트":"#aacc00","사파이어":"#0077b6","오팔":"#ffafcc","토파즈":"#ffd700","터쿼이즈":"#40e0d0","블러드스톤":"#8a0303","스피넬":"#ff4d4d","플로라이트":"#90ee90","라피스":"#0000ff","헬리오도르":"#dfdf00","제트":"#1a1a1a","아게이트":"#e0af1f","올리빈":"#9ab973","히아신스":"#ff8c00","크리소베릴":"#dfff00","파파라챠":"#ff8b61","탄자나이트":"#483d8b","루벨라이트":"#e0115f"};
    for(let i=0;i<JEWEL_RAW_DATA.length;i+=4){
        const en=JEWEL_RAW_DATA[i],kr=JEWEL_RAW_DATA[i+1],leg=JEWEL_RAW_DATA[i+2],myth=JEWEL_RAW_DATA[i+3],c=cMap[kr]||"#fff"; if(!en) continue;
        h+=`<div onclick="openJewelPopup('${en}','${kr}','${leg}','${myth}','${c}')" style="cursor:pointer;display:flex;flex-direction:column;align-items:center;background:var(--jewel-card);padding:15px;border-radius:10px;border:1px solid var(--border);"><div style="width:120px;height:120px;border-radius:50%;border:2px solid ${c}80;display:flex;justify-content:center;align-items:center;margin-bottom:15px;overflow:hidden;background:var(--jewel-card);"><img src="${url}${en}.png" style="width:145%;height:145%;object-fit:cover;"></div><div style="font-size:0.75rem;color:var(--text-sub);font-family:'Cinzel',serif;">${en.toUpperCase()}</div><div style="font-size:1.6rem;color:var(--text);font-family:'Song Myung',serif;">${kr}</div></div>`;
    }
    g.innerHTML=h;
}
function openJewelPopup(e,k,l,m,c){
    const url="https://raw.githubusercontent.com/sldbox/site/main/image/jw/";
    document.getElementById('jp-img').src=`${url}${e}.png`; document.getElementById('jp-en').innerText=e.toUpperCase(); document.getElementById('jp-kr').innerText=k; document.getElementById('jp-leg').innerText=l;
    const mArea=document.getElementById('jp-myth-area'); if(m&&m.trim()!==""){mArea.style.display='block';document.getElementById('jp-myth').innerText=m;}else{mArea.style.display='none';}
    document.getElementById('jp-color-border').style.borderColor=c; document.getElementById('jp-color-border').style.boxShadow=`0 0 20px ${c}`; document.getElementById('jewel-popup-overlay').style.display='flex';
}
function closeJewelPopup(){document.getElementById('jewel-popup-overlay').style.display='none';}
