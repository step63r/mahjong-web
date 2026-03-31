import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useOnlineRoomStore } from "@/stores/onlineRoomStore";

const SEAT_LABELS = ["東", "南", "西", "北"] as const;

export function RoomPage() {
  const navigate = useNavigate();
  const { room, playerName, gameStarted, clearGameStarted, leaveRoom, startGame } =
    useOnlineRoomStore();

  // ゲーム開始で対局画面へ遷移
  useEffect(() => {
    if (gameStarted) {
      clearGameStarted();
      navigate("/online-game");
    }
  }, [gameStarted, clearGameStarted, navigate]);

  // ルーム情報がない場合はロビーへ戻す
  useEffect(() => {
    if (!room) {
      navigate("/lobby");
    }
  }, [room, navigate]);

  if (!room) return null;

  const isHost =
    room.players.find((p) => p.seatIndex === room.hostSeatIndex)?.playerName === playerName;
  const playerCount = room.players.length;
  const canStart = isHost && playerCount === 4;

  const handleLeave = () => {
    leaveRoom();
    navigate("/lobby");
  };

  return (
    <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center gap-6 p-4">
      <h1 className="text-3xl font-bold text-white tracking-wider">ルーム待機中</h1>

      {/* ルームID */}
      <div className="bg-emerald-800 rounded-xl px-8 py-4 text-center">
        <p className="text-emerald-300 text-sm font-bold mb-1">ルームID</p>
        <p className="text-white text-4xl font-mono tracking-[0.3em] font-bold">{room.roomId}</p>
        <p className="text-emerald-400/60 text-xs mt-2">このIDを他のプレイヤーに共有してください</p>
      </div>

      {/* 対局タイプ */}
      <p className="text-emerald-300 text-sm">
        {room.gameType === "tonpu" ? "東風戦" : "半荘戦"}
      </p>

      {/* 座席一覧 */}
      <div className="bg-emerald-800 rounded-xl p-5 w-full max-w-sm space-y-3">
        <p className="text-emerald-200 text-sm font-bold mb-3">
          プレイヤー（{playerCount} / 4）
        </p>
        {Array.from({ length: 4 }, (_, i) => {
          const player = room.players.find((p) => p.seatIndex === i);
          const isSelf = player?.playerName === playerName;
          const isPlayerHost = i === room.hostSeatIndex;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 ${
                player ? "bg-emerald-700" : "bg-emerald-700/40"
              }`}
            >
              <span className="text-amber-400 font-bold text-lg w-6 text-center">
                {SEAT_LABELS[i]}
              </span>
              {player ? (
                <span className="text-white font-bold flex-1">
                  {player.playerName}
                  {isSelf && (
                    <span className="text-emerald-300 text-xs font-normal ml-2">（あなた）</span>
                  )}
                  {isPlayerHost && (
                    <span className="text-amber-400 text-xs font-normal ml-2">ホスト</span>
                  )}
                </span>
              ) : (
                <span className="text-emerald-500 italic flex-1">空席</span>
              )}
              {player && (
                <span
                  className={`w-2 h-2 rounded-full ${
                    player.isConnected ? "bg-green-400" : "bg-gray-500"
                  }`}
                  title={player.isConnected ? "接続中" : "切断中"}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* アクションボタン */}
      <div className="flex gap-3 w-full max-w-sm">
        <button
          onClick={handleLeave}
          className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-xl transition-colors"
        >
          退出
        </button>
        {isHost && (
          <button
            onClick={startGame}
            disabled={!canStart}
            className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-600 disabled:text-gray-400 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {canStart ? "ゲーム開始" : `あと${4 - playerCount}人待ち`}
          </button>
        )}
      </div>

      <p className="text-emerald-400/60 text-sm">プレイヤーが揃うと開始できます</p>
    </div>
  );
}
