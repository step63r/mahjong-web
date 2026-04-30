/**
 * 牌譜再生用 Zustand ストア
 */
import { create } from "zustand";
import type { RoundSummaryDto, RoundEventDataDto } from "@mahjong-web/shared";
import { fetchGameRounds, fetchRoundReplay } from "@/lib/api";
import { buildReplaySnapshots } from "@/utils/replayConverter";
import type { ReplaySnapshot } from "@/utils/replayConverter";

interface ReplayStore {
  /** 現在再生中のゲームID */
  gameId: string | null;
  /** ゲームの局一覧（局タブ表示用） */
  roundSummaries: RoundSummaryDto[] | null;
  /** 現在選択中の局インデックス（roundSummaries 配列の位置） */
  roundIndex: number;
  /** 現在の局のスナップショット配列 */
  snapshots: ReplaySnapshot[] | null;
  /** 現在表示中のスナップショットインデックス */
  eventIndex: number;
  /** 非同期ロード中 */
  isLoading: boolean;
  /** エラーメッセージ */
  error: string | null;

  /**
   * ゲームをロードし、局サマリーを取得する。
   * 自動で最初の hasReplay な局をロードする。
   */
  loadGame: (gameId: string) => Promise<void>;

  /**
   * 指定インデックスの局をロードしスナップショットを構築する。
   */
  loadRound: (roundIndex: number) => Promise<void>;

  /** 次のスナップショットへ進む */
  stepForward: () => void;

  /** 前のスナップショットへ戻る */
  stepBackward: () => void;

  /** 指定インデックスへジャンプ */
  jumpTo: (index: number) => void;

  /** 前の局へ */
  prevRound: () => void;

  /** 次の局へ */
  nextRound: () => void;

  /** ストアをリセット */
  reset: () => void;
}

export const useReplayStore = create<ReplayStore>((set, get) => ({
  gameId: null,
  roundSummaries: null,
  roundIndex: -1,
  snapshots: null,
  eventIndex: 0,
  isLoading: false,
  error: null,

  loadGame: async (gameId: string) => {
    set({ isLoading: true, error: null, gameId });
    try {
      const summaries = await fetchGameRounds(gameId);
      set({ roundSummaries: summaries });

      // hasReplay な最初の局を自動ロード
      const firstIdx = summaries.findIndex((s) => s.hasReplay);
      if (firstIdx !== -1) {
        set({ isLoading: false });
        await get().loadRound(firstIdx);
      } else {
        set({ isLoading: false });
      }
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  loadRound: async (roundIndex: number) => {
    const { gameId, roundSummaries } = get();
    if (!gameId || !roundSummaries) return;
    const summary = roundSummaries[roundIndex];
    if (!summary || !summary.hasReplay) return;

    set({ isLoading: true, error: null });
    try {
      const eventData: RoundEventDataDto = await fetchRoundReplay(gameId, summary.roundId);
      const snapshots = buildReplaySnapshots(eventData);
      set({
        roundIndex: roundIndex,
        snapshots,
        eventIndex: 0,
        isLoading: false,
      });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  stepForward: () => {
    const { snapshots, eventIndex: currentSnapshotIndex } = get();
    if (!snapshots) return;
    const next = currentSnapshotIndex + 1;
    if (next < snapshots.length) {
      set({ eventIndex: next });
    }
  },

  stepBackward: () => {
    const { eventIndex: currentSnapshotIndex } = get();
    if (currentSnapshotIndex > 0) {
      set({ eventIndex: currentSnapshotIndex - 1 });
    }
  },

  jumpTo: (index: number) => {
    const { snapshots } = get();
    if (!snapshots) return;
    const clamped = Math.max(0, Math.min(index, snapshots.length - 1));
    set({ eventIndex: clamped });
  },

  prevRound: () => {
    const { roundIndex: currentRoundIndex, roundSummaries } = get();
    if (!roundSummaries) return;
    for (let i = currentRoundIndex - 1; i >= 0; i--) {
      if (roundSummaries[i].hasReplay) {
        void get().loadRound(i);
        return;
      }
    }
  },

  nextRound: () => {
    const { roundIndex: currentRoundIndex, roundSummaries } = get();
    if (!roundSummaries) return;
    for (let i = currentRoundIndex + 1; i < roundSummaries.length; i++) {
      if (roundSummaries[i].hasReplay) {
        void get().loadRound(i);
        return;
      }
    }
  },

  reset: () => {
    set({
      gameId: null,
      roundSummaries: null,
      roundIndex: -1,
      snapshots: null,
      eventIndex: 0,
      isLoading: false,
      error: null,
    });
  },
}));
