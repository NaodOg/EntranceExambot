"use client";

import { motion } from "framer-motion";
import { useAppCopy } from "@/lib/i18n/CopyProvider";

export type CoinFace = "star" | "ring" | "etb" | "mark" | "disc";

interface ArcadeCoinSlotProps {
  face?: CoinFace;
  price?: number;
  inserting?: boolean;
  spent?: boolean;
  processing?: boolean;
  className?: string;
}

const insertEase = [0.32, 0, 0.18, 1] as const;

export function ArcadeCoinSlot({
  face = "etb",
  price = 200,
  inserting = false,
  spent = false,
  processing = false,
  className = "",
}: ArcadeCoinSlotProps) {
  const t = useAppCopy();
  const gone = inserting || spent;
  const busy = processing || inserting;

  return (
    <div className={`d-slot ${gone ? "is-in" : ""} ${className}`}>
      <div className="d-slot-body is-tall">
        <Coin face={face} gone={gone} price={price} />
        <span className={`slot-slit-bar is-thin ${gone ? "is-lit" : ""}`} />
      </div>
      <span className={`d-slot-status ${busy ? "is-busy" : ""}`}>
        {busy ? t.proProcessing : t.proInsertCoin}
      </span>
    </div>
  );
}

function Coin({ face, gone, price }: { face: CoinFace; gone: boolean; price: number }) {
  return (
    <motion.span
      className={`slot-coin is-face face-${face}`}
      initial={false}
      animate={
        gone
          ? {
              y: [0, -11, -4, 24],
              rotateX: [0, 18, 68, 88],
              scaleX: [1, 0.9, 0.36, 0.08],
              scaleY: [1, 1.02, 0.92, 0.55],
              opacity: [1, 1, 1, 0],
            }
          : {
              y: [0, -3.5, 0],
              rotateX: [0, 8, 0],
              scaleX: 1,
              scaleY: 1,
              opacity: 1,
            }
      }
      transition={
        gone
          ? { duration: 0.72, times: [0, 0.22, 0.48, 1], ease: insertEase }
          : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
      }
    >
      {face === "star" && <b>★</b>}
      {face === "ring" && <i className="coin-ring" />}
      {face === "etb" && <b className="coin-etb">{price}</b>}
      {face === "mark" && <i className="coin-mark" />}
      {face === "disc" && <i className="coin-core" />}
    </motion.span>
  );
}
