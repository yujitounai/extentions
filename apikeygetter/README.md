# Secret Scanner

ページ内テキスト・インライン/外部 JavaScript から API キー、トークン、秘密情報候補を自動検出する Chrome 拡張機能です。  
旧 **API Key Getter** と **Hidden Search** を v1.0.0 で統合しています。

## 機能

- 16 種類の正規表現パターン（AWS、Google API、Stripe、OpenAI、Slack、JWT、Private Key 等）
- Content script による DOM / インライン script スキャン
- Background による外部 script fetch スキャン
- MutationObserver で動的コンテンツにも対応
- タブ別バッジ件数 + アラートアイコン
- iframe / script URL 一覧表示
- 除外ドメイン（Google、Amazon 等）

## インストール

1. Chrome で `chrome://extensions` を開く
2. 「デベロッパーモード」を有効化
3. `apikeygetter` フォルダを読み込む

## Hidden Search からの移行

`hiddensearch` は非推奨です。機能は本拡張に統合済みのため、こちらに切り替えてください。
