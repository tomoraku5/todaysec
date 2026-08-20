/**
 * 機械翻訳／生成AI要約によるアイテム本文の日本語補完。
 *
 * enrichArticles.ts と同じ「state に永続キャッシュ・毎回アイテムへ再適用・トリム後の
 * 最終アイテムだけ対象・未確認のみ API」パターン。X bookmark / 記事系 等は毎回
 * フレッシュ取得され titleJa/summaryJa を失うが、transCache（state.translations）から
 * 再適用するので再生成しない。
 *
 * - title: 原文が非日本語なら自然な日本語に翻訳（titleJa）。日本語ならスキップ。
 * - summary: `summarizeSources`（記事系）は原文の言語によらず **3行要約**（summaryJa）。
 *   それ以外（X 等）は従来どおり summary を翻訳（非日本語のときのみ）。
 *
 * Gemini REST API（generateContent）を fetch のみで叩く（依存追加なし）。
 * responseMimeType=application/json + responseSchema で配列 JSON を堅牢に受け取る。
 * バッチ失敗（network / parse / 件数不一致）はそのバッチをスキップし run 全体は落とさない。
 *
 * 失敗への備え（いずれも 2026-08-17〜20 の実測で必要性が確認できたもの）:
 * 1. **待ってから複数回再送**（RETRY_DELAYS_MS）。503 は待つ以外に手が無い。
 * 2. **再送のたびに temperature を上げる**（ATTEMPT_TEMPERATURES）。暴走ループは
 *    低温度だと同じ入力で毎回再現するため、待つだけでは抜けられない。
 * 3. **出力上限**（maxOutputTokensFor）。暴走生成を早く打ち切って再送の余地を作る。
 * 4. **リクエストのタイムアウト**（REQUEST_TIMEOUT_MS）。応答が返らないまま居座るのを防ぐ。
 * 5. **それでも使えないバッチは1件ずつに分割**して再送。問題の1件の道連れで
 *    残りが全滅するのを防ぐ（503 等の相手側の障害では分割しない）。
 */
import type { FeedItem, FeedSource } from "../../src/lib/feed";
import { mapLimit } from "./util";

/** 指定ミリ秒待つ（再送の前に間を置くため）。 */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 再送の待ち時間（ミリ秒）。**配列の長さ＝最大再送回数**。
 *
 * ⚠️ **待たずに投げ直してはいけない。** Gemini の 503 は
 * `This model is currently experiencing high demand.（Spikes in demand are usually temporary）`
 * ＝「時間を置いて再試行せよ」という意味で、0 秒で再送しても同じ答えが返る。
 * 実測（2026-08-17〜18 の CI・即座に1回だけ再送する実装）: **3 バッチ全滅・回復 0**。
 */
const RETRY_DELAYS_MS = [5_000, 20_000, 60_000];

/**
 * バッチ index ごとにずらす待ち時間。
 * ⚠️ `concurrency` 本を同時に投げているので、**失敗したら同時に投げ直す**ことになる
 * （過負荷のモデルへの一斉再送）。index 分ずらして山を崩す。並列3なら 0 / 1.5 / 3 秒。
 */
const BACKOFF_STAGGER_MS = 1_500;

/**
 * 試行ごとの temperature（生成のランダムさ）。index＝何回目の送信か（0=初回）。
 * 再送回数（RETRY_DELAYS_MS.length）より1つ多く持ち、分割再送（1件ずつ）は末尾を使う。
 *
 * ⚠️ **待つだけでは抜けられない失敗がある。** 暴走ループ（同じ内容を延々と生成して
 * MAX_TOKENS で切られ JSON が壊れる）は低温度だとほぼ決定的＝**同じ入力を送り直すと
 * 同じループが再現する**（2026-08-19〜20 実測: 同一バッチが再送3回とも
 * 「応答の JSON が壊れている / finishReason=MAX_TOKENS」で全滅。翌 run でも同じ10件が全滅）。
 * 再送のたびに揺らぎを足してループの再現を崩す。初回は従来どおり 0.2（訳の安定を優先）。
 */
const ATTEMPT_TEMPERATURES = [0.2, 0.5, 0.8, 1.0];

/** attempt（0=初回）に使う temperature。配列を超えたら末尾で頭打ち。 */
const temperatureFor = (attempt: number): number =>
  ATTEMPT_TEMPERATURES[Math.min(attempt, ATTEMPT_TEMPERATURES.length - 1)];

/**
 * 分割再送（1件ずつ）の呼び出し間隔。バッチ1回分が最大 batchSize 回の連続呼び出しに
 * 化けるので、無料枠の RPM（1分あたりのリクエスト回数制限）に当てないよう間を置く。
 * 10件の分割でも +20 秒程度＝run 全体への影響は小さい。
 */
const SPLIT_STAGGER_MS = 2_000;

/** 1 リクエストのタイムアウト。出力上限を入れたので正常な応答はこれより十分速い。 */
const REQUEST_TIMEOUT_MS = 120_000;

/**
 * 1 リクエストの出力上限（トークン）。件数に比例させる。
 *
 * **目的は「暴走生成を早く打ち切る」こと**（訳の品質を絞るためではない）。実測で
 * **129,848 文字**を生成してから途中で切れ、1 バッチで数分を消費していた。
 *
 * 見積り: 1 件あたり titleJa 約70字 + summaryJa 約350字 + JSON の記号 約60字 ≒ 480字。
 * 日本語はおおむね 1 文字 1 トークンなので約 480 トークン。**700 で約45%の余裕**。
 *
 * ⚠️ **小さすぎると正常な応答が切れて「毎回失敗して永久に訳が付かない」状態になる。**
 * 余裕を削らないこと。上限に当たった場合は `finishReason=MAX_TOKENS` がログに出る。
 * ⚠️ `batchSize` を 10 より大きくするときは、モデルの出力上限を超えないか確認する
 * （10 件で 7,512 トークン）。増やすなら batchSize ではなくバッチ数で稼ぐ。
 */
function maxOutputTokensFor(count: number): number {
  return 512 + 700 * count;
}

/**
 * HTTP ステータスから「送り直す価値があるか」と、人が読む分類名を決める。
 *
 * ⚠️ **かつて 403 を 429 と同じ「レート制限」と表示していた**ため、**キーの失効を
 * レート制限と誤診する**状態だった（原因の切り分けができない）。必ず分けて出す。
 */
function classifyStatus(status: number): { retryable: boolean; label: string } {
  if (status === 429) return { retryable: false, label: "レート制限・再送しない" };
  if (status === 403) return { retryable: false, label: "キーが無効か権限不足の可能性・再送しない" };
  if (status === 400)
    return { retryable: false, label: "リクエストが不正（プロンプト/スキーマ側）・再送しない" };
  if (status >= 500) return { retryable: true, label: "サーバ側の一時障害・待って再送" };
  return { retryable: false, label: "再送しない" };
}

export interface TranslateOptions {
  model: string;
  batchSize: number;
  concurrency: number;
  /** 概要を翻訳ではなく3行要約にするソース（記事系）。 */
  summarizeSources: FeedSource[];
  /** この文字数未満の summary は要約せず翻訳扱い。 */
  summaryMinLen: number;
}

export interface TranslateResult {
  /** 今回新たに翻訳できた件数 */
  translated: number;
  /** 今回 API 翻訳を試みた件数 */
  attempted: number;
  /** 実行したバッチ数 */
  batches: number;
  /** 応答不良で送り直した（1回以上）バッチ数。回数ではなくバッチ数 */
  retried: number;
  /** 送り直して回復したバッチ数 */
  recovered: number;
  /** 諦めた（原文のまま残る）アイテム件数。次回 run で再試行される */
  failed: number;
}

/** かな・カタカナ・漢字を含めば日本語とみなす（翻訳不要）。 */
export function isJapanese(text: string): boolean {
  return /[぀-ヿ㐀-䶿一-鿿]/.test(text);
}

interface TransCacheEntry {
  titleJa?: string;
  summaryJa?: string;
  /** linkPreview.title の日本語訳（X リンクカード） */
  linkTitleJa?: string;
  /** linkPreview.description の日本語訳 */
  linkDescJa?: string;
}

/** 末尾/文中の t.co を除去（生 URL の誤翻訳・無駄を防ぐ）。X 本文向け。 */
function stripTco(text: string): string {
  return text.replace(/\s*https?:\/\/t\.co\/\S+/g, "").trim();
}

/** 翻訳/要約の対象アイテムと、要約/翻訳の入力テキスト・処理種別。 */
interface Target {
  item: FeedItem;
  /** true=入力を3行要約 / false=入力を翻訳 */
  summarize: boolean;
  /** 翻訳する title（t.co 除去済み）。空なら title 翻訳不要 */
  titleInput: string;
  /** 処理対象テキスト。要約=本文(contentText)優先・翻訳=summary（抜粋・t.co除去）。空なら不要 */
  input: string;
  /** linkPreview.title（非日本語・未翻訳のみ）。空なら不要 */
  linkTitle: string;
  /** linkPreview.description（非日本語・未翻訳のみ）。空なら不要 */
  linkDesc: string;
}

/**
 * `items` のうち翻訳/要約が必要な（キャッシュ無し）ものを Gemini で日本語化する。
 * transCache を参照して既知分は流用、未確認のみ処理する。transCache は破壊的に更新される
 * （呼び出し側で state に保存する）。
 */
export async function enrichTranslations(
  items: FeedItem[],
  transCache: Record<string, TransCacheEntry>,
  apiKey: string,
  opts: TranslateOptions,
): Promise<TranslateResult> {
  const summSet = new Set(opts.summarizeSources);

  // 対象: キャッシュ済みは流用、未処理（title翻訳 / summary要約or翻訳 / linkPreview翻訳）だけ API へ。
  const targets: Target[] = [];
  for (const item of items) {
    const cached = transCache[item.id];
    // 既知の翻訳/要約はまず再適用（linkPreview は enrichXLinks 後なので item に載っている）。
    if (cached?.titleJa) item.titleJa = cached.titleJa;
    if (cached?.summaryJa) item.summaryJa = cached.summaryJa;
    if (item.linkPreview) {
      if (cached?.linkTitleJa) item.linkPreview.titleJa = cached.linkTitleJa;
      if (cached?.linkDescJa) item.linkPreview.descriptionJa = cached.linkDescJa;
    }

    // linkPreview は本文と別ライフサイクル（maxNew で後から解決され得る）。未翻訳なら都度対象化。
    const lp = item.linkPreview;
    const linkTitle = lp?.title && !isJapanese(lp.title) && !cached?.linkTitleJa ? lp.title : "";
    const linkDesc =
      lp?.description && !isJapanese(lp.description) && !cached?.linkDescJa ? lp.description : "";
    const needLink = !!linkTitle || !!linkDesc;

    // title/summary は cached があれば処理済み（従来挙動）。link だけ未処理なら link のみ再翻訳。
    if (cached) {
      if (needLink) {
        targets.push({ item, summarize: false, titleInput: "", input: "", linkTitle, linkDesc });
      }
      continue;
    }

    const summary = item.summary?.trim() ?? "";
    // 要約は記事本文（enrichArticles が付ける contentText）を優先、無ければ抜粋。
    const body = item.contentText?.trim() || summary;
    const isSummSrc = summSet.has(item.source);
    // 記事系 & 十分な長さの本文/抜粋 → 3行要約（日本語記事も対象）。その他 → 翻訳。
    const summarize = isSummSrc && body.length >= opts.summaryMinLen;
    // X は本文に t.co を含み得る。翻訳入力からは t.co を除去（生 URL の誤翻訳を防ぐ）。
    const titleInput = stripTco(item.title ?? "");
    const summaryInput = summarize ? body : stripTco(summary);
    const needTitle = !!titleInput && !isJapanese(titleInput);
    const needSummary = summarize || (summaryInput.length > 0 && !isJapanese(summaryInput));
    if (!needTitle && !needSummary && !needLink) continue;
    targets.push({
      item,
      summarize,
      titleInput: needTitle ? titleInput : "",
      input: needSummary ? summaryInput : "",
      linkTitle,
      linkDesc,
    });
  }

  // バッチに分割
  const batches: Target[][] = [];
  for (let i = 0; i < targets.length; i += opts.batchSize) {
    batches.push(targets.slice(i, i + opts.batchSize));
  }

  let translated = 0;
  let retried = 0;
  let recovered = 0;
  let failed = 0;

  /** 応答をアイテムと transCache に反映し、反映できた件数を返す（バッチ／分割再送で共用）。 */
  const applyResults = (applied: Target[], out: BatchTranslation[]): number => {
    let count = 0;
    for (let j = 0; j < applied.length; j++) {
      const { item } = applied[j];
      const t = out[j];
      if (!t) continue;
      const titleJa = t.titleJa?.trim() || undefined; // 原文が日本語なら空文字で返る
      const summaryJa = t.summaryJa?.trim() || undefined;
      const linkTitleJa = t.linkTitleJa?.trim() || undefined;
      const linkDescJa = t.linkDescJa?.trim() || undefined;
      if (!titleJa && !summaryJa && !linkTitleJa && !linkDescJa) continue;
      if (titleJa) item.titleJa = titleJa;
      if (summaryJa) item.summaryJa = summaryJa;
      if (item.linkPreview) {
        if (linkTitleJa) item.linkPreview.titleJa = linkTitleJa;
        if (linkDescJa) item.linkPreview.descriptionJa = linkDescJa;
      }
      // 既存キャッシュにマージ（link だけ後から足すケースで title/summary 訳を失わない）。
      const prev = transCache[item.id] ?? {};
      transCache[item.id] = {
        titleJa: titleJa ?? prev.titleJa,
        summaryJa: summaryJa ?? prev.summaryJa,
        linkTitleJa: linkTitleJa ?? prev.linkTitleJa,
        linkDescJa: linkDescJa ?? prev.linkDescJa,
      };
      count++;
    }
    return count;
  };

  // ⚠️ index が必要（再送の待ち時間をバッチごとにずらすため）。mapLimit は他のソースと
  //    共有しているので引数を増やさず、ここで index を持たせた要素を渡す。
  const jobs = batches.map((batch, i) => ({ batch, i }));
  await mapLimit(jobs, opts.concurrency, async ({ batch, i }) => {
    let res = await translateBatch(batch, apiKey, opts.model, temperatureFor(0));
    // 応答不良は**確率的**なもの（生成がループして途中で切れる等）と、**時間で解決するもの**
    // （503 = モデル過負荷）の2種類がある。どちらも「間を置いて送り直す」で対処するが、
    // 前者は待つだけでは再現し続けるので temperature も段階的に上げる（ATTEMPT_TEMPERATURES）。
    // ⚠️ レート制限（429）・キー不正（403）・リクエスト不正（400）は待っても直らないので
    //    classifyStatus() が retryable=false を返す＝ここには入らない。
    let attempts = 0;
    while (!res.ok && res.retryable && attempts < RETRY_DELAYS_MS.length) {
      if (attempts === 0) retried++;
      const wait = RETRY_DELAYS_MS[attempts] + i * BACKOFF_STAGGER_MS;
      console.warn(
        `[translate] 応答不良のため ${Math.round(wait / 1000)} 秒待って再送します` +
          `（${batch.length} 件・${attempts + 1}/${RETRY_DELAYS_MS.length} 回目）: ${res.reason}`,
      );
      await sleep(wait);
      res = await translateBatch(batch, apiKey, opts.model, temperatureFor(attempts + 1));
      attempts++;
    }
    if (res.ok && attempts > 0) {
      recovered++;
      console.log(`[translate] 再送 ${attempts} 回で回復しました（${batch.length} 件）`);
    }
    if (!res.ok) {
      // 応答は返るのに毎回使えない（JSON 破損・件数不一致・本文なし）＝バッチ内の特定の
      // 記事が暴走ループ等を誘発している可能性が高い（2026-08-19〜20 実測: 問題の記事と
      // 同じバッチに入った残り9件が道連れで全滅し続けた）。1件ずつに分割して切り分ける。
      // ⚠️ 503・タイムアウト・通信失敗（相手側の障害）では分割しない＝過負荷の相手への
      //    リクエストを増やすだけで逆効果。
      if (res.contentSuspect && batch.length > 1) {
        console.warn(
          `[translate] バッチのままでは回復しないため 1 件ずつに分割して再送します（${batch.length} 件）: ${res.reason}`,
        );
        let rescued = 0;
        for (const target of batch) {
          await sleep(SPLIT_STAGGER_MS);
          const single = await translateBatch(
            [target],
            apiKey,
            opts.model,
            temperatureFor(RETRY_DELAYS_MS.length),
          );
          if (single.ok) {
            translated += applyResults([target], single.data);
            rescued++;
          } else {
            failed++;
            // どの記事が失敗し続けているか追えるよう、タイトルを必ず残す。
            console.error(
              `[translate] 分割再送でも失敗（原文のまま・次回 run で再試行）: ` +
                `「${(target.item.title ?? target.item.id).slice(0, 60)}」 ${single.reason}`,
            );
          }
        }
        console.log(`[translate] 分割再送の結果: ${rescued}/${batch.length} 件を救出`);
        return;
      }
      // ⚠️ 諦めた分は原文（英語）のまま公開される。次回 run で再試行されるが、
      // 「静かに減っている」ことに気づけるよう件数と理由を必ず残す。
      failed += batch.length;
      console.error(
        `[translate] このバッチは諦めます（${batch.length} 件は原文のまま・次回 run で再試行）: ${res.reason}`,
      );
      return;
    }
    translated += applyResults(batch, res.data);
  });

  return {
    translated,
    attempted: targets.length,
    batches: batches.length,
    retried,
    recovered,
    failed,
  };
}

interface BatchTranslation {
  titleJa: string;
  summaryJa?: string;
  linkTitleJa?: string;
  linkDescJa?: string;
}

/**
 * 1バッチの結果。失敗時は「送り直す価値があるか（retryable）」と
 * 「分割する価値があるか（contentSuspect）」を返す。
 * - retryable=true : 応答が壊れている / 5xx / タイムアウト → 間を置いて送り直せば回復しうる
 * - retryable=false: 429（レート制限）/ 403（キー不正）/ 400（リクエスト不正）→ 待っても直らない
 * - contentSuspect=true: 応答自体は返ったのに使えなかった（本文なし / JSON 破損 / 件数不一致）
 *   ＝バッチ内の特定の記事が原因の可能性がある → 呼び出し側が1件ずつに分割して切り分ける。
 *   5xx・タイムアウト・通信失敗は相手側の障害なので false（分割しても意味がない）。
 * 判定は classifyStatus() に集約してある（**403 を 429 と混ぜないこと**＝誤診の元）。
 */
type BatchOutcome =
  | { ok: true; data: BatchTranslation[] }
  | { ok: false; retryable: boolean; contentSuspect: boolean; reason: string };

/** 1バッチを Gemini で翻訳/要約。失敗理由は呼び出し側でまとめてログに出す。 */
async function translateBatch(
  batch: Target[],
  apiKey: string,
  model: string,
  temperature: number,
): Promise<BatchOutcome> {
  const entries = batch.map(({ titleInput, input, summarize, linkTitle, linkDesc }, i) => ({
    i,
    title: titleInput,
    body: input,
    summarize,
    linkTitle,
    linkDesc,
  }));

  const prompt =
    "次の配列の各エントリを処理し、{titleJa, summaryJa, linkTitleJa, linkDescJa} を返してください。\n" +
    "・titleJa: title を自然な日本語に翻訳。title が既に日本語ならそのまま、空文字なら空文字。\n" +
    "・summaryJa:\n" +
    "    summarize が true → body（記事本文）の要点を一読でつかめる日本語の要約にする:\n" +
    "      - 最重要の要点を結論から1つ書く。複数トピックの記事でも要点を1〜2点に絞り、網羅的に列挙しない。\n" +
    "      - 前置き・宣伝文句・筆者の感想は省き、事実だけを書く。タイトルの言い換えで終わらせない。\n" +
    "      - 最大2文・100字以内。やさしい言葉と短い文で必ず言い切る。本文に無い情報は足さない。\n" +
    "    summarize が false → body を自然な日本語に翻訳（body が空文字なら空文字）。\n" +
    "・linkTitleJa: linkTitle（リンク先の見出し）を自然な日本語に翻訳。空文字なら空文字。\n" +
    "・linkDescJa: linkDesc（リンク先の説明）を自然な日本語に翻訳。空文字なら空文字。\n" +
    "技術用語・製品名・固有名詞は無理に訳さず一般的な表記を使い、意味を保ってください。\n" +
    "入力と同じ順序・同じ件数で、各要素 {titleJa, summaryJa, linkTitleJa, linkDescJa} の JSON 配列のみを返してください。\n\n" +
    JSON.stringify(entries);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      // 初回 0.2（訳の安定を優先）。再送では段階的に上げる＝低温度だと暴走ループが
      // 同じ入力で毎回再現するため（ATTEMPT_TEMPERATURES のコメント参照）。
      temperature,
      // 暴走生成の打ち切り用（品質を絞る意図ではない）。詳細は maxOutputTokensFor のコメント。
      maxOutputTokens: maxOutputTokensFor(batch.length),
      responseMimeType: "application/json",
      responseSchema: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            titleJa: { type: "STRING" },
            summaryJa: { type: "STRING" },
            linkTitleJa: { type: "STRING" },
            linkDescJa: { type: "STRING" },
          },
          required: ["titleJa"],
        },
      },
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // 応答が返らないまま居座るのを防ぐ（実測で `fetch failed` が出ていた）。Node 18+。
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      // ⚠️ 改行を潰して**1行に収める**。Gemini のエラーは複数行 JSON で返るため、
      //    そのまま出すと並列実行中の他のログと混ざって読めなくなる（実際に読みにくかった）。
      const detail = (await res.text()).replace(/\s+/g, " ").slice(0, 200);
      const { retryable, label } = classifyStatus(res.status);
      return {
        ok: false,
        retryable,
        contentSuspect: false,
        reason: `Gemini ${res.status}（${label}）: ${detail}`,
      };
    }
    const data = (await res.json()) as {
      candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
    };
    const cand = data.candidates?.[0];
    // finishReason は原因の切り分けに要る。MAX_TOKENS なら出力上限に当たったということ
    // （暴走生成を打ち切れた、または上限が小さすぎる）。
    const finish = cand?.finishReason ?? "不明";
    const text = cand?.content?.parts?.[0]?.text;
    if (!text)
      return {
        ok: false,
        retryable: true,
        contentSuspect: true,
        reason: `応答に本文が無い（finishReason=${finish}）`,
      };
    let parsed: BatchTranslation[];
    try {
      parsed = JSON.parse(text) as BatchTranslation[];
    } catch (e) {
      // 生成が繰り返しループに陥り出力上限で切れると、閉じていない JSON が届いてここに来る。
      // **応答の文字数と finishReason を必ず出す**（正常時は数百〜数千字。桁違いなら暴走）。
      // ⚠️ MAX_TOKENS が続くなら maxOutputTokensFor の見積りを疑う（小さすぎると永久に失敗する）。
      return {
        ok: false,
        retryable: true,
        contentSuspect: true,
        reason: `応答の JSON が壊れている（応答 ${text.length} 文字 / finishReason=${finish}）: ${(e as Error).message}`,
      };
    }
    if (!Array.isArray(parsed) || parsed.length !== batch.length) {
      return {
        ok: false,
        retryable: true,
        contentSuspect: true,
        reason: `件数不一致（in ${batch.length} / out ${Array.isArray(parsed) ? parsed.length : "?"}）`,
      };
    }
    return { ok: true, data: parsed };
  } catch (e) {
    const err = e as Error;
    // AbortSignal.timeout は TimeoutError を投げる。`通信失敗` と区別しておく
    // （タイムアウトが続くなら REQUEST_TIMEOUT_MS か出力上限を見直す手がかりになる）。
    const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
    return {
      ok: false,
      retryable: true,
      contentSuspect: false,
      reason: timedOut
        ? `タイムアウト（${REQUEST_TIMEOUT_MS / 1000} 秒で応答なし）`
        : `通信失敗: ${err.message}`,
    };
  }
}
