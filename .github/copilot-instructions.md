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

### 後付けナシ設定について

「後付けナシ」のルールを説明します。以下のいずれかに該当する場合、「後付けナシ」ルールではアガることはできません。

#### ①第一副露が役に絡むか、副露してない面子で役が確定しないとアガれない

##### アガれない例１

- 手牌：23456s西西
- 第一副露：123p
- 第二副露：中中中
- ロン牌：1s or 4s or 7s

第二副露の「中」で役が付きますが、第一副露が役に絡んでおらず、「中」も副露しているので、アガれません。

##### アガれない例２
- 手牌：234s234m西
- 第一副露：123p
- 第二副露：234p
- ロン牌：西

第二副露で三色同順の役が付きますが、第一副露が役に絡んでおらず、三色同順も手牌の中で完成していないので、アガれません。

##### アガれない例３
- 手牌：12345s444m西西
- 第一副露：789s
- ロン牌：3s or 6s

「六索」が来れば第一副露が一気通貫に絡むので、アガれるように思えますが、「三索」が来た場合は役が付かず、役が確定しているとは言えないので、仮に「六索」が来てもアガる事ができません。これを片和了りの禁止と言います。片和了りの禁止については、後であらためて説明します。

##### アガれる例１

- 手牌：123456789s西
- 第一副露：123p
- ロン牌：西

第一副露が役に絡んでいませんが、手牌で一気通貫が確定しているのでアガれます。

##### アガれる例２

- 手牌：123456s4m白白白
- 第一副露：123p
- ロン牌：4m

第一副露が役に絡んでいませんが、「白」の暗刻で役が確定しているのでアガれます。

他家(ターチャ＝他のプレーヤー)は第一副露の際に「白」の暗刻が存在したかを確認できませんが、それでもアガりを認めるのが一般的です。

##### アガれる例３

- 手牌：12389s444m西西
- 第一副露：456s
- ロン牌：7s

第一副露が一気通貫に絡んでいて、待ち牌も「七索」のみで役が確定しているのでアガる事ができます。

#### ②片和了り(アガり)はしてはいけない

片和了りとは、テンパイで待ち牌が2種類以上ある場合、その内1種類以上の待ち牌では役が付かない状態のことです。

##### アガれない例１

- 手牌：123s33567m666p白白
- ロン牌：3m or 白

「白」が来たときのみ役が確定するので、片和了りとなります。この場合、仮に「白」が来たとしてもアガる事は出来ません。

##### アガれない例２

- 手牌：12345678s456m白白
- ロン牌：3s or 6s or 9s

9が来れば一気通貫の役が付きますが、3や6では役が付きません。この待ちの場合、9来てもアガることが出来ません。

##### アガれない例３

- 手牌：123456s456m白白中中
- ロン牌：白 or 中

「白」でも「中」でも役が付くのでアガれるように思いますが、この場合でも「白」か「中」かどちらの役が付くかが確定していないので、片和了りとみなされてアガる事ができません。

※この場合、和了り牌が複数ありますが、どの牌で和了しても役が同じである必要があります。

##### アガれない例４

- 手牌：2223s45678m234p
- ロン牌：1s or 3s or 4s

「一索」が来た場合はピンフのみ、「三索」が来た場合はタンヤオのみ、「四索」が来た場合はピンフとタンヤオと役が確定しておらず、アガる事が出来ません。

※この場合、和了り牌が複数ありますが、どの牌で和了しても役が同じである必要があります。

##### アガれる例１

- 手牌：123s123m789p西西白白
- ロン牌：西 or 白

「西」と「白」のどちらの牌が来ても、チャンタという役が確定しているので、アガる事が出来ます。「白」が来た場合はチャンタに加えて「白」の1役が付くことになります。

##### アガれる例２

- 手牌：34455s234m33388p
- ロン牌：3s or 6s

「三索」が来れば一盃口(イーペーコー)とタンヤオ、「六索」が来ればタンヤオのみ、どちらにしてもタンヤオは確定なので、アガる事が出来ます。

##### アガれる例３

- 手牌：111222444s7999p
- ロン牌：7p or 8p

「八筒」が来た場合は三暗刻、「七筒」が来た場合は四暗刻と、役が確定していないように見えますが、四暗刻は三暗刻の上位役なので、仮に「七筒」で四暗刻となっても、同時に三暗刻が確定とみなされて、アガる事が出来ます。点数は四暗刻の役満のみで、三暗刻の点数は加算されません。

### 国士無双の暗槓ロンについて

#### 前提知識

- 自分の手牌で同種の牌を4枚すべて揃えて槓することを「暗槓」といいます
- 一方で、自分の手牌で同種の牌を3枚揃え、最後の1枚を他家から副露することを「明槓」といいます
- ポンした状態で最後の1枚をツモり、槓子にすることを「加槓」といいます
- 加槓をした瞬間に、その牌がアガり牌であるとき、その牌に対してロンができます
- 加槓に対してロンを行ったとき、「槍槓」という1飜の役が付きます
- よって「暗槓は槍槓できない」というのがルールの大原則です

#### 国士無双の暗槓ロンのルール

- 「国士無双の暗槓ロン」が有効な場合、他家が暗槓を行い、その牌が国士無双のアガり牌であったとき、その牌に対して槍槓をすることができます
- 国士無双を暗槓ロンしても、槍槓の1飜は付かず、国士無双の役満もしくは国士無双十三面待ちのダブル役満のみとなります

### 槓裏ドラのルール

- 「裏ドラ」が「有り」の場合、「槓裏ドラ」の設定を「有り」「無し」から設定することができます
- 「裏ドラ」が「無し」の場合、「槓裏ドラ」の設定は「無し」に固定されます
- 「槓裏ドラ」が「有り」の場合、立直して和了したとき、通常のドラ、裏ドラに加え、和了ったときにめくられている槓ドラの数だけ槓裏ドラがめくられ、点数計算に加算されます
- 「裏ドラ」が「有り」かつ「槓裏ドラ」が「無し」の場合。立直して和了したとき、通常のドラ、裏ドラ、和了ったときにめくられている槓ドラのみが点数計算に加算されます

### デバッグ機能

- `npm run dev` など開発環境で実行された場合には、対局中にデバッグ機能を有効化することができる。
- デバッグ機能では、すべての手牌、牌山が可視状態となり、ユーザーが任意に手牌や牌山を交換することができる。

## 技術スタック概要

- **ランタイム**: Node.js 22.x
- **言語**: TypeScript 5.9（strict モード）
- **フロントエンド**: React 19 + Vite + Pixi.js v8（2D 盤面レンダリング）+ Zustand（状態管理）
- **バックエンド**: Fastify 5.x + Socket.IO 4.x（対人戦リアルタイム通信）
- **データベース**: PostgreSQL 17（Prisma 7 ORM + `@prisma/adapter-pg`）
- **認証**: Firebase Authentication（Google Sign-In）
- **ビルド**: tsc（プロジェクト参照 / `--build`）、Vite（クライアント）
- **テスト**: Vitest 4.x
- **リンター**: ESLint（flat config）
- **フォーマッター**: Prettier
- **パッケージ管理**: npm workspaces（モノレポ）
- **コンテナ**: Docker（node:22-slim マルチステージビルド）
- **デプロイ**: AWS — S3 + CloudFront（フロント）、App Runner（バックエンド）、RDS PostgreSQL（DB）

## プロジェクト構成と役割

```
mahjong-web/
├── .github/
│   └── copilot-instructions.md   # Copilot / AI ツール向けガイド
├── .dockerignore                  # Docker ビルド除外設定
├── .gitignore
├── .prettierignore
├── .prettierrc                    # Prettier 設定
├── docker-compose.yml             # ローカル開発用 PostgreSQL 17
├── Dockerfile                     # マルチステージ Docker ビルド（node:22-slim）
├── docs/                          # 設計ドキュメント
│   └── gui-specifications.md      #   GUI 仕様書
├── eslint.config.mjs              # ESLint 設定（flat config）
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
    ├── shared/                    # クライアント・サーバー共有型・ユーティリティ
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts           # 再エクスポート
    │       └── types.ts           # Socket.IO イベント型、ルーム・ゲーム共有型
    │
    ├── client/                    # フロントエンド — React SPA + Pixi.js 盤面描画
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── main.tsx           # エントリーポイント
    │       ├── App.tsx            # React Router ルート定義
    │       ├── types.ts           # UI 用の型定義
    │       ├── lib/
    │       │   └── socket.ts      # Socket.IO クライアント（VITE_SERVER_URL で接続先制御）
    │       ├── stores/
    │       │   ├── gameStore.ts       # Zustand — CPU対局ゲームループ
    │       │   ├── onlineGameStore.ts # Zustand — 対人戦ゲームループ（Socket.IO連携）
    │       │   └── onlineRoomStore.ts # Zustand — ルーム待機状態管理
    │       ├── utils/
    │       │   ├── viewConverter.ts       # domain → UI 表示データ変換（CPU戦）
    │       │   └── onlineViewConverter.ts # domain → UI 表示データ変換（対人戦）
    │       ├── pages/
    │       │   ├── TopPage.tsx            # トップページ（CPU戦／対人戦選択）
    │       │   ├── RuleSettingsPage.tsx   # ルール設定画面
    │       │   ├── GamePage.tsx           # CPU対局画面
    │       │   ├── LobbyPage.tsx          # 対人戦ロビー（ルーム作成／参加）
    │       │   ├── RoomPage.tsx           # ルーム待機画面
    │       │   ├── OnlineGamePage.tsx     # 対人戦対局画面
    │       │   └── ResultPage.tsx         # 対局結果画面
    │       ├── pixi/                      # Pixi.js 盤面レンダリング
    │       │   ├── layout.ts              #   レイアウト計算（動的 boardSize 対応）
    │       │   ├── tiles/
    │       │   │   ├── constants.ts       #     牌サイズ定数
    │       │   │   ├── flatTile.ts        #     2D牌スプライト生成
    │       │   │   └── tileAssets.ts      #     SVG 牌画像アセット管理
    │       │   └── renderers/
    │       │       ├── handRenderer.ts    #     手牌レンダラー
    │       │       ├── discardRenderer.ts #     捨て牌レンダラー
    │       │       └── meldRenderer.ts    #     副露レンダラー
    │       └── components/
    │           ├── tile/
    │           │   ├── TileView.tsx    # 牌コンポーネント（rotation prop で回転対応）
    │           │   ├── TileFace.tsx    # 牌の表面 SVG
    │           │   ├── TileBack.tsx    # 牌の裏面 SVG
    │           │   └── suits/         # 牌種別 SVG コンポーネント
    │           ├── board/
    │           │   ├── PixiGameBoard.tsx   # ★ メイン盤面（Pixi.js Canvas、動的サイズ）
    │           │   ├── PixiInfoPanel.tsx   # Pixi.js 中央情報パネル
    │           │   ├── GameBoard.tsx       # React 版盤面（フォールバック）
    │           │   ├── PlayerHand.tsx      # 手牌表示
    │           │   ├── DiscardArea.tsx     # 捨て牌エリア
    │           │   ├── MeldDisplay.tsx     # 副露表示
    │           │   └── InfoPanel.tsx       # React 版情報パネル
    │           ├── action/
    │           │   └── ActionButtons.tsx   # アクションボタン（ポン・チー・リーチ等）
    │           ├── debug/
    │           │   └── DebugPanel.tsx      # デバッグパネル
    │           └── overlay/
    │               └── RoundResultOverlay.tsx  # 局結果画面（役名日本語表示・ドラ数表示）
    │
    └── server/                    # バックエンド — Fastify + Socket.IO サーバー
        ├── package.json
        ├── tsconfig.json
        ├── prisma.config.ts       # Prisma 設定（datasource URL）
        ├── .env.example           # 環境変数テンプレート
        ├── prisma/
        │   ├── schema.prisma      # DB スキーマ（PostgreSQL、5モデル）
        │   └── migrations/        # Prisma マイグレーション
        └── src/
            ├── index.ts           # サーバーエントリーポイント
            ├── app.ts             # Fastify アプリケーション構成
            ├── config.ts          # 環境変数から設定読み込み
            ├── plugins/
            │   ├── prisma.ts      #   Prisma クライアント（PrismaPg アダプター）
            │   └── auth.ts        #   Firebase Authentication 検証
            ├── routes/
            │   ├── auth.ts        #   認証 API ルート
            │   ├── rooms.ts       #   ルーム管理 API ルート
            │   └── stats.ts       #   戦績 API ルート
            ├── services/
            │   ├── authService.ts  #   認証ビジネスロジック
            │   ├── roomService.ts  #   ルーム CRUD
            │   └── statsService.ts #   戦績集計
            ├── game/
            │   └── GameManager.ts  #   対局進行管理（サーバーサイド）
            └── ws/
                ├── index.ts        #   Socket.IO 初期化
                ├── lobby.ts        #   ロビー WebSocket ハンドラー
                └── game.ts         #   対局中 WebSocket ハンドラー
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

### client パッケージの実装メモ

以下は client パッケージ実装時に特筆すべき設計判断・注意点である。

#### 盤面レンダリング（Pixi.js）
- 盤面描画は **Pixi.js v8** を使用した 2D フラットレンダリングが主である。`PixiGameBoard.tsx` がメインの盤面コンポーネント。
- `useBoardSize()` フックで `window.innerHeight` に追従する動的サイズを実現。Canvas サイズは正方形（`boardSize × boardSize`）。
- `layout.ts` の `calculateBoardLayout(boardSize)` でレイアウトを計算。`totalCoeff = 10` で牌やパネルのサイズ比率を制御。
- 牌画像は SVG ファイルを Pixi.js テクスチャとして読み込み、スプライトとして描画。
- React 版の盤面コンポーネント（`GameBoard.tsx` 等）はフォールバックとして残存。

#### 捨て牌の表示（DiscardArea）
- 4方向の捨て牌は CSS `transform: rotate()` ではなく **flexbox の方向制御**（`flow` prop: right/left/up/down）で配置する。CSS rotation は親のレイアウトボックスに影響しないため `overflow: hidden` によるクリッピングが効かない。
- 各プレイヤーの牌の向き（牌面の回転）は `tileRotation` prop（0/90/180/270）で TileView に渡す。自家=0°, 下家=270°, 対面=180°, 上家=90°。
- リーチ宣言牌の横倒しは `tileRotation` の逆方向（`(360 - tileRotation) % 360`）を使い、どの方向でも正しい向きに横になる。

#### TileView の回転
- `rotation` prop で牌を回転させる際、width/height のスワップではなく **margin 補正方式**を使用する。90°/270° 回転時はマイナスマージンで配置を補正 (`margin: ${-diff}px ${diff}px`)。これにより SVG のアスペクト比が崩れず、牌のサイズが均一になる。

#### 副露の表示（MeldDisplay）
- 鳴き元の相対位置（上家/対面/下家）に基づいて横倒し牌の位置を変える。viewConverter の `toMeldView` で `fromPlayerIndex` から相対位置を算出し、牌の並び順を再構成する。
  - 上家（relative=3）: 横倒し牌を左端
  - 対面（relative=2）: 横倒し牌を真ん中（明槓は右から2番目）
  - 下家（relative=1）: 横倒し牌を右端

#### 盤面レイアウト（GameBoard）
- 中央エリアは **3×3 CSS Grid**（gridTemplateColumns/Rows: `100px 1fr 100px`）で構成。各捨て牌セルに `overflow-hidden` を設定し、牌がはみ出してもクリップされる。
- 自家の手牌行は `手牌 + ツモ牌領域 + 副露` を同一行に flex 配置。ツモ牌領域は常に確保し、手牌の左右位置がツモの有無で変わらないようにする。
- アクションボタン（ポン・チー・リーチ等）は手牌の上部に右寄せで配置する。

#### 局結果画面（RoundResultOverlay）
- 役名は domain の `Yaku` 定数を日本語名に変換する `YAKU_NAMES` マッピングで表示する。
- ドラ数は `judgeResult.totalHan` から `yakuList` の飜数合計を引いて算出し、1以上の場合に「ドラN」を末尾に付与する（ドラは yakuList には含まれず totalHan にのみ加算される仕様）。

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

- **環境変数**: `VITE_SERVER_URL` でバックエンド接続先を制御（ビルド時に埋め込み）
- **コード分割**: 自動的に最適化されるが、必要に応じて手動設定
- **アセット最適化**: SVG 牌画像を含むアセットの最適化

### AWS デプロイ構成

| コンポーネント | AWS サービス | 備考 |
|---|---|---|
| フロントエンド | S3 + CloudFront | `mahjong.minatoproject.com`（独自ドメイン） |
| バックエンド | App Runner | ECR から Docker イメージをデプロイ |
| データベース | RDS PostgreSQL | t4g.micro |
| コンテナレジストリ | ECR | `mahjong-web-server` リポジトリ |

### デプロイ手順

1. **Docker イメージビルド＆プッシュ**: `docker build --platform linux/amd64 -t mahjong-web-server .` → ECR へ push
2. **App Runner 更新**: 新しいイメージで自動またはマニュアルデプロイ
3. **フロントエンドビルド**: `VITE_SERVER_URL=https://<APP_RUNNER_URL> npm run build --workspace=packages/client`
4. **S3 同期**: `aws s3 sync packages/client/dist/ s3://<BUCKET_NAME>/ --delete`
5. **CloudFront 無効化**: `aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"`

### CI/CD (GitHub Actions)

- **PR チェック**: リント、型チェック、テスト実行
- **自動デプロイ**: main ブランチへのマージで本番デプロイ（予定）

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
