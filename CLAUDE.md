# 困り感 支援記録アプリ（komarikan-app）

小学校外国語の授業で、児童の「困り感」→手立て→評価→次の手立て を記録するWebアプリ。
診断・特性判定はしない。教師が見取った具体的な姿を記録し、教師が判断するための道具。

## 利用者への対応
- 返答は必ず日本語・平易な言葉で（利用者は英語が読めない）
- 新しい機能は、作る前に必ず質問して仕様を一緒に決める

## 公開
- URL: https://mototeachermoto-pixel.github.io/komarikan-app/
- GitHub: https://github.com/mototeachermoto-pixel/komarikan-app （main ブランチを GitHub Pages で公開）
- 直したら commit → `git push` で数分後に反映される

## 構成（ビルド不要・素のHTML/CSS/JS）
- `index.html` … 読み込む順番：xlsx → master → storage → sheet → app
- `js/master.js` … 困り感10カテゴリー・評価・変化チェック・手立ての初期案50個（支援の強さ 大3/中2/小1）
- `js/storage.js` … 保存係。今は LocalStorage。将来 Google Sheets に替えるときはここだけ差し替える（関数はすべて async）
- `js/sheet.js` … .xlsx 書き出し・読み込み（シート：児童／支援記録／手立て、中身は日本語、複数値は「、」区切り）
- `js/app.js` … 画面。# の後ろで切り替え
- `js/lib/xlsx.full.min.js` … SheetJS 0.18.5

## 記録の流れ
①見立て（困り感・具体的な姿）→ ②手立て（過去の結果を表示、🔴は後ろへ）→ 保存＝「実践中」
→ ③評価 → ④今後の展開（決まりに沿った次回候補＋相談用の文章コピー）→ 次回の記録を作る（from_record_id でつながる）

## 決めたこと
- 過去の記録は上書きしない。1回の支援＝1件の記録
- 相談用の文章に 表示名・児童メモ は入れない
- 書き出しは「バックアップ用（全部入り・読み込み可）」と「研究用（IDだけ・読み込み不可）」
- データは端末ごと。端末間の移動はスプレッドシートの書き出し→読み込み

## 今後の予定・保留中
- 保留：④で「できた」のとき候補が多すぎる（上位3つ＋もっと見る？）
- 保留：実践中の記録を相談用の文章に入れるか
- Phase 2：Google スプレッドシート直接連携（Google Apps Script）
- Phase 3：推薦の改善 ／ Phase 4：アプリ内でAIに相談（個人情報に配慮）
