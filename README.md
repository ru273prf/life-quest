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
