# 補足: X ソースの設計と実装（2026-08-10 に CLAUDE.md から移動）

> **なぜここにあるか**: `x` ソースは `feeds.config.ts` で `disabled: true`（**温存中・削除していない**）。
> 常時ロードから外すために `CLAUDE.md` から移してきました。**内容は移動しただけで削っていません。**
> 温存の判断とその再検討条件は [`decisions.md` 項目2](decisions.md) にあります。
>
> ⚠️ **復活させるときは `disabled: false` だけでは画面に出ません。**
> `CLAUDE.md` の「無効化したソースを復活させるとき」の4手順を通すこと。

---

## コマンド

```bash
npm run enrich:xlinks           # X 項目の t.co をリンクプレビュー（OGP カード）に補完（他ソース非取得・トークン不要）
npm run enrich:xlinks -- --fresh  # 負キャッシュ（null）を一掃して未補完分を再試行
```

## `feed.json` の `state` のうち X 由来のキー

run をまたいで持ち越す状態のうち、X 関連はこの5つ。

| キー | 内容 |
| --- | --- |
| `since_id` | X 外部アカウントの増分取得位置（重複課金回避） |
| `userIds` | X ユーザー ID のキャッシュ |
| `xOgImages` | X 由来 OGP 画像の解決キャッシュ |
| `xAuthors` | X item id→`{name,handle,avatar?}` の著者解決キャッシュ。`null`＝確認済み著者なしの負キャッシュ。fetch 失敗時は記録せず次回再試行 |
| `xLinkCards` | X item id→リンクプレビューカード `{url,title?,description?,image?,domain}` / `null`＝確認済み・カードなしの負キャッシュ。t.co 先の OGP 解決結果 |

## ソースとしての要点

- **【現在は無効】X**: X API を**叩かない**。自分のデータは basecamp 公開 JSON（`storage.googleapis.com/basecamp-feeds/x-tweets.json`）を読むだけ（トークン・課金不要、basecamp の OAuth と競合しない）。`x.accounts` の外部アカウントのみ X API **App-only Bearer**（`X_BEARER_TOKEN`）+ `since_id` 増分。OGP サムネは `scripts/sources/ogp.ts` で解決し `state.xOgImages` にキャッシュ。**本文が t.co リンクのツイートはリンク先の OGP カードを `linkPreview` として補完**（`enrichXLinks`。両取得経路を横断。後述）。表示は `TweetCard.astro`（ツイート風＋リンクプレビューカード）。
  - **著者アイコン(avatar)/実名/@handle**: basecamp 公開JSON は元ツイートの著者を持たず `author` が `"ブックマーク"` 等の固定ラベルになる。これを **syndication（`scripts/sources/syndication.ts` の `fetchTweet`＝`cdn.syndication.twimg.com`・無料・トークン不要）** で解決し `FeedItem.avatarUrl`（`_400x400`化）/`authorName`/`author=@handle` を補完（`xOgImages` と同じ state永続キャッシュ＋毎回再適用＋新規は `authorMaxNew` 件/run の段階補完＋トリム後 prune パターン、`state.xAuthors`）。外部アカウントは X API の `expansions=author_id&user.fields=profile_image_url,name` で同様取得。`TweetCard.astro` は `avatarUrl` があれば丸枠に `<img>`（`onerror` でイニシャル/Xロゴへフォールバック）、無ければ従来の代替アイコン。**⚠️ syndication 直叩きは residential IP(ローカル)なら解決でき、CI(datacenter IP)では弱い可能性**（datacenter IP からの直叩きという制約。ただし 403 リスクは低い）。ローカル `npm run aggregate` で埋めた `state.xAuthors` は CI でも毎回再適用＝永続化される。

## X リンクプレビュー（`scripts/sources/xLinkCard.ts` の `enrichXLinks`）

**【現在は無効（X ソース停止中のため実質no-op）】**

本文が t.co リンクだけ / 末尾リンクの X ツイートに、リンク先の OGP カード（画像＋タイトル＋説明＋ドメイン）を `item.linkPreview` として補完する。**なぜ必要か**: 外部アカウント（`x.accounts`）は X API 経路（`fetchXAccounts`）で取得され、これは**添付メディアのサムネしか拾わず t.co を一切解決しない**＝link-card ツイートは無プレビューだった。そこで**両経路（fetchX / fetchXAccounts）の X 項目を横断**して補完する（enrichArticles と同じ「state 永続キャッシュ＋毎回再適用＋トリム後対象＋未確認のみ取得＋maxNew 段階補完＋prune」パターン。負キャッシュ=`null`）。解決は `resolveThumb` と同じ**ハイブリッド**: t.co を `resolvePage` で追跡し、**①最終URLが x.com/status → syndication でツイートのメディア画像＋本文（title）＋著者（description）**、**②外部サイト → `extractOgImage`/`extractOgTitle`/`extractOgDescription`**（`ogp.ts` に title/description 抽出を追加。`<title>` フォールバック込み）。**CI（datacenter IP）でも多くの外部サイトが解決できる** → `aggregate.ts` は既定で走らせる（`X_LINK_MAX_NEW` 既定40/run・env で上書き可）。Cloudflare 等で 403 になる分は負キャッシュ＋再適用で吸収し、`npm run enrich:xlinks`（`scripts/enrichXLinksLocal.ts`・residential IP・トークン不要）でバックフィルできる（`--fresh` で負キャッシュ一掃）。表示は `TweetCard.astro` が入れ子 `<a>`（`z-30`＞カード全面オーバーレイ `z-20`）でカードを描画＝カードのタップは**リンク先へ**、カード外はツイートへ遷移。本文からは t.co を落として生 URL を隠す（空になれば本文非表示）。title/description は translate ステップで日本語補完（`linkPreview.titleJa`/`descriptionJa`・`BilingualText` で日本語/原文トグル対応）。

## 関連する落とし穴（`CLAUDE.md` 側に残してあるもの）

- **X が古い日付で止まったときは上流（basecamp）を疑う。** 上流の X API クレジット枯渇（HTTP 402）で
  run が緑のままサイレントに stale 化する。調査手順は `CLAUDE.md` の「重要な制約・gotcha」に残してある。
- **カード `<article>` の `isolate` 必須**（`TweetCard.astro` も対象）。同じく `CLAUDE.md` 側。
