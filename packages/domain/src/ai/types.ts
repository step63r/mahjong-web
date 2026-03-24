import type { PlayerAction } from "../action/index.js";
import type { RoundState } from "../round/index.js";

// ===== AI プレイヤーインターフェース =====

/**
 * CPU プレイヤーが利用可能なアクションの中から1つを選択するインターフェース
 */
export interface AiPlayer {
  /**
   * 利用可能なアクションの中から最適な1つを選択する
   *
   * @param actions 利用可能なアクション一覧
   * @param state 現在の局状態
   * @param playerIndex このAIプレイヤーのインデックス（0-3）
   * @returns 選択したアクション
   */
  chooseAction(
    actions: readonly PlayerAction[],
    state: RoundState,
    playerIndex: number,
  ): PlayerAction;
}
