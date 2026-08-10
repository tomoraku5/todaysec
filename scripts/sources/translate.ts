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
 */
import type { FeedItem, FeedSource } from "../../src/lib/feed";
import { mapLimit } from "./util";

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
  /** 応答不良で1回だけ送り直したバッチ数 */
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
  await mapLimit(batches, opts.concurrency, async (batch) => {
    let res = await translateBatch(batch, apiKey, opts.model);
    // 応答不良（JSON が途中で切れる等）は**確率的**に起きるので、同じ入力でも送り直すと
    // 大半は回復する。実測: 生成が繰り返しループに陥り 13万字を返して途中で切れていた。
    // ⚠️ レート制限（429/403）は再送すると追い打ちになるので retryable=false にしてある。
    if (!res.ok && res.retryable) {
      retried++;
      console.warn(`[translate] 応答不良のため1回だけ再送します（${batch.length} 件）: ${res.reason}`);
      res = await translateBatch(batch, apiKey, opts.model);
      if (res.ok) {
        recovered++;
        console.log(`[translate] 再送で回復しました（${batch.length} 件）`);
      }
    }
    if (!res.ok) {
      // ⚠️ 諦めた分は原文（英語）のまま公開される。次回 run で再試行されるが、
      // 「静かに減っている」ことに気づけるよう件数と理由を必ず残す。
      failed += batch.length;
      console.error(
        `[translate] このバッチは諦めます（${batch.length} 件は原文のまま・次回 run で再試行）: ${res.reason}`,
      );
      return;
    }
    const out = res.data;
    for (let i = 0; i < batch.length; i++) {
      const { item } = batch[i];
      const t = out[i];
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
      translated++;
    }
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
 * 1バッチの結果。失敗時は「送り直す価値があるか（retryable）」を返す。
 * - retryable=true : 応答が壊れている / 一時的な障害 → 同じ入力で送り直すと回復しうる
 * - retryable=false: レート制限（429/403）→ 送り直すと追い打ちになるだけなので諦める
 */
type BatchOutcome =
  | { ok: true; data: BatchTranslation[] }
  | { ok: false; retryable: boolean; reason: string };

/** 1バッチを Gemini で翻訳/要約。失敗理由は呼び出し側でまとめてログに出す。 */
async function translateBatch(
  batch: Target[],
  apiKey: string,
  model: string,
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
      temperature: 0.2,
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
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      // 429/403 = レート制限。ここで送り直しても状況を悪くするだけなので再送しない。
      // それ以外（5xx 等）はサーバ側の一時障害なので送り直す価値がある。
      const rateLimited = res.status === 429 || res.status === 403;
      return {
        ok: false,
        retryable: !rateLimited,
        reason: `Gemini ${res.status}${rateLimited ? "（レート制限・再送しない）" : ""}: ${detail}`,
      };
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { ok: false, retryable: true, reason: "応答に本文が無い" };
    let parsed: BatchTranslation[];
    try {
      parsed = JSON.parse(text) as BatchTranslation[];
    } catch (e) {
      // 生成が繰り返しループに陥り出力上限で切れると、閉じていない JSON が届いてここに来る。
      // **応答の文字数を必ず出す**（正常時は数百〜数千字。桁違いなら暴走と判別できる）。
      return {
        ok: false,
        retryable: true,
        reason: `応答の JSON が壊れている（応答 ${text.length} 文字）: ${(e as Error).message}`,
      };
    }
    if (!Array.isArray(parsed) || parsed.length !== batch.length) {
      return {
        ok: false,
        retryable: true,
        reason: `件数不一致（in ${batch.length} / out ${Array.isArray(parsed) ? parsed.length : "?"}）`,
      };
    }
    return { ok: true, data: parsed };
  } catch (e) {
    return { ok: false, retryable: true, reason: `通信失敗: ${(e as Error).message}` };
  }
}
