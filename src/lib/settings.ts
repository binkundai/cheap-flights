"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_ORIGIN_CODE,
  DEFAULT_THRESHOLD,
  DEFAULT_SEA_THRESHOLD,
  DEFAULT_JAPAN_THRESHOLD,
  DEFAULT_EUROPE_THRESHOLD,
} from "@/lib/catalog";

/**
 * 出发城市 / 阈值设置持久化（localStorage）
 *
 * v3: 支持国内（threshold）、东南亚（sea_threshold）、日本（japan_threshold）、欧洲（europe_threshold）
 *     老的 v1/v2 key 会被读取一次作为兜底迁移，再写入 v3。
 */
export interface UserSettings {
  from_code: string;
  threshold: number; // 国内阈值
  sea_threshold: number; // 东南亚阈值
  japan_threshold: number; // 日本阈值
  europe_threshold: number; // 欧洲/土耳其阈值
}

const KEY = "cheap-flights:settings:v3";
const LEGACY_V2_KEY = "cheap-flights:settings:v2";
const LEGACY_V1_KEY = "cheap-flights:settings:v1";

/** 默认值（与 catalog 的默认值保持一致，默认出发地为上海） */
export const DEFAULT_SETTINGS: UserSettings = {
  from_code: DEFAULT_ORIGIN_CODE, // "SHA"
  threshold: DEFAULT_THRESHOLD, // 500
  sea_threshold: DEFAULT_SEA_THRESHOLD, // 1200
  japan_threshold: DEFAULT_JAPAN_THRESHOLD, // 1500
  europe_threshold: DEFAULT_EUROPE_THRESHOLD, // 3800
};

function migrateLegacy(): Partial<UserSettings> | null {
  if (typeof window === "undefined") return null;
  try {
    // 优先尝试读取 v2
    const rawV2 = window.localStorage.getItem(LEGACY_V2_KEY);
    if (rawV2) {
      const p2 = JSON.parse(rawV2) as Partial<UserSettings>;
      return {
        from_code: p2.from_code,
        threshold: p2.threshold,
        sea_threshold: p2.sea_threshold,
      };
    }
    // 其次尝试读取 v1
    const rawV1 = window.localStorage.getItem(LEGACY_V1_KEY);
    if (rawV1) {
      const p1 = JSON.parse(rawV1) as Partial<{ from_code: string; threshold: number }>;
      return {
        from_code: p1.from_code,
        threshold: p1.threshold,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function loadSettings(fallback: UserSettings): UserSettings {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(KEY);
    const p = raw ? (JSON.parse(raw) as Partial<UserSettings>) : null;
    
    // 如果没有 v3 数据，则尝试从老版本迁移
    const legacy = p ? null : migrateLegacy();
    const src = { ...(legacy ?? {}) };
    if (p) Object.assign(src, p);

    return {
      from_code: src.from_code || fallback.from_code,
      threshold:
        typeof src.threshold === "number" && src.threshold > 0
          ? src.threshold
          : fallback.threshold,
      sea_threshold:
        typeof src.sea_threshold === "number" && src.sea_threshold > 0
          ? src.sea_threshold
          : fallback.sea_threshold,
      japan_threshold:
        typeof src.japan_threshold === "number" && src.japan_threshold > 0
          ? src.japan_threshold
          : fallback.japan_threshold,
      europe_threshold:
        typeof src.europe_threshold === "number" && src.europe_threshold > 0
          ? src.europe_threshold
          : fallback.europe_threshold,
    };
  } catch {
    return fallback;
  }
}

export function saveSettings(s: UserSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** 仅在客户端读取一次设置，避免 SSR/CSR 水合不一致 */
export function useUserSettings(fallback: UserSettings) {
  const [settings, setSettings] = useState<UserSettings>(fallback);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSettings(loadSettings(fallback));
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { settings, setSettings, ready };
}
