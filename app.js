const STORAGE_KEY = "lifeQuest_v1";

const defaultState = {
  totalExp: 0,
  hp: 100,
  level: 1,
  streak: 0,
  lastDailyDate: null,
  attributes: {
    english: 0,
    university: 0,
    knowledge: 0,
    body: 0,
    creative: 0
  },
  dailyDone: {},
  achievements: {},
  logs: [],
  purchased: []
};

const quests = [
  {id:"toefl", name:"TOEFLを1ページ進める", icon:"📖", exp:5, attr:"english", type:"daily"},
  {id:"university", name:"大学の課題を進める", icon:"🎓", exp:1, attr:"university", type:"daily"},
  {id:"train", name:"電車で勉強する", icon:"🚃", exp:3, attr:"knowledge", type:"daily"},
  {id:"sleep", name:"23:59までに寝る", icon:"🛏️", exp:5, attr:"body", type:"daily", hpFail:10},
  {id:"nogame", name:"ゲームをしない", icon:"🎮", exp:0, attr:null, type:"daily", hpFail:15, penaltyExp:-100},
  {id:"late", name:"2時以降に寝ない", icon:"🌙", exp:0, attr:null, type:"daily", hpFail:5, penaltyExp:-5}
];

const longQuests = [
  {id:"toefl100", name:"TOEFLを100ページ進める", icon:"📚", goal:100, reward:200, key:"toeflPages"},
  {id:"study100", name:"勉強時間100時間", icon:"⏱️", goal:100, reward:500, key:"studyHours"}
];

const shops = [
  {id:"game30", name:"ゲーム30分券", icon:"🎮", price:500},
  {id:"netflix60", name:"Netflix 1時間券", icon:"📺", price:300},
  {id:"free", name:"自由時間1時間券", icon:"☕", price:1000}
];

let state = loadState();
let currentScreen = "home";
let currentQuestTab = "daily";

function loadState(){
  try{
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? {...structuredClone(defaultState), ...saved, attributes:{...defaultState.attributes,...saved.attributes}} : structuredClone(defaultState);
  }catch(e){ return structuredClone(defaultState); }
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function today(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}

function formatDate(){
  const d = new Date();
  const days = ["日","月","火","水","木","金","土"];
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} (${days[d.getDay()]})`;
}

function expToNextLevel(){
  return 100 + (state.level-1)*50;
}

function addExp(raw, attr=null){
  const hpMultiplier = state.hp >= 100 ? 1 : state.hp >= 50 ? .5 : .25;
  const streakMultiplier = Math.min(10, 1 + Math.floor(state.streak/50)*2);
  const final = Math.round(raw * hpMultiplier * streakMultiplier);
  state.totalExp = Math.max(0, state.totalExp + final);
  if(attr && state.attributes[attr] !== undefined) state.attributes[attr] = Math.max(0, state.attributes[attr] + final);
  while(state.totalExp >= levelThreshold(state.level+1)) state.level++;
  return {final, hpMultiplier, streakMultiplier};
}

function levelThreshold(level){
  if(level <= 1) return 0;
  let total = 0;
  for(let i=1;i<level;i++) total += 100 + (i-1)*50;
  return total;
}

function applyAction(q){
  const key = `${today()}_${q.id}`;
  if(state.dailyDone[key]) return;
  const result = addExp(q.exp, q.attr);
  if(q.penaltyExp) state.totalExp = Math.max(0, state.totalExp + q.penaltyExp);
  state.dailyDone[key] = true;
  state.logs.push({at:Date.now(), name:q.name, raw:q.exp + (q.penaltyExp||0), final:result.final});
  cleanupLogs();
  saveState();
  toast(result.final > 0 ? `+${result.final} EXP` : "クエストCLEAR");
  render();
}

function cleanupLogs(){
  const cutoff = Date.now() - 48*60*60*1000;
  state.logs = state.logs.filter(x => x.at >= cutoff);
}

function completeDailyStreakIfNeeded(){
  // 初回起動日は0。全デイリー達成時に当日のSTREAKを更新する。
  const allDone = quests.every(q => state.dailyDone[`${today()}_${q.id}`]);
  if(!allDone || state.lastDailyDate === today()) return;

  const prev = new Date();
  prev.setDate(prev.getDate()-1);
  const prevKey = prev.toISOString().slice(0,10);
  const hadYesterday = quests.every(q => state.dailyDone[`${prevKey}_${q.id}`]);
  state.streak = hadYesterday ? state.streak + 1 : 1;
  state.lastDailyDate = today();
  saveState();
}

function hpStatus(){
  if(state.hp >= 100) return "GOOD";
  if(state.hp >= 50) return "CAUTION";
  return "DANGER";
}

function render(){
  cleanupLogs();
  completeDailyStreakIfNeeded();
  document.getElementById("currentDate").textContent = formatDate();
  document.getElementById("headerStreak").textContent = state.streak;
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active", b.dataset.screen===currentScreen));
  const root = document.getElementById("screen");
  const screens = {home:renderHome, quest:renderQuest, status:renderStatus, shop:renderShop, more:renderMore};
  root.innerHTML = screens[currentScreen]();
  bindScreenEvents();
  saveState();
}

function renderHome(){
  const next = expToNextLevel();
  const currentBase = levelThreshold(state.level);
  const prevBase = state.level === 1 ? 0 : levelThreshold(state.level);
  const progress = Math.max(0, Math.min(100, ((state.totalExp-prevBase)/(next-prevBase))*100));
  return `
    <section class="panel hero-panel">
      <div class="hero-art"><div class="hero-sprite">🧙‍♂️</div></div>
      <div>
        <div class="hero-name">HERO</div>
        <div class="big-level">Lv.${state.level}</div>
        <div class="stat-row">
          <div class="stat-label"><span>TOTAL EXP</span><span>${state.totalExp.toLocaleString()} / ${next.toLocaleString()}</span></div>
          <div class="bar"><div class="fill exp-fill" style="width:${progress}%"></div></div>
        </div>
        <div class="stat-row">
          <div class="stat-label"><span>HP</span><span>${state.hp} / 100</span></div>
          <div class="bar"><div class="fill hp-fill" style="width:${state.hp}%"></div></div>
        </div>
        <div class="stat-row">
          <div class="stat-label"><span>STREAK</span><span>🔥 ${state.streak} DAYS</span></div>
          <div class="bar"><div class="fill streak-fill" style="width:${Math.min(100,(state.streak%250)/2.5)}%"></div></div>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-title">TODAY'S STATUS</div>
      <div class="notice">HP STATUS: ${hpStatus()} ／ EXP倍率: ×${state.hp>=100?1:state.hp>=50?.5:.25} ／ STREAK倍率: ×${Math.min(10,1+Math.floor(state.streak/50)*2)}</div>
    </section>

    <section class="panel">
      <div class="panel-title">COMMAND</div>
      <div class="command-list">
        <button class="command" data-go="quest">▶ QUEST<small>今日の行動を記録する</small></button>
        <button class="command" data-go="status">▶ STATUS<small>属性EXPと成長を見る</small></button>
        <button class="command" data-go="shop">▶ SHOP<small>EXPでご褒美を買う</small></button>
        <button class="command" data-go="more">▶ MORE<small>実績・設定・ログ</small></button>
      </div>
    </section>
  `;
}

function renderQuest(){
  const list = currentQuestTab==="daily" ? quests : currentQuestTab==="long" ? longQuests : [];
  let html = `
    <section class="panel">
      <div class="panel-title">QUEST</div>
      <div class="quest-tabs">
        <button class="tab ${currentQuestTab==="daily"?"active":""}" data-tab="daily">デイリー</button>
        <button class="tab ${currentQuestTab==="normal"?"active":""}" data-tab="normal">通常</button>
        <button class="tab ${currentQuestTab==="long"?"active":""}" data-tab="long">長期</button>
      </div>
  `;

  if(currentQuestTab==="normal"){
    html += `<div class="notice">通常クエストは次の実装で追加予定。今はデイリーと長期を先に作り込もう。</div>`;
  }else{
    for(const q of list){
      if(currentQuestTab==="daily"){
        const done = !!state.dailyDone[`${today()}_${q.id}`];
        const reward = q.penaltyExp ? `${q.penaltyExp} EXP` : `+${q.exp} EXP`;
        html += `
          <div class="quest-item ${done?"done":""}">
            <div class="quest-icon">${q.icon}</div>
            <div><div class="quest-name">${q.name}</div><div class="quest-meta">${reward}${q.hpFail?` ／ 失敗HP -${q.hpFail}`:""}</div></div>
            <button class="clear-btn" data-clear="${q.id}" ${done?"disabled":""}>${done?"CLEAR":"CLEAR!"}</button>
          </div>`;
      }else{
        html += `
          <div class="quest-item">
            <div class="quest-icon">${q.icon}</div>
            <div><div class="quest-name">${q.name}</div><div class="quest-meta">REWARD +${q.reward} EXP</div></div>
            <div class="progress">${Math.min(100, q.goal)}%</div>
          </div>`;
      }
    }
  }
  html += `</section>
    <section class="panel"><div class="notice">固定デイリーを全部達成するとSTREAKが更新される。HPとEXPは別々に管理する。</div></section>`;
  return html;
}

function renderStatus(){
  const attrs = [
    ["english","📖","英語力","var(--blue)"],
    ["university","🎓","大学","var(--green)"],
    ["knowledge","💡","知識","var(--gold)"],
    ["body","💪","身体","var(--red)"],
    ["creative","🎨","創造","var(--purple)"]
  ];
  const max = Math.max(1000,...Object.values(state.attributes));
  return `
    <section class="panel">
      <div class="panel-title">STATUS</div>
      <div class="hero-name">Lv.${state.level} 勇者</div>
      <div class="notice">TOTAL EXP ${state.totalExp.toLocaleString()} ／ HP ${state.hp}/100 ／ 🔥 STREAK ${state.streak}</div>
    </section>
    <section class="panel">
      <div class="panel-title">属性EXP</div>
      <div class="attr-grid">
        ${attrs.map(([key,icon,name,color])=>`
          <div class="attr-card">
            <div class="attr-head"><span>${icon} ${name}</span><span>${state.attributes[key].toLocaleString()}</span></div>
            <div class="attr-bar"><div class="attr-fill" style="width:${Math.min(100,state.attributes[key]/max*100)}%;background:${color}"></div></div>
          </div>`).join("")}
      </div>
    </section>
  `;
}

function renderShop(){
  return `
    <section class="panel">
      <div class="panel-title">EXP SHOP</div>
      <div class="notice">頑張った自分に、ごほうびを。購入記録だけ残して、実際の使用は現実世界で管理する。</div>
      ${shops.map(item=>`
        <div class="shop-item">
          <div>${item.icon} ${item.name}</div>
          <div class="price">${item.price.toLocaleString()} EXP</div>
          <button class="buy-btn" data-buy="${item.id}" ${state.totalExp<item.price?"disabled":""}>購入</button>
        </div>`).join("")}
    </section>
  `;
}

function renderMore(){
  return `
    <section class="panel">
      <div class="panel-title">MORE</div>
      <div class="command-list">
        <button class="command" data-more="achievements">🏆 ACHIEVEMENTS<small>実績を見る</small></button>
        <button class="command" data-more="options">⚙ OPTIONS<small>クエストや設定を管理する</small></button>
        <button class="command" data-more="logs">📜 LOG<small>直近48時間の行動ログ</small></button>
      </div>
    </section>
    <section class="panel">
      <div class="panel-title">SYSTEM</div>
      <div class="notice">現在はブラウザ内保存版。次の段階でSupabaseへ移行できる構造にする。</div>
    </section>
  `;
}

function renderAchievements(){
  const items = [
    ["first","👑","First Step","初めてEXPを獲得",state.totalExp>0, "—"],
    ["seven","🔥","7 DAYS","STREAK 7日",state.streak>=7, `${Math.min(state.streak,7)} / 7`],
    ["exp1000","⭐","1,000 EXP","TOTAL EXP 1,000",state.totalExp>=1000, `${Math.min(state.totalExp,1000)} / 1000`],
    ["exp10000","💎","10,000 EXP","TOTAL EXP 10,000",state.totalExp>=10000, `${Math.min(state.totalExp,10000)} / 10000`],
    ["streak50","🏆","STREAK 50","STREAK 50日",state.streak>=50, `${Math.min(state.streak,50)} / 50`]
  ];
  document.getElementById("screen").innerHTML = `
    <section class="panel"><div class="panel-title">ACHIEVEMENTS</div>
      ${items.map(x=>`<div class="achievement ${x[4]?"":"locked"}"><div class="badge">${x[1]}</div><div><div>${x[2]}</div><div class="progress">${x[3]} ／ ${x[5]}</div></div></div>`).join("")}
    </section>`;
}

function renderOptions(){
  document.getElementById("screen").innerHTML = `
    <section class="panel"><div class="panel-title">OPTIONS</div>
      <div class="settings-list">
        <div class="setting"><span>クエスト設定</span><button data-option="quests">開く</button></div>
        <div class="setting"><span>EXP設定</span><button data-option="exp">開く</button></div>
        <div class="setting"><span>HP設定</span><button data-option="hp">開く</button></div>
        <div class="setting"><span>属性設定</span><button data-option="attributes">開く</button></div>
        <div class="setting"><span>ショップ設定</span><button data-option="shop">開く</button></div>
        <div class="setting"><span>データ管理</span><button data-option="data">開く</button></div>
      </div>
    </section>
    <section class="panel"><div class="notice">ここは「ゲーム画面」と分離した管理エリア。次の段階で本格的な編集UIを追加する。</div></section>`;
  bindScreenEvents();
}

function renderLogs(){
  cleanupLogs();
  document.getElementById("screen").innerHTML = `
    <section class="panel"><div class="panel-title">LOG — LAST 48 HOURS</div>
      ${state.logs.length ? state.logs.slice().reverse().map(l=>`<div class="achievement"><div class="badge">•</div><div><div>${l.name}</div><div class="progress">${new Date(l.at).toLocaleString()} ／ ${l.final>=0?"+":""}${l.final} EXP</div></div></div>`).join("") : `<div class="notice">まだログがない。</div>`}
    </section>`;
}

function bindScreenEvents(){
  document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>{currentScreen=b.dataset.go;render();}));
  document.querySelectorAll("[data-clear]").forEach(b=>b.addEventListener("click",()=>{
    const q=quests.find(x=>x.id===b.dataset.clear);
    if(q) applyAction(q);
  }));
  document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{currentQuestTab=b.dataset.tab;render();}));
  document.querySelectorAll("[data-buy]").forEach(b=>b.addEventListener("click",()=>{
    const item=shops.find(x=>x.id===b.dataset.buy);
    if(!item || state.totalExp<item.price) return;
    state.totalExp-=item.price;
    state.purchased.push({id:item.id,at:Date.now()});
    saveState(); toast(`${item.name} を購入`);
    render();
  }));
  document.querySelectorAll("[data-more]").forEach(b=>b.addEventListener("click",()=>{
    if(b.dataset.more==="achievements") renderAchievements();
    if(b.dataset.more==="options") renderOptions();
    if(b.dataset.more==="logs") renderLogs();
  }));
}

document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>{currentScreen=b.dataset.screen;render();}));

function toast(message){
  const el=document.getElementById("toast");
  el.textContent=message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>el.classList.remove("show"),1400);
}

render();
