# LIFE QUEST V16

V15の「OPTIONS → クエスト設定 → 編集する」ボタンが反応しない不具合を修正。イベント登録とキャッシュバスターをV16へ更新。

# LIFE QUEST

レトロRPG風の生活・勉強管理アプリ。

## V2 prototype
- HOME / QUEST / STATUS / SHOP / MORE
- GOOD HABITのCLEAR
- 生活習慣系のFAILによるHP減少
- FAIL時のEXPペナルティをHPと独立して処理
- HP倍率 / STREAK倍率
- 属性EXP
- レベルアップ
- 実績
- EXPショップ
- 直近48時間の行動ログ
- localStorage保存

## 次
Supabase接続、クエスト編集UI、ピクセル勇者、演出、ログのサーバー側自動削除など。


## V3 fixes
- TOTAL EXPが属性EXPより少なくなる状態を自動修正
- ページを開いただけではSTREAKが進まない
- デイリークエストの最後の操作でのみSTREAK判定
- HP / LEVEL / STREAKの値をロード時に正規化


## V4 fixes
- GitHub Pages cache-busting added to index.html
- TOTAL EXP update made explicit and normalized
- RESET DATA no longer depends on browser confirm()
- OPTIONS now shows current saved TOTAL EXP / HP / LEVEL


## V5 RPG update
- CLEAR / FAIL の操作感を改善
- 「ゲームをしない」「2時以降に寝ない」を習慣チェックとして表示
- EXP獲得・ペナルティの画面演出
- レベルアップ演出
- レベルに応じた勇者アイコン変化

## V6 Growth system
- STREAK倍率を50日刻みで ×1 / ×2 / ×4 / ×6 / ×8 / ×10(MAX) に固定
- HOMEにSTREAK報酬と次の倍率までの残り日数を表示
- 勇者に段階的な称号を追加
- 各属性EXPに個別ATTRIBUTE Lv.を追加

## V7 navigation fix
- HOME/QUEST/STATUS/SHOP/MORE navigation now uses event delegation
- HOME is restored automatically if an invalid screen state occurs
- Render errors fall back to HOME instead of leaving the screen unusable
- Navigation resets the quest tab and scrolls to the top

## V8 fix
- V7のHOME空白画面の原因だった `streakMultiplier()` 未定義を修正
- STREAK倍率を 0-49日×1 / 50日×2 / 100日×4 / 150日×6 / 200日×8 / 250日以上×10 に固定
- 画面描画エラー時のフォールバックも強化

## V9 fix
- -100 EXPなどのペナルティでTOTAL EXPが属性EXPに引き戻されるバグを修正
- FAIL時はTOTAL EXPだけを減らし、属性EXPは獲得実績として保持
- 「ゲームをやった」では HP -15 / TOTAL EXP -100 を確実に反映

## V10: 3-attribute system
- 属性を「英語力 / 学力 / 人間力」の3種類に統合
- 英語力 = TOEFL・英語学習
- 学力 = 大学の理系科目・課題
- 人間力 = 生活習慣・健康・娯楽など、それ以外の行動
- TOTAL EXP = 3属性EXPの合計に変更
- ゲームをした場合は人間力 -100、2時以降に寝た場合は人間力 -5
- 属性が減ればTOTAL EXPも自動的に減少
- 旧5属性データは自動で3属性へ移行

## V11 fix
- 英語力・学力・人間力の各EXPを0未満にしないよう修正
- マイナスのペナルティは属性EXPが0になるところで止まる
- TOTAL EXPは3属性の合計から自動計算
- 既に保存されているマイナス値も読み込み時に0へ補正

## V12 — Level System
- TOTAL EXP is the sum of English / Academic / Human EXP.
- Level thresholds are progressive: Lv.2=100, Lv.3=250, Lv.4=450, ...
- Home shows EXP progress within the current level, not the absolute total.
- "NEXT LEVELまで ○ EXP" is shown under the EXP bar.
- Gaining or losing EXP automatically recalculates the level.
- Level-up continues to trigger the existing RPG-style overlay.

## V13 — 通常クエスト追加
- 「えいご①」：CLEARで英語力 +100 EXP
- 「にんげんりょく①」：CLEARで人間力 +200 EXP
- 通常クエストは1回クリア型で、デイリーSTREAKの全達成条件には含まれない
- 既存のLvシステムと連動するため、現在TOTALが9なら「えいご①」で109 EXPになってLv.2、「にんげんりょく①」までCLEARすると309 EXPになってLv.3になる

## V14 — 通常クエスト操作修正
- 「えいご①」「にんげんりょく①」のCLEARボタンにクリックイベントを正しく接続
- 通常クエストをCLEARすると属性EXP・TOTAL EXP・Lvが更新される
- キャッシュ対策としてapp.js/style.cssをV14に更新


## V15 — QUEST MANAGEMENT
- MORE → OPTIONS → クエスト設定を実装
- デイリー / 通常 / 長期のクエストを追加・編集・削除
- クエスト名、アイコン、属性、EXPを編集可能
- デイリーはGOOD / AVOID、FAIL時HP減少、EXPペナルティを設定可能
- 通常クエストは1回クリア型を維持
- 設定はlocalStorageのquestConfigに保存
- ゲーム画面には編集UIを置かず、OPTIONSに管理機能を分離
