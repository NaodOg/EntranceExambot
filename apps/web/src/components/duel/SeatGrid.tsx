"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import { fillTemplate } from "@/lib/i18n/merge";

export type SeatPlayer = {
  id: string;
  name: string;
  seat: number;
  isHost: boolean;
  hasFinished: boolean;
  score?: number;
  timeSec?: number;
  rank?: number;
};

export function SeatGrid({
  maxPlayers,
  players,
  youId,
  questionCount,
  winnerId,
}: {
  maxPlayers: number;
  players: SeatPlayer[];
  youId?: string;
  questionCount: number;
  winnerId?: string | null;
}) {
  const t = useAppCopy();
  const seats = Array.from({ length: maxPlayers }, (_, index) => {
    return players.find((player) => player.seat === index) ?? null;
  });

  return (
    <div className="dx-seats" aria-label={t.duelSeatsAria}>
      <AnimatePresence initial={false}>
        {seats.map((player, index) => {
          const isYou = player?.id === youId;
          const isWinner = player && winnerId && player.id === winnerId;
          return (
            <motion.div
              key={player?.id ?? `open-${index}`}
              layout
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`dx-seat ${player ? "is-filled" : "is-open"} ${isYou ? "is-you" : ""} ${isWinner ? "is-winner" : ""}`}
            >
              <span className="dx-seat-tag">
                {player?.isHost ? t.duelHost : fillTemplate(t.duelSeatP, { n: index + 1 })}
                {isYou ? t.duelSeatYou : ""}
              </span>
              <span className="dx-seat-name">
                {player ? player.name.toUpperCase() : t.duelSeatOpen}
              </span>
              {player?.hasFinished ? (
                <>
                  <span className="dx-seat-score">
                    {player.score ?? 0}/{questionCount}
                  </span>
                  <span className="dx-seat-meta">
                    {player.rank
                      ? fillTemplate(t.duelSeatRank, { n: player.rank })
                      : t.duelSeatDone}
                    {player.timeSec != null
                      ? fillTemplate(t.duelSeatTime, { n: player.timeSec })
                      : ""}
                  </span>
                </>
              ) : (
                <span className="dx-seat-meta">
                  {player ? t.duelSeatReady : t.duelSeatInsert}
                </span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
