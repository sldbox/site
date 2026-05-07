/*
=============================================================================
[파일 설명서] app.js
- 시스템 초기화 및 코스트 수학 계산 (한국어 전용 개복디 넥서스)
- 스마트 부분 검색(findBestUnitMatch) 및 *N 자동 합산 기능
- 계보(Lineage) 보기 UI 복구: 조합/비용 텍스트 트리 형태 유지 (조합 텍스트 삭제 및 비용 하단 배치 적용)
- 계보 트리의 노드 뱃지를 심플한 버튼 형태로 재정립
- 매직 코스트 매트릭스 전체 칸 파란색 테마 동기화 로직 적용
- [삭제됨] 쥬얼 상세 팝업 오픈/클로즈 로직 및 팝업 이벤트 폐기
- [수정완료] 쥬얼 도감 리스트에 전설/신화 능력이 직접 노출되도록 렌더링 변경
- [수정완료] 공지사항 전용 모달 오픈/클로즈 제어 함수 추가
- [수정완료] 인트로 시네마틱 시간 연장 (3.2초 -> 4.5초) 및 트랜지션 타임스텝 조정
- [수정완료] 유닛 카드 우측 컨트롤 박스 통합 렌더링 구조로 개선
- [개선사항적용완료] 렌더링 반복문 내 index 매개변수 누락으로 인한 인트로 무한 로딩 오류(ReferenceError) 완벽 수정
=============================================================================
*/

let _activeTabIdx = 0, globalLineageState = false;
const unitMap = new Map(), activeUnits = new Map(), essenceUnits = new Set(), expandedTrees = new Set(), DOM = {};
const clean = s => s ? s.replace(/\s+/g, '').toLowerCase() : '';

const GRADE_ORDER = ["Magic", "Rare", "Epic", "Unique", "Hell", "Legend", "Hidden", "SuperHidden"];
const gradeColorsRaw = { "Magic":"var(--grade-magic)", "Rare":"var(--grade-rare)", "Epic":"var(--grade-epic)", "Unique":"var(--grade-unique)", "Hell":"var(--grade-hell)", "Legend":"var(--grade-legend)", "Hidden":"var(--grade-hidden)", "SuperHidden":"var(--grade-super)" };
const GRADE_SHORT = { Magic:'M', Rare:'R', Epic:'E', Unique:'U', Hell:'HE', Legend:'L', Hidden:'H', SuperHidden:'SH' };
const TAB_CATEGORIES = [ {key:"TBio", name:"테바"}, {key:"TMech", name:"테메"}, {key:"PBio", name:"토바"}, {key:"PMech", name:"토메"}, {key:"Zerg", name:"저그중립"}, {key:"Hybrid", name:"혼종"} ];
const gradeMap = {"매직":"Magic", "레어":"Rare", "에픽":"Epic", "유니크":"Unique", "헬":"Hell", "레전드":"Legend", "히든":"Hidden", "슈퍼히든":"SuperHidden"};
const raceMap = {"테바":"TBio", "테메":"TMech", "토바":"PBio", "토메":"PMech", "저그중립":"Zerg", "혼종":"Hybrid"};
const IGNORE_PARSE_RECIPES = ["미발견", "없음", "", "100라운드이전까지저그업20↑ [(타 종족 업 0)[1],역전 복권10회[1],인생 복권3회시-소환[1]]"];

const dashboardAtoms = ["전쟁광", "스파르타중대", "암흑광전사", "암흑파수기", "원시바퀴", "저격수", "코브라", "암흑고위기사", "암흑추적자", "변종가시지옥", "망치경호대", "공성파괴단", "암흑집정관", "암흑불멸자", "원시히드라리스크", "땅거미지뢰", "자동포탑", "우르사돈[암]", "우르사돈[수]", "갓오타/메시브"];

const specialKeywordMap = [
    {keys:["자동포탑"], atom:"자동포탑"}, {keys:["잠복"], atom:"잠복"},
    {keys:["지뢰", "시체매"], atom:"땅거미지뢰", divider:12},
    {keys:["우르사돈[암]", "우르사돈암"], atom:"우르사돈[암]"}, {keys:["우르사돈[수]", "우르사돈수"], atom:"우르사돈[수]"},
    {keys:["메시브", "디제스터"], atom:"갓오타/메시브", subKey:"메시브"}, 
    {keys:["갓오브타임", "갓오타"], atom:"갓오타/메시브", subKey:"갓오타"}
];

const EMPTY_SVG = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.2;"><rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect><line x1="3" y1="21" x2="21" y2="3"></line></svg>`;

function getUnitId(rawName){ const c=clean(rawName); const u=unitMap.get(c); return u ? u.id : c; }

function calculateTotalCostScore(costStr){
    if(!costStr||IGNORE_PARSE_RECIPES.includes(costStr))return 0;
    let score=0; costStr.split(',').forEach(p=>{const m=p.match(/\[(\d+(?:\.\d+)?)\]/);if(m)score+=parseFloat(m[1]);else score+=1}); return score;
}

function processCostKeyword(rawName,amount,map){
    let matched=false;const cName=clean(rawName);
    for(const conf of specialKeywordMap){
        if(conf.keys.some(k=>cName.includes(clean(k)))){
            const val=conf.divider?amount/conf.divider:amount;
            if(conf.subKey){ if(!map[conf.atom])map[conf.atom]={갓오타:0,메시브:0}; map[conf.atom][conf.subKey]+=val; }
            else map[conf.atom]=(map[conf.atom]||0)+val; matched=true;break;
        }
    }
    if(!matched){
        const uid = getUnitId(cName); const atomId = dashboardAtoms.find(a=>clean(a)===uid) || uid;
        map[atomId]=(map[atomId]||0)+amount; matched=true;
    }
    return matched;
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

function updateAllPanels() { updateMagicDashboard(); updateEssence(); renderTabs(); renderCurrentTabContent(); }

function toggleSelectAllInCurrentTab() {
    const q = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase().trim() : '';
    const catKey = TAB_CATEGORIES[_activeTabIdx].key;
    
    let items = Array.from(new Set(Array.from(unitMap.values()))).filter(u => ["SuperHidden","Hidden","Legend"].includes(u.grade));
    
    if (q) {
        const queries = q.split(/[\/,]/).map(s => s.trim()).filter(s => s.length > 0);
        items = items.filter(u => {
            const searchStr = `${u.name} ${u.recipe} ${u.grade} ${u.category} ${GRADE_SHORT[u.grade]}`.toLowerCase();
            return queries.some(query => {
                let namePart = query;
                if(query.includes('*')) namePart = query.split('*')[0].trim();
                return searchStr.includes(namePart);
            }); 
        });
    } else {
        items = items.filter(u => u.category === catKey);
    }
    
    const allSelected = items.length > 0 && items.every(u => activeUnits.has(u.id));
    items.forEach(u => {
        if (allSelected) { activeUnits.delete(u.id); essenceUnits.delete(u.id); expandedTrees.delete(u.id); } 
        else if (!activeUnits.has(u.id)) { activeUnits.set(u.id, 1); essenceUnits.add(u.id); if(globalLineageState) expandedTrees.add(u.id); }
    });
    updateAllPanels();
}

function toggleGlobalLineage() {
    globalLineageState = !globalLineageState;
    const btn = document.getElementById('btnToggleLineage'); if(btn) btn.classList.toggle('active', globalLineageState);
    expandedTrees.clear(); if(globalLineageState) { for(let key of activeUnits.keys()) expandedTrees.add(key); }
    renderCurrentTabContent();
}

function toggleUnitSelection(id){
    if(activeUnits.has(id)){
        activeUnits.delete(id); essenceUnits.delete(id); expandedTrees.delete(id);
    } else {
        activeUnits.set(id, 1); essenceUnits.add(id);
        if(globalLineageState) expandedTrees.add(id);
    }
    updateAllPanels();
}

function changeUnitQty(id,delta){
    const u = unitMap.get(id); if(u && u.grade === "SuperHidden") return; 
    let qty = activeUnits.get(id) || 0; 
    qty += delta;
    if(qty < 1){ activeUnits.delete(id); essenceUnits.delete(id); expandedTrees.delete(id); }
    else { 
        if(qty > 16) qty = 16; 
        activeUnits.set(id, qty); 
        essenceUnits.add(id); 
        if(globalLineageState) expandedTrees.add(id); 
    }
    updateAllPanels();
}

function calcEssenceRecursive(uid, counts, visited) {
    if(visited.has(uid)) return; visited.add(uid);
    const u = unitMap.get(uid); if(!u) return;
    if(["Hidden", "SuperHidden"].includes(u.grade)) {
        if(["TBio","TMech"].includes(u.category)) counts.coral += 1; 
        else if(["PBio","PMech"].includes(u.category)) counts.aiur += 1; 
        else if(u.category === "Zerg") counts.zerus += 1; 
        else if(u.category === "Hybrid") { counts.coral += 1; counts.aiur += 1; counts.zerus += 1; }
    }
    if(u.recipe && !IGNORE_PARSE_RECIPES.includes(u.recipe)) {
        u.recipe.split(/\+(?![^()]*\))/).forEach(part => { 
            const match = part.trim().match(/^([^(\[]+)/); 
            if(match) calcEssenceRecursive(getUnitId(match[1]), counts, visited); 
        });
    }
}

function getUnitEssenceTotal(uid) {
    const u = unitMap.get(uid); if (!u || !["Hidden", "SuperHidden"].includes(u.grade)) return 0;
    let counts = {coral:0, aiur:0, zerus:0}, visited = new Set();
    calcEssenceRecursive(uid, counts, visited); return counts.coral + counts.aiur + counts.zerus;
}

function updateEssence(){
    let counts={coral:0, aiur:0, zerus:0}, visited = new Set();
    activeUnits.forEach((qty, key) => { const u = unitMap.get(key); if(u && ["Hidden", "SuperHidden"].includes(u.grade)) calcEssenceRecursive(key, counts, visited); });
    const setVal=(id,v)=>{const el=document.getElementById(id);if(el){el.innerText=v;el.parentElement.className='cost-slot'+(el.parentElement.id.includes('magic')?' is-magic-slot':'')+(id.includes('total')?' total':'')+(v>0?' active':'')}};
    setVal('val-coral',counts.coral);setVal('val-aiur',counts.aiur);setVal('val-zerus',counts.zerus);setVal('essence-total-val',counts.coral+counts.aiur+counts.zerus);
}

function updateMagicDashboard(){
    resetMagicDashboard(); if(activeUnits.size===0) return;
    const totalMap={}; dashboardAtoms.forEach(a=>{if(a==="갓오타/메시브")totalMap[a]={갓오타:0,메시브:0};else totalMap[a]=0;});
    
    Array.from(activeUnits.keys()).forEach(k=>{
        const u=unitMap.get(k);if(!u)return; const c=activeUnits.get(k)||1;
        if(u.cost&&!IGNORE_PARSE_RECIPES.includes(u.cost)) parseFixedCost(u.cost,c,totalMap); 
        else calculateRecursiveCost(u.name,c,totalMap);
    });
    
    let totalMagic=0;
    dashboardAtoms.forEach(a=>{
        const val=totalMap[a], container=document.getElementById(`vslot-${clean(a)}`);if(!container)return;
        const e=container.querySelector('.cost-val'), nameEl=container.querySelector('.cost-name');
        
        if(a==="갓오타/메시브"){
            if(val.갓오타>0 || val.메시브>0){
                e.innerHTML=`<div style="display:flex; width:100%; height:100%;">
                    <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; border-right:1px solid rgba(236,72,153,0.3);">
                        <span style="font-size:1.8rem; font-weight:900; color:var(--grade-rare); line-height:1; margin-bottom:4px; text-shadow:0 0 10px rgba(251,191,36,0.5);">${val.갓오타}</span>
                        <span style="font-size:0.7rem; color:rgba(255,255,255,0.7); letter-spacing:-0.5px;">갓오타</span>
                    </div>
                    <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                        <span style="font-size:1.8rem; font-weight:900; color:var(--grade-unique); line-height:1; margin-bottom:4px; text-shadow:0 0 10px rgba(239,68,68,0.5);">${val.메시브}</span>
                        <span style="font-size:0.7rem; color:rgba(255,255,255,0.7); letter-spacing:-0.5px;">메시브</span>
                    </div>
                </div>`;
                nameEl.style.display='none';
                container.classList.add('active');
            } else {
                e.innerHTML=EMPTY_SVG;
                nameEl.style.display='block';
            }
        } else if(val>0){ 
            e.innerText=Math.ceil(val);
            nameEl.style.display='block';
            container.classList.add('active');
            totalMagic+=val; 
        } else {
            e.innerHTML=EMPTY_SVG;
            nameEl.style.display='block';
        }
    });
    
    const magicTotalEl=document.querySelector('#slot-total-magic .cost-val');
    if(magicTotalEl){magicTotalEl.innerText=Math.ceil(totalMagic);magicTotalEl.parentElement.classList.toggle('active',totalMagic>0);}
}

function buildTree(uid,visited=new Set(),isRoot=false,conditionStr='',depth=0){
    const u=unitMap.get(uid);
    if(!u) return `<li class="tree-li"><div class="tree-node-wrapper"><div class="unit-badge">${uid} ${conditionStr?`<span class="badge-cond">${conditionStr}</span>`:''}</div></div></li>`;
    
    const nameDisp = u.name;
    const color = gradeColorsRaw[u.grade] || "var(--text)";
    
    if(visited.has(uid)) return `<li class="tree-li"><div class="tree-node-wrapper"><div class="unit-badge" style="color:var(--text-muted);opacity:0.5;">${nameDisp} ${conditionStr?`<span class="badge-cond">${conditionStr}</span>`:''} <span style="font-size:0.8rem; margin-left:4px;">(중복)</span></div></div></li>`;
    
    const newV=new Set(visited); newV.add(uid); 
    let ch='';
    
    if(u.recipe&&!IGNORE_PARSE_RECIPES.includes(u.recipe)){
        u.recipe.split(/\+(?![^()]*\))/).forEach(part=>{
            const match=part.trim().match(/^([^(\[]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/);
            if(match){
                const childUid=getUnitId(match[1]);
                let condTxt = match[2] ? `(${match[2]})` : '';
                let qtyTxt = match[3] ? `[${match[3]}]` : '[1]';
                let combined = `${condTxt}${qtyTxt}`;
                const target=unitMap.get(childUid);
                
                if(target&&target.id!==u.id) {
                    ch+=buildTree(target.id,newV,false,combined,depth+1);
                } else {
                    ch+=`<li class="tree-li"><div class="tree-node-wrapper"><div class="unit-badge" style="color:var(--text-muted);">${match[1].trim()} ${combined?`<span class="badge-cond">${combined}</span>`:''}</div></div></li>`;
                }
            } else {
                const childUid=getUnitId(part), target=unitMap.get(childUid);
                if(target&&target.id!==u.id) ch+=buildTree(target.id,newV,false,'',depth+1);
            }
        });
    }
    
    const ulStyle=depth===0?'block':'none', mark=depth===0?'▼':'▶', bulletDisplay=depth===0?'block':'none';
    
    return `<li class="tree-li">
        <div class="tree-node-wrapper">
            <div class="unit-badge" style="color:${color};" onclick="toggleTreeNode(this)">
                ${nameDisp} ${conditionStr?`<span class="badge-cond">${conditionStr}</span>`:''} ${ch?`<span class="toggle-mark">${mark}</span>`:''}
            </div>
        </div>
        ${ch?`<ul class="tree-ul ${isRoot?'root-ul':''}" style="display:${ulStyle};">${ch}</ul>`:''}
        ${(u.cost&&!IGNORE_PARSE_RECIPES.includes(u.cost))?`<div class="bullet-cost" style="display:${bulletDisplay};">비용: ${u.cost}</div>`:''}
    </li>`;
}

function toggleAllTree(btn){const card=btn.closest('.analysis-card'),isExpanded=btn.getAttribute('data-expanded')==='true';if(isExpanded){const rootNode=card.querySelector('.tree-ul.root-ul > .tree-li');if(rootNode){const firstLevelUl=rootNode.querySelector(':scope > .tree-ul');if(firstLevelUl){firstLevelUl.querySelectorAll('.tree-ul').forEach(el=>el.style.display='none');firstLevelUl.querySelectorAll('.bullet-cost').forEach(el=>el.style.display='none');firstLevelUl.querySelectorAll('.toggle-mark').forEach(el=>el.innerText='▶')}}btn.innerText="모두 펼치기";}else{card.querySelectorAll('.tree-ul').forEach(el=>el.style.display='block');card.querySelectorAll('.bullet-cost').forEach(el=>el.style.display='block');card.querySelectorAll('.toggle-mark').forEach(el=>el.innerText='▼');btn.innerText="모두 접기";}btn.setAttribute('data-expanded',!isExpanded)}
function toggleTreeNode(el){const p=el.closest('.tree-li'),c=p.querySelector(':scope>.bullet-cost'),t=p.querySelector(':scope>.tree-ul'),m=p.querySelector(':scope>.tree-node-wrapper .toggle-mark');if(t)t.style.display=t.style.display==='none'?'block':'none';if(c)c.style.display=c.style.display==='none'?'block':'none';if(m)m.innerText=m.innerText==='▶'?'▼':'▶'}
function resetAll(){ activeUnits.clear(); essenceUnits.clear(); expandedTrees.clear(); globalLineageState=false; const btn=document.getElementById('btnToggleLineage'); if(btn)btn.classList.remove('active'); document.getElementById('searchInput').value = ''; updateAllPanels(); }

function renderTabs(){
    let h=''; TAB_CATEGORIES.forEach((cat,idx)=>{
        const items=Array.from(new Set(Array.from(unitMap.values()))).filter(u=>u.category===cat.key&&["SuperHidden","Hidden","Legend"].includes(u.grade)), total=items.length, sel=items.filter(u=>activeUnits.has(u.id)).length;
        h+=`<button class="tab-btn ${idx===_activeTabIdx?'active':''}" onclick="selectTab(${idx})"><span>${cat.name}</span><span style="font-size:0.75rem; opacity:0.8; margin-top:2px; ${sel>0?'color:var(--g);':'color:inherit;'}">(${sel}/${total})</span></button>`;
    });
    document.getElementById('codexTabs').innerHTML=h;
}

function formatRecipeVertical(item) {
    if (!item.recipe || IGNORE_PARSE_RECIPES.includes(item.recipe)) return `<div style="color:var(--text-muted);font-size:0.9rem;display:flex;align-items:center;height:100%;">정보 없음</div>`;
    
    let html = '<div style="display:flex;flex-wrap:wrap;gap:6px;width:100%;">';
    item.recipe.split(/\+(?![^()]*\))/).forEach((part) => {
        const match = part.trim().match(/^([^(\[]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/);
        
        if (match) {
            const rawKo = match[1].trim(); 
            const u = unitMap.get(getUnitId(rawKo));
            
            let condTxt = match[2] ? `(${match[2]})` : '';
            let qtyTxt = match[3] ? `[${match[3]}]` : '[1]';
            let fullText = `${rawKo} ${condTxt}${qtyTxt}`;

            const color = u && gradeColorsRaw[u.grade] ? gradeColorsRaw[u.grade] : "var(--text)";
            
            html+=`
                <div style="border:1px solid var(--border-light); border-radius:4px; padding:6px 12px; background:var(--slot-bg); color:${color}; font-size:0.9rem; font-weight:bold; display:flex; align-items:center; gap:6px; white-space:nowrap; box-shadow:0 2px 5px rgba(0,0,0,0.3);">
                    ${rawKo} ${condTxt || match[3] ? `<span class="badge-cond">${condTxt}${qtyTxt}</span>` : ''}
                </div>`;
        } else {
            html+=`<div style="color:var(--text-sub);font-size:0.95rem; display:flex; align-items:center;">${part}</div>`;
        }
    });
    return html + '</div>';
}

function selectTab(idx){ _activeTabIdx=idx; renderTabs(); renderCurrentTabContent(); }

function findBestUnitMatch(namePart) {
    const cleanName = clean(namePart);
    if (!cleanName) return null;
    let exact = null;
    let partials = [];
    
    for (let u of unitMap.values()) {
        const uClean = clean(u.name);
        if (uClean === cleanName) {
            exact = u;
            break; 
        } else if (uClean.includes(cleanName)) {
            partials.push(u);
        }
    }
    
    if (exact) return exact;
    if (partials.length > 0) {
        partials.sort((a, b) => a.name.length - b.name.length);
        return partials[0];
    }
    return null;
}

function processSearchAutoSelect(query) {
    const tokens = query.split(/[,/]/).map(s => s.trim());
    let isUpdated = false;

    tokens.forEach(token => {
        const match = token.match(/^(.+?)\*(\d+)$/);
        if (match) {
            const namePart = match[1].trim();
            let qty = parseInt(match[2]);
            qty = Math.max(1, Math.min(qty, 16));
            
            const bestU = findBestUnitMatch(namePart);
            if (bestU) {
                if (bestU.grade === "SuperHidden") qty = 1;
                activeUnits.set(bestU.id, qty);
                essenceUnits.add(bestU.id);
                if(globalLineageState) expandedTrees.add(bestU.id);
                isUpdated = true;
            }
        }
    });
    
    if (isUpdated) updateAllPanels();
}

function filterUnits() { 
    const q = document.getElementById('searchInput').value.trim();
    if (q.includes('*')) {
        processSearchAutoSelect(q);
    }
    renderCurrentTabContent(); 
}

function renderCurrentTabContent() {
    const catKey = TAB_CATEGORIES[_activeTabIdx].key;
    const q = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase().trim() : '';
    
    let items = Array.from(new Set(Array.from(unitMap.values()))).filter(u => ["SuperHidden","Hidden","Legend"].includes(u.grade));
    let searchMultipliers = {};
    
    if (q) {
        const queries = q.split(/[\/,]/).map(s => s.trim()).filter(s => s.length > 0);
        items = items.filter(u => {
            let matched = false;
            const searchStr = `${u.name} ${u.recipe} ${u.grade} ${u.category} ${GRADE_SHORT[u.grade]}`.toLowerCase();
            
            for(let query of queries) {
                let namePart = query;
                let multi = 1;
                
                if(query.includes('*')) {
                    const parts = query.split('*');
                    namePart = parts[0].trim();
                    let m = parseInt(parts[1]);
                    if(!isNaN(m)) multi = Math.max(1, Math.min(m, 16));
                }
                
                if(searchStr.includes(clean(namePart))) {
                    matched = true;
                    const bestU = findBestUnitMatch(namePart);
                    if (bestU && bestU.id === u.id && multi > 1 && u.grade !== "SuperHidden") {
                        searchMultipliers[u.id] = multi;
                    }
                }
            }
            return matched;
        });
    } else {
        items = items.filter(u => u.category === catKey);
    }
    
    items.sort((a,b) => { 
        if(a.grade !== b.grade) return GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade);
        return calculateTotalCostScore(b.cost) - calculateTotalCostScore(a.cost); 
    });
    
    let h='<div style="display:flex;flex-direction:column;gap:6px;">';
    
    if (items.length === 0 && q !== '') {
        h += `<div style="text-align:center; padding:30px; color:var(--text-sub); font-weight:bold; font-size:1.05rem;">검색 결과가 없습니다.</div>`;
    }
    
    // [오류고침] 누락되었던 (item, index) 매개변수를 다시 복구하여 ReferenceError 원천 차단
    items.forEach((item, index) => {
        const isActive = activeUnits.has(item.id), qty = activeUnits.get(item.id) || 0;
        const unitEssence = getUnitEssenceTotal(item.id);
        const nameDisp = item.name;
        const multi = searchMultipliers[item.id] || 1;
        
        let treeHtml = '';
        if (expandedTrees.has(item.id) && globalLineageState) {
            let upperHtml = '';
            if (["Legend","Hidden","Hell","SuperHidden"].includes(item.grade)) {
                const parents = Array.from(new Set(Array.from(unitMap.values()))).filter(u => ["Hidden","SuperHidden"].includes(u.grade) && u.id !== item.id && u.recipe && u.recipe.includes(item.name));
                if (parents.length > 0) {
                    parents.sort((a,b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade));
                    upperHtml += `<div style="margin-bottom:12px;"><div style="color:var(--grade-rare); font-size:0.85rem; margin-bottom:6px;">> 상위 조합 가능</div><div style="display:flex; flex-wrap:wrap; gap:6px;">`;
                    parents.forEach(p => { 
                        upperHtml += `<div class="unit-badge" style="color:${gradeColorsRaw[p.grade]}; padding:4px 8px; font-size:0.8rem;" onclick="event.stopPropagation(); toggleUnitSelection('${p.id}')">${p.name}</div>`; 
                    });
                    upperHtml += `</div></div>`;
                }
            }
            treeHtml = `<div class="analysis-card" style="margin-top:10px; margin-bottom:0; width:100%; border-left-color:var(--g); background:var(--badge-bg);" onclick="event.stopPropagation()"><h3 style="border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--g); font-size:0.9rem;">[계보]</span><button class="btn-small" data-expanded="false" onclick="event.stopPropagation(); toggleAllTree(this)">모두 펼치기</button></h3>${upperHtml}<ul class="tree-ul root-ul" style="display:block; padding-left:0;">${buildTree(item.id, new Set(), true, '', 0)}</ul></div>`;
        }
        
        const cardBg = isActive ? 'var(--g-faint)' : 'var(--card-bg)', cardBorder = isActive ? 'var(--g-border)' : 'var(--border)';
        const badgeClass = item.grade === "SuperHidden" ? "badge-essence sh" : "badge-essence";
        const essenceBox = unitEssence > 0 ? `<div class="${badgeClass}">정수 [${unitEssence}]</div>` : '';
        
        let rightControls = `<div class="uc-ctrl" onclick="event.stopPropagation()"><div class="uc-ctrl-box">${essenceBox}`;
        if (item.grade !== "SuperHidden") rightControls += `<div class="ctrl-qty"><button class="ctrl-btn minus" onclick="changeUnitQty('${item.id}', -1)">−</button><div class="ctrl-val">${qty}</div><button class="ctrl-btn plus" onclick="changeUnitQty('${item.id}', 1)">+</button></div>`;
        rightControls += `</div></div>`;

        h+=`<div class="unit-card ${isActive?'active':''}" style="animation-delay:${index * 0.03}s" onclick="toggleUnitSelection('${item.id}', ${multi})">
            <div class="uc-wrap">
                <div class="uc-name">
                    <div style="color:${gradeColorsRaw[item.grade]}; font-weight:bold; font-size:1.1rem; display:flex; align-items:center; gap:8px;">
                    <span class="gtag" style="border-color:${gradeColorsRaw[item.grade]}44;">${GRADE_SHORT[item.grade]}</span> ${nameDisp}</div>
                </div>
                <div class="uc-recipe">${formatRecipeVertical(item)}</div>
                ${rightControls}
            </div>${treeHtml}
        </div>`;
    });
    h+='</div>'; document.getElementById('tabContent').innerHTML=h;
}

function renderDashboardAtoms(){
    DOM.magicDashboard.innerHTML=`<div class="cost-slot total" id="slot-total-magic"><div class="cost-val"></div><div class="cost-name">총매직코스트</div></div><div class="cost-slot total" id="slot-total-essence"><div class="cost-val" id="essence-total-val"></div><div class="cost-name">총정수코스트</div></div><div class="cost-slot"><div class="cost-val" id="val-coral" style="color:#FF6B6B;"></div><div class="cost-name">코랄</div></div><div class="cost-slot"><div class="cost-val" id="val-aiur" style="color:var(--grade-rare);"></div><div class="cost-name">아이어</div></div><div class="cost-slot"><div class="cost-val" id="val-zerus" style="color:var(--grade-legend);"></div><div class="cost-name">제루스</div></div>`;
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

function openHelpModal(){document.getElementById('helpModal').classList.add('active')}
function closeHelpModal(e){if(e===undefined||e.target.id==='helpModal')document.getElementById('helpModal').classList.remove('active')}

function openNoticeModal(){document.getElementById('noticeModal').classList.add('active')}
function closeNoticeModal(e){if(e===undefined||e.target.id==='noticeModal')document.getElementById('noticeModal').classList.remove('active')}

document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.lang = 'ko';
    document.documentElement.setAttribute('data-theme', 'dark');

    UNIT_DATABASE.forEach((kArr) => { 
        const g = gradeMap[kArr[1]] || "Magic", cat = raceMap[kArr[2]] || "TBio";
        const u={ id:clean(kArr[0]), name:kArr[0], grade:g, category:cat, recipe:kArr[3], cost:kArr[4] }; 
        unitMap.set(clean(kArr[0]), u); 
    });

    DOM.magicDashboard=document.getElementById('magicDashboard');
    renderDashboardAtoms(); 
    document.getElementById('mainLayout').classList.add('visible'); 
    selectTab(0);
    updateMagicDashboard(); 

    setTimeout(() => { const intro = document.getElementById('introCinematic'); if(intro) { intro.classList.add('intro-exit'); setTimeout(() => intro.style.display = 'none', 800); } }, 3200);
});

document.addEventListener('contextmenu',e=>e.preventDefault());document.addEventListener('dragstart',e=>e.preventDefault());document.addEventListener('selectstart',e=>{if(e.target.tagName!=='INPUT')e.preventDefault()});window.addEventListener('keydown',e=>{if(e.keyCode===123||(e.ctrlKey&&e.shiftKey&&[73,74,67].includes(e.keyCode))||(e.ctrlKey&&e.keyCode===85))e.preventDefault()});

function openJewelModal(){document.getElementById('jewelModal').classList.add('active'); renderJewelGrid();}
function closeJewelModal(e){if(!e||e.target===document.getElementById('jewelModal'))document.getElementById('jewelModal').classList.remove('active');}

function renderJewelGrid(){
    const g=document.getElementById('jewelGrid'); if(g.innerHTML!=='') { g.innerHTML=''; } 
    let h=''; const url="https://raw.githubusercontent.com/sldbox/site/main/image/jw/";
    
    JEWEL_DATABASE.forEach((koArr) => {
        const kr=koArr[0], krLeg=koArr[1], krMyth=koArr[2], c=koArr[3]||"#fff", imgName=koArr[4]||kr;
        
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