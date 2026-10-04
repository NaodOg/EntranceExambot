"use client";

import { haptic, hapticError, hapticSuccess } from "@/lib/telegram";
import {
  playCoinSound,
  playComboUpSound,
  playCorrectSound,
  playLaserSlice,
  playTapSound,
  playVictoryFanfare,
  playWrongSound,
} from "@/lib/sound";

export function buzz(
  enabled: boolean,
  type: "light" | "medium" | "heavy" = "light",
) {
  if (!enabled) return;
  haptic(type);
}

export function buzzSuccess(haptics: boolean, sound: boolean, combo = 0) {
  if (haptics) hapticSuccess();
  if (sound) playCorrectSound(true, combo);
}

export function buzzError(haptics: boolean, sound: boolean) {
  if (haptics) hapticError();
  if (sound) playWrongSound(true);
}

export function buzzTap(haptics: boolean, sound: boolean) {
  if (haptics) haptic("light");
  if (sound) playTapSound(true);
}

export function buzzCombo(haptics: boolean, sound: boolean, combo: number) {
  if (haptics) haptic("medium");
  if (sound) playComboUpSound(true, combo);
}

export function buzzVictory(haptics: boolean, sound: boolean) {
  if (haptics) hapticSuccess();
  if (sound) playVictoryFanfare(true);
}

export function buzzCoin(haptics: boolean, sound: boolean) {
  if (haptics) haptic("medium");
  if (sound) playCoinSound(true);
}

export function buzzLaser(haptics: boolean, sound: boolean) {
  if (haptics) haptic("light");
  if (sound) playLaserSlice(true);
}
