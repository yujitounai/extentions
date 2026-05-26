# Hidden Content Scanner

同一ドメイン上の隠しコンテンツを辞書ベースで探索する Chrome 拡張機能です。  
旧 **findhiddenpages** と **contentdiscovery** を v2.0.0 で統合しています。

## 機能

- 辞書ベースのパス探索（495 パス × 拡張子 × バックアップ suffix）
- **Quick / Standard / Full** スキャンプロファイル
- background service worker でスキャン（popup を閉じても継続）
- 進捗保存・Resume / Stop
- ドメイン別スキャン履歴
- HEAD → GET フォールバック

## スキャンプロファイル

| Profile | 対象 | 目安 URL 数 |
|---------|------|-------------|
| Quick | ルートのみ、主要拡張子 | ~3,000 |
| Standard | ルート + 現在ディレクトリ | ~33,000–65,000 |
| Full | 全辞書・全拡張子 | ~56,000–113,000 |

Full プロファイルは数時間かかる場合があります。

## インストール

1. Chrome で `chrome://extensions` を開く
2. 「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」→ `findhiddenpages` フォルダを選択

## contentdiscovery からの移行

`contentdiscovery` は非推奨です。機能は本拡張に統合済みのため、こちらに切り替えてください。
