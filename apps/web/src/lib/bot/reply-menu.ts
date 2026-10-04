import { InlineKeyboard, Keyboard } from "grammy";
import type { Lang } from "./copy";
import { menuCustomEmojiId, menuPlainLabel, type MainMenuAction } from "./menu-emojis";

export function addReplyMenuButton(
  keyboard: Keyboard,
  lang: Lang,
  action: MainMenuAction,
  labelWithEmoji: string,
) {
  const emojiId = menuCustomEmojiId(action);
  if (emojiId) {
    keyboard.text(menuPlainLabel(lang, action)).icon(emojiId);
  } else {
    keyboard.text(labelWithEmoji);
  }
}

export function addInlineMenuButton(
  keyboard: InlineKeyboard,
  lang: Lang,
  action: MainMenuAction,
  labelWithEmoji: string,
  callbackData: string,
) {
  const emojiId = menuCustomEmojiId(action);
  if (emojiId) {
    keyboard.text(menuPlainLabel(lang, action), callbackData).icon(emojiId);
  } else {
    keyboard.text(labelWithEmoji, callbackData);
  }
}
