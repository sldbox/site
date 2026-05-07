/*
=============================================================================
[파일 설명서] app.js
- 시스템 초기화, 언어 번역(I18N), 코스트 수학 계산
- 구조 분리된 data.js의 인덱스 자동 매칭 기능
- [수정완료] 제작자 이름 번역 사전 기능 제거
=============================================================================
*/

let currentLang = localStorage.getItem('nexus_lang');
if (!currentLang) currentLang = navigator.language.startsWith('ko') ? 'ko' : 'en';

const I18N = {
    creator: {ko:'제작자', en:'Creator'}, 
    btn_reset: {ko:'초기화', en:'Reset All'}, btn_guide: {ko:'가이드', en:'Guide'}, btn_jewel: {ko:'쥬얼도감', en:'Jewels'},
    ph_db: {ko:'유닛&도감 데이터베이스', en:'UNIT & CODEX DATABASE'}, btn_lineage: {ko:'계보', en:'Lineage'}, btn_selall: {ko:'전체선택/해제', en:'Select All/None'},
    ph_cost: {ko:'총합 코스트 계산 매트릭스', en:'TOTAL COST MATRIX'},
    brand_title: { ko: 'SLD NEXUS', en: 'SLD NEXUS' },
    intro_sys: { ko: 'ESTABLISHING SECURE CONNECTION...', en: 'ESTABLISHING SECURE CONNECTION...' },
    
    search_placeholder: { ko: '다중 검색 지원 (예: 땅굴/아몬/불새)', en: 'Multi-Search (e.g. Nydus/Amon/Nova)' },
    
    cat_TBio: {ko:'테바', en:'T-Bio'}, cat_TMech: {ko:'테메', en:'T-Mech'}, cat_PBio: {ko:'토바', en:'P-Bio'},
    cat_PMech: {ko:'토메', en:'P-Mech'}, cat_Zerg: {ko:'저그중립', en:'Zerg/Neutral'}, cat_Hybrid: {ko:'혼종', en:'Hybrid'},
    db_total_cost: {ko:'총매직코스트', en:'Total Magic Cost'}, db_total_ess: {ko:'총정수코스트', en:'Total Essence'},
    db_korhal: {ko:'코랄', en:'Korhal'}, db_aiur: {ko:'아이어', en:'Aiur'}, db_zerus: {ko:'제루스', en:'Zerus'},
    
    guide_h2: {ko:'시스템 가이드', en:'System Guide'}, 
    guide_title: {ko:'[ SLD NEXUS 사용 가이드 ]', en:'[ SLD NEXUS User Guide ]'},
    guide_sub: {ko:'직관적인 3단계 시뮬레이션 시스템', en:'Intuitive 3-step simulation system'},
    guide_step1: {ko:'목표 유닛 활성화', en:'Activate Target Units'}, 
    guide_step1_p: {ko:'데이터베이스 목록에서 목표로 하는 유닛 카드를 클릭하세요.', en:'Click on the target unit cards from the database list.'},
    guide_step1_sub: {ko:'✔️ 수량 조절 버튼[−/+]으로 필요 수량을 세팅합니다.<br>✔️ 슈퍼히든(SH) 유닛은 덱당 1개로 고정됩니다.', en:'✔️ Set quantities using the [−/+] buttons.<br>✔️ Super Hidden (SH) units are limited to 1 per deck.'},
    guide_step2: {ko:'정수(Essence) 획득량 산출', en:'Calculate Essence Yield'}, 
    guide_step2_p: {ko:'일일 획득 가능한 총 정수량이 자동 합산됩니다.', en:'The total daily essence yield is automatically calculated.'},
    guide_step2_sub: {ko:'✔️ 유닛 카드 우측의 정수 뱃지를 확인하세요.<br>✔️ 재료로 사용된 하위 히든 유닛의 정수까지 완벽하게 추적합니다.', en:'✔️ Check the essence badge on the right side of the card.<br>✔️ Automatically tracks essence from all sub-material hidden units.'},
    guide_step3: {ko:'매직 코스트 & 계보 분석', en:'Matrix Cost & Lineage Analysis'}, 
    guide_step3_p: {ko:'요구되는 기초 매직 유닛의 총합이 중앙 매트릭스에 출력됩니다.', en:'The total required base magic units are displayed in the Central Matrix.'},
    guide_step3_sub: {ko:'✔️ 중앙 패널의 숫자에 맞춰 매직 유닛을 수집하세요.<br>✔️ [계보] 버튼을 활성화하면 전체 조합 트리를 시각적으로 확인할 수 있습니다.', en:'✔️ Collect base units according to the numbers in the center panel.<br>✔️ Toggle the [Lineage] button to visually trace the entire combo tree.'},
    
    jewel_title: {ko:'쥬얼 도감', en:'Jewel Dictionary'}, jw_leg_t: {ko:'전설 능력', en:'LEGENDARY ABILITY'}, jw_myth_t: {ko:'신화 능력', en:'MYTHIC ABILITY'},
    lbl_recipe: {ko:'조합:', en:'Recipe:'}, lbl_cost: {ko:'비용:', en:'Cost:'}, 
    lbl_ess: {ko:'정수', en:'Essence'}, lbl_expand: {ko:'모두 펼치기', en:'Expand All'}, lbl_collapse: {ko:'모두 접기', en:'Collapse All'},
    lbl_dup: {ko:'(중복)', en:'(Dup)'}, lbl_lineage: {ko:'[계보]', en:'[Lineage]'}, lbl_upgrade: {ko:'> 상위 조합 가능', en:'> Upgradable Into'},
    lbl_noinfo: {ko:'정보 없음', en:'No Information'}
};

function toggleLanguage() { currentLang = currentLang === 'ko' ? 'en' : 'ko'; localStorage.setItem('nexus_lang', currentLang); document.documentElement.lang = currentLang; applyLanguage(); }

function applyLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => { const key = el.getAttribute('data-i18n'); if(I18N[key] && I18N[key][currentLang]) el.innerHTML = I18N[key][currentLang]; });
    const brandEl = document.getElementById('brandTitle'); if(brandEl) brandEl.innerText = I18N.brand_title[currentLang];
    const searchInput = document.getElementById('searchInput'); if(searchInput) searchInput.placeholder = I18N.search_placeholder[currentLang];
    updateAllPanels();
}

function getDisplayText(koStr, enStr) {
    if (currentLang === 'ko') return koStr || "";
    if (enStr && enStr.trim() !== "") return enStr;
    return `<span style="opacity:0; pointer-events:none; user-select:none;">${koStr || "X"}</span>`;
}

const ATOM_EN_MAP = {
    "전쟁광": "Warmonger", "스파르타중대": "Spartan Company", "암흑광전사": "Dark Zealot",
    "암흑파수기": "Dark Sentry", "원시바퀴": "Primal Roach", "저격수": "Sniper",
    "코브라": "Diamondback", "암흑고위기사": "Dark High Templar", "암흑추적자": "Dark Stalker",
    "변종가시지옥": "Primal Lurker", "망치경호대": "Hammer Securities", "공성파괴단": "Siege Breaker",
    "암흑집정관": "Dark Archon", "암흑불멸자": "Dark Immortal", "원시히드라리스크": "Primal Hydralisk",
    "땅거미지뢰": "Widow Mine", "자동포탑": "Auto Turret", "우르사돈[암]": "Yeti(F)",
    "우르사돈[수]": "Yeti(M)", "갓오타/메시브": "GOT/Massive"
};

let _activeTabIdx=0,globalLineageState=false;
const unitMap=new Map(),activeUnits=new Map(),essenceUnits=new Set(),expandedTrees=new Set(),DOM={};
const clean=s=>s?s.replace(/\s+/g,'').toLowerCase():'';

const GRADE_ORDER = ["Magic","Rare","Epic","Unique","Hell","Legend","Hidden","SuperHidden"];
const gradeColorsRaw = { "Magic":"var(--grade-magic)", "Rare":"var(--grade-rare)", "Epic":"var(--grade-epic)", "Unique":"var(--grade-unique)", "Hell":"var(--grade-hell)", "Legend":"var(--grade-legend)", "Hidden":"var(--grade-hidden)", "SuperHidden":"var(--grade-super)" };
const GRADE_SHORT = { Magic:'M', Rare:'R', Epic:'E', Unique:'U', Hell:'HE', Legend:'L', Hidden:'H', SuperHidden:'SH' };
const TAB_CATEGORIES = [ {key:"TBio", i18n:"cat_TBio"}, {key:"TMech", i18n:"cat_TMech"}, {key:"PBio", i18n:"cat_PBio"}, {key:"PMech", i18n:"cat_PMech"}, {key:"Zerg", i18n:"cat_Zerg"}, {key:"Hybrid", i18n:"cat_Hybrid"} ];
const gradeMap = {"매직":"Magic", "레어":"Rare", "에픽":"Epic", "유니크":"Unique", "헬":"Hell", "레전드":"Legend", "히든":"Hidden", "슈퍼히든":"SuperHidden"};
const raceMap = {"테바":"TBio", "테메":"TMech", "토바":"PBio", "토메":"PMech", "저그중립":"Zerg", "혼종":"Hybrid"};
const IGNORE_PARSE_RECIPES = ["미발견","없음","","100라운드이전까지저그업20↑ [(타 종족 업 0)[1],역전 복권10회[1],인생 복권3회시-소환[1]]", "Undiscovered","None"];

const dashboardAtoms = ["전쟁광", "스파르타중대", "암흑광전사", "암흑파수기", "원시바퀴", "저격수", "코브라", "암흑고위기사", "암흑추적자", "변종가시지옥", "망치경호대", "공성파괴단", "암흑집정관", "암흑불멸자", "원시히드라리스크", "땅거미지뢰", "자동포탑", "우르사돈[암]", "우르사돈[수]", "갓오타/메시브"];

const specialKeywordMap = [
    {keys:["자동포탑", "auto turret"], atom:"자동포탑"}, {keys:["잠복", "burrow"], atom:"잠복"},
    {keys:["지뢰", "시체매", "widow mine", "spider mine", "vulture-mineplant"], atom:"땅거미지뢰", divider:12},
    {keys:["우르사돈[암]", "우르사돈암", "yeti(f)", "yetif"], atom:"우르사돈[암]"}, {keys:["우르사돈[수]", "우르사돈수", "yeti(m)", "yetim"], atom:"우르사돈[수]"},
    {keys:["메시브", "디제스터", "massive", "disaster"], atom:"갓오타/메시브", subKey:"메시브"}, {keys:["갓오브타임", "갓오타", "god of time", "got"], atom:"갓오타/메시브", subKey:"갓오타"}
];

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
    if(u&&u.recipe.ko&&!IGNORE_PARSE_RECIPES.includes(u.recipe.ko)){
        u.recipe.ko.split(/\+(?![^()]*\))/).forEach(part=>{
            const match=part.trim().match(/^([^(\[]+)/);
            if(match){
                const ingName=match[1].trim(),cntMatch=part.match(/\[(\d+)\]/),cnt=cntMatch?parseInt(cntMatch[1]):1,childUid=getUnitId(ingName), childU=unitMap.get(childUid);
                if(childU&&childU.cost.ko&&!IGNORE_PARSE_RECIPES.includes(childU.cost.ko))parseFixedCost(childU.cost.ko,cnt*m,map);
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
            const searchStr = `${u.name.ko} ${u.name.en} ${u.recipe.ko} ${u.recipe.en} ${u.grade} ${u.category} ${GRADE_SHORT[u.grade]}`.toLowerCase();
            return queries.some(query => searchStr.includes(query)); 
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
    if(activeUnits.has(id)){ activeUnits.delete(id); essenceUnits.delete(id); expandedTrees.delete(id); }
    else{ activeUnits.set(id,1); essenceUnits.add(id); if(globalLineageState) expandedTrees.add(id); }
    updateAllPanels();
}

function changeUnitQty(id,delta){
    const u = unitMap.get(id); if(u && u.grade === "SuperHidden") return; 
    let qty=activeUnits.get(id)||0; qty+=delta;
    if(qty<1){ activeUnits.delete(id); essenceUnits.delete(id); expandedTrees.delete(id); }
    else{ if(qty>8)qty=8; activeUnits.set(id,qty); essenceUnits.add(id); if(globalLineageState) expandedTrees.add(id); }
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
    if(u.recipe.ko && !IGNORE_PARSE_RECIPES.includes(u.recipe.ko)) {
        u.recipe.ko.split(/\+(?![^()]*\))/).forEach(part => { 
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
        if(u.cost.ko&&!IGNORE_PARSE_RECIPES.includes(u.cost.ko)) parseFixedCost(u.cost.ko,c,totalMap); 
        else calculateRecursiveCost(u.name.ko,c,totalMap);
    });
    
    let totalMagic=0;
    dashboardAtoms.forEach(a=>{
        const val=totalMap[a], container=document.getElementById(`vslot-${clean(a)}`);if(!container)return;
        const e=container.querySelector('.cost-val'), nameEl=container.querySelector('.cost-name');
        if(a==="갓오타/메시브"){
            if(val.갓오타>0||val.메시브>0){
                let h=""; 
                if(val.갓오타>0){h+=`<div style="font-size:0.9rem;color:var(--grade-rare);">${currentLang==='ko'?'갓오타':'GOT'} ${Math.ceil(val.갓오타)}</div>`;totalMagic+=val.갓오타;}
                if(val.메시브>0){h+=`<div style="font-size:0.9rem;color:var(--grade-unique);">${currentLang==='ko'?'메시브':'Massive'} ${Math.ceil(val.메시브)}</div>`;totalMagic+=val.메시브;}
                e.innerHTML=h;nameEl.style.display='none';container.classList.add('active');
            }
        }else if(val>0){ e.innerText=Math.ceil(val);nameEl.style.display='block';container.classList.add('active');totalMagic+=val; }
    });
    const magicTotalEl=document.querySelector('#slot-total-magic .cost-val');
    if(magicTotalEl){magicTotalEl.innerText=Math.ceil(totalMagic);magicTotalEl.parentElement.classList.toggle('active',totalMagic>0);}
}

function buildTree(uid,visited=new Set(),isRoot=false,conditionStr='',depth=0){
    const u=unitMap.get(uid);
    if(!u)return`<li class="tree-li"><div class="tree-node-wrapper"><div class="unit-badge">${uid}</div><span style="color:var(--text-sub);font-size:0.85rem;">${conditionStr}</span></div></li>`;
    const nameDisp = getDisplayText(u.name.ko, u.name.en);
    if(visited.has(uid))return`<li class="tree-li"><div class="tree-node-wrapper"><div class="unit-badge" style="color:var(--text-muted);opacity:0.5;">${nameDisp} ${I18N.lbl_dup[currentLang]}</div></div></li>`;
    const newV=new Set(visited);newV.add(uid); let ch='';
    
    if(u.recipe.ko&&!IGNORE_PARSE_RECIPES.includes(u.recipe.ko)){
        u.recipe.ko.split(/\+(?![^()]*\))/).forEach(part=>{
            const match=part.trim().match(/^([^(\[]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/);
            if(match){
                const childUid=getUnitId(match[1]), cond=match[2]?`(${match[2]})`:'', cnt=match[3]?`[${match[3]}]`:'', combined=`${cond}${cnt}`, target=unitMap.get(childUid);
                if(target&&target.id!==u.id)ch+=buildTree(target.id,newV,false,combined,depth+1);
                else {
                    const cName = getDisplayText(match[1].trim(), target ? target.name.en : "");
                    ch+=`<li class="tree-li"><div class="tree-node-wrapper"><div class="unit-badge" style="color:var(--text-muted);">${cName}</div><span style="color:var(--text-sub);font-size:0.85rem;">${combined}</span></div></li>`;
                }
            }else{
                const childUid=getUnitId(part),target=unitMap.get(childUid);
                if(target&&target.id!==u.id)ch+=buildTree(target.id,newV,false,'',depth+1)
            }
        });
    }
    const ulStyle=depth===0?'block':'none',mark=depth===0?'▼':'▶',bulletDisplay=depth===0?'block':'none';
    const recStr = currentLang==='en' && u.recipe.en ? u.recipe.en : (currentLang==='en' ? `<span style="opacity:0; pointer-events:none;">${u.recipe.ko}</span>` : u.recipe.ko);
    const costStr = currentLang==='en' && u.cost.en ? u.cost.en : (currentLang==='en' ? `<span style="opacity:0; pointer-events:none;">${u.cost.ko}</span>` : u.cost.ko);
    
    return`<li class="tree-li"><div class="tree-node-wrapper"><div class="unit-badge" style="color:${gradeColorsRaw[u.grade]||"var(--text)"};" onclick="toggleTreeNode(this)">${nameDisp}${ch?`<span class="toggle-mark">${mark}</span>`:''}</div>${conditionStr?`<span style="color:var(--text-sub);font-size:0.82rem;">${conditionStr}</span>`:''}</div>${(u.recipe.ko&&!IGNORE_PARSE_RECIPES.includes(u.recipe.ko))?`<div class="bullet-recipe" style="display:${bulletDisplay};">${I18N.lbl_recipe[currentLang]} ${recStr}</div>`:''}${(u.cost.ko&&!IGNORE_PARSE_RECIPES.includes(u.cost.ko))?`<div class="bullet-cost" style="display:${bulletDisplay};">${I18N.lbl_cost[currentLang]} ${costStr}</div>`:''}${ch?`<ul class="tree-ul ${isRoot?'root-ul':''}" style="display:${ulStyle};">${ch}</ul>`:''}</li>`
}

function toggleAllTree(btn){const card=btn.closest('.analysis-card'),isExpanded=btn.getAttribute('data-expanded')==='true';if(isExpanded){const rootNode=card.querySelector('.tree-ul.root-ul > .tree-li');if(rootNode){const firstLevelUl=rootNode.querySelector(':scope > .tree-ul');if(firstLevelUl){firstLevelUl.querySelectorAll('.tree-ul').forEach(el=>el.style.display='none');firstLevelUl.querySelectorAll('.bullet-recipe,.bullet-cost').forEach(el=>el.style.display='none');firstLevelUl.querySelectorAll('.toggle-mark').forEach(el=>el.innerText='▶')}}btn.innerText=I18N.lbl_expand[currentLang];}else{card.querySelectorAll('.tree-ul').forEach(el=>el.style.display='block');card.querySelectorAll('.bullet-recipe,.bullet-cost').forEach(el=>el.style.display='block');card.querySelectorAll('.toggle-mark').forEach(el=>el.innerText='▼');btn.innerText=I18N.lbl_collapse[currentLang];}btn.setAttribute('data-expanded',!isExpanded)}
function toggleTreeNode(el){const p=el.closest('.tree-li'),r=p.querySelector(':scope>.bullet-recipe'),c=p.querySelector(':scope>.bullet-cost'),t=p.querySelector(':scope>.tree-ul'),m=p.querySelector(':scope>.tree-node-wrapper .toggle-mark');if(t)t.style.display=t.style.display==='none'?'block':'none';if(r)r.style.display=r.style.display==='none'?'block':'none';if(c)c.style.display=c.style.display==='none'?'block':'none';if(m)m.innerText=m.innerText==='▶'?'▼':'▶'}
function resetAll(){ activeUnits.clear(); essenceUnits.clear(); expandedTrees.clear(); globalLineageState=false; const btn=document.getElementById('btnToggleLineage'); if(btn)btn.classList.remove('active'); document.getElementById('searchInput').value = ''; updateAllPanels(); }

function renderTabs(){
    let h=''; TAB_CATEGORIES.forEach((cat,idx)=>{
        const items=Array.from(new Set(Array.from(unitMap.values()))).filter(u=>u.category===cat.key&&["SuperHidden","Hidden","Legend"].includes(u.grade)), total=items.length, sel=items.filter(u=>activeUnits.has(u.id)).length;
        h+=`<button class="tab-btn ${idx===_activeTabIdx?'active':''}" onclick="selectTab(${idx})"><span>${I18N[cat.i18n][currentLang]}</span><span style="font-size:0.75rem; opacity:0.8; margin-top:2px; ${sel>0?'color:var(--g);':'color:inherit;'}">(${sel}/${total})</span></button>`;
    });
    document.getElementById('codexTabs').innerHTML=h;
}

function formatRecipeVertical(item) {
    const isEn = currentLang === 'en';
    if (!item.recipe.ko || IGNORE_PARSE_RECIPES.includes(item.recipe.ko)) return `<div style="color:var(--text-muted);font-size:0.9rem;display:flex;align-items:center;height:100%;">${I18N.lbl_noinfo[currentLang]}</div>`;
    
    let html = '<div style="display:flex;flex-direction:column;gap:6px;width:100%;">';
    item.recipe.ko.split(/\+(?![^()]*\))/).forEach((part, index) => {
        const match = part.trim().match(/^([^(\[]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/);
        
        if (match) {
            const rawKo = match[1].trim(); const u = unitMap.get(getUnitId(rawKo));
            const dispName = getDisplayText(rawKo, u ? u.name.en : "");
            
            let enPart = "";
            if(isEn && item.recipe.en) {
                const enParts = item.recipe.en.split(/\+(?![^()]*\))/);
                if(enParts[index]) enPart = enParts[index].trim();
            }
            
            let extraTxt = "";
            if(isEn && !item.recipe.en) extraTxt = `<span style="opacity:0; pointer-events:none;">${match[2]?`(${match[2]})`:''}${match[3]?`[${match[3]}]`:'[1]'}</span>`;
            else if(isEn && item.recipe.en) extraTxt = enPart.replace(/^[^(\[]+/, ''); 
            else extraTxt = `${match[2]?`(${match[2]})`:''}${match[3]?`[${match[3]}]`:'[1]'}`;

            const color = u && gradeColorsRaw[u.grade] ? gradeColorsRaw[u.grade] : "var(--text)";
            
            html+=`<div style="display:flex;align-items:center;gap:8px;justify-content:flex-start; flex-wrap:wrap; word-break:keep-all;">
                <div style="border:1px solid var(--border-light); border-radius:3px; padding:4px 10px; background:var(--slot-bg); color:${color}; font-size:0.9rem; font-weight:bold; display:flex; align-items:center; gap:6px; white-space:nowrap;">${dispName} <span style="font-size:0.65rem;opacity:0.7;">▶</span></div>
                <span style="color:var(--text-sub);font-size:0.95rem; word-break:break-word; line-height:1.4;">${extraTxt}</span>
            </div>`;
        } else {
            const fallbackTxt = isEn && item.recipe.en ? item.recipe.en.split(/\+(?![^()]*\))/)[index] : (isEn ? `<span style="opacity:0; pointer-events:none;">${part}</span>` : part);
            html+=`<div style="color:var(--text-sub);font-size:0.95rem; word-break:break-word;">${fallbackTxt}</div>`;
        }
    });
    return html + '</div>';
}

function selectTab(idx){ _activeTabIdx=idx; renderTabs(); renderCurrentTabContent(); }

function filterUnits() { renderCurrentTabContent(); }

function renderCurrentTabContent() {
    const catKey = TAB_CATEGORIES[_activeTabIdx].key;
    const q = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase().trim() : '';
    
    let items = Array.from(new Set(Array.from(unitMap.values()))).filter(u => ["SuperHidden","Hidden","Legend"].includes(u.grade));
    
    if (q) {
        const queries = q.split(/[\/,]/).map(s => s.trim()).filter(s => s.length > 0);
        items = items.filter(u => {
            const searchStr = `${u.name.ko} ${u.name.en} ${u.recipe.ko} ${u.recipe.en} ${u.grade} ${u.category} ${GRADE_SHORT[u.grade]}`.toLowerCase();
            return queries.some(query => searchStr.includes(query));
        });
    } else {
        items = items.filter(u => u.category === catKey);
    }
    
    items.sort((a,b) => { 
        if(a.grade !== b.grade) return GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade);
        return calculateTotalCostScore(b.cost.ko) - calculateTotalCostScore(a.cost.ko); 
    });
    
    let h='<div style="display:flex;flex-direction:column;gap:6px;">';
    
    if (items.length === 0 && q !== '') {
        h += `<div style="text-align:center; padding:30px; color:var(--text-sub); font-weight:bold; font-size:1.05rem;">${currentLang === 'ko' ? '검색 결과가 없습니다.' : 'No results found.'}</div>`;
    }
    
    items.forEach(item => {
        const isActive = activeUnits.has(item.id), qty = activeUnits.get(item.id) || 0;
        const unitEssence = getUnitEssenceTotal(item.id);
        const nameDisp = getDisplayText(item.name.ko, item.name.en);
        
        let treeHtml = '';
        if (expandedTrees.has(item.id) && globalLineageState) {
            let upperHtml = '';
            if (["Legend","Hidden","Hell","SuperHidden"].includes(item.grade)) {
                const parents = Array.from(new Set(Array.from(unitMap.values()))).filter(u => ["Hidden","SuperHidden"].includes(u.grade) && u.id !== item.id && u.recipe.ko && u.recipe.ko.includes(item.name.ko));
                if (parents.length > 0) {
                    parents.sort((a,b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade));
                    upperHtml += `<div style="margin-bottom:12px;"><div style="color:var(--grade-rare); font-size:0.85rem; margin-bottom:6px;">${I18N.lbl_upgrade[currentLang]}</div><div style="display:flex; flex-wrap:wrap; gap:6px;">`;
                    parents.forEach(p => { 
                        const pNameDisp = getDisplayText(p.name.ko, p.name.en);
                        upperHtml += `<div class="unit-badge" style="color:${gradeColorsRaw[p.grade]}; padding:4px 8px; font-size:0.8rem;" onclick="event.stopPropagation(); toggleUnitSelection('${p.id}')">${pNameDisp}</div>`; 
                    });
                    upperHtml += `</div></div>`;
                }
            }
            treeHtml = `<div class="analysis-card" style="margin-top:10px; margin-bottom:0; width:100%; border-left-color:var(--g); background:var(--badge-bg);" onclick="event.stopPropagation()"><h3 style="border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--g); font-size:0.9rem;">${I18N.lbl_lineage[currentLang]}</span><button class="btn-small" data-expanded="false" onclick="event.stopPropagation(); toggleAllTree(this)">${I18N.lbl_expand[currentLang]}</button></h3>${upperHtml}<ul class="tree-ul root-ul" style="display:block; padding-left:0;">${buildTree(item.id, new Set(), true, '', 0)}</ul></div>`;
        }
        
        const cardBg = isActive ? 'var(--g-faint)' : 'var(--card-bg)', cardBorder = isActive ? 'var(--g-border)' : 'var(--border)';
        const badgeClass = item.grade === "SuperHidden" ? "badge-essence sh" : "badge-essence";
        const essenceBox = unitEssence > 0 ? `<div class="${badgeClass}">${I18N.lbl_ess[currentLang]} [${unitEssence}]</div>` : '';
        
        let rightControls = `<div class="uc-ctrl" onclick="event.stopPropagation()">${essenceBox}`;
        if (item.grade !== "SuperHidden") rightControls += `<div class="ctrl-qty"><button class="ctrl-btn minus" onclick="changeUnitQty('${item.id}', -1)">−</button><div class="ctrl-val">${qty}</div><button class="ctrl-btn plus" onclick="changeUnitQty('${item.id}', 1)">+</button></div>`;
        rightControls += `</div>`;

        h+=`<div class="unit-card ${isActive?'active':''}" onclick="toggleUnitSelection('${item.id}')">
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
    DOM.magicDashboard.innerHTML=`<div class="cost-slot total" id="slot-total-magic"><div class="cost-val">0</div><div class="cost-name" data-i18n="db_total_cost">Total Magic Cost</div></div><div class="cost-slot total" id="slot-total-essence"><div class="cost-val" id="essence-total-val">0</div><div class="cost-name" data-i18n="db_total_ess">Total Essence</div></div><div class="cost-slot"><div class="cost-val" id="val-coral" style="color:#FF6B6B;">0</div><div class="cost-name" data-i18n="db_korhal">Korhal</div></div><div class="cost-slot"><div class="cost-val" id="val-aiur" style="color:var(--grade-rare);">0</div><div class="cost-name" data-i18n="db_aiur">Aiur</div></div><div class="cost-slot"><div class="cost-val" id="val-zerus" style="color:var(--grade-legend);">0</div><div class="cost-name" data-i18n="db_zerus">Zerus</div></div>`;
    dashboardAtoms.forEach(a=>{ 
        const u=unitMap.get(clean(a)), isMagic=u&&u.grade==='Magic', d=document.createElement('div'); d.className='cost-slot'+(isMagic?' is-magic-slot':''); d.id=`vslot-${clean(a)}`; 
        d.innerHTML=`<div class="cost-val">0</div><div class="cost-name" id="name-${clean(a)}"></div>`; DOM.magicDashboard.appendChild(d); 
    });
    applyLanguage(); 
}

function resetMagicDashboard(){
    document.querySelectorAll('#magicDashboard .cost-slot .cost-val').forEach(e => { e.innerHTML="0"; e.style.display=""; });
    document.querySelectorAll('#magicDashboard .cost-slot .cost-name').forEach(e => e.style.display='block');
    document.querySelectorAll('#magicDashboard .cost-slot').forEach(e => e.classList.remove('active'));
    
    dashboardAtoms.forEach(a=>{
        const el = document.getElementById(`name-${clean(a)}`);
        if(el) el.innerHTML = getDisplayText(a, ATOM_EN_MAP[a] || a);
    });
}

function openHelpModal(){document.getElementById('helpModal').classList.add('active')}
function closeHelpModal(e){if(e===undefined||e.target.id==='helpModal')document.getElementById('helpModal').classList.remove('active')}

document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.lang = currentLang;
    document.documentElement.setAttribute('data-theme', 'dark');

    const koUnits = UNIT_DATABASE.ko || [];
    const enUnits = UNIT_DATABASE.en || [];
    
    koUnits.forEach((kArr, idx) => { 
        const eArr = enUnits[idx] || ["", "", "", "", ""];
        const g = gradeMap[kArr[1]] || "Magic", cat = raceMap[kArr[2]] || "TBio";
        
        const u={ id:clean(kArr[0]), name:{ko:kArr[0], en:eArr[0]}, grade:g, category:cat, recipe:{ko:kArr[3], en:eArr[3]}, cost:{ko:kArr[4], en:eArr[4]} }; 
        unitMap.set(clean(kArr[0]), u); 
        if(eArr[0] && eArr[0].trim() !== "") unitMap.set(clean(eArr[0]), u); 
    });

    DOM.magicDashboard=document.getElementById('magicDashboard');
    renderDashboardAtoms(); applyLanguage();
    document.getElementById('mainLayout').classList.add('visible'); selectTab(0); 

    setTimeout(() => { const intro = document.getElementById('introCinematic'); if(intro) { intro.classList.add('intro-exit'); setTimeout(() => intro.style.display = 'none', 800); } }, 3200);
});

document.addEventListener('contextmenu',e=>e.preventDefault());document.addEventListener('dragstart',e=>e.preventDefault());document.addEventListener('selectstart',e=>{if(e.target.tagName!=='INPUT')e.preventDefault()});window.addEventListener('keydown',e=>{if(e.keyCode===123||(e.ctrlKey&&e.shiftKey&&[73,74,67].includes(e.keyCode))||(e.ctrlKey&&e.keyCode===85))e.preventDefault()});

function openJewelModal(){document.getElementById('jewelModal').classList.add('active'); renderJewelGrid();}
function closeJewelModal(e){if(!e||e.target===document.getElementById('jewelModal'))document.getElementById('jewelModal').classList.remove('active');}

function renderJewelGrid(){
    const g=document.getElementById('jewelGrid'); if(g.innerHTML!=='') { g.innerHTML=''; } 
    let h=''; const url="https://raw.githubusercontent.com/sldbox/site/main/image/jw/";
    const koList = JEWEL_DATABASE.ko || [];
    const enList = JEWEL_DATABASE.en || [];
    
    koList.forEach((koArr, i) => {
        const enArr = enList[i] || [];
        const kr=koArr[0], krLeg=koArr[1], krMyth=koArr[2], c=koArr[3]||"#fff";
        const en=enArr[0], enLeg=enArr[1], enMyth=enArr[2];
        
        const nameDisp = getDisplayText(kr, en ? en.toUpperCase() : "");
        const fallbackImg = en && en.trim() !== "" ? en : kr; 
        h+=`<div onclick="openJewelPopup(${i})" style="cursor:pointer;display:flex;flex-direction:column;align-items:center;background:var(--jewel-card);padding:15px;border-radius:10px;border:1px solid var(--border);"><div style="width:120px;height:120px;border-radius:50%;border:2px solid ${c}80;display:flex;justify-content:center;align-items:center;margin-bottom:15px;overflow:hidden;background:var(--jewel-card);"><img src="${url}${fallbackImg}.png" onerror="this.src=''" style="width:145%;height:145%;object-fit:cover;"></div><div style="font-size:2rem; font-weight:bold; margin-bottom:10px; color:var(--text); font-family:var(--font-display);">${nameDisp}</div></div>`;
    });
    g.innerHTML=h;
}

function openJewelPopup(idx){
    const koArr = JEWEL_DATABASE.ko[idx] || [];
    const enArr = JEWEL_DATABASE.en[idx] || [];
    
    const kr=koArr[0], krLeg=koArr[1], krMyth=koArr[2], c=koArr[3]||"#fff";
    const en=enArr[0], enLeg=enArr[1], enMyth=enArr[2];
    
    const url="https://raw.githubusercontent.com/sldbox/site/main/image/jw/";
    const fallbackImg = en && en.trim() !== "" ? en : kr;
    document.getElementById('jp-img').src=`${url}${fallbackImg}.png`; 
    document.getElementById('jp-name').innerHTML=getDisplayText(kr, en ? en.toUpperCase() : ""); 
    document.getElementById('jp-leg').innerHTML=getDisplayText(krLeg, enLeg);
    
    const mArea=document.getElementById('jp-myth-area'); 
    if((krMyth&&krMyth.trim()!=="") || (enMyth&&enMyth.trim()!=="")){
        mArea.style.display='block';
        document.getElementById('jp-myth').innerHTML=getDisplayText(krMyth, enMyth);
    } else { mArea.style.display='none'; }
    
    document.getElementById('jp-color-border').style.borderColor=c; document.getElementById('jp-color-border').style.boxShadow=`0 0 20px ${c}`; document.getElementById('jewel-popup-overlay').style.display='flex';
}
function closeJewelPopup(){document.getElementById('jewel-popup-overlay').style.display='none';}