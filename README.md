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
