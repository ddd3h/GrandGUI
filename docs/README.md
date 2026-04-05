# GrandGUI — 開発者ドキュメント

本ドキュメントは GrandGUI の内部構造を理解し、機能を追加・修正したい開発者向けです。

## ドキュメント一覧

| ファイル | 内容 |
|---|---|
| [architecture.md](./architecture.md) | システムアーキテクチャ・データフロー全体図 |
| [backend.md](./backend.md) | バックエンド構造・全APIエンドポイント・DB設計 |
| [frontend.md](./frontend.md) | フロントエンド構造・コンポーネント・状態管理 |
| [uart-profile.md](./uart-profile.md) | UARTプロファイル設定・パーサー詳細 |
| [widgets.md](./widgets.md) | ウィジェットシステム・新規ウィジェット追加方法 |
| [offline-maps.md](./offline-maps.md) | オフライン衛星地図・MBTiles作成方法 |
| [testing.md](./testing.md) | テスト戦略・テストの追加方法 |

## 30秒で理解するシステム概要

```
UART/Simulator
    │  テキスト行
    ▼
ReceiverService (Python)
    │  パース・DB保存
    ▼
SQLite (WAL)     WebSocket broadcast
    │                   │
    ▼                   ▼
REST API          Zustand store (React)
    │                   │
    └─────────┬─────────┘
              ▼
         React UI
    (Map / Graph / Status widgets)
```

## 開発を始める前に読むべきファイル

1. `backend/app/main.py` — アプリ起動・DB初期化・シード
2. `backend/app/core/receiver_service.py` — データパイプラインの中心
3. `frontend/src/stores/telemetryStore.ts` — フロントエンドのデータ受信
4. `frontend/src/components/widgets/` — 全ウィジェット

## 技術的な決定事項

- **SQLite WAL モード**: 同時読み書き性能のため
- **WebSocket のみでリアルタイム更新**: Server-Sent Events より双方向対応が容易
- **Zustand**: Redux より記述量が少なく、React 19 との相性が良い
- **dnd-kit**: react-beautiful-dnd より軽量・アクセシブル
- **MapLibre GL JS**: Mapbox GL JS の OSS フォーク、APIキー不要
