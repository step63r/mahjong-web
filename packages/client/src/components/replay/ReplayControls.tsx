/**
 * 牌譜再生操作コントロール
 */
import { getEventLabel } from "@/utils/replayConverter";

interface ReplayControlsProps {
  currentIndex: number;
  total: number;
  eventType: string;
  onPrev: () => void;
  onNext: () => void;
  onJump: (index: number) => void;
  onPrevRound?: () => void;
  onNextRound?: () => void;
  hasPrevRound?: boolean;
  hasNextRound?: boolean;
}

export function ReplayControls({
  currentIndex,
  total,
  eventType,
  onPrev,
  onNext,
  onJump,
  onPrevRound,
  onNextRound,
  hasPrevRound,
  hasNextRound,
}: ReplayControlsProps) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === total - 1;

  return (
    <div className="flex flex-col items-center gap-2 px-4 py-3 bg-gray-900/80 rounded-lg select-none">
      {/* ラベル行 */}
      <div className="text-white text-sm font-medium">
        <span className="text-yellow-300">{getEventLabel(eventType)}</span>
        <span className="text-gray-400 ml-2">
          {currentIndex + 1} / {total}
        </span>
      </div>

      {/* ボタン行 */}
      <div className="flex items-center gap-1">
        {/* 前の局 */}
        <button
          onClick={onPrevRound}
          disabled={!hasPrevRound}
          title="前の局"
          className="w-8 h-8 flex items-center justify-center rounded bg-gray-700 text-white disabled:opacity-30 hover:bg-gray-500 transition-colors text-xs font-bold"
        >
          ⏮
        </button>

        {/* 先頭へ */}
        <button
          onClick={() => onJump(0)}
          disabled={isFirst}
          title="先頭へ"
          className="w-8 h-8 flex items-center justify-center rounded bg-gray-700 text-white disabled:opacity-30 hover:bg-gray-500 transition-colors text-xs"
        >
          |◀
        </button>

        {/* 前へ */}
        <button
          onClick={onPrev}
          disabled={isFirst}
          title="前へ"
          className="w-8 h-8 flex items-center justify-center rounded bg-gray-700 text-white disabled:opacity-30 hover:bg-gray-500 transition-colors"
        >
          ◀
        </button>

        {/* 次へ */}
        <button
          onClick={onNext}
          disabled={isLast}
          title="次へ"
          className="w-8 h-8 flex items-center justify-center rounded bg-gray-700 text-white disabled:opacity-30 hover:bg-gray-500 transition-colors"
        >
          ▶
        </button>

        {/* 末尾へ */}
        <button
          onClick={() => onJump(total - 1)}
          disabled={isLast}
          title="末尾へ"
          className="w-8 h-8 flex items-center justify-center rounded bg-gray-700 text-white disabled:opacity-30 hover:bg-gray-500 transition-colors text-xs"
        >
          ▶|
        </button>

        {/* 次の局 */}
        <button
          onClick={onNextRound}
          disabled={!hasNextRound}
          title="次の局"
          className="w-8 h-8 flex items-center justify-center rounded bg-gray-700 text-white disabled:opacity-30 hover:bg-gray-500 transition-colors text-xs font-bold"
        >
          ⏭
        </button>
      </div>

      {/* スライダー */}
      <input
        type="range"
        min={0}
        max={total - 1}
        value={currentIndex}
        onChange={(e) => onJump(Number(e.target.value))}
        className="w-full accent-yellow-400"
      />
    </div>
  );
}
