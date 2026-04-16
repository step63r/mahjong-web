// round module - 局進行エンジン

export { RoundPhase, RoundEndReason } from "./types.js";
export type { RoundState, PlayerState, RoundResult, WinEntry, PaoInfo } from "./types.js";

export {
  createRound,
  startRound,
  applyAction,
  advanceToNextDraw,
  resolveAfterDiscard,
  resolveAfterKan,
  isFuriten,
} from "./round.js";
