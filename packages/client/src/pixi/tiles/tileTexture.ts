/**
 * 牌の Pixi.js テクスチャ生成・キャッシュ
 *
 * buildTileFaceSvg / buildTileBackSvg で生成した SVG 文字列を
 * data URL 経由で Pixi.js Texture に変換し、キャッシュして返す。
 */
import { Assets, Texture } from "pixi.js";
import { buildTileFaceSvg, buildTileBackSvg } from "./tileSvg";

/** テクスチャキャッシュ (キー: "face:{type}:{red}" or "back") */
const cache = new Map<string, Texture>();

/** 読み込み中の Promise キャッシュ（重複リクエスト防止） */
const loading = new Map<string, Promise<Texture>>();

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function loadSvgTexture(key: string, svg: string): Promise<Texture> {
  const existing = cache.get(key);
  if (existing) return existing;

  const inflight = loading.get(key);
  if (inflight) return inflight;

  const promise = Assets.load<Texture>({
    src: svgToDataUrl(svg),
    data: { resolution: 2 },
  }).then((tex) => {
    cache.set(key, tex);
    loading.delete(key);
    return tex;
  });

  loading.set(key, promise);
  return promise;
}

/**
 * 牌の表面テクスチャを取得（非同期・キャッシュ済み）
 */
export function getTileFaceTexture(tileType: string, isRedDora: boolean): Promise<Texture> {
  const key = `face:${tileType}:${isRedDora ? 1 : 0}`;
  return loadSvgTexture(key, buildTileFaceSvg(tileType, isRedDora));
}

/**
 * 牌の裏面テクスチャを取得（非同期・キャッシュ済み）
 */
export function getTileBackTexture(): Promise<Texture> {
  const key = "back";
  return loadSvgTexture(key, buildTileBackSvg());
}

/**
 * 全牌種のテクスチャを事前ロード
 *
 * ゲーム開始前に呼ぶと描画時の遅延を防げる。
 */
export async function preloadAllTileTextures(): Promise<void> {
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

  await Promise.all(promises);
}

/**
 * キャッシュ済みテクスチャを同期的に取得（プリロード後に使用）
 * プリロードされていない場合は undefined を返す。
 */
export function getCachedTileFaceTexture(tileType: string, isRedDora: boolean): Texture | undefined {
  return cache.get(`face:${tileType}:${isRedDora ? 1 : 0}`);
}

export function getCachedTileBackTexture(): Texture | undefined {
  return cache.get("back");
}
