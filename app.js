const STORAGE_KEY = "lifeQuest_v2";

const defaultState = {
  totalExp: 0, hp: 100, level: 1, streak: 0, lastDailyDate: null,
  attributes: {english:0, academic:0, human:0},
  dailyDone: {}, normalDone: {}, logs: [], purchased: [], stats:{toeflPages:0,studyHours:0}, questConfig:null
};

const defaultQuests = [
  {id:"toefl",name:"TOEFLを1ページ進める",icon:"📖",exp:5,attr:"english",type:"good"},
  {id:"university",name:"大学の課題を進める",icon:"🎓",exp:1,attr:"academic",type:"good"},
  {id:"train",name:"電車で勉強する",icon:"🚃",exp:3,attr:"academic",type:"good"},
  {id:"sleep",name:"23:59までに寝る",icon:"🛏️",exp:5,attr:"human",type:"good",hpFail:10},
  {id:"nogame",name:"ゲームをしない",icon:"🎮",exp:0,attr:"human",type:"avoid",hpFail:15,penaltyExp:-100},
  {id:"late",name:"2時以降に寝ない",icon:"🌙",exp:0,attr:"human",type:"avoid",hpFail:5,penaltyExp:-5}
];

const defaultNormalQuests = [
  {id:"english1",name:"えいご①",icon:"📖",exp:100,attr:"english"},
  {id:"human1",name:"にんげんりょく①",icon:"⚔️",exp:200,attr:"human"}
];

const defaultLongQuests = [
  {id:"toefl100",name:"TOEFLを100ページ進める",icon:"📚",goal:100,reward:200,key:"toeflPages"},
  {id:"study100",name:"勉強時間100時間",icon:"⏱️",goal:100,reward:500,key:"studyHours"}
];

const shops = [
  {id:"game30",name:"ゲーム30分券",icon:"🎮",price:500},
  {id:"netflix60",name:"Netflix 1時間券",icon:"📺",price:300},
  {id:"free",name:"自由時間1時間券",icon:"☕",price:1000}
];

let state = loadState();
normalizeState();
let currentScreen = "home";
let currentQuestTab = "daily";
let lastResult = null;

function ensureQuestConfig(){
  if(!state.questConfig || typeof state.questConfig!=="object") state.questConfig={};
  if(!Array.isArray(state.questConfig.daily)) state.questConfig.daily=clone(defaultQuests);
  if(!Array.isArray(state.questConfig.normal)) state.questConfig.normal=clone(defaultNormalQuests);
  if(!Array.isArray(state.questConfig.long)) state.questConfig.long=clone(defaultLongQuests);
  state.questConfig.daily=state.questConfig.daily.map(q=>({...q,type:q.type||"good"}));
}
function getDailyQuests(){ensureQuestConfig();return state.questConfig.daily}
function getNormalQuests(){ensureQuestConfig();return state.questConfig.normal}
function getLongQuests(){ensureQuestConfig();return state.questConfig.long}
function attrLabel(a){return a==="english"?"英語力":a==="academic"?"学力":"人間力"}
function questCategoryLabel(c){return c==="daily"?"DAILY":c==="normal"?"NORMAL":"LONG"}
function makeQuestId(){return "custom_"+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}

function clone(x){return JSON.parse(JSON.stringify(x))}
function loadState(){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(!saved)return clone(defaultState);

    const oldAttrs=saved.attributes||{};
    const hasNewModel=("academic" in oldAttrs)||("human" in oldAttrs);

    let attrs;
    if(hasNewModel){
      attrs={
        english:Number(oldAttrs.english)||0,
        academic:Number(oldAttrs.academic)||0,
        human:Number(oldAttrs.human)||0
      };
    }else{
      // 旧5属性 → 新3属性へ移行
      attrs={
        english:Number(oldAttrs.english)||0,
        academic:(Number(oldAttrs.university)||0)+(Number(oldAttrs.knowledge)||0),
        human:(Number(oldAttrs.body)||0)+(Number(oldAttrs.creative)||0)
      };
    }

    const cfg=saved.questConfig || {
      daily:clone(defaultQuests),
      normal:clone(defaultNormalQuests),
      long:clone(defaultLongQuests)
    };
    return {
      ...clone(defaultState),
      ...saved,
      attributes:attrs,
      stats:{...defaultState.stats,...(saved.stats||{})},
      questConfig:cfg
    };
  }catch{
    return clone(defaultState)
  }
}

function getTotalExp(){
  return Object.values(state.attributes)
    .reduce((sum,value)=>sum+(Number(value)||0),0);
}

function syncTotalExp(){
  state.totalExp=getTotalExp();
}

function normalizeAttributes(){
  Object.keys(state.attributes || {}).forEach(k=>{
    state.attributes[k]=Math.max(0, Number(state.attributes[k])||0);
  });
  state.totalExp=Object.values(state.attributes).reduce((a,b)=>a+b,0);
}

function normalizeState(){
  normalizeAttributes();
  state.attributes.english=Number(state.attributes.english)||0;
  state.attributes.academic=Number(state.attributes.academic)||0;
  state.attributes.human=Number(state.attributes.human)||0;

  syncTotalExp();

  state.hp=Math.max(0,Math.min(100,Number(state.hp)||0));
  state.level=Math.max(1,Number(state.level)||1);
  state.streak=Math.max(0,Number(state.streak)||0);

  state.lastDailyDate=state.lastDailyDate||null;
  ensureQuestConfig();
}

function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function today(){return new Date().toISOString().slice(0,10)}
function yesterday(){
  const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().slice(0,10)
}
function formatDate(){
  const d=new Date(),days=["日","月","火","水","木","金","土"];
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} (${days[d.getDay()]})`
}
function levelThreshold(level){
  // Total EXP required to reach the given level.
  // Lv.1 = 0, Lv.2 = 100, Lv.3 = 250, Lv.4 = 450, ...
  level=Math.max(1,Math.floor(Number(level)||1));
  let total=0;
  for(let i=1;i<level;i++) total += 100 + (i-1)*50;
  return total;
}
function levelProgress(){
  const currentStart=levelThreshold(state.level);
  const nextStart=levelThreshold(state.level+1);
  const need=nextStart-currentStart;
  const current=Math.max(0,state.totalExp-currentStart);
  return {
    current,
    need,
    pct:Math.max(0,Math.min(100,current/Math.max(1,need)*100)),
    remaining:Math.max(0,nextStart-state.totalExp)
  };
}
function recalcLevel(){
  const oldLevel=state.level;
  while(state.totalExp>=levelThreshold(state.level+1)) state.level++;
  while(state.level>1 && state.totalExp<levelThreshold(state.level)) state.level--;
  return {oldLevel,newLevel:state.level};
}
function streakMultiplier(streak){
  if(streak >= 250) return 10;
  if(streak >= 200) return 8;
  if(streak >= 150) return 6;
  if(streak >= 100) return 4;
  if(streak >= 50) return 2;
  return 1;
}
function expMultiplier(){
  const hp=state.hp>=100?1:state.hp>=50?.5:.25;
  const streak=streakMultiplier(state.streak);
  return {hp,streak,total:hp*streak}
}

function addExp(raw,attr=null){
  const m=expMultiplier();
  const final=Math.round(Number(raw||0)*m.total);

  if(attr && state.attributes[attr] !== undefined){
    state.attributes[attr]=(Number(state.attributes[attr])||0)+final;
  }

  syncTotalExp();

  const oldLevel=state.level;
  recalcLevel();

  return {
    final,oldLevel,newLevel:state.level,m,
    beforeTotal:state.totalExp-final,
    afterTotal:state.totalExp
  };
}
function logAction(name,exp){
  state.logs.push({at:Date.now(),name,exp});
  cleanupLogs()
}
function cleanupLogs(){
  const cutoff=Date.now()-48*60*60*1000;
  state.logs=state.logs.filter(x=>x.at>=cutoff)
}
function keyFor(q){return `${today()}_${q.id}`}
function statusFor(q){return state.dailyDone[keyFor(q)]||null}

function performNormalQuest(q){
  if(state.normalDone[q.id]) return;

  const result=addExp(q.exp,q.attr);
  state.normalDone[q.id]=true;
  logAction(`${q.name} CLEAR`,result.final);
  lastResult={type:"clear",q,result};
  saveState();

  showReward(`+${result.final} EXP`);
  if(result.newLevel>result.oldLevel){
    setTimeout(()=>showLevelUp(result.newLevel),350);
  }
  render();
}

function performQuest(q, outcome){
  const key=keyFor(q);
  if(state.dailyDone[key])return;

  let result={final:0,oldLevel:state.level,newLevel:state.level,m:expMultiplier()};

  if(outcome==="clear"){
    if(q.exp>0) result=addExp(q.exp,q.attr);
    if(q.id==="toefl")state.stats.toeflPages++;
    logAction(`${q.name} CLEAR`,result.final);
    state.dailyDone[key]="clear";
    lastResult={type:"clear",q,result};
  }else{
    const oldLevel=state.level;
    if(q.hpFail) state.hp=Math.max(0,state.hp-q.hpFail);

    if(q.penaltyExp && q.attr){
      state.attributes[q.attr]=Math.max(0,(Number(state.attributes[q.attr])||0)+q.penaltyExp);
      syncTotalExp();
      recalcLevel();
    }

    logAction(`${q.name} FAIL`,q.penaltyExp||0);
    state.dailyDone[key]="fail";
    lastResult={
      type:"fail",
      q,
      result:{
        final:q.penaltyExp||0,
        oldLevel,
        newLevel:state.level,
        m:expMultiplier()
      }
    };
  }

  const streakChanged = updateStreak();
  saveState();

  if(outcome==="clear"){
    showReward(result.final?`+${result.final} EXP`:"QUEST CLEAR!");
    if(result.newLevel>result.oldLevel){
      setTimeout(()=>showLevelUp(result.newLevel),350);
    }
  }else{
    showReward(q.penaltyExp?`${q.penaltyExp} EXP`:`HP -${q.hpFail||0}`);
  }
  if(streakChanged) setTimeout(()=>toast(`🔥 STREAK ${state.streak} DAYS!`),700);

  render();
}

function updateStreak(){
  const current = today();
  if(state.lastDailyDate === current) return false;

  const allCompleted = getDailyQuests().every(q => state.dailyDone[`${current}_${q.id}`]);
  if(!allCompleted) return false;

  const prev = yesterday();
  const prevCompleted = getDailyQuests().every(q => state.dailyDone[`${prev}_${q.id}`] === "clear");

  state.streak = prevCompleted ? state.streak + 1 : 1;
  state.lastDailyDate = current;
  saveState();
  return true;
}

function render(){
  cleanupLogs();
  normalizeState();
  document.getElementById("currentDate").textContent=formatDate();
  document.getElementById("headerStreak").textContent=state.streak;
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.screen===currentScreen));
  const map={home:renderHome,quest:renderQuest,status:renderStatus,shop:renderShop,more:renderMore};
  if(!map[currentScreen]) currentScreen="home";
  try{
    document.getElementById("screen").innerHTML=map[currentScreen]();
  }catch(error){
    console.error(error);
    currentScreen="home";
    try{
      document.getElementById("screen").innerHTML=renderHome();
    }catch(fatal){
      console.error(fatal);
      document.getElementById("screen").innerHTML='<section class="panel"><div class="panel-title">LIFE QUEST</div><div class="notice">画面の読み込みでエラーが発生しました。ページを再読み込みしてください。</div></section>';
    }
  }
  bindEvents();saveState()
}

function attrLevel(exp){return Math.max(1,Math.floor(Math.max(0,exp)/100)+1)}
function nextStreakMilestone(streak){
  return [50,100,150,200,250].find(x=>streak<x) || 250;
}
function streakRewardText(streak){
  if(streak>=250)return "MAX ×10";
  const next=nextStreakMilestone(streak);
  return `次の倍率 ×${streakMultiplier(next)} まで ${next-streak} DAYS`;
}

function heroSprite(){
  if(state.level>=20) return "🛡️";
  if(state.level>=10) return "⚔️";
  if(state.level>=5) return "🧝";
  if(state.level>=3) return "🧙";
  return "🧑‍🌾";
}
function heroStage(){
  if(state.level>=20) return "LEGENDARY HERO";
  if(state.level>=10) return "KNIGHT";
  if(state.level>=5) return "ADVENTURER";
  if(state.level>=3) return "APPRENTICE";
  return "NOVICE";
}
function showReward(text){
  const el=document.createElement("div");
  el.className="reward-flash";
  el.textContent=text;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),1050);
}
function showLevelUp(level){
  const overlay=document.createElement("div");
  overlay.className="levelup-overlay";
  overlay.innerHTML=`<div class="levelup-card">
    <div class="levelup-title">LEVEL UP!</div>
    <div class="levelup-hero">${heroSprite()}</div>
    <div class="levelup-level">Lv.${level}</div>
    <div class="notice">勇者は一歩強くなった。</div>
    <button class="clear-btn" style="margin-top:16px" data-close-level>CONTINUE</button>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("[data-close-level]").addEventListener("click",()=>overlay.remove());
}

function renderHome(){
  const progress=levelProgress();
  const next=levelThreshold(state.level+1);
  const m=expMultiplier();
  return `
  <section class="panel hero-panel">
    <div class="hero-art"><div class="hero-sprite">${heroSprite()}</div></div>
    <div>
      <div class="hero-name">HERO</div><div class="big-level">Lv.${state.level}</div><div class="hero-stage">${heroStage()}</div>
      <div class="stat-row"><div class="stat-label"><span>TOTAL EXP</span><span>${progress.current.toLocaleString()} / ${progress.need.toLocaleString()}</span></div><div class="bar"><div class="fill exp-fill" style="width:${progress.pct}%"></div></div><div class="level-next">NEXT LEVELまで ${progress.remaining.toLocaleString()} EXP</div></div>
      <div class="stat-row"><div class="stat-label"><span>HP</span><span>${state.hp} / 100</span></div><div class="bar"><div class="fill hp-fill" style="width:${state.hp}%"></div></div></div>
      <div class="stat-row"><div class="stat-label"><span>STREAK</span><span>🔥 ${state.streak} DAYS</span></div><div class="bar"><div class="fill streak-fill" style="width:${Math.min(100,state.streak/2.5)}%"></div></div></div>
    </div>
  </section>
  <section class="panel"><div class="panel-title">TODAY'S STATUS</div>
    <div class="notice">HP ${state.hp>=100?"GOOD":state.hp>=50?"CAUTION":"DANGER"} ／ EXP倍率 <span class="multiplier">×${m.hp}</span> ／ STREAK倍率 <span class="multiplier">×${m.streak}</span> ／ TOTAL <span class="multiplier">×${m.total}</span></div>
    <div class="notice" style="margin-top:6px">英語力 ${state.attributes.english.toLocaleString()} ／ 学力 ${state.attributes.academic.toLocaleString()} ／ 人間力 ${state.attributes.human.toLocaleString()} ／ TOTAL ${state.totalExp.toLocaleString()}</div>
  </section>
  <section class="panel"><div class="panel-title">🔥 STREAK REWARD</div>
    <div class="streak-card">
      <div class="streak-fire">🔥</div>
      <div>
        <div class="streak-number">${state.streak} DAY STREAK</div>
        <div class="streak-next">${streakRewardText(state.streak)}</div>
        <div class="mini-progress"><div style="width:${state.streak>=250?100:(state.streak%50)/50*100}%"></div></div>
      </div>
      <div class="multiplier">×${streakMultiplier(state.streak)}</div>
    </div>
    <div class="reward-list">
      <div class="reward-row"><span>50 DAYS</span><span>×2 EXP</span></div>
      <div class="reward-row"><span>100 DAYS</span><span>×4 EXP</span></div>
      <div class="reward-row"><span>150 DAYS</span><span>×6 EXP</span></div>
      <div class="reward-row"><span>200 DAYS</span><span>×8 EXP</span></div>
      <div class="reward-row"><span>250 DAYS</span><span>×10 EXP MAX</span></div>
    </div>
  </section>
  ${lastResult?`<section class="panel result-box"><div class="exp-pop">${lastResult.type==="clear"?(lastResult.result.final?`+${lastResult.result.final} EXP`:"QUEST CLEAR!"):(lastResult.result.final?`${lastResult.result.final} EXP`:`HP -${lastResult.q.hpFail||0}`)}</div><div class="notice">${lastResult.q.name}</div>${lastResult.result.newLevel>lastResult.result.oldLevel?`<div class="multiplier">⚔ LEVEL UP! Lv.${lastResult.result.newLevel}</div>`:""}</section>`:""}
  <section class="panel"><div class="panel-title">COMMAND</div><div class="command-list">
    <button class="command" data-go="quest">▶ QUEST<small>今日の行動を記録する</small></button>
    <button class="command" data-go="status">▶ STATUS<small>属性EXPと成長を見る</small></button>
    <button class="command" data-go="shop">▶ SHOP<small>EXPでご褒美を買う</small></button>
    <button class="command" data-go="more">▶ MORE<small>実績・設定・ログ</small></button>
  </div></section>`
}

function renderQuest(){
  let html=`<section class="panel"><div class="panel-title">QUEST</div><div class="quest-tabs">
  <button class="tab ${currentQuestTab==="daily"?"active":""}" data-tab="daily">デイリー</button>
  <button class="tab ${currentQuestTab==="normal"?"active":""}" data-tab="normal">通常</button>
  <button class="tab ${currentQuestTab==="long"?"active":""}" data-tab="long">長期</button></div>`;
  if(currentQuestTab==="normal"){
    html+=`<div class="notice">通常クエストは1回クリア型。デイリーSTREAKには影響しない。</div>`;
    for(const q of getNormalQuests()){
      const done=!!state.normalDone[q.id];
      html+=`<div class="quest-item good-quest ${done?"done":""}">
        <div class="quest-icon">${q.icon}</div>
        <div>
          <div class="quest-kind">NORMAL QUEST</div>
          <div class="quest-name">${q.name}</div>
          <div class="quest-meta">CLEAR: +${q.exp} EXP ／ 属性: ${q.attr==="english"?"英語力":"人間力"}</div>
        </div>
        <div class="quest-actions">
          ${done
            ? `<button class="clear-btn" disabled>CLEAR</button>`
            : `<button class="clear-btn" data-normal-clear="${q.id}">CLEAR</button>`}
        </div>
      </div>`;
    }
  }else if(currentQuestTab==="long"){
    for(const q of getLongQuests()){
      const value=state.stats[q.key]||0;
      const pct=Math.min(100,value/q.goal*100);
      html+=`<div class="quest-item"><div class="quest-icon">${q.icon}</div><div><div class="quest-name">${q.name}</div><div class="quest-meta">進捗 ${value} / ${q.goal} ／ REWARD +${q.reward} EXP</div><div class="bar"><div class="fill exp-fill" style="width:${pct}%"></div></div></div><div class="progress">${Math.round(pct)}%</div></div>`
    }
  }else{
    for(const q of getDailyQuests()){
      const s=statusFor(q),done=!!s;
      const reward=q.exp>0?`+${q.exp} EXP`:`成功報酬なし`;
      const isAvoid=q.type==="avoid";
      const title=isAvoid?`今日${q.name.replace("しない","をしなかった")}`:q.name;
      html+=`<div class="quest-item ${isAvoid?"avoid-quest":"good-quest"} ${s==="clear"?"done":""} ${s==="fail"?"failed":""}">
        <div class="quest-icon">${q.icon}</div>
        <div>
          <div class="quest-kind">${isAvoid?"HABIT CHECK":"DAILY QUEST"}</div>
          <div class="quest-name">${title}</div>
          <div class="quest-meta">${reward}${q.hpFail?` ／ FAIL: HP -${q.hpFail}`:""}${q.penaltyExp?` ／ FAIL: ${q.penaltyExp} EXP`:""}</div>
        </div>
        <div class="quest-actions">
          ${done
            ? `<button class="clear-btn" disabled>${s==="clear"?"CLEAR":"FAILED"}</button>`
            : isAvoid
              ? `<button class="clear-btn success-btn" data-clear="${q.id}">守った</button><button class="fail-btn" data-fail="${q.id}">やった</button>`
              : `<button class="clear-btn" data-clear="${q.id}">CLEAR</button><button class="fail-btn" data-fail="${q.id}">FAIL</button>`}
        </div>
      </div>`
    }
  }
  html+=`</section><section class="panel"><div class="notice">習慣系は「守った」か「やった」を記録。FAILするとHP減少・EXPペナルティが発生する。毎日の行動は1回だけ判定される。</div></section>`;
  return html
}

function renderStatus(){
  const attrs=[
    ["english","📖","英語力","TOEFL・英語学習","var(--blue)"],
    ["academic","🎓","学力","大学の理系科目・課題","var(--green)"],
    ["human","⚔️","人間力","生活習慣・健康・娯楽など","var(--gold)"]
  ];
  return `<section class="panel"><div class="panel-title">STATUS</div>
    <div class="hero-name">Lv.${state.level} 勇者 ${heroSprite()}</div>
    <div class="notice">TOTAL EXP ${state.totalExp.toLocaleString()} ／ HP ${state.hp}/100 ／ 🔥 STREAK ${state.streak}</div>
  </section>
  <section class="panel"><div class="panel-title">属性EXP</div>
    <div class="attr-grid">${attrs.map(([k,i,n,d,c])=>`
      <div class="attr-card">
        <div class="attr-head"><span>${i} ${n}</span><span>${state.attributes[k].toLocaleString()} EXP</span></div>
        <div class="attr-level">Lv.${attrLevel(state.attributes[k])}</div>
        <div class="notice" style="font-size:10px;margin:4px 0">${d}</div>
        <div class="attr-bar"><div class="attr-fill" style="width:${Math.max(0,state.attributes[k]%100)}%;background:${c}"></div></div>
      </div>`).join("")}</div>
  </section>`
}

function renderShop(){
  return `<section class="panel"><div class="panel-title">EXP SHOP</div><div class="notice">頑張った自分に、ごほうびを。購入するとEXPだけが減り、購入記録が残る。</div>
  ${shops.map(i=>`<div class="shop-item"><div>${i.icon} ${i.name}</div><div class="price">${i.price.toLocaleString()} EXP</div><button class="buy-btn" data-buy="${i.id}" ${state.totalExp<i.price?"disabled":""}>購入</button></div>`).join("")}</section>`
}

function renderMore(){
  return `<section class="panel"><div class="panel-title">MORE</div><div class="command-list">
  <button class="command" data-more="achievements">🏆 ACHIEVEMENTS<small>実績を見る</small></button>
  <button class="command" data-more="options">⚙ OPTIONS<small>クエスト・ゲーム設定を管理する</small></button>
  <button class="command" data-more="logs">📜 LOG<small>直近48時間の行動ログ</small></button>
  </div></section>`
}

function renderQuestEditor(category="daily"){
  const list=category==="daily"?getDailyQuests():category==="normal"?getNormalQuests():getLongQuests();
  const rows=list.map(q=>{
    const extra=category==="daily" ? `${q.type==="avoid"?"守った/やった":"CLEAR/FAIL"} ／ ${attrLabel(q.attr)} ／ +${q.exp||0} EXP` : category==="normal" ? `${attrLabel(q.attr)} ／ +${q.exp||0} EXP` : `${q.goal||0} 目標 ／ +${q.reward||0} EXP`;
    return `<div class="quest-edit-row"><div><div class="quest-edit-name">${q.icon||"📜"} ${q.name}</div><div class="quest-meta">${extra}</div></div><div class="quest-edit-actions"><button class="small-btn" data-edit-quest="${q.id}" data-edit-category="${category}">編集</button><button class="small-btn danger" data-delete-quest="${q.id}" data-delete-category="${category}">削除</button></div></div>`
  }).join("");
  return `<section class="panel"><div class="panel-title">QUEST MANAGEMENT</div>
    <div class="notice">ここだけでクエストを追加・編集・削除できます。ゲーム画面には編集項目を置きません。</div>
    <div class="quest-tabs editor-tabs">
      <button class="tab ${category==="daily"?"active":""}" data-editor-tab="daily">デイリー</button>
      <button class="tab ${category==="normal"?"active":""}" data-editor-tab="normal">通常</button>
      <button class="tab ${category==="long"?"active":""}" data-editor-tab="long">長期</button>
    </div>
    <button class="add-quest-btn" data-new-quest="${category}">＋ NEW QUEST</button>
    <div class="quest-editor-list">${rows||`<div class="notice">まだクエストがありません。</div>`}</div>
    <button class="back-btn" data-back-options>← OPTIONSに戻る</button>
  </section>`;
}

function renderQuestForm(category, id=null){
  const list=category==="daily"?getDailyQuests():category==="normal"?getNormalQuests():getLongQuests();
  const q=id?list.find(x=>x.id===id):null;
  const daily=category==="daily", long=category==="long";
  const type=q?.type||"good";
  return `<section class="panel"><div class="panel-title">${q?"EDIT QUEST":"NEW QUEST"} ／ ${questCategoryLabel(category)}</div>
    <div class="field-grid">
      <label>クエスト名<input id="quest-name" value="${escapeAttr(q?.name||"")}" placeholder="例：英語を30分勉強する"></label>
      <label>アイコン<input id="quest-icon" value="${escapeAttr(q?.icon||"📜")}" maxlength="4"></label>
      ${!long?`<label>属性<select id="quest-attr"><option value="english" ${q?.attr==="english"?"selected":""}>英語力</option><option value="academic" ${q?.attr==="academic"?"selected":""}>学力</option><option value="human" ${q?.attr==="human"?"selected":""}>人間力</option></select></label>`:""}
      ${long?`<label>目標値<input id="quest-goal" type="number" min="1" value="${q?.goal||100}"></label><label>達成報酬EXP<input id="quest-reward" type="number" min="0" value="${q?.reward||0}"></label><label>進捗キー<input id="quest-key" value="${escapeAttr(q?.key||makeQuestId())}"></label>`:`<label>獲得EXP<input id="quest-exp" type="number" value="${q?.exp||0}"></label>`}
      ${daily?`<label>デイリー種別<select id="quest-type"><option value="good" ${type==="good"?"selected":""}>GOOD（CLEAR / FAIL）</option><option value="avoid" ${type==="avoid"?"selected":""}>AVOID（守った / やった）</option></select></label><label>FAIL時 HP減少<input id="quest-hp" type="number" min="0" value="${q?.hpFail||0}"></label><label>FAIL時 EXPペナルティ<input id="quest-penalty" type="number" value="${q?.penaltyExp||0}"></label>`:""}
    </div>
    <div class="editor-actions"><button class="save-quest-btn" data-save-quest="${category}" data-save-id="${q?.id||""}">SAVE</button><button class="back-btn" data-back-quest-editor="${category}">CANCEL</button></div>
  </section>`;
}
function escapeAttr(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function renderOptions(){
  document.getElementById("screen").innerHTML=`<section class="panel"><div class="panel-title">OPTIONS</div><div class="settings-list">
  <div class="setting"><span>クエスト設定</span><button data-open-quest-editor>編集する</button></div>
  <div class="setting"><span>EXP設定</span><button disabled>次期実装</button></div>
  <div class="setting"><span>HP設定</span><button disabled>次期実装</button></div>
  <div class="setting"><span>属性設定</span><button disabled>次期実装</button></div>
  <div class="setting"><span>ショップ設定</span><button disabled>次期実装</button></div>
  <div class="setting"><span>データ管理</span><button data-reset>RESET DATA</button></div>
  </div></section><section class="panel"><div class="notice">CURRENT DATA：TOTAL EXP ${state.totalExp.toLocaleString()} ／ HP ${state.hp} ／ Lv.${state.level}</div></section>
  <section class="panel"><div class="notice">QUEST MANAGEMENTでは、デイリー・通常・長期のクエストを追加、編集、削除できます。</div></section>`;
  document.querySelector("[data-open-quest-editor]")?.addEventListener("click",()=>openQuestEditor("daily"));
  document.querySelector("[data-reset]")?.addEventListener("click",()=>{
    localStorage.removeItem(STORAGE_KEY); state=clone(defaultState); state.questConfig={daily:clone(defaultQuests),normal:clone(defaultNormalQuests),long:clone(defaultLongQuests)}; lastResult=null; currentQuestTab="daily"; saveState(); render(); setTimeout(()=>toast("DATA RESET — Lv.1 / EXP 0 / HP 100"),50);
  });
}
function openQuestEditor(category="daily"){document.getElementById("screen").innerHTML=renderQuestEditor(category);bindEditorEvents()}
function openQuestForm(category,id=null){document.getElementById("screen").innerHTML=renderQuestForm(category,id);bindEditorEvents()}
function bindEditorEvents(){
  document.querySelectorAll("[data-editor-tab]").forEach(b=>b.addEventListener("click",()=>openQuestEditor(b.dataset.editorTab)));
  document.querySelectorAll("[data-new-quest]").forEach(b=>b.addEventListener("click",()=>openQuestForm(b.dataset.newQuest)));
  document.querySelectorAll("[data-edit-quest]").forEach(b=>b.addEventListener("click",()=>openQuestForm(b.dataset.editCategory,b.dataset.editQuest)));
  document.querySelectorAll("[data-delete-quest]").forEach(b=>b.addEventListener("click",()=>{
    const c=b.dataset.deleteCategory,id=b.dataset.deleteQuest; const list=c==="daily"?getDailyQuests():c==="normal"?getNormalQuests():getLongQuests(); const idx=list.findIndex(q=>q.id===id); if(idx<0)return;
    list.splice(idx,1); if(c==="daily"){delete state.dailyDone[`${today()}_${id}`]} else if(c==="normal"){delete state.normalDone[id]}; saveState(); openQuestEditor(c); toast("QUEST DELETED");
  }));
  document.querySelector("[data-back-options]")?.addEventListener("click",()=>renderOptions());
  document.querySelectorAll("[data-back-quest-editor]").forEach(b=>b.addEventListener("click",()=>openQuestEditor(b.dataset.backQuestEditor)));
  document.querySelector("[data-open-quest-editor]")?.addEventListener("click",()=>openQuestEditor("daily"));
  document.querySelector("[data-save-quest]")?.addEventListener("click",()=>{
    const c=document.querySelector("[data-save-quest]").dataset.saveQuest,id=document.querySelector("[data-save-quest]").dataset.saveId;
    const name=document.getElementById("quest-name")?.value.trim(); if(!name){toast("クエスト名を入力してね");return}
    const q={id:id||makeQuestId(),name,icon:document.getElementById("quest-icon")?.value.trim()||"📜",attr:document.getElementById("quest-attr")?.value||"human"};
    if(c==="long") Object.assign(q,{goal:Math.max(1,Number(document.getElementById("quest-goal").value)||100),reward:Math.max(0,Number(document.getElementById("quest-reward").value)||0),key:document.getElementById("quest-key").value.trim()||makeQuestId()});
    else {q.exp=Number(document.getElementById("quest-exp").value)||0; if(c==="daily") Object.assign(q,{type:document.getElementById("quest-type").value,hpFail:Math.max(0,Number(document.getElementById("quest-hp").value)||0),penaltyExp:Number(document.getElementById("quest-penalty").value)||0});}
    const list=c==="daily"?getDailyQuests():c==="normal"?getNormalQuests():getLongQuests(); const idx=list.findIndex(x=>x.id===q.id); if(idx>=0) list[idx]=q; else list.push(q); saveState(); openQuestEditor(c); toast(id?"QUEST UPDATED":"QUEST ADDED");
  });
}

function renderLogs(){
  cleanupLogs();
  document.getElementById("screen").innerHTML=`<section class="panel"><div class="panel-title">LOG — LAST 48 HOURS</div>${state.logs.length?state.logs.slice().reverse().map(l=>`<div class="achievement"><div class="badge">•</div><div><div>${l.name}</div><div class="progress">${new Date(l.at).toLocaleString()} ／ ${l.exp>=0?"+":""}${l.exp} EXP</div></div></div>`).join(""):`<div class="notice">まだログがない。</div>`}</section>`
}

function bindEvents(){
  document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>{currentScreen=b.dataset.go;lastResult=null;render()}));
  document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{currentQuestTab=b.dataset.tab;render()}));
  document.querySelectorAll("[data-clear]").forEach(b=>b.addEventListener("click",()=>{const q=getDailyQuests().find(x=>x.id===b.dataset.clear);if(q)performQuest(q,"clear")}));
  document.querySelectorAll("[data-normal-clear]").forEach(b=>b.addEventListener("click",()=>{const q=getNormalQuests().find(x=>x.id===b.dataset.normalClear);if(q)performNormalQuest(q)}));
  document.querySelectorAll("[data-fail]").forEach(b=>b.addEventListener("click",()=>{const q=getDailyQuests().find(x=>x.id===b.dataset.fail);if(q)performQuest(q,"fail")}));
  document.querySelectorAll("[data-buy]").forEach(b=>b.addEventListener("click",()=>{
    const i=shops.find(x=>x.id===b.dataset.buy);if(!i||state.totalExp<i.price)return;
    let remain=i.price;
    for(const k of ["human","academic","english"]){
      const take=Math.min(Math.max(0,state.attributes[k]),remain);
      state.attributes[k]-=take;
      remain-=take;
      if(remain<=0)break;
    }
    syncTotalExp();
    recalcLevel();
    state.purchased.push({id:i.id,at:Date.now()});
    saveState();toast(`${i.name} を購入`);render()
  }));
  document.querySelectorAll("[data-more]").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.more==="achievements")renderAchievements();if(b.dataset.more==="options")renderOptions();if(b.dataset.more==="logs")renderLogs()}));
}
document.addEventListener("click",(event)=>{
  const nav = event.target.closest(".nav-btn");
  if(nav){
    event.preventDefault();
    currentScreen = nav.dataset.screen || "home";
    currentQuestTab = "daily";
    lastResult = null;
    render();
    window.scrollTo({top:0,behavior:"smooth"});
  }
});
window.addEventListener("error",(event)=>{
  console.error(event.error || event.message);
});
function toast(message){const e=document.getElementById("toast");e.textContent=message;e.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove("show"),1400)}
render();
