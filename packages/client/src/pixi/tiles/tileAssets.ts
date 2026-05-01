/**
 * SVG 画像ファイルベースの牌テクスチャローダー
 *
 * src/images/ に格納された SVG 画像を Vite の静的アセットとしてインポートし、
 * Pixi.js Texture に変換・キャッシュする。
 *
 * 旧 tileSvg.ts + tileTexture.ts を置き換える。
 */
import { Assets, Texture } from "pixi.js";

// ===== SVG 画像の静的インポート（Vite が URL 文字列に変換） =====

import imgMan1 from "../../images/Man1.svg";
import imgMan2 from "../../images/Man2.svg";
import imgMan3 from "../../images/Man3.svg";
import imgMan4 from "../../images/Man4.svg";
import imgMan5 from "../../images/Man5.svg";
import imgMan5Dora from "../../images/Man5-Dora.svg";
import imgMan6 from "../../images/Man6.svg";
import imgMan7 from "../../images/Man7.svg";
import imgMan8 from "../../images/Man8.svg";
import imgMan9 from "../../images/Man9.svg";

import imgPin1 from "../../images/Pin1.svg";
import imgPin2 from "../../images/Pin2.svg";
import imgPin3 from "../../images/Pin3.svg";
import imgPin4 from "../../images/Pin4.svg";
import imgPin5 from "../../images/Pin5.svg";
import imgPin5Dora from "../../images/Pin5-Dora.svg";
import imgPin6 from "../../images/Pin6.svg";
import imgPin7 from "../../images/Pin7.svg";
import imgPin8 from "../../images/Pin8.svg";
import imgPin9 from "../../images/Pin9.svg";

import imgSou1 from "../../images/Sou1.svg";
import imgSou2 from "../../images/Sou2.svg";
import imgSou3 from "../../images/Sou3.svg";
import imgSou4 from "../../images/Sou4.svg";
import imgSou5 from "../../images/Sou5.svg";
import imgSou5Dora from "../../images/Sou5-Dora.svg";
import imgSou6 from "../../images/Sou6.svg";
import imgSou7 from "../../images/Sou7.svg";
import imgSou8 from "../../images/Sou8.svg";
import imgSou9 from "../../images/Sou9.svg";

import imgTon from "../../images/Ton.svg";
import imgNan from "../../images/Nan.svg";
import imgShaa from "../../images/Shaa.svg";
import imgPei from "../../images/Pei.svg";
import imgHaku from "../../images/Haku.svg";
import imgHatsu from "../../images/Hatsu.svg";
import imgChun from "../../images/Chun.svg";

import imgBack from "../../images/Back.svg";
import imgFront from "../../images/Front.svg";

// ===== ドメイン牌種 → SVG URL マッピング =====

/** 通常牌の URL マッピング (tileType → SVG URL) */
const FACE_URLS: Record<string, string> = {
  man1: imgMan1, man2: imgMan2, man3: imgMan3, man4: imgMan4,
  man5: imgMan5, man6: imgMan6, man7: imgMan7, man8: imgMan8, man9: imgMan9,
  pin1: imgPin1, pin2: imgPin2, pin3: imgPin3, pin4: imgPin4,
  pin5: imgPin5, pin6: imgPin6, pin7: imgPin7, pin8: imgPin8, pin9: imgPin9,
  sou1: imgSou1, sou2: imgSou2, sou3: imgSou3, sou4: imgSou4,
  sou5: imgSou5, sou6: imgSou6, sou7: imgSou7, sou8: imgSou8, sou9: imgSou9,
  ton: imgTon, nan: imgNan, sha: imgShaa, pei: imgPei,
  haku: imgHaku, hatsu: imgHatsu, chun: imgChun,
};

/** 赤ドラの URL マッピング (tileType → SVG URL) */
const RED_DORA_URLS: Record<string, string> = {
  man5: imgMan5Dora,
  pin5: imgPin5Dora,
  sou5: imgSou5Dora,
};

// ===== テクスチャキャッシュ =====

const cache = new Map<string, Texture>();
const loading = new Map<string, Promise<Texture>>();

function cacheKey(tileType: string, isRedDora: boolean): string {
  return `tile:${tileType}:${isRedDora ? "red" : "normal"}`;
}

async function loadTexture(key: string, url: string): Promise<Texture> {
  const existing = cache.get(key);
  if (existing) return existing;

  const inflight = loading.get(key);
  if (inflight) return inflight;

  const dpr = window.devicePixelRatio ?? 1;
  const w = Math.round(80 * dpr);
  const h = Math.round(w * (4 / 3));

  const promise = new Promise<Texture>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        const tex = Texture.from({ resource: canvas, scaleMode: "linear" });
        cache.set(key, tex);
        loading.delete(key);
        resolve(tex);
      } catch (e) {
        reject(e as Error);
      }
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });

  loading.set(key, promise);
  return promise;
}

// ===== 公開 API =====

/**
 * 牌の SVG 画像 URL を取得（HTML <img> 用）
 */
export function getTileFaceUrl(tileType: string, isRedDora: boolean): string {
  if (isRedDora) {
    return RED_DORA_URLS[tileType] ?? FACE_URLS[tileType] ?? imgFront;
  }
  return FACE_URLS[tileType] ?? imgFront;
}

/**
 * 牌の裏面 SVG 画像 URL を取得（HTML <img> 用）
 */
export function getTileBackUrl(): string {
  return imgBack;
}

/**
 * 牌の表面テクスチャを取得（非同期・キャッシュ済み）
 */
export function getTileFaceTexture(tileType: string, isRedDora: boolean): Promise<Texture> {
  const key = cacheKey(tileType, isRedDora);
  const url = isRedDora
    ? (RED_DORA_URLS[tileType] ?? FACE_URLS[tileType])
    : FACE_URLS[tileType];
  if (!url) {
    // フォールバック: 無地表面
    return loadTexture(key, imgFront);
  }
  return loadTexture(key, url);
}

/**
 * 牌の裏面テクスチャを取得（非同期・キャッシュ済み）
 */
export function getTileBackTexture(): Promise<Texture> {
  return loadTexture("back", imgBack);
}

/**
 * 無地表面テクスチャ（暗槓の裏向き牌に使用可能）
 */
export function getTileFrontTexture(): Promise<Texture> {
  return loadTexture("front", imgFront);
}

/**
 * 全牌種のテクスチャを事前ロード
 *
 * ゲーム開始前に呼び出すことで描画時の遅延を防ぐ。
 */
export async function preloadAllTileAssets(): Promise<void> {
  const suits = ["man", "pin", "sou"];
  const honors = ["ton", "nan", "sha", "pei", "haku", "hatsu", "chun"];
  const promises: Promise<Texture>[] = [];

  for (const suit of suits) {
    for (let n = 1; n <= 9; n++) {
      promises.push(getTileFaceTexture(`${suit}${n}`, false));
      if (n === 5) {
        promises.push(getTileFaceTexture(`${suit}${n}`, true));
      }
    }
  }
  for (const honor of honors) {
    promises.push(getTileFaceTexture(honor, false));
  }
  promises.push(getTileBackTexture());
  promises.push(getTileFrontTexture());

  await Promise.all(promises);
}

/**
 * キャッシュ済み表面テクスチャを同期取得（プリロード後に使用）
 */
export function getCachedFaceTexture(tileType: string, isRedDora: boolean): Texture | undefined {
  return cache.get(cacheKey(tileType, isRedDora));
}

/**
 * キャッシュ済み裏面テクスチャを同期取得
 */
export function getCachedBackTexture(): Texture | undefined {
  return cache.get("back");
}

/**
 * キャッシュ済み無地表面テクスチャを同期取得
 */
export function getCachedFrontTexture(): Texture | undefined {
  return cache.get("front");
}
