const STORAGE_KEY = "lifeQuest_v2";

const defaultState = {
  totalExp: 0, hp: 100, level: 1, streak: 0, lastDailyDate: null,
  attributes: {english:0, university:0, knowledge:0, body:0, creative:0},
  dailyDone: {}, logs: [], purchased: [], stats:{toeflPages:0,studyHours:0}
};

const quests = [
  {id:"toefl",name:"TOEFLを1ページ進める",icon:"📖",exp:5,attr:"english",type:"good"},
  {id:"university",name:"大学の課題を進める",icon:"🎓",exp:1,attr:"university",type:"good"},
  {id:"train",name:"電車で勉強する",icon:"🚃",exp:3,attr:"knowledge",type:"good"},
  {id:"sleep",name:"23:59までに寝る",icon:"🛏️",exp:5,attr:"body",type:"good",hpFail:10},
  {id:"nogame",name:"ゲームをしない",icon:"🎮",exp:0,attr:null,type:"avoid",hpFail:15,penaltyExp:-100},
  {id:"late",name:"2時以降に寝ない",icon:"🌙",exp:0,attr:null,type:"avoid",hpFail:5,penaltyExp:-5}
];

const longQuests = [
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

function clone(x){return JSON.parse(JSON.stringify(x))}
function loadState(){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(!saved)return clone(defaultState);
    return {...clone(defaultState),...saved,attributes:{...defaultState.attributes,...saved.attributes},stats:{...defaultState.stats,...saved.stats}};
  }catch{return clone(defaultState)}
}
function normalizeState(){
  // V2で古い状態が残っていても、TOTAL EXPと属性EXPの矛盾を自動修正する。
  const attrTotal = Object.values(state.attributes).reduce((sum, value) => sum + Math.max(0, Number(value)||0), 0);
  state.totalExp = Math.max(0, Number(state.totalExp)||0);
  if(state.totalExp < attrTotal) state.totalExp = attrTotal;

  state.hp = Math.max(0, Math.min(100, Number(state.hp)||0));
  state.level = Math.max(1, Number(state.level)||1);
  state.streak = Math.max(0, Number(state.streak)||0);

  // 「今日の全デイリー達成」を、ページを開いただけでは発生させない。
  // STREAK更新は、ユーザーが最後のクエストを実際に操作した直後だけ行う。
  state.lastDailyDate = state.lastDailyDate || null;
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
  let total=0;for(let i=1;i<level;i++)total+=100+(i-1)*50;return total
}
function expMultiplier(){
  const hp=state.hp>=100?1:state.hp>=50?.5:.25;
  const streak=Math.min(10,1+Math.floor(state.streak/50)*2);
  return {hp,streak,total:hp*streak}
}
function addExp(raw,attr=null){
  const m=expMultiplier();
  const final=Math.round(Number(raw||0)*m.total);

  // まずTOTAL EXPを確実に更新
  const beforeTotal = Number(state.totalExp)||0;
  state.totalExp = Math.max(0, beforeTotal + final);

  // 属性EXPにも同じ最終EXPを加算
  if(attr && state.attributes[attr] !== undefined){
    state.attributes[attr] = Math.max(0, (Number(state.attributes[attr])||0) + final);
  }

  // TOTALが属性合計を下回ることはないようにする
  const attrTotal = Object.values(state.attributes).reduce((sum,v)=>sum+(Number(v)||0),0);
  if(state.totalExp < attrTotal) state.totalExp = attrTotal;

  const oldLevel=state.level;
  while(state.totalExp>=levelThreshold(state.level+1)) state.level++;
  return {final,oldLevel,newLevel:state.level,m,beforeTotal,afterTotal:state.totalExp};
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
    if(q.hpFail)state.hp=Math.max(0,state.hp-q.hpFail);
    if(q.penaltyExp)state.totalExp=Math.max(0,state.totalExp+q.penaltyExp);
    logAction(`${q.name} FAIL`,q.penaltyExp||0);
    state.dailyDone[key]="fail";
    lastResult={type:"fail",q,result:{final:q.penaltyExp||0,oldLevel:state.level,newLevel:state.level,m:expMultiplier()}};
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

  const allCompleted = quests.every(q => state.dailyDone[`${current}_${q.id}`]);
  if(!allCompleted) return false;

  const prev = yesterday();
  const prevCompleted = quests.every(q => state.dailyDone[`${prev}_${q.id}`] === "clear");

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
  document.getElementById("screen").innerHTML=map[currentScreen]();
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
  const next=levelThreshold(state.level+1),prev=levelThreshold(state.level);
  const pct=Math.max(0,Math.min(100,((state.totalExp-prev)/Math.max(1,next-prev))*100));
  const m=expMultiplier();
  return `
  <section class="panel hero-panel">
    <div class="hero-art"><div class="hero-sprite">${heroSprite()}</div></div>
    <div>
      <div class="hero-name">HERO</div><div class="big-level">Lv.${state.level}</div><div class="hero-stage">${heroStage()}</div>
      <div class="stat-row"><div class="stat-label"><span>TOTAL EXP</span><span>${state.totalExp.toLocaleString()} / ${next.toLocaleString()}</span></div><div class="bar"><div class="fill exp-fill" style="width:${pct}%"></div></div></div>
      <div class="stat-row"><div class="stat-label"><span>HP</span><span>${state.hp} / 100</span></div><div class="bar"><div class="fill hp-fill" style="width:${state.hp}%"></div></div></div>
      <div class="stat-row"><div class="stat-label"><span>STREAK</span><span>🔥 ${state.streak} DAYS</span></div><div class="bar"><div class="fill streak-fill" style="width:${Math.min(100,state.streak/2.5)}%"></div></div></div>
    </div>
  </section>
  <section class="panel"><div class="panel-title">TODAY'S STATUS</div>
    <div class="notice">HP ${state.hp>=100?"GOOD":state.hp>=50?"CAUTION":"DANGER"} ／ EXP倍率 <span class="multiplier">×${m.hp}</span> ／ STREAK倍率 <span class="multiplier">×${m.streak}</span> ／ TOTAL <span class="multiplier">×${m.total}</span></div>
    <div class="notice" style="margin-top:6px">ATTRIBUTE TOTAL ${Object.values(state.attributes).reduce((a,b)=>a+(Number(b)||0),0).toLocaleString()} ／ TOTAL EXP ${state.totalExp.toLocaleString()}</div>
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
    html+=`<div class="notice">通常クエストは次のアップデートで追加。今は毎日の固定行動を遊べる形にしている。</div>`;
  }else if(currentQuestTab==="long"){
    for(const q of longQuests){
      const value=state.stats[q.key]||0;
      const pct=Math.min(100,value/q.goal*100);
      html+=`<div class="quest-item"><div class="quest-icon">${q.icon}</div><div><div class="quest-name">${q.name}</div><div class="quest-meta">進捗 ${value} / ${q.goal} ／ REWARD +${q.reward} EXP</div><div class="bar"><div class="fill exp-fill" style="width:${pct}%"></div></div></div><div class="progress">${Math.round(pct)}%</div></div>`
    }
  }else{
    for(const q of quests){
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
  const attrs=[["english","📖","英語力","var(--blue)"],["university","🎓","大学","var(--green)"],["knowledge","💡","知識","var(--gold)"],["body","💪","身体","var(--red)"],["creative","🎨","創造","var(--purple)"]];
  const max=Math.max(1000,...Object.values(state.attributes));
  return `<section class="panel"><div class="panel-title">STATUS</div><div class="hero-name">Lv.${state.level} 勇者 ${heroSprite()}</div><div class="notice">TOTAL EXP ${state.totalExp.toLocaleString()} ／ HP ${state.hp}/100 ／ 🔥 STREAK ${state.streak}</div></section>
  <section class="panel"><div class="panel-title">属性EXP</div><div class="attr-grid">${attrs.map(([k,i,n,c])=>`<div class="attr-card"><div class="attr-head"><span>${i} ${n}</span><span>${state.attributes[k].toLocaleString()} EXP</span></div><div class="attr-level">ATTRIBUTE Lv.${attrLevel(state.attributes[k])}</div><div class="attr-bar"><div class="attr-fill" style="width:${(state.attributes[k]%100)}%;background:${c}"></div></div></div>`).join("")}</div></section>`
}

function renderShop(){
  return `<section class="panel"><div class="panel-title">EXP SHOP</div><div class="notice">頑張った自分に、ごほうびを。購入するとEXPだけが減り、購入記録が残る。</div>
  ${shops.map(i=>`<div class="shop-item"><div>${i.icon} ${i.name}</div><div class="price">${i.price.toLocaleString()} EXP</div><button class="buy-btn" data-buy="${i.id}" ${state.totalExp<i.price?"disabled":""}>購入</button></div>`).join("")}</section>`
}

function renderMore(){
  return `<section class="panel"><div class="panel-title">MORE</div><div class="command-list">
  <button class="command" data-more="achievements">🏆 ACHIEVEMENTS<small>実績を見る</small></button>
  <button class="command" data-more="options">⚙ OPTIONS<small>管理・編集エリア</small></button>
  <button class="command" data-more="logs">📜 LOG<small>直近48時間の行動ログ</small></button>
  </div></section>`
}

function renderAchievements(){
  const a=[["👑","First Step","初めてEXPを獲得",state.totalExp>0,"CLEAR"],["🔥","7 DAYS","STREAK 7日",state.streak>=7,`${Math.min(7,state.streak)} / 7`],["⭐","1,000 EXP","TOTAL EXP 1,000",state.totalExp>=1000,`${Math.min(1000,state.totalExp)} / 1000`],["💎","10,000 EXP","TOTAL EXP 10,000",state.totalExp>=10000,`${Math.min(10000,state.totalExp)} / 10000`],["🏆","STREAK 50","STREAK 50日",state.streak>=50,`${Math.min(50,state.streak)} / 50`]];
  document.getElementById("screen").innerHTML=`<section class="panel"><div class="panel-title">ACHIEVEMENTS</div>${a.map(x=>`<div class="achievement ${x[3]?"":"locked"}"><div class="badge">${x[0]}</div><div><div>${x[1]}</div><div class="progress">${x[2]} ／ ${x[4]}</div></div></div>`).join("")}</section>`
}

function renderOptions(){
  document.getElementById("screen").innerHTML=`<section class="panel"><div class="panel-title">OPTIONS</div><div class="settings-list">
  <div class="setting"><span>クエスト設定</span><button disabled>次期実装</button></div>
  <div class="setting"><span>EXP設定</span><button disabled>次期実装</button></div>
  <div class="setting"><span>HP設定</span><button disabled>次期実装</button></div>
  <div class="setting"><span>属性設定</span><button disabled>次期実装</button></div>
  <div class="setting"><span>ショップ設定</span><button disabled>次期実装</button></div>
  <div class="setting"><span>データ管理</span><button data-reset>RESET DATA</button></div>
  </div></section><section class="panel"><div class="notice">CURRENT DATA：TOTAL EXP ${state.totalExp.toLocaleString()} ／ HP ${state.hp} ／ Lv.${state.level}</div></section>
  <section class="panel"><div class="notice">OPTIONSは通常のゲーム画面と分離する管理エリア。編集機能は仕様確定後に追加する。</div></section>`;
  document.querySelector("[data-reset]")?.addEventListener("click",()=>{
    localStorage.removeItem(STORAGE_KEY);
    state=clone(defaultState);
    lastResult=null;
    currentQuestTab="daily";
    saveState();
    render();
    setTimeout(()=>toast("DATA RESET — Lv.1 / EXP 0 / HP 100"),50);
  })
}

function renderLogs(){
  cleanupLogs();
  document.getElementById("screen").innerHTML=`<section class="panel"><div class="panel-title">LOG — LAST 48 HOURS</div>${state.logs.length?state.logs.slice().reverse().map(l=>`<div class="achievement"><div class="badge">•</div><div><div>${l.name}</div><div class="progress">${new Date(l.at).toLocaleString()} ／ ${l.exp>=0?"+":""}${l.exp} EXP</div></div></div>`).join(""):`<div class="notice">まだログがない。</div>`}</section>`
}

function bindEvents(){
  document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>{currentScreen=b.dataset.go;lastResult=null;render()}));
  document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{currentQuestTab=b.dataset.tab;render()}));
  document.querySelectorAll("[data-clear]").forEach(b=>b.addEventListener("click",()=>{const q=quests.find(x=>x.id===b.dataset.clear);if(q)performQuest(q,"clear")}));
  document.querySelectorAll("[data-fail]").forEach(b=>b.addEventListener("click",()=>{const q=quests.find(x=>x.id===b.dataset.fail);if(q)performQuest(q,"fail")}));
  document.querySelectorAll("[data-buy]").forEach(b=>b.addEventListener("click",()=>{
    const i=shops.find(x=>x.id===b.dataset.buy);if(!i||state.totalExp<i.price)return;
    state.totalExp-=i.price;state.purchased.push({id:i.id,at:Date.now()});saveState();toast(`${i.name} を購入`);render()
  }));
  document.querySelectorAll("[data-more]").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.more==="achievements")renderAchievements();if(b.dataset.more==="options")renderOptions();if(b.dataset.more==="logs")renderLogs()}));
}
document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>{currentScreen=b.dataset.screen;lastResult=null;render()}));
function toast(message){const e=document.getElementById("toast");e.textContent=message;e.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove("show"),1400)}
render();
