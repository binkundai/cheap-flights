import { NextRequest, NextResponse } from "next/server";
import {
  DOMESTIC_DESTINATIONS,
  SEA_DESTINATIONS,
  JAPAN_DESTINATIONS,
  EUROPE_DESTINATIONS,
  ORIGIN_MAP,
  DEFAULT_THRESHOLD,
  DEFAULT_ORIGIN_CODE,
  type DestScope,
} from "@/lib/catalog";
import { scanLowestDeals, nextDays } from "@/lib/scan-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 扫描日期窗口：默认未来 7 天（捡漏以近期为主，兼顾速度） */
const DEFAULT_DAYS = 7;

interface ScanBody {
  from_code?: string;
  threshold?: number;
  dates?: string[]; // YYYY-MM-DD[]
  destinations?: string[]; // 可选：自定义目的地 code 列表
  /** 国内 / 东南亚 / 日本 / 欧洲，默认 domestic */
  scope?: DestScope;
}

function clampThreshold(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_THRESHOLD;
  return Math.max(100, Math.min(99999, Math.round(n)));
}

/** 扫描特价机票 */
export async function POST(req: NextRequest) {
  let body: ScanBody = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "请求体非 JSON" }, { status: 400 });
  }

  const from_code = body.from_code || DEFAULT_ORIGIN_CODE;
  if (!ORIGIN_MAP[from_code]) {
    return NextResponse.json(
      { ok: false, error: "仅支持上海及江浙沪出发（SHA/HGH/WUX/CZX/NTG）" },
      { status: 400 }
    );
  }

  // scope: domestic | international | japan | europe，默认 domestic
  const scope: DestScope =
    body.scope === "international" || body.scope === "japan" || body.scope === "europe"
      ? body.scope
      : "domestic";

  // 根据 scope 选择对应的目的地池
  let pool = DOMESTIC_DESTINATIONS;
  if (scope === "international") pool = SEA_DESTINATIONS;
  else if (scope === "japan") pool = JAPAN_DESTINATIONS;
  else if (scope === "europe") pool = EUROPE_DESTINATIONS;

  const threshold = clampThreshold(body.threshold);

  const dates =
    Array.isArray(body.dates) && body.dates.length
      ? body.dates.slice(0, 21)
      : nextDays(DEFAULT_DAYS);

  const dests = (
    Array.isArray(body.destinations) && body.destinations.length
      ? pool.filter((d) => body.destinations!.includes(d.code))
      : pool
  ).filter((d) => d.code !== from_code);

  // 国际航线（东南亚/日本/欧洲）上游 trip_mode 统一传 "international"
  const tripMode = scope === "domestic" ? "domestic" : "international";

  const result = await scanLowestDeals(
    from_code,
    dests.map((d) => d.code),
    dates,
    threshold,
    { limit: 60, trip_mode: tripMode }
  );

  return NextResponse.json({
    ok: true,
    data: {
      deals: result.deals,
      meta: {
        from_code,
        threshold,
        dates,
        scope,
        destinations_scanned: dests.length,
        total_deals: result.deals.length,
        auth_error: result.authError,
      },
    },
  });
}
