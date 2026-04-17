import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useOnlineRoomStore } from "@/stores/onlineRoomStore";

type GameLength = "tonpu" | "hanchan";
type Mode = "select" | "create" | "join";

export function LobbyPage() {
  const navigate = useNavigate();
  const { createRoom, joinRoom, isConnecting, error, room } = useOnlineRoomStore();

  const [mode, setMode] = useState<Mode>("select");
  const [playerName, setPlayerName] = useState("");
  const [gameLength, setGameLength] = useState<GameLength>("hanchan");
  const [roomId, setRoomId] = useState("");

  const nameValid = playerName.trim().length >= 1 && playerName.trim().length <= 20;

  // room がセットされたら RoomPage へ遷移
  useEffect(() => {
    if (room) {
      navigate("/room");
    }
  }, [room, navigate]);

  const handleCreate = () => {
    if (!nameValid) return;
    createRoom(playerName.trim(), gameLength);
  };

  const handleJoin = () => {
    if (!nameValid || roomId.trim().length === 0) return;
    joinRoom(roomId.trim().toUpperCase(), playerName.trim());
  };

  return (
    <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center gap-8 p-4">
      <h1 className="text-4xl font-bold text-white tracking-wider">対人戦</h1>

      {/* モード選択 */}
      {mode === "select" && (
        <div className="flex flex-col gap-4 w-72">
          <button
            onClick={() => setMode("create")}
            className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 px-8 rounded-xl text-xl transition-colors"
          >
            ルームを作成
          </button>
          <button
            onClick={() => setMode("join")}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-xl text-xl transition-colors"
          >
            ルームに参加
          </button>
          <button
            onClick={() => navigate("/")}
            className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            戻る
          </button>
        </div>
      )}

      {/* ルーム作成フォーム */}
      {mode === "create" && (
        <div className="bg-emerald-800 rounded-xl p-6 w-full max-w-md space-y-5">
          <div>
            <label className="text-emerald-200 text-sm font-bold block mb-2">プレイヤー名</label>
            <input
              type="text"
              maxLength={20}
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="名前を入力（1〜20文字）"
              className="w-full bg-emerald-700 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="text-emerald-200 text-sm font-bold block mb-2">対局の長さ</label>
            <div className="flex gap-3">
              <button
                onClick={() => setGameLength("tonpu")}
                className={`flex-1 py-3 rounded-lg font-bold transition-colors ${
                  gameLength === "tonpu"
                    ? "bg-amber-600 text-white"
                    : "bg-emerald-700 text-emerald-300 hover:bg-emerald-600"
                }`}
              >
                東風戦
              </button>
              <button
                onClick={() => setGameLength("hanchan")}
                className={`flex-1 py-3 rounded-lg font-bold transition-colors ${
                  gameLength === "hanchan"
                    ? "bg-amber-600 text-white"
                    : "bg-emerald-700 text-emerald-300 hover:bg-emerald-600"
                }`}
              >
                半荘戦
              </button>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setMode("select")}
              className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-xl transition-colors"
            >
              戻る
            </button>
            <button
              onClick={handleCreate}
              disabled={!nameValid || isConnecting}
              className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-600 disabled:text-gray-400 text-white font-bold py-3 rounded-xl transition-colors"
            >
              {isConnecting ? "作成中..." : "作成"}
            </button>
          </div>
        </div>
      )}

      {/* ルーム参加フォーム */}
      {mode === "join" && (
        <div className="bg-emerald-800 rounded-xl p-6 w-full max-w-md space-y-5">
          <div>
            <label className="text-emerald-200 text-sm font-bold block mb-2">プレイヤー名</label>
            <input
              type="text"
              maxLength={20}
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="名前を入力（1〜20文字）"
              className="w-full bg-emerald-700 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="text-emerald-200 text-sm font-bold block mb-2">ルームID</label>
            <input
              type="text"
              maxLength={6}
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="6桁のルームIDを入力"
              className="w-full bg-emerald-700 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center text-xl font-mono"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setMode("select")}
              className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-xl transition-colors"
            >
              戻る
            </button>
            <button
              onClick={handleJoin}
              disabled={!nameValid || roomId.trim().length === 0 || isConnecting}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:text-gray-400 text-white font-bold py-3 rounded-xl transition-colors"
            >
              {isConnecting ? "参加中..." : "参加"}
            </button>
          </div>
        </div>
      )}

      <p className="text-emerald-400/60 text-sm mt-4">ゲストとしてプレイ中</p>
    </div>
  );
}
