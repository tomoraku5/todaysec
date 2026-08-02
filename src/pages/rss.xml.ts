import rss from "@astrojs/rss";
import { absUrl } from "@/lib/url";
import { sourceLabel, sourceListText, type FeedData } from "@/lib/feed";
import { readFeed } from "@/lib/feedStore";

export async function GET() {
  const feed = await readFeed<FeedData>(
    { updatedAt: new Date(0).toISOString(), items: [] },
    { bust: process.env.GITHUB_RUN_ID },
  );
  const items = [...feed.items].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return rss({
    title: "today.security — セキュリティ情報フィード",
    description: `${sourceListText()} から集約したセキュリティ関連情報。`,
    site: absUrl("/"),
    items: items.map((item) => ({
      title: `[${sourceLabel(item.source)}] ${item.title}`,
      link: item.url,
      pubDate: new Date(item.publishedAt),
      description: item.summary ?? "",
    })),
    customData: `<language>ja</language>`,
  });
}
