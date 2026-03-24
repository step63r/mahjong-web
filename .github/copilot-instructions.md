# Copilot Instructions for Mahjong Web App

## このドキュメントについて

- GitHub Copilot や各種 AI ツールが本リポジトリのコンテキストを理解しやすくするためのガイドです。
- 新しい機能を実装する際はここで示す技術選定・設計方針・モジュール構成を前提にしてください。
- 不確かな点がある場合は、リポジトリのファイルを探索し、ユーザーに「こういうことですか?」と確認をするようにしてください。

## 前提条件

- 回答は必ず日本語でしてください。
- コードの変更をする際、変更量が200行を超える可能性が高い場合は、事前に「この指示では変更量が200行を超える可能性がありますが、実行しますか?」とユーザーに確認をとるようにしてください。
- 何か大きい変更を加える場合、まず何をするのか計画を立てた上で、ユーザーに「このような計画で進めようと思います。」と提案してください。この時、ユーザーから計画の修正を求められた場合は計画を修正して、再提案をしてください。

## アプリ概要

### アカウント登録／ログイン

- 主要なIDプロバイダー（Google、Xなど）を通してアカウント登録、ログインを行う。
- ユーザーはアカウントを作成せず、ゲストアカウントとしてアプリを利用することも可能。

### 対局

- 対局はCPU戦と対人戦があり、いずれもゲストアカウントでも行うことができる。
- ログインされた状態で行った対局は、後から戦績を参照することができる。

#### CPU戦

- CPUと4人打ちの麻雀を行う。
- 対局の長さは東風（親1周）、半荘（親2周）を選ぶことができる。
- 持ち点は25,000点で返しは30,000点となる。
- 更に細かいルール設定を行うことができる。
- ルール設定については後述する。

#### 対人戦

- ホストとなるユーザーがルームを作成し、他のユーザーがルームIDを入力することで対人戦を行う。
- 対局の長さは東風（親1周）、半荘（親2周）を選ぶことができる。
- 持ち点は25,000点で返しは30,000点となる。
- 更に細かいルール設定を行うことができる。
- ルール設定については後述する。

### 戦績閲覧

- ログインユーザーが行った対局は、戦績を閲覧することができる。
- 閲覧可能な情報としては、以下のようなものを想定。
  - 直近の戦績（1～4位）
  - 平均順位
  - 平均和了打点、飜数
  - 平均放銃打点、飜数
  - 役ごとの和了回数

### ルール設定

- CPU戦ではユーザーが、対人戦ではホストユーザーが細かいルール設定を行うことができる。
- 設定可能なルールは以下のとおり。（末尾の括弧書きが選択肢で、★マークが既定値である）
  - 役
    - 喰いタン（★有り or 無し）
    - 後付け（★有り or 無し）
    - 一発ツモ（★有り or 無し）
    - 流し満貫の有無（★有り or 無し）
    - 国士無双の暗槓された牌でのロン（★有り or 無し）
    - 九蓮宝燈の成立条件（萬子のみ or ★萬子・索子・筒子いずれも可）
    - 發なしでの緑一色（★有り or 無し）
  - ドラ
    - 槓ドラ（常に即乗り or ★暗槓時は即乗り＋明槓時は牌を捨てた後に乗る or 無し）
    - 裏ドラ（★有り or 無し）
    - 槓裏ドラ（★有り or 無し）
    - 赤ドラの（無し or 5萬・5索・5筒 or ★5萬・5索・5筒x2）
  - アガリ点
    - 七対子の点数（★25符2飜 or 50符1飜）
    - 連風牌の雀頭の符数（2符 or ★4符）
    - 切り上げ満貫（★有り or 無し）
    - 人和（★役満 or 倍満 or 跳満 or 無し）
  - 鳴き/リーチ/アガリ
    - 食い替え（有り or ★無し）
    - ダブロン（★ダブロン有り or 頭ハネ）
    - トリロン（トリロン有り or 頭ハネ or ★流局）
    - 大三元、大四喜、四槓子の責任払い（★有り or 無し）
  - ゲーム進行
    - 連荘の条件（アガリ連荘 or 聴牌連荘）
      ※東風戦の既定値はアガリ連荘、半荘戦の既定値は聴牌連荘とする
    - 九種九牌の途中流局（★親の連荘 or 親流れ or 流局しない）
    - 四風子連打の途中流局（親の連荘 or ★親流れ or 流局しない）
    - 四開槓の途中流局（親の連荘 or ★親流れ or 流局しない）
    - 四人リーチの途中流局（親の連荘 or 親流れ or ★流局しない）
    - トビ（★0点未満でトビ or 0点以下でトビ or トビ無し）
    - オーラスのアガリ止め（有り or 無し）
  - 順位
    - 順位ウマ（5-10 or 10-20 or ★10-30 or 20-30）
    - 端数計算（小数第1位まで計算 or ★五捨六入）

### デバッグ機能

- `npm run dev` など開発環境で実行された場合には、対局中にデバッグ機能を有効化することができる。
- デバッグ機能では、すべての手牌、牌山が可視状態となり、ユーザーが任意に手牌や牌山を交換することができる。

## 技術スタック概要

- **ランタイム**: Node.js 22.x
- **言語**: TypeScript 5.9（strict モード）
- **ビルド**: tsc（プロジェクト参照 / `--build`）
- **テスト**: Vitest 4.x
- **リンター**: ESLint（flat config）
- **フォーマッター**: Prettier
- **パッケージ管理**: npm workspaces（モノレポ）

## プロジェクト構成と役割

```
mahjong-web/
├── .github/
│   └── copilot-instructions.md   # Copilot / AI ツール向けガイド
├── .gitignore
├── .prettierignore
├── .prettierrc                    # Prettier 設定
├── eslint.config.mjs              # ESLint 設定（flat config）
├── memo.md                        # 開発メモ／フェーズ管理
├── package.json                   # ルート package.json（workspaces 定義）
├── tsconfig.base.json             # 共通 TypeScript ベース設定
├── tsconfig.json                  # ルート tsconfig（プロジェクト参照）
├── vitest.workspace.ts            # Vitest ワークスペース設定
│
└── packages/
    ├── domain/                    # ★ 麻雀ドメインロジック（純粋関数中心）
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts           # パッケージ公開エクスポート
    │       ├── index.test.ts      # エクスポート疎通テスト
    │       │
    │       ├── tile/              # 牌の定義・生成・ユーティリティ
    │       │   ├── types.ts       #   TileType, Tile 型定義
    │       │   ├── create.ts      #   createAllTiles（136枚生成）
    │       │   ├── utils.ts       #   sortTiles, isSameTile, isWindTile 等
    │       │   ├── index.ts       #   再エクスポート
    │       │   └── tile.test.ts   #   34テスト
    │       │
    │       ├── hand/              # 手牌管理・テンパイ判定・向聴数計算
    │       │   ├── hand.ts        #   Hand クラス（addTile, removeTile）
    │       │   ├── tenpai.ts      #   getTenpaiTiles, isTenpai, isKyuushuKyuuhai
    │       │   ├── shanten.ts     #   calculateShanten, calculateShantenForEachDiscard
    │       │   ├── index.ts       #   再エクスポート
    │       │   ├── hand.test.ts   #   14テスト
    │       │   ├── tenpai.test.ts #   13テスト
    │       │   └── shanten.test.ts#   17テスト
    │       │
    │       ├── meld/              # 副露（チー・ポン・カン）管理
    │       │   ├── types.ts       #   MeldType, Meld 型定義
    │       │   ├── meld.ts        #   findChiCandidates, findPonCandidates 等
    │       │   ├── index.ts       #   再エクスポート
    │       │   └── meld.test.ts   #   27テスト
    │       │
    │       ├── wall/              # 牌山（配牌・ツモ・ドラ表示牌）
    │       │   ├── wall.ts        #   Wall クラス（create, drawTile, getDoraIndicators）
    │       │   ├── index.ts       #   再エクスポート
    │       │   └── wall.test.ts   #   20テスト
    │       │
    │       ├── discard/           # 河（捨て牌管理）
    │       │   ├── discard.ts     #   Discard クラス（addDiscard, getAllDiscards）
    │       │   ├── index.ts       #   再エクスポート
    │       │   └── discard.test.ts#   10テスト
    │       │
    │       ├── rule/              # ルール設定（カスタマイズ可能な対局ルール）
    │       │   ├── types.ts       #   RuleConfig 型定義、各種列挙型
    │       │   ├── defaults.ts    #   createDefaultRuleConfig, createTonpuDefaults
    │       │   ├── index.ts       #   再エクスポート
    │       │   └── rule.test.ts   #   36テスト
    │       │
    │       ├── yaku/              # 役判定（通常役・役満）
    │       │   ├── types.ts       #   Yaku, WinContext, JudgeResult 型定義
    │       │   ├── parser.ts      #   parseMentsu（面子分解）, parseChiitoitsu, parseKokushi
    │       │   ├── yaku-normal.ts #   checkAllNormalYaku（通常役判定）
    │       │   ├── yaku-yakuman.ts#   checkAllYakuman（役満判定）
    │       │   ├── judge.ts       #   judgeWin（和了判定メイン）
    │       │   ├── index.ts       #   再エクスポート
    │       │   └── yaku.test.ts   #   38テスト
    │       │
    │       ├── score/             # 点数計算（符計算・基本点・支払い）
    │       │   ├── types.ts       #   ScoreContext, ScoreResult, PaymentResult 型定義
    │       │   ├── fu.ts          #   calculateFu（符計算）
    │       │   ├── score.ts       #   calculateScore（点数計算メイン）
    │       │   ├── index.ts       #   再エクスポート
    │       │   └── score.test.ts  #   43テスト
    │       │
    │       ├── action/            # プレイヤーアクション（ツモ・打牌・鳴き等）
    │       │   ├── types.ts       #   ActionType, PlayerAction 型定義
    │       │   ├── action.ts      #   getActionsAfterDraw, getActionsAfterDiscard
    │       │   ├── index.ts       #   再エクスポート
    │       │   └── action.test.ts #   11テスト
    │       │
    │       ├── round/             # 局の状態管理・進行制御
    │       │   ├── types.ts       #   RoundState, RoundResult, RoundPhase 型定義
    │       │   ├── round.ts       #   createRound, startRound, applyAction, resolveAfterDiscard 等
    │       │   ├── index.ts       #   再エクスポート
    │       │   └── round.test.ts  #   18テスト
    │       │
    │       ├── game/              # ゲーム全体管理（半荘・東風の進行）
    │       │   ├── types.ts       #   GameState, GameResult, GamePhase 型定義
    │       │   ├── game.ts        #   createGame, startGame, processRoundResult, calculateFinalResult
    │       │   ├── index.ts       #   再エクスポート
    │       │   └── game.test.ts   #   23テスト
    │       │
    │       └── ai/                # CPU AI（基本思考ロジック）
    │           ├── types.ts       #   AiPlayer インターフェース
    │           ├── ai.ts          #   BasicAiPlayer クラス, playRoundWithAi ヘルパー
    │           ├── index.ts       #   再エクスポート
    │           ├── ai.test.ts     #   8テスト（ユニット＋1局完走）
    │           └── simulation.test.ts # 5テスト（半荘・東風完走シミュレーション）
    │
    ├── shared/                    # クライアント・サーバー共有型・ユーティリティ（未実装）
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       └── index.ts
    │
    ├── client/                    # フロントエンド — React SPA（未実装）
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       └── index.ts
    │
    └── server/                    # バックエンド — API / WebSocket サーバー（未実装）
        ├── package.json
        ├── tsconfig.json
        └── src/
            └── index.ts
```

### モジュール依存関係（domain パッケージ内）

```
tile ← hand ← tenpai / shanten
tile ← meld
tile ← wall
tile ← discard
tile, hand, meld ← yaku（parser, judge, yaku-normal, yaku-yakuman）
yaku ← score
tile, hand, meld, yaku ← action
rule, wall, hand, meld, action, score, yaku, discard ← round
round, rule ← game
hand, action, round, rule, tile ← ai
```

### テスト数（合計 318 テスト）

| モジュール | テスト数 |
|-----------|---------|
| tile      | 34      |
| hand      | 14      |
| tenpai    | 13      |
| shanten   | 17      |
| meld      | 27      |
| wall      | 20      |
| discard   | 10      |
| rule      | 36      |
| yaku      | 38      |
| score     | 43      |
| action    | 11      |
| round     | 18      |
| game      | 23      |
| ai        | 8       |
| simulation| 5       |
| index     | 1       |

## アーキテクチャ指針

### コンポーネント設計

- **Atomic Design の部分的採用**: `shared/components/ui` に基本コンポーネント、feature 内に機能特化コンポーネント
- **Composition Pattern**: 小さなコンポーネントを組み合わせて複雑な UI を構築
- **Container/Presentational Pattern**: ロジックと表示を分離 (hooks でロジックを抽出)

### 状態管理の方針

- **ローカル状態**: `useState` / `useReducer` で管理
- **グローバル状態**: Zustand で管理 (例: ユーザー情報、UI状態)
- **サーバー状態**: React Query で管理 (API データのキャッシング・同期)
- **フォーム状態**: React Hook Form で管理

### データフロー

1. **UI → Hook**: ユーザーアクションをカスタムフックに通知
2. **Hook → API (React Query)**: API 呼び出しを React Query でラップ
3. **API → Hook → UI**: データを取得し、キャッシュして UI に反映
4. **楽観的更新**: React Query の `onMutate` で即座に UI を更新

## ディレクトリ・ファイル命名規則

### コンポーネント

- **ファイル名**: PascalCase (例: `TaskList.tsx`, `TaskCard.tsx`)
- **ディレクトリ**: ケバブケース (例: `task-list/`, `calendar-view/`)
- **index.ts**: 各ディレクトリに配置し、外部へのエクスポートを集約

### フック

- **ファイル名**: camelCase + `use` プレフィックス (例: `useTaskList.ts`, `useAuth.ts`)

### ユーティリティ

- **ファイル名**: camelCase (例: `formatDate.ts`, `validateEmail.ts`)

### 型定義

- **ファイル名**: camelCase または PascalCase (例: `task.types.ts`, `Task.ts`)
- **型名**: PascalCase (例: `Task`, `User`, `ApiResponse<T>`)

## UI 実装ガイド

### コンポーネント設計原則

- **Single Responsibility**: 1つのコンポーネントは1つの責務のみ
- **Props の型定義**: 全ての props に明示的な型を定義
- **デフォルトエクスポートを避ける**: Named export を使用し、リファクタリングを容易に
- **children パターン**: 柔軟性が必要な場合は `children` を活用

### スタイリング

- **Tailwind CSS をベースに使用**: ユーティリティファーストのアプローチ
- **共通スタイルの定義**: `styles/globals.css` でカスタムユーティリティクラスを定義
- **CSS Modules**: コンポーネント固有の複雑なスタイルが必要な場合のみ使用
- **レスポンシブ対応**: Tailwind のブレークポイント (`sm:`, `md:`, `lg:`) を活用

### アクセシビリティ (a11y)

- **セマンティック HTML**: 適切な HTML タグを使用 (`<button>`, `<nav>`, `<main>` 等)
- **aria 属性**: 必要に応じて `aria-label`, `aria-describedby` 等を付与
- **キーボード操作**: すべての操作をキーボードで実行可能に
- **フォーカス管理**: `focus-visible` で適切なフォーカススタイルを適用

### パフォーマンス最適化

- **React.memo**: 不要な再レンダリングを防ぐ
- **useMemo / useCallback**: 高コストな計算や関数の再生成を防ぐ
- **Code Splitting**: React.lazy + Suspense で遅延ロード
- **画像最適化**: WebP 形式、適切なサイズ、lazy loading

## 状態管理の実装ガイド

### Zustand の使い方

```typescript
// stores/authStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        isAuthenticated: false,
        setUser: (user) => set({ user, isAuthenticated: !!user }),
        logout: () => set({ user: null, isAuthenticated: false }),
      }),
      { name: 'auth-storage' }
    )
  )
);
```

### React Query の使い方

```typescript
// api/taskApi.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const useTaskList = () => {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
    staleTime: 5 * 60 * 1000, // 5分
  });
};

export const useCreateTask = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};
```

## API 通信とデータ管理

### Axios インスタンスの設定

- **shared/api/client.ts** に axios インスタンスを作成
- インターセプターで認証トークンを自動付与
- エラーハンドリングの共通化

### エラーハンドリング

- **API エラー**: React Query の `onError` でハンドリング
- **グローバルエラー**: Error Boundary でキャッチ
- **ユーザーフィードバック**: Toast 通知で表示

### データ型定義

- **Zod スキーマ**: API レスポンスのバリデーション
- **TypeScript 型**: Zod スキーマから型を生成 (`z.infer<typeof schema>`)

## 認証 (Firebase Authentication)

### Google Sign-In フロー

1. **Firebase SDK 初期化**: `lib/firebase/config.ts` で設定
2. **Google プロバイダー**: `signInWithPopup` でログイン
3. **トークン管理**: Firebase が自動管理、`onAuthStateChanged` で状態監視
4. **Zustand に保存**: ログインユーザー情報を `authStore` に保存

### 認証ガード

- **ProtectedRoute コンポーネント**: 未認証時にログインページへリダイレクト
- **useAuth フック**: 認証状態を簡単に取得

## Google Calendar 連携

### OAuth2 フロー

1. **Google API Client Library**: `gapi` を使用
2. **スコープ**: `https://www.googleapis.com/auth/calendar`
3. **アクセストークン**: Firebase Auth の ID トークンとは別に管理

### カレンダーイベント同期

- **定期同期**: setInterval または Web Worker で定期的にポーリング
- **キャッシュ**: React Query でイベントをキャッシュ
- **オフライン対応**: IndexedDB に同期データを保存

## 通知機能

### Web Push API

- **Service Worker**: `public/sw.js` で通知受信
- **FCM**: Firebase Cloud Messaging でプッシュ通知配信
- **通知許可**: 初回アクセス時に許可を要求
- **通知クリック**: 特定のタスクやイベントページへ遷移

### リマインダーのスケジューリング

- **Web Worker**: バックグラウンドでタイマー実行
- **Notification API**: ローカル通知を表示
- **繰り返しタスク**: cron パターンを解析してスケジューリング

## テスト戦略

### 単体テスト (Vitest)

- **hooks**: `@testing-library/react-hooks` でテスト
- **utils**: 純粋関数のロジックをテスト
- **stores**: Zustand ストアのアクションと状態変化をテスト

### コンポーネントテスト (React Testing Library)

- **ユーザーインタラクション**: `fireEvent` / `userEvent` でイベントをシミュレート
- **非同期処理**: `waitFor` で非同期レンダリングを待機
- **モック**: MSW で API レスポンスをモック

### E2E テスト (Playwright / Cypress)

- **主要フロー**: ログイン → タスク作成 → 編集 → 削除のフローをテスト
- **クロスブラウザ**: Chrome, Firefox, Safari でテスト

## ビルドとデプロイ

### Vite ビルド設定

- **環境変数**: `.env.development`, `.env.production` で管理
- **コード分割**: 自動的に最適化されるが、必要に応じて手動設定
- **アセット最適化**: 画像・フォントの最適化

### Firebase Hosting

- **デプロイ**: `firebase deploy --only hosting`
- **プレビュー**: `firebase hosting:channel:deploy preview`
- **カスタムドメイン**: Firebase コンソールで設定

### CI/CD (GitHub Actions)

- **PR チェック**: リント、型チェック、テスト実行
- **自動デプロイ**: main ブランチへのマージで本番デプロイ

## コーディング規約・ベストプラクティス

### TypeScript の作法

- **strict モード**: `tsconfig.json` で `strict: true`
- **any の禁止**: `no-explicit-any` ルールを有効化
- **型推論の活用**: 冗長な型注釈は避け、推論に任せる
- **ユニオン型**: 状態を明示的に表現 (例: `type Status = 'idle' | 'loading' | 'success' | 'error'`)

### React の作法

- **関数コンポーネント**: クラスコンポーネントは使用しない
- **hooks のルール**: トップレベルでのみ呼び出し、条件分岐内で呼び出さない
- **useEffect の依存配列**: 正確に指定し、不要な再実行を防ぐ
- **key prop**: リストレンダリング時に一意で安定した key を使用

### 非同期処理

- **async/await**: Promise チェーンよりも優先
- **エラーハンドリング**: try-catch で必ずエラーをキャッチ
- **AbortController**: 不要なリクエストはキャンセル

### インポート順序

1. React 関連
2. 外部ライブラリ
3. 内部モジュール (features, shared, lib)
4. 型定義
5. スタイル

```typescript
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { TaskList } from '@/features/task/components';
import { Button } from '@/shared/components/ui';
import { formatDate } from '@/shared/utils';

import type { Task } from '@/features/task/types';

import styles from './Home.module.css';
```

### コメント

- **JSDoc**: 複雑な関数には JSDoc コメントを付与
- **TODO コメント**: 一時的な実装には `// TODO:` を残す
- **コメントアウト**: 不要なコードは削除し、コメントアウトは残さない

## アンチパターン

以下のパターンは避けてください。既存コードで発見した場合は、リファクタリングを提案してください。

### コンポーネント設計

- **巨大コンポーネント**: 1つのコンポーネントが200行を超える場合は分割を検討
- **Prop Drilling**: 深い階層での props バケツリレーは、Context や状態管理ライブラリで解決
- **useEffect の濫用**: データフェッチは React Query、イベントハンドラーで済む処理は useEffect を使わない

### 状態管理

- **過度なグローバル状態**: 真にグローバルな状態のみを Zustand で管理
- **useState の濫用**: 複雑な状態は useReducer で管理
- **直接的な状態変更**: イミュータブルな更新を心がける

### パフォーマンス

- **不要な再レンダリング**: React DevTools Profiler で計測し、必要に応じて最適化
- **過度な最適化**: 実測せずに useMemo/useCallback を多用しない
- **巨大なバンドル**: Code Splitting を活用し、初期ロードを軽量化

### TypeScript

- **any の濫用**: 型推論が難しい場合は `unknown` を使用し、型ガードで絞り込む
- **型アサーション (as)**: 必要最小限に留め、型の安全性を保つ
- **オプショナルの濫用**: 本当に必要な場合のみ `?` を使用

## セキュリティとプライバシー

- **環境変数**: API キーは `.env` で管理し、`.gitignore` に追加
- **XSS 対策**: ユーザー入力は適切にサニタイズ、React の JSX は自動エスケープ
- **CSRF 対策**: Firebase Authentication のトークンベース認証で対応
- **HTTPS 通信**: 本番環境では必ず HTTPS を使用
- **CSP (Content Security Policy)**: 適切な CSP ヘッダーを設定

## アクセシビリティ (a11y) ガイドライン

- **WCAG 2.1 AA レベル**: 準拠を目指す
- **スクリーンリーダー対応**: ARIA 属性を適切に使用
- **キーボードナビゲーション**: Tab, Enter, Escape キーでの操作をサポート
- **カラーコントラスト**: 4.5:1 以上のコントラスト比を維持
- **axe DevTools**: 開発時に定期的にチェック

## 国際化 (i18n)

- **react-i18next**: 多言語対応
- **言語ファイル**: `public/locales/{lang}/translation.json`
- **日付・数値フォーマット**: `Intl` API を活用
- **RTL 対応**: 将来的にアラビア語などに対応する場合を考慮

## まとめ

このドキュメントを常に最新に保ち、新しい技術選定や設計変更があった場合は適宜更新してください。GitHub Copilot や AI ツールは、このドキュメントを参照することで、プロジェクトのコンテキストを正確に理解し、より適切なコード提案を行うことができます。

チーム全体でこのガイドラインに従うことで、コードの一貫性と保守性が向上し、新しいメンバーのオンボーディングも円滑になります。

---

**Mahjong Web App** は、モダンな React 開発のベストプラクティスを取り入れた、スケーラブルで保守性の高いアーキテクチャを目指しています。
