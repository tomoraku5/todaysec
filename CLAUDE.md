# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 📌 **「なぜそうなっているか」の判断記録は [`docs/decisions.md`](docs/decisions.md) にある。**
> このファイルは**今どうなっているか**、`decisions.md` は**なぜそう決めたか・何を却下したか・
> どうなったら覆るか**を扱う。現状の記述に納得がいかないとき、または方針を変えようとするときは、
> 先に `decisions.md` の該当項目（特に「再検討すべき条件」）を読むこと。

## 作業依頼の標準ルール（毎回の依頼に暗黙で含まれる前提）

> **このリポジトリでの作業は、依頼文に書かれていなくても以下をすべて満たすこと。**
> 依頼者は毎回同じ制約を書く手間を省くためにここへ集約した。「〇〇を追加して」の一行だけの
> 依頼でも、この節の内容が指示されたものとして扱う。

⚠️ **このルールは記述時点の方針を反映したものであり、永久に正しいとは限らない。**
方針を変更する作業をしたときは、**この節の該当箇所も同じコミットで更新すること**。
**ルールと実態が食い違っていることに気づいたら、そのまま従わず作業を止めて依頼者に報告する。**

- 実際に起きた例: `translate` を有効化したあとも、チェックリスト項目6の記述が
  **「記事系なら追加（翻訳は現在無効だが、有効化したときに要約対象になる）」のまま**残っていた
  （`7b0cca5` で追加 → `2175272` で修正されるまで）。有効化後にこれへ素直に従うと
  `summarizeSources` に日本語ソースを足してしまい、**日本語記事まで3行要約の対象になって
  トークン消費が約16倍**になるところだった。
- 手順書は従うためのものだが、**古い前提のまま盲従すると事故る**。この節も、下の
  「ソースを追加・削除するときのチェックリスト」も、**書かれた時点のスナップショット**として読む。

### 1. 進め方

- **依頼者は開発未経験。** 変更内容と「なぜそうするのか」を**日本語で説明しながら**進める。
  専門用語をそのまま置かず、何が起きるのかを一言添える。
- **方針判断が必要な場面（採否・トレードオフ）では実装前に一度止まる。** 選択肢と
  それぞれの**実装規模**を示して承認を求めること。勝手に決めて進めない。
- **コミットは意味のある単位に分ける**（後から `git revert` しやすくするため）。
  形式は Conventional Commits。
- **`git push` は絶対にしない。** 依頼者が差分を確認してから自分で push する。
  コミットまでが作業範囲。

### 2. 触ってはいけないもの（明示的な指示がない限り）

| 対象 | 理由 |
| --- | --- |
| `src/data/feed.json` を**コミットしない** | cron が6時間ごとに更新するため競合する。動作確認で `npm run aggregate` するのは構わないが、**確認後は `git checkout -- src/data/feed.json` で破棄する** |
| `translate` の設定（`summarizeSources: []` / `disabled: false`） | `summarizeSources` に追加すると**日本語記事も要約対象**になり、入力が記事本文になるため**トークン消費が約16倍**になる（詳細はチェックリスト項目6） |
| `x` ソース（`disabled: true` で温存中） | 削除しない。フラグを戻せば復活する状態を維持する |
| `SHOW_LANG_FILTER_CHIP = false`（`src/components/SourceFilter.astro`） | 「日本語」フィルタチップの非表示フラグ。実装ごと残してある（詳細は「重要な制約・gotcha」） |
| サイト名（`today.security`）・ロゴ色（エメラルド `#0f9b6c`） | ロゴ色は `--color-logo` 系のみ。サイト全体のアクセント（コバルト）とは別系統 |
| `.env` / `.env.example` | **依頼者の権限設定で書き込みが拒否される。** 修正が必要な場合は勝手に試さず、**依頼者に内容を伝えて手作業で対応してもらう** |

### 3. 後片付け

- **`npm run dev` で確認したら必ず開発サーバーを停止する。**
  esbuild の脆弱性が**開発サーバー実行中のみ**影響するため。過去に停止し忘れて
  **複数ポートに開発サーバーが溜まる問題が実際に起きている**。

### 4. 検証の標準セット（完了報告の前に通す）

```bash
npm run typecheck   # 型エラー 0。scripts/ はここでしか検査されない
npm run build       # 本番ビルド
npm run aggregate   # 収集に関わる変更のときだけ。ソース別件数を報告する
npm run dev         # 表示確認（レイアウト崩れ・コンソールエラー）→ 確認後に停止
```

- ソースの追加・削除・復活の場合は、これに加えて
  **「ソースを追加・削除するときのチェックリスト」を最初から最後まで通す**（後述）。
  特に「3. 手で更新が必要なもの」（README.md / CLAUDE.md / OGP 画像）は自動追従しない。

### 5. 報告に含めること

- **変更したファイルと理由の対応**（どのファイルを、なぜ触ったか）
- **依頼者が確認すべきこと**（目視すべき画面、push 前に見ておくべき差分）
- 検証の**実際の結果**（通っていないものは通っていないと書く）
- **チェックリストや既存ドキュメントに不備を見つけたら指摘する。**
  過去3回、この指摘で実害を防げている。黙って直すのではなく、まず指摘すること。

## What this is

**today.security** — セキュリティ関連情報を公開 RSS から自動集約し、時系列タイムラインで表示する
Astro 5 + Tailwind v4 の静的サイト（GitHub Pages、base path `/todaysec`）。
公開 URL: `https://tomoraku5.github.io/todaysec/`

- **リポジトリ**: `tomoraku5/todaysec`（Public）
- **フォーク元**: `satory074/todayai`（AI 情報の集約サイト）。本リポジトリはそれをベースに
  セキュリティ情報向けへ改造したもの。**以下のドキュメントには todayai 時代の設計判断・障害記録が
  そのまま残っている**（将来の復活に備えて意図的に保持。無効化した箇所には「現在は無効」と明記する）。
- **費用は完全に 0 円**。記事の取得は公開 RSS と Qiita API v2 のみ（いずれもトークン不要）。
  Gemini は**無料枠の範囲で翻訳にだけ使う**（英語ソースのみ・1日4〜6リクエスト程度）。
  X API / Gmail API は使わない。
- **位置づけ**: 運用者は開発未経験。**個人の学習目的**のサイトであり、特定の組織を代表するものではない。

### 現在有効なソース

> **この表が「今どのソースを集めているか」の記述上の正**（実装上の正は `src/lib/feed.ts` の
> `SOURCES` 配列と `feeds.config.ts` の `disabled`）。**件数はあえて書かない**＝
> 数字を書くと追加のたびに更新漏れが起きるため（実際に4回起きた）。

| source | 内容 | 取得元 |
| --- | --- | --- |
| `qiita` | Qiita「Security」タグ・「認証」タグ | **Qiita API v2**（`api.qiita.com` ではなく `qiita.com/api/v2`・**認証不要**）。⚠️ このソースだけ RSS ではない（理由は後述「ソース別の要点」）。RSS は失敗時のフォールバックとして残してある |
| `zenn` | Zenn「security」トピック | 公開 RSS（トークン不要） |
| `hatenablog` | セキュリティ専門のはてなブログ3本（piyolog / Fox on Security / GMO Flatt Security） | 公開 Atom（複数 URL・トークン不要） |
| `cloudnative` | CloudNative BLOGs（クラウドネイティブ社）の**「セキュリティ」カテゴリのみ** | 公開 RSS（全体フィード1本・トークン不要）＋ **`<category>` による絞り込み**。⚠️ カテゴリ別フィードは存在しない（後述） |
| `thehackernews` | The Hacker News（**英語**）の脆弱性・インシデント速報 | 公開 RSS（FeedBurner・トークン不要） |
| `darkreading` | Dark Reading（**英語**）のセキュリティ解説・分析 | 公開 RSS（全体フィード1本・トークン不要） |
| `bleepingcomputer` | BleepingComputer（**英語**）の脆弱性・マルウェア速報 | 公開 RSS（全体フィード1本・トークン不要） |
| `theregister` | The Register（**英語**）セキュリティセクションの報道・分析 | 公開 Atom（**セクション限定**・トークン不要） |
| `hackread` | HackRead（**英語**）のセキュリティニュース。⚠️ PR配信・SEO記事が混ざる | 公開 RSS（トークン不要） |

⚠️ 「はてなブログ」は**はてなブックマークとは別サービス**。かつて `hatena`（はてブ人気エントリー）枠もあったが削除済み（後述の「削除したソース」参照）。

### 現在無効なソース・機能

`feeds.config.ts` の `disabled: true` で停止中。**コードもドキュメントも削除していない**
（将来復活させる可能性があり、過去の障害と対処の記録として価値があるため）。

| 対象 | 停止した理由 |
| --- | --- |
| `x` | `sourceUrl` がフォーク元作者（basecamp）の公開ブックマーク JSON。X API も有料のため使わない。`x.accounts` は空配列にしてある |
| GCS 保管モード | **未使用**。feed.json は git 保管（ローカルモード）で運用。詳細は `docs/gcs-storage-setup.md` |

**x は「削除」ではなく「温存」**（`disabled: true`）。実装・型・設定を残してあるので、
フラグを戻せば復活する。
（`translate` は**有効化済み**。ただし `summarizeSources` は空＝英語記事の翻訳だけ行い、
3行要約はしない。詳細は `feeds.config.ts` のコメント参照。）

### 削除したソース（履歴）

以下4ソースはセキュリティ用途に合わないため **コードごと削除済み**。
**削除コミットは `0e43fa2`**。実装・設計の詳細はその直前のコミットから読める
（`git show 0e43fa2^:scripts/sources/<name>.ts`。`0e43fa2^` = `c5c9547`）。
⚠️ `git show c5c9547` 単体は**OGP 画像の再生成コミット**なので、削除差分を見るなら `git show 0e43fa2`。
要点だけ残す:

| 削除ソース | 残す価値のある要点 |
| --- | --- |
| `hatena`（はてなブックマーク） | 人気エントリー RSS は**「今まさに人気の約30件」しか返さない**。フレッシュ取得分だけだとランキングから外れた記事が消えるため、**前回分を土台に蓄積する設計が必須**だった。この蓄積方式は今も全ソース共通の仕組みとして残っている |
| `layerx` | Substack の公開 RSS が invite-only で取得不可 → 毎週届くメールを **Gmail REST API**（`GMAIL_CLIENT_ID`/`_SECRET`/`_REFRESH_TOKEN`、scope `gmail.readonly`）で読み、本文の各トピックリンクを1アイテム化していた。OAuth のリフレッシュトークンは失効しうる運用コストがあった |
| `workspace` | Google Workspace Updates ブログ（Blogger Atom）。`?redirect=false` を付けないと FeedBurner（http）へ 302 する落とし穴があった |
| `gcloud` | Google Cloud リリースノート Atom。**1エントリ＝1日**でタイトルが日付だけ・本文に全製品の更新がまとまるため、専用パーサで製品名を抽出して見出しにしていた |

### ノイズを承知の上で採用したソース

**HackRead**（`hackread.com/feed/`）は、調査時に一度**見送った**あと、方針を変えて採用した。
経緯と実測値を残す（除外の是非を後で判断するための材料）。

- **実測されたノイズ**: 取得10件のうち**セキュリティ報道は4件程度**。残りは
  「Top 10 Companies to Hire Power BI Developers in 2026」「Top 7 Enterprise IT Asset
  Management Software for 2027」のような**セキュリティ無関係の SEO 記事**と、
  著者 `dc:creator` が **`CyberNewswire`（プレスリリース転載）** の広報記事。
- **一度見送った理由**: 「件数を増やす」より「探すコストを上げない」を優先したため。
- **採用に転じた理由**: 除外が本当に必要か・どの条件が適切かは、**実際に1週間ほど運用して
  実態を見てから判断する**方針にした。ノイズを含んだまま入れて様子を見る。
- **⚠️ 除外の仕組みは意図的に作っていない。** 実装するときの候補は2つ:
  1. `dc:creator` が `CyberNewswire` のものを除外（PR記事はこれでほぼ落ちる）
  2. `categories` フィールドによる除外（フィードが categories を持つので技術的に可能）
  どちらも `rss.ts` に「ソースごとの除外条件」を持たせる仕組みが必要で、**別作業**とする。
- フィードは10件しか返さず、実測 5.6件/日 なので**約1.8日分**しか遡れない＝
  BleepingComputer（約2.4日分）と並んで**取りこぼしリスクが最も高い部類**
  （ソース別の一覧は後述「フィードから何日分遡れるか」の表）。
- ⚠️ **現在フィードが `Status code 403` で取得できていない**（Cloudflare の判定変動と見られる。
  前日は同じ UA で 10 件取得できていた）。**`disabled` にせず、回避も調査もしない方針**
  ＝自然復旧の可能性があり、過去28件は保持されていて実害が限定的なため
  （判断と再検討条件は `docs/decisions.md` 項目22）。**復旧すれば自動で取得が再開する。**
  ⚠️ `feeds.config.ts` の「フィードは UA を問わず 200」というコメントは**この 403 と矛盾している**
  （403 はローカル実行で観測。CI でも起きているかは run ログ未確認）。

### フィードから何日分遡れるか（＝CI が止まったときの取りこぼしリスク）

> **なぜこれがあるか**: Qiita が**投稿の 47% を静かに失っていた**のに、誰も気づかないまま
> 数週間運用されていた。サイトは正常に見え、CI も緑で、**エラーもログも何も出ない**。
> 「フィードが何件返すか ÷ 1日の投稿件数」を把握していれば机上で気づけた。
> ⚠️ **各ソースの節に散らばっていた数字をここに集約している**（重複させない）。

**「遡れる日数」が cron 間隔（6時間＝0.25日）を大きく上回っていれば安全**。
下回ると毎 run 取りこぼす（＝Qiita で起きたこと）。実測値:

| source | フィード/API の返却件数 | 実測ペース | 遡れる日数 | 判定 |
| --- | --- | --- | --- | --- |
| `qiita`（security） | **API 50件**（旧 RSS は4件） | 14〜23件/日 | **約2.2日**（旧 RSS は約0.14日＝3.3時間） | ✅ API 化で解決 |
| `qiita`（認証） | **API 20件**（旧 RSS は4件） | 1.6件/日 | 約17日 | ✅ |
| `zenn` | 20件 | 12.7件/日 | 1.5日（＋CDN の12時間遅延） | ○ 損失0・遅延あり |
| `hatenablog`（piyolog） | 30件 | 0.1件/日 | 約240日 | ◎ |
| `hatenablog`（Fox） | 30件 | 1.0件/日 | 約29日 | ◎ |
| `hatenablog`（GMO Flatt） | 30件 | 0.1件/日 | 約435日 | ◎ |
| `cloudnative` | 50件（絞り込み後16件） | 0.55件/日（全体 1.70件/日） | **約29日** | ◎ 最も余裕がある |
| `thehackernews` | 50件 | 8.2件/日 | 6.1日 | ◎ |
| `darkreading` | 50件 | 3.7件/日 | 13.5日 | ◎ |
| `theregister` | 50件 | 3.6件/日 | 13.7日 | ◎ |
| `bleepingcomputer` | 15件 | 6.3件/日 | **2.4日** | ⚠️ 余裕が薄い |
| `hackread` | 10件 | 5.6件/日 | **1.8日** | ⚠️ **最も薄い** |

- ⚠️ **BleepingComputer（2.4日）と HackRead（1.8日）は、CI が2日止まると記事が消える。**
  どちらもフィードの件数が少なく**設定では増やせない**（`limit` を上げても相手が返さない）＝
  対策は cron 短縮しかない。**現状は cron 6時間のまま許容している。**
- **数字を更新するとき**: フィードの返却件数と最古のエントリの日付から計算する
  （`件数 ÷ ((now - 最古) を日数換算)` がペース）。**ソースを追加したらこの表に行を足す**
  （チェックリストの「3. 手で更新が必要なもの」に入れてある）。
- ⚠️ **「1日あたりの投稿件数」は季節変動する。** Qiita Security タグは調査時点で
  日別 9〜29件とばらついた。**余裕が2倍を切っているソースは定期的に見直す。**

## Commands

```bash
npm install
npm run aggregate   # 有効なソースを取得 → src/data/feed.json を再生成（disabled のソースはスキップ）
npm run dev         # http://localhost:4321/todaysec/（feed.json をそのまま表示。集約はしない）
npm run build       # 本番ビルド。Astro グラフの型チェック込み
npm run typecheck   # astro check。tsconfig が **/* を含むので scripts/ も型検査される
npm run enrich:xlinks           # X 項目の t.co をリンクプレビュー（OGP カード）に補完（他ソース非取得・トークン不要。後述）
npm run enrich:xlinks -- --fresh  # 負キャッシュ（null）を一掃して未補完分を再試行

npm run backfill:qiita -- --since 2026-07-31   # Qiita の取りこぼしを API 履歴から復元（既定は dry-run）
                                               # ⚠️ 現在は使わない方針（docs/decisions.md 項目21）。
                                               #    --since は必須。既定値にしてよい値は無い（項目21 の罠を読む）

npx tsx scripts/generateOgImage.ts  # OGP 画像 public/og-default.png を再生成（後述）
```

- **テストフレームワークは無い。** 検証は `npm run build` / `npm run typecheck` と、`npm run aggregate` の実行ログ（`✅ feed.json 更新: 計N件 (X=.. / Zenn=.. / Qiita=.. / はてなブログ=..)`）で行う。
- **型チェックの落とし穴**: `npm run build` は Astro が import するファイルしか型検査しない。`scripts/aggregate.ts` と `scripts/sources/*` は Astro グラフ外なので、scripts を変更したら **`npm run typecheck`（astro check）で確認する**こと（tsconfig の `include: ["**/*"]` が拾う）。scripts は `tsx` で実行され、tsx は型を消すだけで検査しない。
- **記事の取得にトークンは不要**（公開 RSS と、Qiita だけ認証不要の Qiita API v2）。**翻訳だけ `GEMINI_API_KEY` を使うが、これは GitHub Secrets にのみ置く方針**＝**ローカルに `.env` を作らない**（Public リポジトリでの誤コミットを構造的に排除するため。`docs/decisions.md` 項目6）。ローカルの `npm run aggregate` はキーが無いまま動き、**翻訳だけがスキップされる**（`state.translations` から既存分は再適用されるのでデータは壊れない）。温存している X をローカルで試す場合の `X_BEARER_TOKEN` も同様に常設しない。

## フォーク元（satory074/todayai）からの変更点

→ [`docs/fork-changes.md`](docs/fork-changes.md) に移した（常時ロードから外すため）。
**フォーク元の URL やアカウント名がハードコードされている箇所が複数あった**ので、
同種の残骸を見つけたら同じ方針（自分のリポジトリを指すよう修正）で直すこと。

- **cron の扱い**: 改造中は feed.json が AI 記事で埋め戻されるのを防ぐため一時停止していたが、
  **現在は再有効化済み**（`.github/workflows/update-and-deploy.yml` の `schedule`、6時間ごと）。
- **`src/data/feed.json` は一度リセット済み**（AI 時代の蓄積 1206 件 → 0 件）。全ソースが前回分を土台に
  蓄積する設計なので、`disabled` にするだけでは過去のアイテムが残り続けるため。

## Architecture（大きな流れ）

**2フェーズ構成。ビルド時集約と実行時表示が分離している。**

> **現状との差分**: 以下はフォーク元（todayai）7 ソース時代の記述で、ソース名の例が古い。**仕組み（2フェーズ構成・マージ・トリム・補完）は現在もそのまま有効**。現在有効なソースは冒頭の「現在有効なソース」表（8ソース）が正。

1. **集約（Node/tsx、ビルド前）**: GitHub Actions の cron（6時間ごと、`.github/workflows/update-and-deploy.yml`）が `scripts/aggregate.ts` を実行。7ソースを `FeedItem` に正規化 → 既存 feed.json とマージ → id で重複排除 → publishedAt 降順ソート → **ソース別 `retentionMax` でトリム**（後述の全期間アーカイブ）→ **トリム後の最終アイテムに OGP サムネ補完 → 機械翻訳で日本語補完（いずれも後述）** → feed.json を上書き。
2. **表示（Astro、完全静的）**: `src/pages/index.astro`（と `rss.xml.ts`）が **ビルド時に** feed.json を読み込んで描画する。サイトは**実行時には**一切フェッチしない（SSG）。feed.json がレンダリングの単一の真実。

**feed.json の保管先（`src/lib/feedStore.ts` 読み / `scripts/lib/feedWrite.ts` 書き）**: `GCS_BUCKET` 環境変数で2モードを透過切替（basecamp の `feed-storage.ts` と同方式）。
**【現在はローカルモード】** リポジトリ変数 `GCS_BUCKET` を設定していないため、常に下の「ローカルモード」で動く。GCS モードの記述は将来使う可能性があるため残す（セットアップ手順は `docs/gcs-storage-setup.md`。ただし手順内の GCP プロジェクト名・バケット名はフォーク元のもの＝流用するなら自分の環境で作り直すこと）。
- **ローカルモード（`GCS_BUCKET` 未設定・既定/開発）**: `src/data/feed.json` を fs で読み書き。従来どおり CI（feed-bot）が main にコミット。
- **GCS モード（`GCS_BUCKET` 設定）**: feed.json は **GCS（`gs://<bucket>/feed.json`）が正本**。集約は GCS の public URL を読んでマージ→**ローカルに書き**、ワークフローが **`gcloud storage cp` で GCS へアップロード**（runner プリインストールの gcloud＋`google-github-actions/auth` の WIF。**@google-cloud/storage SDK は使わない**＝SDK の WIF→STS トークン交換が CI の node-fetch で `ERR_STREAM_PREMATURE_CLOSE` するため）。**git にはコミットしない**（6時間ごとのコミットループが消える＝履歴を git の外で全期間保持）。ビルドは GCS の public URL を fetch（読みは認証不要）。`src/data/feed.json`（committed）は GCS 404/障害時の**フォールバック種**として残す。`readFeed` は書き込み直後の読みで `?t=$GITHUB_RUN_ID` を付けて古いエッジキャッシュ（`Cache-Control: max-age=300`）を回避。**ワークフローは全 GCS ステップを `vars.GCS_BUCKET` でゲート**＝リポジトリ変数 `GCS_BUCKET`/`GCP_WIF_PROVIDER`/`GCP_SERVICE_ACCOUNT` を設定するまで現状（ローカルモード）のまま。

**保持ポリシー（全期間アーカイブ・ソース別枠）**: **全ソースがブロック先頭で `cachedFor(cache, source)` を無条件に積んで前回分を土台に蓄積**し、取得できた新着を追記 → dedup（id）で集約する。取得窓が狭い RSS（Zenn/Qiita は `limit:20`）でも過去分が失われない。**年齢トリム（旧 `maxAgeDays`）は廃止**し、各ソースの `retentionMax`（`feeds.config.ts`。newest を残す件数上限）が唯一の上限＝**ソース別枠なので物量の多いソースが他ソースを押し出さない**。トリム区間（`aggregate.ts` 末尾）は items をソース別バケットに分けて各 `slice(0, retentionMax)`（`retentionMaxFor()` ヘルパー）→ 再統合。**X も全キャッシュ保持でアーカイブ化**（旧来のブックマーク毎回フレッシュ置換＝上流削除分の purge は廃止）。

**graceful degradation**: 各ソースは `aggregate.ts` 内で個別 try/catch。失敗 or トークン未設定でも、先頭で積んだ前回キャッシュ分がそのまま残り、他ソースだけ更新される。1ソースが落ちても run 全体は成功する。

**`feed.json` の `state`**: run をまたいで持ち越す状態。X 外部アカウントの `since_id`（重複課金回避）、`userIds` キャッシュ、`xOgImages`（X由来 OGP画像の解決キャッシュ）、`xAuthors`（X item id→`{name,handle,avatar?}` の著者解決キャッシュ。`null`＝確認済み著者なしの負キャッシュ。fetch 失敗時は記録せず次回再試行）、`ogImages`（X以外 OGP画像の解決キャッシュ。`""`＝確認済み画像なしの負キャッシュ含む）、`xLinkCards`（X item id→リンクプレビューカード `{url,title?,description?,image?,domain}` / `null`＝確認済み・カードなしの負キャッシュ。t.co 先の OGP 解決結果。後述）、`translations`（id→`{titleJa?, summaryJa?, linkTitleJa?, linkDescJa?}` の翻訳/要約キャッシュ。`linkTitleJa`/`linkDescJa` は linkPreview の翻訳。毎回フレッシュ取得されるソースでも再生成しないための永続化）、`enrichVersion`（translations の生成ロジック版。`aggregate.ts` の `ENRICH_VERSION` と不一致なら旧キャッシュを破棄して作り直す＝プロンプト/挙動変更を即反映）。

**OGP サムネ補完（記事系: `scripts/sources/enrichArticles.ts`）**: `feed.json` 全体でサムネ付きは少数のため、トリム後の最終アイテムのうち**サムネが無いもの**を、記事 URL から og:image を `resolveOgImage()`（`scripts/sources/ogp.ts` を再利用、リダイレクト follow 済み）で解決して補完する。`state.ogImages` で既知分は再取得せず（負キャッシュ込み）、実行後に現存 id 分だけへ prune。**X は basecamp 公開JSON 経由で `xOgImages` により補完済み**なので対象外。記事系（`zenn`/`qiita`/`hatenablog`）は**上限なし**（少量）。並列プールは `scripts/sources/util.ts` の `mapLimit`（x.ts と共有）。


**【現在は無効（X ソース停止中のため実質no-op）】X リンクプレビュー（`scripts/sources/xLinkCard.ts` の `enrichXLinks`）**: 本文が t.co リンクだけ / 末尾リンクの X ツイートに、リンク先の OGP カード（画像＋タイトル＋説明＋ドメイン）を `item.linkPreview` として補完する。**なぜ必要か**: 外部アカウント（`x.accounts`）は X API 経路（`fetchXAccounts`）で取得され、これは**添付メディアのサムネしか拾わず t.co を一切解決しない**＝link-card ツイートは無プレビューだった。そこで**両経路（fetchX / fetchXAccounts）の X 項目を横断**して補完する（enrichArticles と同じ「state 永続キャッシュ＋毎回再適用＋トリム後対象＋未確認のみ取得＋maxNew 段階補完＋prune」パターン。負キャッシュ=`null`）。解決は `resolveThumb` と同じ**ハイブリッド**: t.co を `resolvePage` で追跡し、**①最終URLが x.com/status → syndication でツイートのメディア画像＋本文（title）＋著者（description）**、**②外部サイト → `extractOgImage`/`extractOgTitle`/`extractOgDescription`**（`ogp.ts` に title/description 抽出を追加。`<title>` フォールバック込み）。**CI（datacenter IP）でも多くの外部サイトが解決できる** → `aggregate.ts` は既定で走らせる（`X_LINK_MAX_NEW` 既定40/run・env で上書き可）。Cloudflare 等で 403 になる分は負キャッシュ＋再適用で吸収し、`npm run enrich:xlinks`（`scripts/enrichXLinksLocal.ts`・residential IP・トークン不要）でバックフィルできる（`--fresh` で負キャッシュ一掃）。表示は `TweetCard.astro` が入れ子 `<a>`（`z-30`＞カード全面オーバーレイ `z-20`）でカードを描画＝カードのタップは**リンク先へ**、カード外はツイートへ遷移。本文からは t.co を落として生 URL を隠す（空になれば本文非表示）。title/description は translate ステップで日本語補完（`linkPreview.titleJa`/`descriptionJa`・`BilingualText` で日本語/原文トグル対応）。

**【現在は有効。ただし `summarizeSources` が空なので「3行要約」ではなく「非日本語のみ翻訳」】機械翻訳／要約で日本語補完（`scripts/sources/translate.ts` の `enrichTranslations`）**: `enrichArticles.ts` と同じ「state 永続キャッシュ＋毎回再適用＋トリム後対象」パターン。Gemini REST API（`generateContent`、`fetch` のみで依存追加なし）で **`titleJa` と `summaryJa` を1回のバッチ呼び出しで同時補完**する。`titleJa`=title が非日本語なら翻訳（日本語ならスキップ／空文字）。`summaryJa` は**ソースで分岐**: `feeds.config.ts` の `translate.summarizeSources`（**現在は空**）＆ summary が `summaryMinLen`（既定40字）以上のものは**原文の言語を問わず3行要約**（朝刊カードの概要が読みやすくなる。日本語記事も要約対象）、それ以外（X 等）は従来どおり summary を翻訳（非日本語のみ）。**X の `linkPreview`（リンクカード）がある項目は title/description も同じバッチで翻訳**し `linkPreview.titleJa`/`descriptionJa` に載せる（linkPreview は maxNew で本文と別ライフサイクルなので、cached があっても未翻訳の link だけ都度再翻訳＝キャッシュはマージ更新）。バッチ入力に per-entry `summarize` フラグを載せ1プロンプトで分岐。日本語判定は `isJapanese()`。`translate.batchSize` ごとに1回 API 呼び出し（`responseSchema` で JSON 配列を堅牢に受け取る）、`mapLimit` で `translate.concurrency` 並列。バッチ失敗（network/parse/件数不一致）はそのバッチをスキップし次回 run で再試行。結果は `state.translations` に保存し実行後に現存 id 分だけへ prune。**`GEMINI_API_KEY` 未設定なら丸ごとスキップ＝カードは原文のまま（graceful degradation）。** 毎回フレッシュ取得されるソースが `titleJa`/`summaryJa` を失っても `state.translations` から再適用するので再生成しない。**生成ロジック（プロンプト・翻訳↔要約の切替）を変えたら `aggregate.ts` の `ENRICH_VERSION` を上げる**＝`state.enrichVersion` と不一致なら旧キャッシュを破棄して即作り直す（アイテムが `retentionMax` で自然に入れ替わるのを待たない）。表示は `BilingualText.astro` がそのまま機能し、日本語＝AI要約 / 原文＝元の抜粋、として出し分く。

### ソースの登録は `src/lib/feed.ts` の `FeedSource` 型 + `SOURCES` 配列が中心レジストリ

`SOURCES` が「今どのソースを集めているか」の唯一の正。画面の説明文・フィルタ・about・RSS の
ソース名はすべてここから生成される。**具体的な手順は後述の「ソースを追加・削除するときの
チェックリスト」を参照。**

### ソース別の要点（なぜ普通の RSS じゃないか）

> **凡例**: 見出しの【現在は無効】は `feeds.config.ts` で `disabled: true` のソース。
> 記述は将来の復活・障害記録のため残してある。
> **有効なソースの一覧はここに列挙しない**（二重管理になり実際にズレたため）＝
> 冒頭の「現在有効なソース」表を見ること。

- **【現在は無効】X**: X API を**叩かない**。自分のデータは basecamp 公開 JSON（`storage.googleapis.com/basecamp-feeds/x-tweets.json`）を読むだけ（トークン・課金不要、basecamp の OAuth と競合しない）。`x.accounts` の外部アカウントのみ X API **App-only Bearer**（`X_BEARER_TOKEN`）+ `since_id` 増分。OGP サムネは `scripts/sources/ogp.ts` で解決し `state.xOgImages` にキャッシュ。**本文が t.co リンクのツイートはリンク先の OGP カードを `linkPreview` として補完**（`enrichXLinks`。両取得経路を横断。後述）。表示は `TweetCard.astro`（ツイート風＋リンクプレビューカード）。
  - **著者アイコン(avatar)/実名/@handle**: basecamp 公開JSON は元ツイートの著者を持たず `author` が `"ブックマーク"` 等の固定ラベルになる。これを **syndication（`scripts/sources/syndication.ts` の `fetchTweet`＝`cdn.syndication.twimg.com`・無料・トークン不要）** で解決し `FeedItem.avatarUrl`（`_400x400`化）/`authorName`/`author=@handle` を補完（`xOgImages` と同じ state永続キャッシュ＋毎回再適用＋新規は `authorMaxNew` 件/run の段階補完＋トリム後 prune パターン、`state.xAuthors`）。外部アカウントは X API の `expansions=author_id&user.fields=profile_image_url,name` で同様取得。`TweetCard.astro` は `avatarUrl` があれば丸枠に `<img>`（`onerror` でイニシャル/Xロゴへフォールバック）、無ければ従来の代替アイコン。**⚠️ syndication 直叩きは residential IP(ローカル)なら解決でき、CI(datacenter IP)では弱い可能性**（datacenter IP からの直叩きという制約。ただし 403 リスクは低い）。ローカル `npm run aggregate` で埋めた `state.xAuthors` は CI でも毎回再適用＝永続化される。
- **【有効】Zenn（`zenn.dev/topics/security/feed`）**: 公開 RSS を共有ヘルパー `scripts/sources/rss.ts` の `fetchRss({rssUrls, source, limit})` で直接取得（`rss-parser`、トークン不要）。`zenn.rssUrls`。
  **`rssUrls` は配列**＝1ソースに複数トピックを束ねられる（改造で `rssUrl` から拡張）。**URL ごとに個別 try/catch** するので1本が 404 等で落ちても残りは取り込まれる。全 URL が失敗しても throw せず、`aggregate.ts` がブロック先頭で積んだ前回キャッシュがそのまま残る。**`limit` は「1 URL あたり」**の取得窓（合計ではない）＝ URL を足しても既存フィードの取り込み量が痩せない。
  - ⚠️ **フィードは CDN で最大12時間キャッシュされる**（`Cache-Control: public, s-maxage=43200`。実測で `Age: 13712`＝3.8時間前の内容が返り、キャッシュバスター付きだと2.7時間新しい内容が返った）。**結果として掲載が最大12時間遅れる。** ただし20件の窓が約1.5日分あるため**記事の損失は 0%**（実測: 未取込9件はすべて直近12時間以内の投稿＝遅延であって損失ではない）。
  - **キャッシュバスター（`?_=<run id>`）は検討したうえで採用しなかった。** 解決するのは遅延だけ（損失は 0）なのに、Zenn 側の実装変更で空を返すようになったとき **run が緑のまま Zenn だけ静かに止まる**という壊れ方をする。判断の詳細は `docs/decisions.md` 項目20。**「遅れている」と気づいたときにこの節を読み直すこと**（不具合ではない）。
  - （履歴）todayai 時代は Zenn「AI」トピックだった。さらにその前の「Feedly」（AI 関連 RSS 8本まとめ集約）は廃止済み。
- **【有効】Qiita（`qiita.com/api/v2/tags/<tag>/items`）**: ⚠️ **記事系で唯一 RSS ではなく API を使う**（`scripts/sources/qiitaApi.ts`、認証不要・`fetch` のみで依存追加なし）。`qiita.apiTags`。**`aggregate.ts` の共通 RSS ループには含まれず、専用ブロックがある。**
  - ⚠️ **なぜ RSS をやめたか: Qiita のタグフィードは4件しか返さない。** タグを問わず固定（security / 認証 / python / aws / javascript すべて4件・3回連続取得でも4件）で、**`?page` / `?per_page` は無視される**。`feed.atom` 形式でも同じ。**したがって `limit: 20` は Qiita に対して一度も効いたことがない。**
  - **その結果 実測 47% を取りこぼしていた**（5.8日で132件中62件）。Security タグは 14〜23件/日 投稿されるので、4件の窓は**中央値 3.3 時間**しかなく、cron 6時間（実測 5.4〜7.1時間間隔）では毎 run 溢れていた。feed.json のコミット履歴でも**毎 run きっちり +4件**だった。⚠️ **投稿量が少ないタグでは問題が出ない**（認証タグは 1.6件/日＝4件で約2.5日分あり取りこぼし 0%）＝「Qiita は大丈夫」と誤認しやすい。
  - **cron 短縮では解決しない**（実測: 1時間間隔にしても4件窓を超過する区間が17%残る）。判断の経緯は `docs/decisions.md` 項目19。
  - **API 側の値**: 1リクエスト最大100件。`per_page` は security=50（約2.2日分・1.3MB）/ 認証=20（約17日分・0.8MB）にしてある。100件は 2.8MB になり Qiita 側への負荷が大きいので採らない。
  - **レート制限は 60回/時・IP 単位**（レスポンスヘッダ `Rate-Limit` / `Rate-Remaining`。aggregate のログに「レート残 54/60」の形で出る）。使うのは 1 run あたりタグ数（＝2回）だけ。⚠️ **CI は共有データセンター IP なので他の利用者と合算されて当たる可能性が残る** → 429/403 は**RSS 経路へフォールバック**する（＝失敗しても現状より悪くならない）。恒常化するなら **Qiita のアクセストークン（無料・1000回/時）を Secrets に追加**する。
  - ⚠️ **フォールバックが発動したら必ずログに出る**（`[qiita] ⚠️ RSS フォールバック発動: <理由>` ＋ 末尾の `⚠️ N 件のソースでエラー` にも積まれる）。**「常時フォールバックして実質何も改善していない」状態を見逃さないための仕掛けなので、この行が出ていたら原因を潰すまで放置しない。**
  - **API の一覧は created_at の厳密降順ではない**＝**後からタグを追加された過去記事も現れる**（実測: 最新300件中5件が `created_at` 数週間前 / `updated_at` 直近）。RSS では構造的に拾えなかった分。ただし `publishedAt` は元の投稿日なのでタイムラインの奥に入るだけで、トップには出ない（アーカイブの完全性が上がるだけ）。
  - **id は RSS 経路と同一形式（`qiita-<記事URL>`）**。ここを変えると RSS 時代の蓄積分とフォールバック取得分が別アイテム扱いになり全件二重になる。
  - **著者は投稿者（`@ユーザーID`）**。RSS 時代はフィード名（`Securityタグが付けられた新着記事 - Qiita`）で、2タグ取得しているのに常に「Securityタグ」と出ており不正確だった。⚠️ **RSS 時代に蓄積した過去分の `author` は古い文字列のまま残る**（dedup は `publishedAt` が同じなら既存を優先するため上書きされない）＝`retentionMax` で入れ替わるまで（**約50日**）表示が混在する。**不具合ではなく、直さない方針**（`docs/decisions.md` 項目21）。
  - ⚠️ **API 化より前に取りこぼした64件は復元していない**（`2026-07-31` 以降の欠落）。**復元手段は `npm run backfill:qiita` として残してあるが、現在は使わない方針**＝理由と再検討条件（検索機能を実装したとき）は `docs/decisions.md` 項目21。**⚠️ 使うときは `--since` の罠を必ず読むこと**（既定値にしてよい値が無い）。
  - サムネは **API にも RSS にも無い**＝`enrichArticles` の og:image 補完に依存する（Qiita は記事ごとに OGP 画像を自動生成するのでほぼ必ず解決する）。概要は `rendered_body`（HTML）からタグを落として200字＝`rss.ts` の `snippet()` と同じ仕様に揃えてあるので、フォールバック時も見た目が変わらない。
  - ⚠️ **日本語タグの扱い**: `apiTags` には生の日本語（`認証`）で書いてよい（`qiitaApi.ts` が `encodeURIComponent` する）。RSS フォールバック側も `rss.ts` の `toRequestUrl()` が WHATWG `URL` に通すので同様（生のまま Node の http クライアントに渡すと `Request path contains unescaped characters` で失敗する）。
  - （履歴）todayai 時代は Qiita「AI」タグを RSS で取得していた。API へ切り替えたのは上記の取りこぼし発覚後。
- **【有効】はてなブログ（`hatenablog`）**: セキュリティ専門のはてなブログの公開 Atom を、**Zenn と同じ `fetchRss`（`rssUrls` 配列）で取得**する（設定構造が同一なので専用パーサは作らず `aggregate.ts` の同じループに相乗り。Qiita だけがこのループから外れている）。
  - ⚠️ **はてなブログには「全ブログ横断で特定タグの新着を取る」フィードが存在しない**。`hatenablog.com/tag/<tag>` は `hatena.blog/tag/<tag>` へ 301 したうえで **404**。`/feed`・`?mode=rss`・`.rss`・`/tags/`・`/topic/`・`/g/`・`blog.hatena.ne.jp/-/search` もすべて 404（実アクセスで確認済み）。横断で取れるのは **はてなブックマークの検索 RSS**（`b.hatena.ne.jp/q/<word>?mode=rss`・RSS 1.0・40件）だけだが、これはブログ記事ではなくブックマーク＝別サービスの `hatena` 枠と同じもの。**タグ横断を再検討するときは、この 404 の事実から確認し直すこと。**
  - そのため**個別ブログのフィードを列挙**している（`feeds.config.ts` の `hatenablog.rssUrls`）。ブログを増やすときは配列に足すだけ。候補探しは「はてブ検索 RSS でセキュリティ関連語を引き、はてなブログ系ドメインのホストを集計する」方法が有効（推測より確実）。
  - フィードは Atom で `title` / `link` / `isoDate` / `contentSnippet` / `author` を持つが、**`enclosure` も `media:thumbnail` も無い**＝サムネはフィードから取れない。よって `enrichArticles` の対象に含め、記事ページの og:image から補完している（Zenn / Qiita と同じ）。
  - ⚠️ **`limit: 20` に対してフィードは30件返す**＝ソース追加時に取り込まれなかった21〜30件目は**今も入っていない**（実測: piyolog は26〜30位、GMO Flatt は22〜30位が未取込）。**新着の取りこぼしではなく初回取り込み時の境界**なので実害はない。過去記事を増やしたいなら `limit` を 30 にする。
  - `contentSnippet` が非常に長い（piyolog は 1万字超）が、`rss.ts` の `snippet()` が 200 字に切るので問題ない。
  - **バッジ色は `--color-hatenablog: #7c3aed`（バイオレット）**。はてブの青 `#1f7fc2`・Zenn の水色・Qiita の黄緑・ロゴのエメラルドのいずれとも色相を 36°以上離してある。
- **【有効】CloudNative BLOGs（`cloudnative`）**: クラウドネイティブ社の技術ブログ（日本語）。`fetchRss` で取得するが、**このソースだけ `filter.includeCategories` で「セキュリティ」カテゴリに絞っている**。
  - ⚠️ **カテゴリ別フィードは存在しない。** 依頼時の URL `blog.cloudnative.co.jp/category/security/` はカテゴリページ（HTML）で、**`/category/security/feed/` も `/feed` も HTML（カテゴリページ）へリダイレクトする**。`/category/security/rss`・`/rss.xml`・`/atom.xml` は **404**（いずれも実アクセスで確認）。サイトが `<link rel="alternate">` で示す唯一のフィードが **`/feed.xml`（全体・50件）**。**再検討するときはこの実測から確認し直すこと。**
  - ⚠️ **絞らないと話題が違う記事が7割入る。** 実測のカテゴリ内訳は **セキュリティ 32% / SaaS 20% / コラム 16% / AI 14% / その他・イベント・働き方・情シス・コンサルティング 18%**。「PMが娘のランドセル選びで学んだこと」「フルリモートの入社初日ってどんな感じ？」のような**質は高いが目的から外れる記事**が混ざる（HackRead の「質が低い SEO 記事」とは別問題＝`docs/decisions.md` 項目24）。
  - フィードは `<category>` を**1件だけ**持つ（実測: 複数カテゴリの記事は 0件）。`enclosure` に**サムネがある（50/50）**ので og:image 補完は不要＝全件ヒーローカードになる。`dc:creator` に著者名が入るが、`rss.ts` は全 RSS ソース共通でフィード名（`CloudNative BLOGs`）を `author` に入れる。
  - ⚠️ **抜粋が空の記事がある**（長さ 0〜238字・中央124字）。カードの概要が空になるが表示は崩れない。将来3行要約を有効化すれば埋まる（記事ページは UA 付き fetch で 200・本文 5,800〜11,300字を確認済み。`enrichArticles` の対象に入れてある）。
  - ⚠️ **サイト側が「セキュリティ」というカテゴリ名を変えると 0 件になる。** そのときは `aggregate` が `⚠️ 絞り込みで全件除外された` と警告し、末尾のエラー集約にも積む（**静かに止まらない**）。この行が出たら `feed.xml` の `<category>` を実際に見てから設定を直す。
  - **バッジ色は `--color-cloudnative: #7e57b7`（紫）。⚠️ 10色目で ΔE=43.8**（後述「バッジ色の限界」）。
- **【有効】The Hacker News（`thehackernews`）**: 英語のセキュリティ専門ニュース。これも `fetchRss`（`rssUrls` 配列）で取得する。
  - ⚠️ **Y Combinator の Hacker News（`news.ycombinator.com`）とは別サービス**。key を `hackernews` にしないこと。
  - **サイト側の `/rss.xml`・`/atom.xml`・`/feeds/posts/default` はすべて FeedBurner（`feeds.feedburner.com/TheHackersNews`）へリダイレクトする**（実測）。実質フィードは1本しかないので、リダイレクトを1回減らすため設定には最終 URL を直接書いている。裏を返すと **FeedBurner が止まると代替経路が無い**（サイト固有 URL も同じ先を指すため）。
  - RSS 2.0。`title` / `link` / `isoDate` / `contentSnippet`（約400字）/ `author` に加え、**`enclosure` にサムネイル画像が付く**（Blogger の CDN）。よってはてなブログと違い og:image 補完は不要で、全件がヒーローカードになる。
  - **約10件/日**（実測: 50件が約5日分）。cron 6時間ごと＝1 run あたり ~2.5件なので `limit: 20` で十分な余裕。フィードが50件返すので数 run 落ちても取りこぼさない。
  - 記事ページは **UA を付けた fetch で 200 が返り、本文も 7,000〜10,000 字抽出できる**（実測）＝将来3行要約（`translate.summarizeSources`）を有効化したときにも機能する。そのため `enrichArticles` の対象セットに含めてある（サムネ済み item は fetch されないので現状のコストは増えない）。
  - **最初に入れた英語ソース**（現在は他にも複数ある）。**翻訳が有効なので日本語訳が併記される**（フィルタバー右端の「日本語 / 原文」で切替）。タイトルは 56〜100 字程度で、ヒーローカードの `h2` に `break-words` が効くため折り返しは崩れない。
  - **バッジ色は `--color-thehackernews: #c81e2b`（ブランドの赤）**。色相 355°で最近接の hatenablog（262°）から 93°離れ、白背景コントラストは 5.71:1。
- **【有効】Dark Reading（`darkreading`）**: 英語のセキュリティ専門メディア。`fetchRss`（`rssUrls` 配列）で取得。
  - **使えるのは全体フィード `https://www.darkreading.com/rss.xml` の1本だけ**。セクション別フィード（`/rss/<section>.xml`）は **404 で存在せず**、旧 `/rss_simple.asp` は **403**、`/feed` はトップページへ飛ぶ（すべて実アクセスで確認）。**セクション単位で絞りたくなっても手段が無い**ので、量を減らすなら `limit` で調整するしかない。
  - RSS 2.0。`title` / `link` / `isoDate` / `dc:creator`（記者名）/ `media:thumbnail` を持つ。**サムネはフィードに付く**（contentstack CDN・HTTP 200 で実在確認）。
  - ⚠️ **抜粋（`contentSnippet`）が極端に短い**: 69〜219字（中央148字）で、`content` も同じ内容＝**1文のリード文だけ**。The Hacker News の約400字と比べても短く、カードの概要はほぼ見出しの補足程度にしかならない。3行要約を有効化するなら**フィードの抜粋では足りず、`enrichArticles` が取る記事本文が要る**。
  - **約4.6件/日**（実測: 50件が約11日分）。`limit: 20` / `retentionMax: 1000`（≒7ヶ月）で十分。
  - 記事ページは UA 付き fetch で **200・本文 9,000〜11,700字・og:image あり**（実測）＝将来の3行要約も機能する。`enrichArticles` の対象セットに含めてある。
  - **バッジ色は `--color-darkreading: #8a6a12`（琥珀）**。色相環で最も空いていた領域（THN 355°→Qiita 94° の 99°の隙間）の中点付近 44°。既存5色との最小色差 ΔE=59.9 で、**既存どうしの最小ペア（Qiita↔ロゴ 58.3）より離れている**。白背景コントラスト 5.06:1。
- **【有効】BleepingComputer（`bleepingcomputer`）**: 英語のセキュリティ／IT ニュース。`fetchRss`（`rssUrls` 配列）で取得。
  - **全体フィード `https://www.bleepingcomputer.com/feed/` の1本だけ**。カテゴリ別（`/news/<cat>/feed/`）は **404 で存在しない**（実アクセスで確認）。
  - **Cloudflare 配下**（`cf-ray` ヘッダあり）だが、**フィードは UA を問わず 200**（プロジェクトUA / ブラウザUA / UA無し すべて成功、検証ページも出ない）。記事ページも同じく 200 なので、**CI（datacenter IP）でボット判定される懸念は低い**。ただし Cloudflare の設定はサイト側都合で変わり得るので、取得できなくなったら 403 / 検証ページを疑うこと。
  - ⚠️ **フィードが 15 件しか返さない**（多くのソースは 20〜50 件返す。ただし HackRead は 10 件でさらに少ない＝ソース別の一覧は後述「フィードから何日分遡れるか」の表）。実測 6.3件/日なので**約2.4日分しか遡れない**＝**CI が2日以上止まると取りこぼす**。6時間ごとの cron なら 1 run あたり ~2件で十分。`limit: 20` はフィード件数を上回るので実質「全件取り込む」設定。
  - ⚠️ **フィードにサムネが無い**（`enclosure` も `media:*` も無い）。フィードにサムネが付くソースと違い、**サムネは `enrichArticles` の og:image 補完に完全に依存する**（HackRead も同じ）。記事ページは UA 付き fetch で 200・og:image あり・本文 6,600〜9,000字（実測）なので機能するが、ここが失敗すると画像なしのコンパクト行になる。
  - 抜粋は 159〜311字（中央206字）。`dc:creator` に記者名、`categories` にカテゴリが入る（現状は未使用）。
  - **バッジ色は `--color-bleepingcomputer: #d10092`（マゼンタ）**。残った最大の空き（hatenablog 262°→THN 355° の 93°）から 318°。既存6色との最小色差 ΔE=60.1（基準 58.3 超）、白背景コントラスト 5.09:1。
- **【有効】The Register（`theregister`）**: 英語の総合 IT メディアだが、**セキュリティセクション限定のフィード**を使う。`fetchRss`（`rssUrls` 配列）で取得。
  - ⚠️ **全体フィードは使わない**。The Register はクラウド・ハードウェア・企業ニュース・宇宙開発まで扱うため、全体フィード（`/headlines.atom`）ではセキュリティ以外が大量に混ざる。**`/security/headlines.atom` がセクション限定**で、実測 50 件すべてがセキュリティ関連だった（タイトル全件を目視確認）。
  - ⚠️ **設定には `/security/headlines.atom`（人が読めるURL）を書く。** 実際にはこれが `api.theregister.com/api/v1/article?...&query=tag:security` へリダイレクトするが、転送先は `site_id=2` / `remapper=rss` といった**内部パラメータを含み壊れやすい**ので採用しない。（The Hacker News は逆に最終URL＝FeedBurner を直接指定している。あちらの転送先は安定した公開エンドポイントなので判断が違う。）
  - セクション別フィードの他の形（`/security/feed/`・`/security/rss`・`/security/atom.xml`・`/security/index.atom`）は**すべて 404**。`/security/headlines.rss` のみ同内容を返す。
  - **フィードが 50 件（約13日分）**返す＝取りこぼしリスクは Dark Reading と並んで最も低い。約3.7件/日。
  - `media:thumbnail` と `enclosure` に**サムネが付く（50/50 件）**。`author` は無い（`rss.ts` がフィード名を入れる）。抜粋は 20〜171字（中央87字）と短め。
  - 記事ページは UA 付き fetch で 200・og:image あり・本文 8,700〜11,600字（実測）。CDN ヘッダは無くボット判定の兆候なし（UA 3パターンすべて 200）。
  - **バッジ色は `--color-theregister: #2a5e6f`（青緑）。⚠️ 暫定色**（後述「バッジ色の限界」参照）。

## ソースを追加・削除するときのチェックリスト

> **なぜこれがあるか**: はてなブログを追加したとき、コードは全部直したのに
> **README.md の更新だけ漏れて「Zenn と Qiita から集約」と古いまま**になった。
> 「自動で追従するもの」と「手で直すもの」が混在していて、後者を忘れやすい。

### 1. コード・設定（追加時に必ず触る）

| # | ファイル | やること |
| --- | --- | --- |
| 1 | `src/lib/feed.ts` | `FeedSource` ユニオンに `"<key>"` を追加 ＋ `SOURCES` にエントリ（`key`/`label`/`badgeClass`/`description`）。**ここが中心レジストリ**で、下の「自動で追従するもの」はすべてこの配列を見ている |
| 2 | `src/styles/globals.css` | `@theme` に `--color-<key>` / `--color-<key>-bg`、続けて `.src-<key>` クラス。**既存ソースの色と色相が近すぎないか数値で確認する**（`--color-hatenablog` のコメントに選定根拠の書き方の例がある）。<br>**満たせないときの指針**: かつての合格基準「既存どうしの最小色差 ΔE 58.3 を上回る」は**8色目以降は数学的に満たせない**（色相環は360°しかなく AA 4.5:1 を満たす明度帯も限られる）。**基準未達でも個別色を続ける**方針を採用済み＝バッジには常にソース名の文字が入るので、**色は判別の主役ではなく補助的な手がかり**と割り切る。したがって新色は次の3点だけ満たせばよい: ①白背景コントラスト **AA 4.5:1 以上**、②既存の明度感（コントラスト **4.6〜6.6**）に収める、③**最大の ΔE を取る色を総当たりで選び、何色目で・どの色と・どれだけ近いかをコメントに記録する**。色相が埋まっていたら**彩度で差をつける**（例: `--color-hackread` は近い赤系と彩度 30% vs 74〜100% で差別化）。**グループ配色（国内/海外で色を共有する方式）へは移行しない**と決めた |
| 3 | `feeds.config.ts` | `FeedsConfig` インターフェース ＋ `feedsConfig` に設定。トークン類はここに書かず env/Secrets |
| 4 | `scripts/sources/<key>.ts` | 取得して `FeedItem[]` を返す関数。**公開 RSS/Atom なら新規作成は不要**で、`rss.ts` の `fetchRss({rssUrls, source, limit})` をそのまま流用できる（設定を `rssUrls` 配列にすれば `aggregate.ts` の既存ループに相乗りするだけで済む）。<br>⚠️ **ただし「RSS があるから RSS を使う」で即決しないこと。** Qiita はフィードが4件しか返さず**投稿の47%を失っていた**＝**フィードの返却件数 ÷ 投稿ペース＝何日分遡れるか**を先に実測し、cron 間隔（6時間）に対して余裕があるか確かめる（「フィードから何日分遡れるか」の表）。足りなければ **API を使う専用実装**にする（`qiitaApi.ts` が実例。この場合 `aggregate.ts` の共通ループから外れ、フォールバックとログの設計も必要になる） |
| 5 | `scripts/aggregate.ts` | 取得ブロック（`rssUrls` 形式なら既存ループの配列に `<key>` を足すだけ。専用実装なら Qiita のブロックが手本）。**末尾の `counts` オブジェクトと完了ログにも `<key>` を追加**（忘れると集計に出ない） |
| 6 | `feeds.config.ts` の `translate.summarizeSources` | ⚠️ **原則さわらない（現在は意図的に空）。** 空＝「非日本語のときだけ翻訳」で、日本語記事は API を呼ばない。ここにソースを足すと**そのソースは原文の言語を問わず3行要約**になり、日本語記事まで Gemini を消費する（入力が記事本文になるためトークンも約16倍）。要約を使いたいと決めたときだけ足し、**同時に `aggregate.ts` の `ENRICH_VERSION` を上げる**（上げないと翻訳済みキャッシュが再生成されない） |
| 7 | `scripts/sources/enrichArticles.ts` の呼び出し（`aggregate.ts` 内） | **記事系なら基本は対象セットに追加する。** この関数は2役: ①サムネが無い item の og:image 補完、②要約を有効化したときの本文テキスト取得。**フィードにサムネがあっても ② のために入れておく**（サムネ済み item は fetch されないのでコストは増えない）。追加前に**記事ページが UA 付き fetch で 200 を返すか実測する**（拒否するサイトがある） |
| 8 | `feeds.config.ts` の `retentionMax` | 投稿頻度から決める。既定 1000 は約10件/日なら3ヶ月分（Qiita は API 化で 14〜23件/日 入るので約50日分）。物量が桁違いなソースだけ調整すればよい（ソース別枠なので他を押し出さない） |
| 9 | `feeds.config.ts` の `filter`（必要なときだけ） | **全体フィードしか無いサイトで、目的以外の記事が多く混ざるとき**に `filter.includeCategories` で絞る（`cloudnative` が実例）。⚠️ **まずフィードの `<category>` を実測する**＝カテゴリが無い／表記が揺れるサイトでは使えない。<br>⚠️ **「ノイズがあるから絞る」と即断しないこと。** 「**話題が違う**（対象外）」なら絞る、「**質が低い**（対象内だが玉石混交）」なら絞らない、が使い分け（`docs/decisions.md` 項目24 と項目11）。<br>絞り込みは `limit` より先に評価される＝`limit` は「残す件数」の窓。除外側（`excludeCategories` / `excludeAuthors`）は**まだ無い**（必要になったら `rss.ts` の `matchesFilter` に足す） |
| 10 | **CLAUDE.md「フィードから何日分遡れるか」の表** | ⚠️ **実測して行を足す。** ここが cron 間隔に対して足りているかが、取りこぼしの唯一の判断材料（Qiita で47%失った原因がこれ）。⚠️ **ドキュメントだが「手で更新が必要なもの」ではなく設計判断の一部なので、この表に入れてある** |

### 2. 自動で追従するもの（手を入れない）

`SOURCES` 配列を直せば、以下は**放っておいても正しくなる**。ここを手で書き換えると二重管理になる。

- **フッター / `<meta name="description">` / RSS の description / OGP 画像** … `sourceListText()` が `SOURCES` の label を連結する
  - ⚠️ **トップ（`index.astro`）の見出し下の説明文は例外で、自動生成をやめた**（ソースが8つで長すぎたため「公開フィードから自動集約。」の固定文にした）。**`sourceListText()` を短くして解決しないこと**＝上の4箇所を巻き込む。判断は `docs/decisions.md` 項目23
- **フィルタチップ**（`SourceFilter.astro`）… `SOURCES` を map している
- **about ページの情報源カード** … `SOURCES` の `label` / `badgeClass` / `description` から生成
- **RSS（`rss.xml.ts`）の description とアイテムのソース名** … 同上
- **カードのバッジ**（`FeedCard` / `TweetCard`）… `sourceMeta()` 経由
- **「日本語 / 原文」トグルの表示可否** … `hasAnyTranslation(items)` 次第（翻訳データが増えれば勝手に出る）

### 3. 手で更新が必要なもの（★ ここが漏れやすい）

- [ ] **`README.md`** … 冒頭の説明文、「収集しているソース」の表、「構成」の記述。
      ⚠️ **英語ソースを足したときは「英語サイトはカテゴリ別フィードが無いため…」の注記も見る**
      （個別列挙をやめて「上の表で英語と書かれているもの」という参照形式にしてあるので、
      **サイト名や件数を書き足さないこと**）
- [ ] **`CLAUDE.md`** … 「現在有効なソース」の表、「ソース別の要点」に取得元固有の落とし穴
      （フィード形式・サムネの有無・URL の癖）、**「フィードから何日分遡れるか」の表に実測値**
- **⚠️ ソース数・サイト名の列挙は README / CLAUDE.md の両方から意図的に削除してある。**
      過去4回この数字だけが取り残された（はてなブログ追加時の README、翻訳有効化時の README など）。
      **「N ソース」「A / B / C の3つ」といった書き方を新たに増やさない**＝表や `SOURCES` を
      参照する形にする
- [ ] **OGP 画像** … `npx tsx scripts/generateOgImage.ts` を実行して `public/og-default.png` を再生成＋コミット。スクリプト自体は `SOURCES` を読むので**文言の修正は不要、実行を忘れないことだけが問題**

### 4. 無効化したソースを復活させるとき

⚠️ **`feeds.config.ts` の `disabled` を `false` に戻すだけでは画面に出ない。**
収集は再開されるが、`SOURCES` 配列から外れていると `index.astro` の `isKnownSource()` で
弾かれてカードが描画されず、フィルタチップにも出ない（＝取得はしているのに見えない状態）。

1. `feeds.config.ts` の `disabled: false`
2. **`src/lib/feed.ts` の `SOURCES` にエントリを戻す**（コメントアウトされた行が直上にある）
3. 取得先 URL が現状に合っているか確認する（例: 旧 `hatena` は IT 人気エントリーのままだった）
4. 上の「3. 手で更新が必要なもの」を実施

### 5. 削除するとき

上の 1 の逆をやったうえで、**取り残しやすい所**を確認する:

- `src/lib/feed.ts` の `FeedSource` ユニオン / そのソース専用フィールド（例: はてブの `bookmarkCount`）と、**それを表示しているコンポーネント**
- `globals.css` の色変数と `.src-<key>`（**消した変数を参照している箇所が残っていないか**）
- 専用スクリプトと `package.json` の npm スクリプト
- `.env.example` / ワークフローの env（そのソース専用のクレデンシャル）
- `src/data/feed.json` の `items` と `state`（`disabled` にするだけでは蓄積分が残る）
- ドキュメントは消すだけでなく、**要点を1〜2行残して削除前のコミットハッシュを添える**

### 6. 検証（全部通す）

```bash
npm run typecheck   # 型エラー 0。scripts/ もここでしか検査されない
npm run build       # 本番ビルド
npm run aggregate   # 実際に取得できるか。ログのソース別件数を確認
npm run dev         # 画面（フィルタ・バッジ・説明文）を目視
```

- **設定する URL は事前に実アクセスして 200 と item 取得を確認する**（`rss-parser` は日本語 URL を
  そのままだと拒否する等の癖がある。`rssUrls` に入れる前に確かめる）
- `npm run aggregate` 後は **ソース別の取得件数**と、他ソースが壊れていないことをログで確認する

## 機能を有効化・無効化するときのチェックリスト

> **なぜこれがあるか**: 翻訳（`translate`）を有効化したとき（`e29e520`）、**コードは正しく直したのに
> ドキュメントが「無効」のまま8箇所残った**。README には「トークン・API キーは不要です」
> 「Secrets の設定は不要です」「X API・Gemini API はどちらも無効化」と書かれ続け、
> **同じ README の中で「Gemini による翻訳が有効なので日本語訳が併記されます」と矛盾していた**。
> 上のチェックリストは「**ソース**の追加・削除」用で、**機能のフラグを動かしたときの手順が無かった**。

対象になる操作: `feeds.config.ts` の `translate.disabled` / `x.disabled` の切り替え、
`translate.summarizeSources` の変更、`SHOW_LANG_FILTER_CHIP`（`SourceFilter.astro`）の切り替え、
`GCS_BUCKET` などリポジトリ変数によるモード切り替え。

| # | 対象 | やること |
| --- | --- | --- |
| 1 | `feeds.config.ts` のフラグ | `disabled` を切り替える。**ソースを有効化した場合は `src/lib/feed.ts` の `SOURCES` にも戻す**（フラグだけでは画面に出ない。「無効化したソースを復活させるとき」参照） |
| 2 | **キャッシュの版**（生成ロジックを変えたときのみ） | `translate.summarizeSources` やプロンプトを変えたら `aggregate.ts` の `ENRICH_VERSION` を上げる。上げないと旧キャッシュが再生成されない |
| 3 | **`CLAUDE.md` の「現在無効なソース・機能」表** | 有効化したものを表から**外す**。無効化したものは行を足す。⚠️ **表から消しただけでは足りない**＝ 「【現在は無効】」「現在は有効」と書いた**節見出し・本文の注記も同じコミットで直す**（`grep -n "現在は無効\|現在無効\|現在は有効" CLAUDE.md`） |
| 4 | **`README.md`** | ⚠️ **ここが実際に漏れた。** 機能の要否を書いている箇所を**全部**見る: ①「API キーは必須ではありません」節（キーの必要・不要）②「無効（`disabled: true`）」表 ③フォーク元からの改造を説明した引用ブロック（「X API を…無効化」）④「デプロイ」節の Secrets の説明。<br>**確認方法**: `grep -n "不要\|無効\|API キー\|Secrets\|トークン" README.md` を通し、**ヒットした行が全部同じ結論になっているか**を読む（矛盾したまま残るのが典型的な失敗） |
| 5 | **`docs/decisions.md`** | その機能に対応する項目の「**再検討すべき条件**」を満たしたということなので、**決定を書き直す**（翻訳＝項目5・6、言語トグル＝項目8、「日本語」フィルタ＝項目9）。判断を変えたのに古い結論が残ると「なぜかそうなっている」状態になる |
| 6 | **⚠️ コード内のコメント（ここも実際に漏れた）** | **ドキュメントだけ直してコメントが残る**のが典型的な失敗。**フラグを読むコードの近くに「今は無効」と書いてある**ので必ず見る: `feeds.config.ts` の冒頭コメント＋該当キーのコメント、`scripts/aggregate.ts` の冒頭、`src/lib/feed.ts`（`FeedSource` の説明・`hasAnyTranslation`）、`src/components/SourceFilter.astro`（トグルとチップの判定）、`.github/workflows/update-and-deploy.yml` の env のコメント。<br>**確認方法**: `grep -rn "無効\|有効化\|温存\|トークン不要\|トークン無し" --include="*.ts" --include="*.astro" --include="*.yml" scripts src .github feeds.config.ts` を通し、**ヒットした行が全部同じ結論になっているか**を読む |
| 7 | **`.env.example` のコメント** | ⚠️ **依頼者の権限設定で読み書きが拒否される。** そのソース／機能のトークンの説明が実態と合っているかを**依頼者に確認してもらう**（勝手に書き換えようとしない。「触ってはいけないもの」参照） |
| 8 | **Secrets / リポジトリ変数** | キーが必要になったら**依頼者が GitHub の Settings に登録する**（Claude 側では設定できない）。ワークフローの env 側に渡っているかは `.github/workflows/update-and-deploy.yml` を見る。**未設定でも run が緑のまま静かに機能だけ止まる**ものが多いので、有効化後は実際に効いているかをログで確認する |

**有効化後の確認（「設定したのに効いていない」を防ぐ）**:

```bash
npm run aggregate                    # ローカルで動くか（キーが無い機能はスキップされる）
gh run view <id> --log | grep '\[translate\]'   # CI で実際に動いたか
git show origin/main:src/data/feed.json | jq '[.items[]|select(.titleJa)]|length'  # 結果が入ったか
```

**⚠️ 数字・サイト名の列挙を新たに書き足さないこと。** ソース数「N ソース」や
「A / B / C の3つ」といった書き方が、これまで**4回**取り残された（はてなブログ追加時の README、
翻訳有効化時の README、英語ソース追加時の「他の英語2ソース」など）。
表・`SOURCES`・`feeds.config.ts` を**参照する形**にしておけば、次の変更で勝手に正しくなる。

## 重要な制約・gotcha

- **内部リンクは必ず `src/lib/url.ts` の `siteLink()`（host 必須なら `absUrl()`）を通す。** base path が `/todaysec` なので素の絶対パスは壊れる。カスタムドメインにするなら `astro.config.mjs` の `base` を空に（`site`/`base` は `url.ts` が `import.meta.env.SITE` / `BASE_URL` 経由で参照するので、config だけ直せば追従する）。
- **CI の push イベントは集約とコミットをスキップ**する（既存 `feed.json` でビルドのみ）。集約が走るのは `schedule` / `workflow_dispatch` のみ。これが無いと「feed-bot のコミット → push → 再集約 → …」のループになる。
- **`feed.json` の保管先はモード依存（上述）。** **ローカルモード**では CI（feed-bot）が `src/data/feed.json` を main に直接コミット＝ローカルで `npm run aggregate` するとライブ取得で書き換わる（検証後は `git checkout -- src/data/feed.json` で戻す。リベース衝突は自動生成キャッシュなのでどちらか採用で次回 cron が再生成）。**GCS モード**では CI はコミットせず GCS が正本＝committed `src/data/feed.json` はフォールバック種として据え置き（ローカル `npm run aggregate` も `GCS_BUCKET` 未設定なら従来どおりローカルファイルに書くだけ。GCS へ書きたいときだけ `GCS_BUCKET=<bucket>` と ADC（`gcloud auth application-default login`）を用意して実行）。
- **【現在は無効】X が古い日付で止まったとき（取得漏れの典型）は上流を疑う。** todayai は basecamp 公開 JSON（`x-tweets.json`）を読むだけなので、その生成元 basecamp の `update-x-feed.yml` が **X API 月間クレジット枯渇（HTTP 402 `CreditsDepleted`）** で 0 件取得に陥ると、run は緑のままサイレントに stale 化する。直し方: ①basecamp 側でクレジット回復＋手動 `workflow_dispatch`（`fetch_pages`/`fetch_max_results` を増やしてバックフィル）→ ②todayai を `workflow_dispatch` で再集約。調査時は GCS の `x-tweets.json` が `Cache-Control: max-age=300` で**古いエッジキャッシュを返す**ので `?cb=<unique>` でキャッシュバスタすること（committed feed の確認は `git show origin/main:src/data/feed.json | jq` が確実）。詳細は memory `todayai-x-feed-staleness`。
- **テキスト切り詰めは `scripts/sources/util.ts` の `truncateSafe()` を使う（素の `slice(0,n)+"…"` 禁止）。** 絵文字（サロゲートペア）を分断すると単独サロゲート（`\ud83d` 等）が feed.json に混入し、jq 等の厳格なパーサが**ファイル全体を不正 JSON として拒否**する（rss.xml では不正 XML 文字。Node の JSON.parse は寛容なのでビルドは緑のまま気づけない）。最終ガードとして `feedWrite.ts` が書き込み時に全文字列から `stripLoneSurrogates()` で除去＝既存の汚染も次回 run で治癒する。
- **表示時刻・日付は JST（Asia/Tokyo）固定。** `publishedAt` は全ソース UTC（末尾 `Z`）で保存されるが、`src/lib/feed.ts` の表示ヘルパー（`timeOfDay` / `absoluteTime` / `relativeTime` / `dayKey` / `dayLabel`）はすべて `timeZone: "Asia/Tokyo"` を明示指定して JST で描画する。**新しい時刻/日付ヘルパーを足すときも `timeZone` 必須**＝省くと SSG のビルドランナー（GitHub Actions `ubuntu-latest`＝UTC）のローカル TZ 依存になり 9 時間ずれる（ビルドは緑のまま気づけない）。特に日付グルーピングの `dayKey` は **`toISOString().slice(0,10)` を使わない**（`toISOString` は `TZ` env を無視して常に UTC＝日付境界が JST 09:00 でズレる）。JST 暦日は `Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Tokyo", ... })` で作る。
- **Tailwind v4 の Vite プラグインは Astro と型が合わない**ため `astro.config.mjs` で `any` キャスト済み。
- パスエイリアス `@/*` → `src/*`（tsconfig）。
- **アクセス解析は Cloudflare Web Analytics（Cookie 不要）**: `Layout.astro` が `import.meta.env.PUBLIC_CF_BEACON_TOKEN` を見て、値があればビーコン `<script is:inline>` を `<head>` に出力、未設定なら非出力（graceful・ビルドは壊れない）。token は**公開値**（ページソースに出る）なので secret ではなく**リポジトリ変数 `PUBLIC_CF_BEACON_TOKEN`**（`PUBLIC_` 接頭辞は Astro/Vite のクライアント露出に必須）。ワークフローの Build ステップ env で `vars.PUBLIC_CF_BEACON_TOKEN` を渡す。ローカルは `.env` に記入。設定するまでは解析タグ無しで動く。
- **OGP 画像（`public/og-default.png`・1200x630）はコード生成**: `scripts/generateOgImage.ts` が SVG を組み立て **sharp で PNG 化**する（`npx tsx scripts/generateOgImage.ts`）。文言・配色を変えたいときはスクリプト冒頭の `CONTENT` / `C` を編集して再実行する。**手で画像を差し替えないこと**（差分が追えず作り直せなくなる）。注意点2つ:
  - **sharp は `package.json` の直接依存ではなく astro の推移的依存**。将来 astro が落としたら `npm i -D sharp` が必要。
  - **テキストは生成した PC のフォントでラスタライズされる**（サイトの Web フォント Space Grotesk / IBM Plex Mono は載らない）。別 PC で再生成すると字形が変わりうるので、生成済み PNG をコミットして通常は再生成しない運用。
  - favicon（`public/favicon.svg`）は SVG のまま配信＝ブラウザがレンダリングするので、こちらはフォント差の影響を受けない。**SVG のコメント内に連続ハイフン（`--`）を書くと XML が壊れて画像ごと表示されなくなる**ので注意（`--color-logo` のような変数名を書きたくなる場面で踏みやすい）。
- **依存の脆弱性を理由に astro のメジャー更新を検討するときは、まず「使っていない機能の脆弱性か」を検索で確かめる。** astro 5 を据え置いている根拠が「該当機能を使っていないこと」なので、**判断のたびに同じ検索をやり直すことになる**。結論と経緯は `docs/decisions.md` 項目4 にあるので、ここには手順だけ残す:
  ```bash
  grep -rn "define:vars\|set:html\|server:defer\|ViewTransitions\|ClientRouter\|transition:" src/
  grep -rn "{\.\.\." src/                        # spread props
  grep -n "adapter\|output" astro.config.mjs     # 無ければ純 SSG＝SSR 系の脆弱性は非該当
  ```
  **すべて 0 件であることが据え置きの前提。** ヒットするようになったら `docs/decisions.md` 項目4 の「再検討すべき条件」を満たしたということなので、据え置きの判断ごと評価し直す。
- **ライト専用サイトなので `globals.css` の `html` に `color-scheme: light` を宣言**。これが無いと Chrome の強制/Auto ダークモードが朝刊テーマを反転させて背景・カードが暗転する（UAの問題ではなくブラウザ設定）。
- **翻訳が出ない＝Gemini の HTTP 4xx を疑う**（CI は緑のまま titleJa/summaryJa=0 になる）。実例: 使用モデル `gemini-2.0-flash` が 2026-06-01 提供終了→無料枠撤廃で **429**。`feeds.config.ts` の `translate.model` を後継 Flash-Lite（無料枠あり）に切替えて復旧。確認は `gh run view <id> --log | grep '\[translate\]'` と `git show origin/main:src/data/feed.json | jq '[.items[]|select(.titleJa)]|length'`。詳細は memory `todayai-gemini-quota-429`。
- **「日本語」フィルタチップは現在非表示（実装は残してある）。** 英語ソースが増えて日本語記事が埋没する問題への対策として追加したが、使ってみて不要と判断した。**削除ではなく `SourceFilter.astro` の `SHOW_LANG_FILTER_CHIP = false` で表示だけ止めている＝`true` にすれば復活する**（他の変更は不要）。
  - 残してある理由: 蓄積が進んで日本語記事が埋没したときに再び必要になりうる。作り直しを避けたい。
  - ⚠️ **追加時の根拠だった「英語ソースの新着比率が約80%」は誤り。実測 51%**（取り込み件数ベース。
    **Qiita の API 化後は約44%**＝日本語が過半数になる）。**80% という数字が測られたことはない**ので、
    どこから来たか不明（Qiita/Zenn が取りこぼしていた影響で体感が偏った可能性がある）。
    **非表示のままでよい**＝日本語が過半数なら埋没対策としての必要性はむしろ下がる。
    前提の数字だけ直してある（`docs/decisions.md` 項目9 も同様）。
  - 一緒に残っている実装: 判定 `isTranslated(item)`（`src/lib/feed.ts`）、記事側の目印 `data-orig-lang="ja" | "translated"`（`index.astro` の行ラッパ）、フィルタ JS の `kind === "lang"` 分岐（`SourceFilter.astro`）。**チップが無くても副作用はない**（JS はチップの `data-filter-kind` を見るだけで、「日本語」チップの存在を前提にしていない）。
  - ⚠️ **`isTranslated` / `hasAnyTranslation` はこのチップ専用ではない。** 「日本語 / 原文」トグルの表示条件（`hasAnyTranslation`）と `BilingualText` の表示判定（`hasBilingual`）に使われているので消さないこと。
  - フィルタの選択状態は `localStorage` に保存していない（保存しているのは表示言語トグルの `todaysec:lang` だけ）。よって「日本語」を選んだ状態で再訪して壊れる、という経路は存在しない。
- **⚠️ バッジ色: ΔE の基準は8色目で破綻したが、方針として「個別色を続ける」と決めた。**
  - かつての合格基準は「**既存どうしの最小色差 ΔE = 58.3（Qiita↔ロゴ）を上回る**」。7色目（BleepingComputer）までは満たせた（ΔE 59.9〜75.4）。
  - **8色目 The Register = ΔE 48.3**（最近接 Zenn）、**9色目 HackRead = ΔE 47.4**（最近接 The Register / BleepingComputer 47.5 / THN 50.1）、**10色目 CloudNative = ΔE 43.8**（最近接 HackRead 43.8 / Zenn 44.0 / はてなブログ 44.4 でほぼ等距離）。**3回連続で基準未達**で、しかも**下がり続けている**。明度・彩度も動かして全色相を総当たりしても上限がこの値で、**色相環は 360°しかなく AA 4.5:1 を満たす明度帯も限られるため、これは努力で解決できない**。
  - **総当たりの計算方法**（次に色を選ぶときはこれを再現する）: sRGB→Lab(D65) 変換して **ΔE は CIE76（Lab のユークリッド距離）**。白背景コントラストは相対輝度から算出。HSL を色相 1°・彩度 5%・明度 1% 刻みで走査し、コントラスト 4.6〜6.6 の範囲で**既存色との最小 ΔE が最大**になる色を選ぶ。⚠️ **この方法で既存の記載値が再現できることを確認済み**（Qiita↔ロゴ 58.3 / The Register 48.3 / HackRead 47.4 が一致）＝別の ΔE 定義（CIEDE2000 等）で計算すると過去の数値と比較できなくなる。
  - **それでも個別色を続ける**（グループ配色へは移行しない）。理由: **バッジには常にソース名の文字が入る**ので、色は「判別の主役」ではなく補助的な手がかりに留めればよい、と割り切った。
  - **新色を選ぶときの実務ルール**（チェックリスト項目2にも記載）: ①AA 4.5:1 以上、②既存の明度感（コントラスト 4.6〜6.6）に収める、③総当たりで最大 ΔE を取り、**何色目で・どの色と・どれだけ近いかをコメントに記録する**。色相が埋まっていたら**彩度で差をつける**（例: HackRead は彩度 30% で、近い色相の THN 74% / BleepingComputer 100% と差別化）。
  - （参考）グループ配色（国内/海外メディアで数色を共有）は検討したが**採用しなかった**。移行するなら `SourceMeta` に `group` を足して `badgeClass` をグループ由来にするだけで済む＝SOURCES 駆動の自動追従はそのまま使える。方針を変えるときの選択肢として記録しておく。

- **ビジュアルは「朝刊（Daily Briefing）」ライトテーマ**（ペーパー白 `#f6f7f9` ＋白カード ＋ インク文字 ＋ コバルト `#2f5fff`）。配色トークンは `globals.css` の `@theme` に集約。見出しは Space Grotesk、時刻・ソース名は IBM Plex Mono（ティッカー風）。
- **ロゴだけ別系統の色**（`--color-logo` 系＝エメラルドグリーン `#0f9b6c`）: `--color-accent`（コバルト）はフィルタチップ・言語トグル・カード hover が共有しているため、ロゴを変えるとサイト全体が巻き込まれる。**ロゴ専用変数に分けてあるので、ロゴの色を変えるときは `--color-logo` だけを触ること**（使用箇所は `Layout.astro` のバッジ背景＋glow とワードマークの2箇所）。なお Tailwind v4 は**実際に使われている `@theme` 変数しか CSS に出力しない**ので、`--color-logo-bright` / `-deep` は定義済みでもビルド後の CSS には現れない（`--color-accent-deep` も同様。不具合ではない）。
- **カードはハイブリッド分岐**（`FeedCard.astro`）: X は `TweetCard`、それ以外は `item.thumbnail` の有無で **ヒーローカード** か **コンパクト行** に分かれる。ヒーローはモバイルで画像上＋本文下の縦積み、`sm:` 以上で `flex-row` の**画像左（`sm:w-[14rem]`）＋本文右**の横並びになる。OGP 補完でサムネ網羅率が上がるとヒーローが主役になる。**サムネ枠は全ブレークポイントで `aspect-video`（16:9）固定＋`sm:self-start`（上揃え）**＝カード全高に引き伸ばされない（横長 OGP が縦長クロップで崩れるのを防ぐ）。**カード外枠は `rounded-none`（直角）**＝バッジのピル・X アバターの丸・フィルタチップのピルは丸のまま、カード面だけ角。
- **コンテナ幅**は `Layout.astro` の `max-w-[46rem] lg:max-w-[58rem]`（モバイル～タブレットは 46rem、`lg:`≥1024px で 58rem に広げて PC で横を使う）。ヘッダー/フィルタ/日付見出しもこの幅に従う。
- **二言語表示（日本語／原文トグル）**: 翻訳が有効なので**英語ソースには日本語訳が付き、トグルが機能する**（日本語記事は訳が無いので素のまま＝トグルの影響を受けない）。トグル自体は `hasAnyTranslation(items)` が true のときだけ描画される。`FeedItem` の `titleJa`/`summaryJa`（集約時に Gemini 補完）が原文と別に入る。表示は `BilingualText.astro`（`ja!==orig` のとき `.lang-ja` と `.lang-orig` の両 span を出力、翻訳なしは素テキスト）。`SourceFilter.astro` 右端の「日本語／原文」トグルが `:root.show-orig` クラスを切り替え、CSS（`globals.css` の `.lang-orig`/`:root.show-orig .lang-ja`）で全カードを一斉に出し分ける。選択は `localStorage("todayai:lang")` に永続。**フィルタ（`.is-hidden`）とは独立したクラストグルで競合しない。** 既定は日本語（クラス無し）。
- **`index.astro` は日付グルーピング＋タイムレール**: 各アイテムを `grid-cols-[2.75rem_minmax(0,1fr)]`（`sm:` で `3.5rem`）で包み、左列に等幅 `HH:MM`＋縦ヘアライン（シグネチャ）。**この包み `div` に `data-feed-item`＋`data-source` を付け、フィルタ（`SourceFilter.astro` の `<script>`）はこのラッパに `.is-hidden` をトグルする**（`article` 単体ではなく行ごと出し分けるため。`[data-source].is-hidden{display:none}` がラッパも拾う）。
- **⚠️ グリッド／フレックスの伸びる列は `1fr` ではなく `minmax(0,1fr)`。あわせて中の item に `min-w-0`。**
  **`1fr` は `minmax(auto,1fr)` の略**で、この `auto`（＝ automatic minimum size）は「中身がこれ以上縮められない幅」を下回らない。
  その最小幅を決めるのは**折り返せない最長トークン**（URL・長い英単語・`truncate` の `white-space:nowrap` テキスト）で、
  **日本語や空白区切りの英文は関係ない**（どこでも折り返せるため）。結果、**長い URL を含む記事の行だけ**が
  列ごと横に伸び、**スマホでその行のカードだけ右にはみ出して横スクロールが出る**。PC では列幅に余裕があるので出ない。
  - **実際に起きたこと**（2026-08-09 に報告）: Zenn「AIに渡す前の秘密情報チェックからセキュリティ対策の可視化まで
    できるデスクトップアプリを作ってみた（shk Desktop）」の抜粋に **51文字の URL**
    （`https://zenn.dev/kazuki_tam/articles/6a8217c5418cc4`）が入っていた。375px 幅で本文の枠は約255px しかないので
    約90px はみ出した。同時に **Qiita の「YYYY/M/D主にITとかセキュリティの記事」連載**（リンク集なので
    ほぼ毎日 生 URL を含む）でも発生し、**最悪ケースは98文字の URL でページ横幅が約782px** になっていた。
  - **稀ではない**: 全614件中12件（2.0%）だが、**直近9日のうち7日で発生**していた。抜粋は各サイトの
    記事本文からの機械的な切り出しなので、**URL が混ざるのを止める手段は無い＝CSS 側で受け止めるしかない**。
  - **修正の内訳と役割**（どちらか一方では足りない）:
    | 直したもの | 何を防ぐか |
    | --- | --- |
    | `grid-cols-[…_minmax(0,1fr)]`（`index.astro`） | **トラック（列）**が中身の最小幅まで広がるのを止める |
    | ラッパ `div` の `min-w-0`（`index.astro`） | **グリッド item 自身**が `min-width:auto` でトラックを超えて広がるのを止める |
    | 抜粋 `<p>` / コンパクトの `<h2>` の `break-words`（`FeedCard`・`TweetCard`） | 枠内で URL を途中改行させる。**無いと `line-clamp` の `overflow:hidden` に黙って切り取られる**（はみ出しは止まるが読めなくなる） |
  - ⚠️ **`break-words`（`overflow-wrap:break-word`）だけでは列の伸びは止まらない。** これは「行に収まらない語を
    やむを得ず折る」指定で、**要素の min-content 幅（＝列の最小幅の計算）を下げない**。`hero` の `<h2>` には
    以前から `break-words` が付いていたのに、はみ出しは起きていた。**幅を止めるのは `minmax(0,…)` と `min-w-0` の側。**
  - ⚠️ **`truncate` は安全弁ではない。** `white-space:nowrap` を含むので、**文字列全体が1個の折り返せないトークン**に
    なる（例: HackRead の `author` は57文字）。`overflow:hidden` のおかげで実害は出ていないが、
    新しく `truncate` を足すときは**祖先に `min-w-0` があるか**を確認すること。
  - **新しくカード／レイアウトを足すときは、375px で「抜粋に URL が入った記事」を1件見て、
    横スクロールが出ないことを確かめる。** 判定用のクエリ:
    ```bash
    # 抜粋に38文字以上の折り返せない塊（URL 等）を含む記事＝375px の hero で桁溢れする条件。
    # jq はこの環境に入っていないので node で書いてある。
    node -e "JSON.parse(require('fs').readFileSync('src/data/feed.json','utf8')).items.filter(i=>i.thumbnail&&/[!-~]{38,}/.test(i.summary||'')).forEach(i=>console.log(i.source,'|',i.title.slice(0,40)))"
    ```
- **`localStorage` に保存しているものの一覧**（増やすときはここに1行足す。**キー名は必ず `todaysec:` 接頭辞**）:

  | キー | 値 | 用途 | 読み書きしている場所 |
  | --- | --- | --- | --- |
  | `todaysec:lang` | `"ja"`（既定） / `"orig"` | 「日本語 / 原文」表示トグル | `SourceFilter.astro` の `<script>` |

  - ⚠️ **フィルタの選択状態は保存していない**＝再訪時は必ず「すべて」に戻る（意図的）。
  - （履歴）旧キー `todayai:lang` は移行せず放置してよい＝読み取らないので影響しない。
    かつて `todaysec:filter`（フィルタ列の折りたたみ状態）を追加したが、
    折りたたみ機能ごと取りやめたので**このキーは使っていない**（`docs/decisions.md` 項目23）。
- **⚠️ 固定（sticky）されるのはヘッダーだけ。フィルタバーは sticky にしない**＝スクロールすると
  画面外へ流れる。チップが9個でスマホ幅では4行前後に折り返すため、固定すると**その分だけ
  記事の表示領域が常時削られる**（実測 375px 幅で約190px）。**「縦が狭い」と感じたときに
  フィルタを固定し直さないこと**＝それが狭さの原因だった（`docs/decisions.md` 項目23）。
- **sticky オフセットは JS 実測の CSS 変数**（旧来の `top-[57px]` 手書きマジックナンバーは廃止）:
  `globals.css` の `:root` に `--header-h`（ヘッダー高）をフォールバック値付きで定義し、
  **`Layout.astro` の `<script>`** が `#app-header` を実測して上書きする
  （初回＋`window.resize`＋`document.fonts.ready`＋`ResizeObserver`）。
  消費側は日付見出し（`index.astro`）の `top-[var(--header-h)]` だけ。
  ヘッダーに `id="app-header"` が必要。**フォント読込でヘッダー高が変わる**ので実測必須。
  - ⚠️ **変数は1つだけ**。かつて `--stack-h`（ヘッダー＋フィルタ高）もあったが、フィルタバーの
    sticky をやめて不要になったので廃止した。測定も `SourceFilter.astro` から `Layout.astro` へ
    移してある（フィルタの有無と無関係になったため。フィルタ側に置いたままだと
    「フィルタを消すと日付見出しがずれる」という無関係な依存が残る）。
- **ヘッダーの sticky 面は `.sticky-surface`**（`globals.css`）: 既定は不透明 `--color-bg`、`@supports (backdrop-filter)` のときだけ frosted（`color-mix` 半透明＋blur）に格上げ。backdrop-filter 非対応や `prefers-reduced-transparency` でも背後のカードが透けない。**フィルタバーには付けない**（sticky ではないので背後に何も重ならない）。**カード `<article>` には `isolate`（`isolation:isolate`）必須**（`FeedCard`/`TweetCard`）: 付けないと内部の `z-10`/`z-20`（オーバーレイ `<a>` と本文 `div`）がルートのスタッキングコンテキストへ漏れ、**sticky な日付見出し（`z-[5]`）やヘッダー（`z-20`）の上に**カード本文が描画されてタイトルがバー上にブリードする。（元々は `z-10` の sticky フィルタとの間で起きた問題だが、フィルタの sticky をやめても**日付見出しとの間で同じことが起きる**ので `isolate` は今も必須。）



---

## 参照先（常時ロードから外した記録）

以下は毎セッション読み込む必要がないため別ファイルへ移した。**内容は移動しただけで削っていない。**

- [`docs/history-todayai.md`](docs/history-todayai.md) — todayai 時代（7ソース・AI 情報）のスナップショット。
  ⚠️ **現状と食い違う場合はこの CLAUDE.md が正**（例: Qiita は RSS ではなく API v2 が主経路）。
  個々のソースの設計理由・障害記録として価値があるため保持している。
- [`docs/fork-changes.md`](docs/fork-changes.md) — フォーク元 `satory074/todayai` からの変更点の一覧。
  **フォーク元の URL やアカウント名のハードコードが複数あった**ので、同種の残骸を見つけたら
  同じ方針（自分のリポジトリを指すよう修正）で直す。

---

## 説明と確認のルール

### 目的
依頼者は開発の専門家ではない。内容を理解できないまま承認してしまうことを防ぐため、
以下を守ること。判断を代わりに行うのではなく、私が判断できる状態にすることを目的とする。

### 実行前の説明
Bash コマンドを実行する前、および設計上の選択をする前に、
必ず通常の会話として以下を日本語で提示し、承認を得てから進むこと。

1. 何をするのか（専門用語には必ず説明を添える）
2. 推奨と、その理由（必ず含める。「どうしますか」だけの問いかけは禁止）
3. 承認しなかった場合どうなるか
4. 元に戻せるか（可逆／不可逆）

ツール実行ダイアログが出た後に私へ質問しないこと。

### 確認をまとめること
1つの依頼に対して確認を何度も分割しないこと。
必要な確認は最初にまとめて提示し、以降は承認された範囲で進めること。

### 記憶が育つにつれて
記憶に同一のケースがある、または記憶にある判断の理由から今回の扱いが
推論できる場合は、確認を省いて実行してよい。
その際は判断根拠を一行添えて事後報告すること。

### 記憶が育っても必ず確認すること
- 不可逆または外部に影響する操作（削除、公開、送信、課金）
- 過去の判断と矛盾する可能性があるもの

### 判断の記録
私が判断を示したら、以下を記憶すること。
- 何を判断したか
- 私が述べた理由（原文に近い形で）
- どこまでが同種で、どこからが別か（境界）

### 承認済み操作の登録
私が承認した操作のうち、今後も同条件で繰り返されると判断できるものは、
`.claude/settings.local.json` の allow への追加を提案すること。
ワイルドカードは使わず、承認された範囲に限定すること。
不可逆・外部影響のある操作は登録しないこと。

### 私が「分からない」と答えたら
前提から説明し直すこと。専門用語を避け、必要なら例えを使うこと。
