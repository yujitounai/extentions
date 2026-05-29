# Resource Counter

Web セキュリティ診断向け Chrome 拡張。ページ上のリソース列挙、キャッシュヘッダ検出、ヘッダ反射テスト、脆弱 JS / 正規表現スキャンなどを行います。

## 機能

- **Resources** — 同一ドメイン / 外部ドメインの CSS・JS・画像 URL 一覧
- **Scans** — S3 URL、脆弱 JS パス、正規表現、危険キーワード
- **Headers** — 偽装ヘッダ付き再取得と body 反射検出
- **Tools** — ReDoS / XS-Leak / prototype pollution 用 PoC リンク
- **バッジ** — キャッシュヘッダ検出時に `cache` 表示

## インストール

`chrome://extensions` → デベロッパーモード → `cache` フォルダを読み込む

## 注意

診断許可を得たサイト、または自分が管理するサイトにのみ使用してください。
