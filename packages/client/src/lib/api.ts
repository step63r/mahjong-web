import { getIdToken } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/config";

export interface AuthUserDto {
  id: string;
  displayName: string;
  photoUrl: string | null;
}

export interface YakuCountDto {
  name: string;
  count: number;
}

export interface RecentRankDto {
  order: number;
  gameId: string;
  finishedAt: string | null;
  rank: number | null;
}

export interface StatsSummaryDto {
  gameType: "cpu" | "online" | "all";
  totalGames: number;
  rankCounts: [number, number, number, number];
  averageRank: number;
  totalScore: number;
  recentRanks: RecentRankDto[];
  winCount: number;
  lossCount: number;
  averageWinScore: number;
  averageWinHan: number;
  averageLossScore: number;
  averageLossHan: number;
  yakuStats: YakuCountDto[];
  averageLossScoreDelta: number;
}

export interface CpuRoundPlayerStatPayload {
  seatIndex: number;
  isWinner: boolean;
  isLoser: boolean;
  scoreDelta: number;
  yakuList?: Array<{ name: string; han?: number }>;
  han?: number;
  fu?: number;
}

export interface CpuRoundPayload {
  roundWind: number;
  roundNumber: number;
  honba: number;
  resultType: string;
  stats: CpuRoundPlayerStatPayload[];
}

export interface SaveCpuGamePayload {
  gameType: "cpu_tonpu" | "cpu_hanchan";
  ruleConfig: Record<string, unknown>;
  selfSeatIndex?: number;
  finishedAt?: string;
  players: Array<{
    seatIndex: number;
    playerName: string;
    finalScore: number;
    finalRank: number;
  }>;
  rounds: CpuRoundPayload[];
}

// Step2: イベント付きペイロード型（牌譜再生対応）
// export interface SaveCpuGameWithEventsPayload extends SaveCpuGamePayload {
//   roundEvents?: Array<RoundEventDataDto>; // from @mahjong-web/shared
// }

export interface SaveCpuGameResponseDto {
  gameId: string;
  roundCount: number;
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : undefined;

  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error?: string }).error)
        : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return body as T;
}

interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: HeadersInit;
  body?: unknown;
  idToken?: string;
  requireAuth?: boolean;
}

async function resolveIdToken(explicitIdToken?: string): Promise<string | null> {
  if (explicitIdToken) return explicitIdToken;
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) return null;
  return getIdToken(currentUser);
}

async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    headers,
    body,
    idToken,
    requireAuth = false,
  } = options;

  const resolvedIdToken = await resolveIdToken(idToken);
  if (requireAuth && !resolvedIdToken) {
    throw new Error("ログインが必要です");
  }

  const resolvedHeaders = new Headers(headers);
  if (body !== undefined && !resolvedHeaders.has("Content-Type")) {
    resolvedHeaders.set("Content-Type", "application/json");
  }
  if (resolvedIdToken) {
    resolvedHeaders.set("Authorization", `Bearer ${resolvedIdToken}`);
  }

  const response = await fetch(`${SERVER_URL}${path}`, {
    method,
    headers: resolvedHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return parseJsonOrThrow<T>(response);
}

export async function loginWithIdToken(idToken: string): Promise<AuthUserDto> {
  return apiRequest<AuthUserDto>("/api/auth/login", {
    method: "POST",
    body: { idToken },
  });
}

export async function getMyProfile(idToken: string): Promise<AuthUserDto> {
  return apiRequest<AuthUserDto>("/api/auth/me", {
    method: "GET",
    idToken,
    requireAuth: true,
  });
}

export async function getStatsSummary(gameType?: "cpu" | "online"): Promise<StatsSummaryDto> {
  const suffix = gameType ? `?gameType=${gameType}` : "";
  return apiRequest<StatsSummaryDto>(`/api/stats/me${suffix}`, {
    method: "GET",
    requireAuth: true,
  });
}

export async function saveCpuGame(
  payload: SaveCpuGamePayload,
): Promise<SaveCpuGameResponseDto> {
  return apiRequest<SaveCpuGameResponseDto>("/api/stats/games/cpu", {
    method: "POST",
    body: payload,
    requireAuth: true,
  });
}

// Step2: イベント付きゲーム保存（牌譜再生対応）
// export async function saveCpuGameWithEvents(
//   payload: SaveCpuGameWithEventsPayload,
// ): Promise<SaveCpuGameResponseDto> {
//   return apiRequest<SaveCpuGameResponseDto>("/api/stats/games/cpu", {
//     method: "POST",
//     body: payload,
//     requireAuth: true,
//   });
// }
