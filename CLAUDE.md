# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**today.security** — セキュリティ関連情報を公開 RSS から自動集約し、時系列タイムラインで表示する
Astro 5 + Tailwind v4 の静的サイト（GitHub Pages、base path `/todaysec`）。
公開 URL: `https://tomoraku5.github.io/todaysec/`

- **リポジトリ**: `tomoraku5/todaysec`（Public）
- **フォーク元**: `satory074/todayai`（AI 情報の集約サイト）。本リポジトリはそれをベースに
  セキュリティ情報向けへ改造したもの。**以下のドキュメントには todayai 時代の設計判断・障害記録が
  そのまま残っている**（将来の復活に備えて意図的に保持。無効化した箇所には「現在は無効」と明記する）。
- **費用は完全に 0 円**。X API / Gmail API / Gemini API は**使わない方針**。
  トークン・API キーは一切不要で、公開 RSS だけで動く。
- **位置づけ**: 運用者は開発未経験。**個人の学習目的**のサイトであり、特定の組織を代表するものではない。

### 現在有効なソース（2ソース）

| source | 内容 | 取得元 |
| --- | --- | --- |
| `qiita` | Qiita「Security」タグ・「認証」タグ | 公開 RSS（複数 URL・トークン不要） |
| `zenn` | Zenn「security」トピック | 公開 RSS（トークン不要） |

### 現在無効なソース・機能

`feeds.config.ts` の `disabled: true` で停止中。**コードもドキュメントも削除していない**
（将来復活させる可能性があり、過去の障害と対処の記録として価値があるため）。

| 対象 | 停止した理由 |
| --- | --- |
| `x` | `sourceUrl` がフォーク元作者（basecamp）の公開ブックマーク JSON。X API も有料のため使わない。`x.accounts` は空配列にしてある |
| `layerx` | Gmail OAuth（`GMAIL_CLIENT_ID`/`_SECRET`/`_REFRESH_TOKEN`）が必要 |
| `hatena` | **後日セキュリティ向けに差し替えて復活させる予定**。⚠️ `rssUrl` は IT 人気エントリーのままなので、有効化する前に必ず URL を差し替えること |
| `gcloud` | GCP 全製品のリリースノートでセキュリティ用途に合わない |
| `workspace` | Google Workspace の機能更新情報でセキュリティ用途に合わない |
| `translate`（Gemini 翻訳/要約） | `GEMINI_API_KEY` 未設定。原文のまま表示される（graceful degradation） |
| GCS 保管モード | **未使用**。feed.json は git 保管（ローカルモード）で運用。詳細は `docs/gcs-storage-setup.md` |

## Commands

```bash
npm install
npm run aggregate   # 有効なソースを取得 → src/data/feed.json を再生成（disabled のソースはスキップ）
npm run dev         # http://localhost:4321/todaysec/（feed.json をそのまま表示。集約はしない）
npm run build       # 本番ビルド。Astro グラフの型チェック込み
npm run typecheck   # astro check。tsconfig が **/* を含むので scripts/ も型検査される
# ↓ 現在は無効な X / LayerX 用のローカル補完スクリプト（該当ソースを復活させたときだけ使う）
npm run enrich:layerx           # LayerX 項目にサムネだけ補完（他ソース非取得・トークン不要・要 residential IP。後述）
npm run enrich:layerx -- --fresh  # 負キャッシュを一掃して未補完分を再試行
npm run enrich:xlinks           # X 項目の t.co をリンクプレビュー（OGP カード）に補完（他ソース非取得・トークン不要。後述）
npm run enrich:xlinks -- --fresh  # 負キャッシュ（null）を一掃して未補完分を再試行

npx tsx scripts/generateOgImage.ts  # OGP 画像 public/og-default.png を再生成（後述）
```

- **テストフレームワークは無い。** 検証は `npm run build` / `npm run typecheck` と、`npm run aggregate` の実行ログ（`✅ feed.json 更新: 計N件 (X=.. / Zenn=.. / Qiita=.. / はてブ=.. / LayerX=.. / Workspace=..)`）で行う。
- **型チェックの落とし穴**: `npm run build` は Astro が import するファイルしか型検査しない。`scripts/aggregate.ts` と `scripts/sources/*` は Astro グラフ外なので、scripts を変更したら **`npm run typecheck`（astro check）で確認する**こと（tsconfig の `include: ["**/*"]` が拾う）。scripts は `tsx` で実行され、tsx は型を消すだけで検査しない。
- **現在の構成では `.env` もトークンも不要**（有効な 2 ソースはどちらも公開 RSS）。無効化した X / LayerX / 翻訳をローカルで試す場合のみ `cp .env.example .env` してトークン（`X_BEARER_TOKEN` / `GMAIL_*` / `GEMINI_API_KEY`）を記入する。

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
| `src/lib/feed.ts` | `SOURCES` から無効ソース（x/workspace/layerx/hatena/gcloud）を**一時的に除外**。`FeedSource` のユニオン型・CSS・`feeds.config.ts` は残してあるので、**配列に行を戻すだけで復活する**（戻し方は `SOURCES` 直上のコメント） |
| `src/styles/globals.css` | **ロゴ専用の CSS 変数** `--color-logo` 系（エメラルドグリーン `#0f9b6c`）を追加。サイト全体のアクセント `--color-accent`（コバルト `#2f5fff`）は**変更していない**＝フィルタチップ・hover は青のまま |
| `scripts/sources/*.ts` | 外部へ送信する **User-Agent** を `todayai` → `todaysec` に変更。特に `ogp.ts` は `+https://satory074.github.io/todayai/`（クローラー説明ページを示す慣習）が他人のサイトを指していたため自サイトへ修正 |
| 表示系（`Layout` / `index` / `about` / `rss.xml.ts` / `package.json`） | サイト名を `today.ai` → `today.security`、見出しを「セキュリティ情報フィード」に。フッターにあったフォーク元作者サイト（`satory074.com/apps`）への固定逆リンクバーを削除し、その分の下部余白を圧縮 |

- **cron の扱い**: 改造中は feed.json が AI 記事で埋め戻されるのを防ぐため一時停止していたが、
  **現在は再有効化済み**（`.github/workflows/update-and-deploy.yml` の `schedule`、6時間ごと）。
- **`src/data/feed.json` は一度リセット済み**（AI 時代の蓄積 1206 件 → 0 件）。全ソースが前回分を土台に
  蓄積する設計なので、`disabled` にするだけでは過去のアイテムが残り続けるため。

## Architecture（大きな流れ）

**2フェーズ構成。ビルド時集約と実行時表示が分離している。**

> **現状との差分**: 以下は 7 ソース時代の記述。仕組みは変わっていないが、**現在有効なのは `zenn` / `qiita` の 2 ソースだけ**（他は `disabled`）。

1. **集約（Node/tsx、ビルド前）**: GitHub Actions の cron（6時間ごと、`.github/workflows/update-and-deploy.yml`）が `scripts/aggregate.ts` を実行。7ソースを `FeedItem` に正規化 → 既存 feed.json とマージ → id で重複排除 → publishedAt 降順ソート → **ソース別 `retentionMax` でトリム**（後述の全期間アーカイブ）→ **トリム後の最終アイテムに OGP サムネ補完 → 機械翻訳で日本語補完（いずれも後述）** → feed.json を上書き。
2. **表示（Astro、完全静的）**: `src/pages/index.astro`（と `rss.xml.ts`）が **ビルド時に** feed.json を読み込んで描画する。サイトは**実行時には**一切フェッチしない（SSG）。feed.json がレンダリングの単一の真実。

**feed.json の保管先（`src/lib/feedStore.ts` 読み / `scripts/lib/feedWrite.ts` 書き）**: `GCS_BUCKET` 環境変数で2モードを透過切替（basecamp の `feed-storage.ts` と同方式）。
**【現在はローカルモード】** リポジトリ変数 `GCS_BUCKET` を設定していないため、常に下の「ローカルモード」で動く。GCS モードの記述は将来使う可能性があるため残す（セットアップ手順は `docs/gcs-storage-setup.md`。ただし手順内の GCP プロジェクト名・バケット名はフォーク元のもの＝流用するなら自分の環境で作り直すこと）。
- **ローカルモード（`GCS_BUCKET` 未設定・既定/開発）**: `src/data/feed.json` を fs で読み書き。従来どおり CI（feed-bot）が main にコミット。
- **GCS モード（`GCS_BUCKET` 設定）**: feed.json は **GCS（`gs://<bucket>/feed.json`）が正本**。集約は GCS の public URL を読んでマージ→**ローカルに書き**、ワークフローが **`gcloud storage cp` で GCS へアップロード**（runner プリインストールの gcloud＋`google-github-actions/auth` の WIF。**@google-cloud/storage SDK は使わない**＝SDK の WIF→STS トークン交換が CI の node-fetch で `ERR_STREAM_PREMATURE_CLOSE` するため）。**git にはコミットしない**（6時間ごとのコミットループが消える＝履歴を git の外で全期間保持）。ビルドは GCS の public URL を fetch（読みは認証不要）。`src/data/feed.json`（committed）は GCS 404/障害時の**フォールバック種**として残す。`readFeed` は書き込み直後の読みで `?t=$GITHUB_RUN_ID` を付けて古いエッジキャッシュ（`Cache-Control: max-age=300`）を回避。**ワークフローは全 GCS ステップを `vars.GCS_BUCKET` でゲート**＝リポジトリ変数 `GCS_BUCKET`/`GCP_WIF_PROVIDER`/`GCP_SERVICE_ACCOUNT` を設定するまで現状（ローカルモード）のまま。

**保持ポリシー（全期間アーカイブ・ソース別枠）**: **全ソースがブロック先頭で `cachedFor(cache, source)` を無条件に積んで前回分を土台に蓄積**し、取得できた新着を追記 → dedup（id）で集約する。取得窓が狭い RSS（Zenn/Qiita は `limit:20`）でも過去分が失われない。**年齢トリム（旧 `maxAgeDays`）は廃止**し、各ソースの `retentionMax`（`feeds.config.ts`。newest を残す件数上限）が唯一の上限＝**ソース別枠なので物量の多い LayerX が他ソースを押し出さない**。トリム区間（`aggregate.ts` 末尾）は items をソース別バケットに分けて各 `slice(0, retentionMax)`（`retentionMaxFor()` ヘルパー）→ 再統合。**X も全キャッシュ保持でアーカイブ化**（旧来のブックマーク毎回フレッシュ置換＝上流削除分の purge は廃止）。

**graceful degradation**: 各ソースは `aggregate.ts` 内で個別 try/catch。失敗 or トークン未設定でも、先頭で積んだ前回キャッシュ分がそのまま残り、他ソースだけ更新される。1ソースが落ちても run 全体は成功する。

**`feed.json` の `state`**: run をまたいで持ち越す状態。X 外部アカウントの `since_id`（重複課金回避）、`userIds` キャッシュ、`xOgImages`（X由来 OGP画像の解決キャッシュ）、`xAuthors`（X item id→`{name,handle,avatar?}` の著者解決キャッシュ。`null`＝確認済み著者なしの負キャッシュ。fetch 失敗時は記録せず次回再試行）、`ogImages`（X以外 OGP画像の解決キャッシュ。`""`＝確認済み画像なしの負キャッシュ含む。記事系＋LayerX 共用）、`xLinkCards`（X item id→リンクプレビューカード `{url,title?,description?,image?,domain}` / `null`＝確認済み・カードなしの負キャッシュ。t.co 先の OGP 解決結果。後述）、`translations`（id→`{titleJa?, summaryJa?, linkTitleJa?, linkDescJa?}` の翻訳/要約キャッシュ。`linkTitleJa`/`linkDescJa` は linkPreview の翻訳。毎回フレッシュ取得されるソースでも再生成しないための永続化）、`enrichVersion`（translations の生成ロジック版。`aggregate.ts` の `ENRICH_VERSION` と不一致なら旧キャッシュを破棄して作り直す＝プロンプト/挙動変更を即反映）。

**OGP サムネ補完（記事系: `scripts/sources/enrichOgp.ts`）**: `feed.json` 全体でサムネ付きは少数のため、トリム後の最終アイテムのうち**サムネが無いもの**を、記事 URL から og:image を `resolveOgImage()`（`scripts/sources/ogp.ts` を再利用、リダイレクト follow 済み）で解決して補完する。`state.ogImages` で既知分は再取得せず（負キャッシュ込み）、実行後に現存 id 分だけへ prune。**X は basecamp 公開JSON 経由で `xOgImages` により補完済み**なので対象外。記事系（`zenn`/`qiita`/`hatena`/`workspace`）は**上限なし**（少量）。並列プールは `scripts/sources/util.ts` の `mapLimit`（x.ts と共有）。

**【現在は無効】LayerX サムネ（`scripts/sources/layerxThumb.ts` ＋ `syndication.ts`）— CI では新規取得不可・ローカル補完＋再適用の二段構え**: LayerX の掲載リンクの多くは `x.com`（ツイート）に解決される。x.com はログイン壁で og:image が取れないため、リダイレクト先を判定して **①x.com/status/<id> → 非公式 syndication（`cdn.syndication.twimg.com`＝react-tweet 方式・無料）でツイートのメディア画像、無ければ本文リンク先の og:image を解決**、②それ以外 → 通常の og:image、という**ハイブリッド**で解決する。**⚠️ ただし CI（GitHub Actions の datacenter IP）では機能しない**: 全リンクが通る `substack.com/redirect` を Cloudflare が **403** で弾く（実測 `s403`×40・x.com 到達前。弾いているのは X ではなく **Substack**）。residential IP（手元）なら ~70% 解決できる。そのため:
- **CI の `aggregate.ts` は既定 `maxNew:0`**＝ネット取得せず、`state.ogImages` に入っているサムネを毎回フレッシュ取得される LayerX 項目に**再適用するだけ**（ローカルで埋めた分を cron 越しに永続化）。env `ENRICH_LAYERX_THUMBS` を立てたときだけ新規解決も試みる。
- **ローカル補完は `npm run enrich:layerx`**（`scripts/enrichLayerxLocal.ts`）。他ソースを再取得せず・トークン不要で、committed `feed.json` の LayerX 項目にサムネだけ足す。`--fresh` で負キャッシュ（CI 403 の false negative 含む）を一掃して再試行。運用は `git pull → npm run enrich:layerx → commit/push`。新しい項目ほどヒット率が高い（最新は ~70%、古い項目は本文のみツイート/期限切れリンクが多く低め）。詳細・診断は memory `todayai-gemini-quota-429` 参照。

**【現在は無効（X ソース停止中のため実質no-op）】X リンクプレビュー（`scripts/sources/xLinkCard.ts` の `enrichXLinks`）**: 本文が t.co リンクだけ / 末尾リンクの X ツイートに、リンク先の OGP カード（画像＋タイトル＋説明＋ドメイン）を `item.linkPreview` として補完する。**なぜ必要か**: 外部アカウント（`x.accounts`）は X API 経路（`fetchXAccounts`）で取得され、これは**添付メディアのサムネしか拾わず t.co を一切解決しない**＝link-card ツイートは無プレビューだった。そこで**両経路（fetchX / fetchXAccounts）の X 項目を横断**して補完する（enrichArticles/LayerX と同じ「state 永続キャッシュ＋毎回再適用＋トリム後対象＋未確認のみ取得＋maxNew 段階補完＋prune」パターン。負キャッシュ=`null`）。解決は `resolveThumb` と同じ**ハイブリッド**: t.co を `resolvePage` で追跡し、**①最終URLが x.com/status → syndication でツイートのメディア画像＋本文（title）＋著者（description）**、**②外部サイト → `extractOgImage`/`extractOgTitle`/`extractOgDescription`**（`ogp.ts` に title/description 抽出を追加。`<title>` フォールバック込み）。**⚠️ LayerX と違い Substack 壁を通らないので CI（datacenter IP）でも多くの外部サイトが解決できる** → `aggregate.ts` は既定で走らせる（`X_LINK_MAX_NEW` 既定40/run・env で上書き可）。Cloudflare 等で 403 になる分は負キャッシュ＋再適用で吸収し、`npm run enrich:xlinks`（`scripts/enrichXLinksLocal.ts`・residential IP・トークン不要）でバックフィルできる（LayerX と同じ運用。`--fresh` で負キャッシュ一掃）。表示は `TweetCard.astro` が入れ子 `<a>`（`z-30`＞カード全面オーバーレイ `z-20`）でカードを描画＝カードのタップは**リンク先へ**、カード外はツイートへ遷移。本文からは t.co を落として生 URL を隠す（空になれば本文非表示）。title/description は translate ステップで日本語補完（`linkPreview.titleJa`/`descriptionJa`・`BilingualText` で日本語/原文トグル対応）。

**【現在は無効（`GEMINI_API_KEY` 未設定・API を使わない方針）】機械翻訳／3行要約で日本語補完（`scripts/sources/translate.ts` の `enrichTranslations`）**: `enrichOgp.ts` と同じ「state 永続キャッシュ＋毎回再適用＋トリム後対象」パターン。Gemini REST API（`generateContent`、`fetch` のみで依存追加なし）で **`titleJa` と `summaryJa` を1回のバッチ呼び出しで同時補完**する。`titleJa`=title が非日本語なら翻訳（日本語ならスキップ／空文字）。`summaryJa` は**ソースで分岐**: `feeds.config.ts` の `translate.summarizeSources`（既定 `zenn`/`qiita`/`hatena`/`workspace`）＆ summary が `summaryMinLen`（既定40字）以上のものは**原文の言語を問わず3行要約**（朝刊カードの概要が読みやすくなる。日本語記事も要約対象）、それ以外（X 等）は従来どおり summary を翻訳（非日本語のみ）。LayerX は summary 無しなので titleJa 翻訳のみ。**X の `linkPreview`（リンクカード）がある項目は title/description も同じバッチで翻訳**し `linkPreview.titleJa`/`descriptionJa` に載せる（linkPreview は maxNew で本文と別ライフサイクルなので、cached があっても未翻訳の link だけ都度再翻訳＝キャッシュはマージ更新）。バッチ入力に per-entry `summarize` フラグを載せ1プロンプトで分岐。日本語判定は `isJapanese()`。`translate.batchSize` ごとに1回 API 呼び出し（`responseSchema` で JSON 配列を堅牢に受け取る）、`mapLimit` で `translate.concurrency` 並列。バッチ失敗（network/parse/件数不一致）はそのバッチをスキップし次回 run で再試行。結果は `state.translations` に保存し実行後に現存 id 分だけへ prune。**`GEMINI_API_KEY` 未設定なら丸ごとスキップ＝カードは原文のまま（graceful degradation）。** 毎回フレッシュ取得されるソースが `titleJa`/`summaryJa` を失っても `state.translations` から再適用するので再生成しない。**生成ロジック（プロンプト・翻訳↔要約の切替）を変えたら `aggregate.ts` の `ENRICH_VERSION` を上げる**＝`state.enrichVersion` と不一致なら旧キャッシュを破棄して即作り直す（アイテムが `retentionMax` で自然に入れ替わるのを待たない）。表示は `BilingualText.astro` がそのまま機能し、日本語＝AI要約 / 原文＝元の抜粋、として出し分く。

### ソースの登録は `src/lib/feed.ts` の `FeedSource` 型 + `SOURCES` 配列が中心レジストリ

新ソースを足すときの定型（既存の追加コミットが参考）:
1. `src/lib/feed.ts`: `FeedSource` ユニオンに追加 + `SOURCES` にエントリ（`key`/`label`/`badgeClass`）。← これで `FeedCard` / `SourceFilter` は `SOURCES` 駆動なので自動対応。
2. `src/styles/globals.css`: `.src-<key>` クラス + `@theme` に `--color-<key>` / `--color-<key>-bg`。
3. `feeds.config.ts`: `FeedsConfig` インターフェース + `feedsConfig` に設定。トークン類はここに書かず env/Secrets。
4. `scripts/sources/<key>.ts`: 取得して `FeedItem[]` を返す関数（`hatena.ts` が最小の手本）。
5. `scripts/aggregate.ts`: `disabled` とクレデンシャルを見て try/catch する取得ブロックを追加。末尾 `counts` とログにも `<key>` を足す。

### ソース別の要点（なぜ普通の RSS じゃないか）

> **凡例**: 見出しの【現在は無効】は `feeds.config.ts` で `disabled: true` のソース。
> 記述は将来の復活・障害記録のため残してある。有効なのは **Zenn / Qiita** の 2 つ。

- **【現在は無効】X**: X API を**叩かない**。自分のデータは basecamp 公開 JSON（`storage.googleapis.com/basecamp-feeds/x-tweets.json`）を読むだけ（トークン・課金不要、basecamp の OAuth と競合しない）。`x.accounts` の外部アカウントのみ X API **App-only Bearer**（`X_BEARER_TOKEN`）+ `since_id` 増分。OGP サムネは `scripts/sources/ogp.ts` で解決し `state.xOgImages` にキャッシュ。**本文が t.co リンクのツイートはリンク先の OGP カードを `linkPreview` として補完**（`enrichXLinks`。両取得経路を横断。後述）。表示は `TweetCard.astro`（ツイート風＋リンクプレビューカード）。
  - **著者アイコン(avatar)/実名/@handle**: basecamp 公開JSON は元ツイートの著者を持たず `author` が `"ブックマーク"` 等の固定ラベルになる。これを **syndication（`scripts/sources/syndication.ts` の `fetchTweet`＝`cdn.syndication.twimg.com`・無料・トークン不要）** で解決し `FeedItem.avatarUrl`（`_400x400`化）/`authorName`/`author=@handle` を補完（`xOgImages` と同じ state永続キャッシュ＋毎回再適用＋新規は `authorMaxNew` 件/run の段階補完＋トリム後 prune パターン、`state.xAuthors`）。外部アカウントは X API の `expansions=author_id&user.fields=profile_image_url,name` で同様取得。`TweetCard.astro` は `avatarUrl` があれば丸枠に `<img>`（`onerror` でイニシャル/Xロゴへフォールバック）、無ければ従来の代替アイコン。**⚠️ syndication 直叩きは residential IP(ローカル)なら解決でき、CI(datacenter IP)では弱い可能性**（LayerXサムネ系統の制約。ただし Substack 非経由の直叩きなので 403 リスクは低い）。ローカル `npm run aggregate` で埋めた `state.xAuthors` は CI でも毎回再適用＝永続化される（LayerXサムネと同じ運用）。
- **【有効】Zenn / Qiita**: 公開 RSS を共有ヘルパー `scripts/sources/rss.ts` の `fetchRss({rssUrls, source, limit})` で直接取得（`rss-parser`、トークン不要）。**現在の取得先はセキュリティ関連**:
  - Zenn = `zenn.dev/topics/security/feed`（`zenn.rssUrls`）
  - Qiita = `qiita.com/tags/security/feed` ＋ `qiita.com/tags/認証/feed`（`qiita.rssUrls`）

  **`rssUrls` は配列**＝1ソースに複数タグ/トピックを束ねられる（改造で `rssUrl` から拡張）。**URL ごとに個別 try/catch** するので1本が 404 等で落ちても残りは取り込まれる。全 URL が失敗しても throw せず、`aggregate.ts` がブロック先頭で積んだ前回キャッシュがそのまま残る。**`limit` は「1 URL あたり」**の取得窓（合計ではない）＝ URL を足しても既存フィードの取り込み量が痩せない。それぞれ独立タブ `source: "zenn"` / `"qiita"`。
  - ⚠️ **日本語タグ URL の扱い**: `qiita.com/tags/認証/feed` を生のまま渡すと rss-parser は `Request path contains unescaped characters` で失敗する（ブラウザや `fetch` と違い Node の http クライアントは自動エンコードしない）。`rss.ts` の `toRequestUrl()` が WHATWG `URL` に通してパーセントエンコードするので、**設定ファイルには読みやすい生の日本語のまま書いてよい**。
  - （履歴）todayai 時代は Zenn「AI」トピック／Qiita「AI」タグだった。さらにその前の「Feedly」（AI 関連 RSS 8本まとめ集約）は廃止済み。
- **【現在は無効】はてブ**: 公開 RSS（`b.hatena.ne.jp/hotentry/it.rss`）を直接パース。トークン不要。**人気エントリーRSSは「今まさに人気の約30件」しか返さない**ためフレッシュ取得分だけだとランキング外の記事が消える。→ 全ソース共通の蓄積（`cachedFor(cache,"hatena")` を先頭で積む）で過去分を保持し、`hatena.retentionMax`（既定1000≒数ヶ月・`feed.json` 肥大の安全弁）まで残す。dedup（id=entry url）で重複は1件。（かつては「はてブだけ蓄積・`maxAgeDays` 対象外」の特別扱いだったが、全ソースが同じ蓄積＋ソース別枠に統一された。）
- **【現在は無効】Workspace**: Google Workspace Updates ブログ（Blogger 製）の Atom を `rss-parser` で直接取得。トークン不要。既定の `/feeds/posts/default` は FeedBurner（http）へ 302 するため `?redirect=false` を付けて Google ドメインから https Atom を取得（`workspace.rssUrl`）。`perFeedLimit` で件数を抑制。サムネは `media:thumbnail` 優先＋本文 HTML の最初の `<img>` をフォールバック抽出。表示は `source: "workspace"`（青バッジ「Workspace」）。
- **【現在は無効】LayerX**: Substack 公開 RSS が invite-only のため、毎週届くメール（`layerxnews@substack.com`）を **Gmail REST API** で読む（`GMAIL_CLIENT_ID`/`_SECRET`/`_REFRESH_TOKEN`、scope `gmail.readonly`）。**本文(text/plain)に列挙された各トピックリンク = 1アイテム**（1通 ~190件）。`<タイトル> [ substack redirect url ]` が**行末**にある行だけ採用＝「View this post」/Unsubscribe/文中プロモを自然に除外。id は redirect UUID で安定（再取得しても dedup で増えない）。1通の物量が大きいので `layerx.retentionMax` は 2000（ソース別枠なので他ソースは押し出さない）。インフラ設定とトークン失効の注意は memory `todayai-layerx-gmail-infra` 参照。
- **【現在は無効】GCP**: Google Cloud リリースノートの公開 Atom（`https://docs.cloud.google.com/feeds/gcp-release-notes.xml`。旧 `cloud.google.com/feeds/gcp-release-notes.xml` は 301 でここへ）を `rss-parser` で直接取得。トークン不要。**⚠️ このフィードは 1エントリ=1日** で `<title>` は日付だけ（例 "July 07, 2026"）・`<content>`(HTML) にその日の全プロダクトの更新がまとまる（AI 専用ではなく全 GCP プロダクト。ただし ~1件/日と低頻度）。today.ai は日付グルーピングするので日付見出しは冗長 → 専用パーサ `scripts/sources/gcloud.ts` が本文の `<h2 class="release-note-product-title">製品名</h2>`（安定した hook）を抽出して「App Engine・Bigtable ほかN製品のリリースノート」を `title` にする（抽出0件なら日付フォールバック。末尾「のリリースノート」で `isJapanese()`=true → 見出しの無駄翻訳を回避）。**enrichArticles には渡さない**（エントリ link を辿ると当日でなく60日分のページ全体が返るため・サムネ不要）＝サムネ無しのコンパクト行で描画。要約は `contentText`（本文長め・一時）を `translate.summarizeSources` の3行要約に載せ、`summary` は表示用に短め。表示は `source: "gcloud"`（赤バッジ「GCP」）。

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
- **ライト専用サイトなので `globals.css` の `html` に `color-scheme: light` を宣言**。これが無いと Chrome の強制/Auto ダークモードが朝刊テーマを反転させて背景・カードが暗転する（UAの問題ではなくブラウザ設定）。
- **【現在は無効】翻訳/3行要約が出ない＝Gemini の HTTP 4xx を疑う**（CI は緑のまま titleJa/summaryJa=0 になる）。実例: 使用モデル `gemini-2.0-flash` が 2026-06-01 提供終了→無料枠撤廃で **429**。`feeds.config.ts` の `translate.model` を後継 Flash-Lite（無料枠あり）に切替えて復旧。確認は `gh run view <id> --log | grep '\[translate\]'` と `git show origin/main:src/data/feed.json | jq '[.items[]|select(.titleJa)]|length'`。詳細は memory `todayai-gemini-quota-429`。
- **ビジュアルは「朝刊（Daily Briefing）」ライトテーマ**（ペーパー白 `#f6f7f9` ＋白カード ＋ インク文字 ＋ コバルト `#2f5fff`）。配色トークンは `globals.css` の `@theme` に集約。見出しは Space Grotesk、時刻・ソース名は IBM Plex Mono（ティッカー風）。
- **ロゴだけ別系統の色**（`--color-logo` 系＝エメラルドグリーン `#0f9b6c`）: `--color-accent`（コバルト）はフィルタチップ・言語トグル・カード hover が共有しているため、ロゴを変えるとサイト全体が巻き込まれる。**ロゴ専用変数に分けてあるので、ロゴの色を変えるときは `--color-logo` だけを触ること**（使用箇所は `Layout.astro` のバッジ背景＋glow とワードマークの2箇所）。なお Tailwind v4 は**実際に使われている `@theme` 変数しか CSS に出力しない**ので、`--color-logo-bright` / `-deep` は定義済みでもビルド後の CSS には現れない（`--color-accent-deep` も同様。不具合ではない）。
- **カードはハイブリッド分岐**（`FeedCard.astro`）: X は `TweetCard`、それ以外は `item.thumbnail` の有無で **ヒーローカード** か **コンパクト行** に分かれる。ヒーローはモバイルで画像上＋本文下の縦積み、`sm:` 以上で `flex-row` の**画像左（`sm:w-[14rem]`）＋本文右**の横並びになる。OGP 補完でサムネ網羅率が上がるとヒーローが主役になる。**サムネ枠は全ブレークポイントで `aspect-video`（16:9）固定＋`sm:self-start`（上揃え）**＝カード全高に引き伸ばされない（横長 OGP が縦長クロップで崩れるのを防ぐ）。**カード外枠は `rounded-none`（直角）**＝バッジのピル・X アバターの丸・フィルタチップのピルは丸のまま、カード面だけ角。
- **コンテナ幅**は `Layout.astro` の `max-w-[46rem] lg:max-w-[58rem]`（モバイル～タブレットは 46rem、`lg:`≥1024px で 58rem に広げて PC で横を使う）。ヘッダー/フィルタ/日付見出しもこの幅に従う。
- **二言語表示（日本語／原文トグル）**: **【現在、翻訳は無効なので実質すべて原文表示】**（トグル UI は残っているが `titleJa`/`summaryJa` が生成されないため切り替えても見た目が変わらない）。`FeedItem` の `titleJa`/`summaryJa`（集約時に Gemini 補完）が原文と別に入る。表示は `BilingualText.astro`（`ja!==orig` のとき `.lang-ja` と `.lang-orig` の両 span を出力、翻訳なしは素テキスト）。`SourceFilter.astro` 右端の「日本語／原文」トグルが `:root.show-orig` クラスを切り替え、CSS（`globals.css` の `.lang-orig`/`:root.show-orig .lang-ja`）で全カードを一斉に出し分ける。選択は `localStorage("todayai:lang")` に永続。**フィルタ（`.is-hidden`）とは独立したクラストグルで競合しない。** 既定は日本語（クラス無し）。
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

特定のX(Twitter)アカウント・Zenn「AI」トピック・Qiita「AI」タグ・はてなブックマーク人気エントリー(テクノロジー)・Google Workspace Updatesブログ・LayerX AI・LLM Newsletter(Gmail経由)・Google Cloud リリースノート(Atom)からAI関連情報を集約し、統合タイムラインとして表示。

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
- **Google Workspace Updates はトークン不要**: Google Workspace Updates ブログ（Blogger 製）の Atom を `scripts/sources/workspace.ts` が rss-parser で直接取得。既定の `/feeds/posts/default` は FeedBurner（http）へ 302 リダイレクトするため、`feeds.config.ts` の `workspace.rssUrl` に `?redirect=false` を付けて Google ドメインから https の Atom を取得する。`perFeedLimit` で件数を抑制。サムネは `media:thumbnail` 優先＋本文 HTML の最初の `<img>` をフォールバック抽出。`source: "workspace"`（青バッジ「Workspace」）。
- **LayerX AI・LLM Newsletter は Gmail 経由**: Substack 公開 RSS（`layerxnews.substack.com/feed`）が invite-only で取得不可のため、毎週届くメール（送信元 `layerxnews@substack.com`）を **Gmail REST API** で読む（`scripts/sources/layerx.ts`、依存追加なし＝`fetch` のみ）。refresh token を access token に交換し `messages.list`(`from:...newer_than:Nd`)→`messages.get?format=full`。**本文(text/plain)に列挙された各トピックリンクを個別の FeedItem 化**（1通 ~190件）。`<タイトル> [ https://substack.com/redirect/<uuid>?j=... ]` が**行末**にある行のみ採用し、`View this post`/Unsubscribe/文中プロモは除外。`title`=トピック見出し、`url`=リダイレクトURL（解決せずそのまま）、`id`=`layerx-<uuid>`（再取得しても dedup で増殖しない）。`source: "layerx"`（専用「LayerX」バッジ、Substack オレンジ）。物量が大きいため `layerx.retentionMax` は 2000（全ソース共通の全期間アーカイブ＝各ソース別枠で保持、後述）。設定は `feeds.config.ts` の `layerx`。
- **機械翻訳／3行要約（原文→日本語）**: 集約時に各アイテムの `title`/`summary` を Gemini REST API（`scripts/sources/translate.ts` の `enrichTranslations`、`fetch` のみ）で1回のバッチ呼び出しで日本語補完。`titleJa`=非日本語タイトルの翻訳。`summaryJa` はソースで分岐し、記事系（`translate.summarizeSources`＝Zenn/Qiita/はてブ/Workspace）の十分な長さの抜粋は**原文の言語を問わず生成AIで3行要約**、その他（X 等）は summary を翻訳。日本語判定は `isJapanese()`。`state.translations` に永続キャッシュ、生成ロジック変更時は `aggregate.ts` の `ENRICH_VERSION`↔`state.enrichVersion` 不一致で旧キャッシュを破棄して再生成。表示はフィルタバー右端の「日本語／原文」一括トグル（`:root.show-orig` クラス＋`localStorage`、`BilingualText.astro`。日本語＝AI要約／原文＝元の抜粋）。
- **LayerX サムネ**: Substack リダイレクトを辿って og:image を解決できるが物量が大きい（~190件/通）ため、`enrichOgImages` の `maxNew`（既定40件/run）で **1run あたりの新規取得を絞り段階的に補完**（負キャッシュで取得済みはスキップ）。記事系（Zenn/Qiita/はてブ/Workspace）は上限なし。
- **GCP（Google Cloud リリースノート）はトークン不要**: 公開 Atom（`docs.cloud.google.com/feeds/gcp-release-notes.xml`）を `scripts/sources/gcloud.ts` が rss-parser で取得。**1エントリ=1日**でタイトルは日付だけ・本文にその日の全プロダクト更新がまとまるため、本文の `<h2 class="release-note-product-title">` から製品名を抽出して「App Engine・Bigtable ほかN製品のリリースノート」を見出しにする。enrichArticles には渡さず（link は60日分ページ全体を返す）サムネ無しコンパクト行＋`translate.summarizeSources` の3行要約。赤バッジ「GCP」（`source: "gcloud"`）。全 GCP プロダクト対象（AI 専用ではないが ~1件/日と低頻度）。
- Secret: `X_BEARER_TOKEN`（外部アカウント取得）、`GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET`/`GMAIL_REFRESH_TOKEN`（LayerX 取得、scope `gmail.readonly`）、`GEMINI_API_KEY`（機械翻訳）。いずれも任意で、未設定ならそのソース／翻訳をスキップ。Zenn・Qiita・はてブは公開 RSS で不要。
- `push` 時は取得＋コミットをスキップ（既存キャッシュでビルド）しコミットループを回避。
- Tailwind v4 + Astro 型不一致は `astro.config.mjs` で `any` キャスト。内部リンクは `src/lib/url.ts` の `siteLink()` 必須（base path は現在 `/todaysec`）。
