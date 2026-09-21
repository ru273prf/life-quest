const STORAGE_KEY = "lifeQuest_v2";
const APP_VERSION = "V26";

const defaultState = {
  totalExp: 0, hp: 100, level: 1, streak: 0, lastDailyDate: null,
  attributes: {english:0, academic:0, human:0},
  dailyDone: {}, normalDone: {}, logs: [], purchased: [], items: {}, stats:{toeflPages:0,studyHours:0}, questConfig:null,
  settings:{
    exp:{levelBase:100,levelStep:50,streakMultipliers:{50:2,100:4,150:6,200:8,250:10}},
    hp:{max:100,highThreshold:100,midThreshold:50,highMultiplier:1,midMultiplier:0.5,lowMultiplier:0.25},
    attributes:{
      english:{label:"英語力",icon:"📖",description:"TOEFL・英語学習"},
      academic:{label:"学力",icon:"🎓",description:"大学の理系科目・課題"},
      human:{label:"人間力",icon:"⚔️",description:"生活習慣・健康・娯楽など"}
    },
    itemRewards:[
      {id:"game30",name:"ゲーム30分券",icon:"🎮",description:"ゲームを30分楽しめる券",enabled:true},
      {id:"netflix60",name:"Netflix 1時間券",icon:"📺",description:"Netflixを1時間楽しめる券",enabled:true},
      {id:"free",name:"自由時間1時間券",icon:"☕",description:"好きなことを1時間やる券",enabled:true},
      {id:"meal",name:"好きなご飯を食べる券",icon:"🍚",description:"好きなご飯を楽しむ券",enabled:true}
    ]
  }
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

const defaultShops = [
  {id:"game30",name:"ゲーム30分券",icon:"🎮",price:500},
  {id:"netflix60",name:"Netflix 1時間券",icon:"📺",price:300},
  {id:"free",name:"自由時間1時間券",icon:"☕",price:1000}
];

let state = loadState();
normalizeState();
let currentScreen = "home";
let currentQuestTab = "daily";
let lastResult = null;

function ensureSettings(){
  if(!state.settings || typeof state.settings!=="object") state.settings=clone(defaultState.settings);
  state.settings.exp={...defaultState.settings.exp,...(state.settings.exp||{})};
  state.settings.exp.streakMultipliers={...defaultState.settings.exp.streakMultipliers,...(state.settings.exp.streakMultipliers||{})};
  state.settings.hp={...defaultState.settings.hp,...(state.settings.hp||{})};
  state.settings.attributes={...defaultState.settings.attributes,...(state.settings.attributes||{})};
  for(const k of ["english","academic","human"]){state.settings.attributes[k]={...defaultState.settings.attributes[k],...(state.settings.attributes[k]||{})}}
  if(!Array.isArray(state.settings.itemRewards)){
    const legacy=Array.isArray(state.settings.shops)?state.settings.shops:defaultShops;
    state.settings.itemRewards=legacy.map(x=>({id:x.id,name:x.name,icon:x.icon||"🎁",description:"STREAK報酬アイテム",enabled:true}));
  }
  state.settings.itemRewards=state.settings.itemRewards.map(x=>({...x,enabled:x.enabled!==false,description:x.description||"STREAK報酬アイテム"}));
}
function getItemRewards(){ensureSettings();return state.settings.itemRewards}
function getAttrConfig(key){ensureSettings();return state.settings.attributes[key]||defaultState.settings.attributes[key]}
function attrLabel(a){return getAttrConfig(a).label}
function attrIcon(a){return getAttrConfig(a).icon}
function attrDescription(a){return getAttrConfig(a).description}

function ensureQuestConfig(){
  if(!state.questConfig || typeof state.questConfig!=="object") state.questConfig={};
  if(!Array.isArray(state.questConfig.daily)) state.questConfig.daily=clone(defaultQuests);
  if(!Array.isArray(state.questConfig.normal)) state.questConfig.normal=clone(defaultNormalQuests);
  if(!Array.isArray(state.questConfig.long)) state.questConfig.long=clone(defaultLongQuests);
  state.questConfig.daily=state.questConfig.daily.map(q=>({...q,type:q.type||"good",buttonMode:q.buttonMode||"both"}));
  state.questConfig.normal=state.questConfig.normal.map(q=>({...q,buttonMode:q.buttonMode||"clear"}));
}
function getDailyQuests(){ensureQuestConfig();return state.questConfig.daily}
function getNormalQuests(){ensureQuestConfig();return state.questConfig.normal}
function getLongQuests(){ensureQuestConfig();return state.questConfig.long}
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
    const mergedSettings={...clone(defaultState.settings),...(saved.settings||{})};
    // V22以前のSHOP設定をITEM抽選候補へ移行
    if(!saved.settings?.itemRewards && Array.isArray(saved.settings?.shops)){
      mergedSettings.itemRewards=saved.settings.shops.map(x=>({id:x.id,name:x.name,icon:x.icon||"🎁",description:"STREAK報酬アイテム",enabled:true}));
    }
    return {
      ...clone(defaultState),
      ...saved,
      attributes:attrs,
      stats:{...defaultState.stats,...(saved.stats||{})},
      questConfig:cfg,
      settings:mergedSettings
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
  ensureSettings();
  state.attributes.english=Number(state.attributes.english)||0;
  state.attributes.academic=Number(state.attributes.academic)||0;
  state.attributes.human=Number(state.attributes.human)||0;

  syncTotalExp();

  state.hp=Math.max(0,Math.min(Number(state.settings.hp.max)||100,Number(state.hp)||0));
  state.level=Math.max(1,Number(state.level)||1);
  state.streak=Math.max(0,Number(state.streak)||0);

  state.lastDailyDate=state.lastDailyDate||null;
  state.dailyDone=state.dailyDone&&typeof state.dailyDone==="object"?state.dailyDone:{};
  state.normalDone=state.normalDone&&typeof state.normalDone==="object"?state.normalDone:{};
  state.purchased=Array.isArray(state.purchased)?state.purchased:[];
  state.items=state.items&&typeof state.items==="object"?state.items:{};
  for(const item of getItemRewards()){
    state.items[item.id]=Math.max(0,Math.floor(Number(state.items[item.id])||0));
  }
  state.logs=Array.isArray(state.logs)?state.logs:[];
  state.stats={...defaultState.stats,...(state.stats||{})};
  ensureQuestConfig();
  // V18の通常クエスト判定バグでテスト用2クエストが誤ってFAILEDになった場合だけ復元
  if(state.normalDone && state.normalDone.english1==="fail" && state.normalDone.human1==="fail" && !state._v19Recovered){
    delete state.normalDone.english1;
    delete state.normalDone.human1;
    state._v19Recovered=true;
  }
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
  level=Math.max(1,Math.floor(Number(level)||1));
  ensureSettings();
  const base=Math.max(1,Number(state.settings.exp.levelBase)||100);
  const step=Math.max(0,Number(state.settings.exp.levelStep)||50);
  let total=0;
  for(let i=1;i<level;i++) total += base + (i-1)*step;
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
  ensureSettings();
  const m=state.settings.exp.streakMultipliers;
  if(streak>=250)return Number(m[250])||10;
  if(streak>=200)return Number(m[200])||8;
  if(streak>=150)return Number(m[150])||6;
  if(streak>=100)return Number(m[100])||4;
  if(streak>=50)return Number(m[50])||2;
  return 1;
}
function expMultiplier(){
  ensureSettings();
  const h=state.settings.hp;
  const hp=state.hp>=Number(h.highThreshold)?Number(h.highMultiplier):state.hp>=Number(h.midThreshold)?Number(h.midMultiplier):Number(h.lowMultiplier);
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

function performNormalQuest(q,outcome){
  const saved=state.normalDone[q.id];
  if(saved) return;
  let result={final:0,oldLevel:state.level,newLevel:state.level,m:expMultiplier()};
  if(outcome==="clear"){
    if(q.exp>0) result=addExp(q.exp,q.attr);
    state.normalDone[q.id]="clear";
    logAction(`${q.name} CLEAR`,result.final);
    lastResult={type:"clear",q,result};
    saveState();
    showReward(result.final?`+${result.final} EXP`:"QUEST CLEAR!");
    if(result.newLevel>result.oldLevel) setTimeout(()=>showLevelUp(result.newLevel),350);
  }else{
    const oldLevel=state.level;
    if(q.hpFail) state.hp=Math.max(0,Math.min(Number(state.settings.hp.max)||100,state.hp-q.hpFail));
    if(q.penaltyExp && q.attr){
      state.attributes[q.attr]=Math.max(0,(Number(state.attributes[q.attr])||0)+q.penaltyExp);
      syncTotalExp();
      recalcLevel();
    }
    state.normalDone[q.id]="fail";
    logAction(`${q.name} FAIL`,q.penaltyExp||0);
    lastResult={type:"fail",q,result:{final:q.penaltyExp||0,oldLevel,newLevel:state.level,m:expMultiplier()}};
    saveState();
    showReward(q.penaltyExp?`${q.penaltyExp} EXP`:`HP -${q.hpFail||0}`);
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
    if(q.hpFail) state.hp=Math.max(0,Math.min(Number(state.settings.hp.max)||100,state.hp-q.hpFail));

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

  const daily = getDailyQuests();
  // STREAK条件は「今日のデイリーを全部判定済み」かつ「全部CLEAR」。
  // 1つでもFAILなら、その日はSTREAK対象外。
  const allSelected = daily.length > 0 && daily.every(q => !!state.dailyDone[`${current}_${q.id}`]);
  const allCleared = allSelected && daily.every(q => state.dailyDone[`${current}_${q.id}`] === "clear");
  if(!allCleared) return false;

  const prev = yesterday();
  const prevCompleted = daily.every(q => state.dailyDone[`${prev}_${q.id}`] === "clear");

  state.streak = prevCompleted ? state.streak + 1 : 1;
  state.lastDailyDate = current;
  const reward = grantRandomItem();
  if(reward){
    state._lastItemReward={id:reward.id,name:reward.name,icon:reward.icon,at:Date.now(),streak:state.streak};
  }else{
    state._lastItemReward=null;
  }
  saveState();
  if(reward){
    setTimeout(()=>toast(`🎁 ITEM GET：${reward.icon} ${reward.name}`),700);
  }
  return true;
}

function grantRandomItem(){
  const choices=getItemRewards().filter(i=>i.enabled!==false);
  if(!choices.length) return null;
  const reward=choices[Math.floor(Math.random()*choices.length)];
  state.items[reward.id]=Math.max(0,Math.floor(Number(state.items[reward.id])||0))+1;
  return reward;
}

function render(){
  cleanupLogs();
  normalizeState();
  document.getElementById("currentDate").textContent=formatDate();
  document.getElementById("headerStreak").textContent=state.streak;
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.screen===currentScreen));
  const map={home:renderHome,quest:renderQuest,status:renderStatus,item:renderItem,more:renderMore};
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
      <div class="stat-row"><div class="stat-label"><span>HP</span><span>${state.hp} / 100</span></div><div class="bar"><div class="fill hp-fill" style="width:${Math.max(0,Math.min(100,state.hp/state.settings.hp.max*100))}%"></div></div></div>
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
    <button class="command" data-go="item">▶ ITEM<small>STREAKで獲得したアイテム</small></button>
    <button class="command" data-go="more">▶ MORE<small>実績・設定・ログ</small></button>
  </div></section>`
}

function renderQuest(){
  let html=`<section class="panel"><div class="panel-title">QUEST</div><div class="quest-tabs">
  <button class="tab ${currentQuestTab==="daily"?"active":""}" data-tab="daily">デイリー</button>
  <button class="tab ${currentQuestTab==="normal"?"active":""}" data-tab="normal">通常</button>
  <button class="tab ${currentQuestTab==="long"?"active":""}" data-tab="long">長期</button></div>`;
  if(currentQuestTab==="normal"){
    html+=`<div class="notice">通常クエストは1回判定型。デイリーSTREAKには影響しない。CLEAR / FAIL の表示は設定から選べる。</div>`;
    for(const q of getNormalQuests()){
      const status=state.normalDone[q.id]===true?"clear":state.normalDone[q.id];
      const done=!!status;
      const mode=q.buttonMode||"clear";
      const failInfo=(q.hpFail?` ／ FAIL: HP -${q.hpFail}`:"")+(q.penaltyExp?` ／ FAIL: EXP ${q.penaltyExp}`:"");
      const buttons=mode==="clear"?`<button class="clear-btn" data-normal-clear="${q.id}">CLEAR</button>`:mode==="fail"?`<button class="fail-btn" data-normal-fail="${q.id}">FAIL</button>`:`<button class="clear-btn" data-normal-clear="${q.id}">CLEAR</button><button class="fail-btn" data-normal-fail="${q.id}">FAIL</button>`;
      html+=`<div class="quest-item ${status==="fail"?"failed":"good-quest"} ${done?"done":""}">
        <div class="quest-icon">${q.icon}</div>
        <div>
          <div class="quest-kind">NORMAL QUEST</div>
          <div class="quest-name">${q.name}</div>
          <div class="quest-meta">CLEAR: +${q.exp||0} EXP ／ 属性: ${attrLabel(q.attr)}${failInfo}</div>
        </div>
        <div class="quest-actions">
          ${done ? `<button class="${status==="fail"?"fail-btn":"clear-btn"}" disabled>${status==="fail"?"FAIL":"CLEAR"}</button>` : buttons}
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
            ? `<button class="${s==="fail"?"fail-btn":"clear-btn"}" disabled>${s==="clear"?"CLEAR":"FAIL"}</button>`
            : (()=>{const mode=q.buttonMode||"both"; return mode==="clear"?`<button class="clear-btn" data-clear="${q.id}">CLEAR</button>`:mode==="fail"?`<button class="fail-btn" data-fail="${q.id}">FAIL</button>`:`<button class="clear-btn" data-clear="${q.id}">CLEAR</button><button class="fail-btn" data-fail="${q.id}">FAIL</button>`})()}
        </div>
      </div>`
    }
  }
  html+=`</section><section class="panel"><div class="notice">デイリークエストはCLEAR / FAILで判定。FAILするとHP減少・EXPペナルティが発生する。毎日の行動は1回だけ判定される。</div></section>`;
  return html
}

function renderStatus(){
  const attrs=[
    ["english",getAttrConfig("english").icon,getAttrConfig("english").label,getAttrConfig("english").description,"var(--blue)"],
    ["academic",getAttrConfig("academic").icon,getAttrConfig("academic").label,getAttrConfig("academic").description,"var(--green)"],
    ["human",getAttrConfig("human").icon,getAttrConfig("human").label,getAttrConfig("human").description,"var(--gold)"]
  ];
  return `<section class="panel"><div class="panel-title">STATUS</div>
    <div class="hero-name">Lv.${state.level} 勇者 ${heroSprite()}</div>
    <div class="notice">TOTAL EXP ${state.totalExp.toLocaleString()} ／ HP ${state.hp}/${state.settings.hp.max} ／ 🔥 STREAK ${state.streak}</div>
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

function renderItem(){
  const rewards=getItemRewards();
  const owned=rewards.filter(i=>(state.items[i.id]||0)>0);
  const last=state._lastItemReward;
  const html=`<section class="panel"><div class="panel-title">ITEM</div>
  <div class="notice">🔥 STREAKが1増えるたび、設定された候補からランダムで1個もらえる。</div>
  ${last?`<div class="item-get-card"><div class="item-get-title">🎁 LAST ITEM GET</div><div class="item-get-main">${last.icon} ${escapeHtml(last.name)}</div><div class="quest-meta">STREAK ${last.streak} で獲得</div></div>`:""}
  <div class="section-title">所持アイテム</div>
  ${owned.length?owned.map(i=>`<div class="item-row"><div class="item-main"><span class="item-icon">${i.icon}</span><div><div class="item-name">${escapeHtml(i.name)}</div><div class="quest-meta">${escapeHtml(i.description||"STREAK報酬アイテム")}</div></div></div><div class="item-actions"><div class="item-count">×${state.items[i.id]||0}</div><button class="item-use-btn" data-use-item="${i.id}">使う</button></div></div>`).join(""):`<div class="notice">まだアイテムを持っていない。まずは今日のデイリーを全部CLEARしてSTREAKを1増やそう🔥</div>`}
  <div class="section-title">現在の抽選候補</div>
  ${rewards.filter(i=>i.enabled!==false).map(i=>`<div class="reward-choice">${i.icon} ${escapeHtml(i.name)}</div>`).join("")||`<div class="notice">抽選候補が設定されていません。</div>`}
  </section>`;
  document.querySelectorAll("[data-use-item]").forEach(btn=>btn.addEventListener("click",()=>useItem(btn.dataset.useItem)));
  return html;
}

function useItem(itemId){
  const item=getItemRewards().find(i=>i.id===itemId);
  const count=Number(state.items[itemId]||0);
  if(!item || count<=0){toast("そのITEMは持っていません");return}
  if(!confirm(`${item.icon} ${item.name} を1個使いますか？`))return;
  state.items[itemId]=count-1;
  state._lastItemUsed={id:item.id,name:item.name,icon:item.icon,usedAt:new Date().toISOString()};
  saveState();
  render();
  toast(`🎁 ${item.name} を使った！ 残り ×${state.items[itemId]}`);
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
    const modeLabel=(q.buttonMode||"clear")==="clear"?"CLEARのみ":(q.buttonMode||"clear")==="fail"?"FAILのみ":"CLEAR / FAIL";
    const failLabel=(q.hpFail?`HP -${q.hpFail}`:"")+(q.penaltyExp?`${q.hpFail?" ／ ":""}EXP ${q.penaltyExp}`:"");
    const extra=category==="daily" ? `CLEAR / FAIL ／ ${modeLabel} ／ ${attrLabel(q.attr)} ／ +${q.exp||0} EXP${failLabel?` ／ FAIL: ${failLabel}`:""}` : category==="normal" ? `${modeLabel} ／ ${attrLabel(q.attr)} ／ +${q.exp||0} EXP${failLabel?` ／ FAIL: ${failLabel}`:""}` : `${q.goal||0} 目標 ／ +${q.reward||0} EXP`;
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
      ${daily?`<label>デイリー種別<select id="quest-type"><option value="good" ${type==="good"?"selected":""}>CLEAR / FAIL</option><option value="avoid" ${type==="avoid"?"selected":""}>CLEAR / FAIL</option></select></label>`:""}
      ${!long?`<label>ボタン表示<select id="quest-button-mode"><option value="clear" ${(q?.buttonMode|| (daily?"both":"clear"))==="clear"?"selected":""}>CLEARのみ</option><option value="fail" ${q?.buttonMode==="fail"?"selected":""}>FAILのみ</option><option value="both" ${(q?.buttonMode|| (daily?"both":"clear"))==="both"?"selected":""}>CLEAR / FAIL</option></select></label><label>FAIL時 HP減少<input id="quest-hp" type="number" min="0" value="${q?.hpFail||0}"></label><label>FAIL時 EXPペナルティ<input id="quest-penalty" type="number" min="0" value="${Math.abs(Number(q?.penaltyExp)||0)}"></label>`:""}
    </div>
    <div class="editor-actions"><button class="save-quest-btn" data-save-quest="${category}" data-save-id="${q?.id||""}">SAVE</button><button class="back-btn" data-back-quest-editor="${category}">CANCEL</button></div>
  </section>`;
}
function escapeAttr(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function escapeHtml(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\'/g,"&#039;")}

// ===== QUEST EDITOR EVENTS =====
function openQuestEditor(category="daily"){
  document.getElementById("screen").innerHTML=renderQuestEditor(category);
  bindEditorEvents();
}
function openQuestForm(category,id=null){
  document.getElementById("screen").innerHTML=renderQuestForm(category,id);
  bindEditorEvents();
}
function bindEditorEvents(){
  document.querySelectorAll("[data-editor-tab]").forEach(b=>b.addEventListener("click",()=>openQuestEditor(b.dataset.editorTab)));
  document.querySelectorAll("[data-new-quest]").forEach(b=>b.addEventListener("click",()=>openQuestForm(b.dataset.newQuest)));
  document.querySelectorAll("[data-edit-quest]").forEach(b=>b.addEventListener("click",()=>openQuestForm(b.dataset.editCategory,b.dataset.editQuest)));
  document.querySelectorAll("[data-delete-quest]").forEach(b=>b.addEventListener("click",()=>{
    const c=b.dataset.deleteCategory,id=b.dataset.deleteQuest;
    const list=c==="daily"?getDailyQuests():c==="normal"?getNormalQuests():getLongQuests();
    const idx=list.findIndex(q=>q.id===id);
    if(idx<0)return;
    list.splice(idx,1);
    if(c==="daily"){
      Object.keys(state.dailyDone).forEach(k=>{if(k.endsWith("_"+id))delete state.dailyDone[k]});
    }else if(c==="normal"){delete state.normalDone[id]}
    saveState();
    openQuestEditor(c);
    toast("QUEST DELETED");
  }));
  document.querySelector("[data-back-options]")?.addEventListener("click",()=>renderOptions());
  document.querySelectorAll("[data-back-quest-editor]").forEach(b=>b.addEventListener("click",()=>openQuestEditor(b.dataset.backQuestEditor)));
  document.querySelector("[data-save-quest]")?.addEventListener("click",()=>{
    const btn=document.querySelector("[data-save-quest]");
    const c=btn.dataset.saveQuest,id=btn.dataset.saveId;
    const name=document.getElementById("quest-name")?.value.trim();
    if(!name){toast("クエスト名を入力してね");return}
    const q={
      id:id||makeQuestId(),
      name,
      icon:document.getElementById("quest-icon")?.value.trim()||"📜",
      attr:document.getElementById("quest-attr")?.value||"human"
    };
    if(c==="long") Object.assign(q,{
      goal:Math.max(1,Number(document.getElementById("quest-goal").value)||100),
      reward:Math.max(0,Number(document.getElementById("quest-reward").value)||0),
      key:document.getElementById("quest-key").value.trim()||makeQuestId()
    });
    else {
      q.exp=Math.max(0,Number(document.getElementById("quest-exp").value)||0);
      q.buttonMode=document.getElementById("quest-button-mode")?.value||"clear";
      q.hpFail=Math.max(0,Number(document.getElementById("quest-hp")?.value)||0);
      q.penaltyExp=-Math.max(0,Number(document.getElementById("quest-penalty")?.value)||0);
      q.type=c==="daily"?(document.getElementById("quest-type")?.value||"good"):"good";
    }
    const list=c==="daily"?getDailyQuests():c==="normal"?getNormalQuests():getLongQuests();
    const idx=list.findIndex(x=>x.id===q.id);
    if(idx>=0)list[idx]=q;else list.push(q);
    saveState();
    openQuestEditor(c);
    toast(id?"QUEST UPDATED":"QUEST ADDED");
  });
}

function renderOptions(){
  document.getElementById("screen").innerHTML=`<section class="panel"><div class="panel-title">OPTIONS <span class="version-badge">V23</span></div><div class="settings-list">
  <div class="setting"><span>クエスト設定</span><button data-open-quest-editor>編集する</button></div>
  <div class="setting"><span>EXP設定</span><button data-open-exp-settings>編集する</button></div>
  <div class="setting"><span>HP設定</span><button data-open-hp-settings>編集する</button></div>
  <div class="setting"><span>属性設定</span><button data-open-attr-settings>編集する</button></div>
  <div class="setting"><span>ITEM設定</span><button data-open-item-settings>編集する</button></div>
  <div class="setting"><span>データ管理</span><button data-open-data-settings>開く</button></div>
  </div></section><section class="panel"><div class="notice">CURRENT DATA：TOTAL EXP ${state.totalExp.toLocaleString()} ／ HP ${state.hp} ／ Lv.${state.level} ／ STREAK ${state.streak} ／ ITEM ${Object.values(state.items||{}).reduce((a,b)=>a+(Number(b)||0),0)}</div></section>`;
  document.querySelector("[data-open-quest-editor]")?.addEventListener("click",()=>openQuestEditor("daily"));
  document.querySelector("[data-open-exp-settings]")?.addEventListener("click",()=>openSettingsPage("exp"));
  document.querySelector("[data-open-hp-settings]")?.addEventListener("click",()=>openSettingsPage("hp"));
  document.querySelector("[data-open-attr-settings]")?.addEventListener("click",()=>openSettingsPage("attributes"));
  document.querySelector("[data-open-item-settings]")?.addEventListener("click",()=>openSettingsPage("items"));
  document.querySelector("[data-open-data-settings]")?.addEventListener("click",()=>openSettingsPage("data"));
}
function settingsBack(){renderOptions()}
function openSettingsPage(type){
  if(type==="exp") return renderExpSettings();
  if(type==="hp") return renderHpSettings();
  if(type==="attributes") return renderAttributeSettings();
  if(type==="items") return renderItemSettings();
  return renderDataSettings();
}
function renderExpSettings(){
  const e=state.settings.exp,m=e.streakMultipliers;
  document.getElementById("screen").innerHTML=`<section class="panel"><div class="panel-title">EXP SETTINGS</div>
  <div class="notice">レベルアップに必要なEXPと、STREAKによるEXP倍率を設定します。</div>
  <div class="field-grid">
    <label>Lv.2に必要なEXP<input id="exp-base" type="number" min="1" value="${e.levelBase}"></label>
    <label>レベルごとの必要EXP増加<input id="exp-step" type="number" min="0" value="${e.levelStep}"></label>
    <label>50 DAYS 倍率<input id="streak-50" type="number" min="0" step="0.1" value="${m[50]}"></label>
    <label>100 DAYS 倍率<input id="streak-100" type="number" min="0" step="0.1" value="${m[100]}"></label>
    <label>150 DAYS 倍率<input id="streak-150" type="number" min="0" step="0.1" value="${m[150]}"></label>
    <label>200 DAYS 倍率<input id="streak-200" type="number" min="0" step="0.1" value="${m[200]}"></label>
    <label>250 DAYS 倍率<input id="streak-250" type="number" min="0" step="0.1" value="${m[250]}"></label>
  </div><div class="editor-actions"><button class="save-quest-btn" data-save-exp>SAVE</button><button class="back-btn" data-settings-back>← OPTIONS</button></div></section>`;
  document.querySelector("[data-save-exp]").addEventListener("click",()=>{const v=id=>Math.max(0,Number(document.getElementById(id).value)||0);state.settings.exp.levelBase=Math.max(1,v("exp-base"));state.settings.exp.levelStep=v("exp-step");for(const d of [50,100,150,200,250])state.settings.exp.streakMultipliers[d]=v(`streak-${d}`);recalcLevel();saveState();toast("EXP SETTINGS SAVED");settingsBack()});
  document.querySelector("[data-settings-back]").addEventListener("click",settingsBack);
}
function renderHpSettings(){
  const h=state.settings.hp;
  document.getElementById("screen").innerHTML=`<section class="panel"><div class="panel-title">HP SETTINGS</div><div class="notice">HPの最大値と、HPによるEXP倍率を設定します。</div>
  <div class="field-grid"><label>最大HP<input id="hp-max" type="number" min="1" value="${h.max}"></label><label>通常倍率の境界HP<input id="hp-high" type="number" min="0" value="${h.highThreshold}"></label><label>警戒倍率の境界HP<input id="hp-mid" type="number" min="0" value="${h.midThreshold}"></label><label>通常時EXP倍率<input id="hp-m1" type="number" min="0" step="0.1" value="${h.highMultiplier}"></label><label>警戒時EXP倍率<input id="hp-m2" type="number" min="0" step="0.1" value="${h.midMultiplier}"></label><label>危険時EXP倍率<input id="hp-m3" type="number" min="0" step="0.1" value="${h.lowMultiplier}"></label></div>
  <div class="notice">現在：HP ${state.hp} ／ EXP倍率 ×${expMultiplier().hp}</div><div class="editor-actions"><button class="save-quest-btn" data-save-hp>SAVE</button><button class="back-btn" data-settings-back>← OPTIONS</button></div></section>`;
  document.querySelector("[data-save-hp]").addEventListener("click",()=>{const v=id=>Math.max(0,Number(document.getElementById(id).value)||0);state.settings.hp.max=Math.max(1,v("hp-max"));state.settings.hp.highThreshold=v("hp-high");state.settings.hp.midThreshold=v("hp-mid");state.settings.hp.highMultiplier=v("hp-m1");state.settings.hp.midMultiplier=v("hp-m2");state.settings.hp.lowMultiplier=v("hp-m3");state.hp=Math.min(state.hp,state.settings.hp.max);saveState();toast("HP SETTINGS SAVED");settingsBack()});
  document.querySelector("[data-settings-back]").addEventListener("click",settingsBack);
}
function renderAttributeSettings(){
  const keys=["english","academic","human"];
  document.getElementById("screen").innerHTML=`<section class="panel"><div class="panel-title">ATTRIBUTE SETTINGS</div><div class="notice">3属性の名前・アイコン・説明を変更できます。内部キーは固定なのでゲームの計算は壊れません。</div>
  <div class="attr-settings-list">${keys.map(k=>{const a=getAttrConfig(k);return `<div class="attr-setting"><div class="attr-setting-title">${a.icon} ${a.label}</div><div class="field-grid"><label>表示名<input id="attr-${k}-label" value="${escapeAttr(a.label)}"></label><label>アイコン<input id="attr-${k}-icon" value="${escapeAttr(a.icon)}" maxlength="4"></label><label class="wide-field">説明<input id="attr-${k}-desc" value="${escapeAttr(a.description)}"></label></div></div>`}).join("")}</div>
  <div class="editor-actions"><button class="save-quest-btn" data-save-attrs>SAVE</button><button class="back-btn" data-settings-back>← OPTIONS</button></div></section>`;
  document.querySelector("[data-save-attrs]").addEventListener("click",()=>{for(const k of keys){state.settings.attributes[k].label=document.getElementById(`attr-${k}-label`).value.trim()||defaultState.settings.attributes[k].label;state.settings.attributes[k].icon=document.getElementById(`attr-${k}-icon`).value.trim()||defaultState.settings.attributes[k].icon;state.settings.attributes[k].description=document.getElementById(`attr-${k}-desc`).value.trim()||defaultState.settings.attributes[k].description}saveState();toast("ATTRIBUTE SETTINGS SAVED");settingsBack()});
  document.querySelector("[data-settings-back]").addEventListener("click",settingsBack);
}
function renderItemSettings(){
  const list=getItemRewards();
  const rows=list.map(i=>`<div class="item-setting-row"><div><div class="quest-edit-name">${i.icon} ${i.name} ${i.enabled!==false?'':'<span class=\"disabled-badge\">OFF</span>'}</div><div class="quest-meta">${escapeHtml(i.description||"STREAK報酬アイテム")}</div></div><div class="quest-edit-actions"><button class="small-btn" data-toggle-item="${i.id}">${i.enabled!==false?"抽選OFF":"抽選ON"}</button><button class="small-btn" data-edit-item="${i.id}">編集</button><button class="small-btn danger" data-delete-item="${i.id}">削除</button></div></div>`).join("");
  document.getElementById("screen").innerHTML=`<section class="panel"><div class="panel-title">ITEM SETTINGS</div><div class="notice">STREAKが1増えたときのランダム報酬候補を管理します。抽選確率は候補ごとに均等です。</div><button class="add-quest-btn" data-new-item>＋ NEW ITEM</button><div class="quest-editor-list">${rows||`<div class="notice">アイテム候補がありません。</div>`}</div><button class="back-btn" data-settings-back>← OPTIONS</button></section>`;
  document.querySelector("[data-new-item]")?.addEventListener("click",()=>openItemForm());
  document.querySelectorAll("[data-edit-item]").forEach(b=>b.addEventListener("click",()=>openItemForm(b.dataset.editItem)));
  document.querySelectorAll("[data-toggle-item]").forEach(b=>b.addEventListener("click",()=>{const i=list.find(x=>x.id===b.dataset.toggleItem);if(i){i.enabled=i.enabled===false;saveState();renderItemSettings();}}));
  document.querySelectorAll("[data-delete-item]").forEach(b=>b.addEventListener("click",()=>{const i=list.findIndex(x=>x.id===b.dataset.deleteItem);if(i>=0){delete state.items[list[i].id];list.splice(i,1);saveState();renderItemSettings();toast("ITEM DELETED")}}));
  document.querySelector("[data-settings-back]").addEventListener("click",settingsBack);
}
function openItemForm(id=null){
  const q=id?getItemRewards().find(x=>x.id===id):null;
  document.getElementById("screen").innerHTML=`<section class="panel"><div class="panel-title">${q?"EDIT ITEM":"NEW ITEM"}</div><div class="field-grid"><label>アイテム名<input id="item-name" value="${escapeAttr(q?.name||"")}" placeholder="例：ゲーム30分券"></label><label>アイコン<input id="item-icon" value="${escapeAttr(q?.icon||"🎁")}" maxlength="4"></label><label class="wide-field">説明<input id="item-desc" value="${escapeAttr(q?.description||"")}" placeholder="例：ゲームを30分楽しめる券"></label></div><div class="editor-actions"><button class="save-quest-btn" data-save-item>SAVE</button><button class="back-btn" data-back-item>CANCEL</button></div></section>`;
  document.querySelector("[data-save-item]").addEventListener("click",()=>{const name=document.getElementById("item-name").value.trim();if(!name){toast("アイテム名を入力してね");return}const list=getItemRewards();const item={id:q?.id||makeQuestId(),name,icon:document.getElementById("item-icon").value.trim()||"🎁",description:document.getElementById("item-desc").value.trim()||"STREAK報酬アイテム",enabled:q?q.enabled!==false:true};const idx=list.findIndex(x=>x.id===item.id);if(idx>=0)list[idx]=item;else list.push(item);if(state.items[item.id]===undefined)state.items[item.id]=0;saveState();renderItemSettings();toast(q?"ITEM UPDATED":"ITEM ADDED")});
  document.querySelector("[data-back-item]").addEventListener("click",renderItemSettings);
}

function renderDataSettings(){
  document.getElementById("screen").innerHTML=`<section class="panel"><div class="panel-title">DATA MANAGEMENT</div><div class="notice">LIFE QUESTの保存データをバックアップ・復元できます。バックアップはこの端末にJSONとして保存されます。</div>
  <div class="data-actions"><button class="save-quest-btn" data-export-data>EXPORT JSON</button><label class="file-import-btn">IMPORT JSON<input id="import-data" type="file" accept="application/json,.json" hidden></label><button class="back-btn" data-clear-logs>LOGを消去</button><button class="danger-full" data-reset-all>RESET ALL DATA</button></div>
  <div class="notice">現在のデータ：TOTAL EXP ${state.totalExp.toLocaleString()} ／ HP ${state.hp} ／ Lv.${state.level} ／ STREAK ${state.streak} ／ ITEM ${Object.values(state.items||{}).reduce((a,b)=>a+(Number(b)||0),0)} ／ LOG ${state.logs.length}</div><button class="back-btn" data-settings-back>← OPTIONS</button></section>`;
  document.querySelector("[data-export-data]").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`life-quest-backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href);toast("BACKUP EXPORTED")});
  document.getElementById("import-data").addEventListener("change",async e=>{const f=e.target.files?.[0];if(!f)return;try{const imported=JSON.parse(await f.text());if(!imported||typeof imported!=="object"||!imported.attributes)throw new Error("invalid");state={...clone(defaultState),...imported,settings:{...clone(defaultState.settings),...(imported.settings||{})}};normalizeState();saveState();lastResult=null;render();toast("DATA IMPORTED")}catch{toast("IMPORT FAILED")}});
  document.querySelector("[data-clear-logs]").addEventListener("click",()=>{state.logs=[];saveState();renderDataSettings();toast("LOG CLEARED")});
  document.querySelector("[data-reset-all]").addEventListener("click",()=>{state=clone(defaultState);state.questConfig={daily:clone(defaultQuests),normal:clone(defaultNormalQuests),long:clone(defaultLongQuests)};state.settings=clone(defaultState.settings);lastResult=null;saveState();render();toast("ALL DATA RESET")});
  document.querySelector("[data-settings-back]").addEventListener("click",settingsBack);
}

function renderLogs(){
  cleanupLogs();
  document.getElementById("screen").innerHTML=`<section class="panel"><div class="panel-title">LOG — LAST 48 HOURS</div>${state.logs.length?state.logs.slice().reverse().map(l=>`<div class="achievement"><div class="badge">•</div><div><div>${l.name}</div><div class="progress">${new Date(l.at).toLocaleString()} ／ ${l.exp>=0?"+":""}${l.exp} EXP</div></div></div>`).join(""):`<div class="notice">まだログがない。</div>`}</section>`
}

function bindEvents(){
  document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>{currentScreen=b.dataset.go;lastResult=null;render()}));
  document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{currentQuestTab=b.dataset.tab;render()}));
  document.querySelectorAll("[data-clear]").forEach(b=>b.addEventListener("click",()=>{const q=getDailyQuests().find(x=>x.id===b.dataset.clear);if(q)performQuest(q,"clear")}));
  document.querySelectorAll("[data-normal-clear]").forEach(b=>b.addEventListener("click",()=>{const q=getNormalQuests().find(x=>x.id===b.dataset.normalClear);if(q)performNormalQuest(q,"clear")}));
  document.querySelectorAll("[data-normal-fail]").forEach(b=>b.addEventListener("click",()=>{const q=getNormalQuests().find(x=>x.id===b.dataset.normalFail);if(q)performNormalQuest(q,"fail")}));
  document.querySelectorAll("[data-fail]").forEach(b=>b.addEventListener("click",()=>{const q=getDailyQuests().find(x=>x.id===b.dataset.fail);if(q)performQuest(q,"fail")}));
  document.querySelectorAll("[data-use-item]").forEach(b=>b.addEventListener("click",()=>useItem(b.dataset.useItem)));
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
