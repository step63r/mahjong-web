-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firebase_uid" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "game_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "rule_config" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_players" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "user_id" TEXT,
    "seat_index" INTEGER NOT NULL,
    "player_name" TEXT NOT NULL,
    "final_score" INTEGER,
    "final_rank" INTEGER,
    "rating_delta" DOUBLE PRECISION,

    CONSTRAINT "game_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "round_wind" INTEGER NOT NULL,
    "round_number" INTEGER NOT NULL,
    "honba" INTEGER NOT NULL DEFAULT 0,
    "result_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "round_player_stats" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "game_player_id" TEXT NOT NULL,
    "is_winner" BOOLEAN NOT NULL DEFAULT false,
    "is_loser" BOOLEAN NOT NULL DEFAULT false,
    "score_delta" INTEGER NOT NULL DEFAULT 0,
    "yaku_list" TEXT,
    "han" INTEGER,
    "fu" INTEGER,

    CONSTRAINT "round_player_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "game_players_game_id_seat_index_key" ON "game_players"("game_id", "seat_index");

-- CreateIndex
CREATE UNIQUE INDEX "round_player_stats_round_id_game_player_id_key" ON "round_player_stats"("round_id", "game_player_id");

-- AddForeignKey
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_player_stats" ADD CONSTRAINT "round_player_stats_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_player_stats" ADD CONSTRAINT "round_player_stats_game_player_id_fkey" FOREIGN KEY ("game_player_id") REFERENCES "game_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
