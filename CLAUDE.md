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
- **費用は完全に 0 円**。記事の取得はすべて公開 RSS（トークン不要）。
  Gemini は**無料枠の範囲で翻訳にだけ使う**（英語ソースのみ・1日4〜6リクエスト程度）。
  X API / Gmail API は使わない。
- **位置づけ**: 運用者は開発未経験。**個人の学習目的**のサイトであり、特定の組織を代表するものではない。

### 現在有効なソース（8ソース）

| source | 内容 | 取得元 |
| --- | --- | --- |
| `qiita` | Qiita「Security」タグ・「認証」タグ | 公開 RSS（複数 URL・トークン不要） |
| `zenn` | Zenn「security」トピック | 公開 RSS（トークン不要） |
| `hatenablog` | セキュリティ専門のはてなブログ3本（piyolog / Fox on Security / GMO Flatt Security） | 公開 Atom（複数 URL・トークン不要） |
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
**実装・設計の詳細は削除前のコミット `c5c9547` を参照**（`git show c5c9547:scripts/sources/<name>.ts`）。
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
- フィードは10件（約3日分）しか返さない＝BleepingComputer（約2日分）と並んで
  取りこぼしリスクが高い部類。

## Commands

```bash
npm install
npm run aggregate   # 有効なソースを取得 → src/data/feed.json を再生成（disabled のソースはスキップ）
npm run dev         # http://localhost:4321/todaysec/（feed.json をそのまま表示。集約はしない）
npm run build       # 本番ビルド。Astro グラフの型チェック込み
npm run typecheck   # astro check。tsconfig が **/* を含むので scripts/ も型検査される
npm run enrich:xlinks           # X 項目の t.co をリンクプレビュー（OGP カード）に補完（他ソース非取得・トークン不要。後述）
npm run enrich:xlinks -- --fresh  # 負キャッシュ（null）を一掃して未補完分を再試行

npx tsx scripts/generateOgImage.ts  # OGP 画像 public/og-default.png を再生成（後述）
```

- **テストフレームワークは無い。** 検証は `npm run build` / `npm run typecheck` と、`npm run aggregate` の実行ログ（`✅ feed.json 更新: 計N件 (X=.. / Zenn=.. / Qiita=.. / はてなブログ=..)`）で行う。
- **型チェックの落とし穴**: `npm run build` は Astro が import するファイルしか型検査しない。`scripts/aggregate.ts` と `scripts/sources/*` は Astro グラフ外なので、scripts を変更したら **`npm run typecheck`（astro check）で確認する**こと（tsconfig の `include: ["**/*"]` が拾う）。scripts は `tsx` で実行され、tsx は型を消すだけで検査しない。
- **現在の構成では `.env` もトークンも不要**（有効な 3 ソースはすべて公開 RSS）。温存している X / 翻訳をローカルで試す場合のみ `cp .env.example .env` してトークン（`X_BEARER_TOKEN` / `GEMINI_API_KEY`）を記入する。

## フォーク元（satory074/todayai）からの変更点

改造で加えた変更の記録。**フォーク元の URL やアカウント名がハードコードされている箇所が複数あった**ため、
同種の残骸を見つけたら同じ方針（自分のリポジトリを指すよう修正）で直すこと。

| ファイル | 変更内容 |
| --- | --- |
| `astro.config.mjs` | `repoName` を `todayai` → `todaysec`、`ghUser` の既定値を `satory074` → `tomoraku5` |
| `src/lib/url.ts` | `SITE_ORIGIN` のハードコード（`https://satory074.github.io`）を廃止し、`import.meta.env.SITE`（＝ `astro.config.mjs` の `site`）を参照する形に変更＝二重管理の解消。`.ts` なので `Astro.site` は使えず `import.meta.env` 経由 |
| `public/robots.txt` | Sitemap URL を `https://tomoraku5.github.io/todaysec/sitemap-index.xml` に修正（静的配信ファイルなので config は参照できず直接記述） |
| `feeds.config.ts` | `qiita` / `zenn` を `rssUrl`（単一）→ **`rssUrls`（配列）** に拡張。1ソースに複数タグ/トピックを束ねられる。**`limit` は「1 URL あたり」**の取得窓（合計ではない）＝ URL を足しても既存フィードの取り込みが痩せない |
| `scripts/sources/rss.ts` | 複数 URL 対応。**URL ごとに個別 try/catch**（1本落ちても残りは取り込む）。日本語タグ URL を `toRequestUrl()` で正規化（後述の gotcha） |
| `src/lib/feed.ts` | `SOURCES` から無効ソースを除外（現在は `x` のみ温存）。`FeedSource` のユニオン型・CSS・`feeds.config.ts` は残してあるので、**配列に行を戻すだけで復活する**（戻し方は `SOURCES` 直上のコメント） |
| `src/styles/globals.css` | **ロゴ専用の CSS 変数** `--color-logo` 系（エメラルドグリーン `#0f9b6c`）を追加。サイト全体のアクセント `--color-accent`（コバルト `#2f5fff`）は**変更していない**＝フィルタチップ・hover は青のまま |
| `scripts/sources/*.ts` | 外部へ送信する **User-Agent** を `todayai` → `todaysec` に変更。特に `ogp.ts` は `+https://satory074.github.io/todayai/`（クローラー説明ページを示す慣習）が他人のサイトを指していたため自サイトへ修正 |
| 表示系（`Layout` / `index` / `about` / `rss.xml.ts` / `package.json`） | サイト名を `today.ai` → `today.security`、見出しを「セキュリティ情報フィード」に。フッターにあったフォーク元作者サイト（`satory074.com/apps`）への固定逆リンクバーを削除し、その分の下部余白を圧縮 |

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
> 有効なのは **Zenn / Qiita / はてなブログ / The Hacker News / Dark Reading / BleepingComputer / The Register / HackRead** の 8 つ。

- **【現在は無効】X**: X API を**叩かない**。自分のデータは basecamp 公開 JSON（`storage.googleapis.com/basecamp-feeds/x-tweets.json`）を読むだけ（トークン・課金不要、basecamp の OAuth と競合しない）。`x.accounts` の外部アカウントのみ X API **App-only Bearer**（`X_BEARER_TOKEN`）+ `since_id` 増分。OGP サムネは `scripts/sources/ogp.ts` で解決し `state.xOgImages` にキャッシュ。**本文が t.co リンクのツイートはリンク先の OGP カードを `linkPreview` として補完**（`enrichXLinks`。両取得経路を横断。後述）。表示は `TweetCard.astro`（ツイート風＋リンクプレビューカード）。
  - **著者アイコン(avatar)/実名/@handle**: basecamp 公開JSON は元ツイートの著者を持たず `author` が `"ブックマーク"` 等の固定ラベルになる。これを **syndication（`scripts/sources/syndication.ts` の `fetchTweet`＝`cdn.syndication.twimg.com`・無料・トークン不要）** で解決し `FeedItem.avatarUrl`（`_400x400`化）/`authorName`/`author=@handle` を補完（`xOgImages` と同じ state永続キャッシュ＋毎回再適用＋新規は `authorMaxNew` 件/run の段階補完＋トリム後 prune パターン、`state.xAuthors`）。外部アカウントは X API の `expansions=author_id&user.fields=profile_image_url,name` で同様取得。`TweetCard.astro` は `avatarUrl` があれば丸枠に `<img>`（`onerror` でイニシャル/Xロゴへフォールバック）、無ければ従来の代替アイコン。**⚠️ syndication 直叩きは residential IP(ローカル)なら解決でき、CI(datacenter IP)では弱い可能性**（datacenter IP からの直叩きという制約。ただし 403 リスクは低い）。ローカル `npm run aggregate` で埋めた `state.xAuthors` は CI でも毎回再適用＝永続化される。
- **【有効】Zenn / Qiita**: 公開 RSS を共有ヘルパー `scripts/sources/rss.ts` の `fetchRss({rssUrls, source, limit})` で直接取得（`rss-parser`、トークン不要）。**現在の取得先はセキュリティ関連**:
  - Zenn = `zenn.dev/topics/security/feed`（`zenn.rssUrls`）
  - Qiita = `qiita.com/tags/security/feed` ＋ `qiita.com/tags/認証/feed`（`qiita.rssUrls`）

  **`rssUrls` は配列**＝1ソースに複数タグ/トピックを束ねられる（改造で `rssUrl` から拡張）。**URL ごとに個別 try/catch** するので1本が 404 等で落ちても残りは取り込まれる。全 URL が失敗しても throw せず、`aggregate.ts` がブロック先頭で積んだ前回キャッシュがそのまま残る。**`limit` は「1 URL あたり」**の取得窓（合計ではない）＝ URL を足しても既存フィードの取り込み量が痩せない。それぞれ独立タブ `source: "zenn"` / `"qiita"`。
  - ⚠️ **日本語タグ URL の扱い**: `qiita.com/tags/認証/feed` を生のまま渡すと rss-parser は `Request path contains unescaped characters` で失敗する（ブラウザや `fetch` と違い Node の http クライアントは自動エンコードしない）。`rss.ts` の `toRequestUrl()` が WHATWG `URL` に通してパーセントエンコードするので、**設定ファイルには読みやすい生の日本語のまま書いてよい**。
  - （履歴）todayai 時代は Zenn「AI」トピック／Qiita「AI」タグだった。さらにその前の「Feedly」（AI 関連 RSS 8本まとめ集約）は廃止済み。
- **【有効】はてなブログ（`hatenablog`）**: セキュリティ専門のはてなブログの公開 Atom を、**Zenn/Qiita と同じ `fetchRss`（`rssUrls` 配列）で取得**する（設定構造が同一なので専用パーサは作らず `aggregate.ts` の同じループに相乗り）。
  - ⚠️ **はてなブログには「全ブログ横断で特定タグの新着を取る」フィードが存在しない**。`hatenablog.com/tag/<tag>` は `hatena.blog/tag/<tag>` へ 301 したうえで **404**。`/feed`・`?mode=rss`・`.rss`・`/tags/`・`/topic/`・`/g/`・`blog.hatena.ne.jp/-/search` もすべて 404（実アクセスで確認済み）。横断で取れるのは **はてなブックマークの検索 RSS**（`b.hatena.ne.jp/q/<word>?mode=rss`・RSS 1.0・40件）だけだが、これはブログ記事ではなくブックマーク＝別サービスの `hatena` 枠と同じもの。**タグ横断を再検討するときは、この 404 の事実から確認し直すこと。**
  - そのため**個別ブログのフィードを列挙**している（`feeds.config.ts` の `hatenablog.rssUrls`）。ブログを増やすときは配列に足すだけ。候補探しは「はてブ検索 RSS でセキュリティ関連語を引き、はてなブログ系ドメインのホストを集計する」方法が有効（推測より確実）。
  - フィードは Atom で `title` / `link` / `isoDate` / `contentSnippet` / `author` を持つが、**`enclosure` も `media:thumbnail` も無い**＝サムネはフィードから取れない。よって `enrichArticles` の対象に含め、記事ページの og:image から補完している（Zenn/Qiita と同じ）。
  - `contentSnippet` が非常に長い（piyolog は 1万字超）が、`rss.ts` の `snippet()` が 200 字に切るので問題ない。
  - **バッジ色は `--color-hatenablog: #7c3aed`（バイオレット）**。はてブの青 `#1f7fc2`・Zenn の水色・Qiita の黄緑・ロゴのエメラルドのいずれとも色相を 36°以上離してある。
- **【有効】The Hacker News（`thehackernews`）**: 英語のセキュリティ専門ニュース。これも `fetchRss`（`rssUrls` 配列）で取得する。
  - ⚠️ **Y Combinator の Hacker News（`news.ycombinator.com`）とは別サービス**。key を `hackernews` にしないこと。
  - **サイト側の `/rss.xml`・`/atom.xml`・`/feeds/posts/default` はすべて FeedBurner（`feeds.feedburner.com/TheHackersNews`）へリダイレクトする**（実測）。実質フィードは1本しかないので、リダイレクトを1回減らすため設定には最終 URL を直接書いている。裏を返すと **FeedBurner が止まると代替経路が無い**（サイト固有 URL も同じ先を指すため）。
  - RSS 2.0。`title` / `link` / `isoDate` / `contentSnippet`（約400字）/ `author` に加え、**`enclosure` にサムネイル画像が付く**（Blogger の CDN）。よってはてなブログと違い og:image 補完は不要で、全件がヒーローカードになる。
  - **約10件/日**（実測: 50件が約5日分）。cron 6時間ごと＝1 run あたり ~2.5件なので `limit: 20` で十分な余裕。フィードが50件返すので数 run 落ちても取りこぼさない。
  - 記事ページは **UA を付けた fetch で 200 が返り、本文も 7,000〜10,000 字抽出できる**（実測）＝将来 `translate` を有効化したときの3行要約も機能する。そのため `enrichArticles` の対象セットに含めてある（サムネ済み item は fetch されないので現状のコストは増えない）。
  - **唯一の英語ソース**。翻訳が無効な現在は英語の見出しがそのまま日本語記事に混在する。タイトルは 56〜100 字程度で、ヒーローカードの `h2` に `break-words` が効くため折り返しは崩れない。
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
  - ⚠️ **フィードが 15 件しか返さない**（THN・Dark Reading は 50、はてなブログ 30、Zenn/Qiita 20）。平日 約8件/日なので**約2日分しか遡れない**＝**CI が2日以上止まると取りこぼす**。6時間ごとの cron なら 1 run あたり ~2件で十分。`limit: 20` はフィード件数を上回るので実質「全件取り込む」設定。
  - ⚠️ **フィードにサムネが無い**（`enclosure` も `media:*` も無い）。他の英語2ソースと違い、**サムネは `enrichArticles` の og:image 補完に完全に依存する**。記事ページは UA 付き fetch で 200・og:image あり・本文 6,600〜9,000字（実測）なので機能するが、ここが失敗すると画像なしのコンパクト行になる。
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
| 4 | `scripts/sources/<key>.ts` | 取得して `FeedItem[]` を返す関数。**公開 RSS/Atom なら新規作成は不要**で、`rss.ts` の `fetchRss({rssUrls, source, limit})` をそのまま流用できる（設定を `rssUrls` 配列にすれば `aggregate.ts` の既存ループに相乗りするだけで済む） |
| 5 | `scripts/aggregate.ts` | 取得ブロック（`rssUrls` 形式なら既存ループの配列に `<key>` を足すだけ）。**末尾の `counts` オブジェクトと完了ログにも `<key>` を追加**（忘れると集計に出ない） |
| 6 | `feeds.config.ts` の `translate.summarizeSources` | ⚠️ **原則さわらない（現在は意図的に空）。** 空＝「非日本語のときだけ翻訳」で、日本語記事は API を呼ばない。ここにソースを足すと**そのソースは原文の言語を問わず3行要約**になり、日本語記事まで Gemini を消費する（入力が記事本文になるためトークンも約16倍）。要約を使いたいと決めたときだけ足し、**同時に `aggregate.ts` の `ENRICH_VERSION` を上げる**（上げないと翻訳済みキャッシュが再生成されない） |
| 7 | `scripts/sources/enrichArticles.ts` の呼び出し（`aggregate.ts` 内） | **記事系なら基本は対象セットに追加する。** この関数は2役: ①サムネが無い item の og:image 補完、②要約を有効化したときの本文テキスト取得。**フィードにサムネがあっても ② のために入れておく**（サムネ済み item は fetch されないのでコストは増えない）。追加前に**記事ページが UA 付き fetch で 200 を返すか実測する**（拒否するサイトがある） |
| 8 | `feeds.config.ts` の `retentionMax` | 投稿頻度から決める。既定 1000 は約10件/日なら3ヶ月分。物量が桁違いなソースだけ調整すればよい（ソース別枠なので他を押し出さない） |

### 2. 自動で追従するもの（手を入れない）

`SOURCES` 配列を直せば、以下は**放っておいても正しくなる**。ここを手で書き換えると二重管理になる。

- **トップの説明文 / フッター / `<meta name="description">`** … `sourceListText()` が `SOURCES` の label を連結する
- **フィルタチップ**（`SourceFilter.astro`）… `SOURCES` を map している
- **about ページの情報源カード** … `SOURCES` の `label` / `badgeClass` / `description` から生成
- **RSS（`rss.xml.ts`）の description とアイテムのソース名** … 同上
- **カードのバッジ**（`FeedCard` / `TweetCard`）… `sourceMeta()` 経由
- **「日本語 / 原文」トグルの表示可否** … `hasAnyTranslation(items)` 次第（翻訳データが増えれば勝手に出る）

### 3. 手で更新が必要なもの（★ ここが漏れやすい）

- [ ] **`README.md`** … 冒頭の説明文、「収集しているソース」の表と**見出しの「有効（N ソース）」の数字**、「構成」の記述
- [ ] **`CLAUDE.md`** … 「現在有効なソース」の表と**その見出しの「（N ソース）」**、「ソース別の要点」に取得元固有の落とし穴（フィード形式・サムネの有無・URL の癖）、**同節の凡例にある有効ソースの列挙**（`> 有効なのは … の N つ`。ここは自動生成されないので必ずズレる）
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
  - 残してある理由: 英語ソースの新着比率が約80%あり、蓄積が進んで日本語記事が埋没したときに再び必要になりうる。作り直しを避けたい。
  - 一緒に残っている実装: 判定 `isTranslated(item)`（`src/lib/feed.ts`）、記事側の目印 `data-orig-lang="ja" | "translated"`（`index.astro` の行ラッパ）、フィルタ JS の `kind === "lang"` 分岐（`SourceFilter.astro`）。**チップが無くても副作用はない**（JS はチップの `data-filter-kind` を見るだけで、「日本語」チップの存在を前提にしていない）。
  - ⚠️ **`isTranslated` / `hasAnyTranslation` はこのチップ専用ではない。** 「日本語 / 原文」トグルの表示条件（`hasAnyTranslation`）と `BilingualText` の表示判定（`hasBilingual`）に使われているので消さないこと。
  - フィルタの選択状態は `localStorage` に保存していない（保存しているのは表示言語トグルの `todaysec:lang` だけ）。よって「日本語」を選んだ状態で再訪して壊れる、という経路は存在しない。
- **⚠️ バッジ色: ΔE の基準は8色目で破綻したが、方針として「個別色を続ける」と決めた。**
  - かつての合格基準は「**既存どうしの最小色差 ΔE = 58.3（Qiita↔ロゴ）を上回る**」。7色目（BleepingComputer）までは満たせた（ΔE 59.9〜75.4）。
  - **8色目 The Register = ΔE 48.3**（最近接 Zenn）、**9色目 HackRead = ΔE 47.4**（最近接 The Register / BleepingComputer 47.5 / THN 50.1）。**2回連続で基準未達**。明度・彩度も動かして全色相を総当たりしても上限は 48 前後で、**色相環は 360°しかなく AA 4.5:1 を満たす明度帯も限られるため、これは努力で解決できない**。
  - **それでも個別色を続ける**（グループ配色へは移行しない）。理由: **バッジには常にソース名の文字が入る**ので、色は「判別の主役」ではなく補助的な手がかりに留めればよい、と割り切った。
  - **新色を選ぶときの実務ルール**（チェックリスト項目2にも記載）: ①AA 4.5:1 以上、②既存の明度感（コントラスト 4.6〜6.6）に収める、③総当たりで最大 ΔE を取り、**何色目で・どの色と・どれだけ近いかをコメントに記録する**。色相が埋まっていたら**彩度で差をつける**（例: HackRead は彩度 30% で、近い色相の THN 74% / BleepingComputer 100% と差別化）。
  - （参考）グループ配色（国内/海外メディアで数色を共有）は検討したが**採用しなかった**。移行するなら `SourceMeta` に `group` を足して `badgeClass` をグループ由来にするだけで済む＝SOURCES 駆動の自動追従はそのまま使える。方針を変えるときの選択肢として記録しておく。

- **ビジュアルは「朝刊（Daily Briefing）」ライトテーマ**（ペーパー白 `#f6f7f9` ＋白カード ＋ インク文字 ＋ コバルト `#2f5fff`）。配色トークンは `globals.css` の `@theme` に集約。見出しは Space Grotesk、時刻・ソース名は IBM Plex Mono（ティッカー風）。
- **ロゴだけ別系統の色**（`--color-logo` 系＝エメラルドグリーン `#0f9b6c`）: `--color-accent`（コバルト）はフィルタチップ・言語トグル・カード hover が共有しているため、ロゴを変えるとサイト全体が巻き込まれる。**ロゴ専用変数に分けてあるので、ロゴの色を変えるときは `--color-logo` だけを触ること**（使用箇所は `Layout.astro` のバッジ背景＋glow とワードマークの2箇所）。なお Tailwind v4 は**実際に使われている `@theme` 変数しか CSS に出力しない**ので、`--color-logo-bright` / `-deep` は定義済みでもビルド後の CSS には現れない（`--color-accent-deep` も同様。不具合ではない）。
- **カードはハイブリッド分岐**（`FeedCard.astro`）: X は `TweetCard`、それ以外は `item.thumbnail` の有無で **ヒーローカード** か **コンパクト行** に分かれる。ヒーローはモバイルで画像上＋本文下の縦積み、`sm:` 以上で `flex-row` の**画像左（`sm:w-[14rem]`）＋本文右**の横並びになる。OGP 補完でサムネ網羅率が上がるとヒーローが主役になる。**サムネ枠は全ブレークポイントで `aspect-video`（16:9）固定＋`sm:self-start`（上揃え）**＝カード全高に引き伸ばされない（横長 OGP が縦長クロップで崩れるのを防ぐ）。**カード外枠は `rounded-none`（直角）**＝バッジのピル・X アバターの丸・フィルタチップのピルは丸のまま、カード面だけ角。
- **コンテナ幅**は `Layout.astro` の `max-w-[46rem] lg:max-w-[58rem]`（モバイル～タブレットは 46rem、`lg:`≥1024px で 58rem に広げて PC で横を使う）。ヘッダー/フィルタ/日付見出しもこの幅に従う。
- **二言語表示（日本語／原文トグル）**: 翻訳が有効なので**英語ソースには日本語訳が付き、トグルが機能する**（日本語記事は訳が無いので素のまま＝トグルの影響を受けない）。トグル自体は `hasAnyTranslation(items)` が true のときだけ描画される。`FeedItem` の `titleJa`/`summaryJa`（集約時に Gemini 補完）が原文と別に入る。表示は `BilingualText.astro`（`ja!==orig` のとき `.lang-ja` と `.lang-orig` の両 span を出力、翻訳なしは素テキスト）。`SourceFilter.astro` 右端の「日本語／原文」トグルが `:root.show-orig` クラスを切り替え、CSS（`globals.css` の `.lang-orig`/`:root.show-orig .lang-ja`）で全カードを一斉に出し分ける。選択は `localStorage("todayai:lang")` に永続。**フィルタ（`.is-hidden`）とは独立したクラストグルで競合しない。** 既定は日本語（クラス無し）。
- **`index.astro` は日付グルーピング＋タイムレール**: 各アイテムを `grid-cols-[auto_1fr]` で包み、左列に等幅 `HH:MM`＋縦ヘアライン（シグネチャ）。**この包み `div` に `data-feed-item`＋`data-source` を付け、フィルタ（`SourceFilter.astro` の `<script>`）はこのラッパに `.is-hidden` をトグルする**（`article` 単体ではなく行ごと出し分けるため。`[data-source].is-hidden{display:none}` がラッパも拾う）。
- **sticky オフセットは JS 実測の CSS 変数**（旧来の `top-[57px]`/`top-[112px]` 手書きマジックナンバーは廃止）: `globals.css` の `:root` に `--header-h`/`--stack-h`（= ヘッダー高 / ヘッダー＋フィルタ高）をフォールバック値付きで定義し、`SourceFilter.astro` の `<script>` が `#app-header` と `#source-filter` を実測して上書きする（初回＋`window.resize`＋`document.fonts.ready`＋`ResizeObserver`）。フィルタは `top-[var(--header-h)]`、日付見出し（`index.astro`）は `top-[var(--stack-h)]`。**フィルタは `flex-wrap` で行数が変わる**ので固定値だと幅が狭いと崩れる＝実測必須。ヘッダーに `id="app-header"` が必要。
- **ヘッダー／フィルタの sticky 面は `.sticky-surface`**（`globals.css`）: 既定は不透明 `--color-bg`、`@supports (backdrop-filter)` のときだけ frosted（`color-mix` 半透明＋blur）に格上げ。backdrop-filter 非対応や `prefers-reduced-transparency` でも背後のカードが透けない。**カード `<article>` には `isolate`（`isolation:isolate`）必須**（`FeedCard`/`TweetCard`）: 付けないと内部の `z-10`/`z-20`（オーバーレイ `<a>` と本文 `div`）がルートのスタッキングコンテキストへ漏れ、`z-10` の sticky フィルタの**上に**カード本文が描画されてタイトルがバー上にブリードする。


---

## 補足（親インデックス `../CLAUDE.md` から移行、2026-07-14）

> ⚠️ **この節はフォーク元 todayai 時代のスナップショット**（7ソース・AI 情報・トークン利用前提）。
> 上の節と内容が重複しており、**現状と食い違う場合は上の記述が正**。
> 個々のソースの設計理由・障害記録として価値があるため削除せず残している。
> 現在有効なのは Zenn / Qiita の 2 ソースのみ、トークンは一切不要、公開 URL は
> `https://tomoraku5.github.io/todaysec/`（ローカルは `http://localhost:4321/todaysec/`）。

Astro 5, Tailwind v4, TypeScript, GitHub Pages 静的サイト。

（todayai 時代）X・Zenn「AI」・Qiita「AI」・はてなブックマーク・Google Workspace Updates・LayerX Newsletter(Gmail経由)・Google Cloud リリースノート の7ソースから AI 関連情報を集約していた。**現在はこのうち Zenn / Qiita のみ残し、セキュリティ向けに差し替え＋はてなブログを追加した3ソース構成**。

```bash
npm install
npm run aggregate  # 7ソースを取得して src/data/feed.json を生成（トークン無いソースは自動スキップ）
npm run dev        # http://localhost:4321/todayai/   ← 現在は /todaysec/
npm run build      # 本番ビルド（型チェック込み）
```

**アーキテクチャ**: GitHub Actions（cron 6時間ごと、`.github/workflows/update-and-deploy.yml`）が `scripts/aggregate.ts` を実行→7ソースを `FeedItem` に正規化→`src/data/feed.json` をコミット→Pages デプロイ。各ソースは個別 try/catch で、失敗時は前回キャッシュを維持（graceful degradation）。ソース定義は `feeds.config.ts`。

**Gotcha**:
- X取得は2系統（`feeds.config.ts` の `x`）: (a) **自分のデータ**は basecampの公開JSON（`storage.googleapis.com/basecamp-feeds/x-tweets.json`）から `x.categories`（post/like/bookmark、既定は bookmark）で取得＝トークン・課金不要。(b) **外部アカウントのポスト**は `x.accounts` に列挙し、X API **App-only Bearer Token**（Secret `X_BEARER_TOKEN`）+ `since_id` 増分取得（`state.xAccountSinceIds` に永続化）で新着のみ課金（Non-owned Read $0.005/件）。App-only Bearer は固定トークンなので basecamp の OAuth2 refresh token と競合しない。aggregate は外部アカウント分のみ前回キャッシュを保持し、ブックマークは毎回フレッシュ置換。
- **Zenn / Qiita はトークン不要**: Zenn「AI」トピック（`zenn.dev/topics/ai/feed`）と Qiita「AI」タグ（`qiita.com/tags/ai/feed`）の公開 RSS を、共有ヘルパー `scripts/sources/rss.ts` の `fetchRss({rssUrl, source, limit})` が rss-parser で直接取得（`limit` で件数を抑制、取得失敗時は前回キャッシュへフォールバック）。それぞれ独立タブ `source: "zenn"` / `"qiita"` で表示。設定は `feeds.config.ts` の `zenn` / `qiita`。（かつての「Feedly」= AI 関連 RSS 8本まとめ集約は廃止。この2フィードだけ独立ソース化した）
- **機械翻訳／3行要約（原文→日本語）**: 集約時に各アイテムの `title`/`summary` を Gemini REST API（`scripts/sources/translate.ts` の `enrichTranslations`、`fetch` のみ）で1回のバッチ呼び出しで日本語補完。`titleJa`=非日本語タイトルの翻訳。`summaryJa` はソースで分岐し、記事系（`translate.summarizeSources`。**現在は空**）の十分な長さの抜粋は**原文の言語を問わず生成AIで3行要約**、その他（X 等）は summary を翻訳。日本語判定は `isJapanese()`。`state.translations` に永続キャッシュ、生成ロジック変更時は `aggregate.ts` の `ENRICH_VERSION`↔`state.enrichVersion` 不一致で旧キャッシュを破棄して再生成。表示はフィルタバー右端の「日本語／原文」一括トグル（`:root.show-orig` クラス＋`localStorage`、`BilingualText.astro`。日本語＝AI要約／原文＝元の抜粋）。
- Secret: `GEMINI_API_KEY`（機械翻訳。**現在有効**。未設定ならスキップされ原文表示になる）、`X_BEARER_TOKEN`（X 用。現在は無効化中の機能向け）。記事の取得元はすべて公開 RSS なのでトークン不要。
- `push` 時は取得＋コミットをスキップ（既存キャッシュでビルド）しコミットループを回避。
- Tailwind v4 + Astro 型不一致は `astro.config.mjs` で `any` キャスト。内部リンクは `src/lib/url.ts` の `siteLink()` 必須（base path は現在 `/todaysec`）。
