"use client";

import { useState } from "react";
import Link from "next/link";
import { ArcadeCoinSlot, type CoinFace } from "@/components/ui/ArcadeCoinSlot";
import { buzzCoin } from "@/lib/feedback";

const VARIANTS: Array<{ id: CoinFace; letter: string; name: string; note: string }> = [
  { id: "star", letter: "A", name: "STAR", note: "Solid token with a star stamp." },
  { id: "ring", letter: "B", name: "RING", note: "Hollow washer. Looks like a real arcade token." },
  { id: "etb", letter: "C", name: "200", note: "Price stamped on the face." },
  { id: "mark", letter: "D", name: "MARK", note: "Diamond cut. No text." },
  { id: "disc", letter: "E", name: "DISC", note: "Two-tone blank. Just metal." },
];

export default function CoinLabPage() {
  const [active, setActive] = useState<CoinFace | null>(null);

  function play(id: CoinFace) {
    if (active) return;
    setActive(id);
    buzzCoin(true, true);
    window.setTimeout(() => setActive(null), 1600);
  }

  return (
    <main className="coin-lab">
      <header className="coin-lab-head">
        <Link href="/app/pro" className="coin-lab-back">
          ← PRO
        </Link>
        <p className="kicker">LAB · COIN FACE</p>
        <h1>PICK A COIN</h1>
        <p>Slot is B / TALL. Coin lifts, turns on edge, then drops in. Tell me the letter.</p>
      </header>

      <div className="coin-lab-grid">
        {VARIANTS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`coin-lab-card cab ${active === v.id ? "is-on" : ""}`}
            onClick={() => play(v.id)}
          >
            <div className="coin-lab-meta">
              <span className="coin-lab-id">{v.letter}</span>
              <span className="coin-lab-name">{v.name}</span>
            </div>
            <div className="coin-lab-stage">
              <ArcadeCoinSlot
                face={v.id}
                inserting={active === v.id}
                processing={active === v.id}
              />
            </div>
            <p className="coin-lab-note">{v.note}</p>
            <span className="coin-lab-tap">
              {active === v.id ? "PROCESSING" : "TAP TO INSERT"}
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}
