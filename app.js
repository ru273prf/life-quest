const STORAGE_KEY = "lifeQuest_v2";
const APP_VERSION = "V45";

const defaultState = {
  totalExp: 0, hp: 100, level: 1, streak: 0, lastDailyDate: null,
  attributes: {english:0, academic:0, human:0},
  dailyDone: {}, normalDone: {}, limitedDone: {}, logs: [], purchased: [], items: {}, stats:{toeflPages:0,studyHours:0}, questConfig:null,
  settings:{
    exp:{levelBase:100,levelStep:50,streakMultipliers:{50:2,100:4,150:6,200:8,250:10}},
    hp:{max:100,highThreshold:100,midThreshold:50,highMultiplier:1,midMultiplier:0.5,lowMultiplier:0.25},
    attributes:{
      english:{label:"英語力",icon:"📖",description:"TOEFL・英語学習"},
      academic:{label:"学力",icon:"🎓",description:"大学の理系科目・課題"},
      human:{label:"人間力",icon:"⚔️",description:"生活習慣・健康・娯楽など"}
    },
    itemRewards:[
      {id:"game30",name:"ゲーム30分券",icon:"🎮",description:"ゲームを30分楽しめる券",enabled:true,probability:25},
      {id:"netflix60",name:"Netflix 1時間券",icon:"📺",description:"Netflixを1時間楽しめる券",enabled:true,probability:25},
      {id:"free",name:"自由時間1時間券",icon:"☕",description:"好きなことを1時間やる券",enabled:true,probability:25},
      {id:"meal",name:"好きなご飯を食べる券",icon:"🍚",description:"好きなご飯を楽しむ券",enabled:true,probability:25}
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
let questAttrFilter = "all";
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
    state.settings.itemRewards=legacy.map(x=>({id:x.id,name:x.name,icon:x.icon||"🎁",description:"STREAK報酬アイテム",enabled:true,probability:1}));
  }
  state.settings.itemRewards=state.settings.itemRewards.map(x=>({...x,enabled:x.enabled!==false,description:x.description||"STREAK報酬アイテム",probability:Number.isFinite(Number(x.probability))&&Number(x.probability)>=0?Number(x.probability):1}));
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
  state.questConfig.long=state.questConfig.long.map(q=>({...q,attr:q.attr||"human",exp:Number.isFinite(Number(q.exp))?Number(q.exp):Math.max(0,Number(q.reward)||0),buttonMode:q.buttonMode||"clear",hpFail:Math.max(0,Number(q.hpFail)||0),penaltyExp:Number(q.penaltyExp)||0}));
}
function getDailyQuests(){ensureQuestConfig();return state.questConfig.daily}
function getNormalQuests(){ensureQuestConfig();return state.questConfig.normal}
function getLongQuests(){ensureQuestConfig();return state.questConfig.long}
function questCategoryLabel(c){return c==="daily"?"DAILY":c==="normal"?"NORMAL":"LIMITED"}
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
      mergedSettings.itemRewards=saved.settings.shops.map(x=>({id:x.id,name:x.name,icon:x.icon||"🎁",description:"STREAK報酬アイテム",enabled:true,probability:1}));
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
  state.limitedDone=state.limitedDone&&typeof state.limitedDone==="object"?state.limitedDone:{};
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
  const step=Math.max(0,Number.isFinite(Number(state.settings.exp.levelStep))?Number(state.settings.exp.levelStep):50);
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
function logAction(name,exp,undo={}){
  state.logs.push({id:makeQuestId(),at:Date.now(),name,exp,undo,undone:false});
  cleanupLogs()
}
function cleanupLogs(){
  const cutoff=Date.now()-48*60*60*1000;
  state.logs=state.logs.filter(x=>x.at>=cutoff)
}
function keyFor(q){return `${today()}_${q.id}`}
function statusFor(q){return state.dailyDone[keyFor(q)]||null}

function performNormalQuest(q,outcome,quantity=1){
  quantity=Math.max(1,Math.floor(Number(quantity)||1));
  let result={final:0,oldLevel:state.level,newLevel:state.level,m:expMultiplier()};
  const beforeHp=state.hp;
  const beforeAttr=Number(state.attributes[q.attr]||0);
  if(outcome==="clear") {
    if(q.exp>0) result=addExp(q.exp*quantity,q.attr);
    const attrDelta=Number(state.attributes[q.attr]||0)-beforeAttr;
    logAction(`${q.name} CLEAR ×${quantity}`,result.final,{type:"normal",outcome:"clear",qid:q.id,attr:q.attr,attrDelta,hpDelta:0,quantity});
    lastResult={type:"clear",q,result,quantity};
    saveState();
    showReward(result.final?`+${result.final} EXP`:`QUEST CLEAR ×${quantity}!`);
    if(result.newLevel>result.oldLevel) setTimeout(()=>showLevelUp(result.newLevel),350);
  }else{
    const oldLevel=state.level;
    if(q.hpFail) state.hp=Math.max(0,Math.min(Number(state.settings.hp.max)||100,state.hp-q.hpFail*quantity));
    if(q.penaltyExp && q.attr){
      state.attributes[q.attr]=Math.max(0,(Number(state.attributes[q.attr])||0)+q.penaltyExp*quantity);
      syncTotalExp();
      recalcLevel();
    }
    const attrDelta=Number(state.attributes[q.attr]||0)-beforeAttr;
    const hpDelta=state.hp-beforeHp;
    logAction(`${q.name} FAIL ×${quantity}`,q.penaltyExp*quantity||0,{type:"normal",outcome:"fail",qid:q.id,attr:q.attr,attrDelta,hpDelta,quantity});
    lastResult={type:"fail",q,quantity,result:{final:q.penaltyExp*quantity||0,oldLevel,newLevel:state.level,m:expMultiplier()}};
    saveState();
    showReward(q.penaltyExp?`${q.penaltyExp*quantity} EXP`:`HP -${q.hpFail*quantity||0}`);
  }
  render();
}
function performLimitedQuest(q,outcome){
  if(state.limitedDone[q.id])return;
  const beforeHp=state.hp;
  const beforeAttr=Number(state.attributes[q.attr]||0);
  if(outcome==="clear"){
    const result=q.exp>0?addExp(q.exp,q.attr):{final:0,oldLevel:state.level,newLevel:state.level};
    state.limitedDone[q.id]="clear";
    const idx=getLongQuests().findIndex(x=>x.id===q.id);
    const attrDelta=Number(state.attributes[q.attr]||0)-beforeAttr;
    logAction(`${q.name} CLEAR`,result.final,{type:"limited",outcome:"clear",qid:q.id,attr:q.attr,attrDelta,hpDelta:state.hp-beforeHp});
    if(idx>=0)getLongQuests().splice(idx,1);
    saveState(); showReward(result.final?`+${result.final} EXP`:`QUEST CLEAR!`);
    if(result.newLevel>result.oldLevel)setTimeout(()=>showLevelUp(result.newLevel),350);
  }else{
    if(q.hpFail)state.hp=Math.max(0,Math.min(Number(state.settings.hp.max)||100,state.hp-q.hpFail));
    if(q.penaltyExp&&q.attr){state.attributes[q.attr]=Math.max(0,(Number(state.attributes[q.attr])||0)+q.penaltyExp);syncTotalExp();recalcLevel();}
    state.limitedDone[q.id]="fail";
    const attrDelta=Number(state.attributes[q.attr]||0)-beforeAttr;
    logAction(`${q.name} FAIL`,q.penaltyExp||0,{type:"limited",outcome:"fail",qid:q.id,attr:q.attr,attrDelta,hpDelta:state.hp-beforeHp});
    saveState(); showReward(q.penaltyExp?`${q.penaltyExp} EXP`:`HP -${q.hpFail||0}`);
  }
  render();
}

function bindLongPressClear(btn){
  let timer=null,triggered=false;
  const cancel=()=>{if(timer){clearTimeout(timer);timer=null;}btn.classList.remove("charging")};
  const start=()=>{if(btn.disabled)return;triggered=false;btn.classList.add("charging");timer=setTimeout(()=>{triggered=true;cancel();const q=getLongQuests().find(x=>x.id===btn.dataset.longClear);if(q)performLimitedQuest(q,"clear")},800)};
  btn.addEventListener("pointerdown",start);
  btn.addEventListener("pointerup",()=>{if(!triggered){cancel();toast("CLEARは長押し")}else cancel()});
  btn.addEventListener("pointerleave",cancel);
  btn.addEventListener("pointercancel",cancel);
  btn.addEventListener("contextmenu",e=>e.preventDefault());
}

function performQuest(q, outcome){
  const key=keyFor(q);
  if(state.dailyDone[key])return;

  const beforeHp=state.hp;
  const beforeAttr=Number(state.attributes[q.attr]||0);
  const beforeStats=Number(state.stats.toeflPages||0);
  const beforeStreak=state.streak;
  const beforeLastDaily=state.lastDailyDate;
  const beforeLastItem=clone(state._lastItemReward||null);
  let result={final:0,oldLevel:state.level,newLevel:state.level,m:expMultiplier()};

  if(outcome==="clear") {
    if(q.exp>0) result=addExp(q.exp,q.attr);
    if(q.id==="toefl")state.stats.toeflPages++;
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
    state.dailyDone[key]="fail";
    lastResult={type:"fail",q,result:{final:q.penaltyExp||0,oldLevel,newLevel:state.level,m:expMultiplier()}};
  }

  const streakChanged=updateStreak();
  const attrDelta=Number(state.attributes[q.attr]||0)-beforeAttr;
  const hpDelta=state.hp-beforeHp;
  const statsDelta=Number(state.stats.toeflPages||0)-beforeStats;
  const itemDelta=streakChanged && state._lastItemReward ? {id:state._lastItemReward.id,delta:1} : null;
  logAction(`${q.name} ${outcome.toUpperCase()}`,outcome==="clear"?result.final:(q.penaltyExp||0),{
    type:"daily",outcome,qid:q.id,key,attr:q.attr,attrDelta,hpDelta,statsDelta,
    streakDelta:state.streak-beforeStreak,lastDailyBefore:beforeLastDaily,lastItemBefore:beforeLastItem,itemDelta
  });
  saveState();

  if(outcome==="clear"){
    showReward(result.final?`+${result.final} EXP`:`QUEST CLEAR!`);
    if(result.newLevel>result.oldLevel)setTimeout(()=>showLevelUp(result.newLevel),350);
  }else{
    showReward(q.penaltyExp?`${q.penaltyExp} EXP`:`HP -${q.hpFail||0}`);
  }
  if(streakChanged)setTimeout(()=>toast(`🔥 STREAK ${state.streak} DAYS!`),700);
  render();
}

function updateStreak(){
  const current=today();
  if(state.lastDailyDate===current)return false;
  const daily=getDailyQuests();
  const allSelected=daily.length>0 && daily.every(q=>!!state.dailyDone[`${current}_${q.id}`]);
  const allCleared=allSelected && daily.every(q=>state.dailyDone[`${current}_${q.id}`]==="clear");
  if(!allCleared)return false;
  const prev=yesterday();
  const prevCompleted=daily.every(q=>state.dailyDone[`${prev}_${q.id}`]==="clear");
  state.streak=prevCompleted?state.streak+1:1;
  state.lastDailyDate=current;
  const reward=grantRandomItem();
  if(reward)state._lastItemReward={id:reward.id,name:reward.name,icon:reward.icon,at:Date.now(),streak:state.streak};
  else state._lastItemReward=null;
  saveState();
  if(reward)setTimeout(()=>toast(`🎁 ITEM GET：${reward.icon} ${reward.name}`),700);
  return true;
}

function grantRandomItem(){
  const choices=getItemRewards().filter(i=>i.enabled!==false);
  if(!choices.length)return null;
  const weights=choices.map(i=>Math.max(0,Number(i.probability)||0));
  const total=weights.reduce((a,b)=>a+b,0);
  let reward;
  if(total<=0){reward=choices[Math.floor(Math.random()*choices.length)];}
  else{let r=Math.random()*total;for(let n=0;n<choices.length;n++){if(r<weights[n]){reward=choices[n];break}r-=weights[n]}if(!reward)reward=choices[choices.length-1];}
  state.items[reward.id]=Math.max(0,Math.floor(Number(state.items[reward.id])||0))+1;
  return reward;
}

function render(){
  cleanupLogs();
  normalizeState();
  document.getElementById("currentDate").textContent=formatDate();
  document.getElementById("headerStreak").textContent=state.streak;
  const hsm=document.getElementById("headerStreakMultiplier"); if(hsm) hsm.textContent=streakMultiplier(state.streak);
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.screen===currentScreen));
  const map={home:renderHome,quest:renderQuest,item:renderItem,more:renderMore};
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
  return `<svg class="pixel-hero-svg fixed-hero hooded-hero" viewBox="0 0 160 160" aria-label="勇者" role="img" shape-rendering="crispEdges">
    <g fill="#f2f2f2">
      <polygon points="48,24 72,12 96,24 108,44 100,72 84,84 56,84 40,68 36,44"/>
      <polygon points="50,72 92,72 112,94 108,126 92,126 84,112 76,136 58,136 52,114 40,128 28,128 32,92"/>
      <polygon points="108,92 114,92 140,38 136,34 130,38"/>
      <rect x="100" y="88" width="28" height="8"/><rect x="112" y="94" width="8" height="22"/>
      <rect x="52" y="128" width="18" height="12"/><rect x="82" y="128" width="18" height="12"/>
    </g>
    <g fill="#0a0a0a">
      <polygon points="56,38 72,28 90,36 94,58 82,72 58,68 50,56"/>
      <rect x="62" y="52" width="8" height="6"/><rect x="82" y="52" width="8" height="6"/>
      <rect x="48" y="28" width="48" height="7"/><rect x="40" y="40" width="8" height="28"/><rect x="96" y="40" width="8" height="28"/>
      <polygon points="42,78 56,78 48,116 34,124 36,94"/><polygon points="84,78 100,82 104,118 92,124 82,108"/>
      <rect x="58" y="90" width="8" height="28"/><rect x="74" y="82" width="8" height="34"/>
      <rect x="104" y="88" width="28" height="7"/><rect x="112" y="94" width="8" height="22"/><rect x="132" y="38" width="8" height="14"/>
    </g>
    <g fill="#888"><rect x="52" y="34" width="40" height="4"/><rect x="48" y="70" width="44" height="5"/><rect x="48" y="82" width="8" height="28"/><rect x="92" y="84" width="7" height="28"/><rect x="116" y="52" width="5" height="35"/></g>
  </svg>`;
}

function heroStage(){
  return "勇者";
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
    <div class="levelup-level">Lv.${level}</div>
    <div class="notice">勇者は一歩強くなった。</div>
    <button class="clear-btn" style="margin-top:16px" data-close-level>CONTINUE</button>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("[data-close-level]").addEventListener("click",()=>overlay.remove());
}

function heroScene(){
  return `<div class="hero-scene" aria-label="勇者の冒険風景">
    <div class="scene-stars">✦　·　✧　　·　✦　　·　　✧</div>
    <div class="scene-moon"></div>
    <div class="scene-mountains back"></div>
    <div class="scene-castle"><i></i><i></i><i></i><b></b><b></b><b></b></div>
    <div class="scene-ground"></div>
    <div class="scene-hero">${heroSprite()}</div>
  </div>`;
}

function renderHome(){
  const progress=levelProgress();
  const attrs=[
    ["english",getAttrConfig("english").icon,getAttrConfig("english").label],
    ["academic",getAttrConfig("academic").icon,getAttrConfig("academic").label],
    ["human",getAttrConfig("human").icon,getAttrConfig("human").label]
  ];
  const sm=streakMultiplier(state.streak);
  return `
  <section class="panel hero-panel v39-compact-hero">
    <div class="hero-info v39-full-info">
      <div class="big-level">Lv.${state.level}</div>
      <div class="stat-row"><div class="stat-label"><span>TOTAL EXP</span><span>${state.totalExp.toLocaleString()} / ${levelThreshold(state.level+1).toLocaleString()}</span></div><div class="bar"><div class="fill exp-fill" style="width:${Math.max(0,Math.min(100,state.totalExp/Math.max(1,levelThreshold(state.level+1))*100))}%"></div></div><div class="level-next">NEXT LEVEL ${progress.remaining.toLocaleString()} EXP</div></div>
      <div class="stat-row"><div class="stat-label"><span>HP</span><span>${state.hp} / ${state.settings.hp.max}</span></div><div class="bar"><div class="fill hp-fill" style="width:${Math.max(0,Math.min(100,state.hp/state.settings.hp.max*100))}%"></div></div></div>
    </div>
  </section>
  <section class="panel v35-status-panel"><div class="panel-title">STATUS <span></span></div>
    <div class="attr-grid">${attrs.map(([k,i,n])=>`
      <div class="attr-card">
        <div class="attr-head"><span>${i} ${n}</span><span>${state.attributes[k].toLocaleString()} EXP</span></div>
        <div class="attr-level">Lv.${attrLevel(state.attributes[k])}</div>
        <div class="attr-bar"><div class="attr-fill" style="width:${Math.max(0,state.attributes[k]%100)}%"></div></div>
      </div>`).join("")}</div>
  </section>
  ${lastResult?`<section class="panel result-box"><div class="exp-pop">${lastResult.type==="clear"?(lastResult.result.final?`+${lastResult.result.final} EXP`:"QUEST CLEAR!"):(lastResult.result.final?`${lastResult.result.final} EXP`:`HP -${lastResult.q.hpFail||0}`)}</div><div class="quest-meta">${escapeHtml(lastResult.q.name)}</div>${lastResult.result.newLevel>lastResult.result.oldLevel?`<div class="multiplier">⚔ LEVEL UP! Lv.${lastResult.result.newLevel}</div>`:""}</section>`:""}`;
}

function renderQuest(){
  let html=`<section class="panel"><div class="panel-title">QUEST</div><div class="quest-tabs">
  <button class="tab ${currentQuestTab==="daily"?"active":""}" data-tab="daily">デイリー</button>
  <button class="tab ${currentQuestTab==="normal"?"active":""}" data-tab="normal">通常</button>
  <button class="tab ${currentQuestTab==="long"?"active":""}" data-tab="long">限定</button></div>`;
  const filters=["all","english","academic","human"];
  html+=`<div class="normal-attr-filters quest-attr-filters"><button class="attr-filter ${questAttrFilter==="all"?"active":""}" data-quest-attr="all">ALL</button>${filters.slice(1).map(a=>`<button class="attr-filter ${questAttrFilter===a?"active":""}" data-quest-attr="${a}">${escapeHtml(attrLabel(a))}</button>`).join("")}</div>`;
  if(currentQuestTab==="normal"){
    const visible=getNormalQuests().filter(q=>questAttrFilter==="all"||q.attr===questAttrFilter);
    if(!visible.length) html+=`<div class="notice empty-filter">この属性の通常クエストはありません。</div>`;
    for(const q of visible){
      const mode=q.buttonMode||"clear";
      const failInfo=(q.hpFail?` ／ FAIL: HP -${q.hpFail}/回`:"")+(q.penaltyExp?` ／ FAIL: EXP ${q.penaltyExp}/回`:"");
      const buttons=mode==="clear"?`<button class="clear-btn" data-normal-clear="${q.id}">CLEAR</button>`:mode==="fail"?`<button class="fail-btn" data-normal-fail="${q.id}">FAIL</button>`:`<button class="clear-btn" data-normal-clear="${q.id}">CLEAR</button><button class="fail-btn" data-normal-fail="${q.id}">FAIL</button>`;
      html+=`<div class="quest-item good-quest">
        <div class="quest-icon">${q.icon}</div>
        <div class="quest-main-content">
          <div class="quest-kind">NORMAL QUEST</div>
          <div class="quest-name">${q.name}</div>
          <div class="quest-meta">CLEAR: +${q.exp||0} EXP/回 ／ 属性: ${attrLabel(q.attr)}${failInfo}</div>
        </div>
        <div class="quest-actions normal-repeat-actions">
          <label class="qty-label">回数<input class="normal-qty" data-normal-qty="${q.id}" type="number" min="1" step="1" value="1"></label>
          ${buttons}
        </div>
      </div>`;
    }
  }else if(currentQuestTab==="long"){
    const visible=getLongQuests().filter(q=>questAttrFilter==="all"||q.attr===questAttrFilter);
    if(!visible.length) html+=`<div class="notice empty-filter">この属性の限定クエストはありません。</div>`;
    for(const q of visible){
      const limitedState=state.limitedDone[q.id]||null;
      const done=limitedState==="clear";
      const failed=limitedState==="fail";
      const mode=q.buttonMode||"clear";
      const failInfo=(q.hpFail?` ／ FAIL: HP -${q.hpFail}`:"")+(q.penaltyExp?` ／ FAIL: EXP ${q.penaltyExp}`:"");
      const clearBtn=mode==="fail"?"":`<button class="clear-btn long-clear-btn ${done?"done":""}" data-long-clear="${q.id}" ${done?"disabled":""}>${done?"CLEARED":"CLEAR"}</button>`;
      const failBtn=mode==="clear"?"":`<button class="fail-btn" data-long-fail="${q.id}" ${failed?"disabled":""}>${failed?"FAILED":"FAIL"}</button>`;
      html+=`<div class="quest-item ${done?"done":failed?"failed":""}">
        <div class="quest-icon">${q.icon}</div>
        <div class="quest-main-content"><div class="quest-kind">LIMITED QUEST</div><div class="quest-name">${q.name}</div><div class="quest-meta">CLEAR: +${q.exp||0} EXP${failInfo}${!done?` ／ CLEARは長押し` : ""}</div></div>
        <div class="quest-actions">${clearBtn}${failBtn}</div>
      </div>`;
    }
  }else{
    const visible=getDailyQuests().filter(q=>questAttrFilter==="all"||q.attr===questAttrFilter);
    if(!visible.length) html+=`<div class="notice empty-filter">この属性のデイリークエストはありません。</div>`;
    for(const q of visible){
      const s=statusFor(q),done=!!s;
      const reward=q.exp>0?`+${q.exp} EXP`:`CLEAR`;
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
  html+=`</section>`;
  return html
}

function renderItem(){
  const rewards=getItemRewards();
  const owned=rewards.filter(i=>(state.items[i.id]||0)>0);
  const last=state._lastItemReward;
  const html=`<section class="panel"><div class="panel-title">ITEM</div>
  ${last?`<div class="item-get-card"><div class="item-get-title">🎁 LAST ITEM GET</div><div class="item-get-main">${last.icon} ${escapeHtml(last.name)}</div><div class="quest-meta">STREAK ${last.streak} で獲得</div></div>`:""}
  <div class="section-title">所持アイテム</div>
  ${owned.length?owned.map(i=>`<div class="item-row"><div class="item-main"><span class="item-icon">${i.icon}</span><div><div class="item-name">${escapeHtml(i.name)}</div><div class="quest-meta">${escapeHtml(i.description||"")}</div></div></div><div class="item-actions"><div class="item-count">×${state.items[i.id]||0}</div><button class="item-use-btn" data-use-item="${i.id}">使う</button></div></div>`).join(""):`<div class="empty-state">NO ITEMS</div>`}
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
  <button class="command" data-more="options">⚙ OPTIONS</button>
  <button class="command" data-more="logs">📜 LOG</button>
  </div></section>`
}

function renderQuestEditor(category="daily"){
  const list=category==="daily"?getDailyQuests():category==="normal"?getNormalQuests():getLongQuests();
  const rows=list.map(q=>{
    const modeLabel=(q.buttonMode||"clear")==="clear"?"CLEARのみ":(q.buttonMode||"clear")==="fail"?"FAILのみ":"CLEAR / FAIL";
    const failLabel=(q.hpFail?`HP -${q.hpFail}`:"")+(q.penaltyExp?`${q.hpFail?" ／ ":""}EXP ${q.penaltyExp}`:"");
    const extra=category==="daily" ? `CLEAR / FAIL ／ ${modeLabel} ／ ${attrLabel(q.attr)} ／ +${q.exp||0} EXP${failLabel?` ／ FAIL: ${failLabel}`:""}` : category==="normal" ? `${modeLabel} ／ ${attrLabel(q.attr)} ／ +${q.exp||0} EXP${failLabel?` ／ FAIL: ${failLabel}`:""}` : `${modeLabel} ／ ${attrLabel(q.attr)} ／ +${q.exp||q.reward||0} EXP${failLabel?` ／ FAIL: ${failLabel}`:""}`;
    return `<div class="quest-edit-row"><div><div class="quest-edit-name">${q.icon||"📜"} ${q.name}</div><div class="quest-meta">${extra}</div></div><div class="quest-edit-actions"><button class="small-btn" data-edit-quest="${q.id}" data-edit-category="${category}">編集</button><button class="small-btn danger" data-delete-quest="${q.id}" data-delete-category="${category}">削除</button></div></div>`
  }).join("");
  return `<section class="panel"><div class="panel-title">QUEST MANAGEMENT</div>
    <div class="notice">ここだけでクエストを追加・編集・削除できます。ゲーム画面には編集項目を置きません。</div>
    <div class="quest-tabs editor-tabs">
      <button class="tab ${category==="daily"?"active":""}" data-editor-tab="daily">デイリー</button>
      <button class="tab ${category==="normal"?"active":""}" data-editor-tab="normal">通常</button>
      <button class="tab ${category==="long"?"active":""}" data-editor-tab="long">限定</button>
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
      ${`<label>属性<select id="quest-attr"><option value="english" ${q?.attr==="english"?"selected":""}>英語力</option><option value="academic" ${q?.attr==="academic"?"selected":""}>学力</option><option value="human" ${q?.attr==="human"?"selected":""}>人間力</option></select></label>`}
      <label>獲得EXP<input id="quest-exp" type="number" min="0" value="${q?.exp??q?.reward??0}"></label>
      ${daily?`<label>デイリー種別<select id="quest-type"><option value="good" ${type==="good"?"selected":""}>CLEAR / FAIL</option><option value="avoid" ${type==="avoid"?"selected":""}>CLEAR / FAIL</option></select></label>`:""}
      <label>ボタン表示<select id="quest-button-mode"><option value="clear" ${(q?.buttonMode|| (daily?"both":"clear"))==="clear"?"selected":""}>CLEARのみ</option><option value="fail" ${q?.buttonMode==="fail"?"selected":""}>FAILのみ</option><option value="both" ${(q?.buttonMode|| (daily?"both":"clear"))==="both"?"selected":""}>CLEAR / FAIL</option></select></label>
      <label>FAIL時 HP減少<input id="quest-hp" type="number" min="0" value="${q?.hpFail||0}"></label>
      <label>FAIL時 EXPペナルティ<input id="quest-penalty" type="number" min="0" value="${Math.abs(Number(q?.penaltyExp)||0)}"></label>
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
    q.exp=Math.max(0,Number(document.getElementById("quest-exp")?.value)||0);
    q.buttonMode=document.getElementById("quest-button-mode")?.value||"clear";
    q.hpFail=Math.max(0,Number(document.getElementById("quest-hp")?.value)||0);
    q.penaltyExp=-Math.max(0,Number(document.getElementById("quest-penalty")?.value)||0);
    q.type=c==="daily"?(document.getElementById("quest-type")?.value||"good"):"good";
    const list=c==="daily"?getDailyQuests():c==="normal"?getNormalQuests():getLongQuests();
    const idx=list.findIndex(x=>x.id===q.id);
    if(idx>=0)list[idx]=q;else list.push(q);
    saveState();
    openQuestEditor(c);
    toast(id?"QUEST UPDATED":"QUEST ADDED");
  });
}

function renderOptions(){
  document.getElementById("screen").innerHTML=`<section class="panel"><div class="panel-title">OPTIONS <span class="version-badge">V32</span></div><div class="settings-list">
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
  document.querySelector("[data-save-exp]").addEventListener("click",()=>{const v=id=>Math.max(0,Number(document.getElementById(id).value)||0);state.settings.exp.levelBase=Math.max(1,v("exp-base"));state.settings.exp.levelStep=Math.max(0,Number(document.getElementById("exp-step").value)||0);for(const d of [50,100,150,200,250])state.settings.exp.streakMultipliers[d]=v(`streak-${d}`);recalcLevel();saveState();toast("EXP SETTINGS SAVED");settingsBack()});
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
  const rows=list.map(i=>`<div class="item-setting-row"><div><div class="quest-edit-name">${i.icon} ${i.name} ${i.enabled!==false?'':'<span class="disabled-badge">OFF</span>'}</div><div class="quest-meta">${escapeHtml(i.description||"STREAK報酬アイテム")} ／ 抽選率 ${Number(i.probability||0)}%</div></div><div class="quest-edit-actions"><button class="small-btn" data-toggle-item="${i.id}">${i.enabled!==false?"抽選OFF":"抽選ON"}</button><button class="small-btn" data-edit-item="${i.id}">編集</button><button class="small-btn danger" data-delete-item="${i.id}">削除</button></div></div>`).join("");
  const enabledTotal=list.filter(i=>i.enabled!==false).reduce((sum,i)=>sum+Math.max(0,Number(i.probability)||0),0);
  document.getElementById("screen").innerHTML=`<section class="panel"><div class="panel-title">ITEM SETTINGS</div><div class="notice">STREAKが1増えたときのITEM抽選を設定できます。抽選率は有効なITEM同士で重みとして使います。現在の合計：${enabledTotal}%${enabledTotal!==100?'（100%でなくても自動で正規化されます）':''}</div><button class="add-quest-btn" data-new-item>＋ NEW ITEM</button><div class="quest-editor-list">${rows||`<div class="notice">アイテム候補がありません。</div>`}</div><button class="back-btn" data-settings-back>← OPTIONS</button></section>`;
  document.querySelector("[data-new-item]")?.addEventListener("click",()=>openItemForm());
  document.querySelectorAll("[data-edit-item]").forEach(b=>b.addEventListener("click",()=>openItemForm(b.dataset.editItem)));
  document.querySelectorAll("[data-toggle-item]").forEach(b=>b.addEventListener("click",()=>{const i=list.find(x=>x.id===b.dataset.toggleItem);if(i){i.enabled=i.enabled===false;saveState();renderItemSettings();}}));
  document.querySelectorAll("[data-delete-item]").forEach(b=>b.addEventListener("click",()=>{const i=list.findIndex(x=>x.id===b.dataset.deleteItem);if(i>=0){delete state.items[list[i].id];list.splice(i,1);saveState();renderItemSettings();toast("ITEM DELETED")}}));
  document.querySelector("[data-settings-back]").addEventListener("click",settingsBack);
}
function openItemForm(id=null){
  const q=id?getItemRewards().find(x=>x.id===id):null;
  document.getElementById("screen").innerHTML=`<section class="panel"><div class="panel-title">${q?"EDIT ITEM":"NEW ITEM"}</div><div class="field-grid"><label>アイテム名<input id="item-name" value="${escapeAttr(q?.name||"")}" placeholder="例：ゲーム30分券"></label><label>アイコン<input id="item-icon" value="${escapeAttr(q?.icon||"🎁")}" maxlength="4"></label><label class="wide-field">説明<input id="item-desc" value="${escapeAttr(q?.description||"")}" placeholder="例：ゲームを30分楽しめる券"></label><label>抽選率（%）<input id="item-probability" type="number" min="0" max="100" step="0.1" value="${escapeAttr(q?.probability??25)}"></label></div><div class="notice">有効なITEMの抽選率を重みとして使います。合計が100%でなくても、自動で比率に変換して抽選します。</div><div class="editor-actions"><button class="save-quest-btn" data-save-item>SAVE</button><button class="back-btn" data-back-item>CANCEL</button></div></section>`;
  document.querySelector("[data-save-item]").addEventListener("click",()=>{const name=document.getElementById("item-name").value.trim();if(!name){toast("アイテム名を入力してね");return}const probability=Math.max(0,Math.min(100,Number(document.getElementById("item-probability").value)||0));const list=getItemRewards();const item={id:q?.id||makeQuestId(),name,icon:document.getElementById("item-icon").value.trim()||"🎁",description:document.getElementById("item-desc").value.trim()||"STREAK報酬アイテム",enabled:q?q.enabled!==false:true,probability};const idx=list.findIndex(x=>x.id===item.id);if(idx>=0)list[idx]=item;else list.push(item);if(state.items[item.id]===undefined)state.items[item.id]=0;saveState();renderItemSettings();toast(q?"ITEM UPDATED":"ITEM ADDED")});
  document.querySelector("[data-back-item]").addEventListener("click",renderItemSettings);
}

function renderDataSettings(){
  document.getElementById("screen").innerHTML=`<section class="panel"><div class="panel-title">DATA MANAGEMENT</div><div class="notice">LIFE QUESTの保存データをバックアップ・復元できます。バックアップはこの端末にJSONとして保存されます。</div>
  <div class="data-actions"><button class="save-quest-btn" data-export-data>EXPORT JSON</button><label class="file-import-btn">IMPORT JSON<input id="import-data" type="file" accept="application/json,.json" hidden></label><button class="back-btn" data-clear-logs>LOGを消去</button><button class="danger-full reset-long" data-reset-all>RESET ALL DATA <span class="reset-hint">LONG PRESS</span></button></div>
  <div class="notice">現在のデータ：TOTAL EXP ${state.totalExp.toLocaleString()} ／ HP ${state.hp} ／ Lv.${state.level} ／ STREAK ${state.streak} ／ ITEM ${Object.values(state.items||{}).reduce((a,b)=>a+(Number(b)||0),0)} ／ LOG ${state.logs.length}</div><button class="back-btn" data-settings-back>← OPTIONS</button></section>`;
  document.querySelector("[data-export-data]").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`life-quest-backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href);toast("BACKUP EXPORTED")});
  document.getElementById("import-data").addEventListener("change",async e=>{const f=e.target.files?.[0];if(!f)return;try{const imported=JSON.parse(await f.text());if(!imported||typeof imported!=="object"||!imported.attributes)throw new Error("invalid");state={...clone(defaultState),...imported,settings:{...clone(defaultState.settings),...(imported.settings||{})}};normalizeState();saveState();lastResult=null;render();toast("DATA IMPORTED")}catch{toast("IMPORT FAILED")}});
  document.querySelector("[data-clear-logs]").addEventListener("click",()=>{state.logs=[];saveState();renderDataSettings();toast("LOG CLEARED")});
  const resetBtn=document.querySelector("[data-reset-all]");
  let resetPressTimer=null,resetTriggered=false;
  const resetDuration=1200;
  const resetStart=()=>{
    if(resetPressTimer) return;
    resetTriggered=false;
    resetBtn.classList.add("is-pressing");
    resetBtn.style.setProperty("--press-progress","0%");
    const start=performance.now();
    const tick=()=>{
      if(!resetPressTimer) return;
      const progress=Math.min(100,((performance.now()-start)/resetDuration)*100);
      resetBtn.style.setProperty("--press-progress",progress+"%");
      if(progress>=100){
        resetPressTimer=null;
        resetTriggered=true;
        resetBtn.classList.remove("is-pressing");
        resetBtn.style.setProperty("--press-progress","0%");
        if(confirm("本当にすべてのデータをリセットしますか？")){
          state=clone(defaultState);
          state.questConfig={daily:clone(defaultQuests),normal:clone(defaultNormalQuests),long:clone(defaultLongQuests)};
          state.settings=clone(defaultState.settings);
          lastResult=null;
          saveState();
          render();
          toast("ALL DATA RESET");
        }
        return;
      }
      resetPressTimer=requestAnimationFrame(tick);
    };
    resetPressTimer=requestAnimationFrame(tick);
  };
  const resetCancel=()=>{
    if(resetPressTimer){cancelAnimationFrame(resetPressTimer);resetPressTimer=null;}
    resetBtn.classList.remove("is-pressing");
    resetBtn.style.setProperty("--press-progress","0%");
  };
  resetBtn.addEventListener("pointerdown",resetStart);
  resetBtn.addEventListener("pointerup",resetCancel);
  resetBtn.addEventListener("pointerleave",resetCancel);
  resetBtn.addEventListener("pointercancel",resetCancel);
  resetBtn.addEventListener("contextmenu",e=>e.preventDefault());
  document.querySelector("[data-settings-back]").addEventListener("click",settingsBack);
}

function renderLogs(){
  cleanupLogs();
  const rows=state.logs.slice().reverse().map(l=>`<div class="achievement log-row ${l.undone?"log-undone":""}">
    <div class="badge">•</div><div class="log-main"><div>${escapeHtml(l.name)} ${l.undone?'<span class="disabled-badge">取り消し済み</span>':''}</div><div class="progress">${new Date(l.at).toLocaleString()} ／ ${l.exp>=0?"+":""}${l.exp} EXP</div></div>
    ${l.undone?"":`<button class="small-btn danger log-undo-btn" data-undo-log="${l.id}">取り消す</button>`}
  </div>`).join("");
  document.getElementById("screen").innerHTML=`<section class="panel"><div class="panel-title">LOG — LAST 48 HOURS</div><div class="notice">行動を間違えて記録した場合は「取り消す」で、その行動によるEXP・HP・STREAK・ITEMなどの変化を元に戻せます。</div>${rows||`<div class="notice">まだログがない。</div>`}</section>`;
  document.querySelectorAll("[data-undo-log]").forEach(b=>b.addEventListener("click",()=>undoLog(b.dataset.undoLog)));
}

function undoLog(logId){
  const log=state.logs.find(x=>x.id===logId);
  if(!log||log.undone||!log.undo){toast("この行動は取り消せません");return}
  if(!confirm(`「${log.name}」を取り消しますか？\nEXP・HP・STREAK・ITEMなどの変化を戻します。`))return;
  const u=log.undo;
  if(u.attr && u.attrDelta){state.attributes[u.attr]=Math.max(0,(Number(state.attributes[u.attr])||0)-Number(u.attrDelta));}
  if(u.hpDelta){state.hp=Math.max(0,Math.min(Number(state.settings.hp.max)||100,state.hp-Number(u.hpDelta)));}
  if(u.statsDelta){state.stats.toeflPages=Math.max(0,(Number(state.stats.toeflPages)||0)-Number(u.statsDelta));}
  if(u.type==="limited") {
    if(u.outcome==="clear"){
      state.questConfig.long.push({id:u.qid,name:log.name.replace(/ CLEAR$/,"").replace(/ FAIL$/, ""),icon:"📜",attr:u.attr||"human",exp:log.exp||0,buttonMode:"clear",hpFail:0,penaltyExp:0});
    }
    delete state.limitedDone[u.qid];
  }
  if(u.type==="daily") {
    delete state.dailyDone[u.key];
    // この行動より後にSTREAK報酬を確定させたログがある場合も、
    // 「今日のデイリーが全部CLEARではない」状態に戻す。
    const awardLog=state.logs.find(x=>!x.undone && x.id!==log.id && x.undo?.type==="daily" && x.undo?.streakDelta && x.undo?.key?.startsWith(today()+"_"));
    if(u.streakDelta){
      state.streak=Math.max(0,state.streak-Number(u.streakDelta));
      state.lastDailyDate=u.lastDailyBefore||null;
      if(u.itemDelta)state.items[u.itemDelta.id]=Math.max(0,(Number(state.items[u.itemDelta.id])||0)-Number(u.itemDelta.delta));
      state._lastItemReward=u.lastItemBefore||null;
    }else if(awardLog){
      const au=awardLog.undo;
      state.streak=Math.max(0,state.streak-Number(au.streakDelta||0));
      state.lastDailyDate=au.lastDailyBefore||null;
      if(au.itemDelta)state.items[au.itemDelta.id]=Math.max(0,(Number(state.items[au.itemDelta.id])||0)-Number(au.itemDelta.delta));
      state._lastItemReward=au.lastItemBefore||null;
      awardLog.undone=true;
    }
  }
  syncTotalExp();
  recalcLevel();
  log.undone=true;
  saveState();
  toast("↩ 行動を取り消しました");
  render();
  renderLogs();
}

function bindEvents(){
  document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>{currentScreen=b.dataset.go;lastResult=null;render()}));
  document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{currentQuestTab=b.dataset.tab;render()}));
  document.querySelectorAll("[data-quest-attr]").forEach(b=>b.addEventListener("click",()=>{questAttrFilter=b.dataset.questAttr;render()}));
  document.querySelectorAll("[data-clear]").forEach(b=>b.addEventListener("click",()=>{const q=getDailyQuests().find(x=>x.id===b.dataset.clear);if(q)performQuest(q,"clear")}));
  document.querySelectorAll("[data-normal-clear]").forEach(b=>b.addEventListener("click",()=>{const q=getNormalQuests().find(x=>x.id===b.dataset.normalClear);const input=document.querySelector(`[data-normal-qty="${b.dataset.normalClear}"]`);if(q)performNormalQuest(q,"clear",input?.value||1)}));
  document.querySelectorAll("[data-normal-fail]").forEach(b=>b.addEventListener("click",()=>{const q=getNormalQuests().find(x=>x.id===b.dataset.normalFail);const input=document.querySelector(`[data-normal-qty="${b.dataset.normalFail}"]`);if(q)performNormalQuest(q,"fail",input?.value||1)}));
  document.querySelectorAll("[data-long-fail]").forEach(b=>b.addEventListener("click",()=>{const q=getLongQuests().find(x=>x.id===b.dataset.longFail);if(q)performLimitedQuest(q,"fail")}));
  document.querySelectorAll("[data-long-clear]").forEach(bindLongPressClear);
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
    questAttrFilter = "all";
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
