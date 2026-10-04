import type { Context } from "grammy";
import { api } from "convex/_generated/api";
import { fill, t, type Lang } from "./copy";
import { ensureProfile, getConvex } from "./convex";
import { esc } from "./html";
import {
  mainInlineMenu,
  subjectKeyboard,
  trackKeyboard,
  languageKeyboard,
} from "./keyboards";
import { showScreen } from "./render";
import { sendSubjectPicker, sendTrackPicker } from "./quiz";

async function loadTracks() {
  const convex = getConvex();
  const rows = await convex.query(api.exams.listPublishedTracks, {});
  return rows.map((row) => ({
    slug: row.slug,
    nameEn: row.nameEn,
    nameAm: row.nameAm,
  }));
}

async function loadSubjects(trackSlug: string) {
  const convex = getConvex();
  const rows = await convex.query(api.exams.listPublishedSubjects, { trackSlug });
  return rows.map((row) => ({
    slug: row.slug,
    nameEn: row.nameEn,
    nameAm: row.nameAm,
    maxMarks: row.maxMarks,
  }));
}

/**
 * Shows the main menu. The welcome copy is only used the first time a user
 * lands here (e.g. `/start`); every later visit edits the same message and just
 * shows the menu so the greeting never repeats.
 */
export async function sendMainMenu(
  ctx: Context,
  lang: Lang,
  name?: string,
  opts: { welcome?: boolean } = {},
) {
  const c = t(lang);
  const text = opts.welcome
    ? fill(c.welcome, { name: name ? ` ${esc(name)}` : "" })
    : c.menuTitle;
  await showScreen(ctx, { text, keyboard: mainInlineMenu(lang) });
}

export async function startOnboarding(ctx: Context, lang: Lang = "en") {
  await showScreen(ctx, {
    text: t(lang).onboardLang,
    keyboard: languageKeyboard(lang),
  });
}

export async function maybeOnboard(
  ctx: Context,
  opts: { welcome?: boolean } = {},
): Promise<boolean> {
  if (!ctx.from) return false;
  const session = await ensureProfile(ctx.from);
  if (session.profile.onboardingComplete) {
    await sendMainMenu(ctx, session.lang, session.profile.firstName, opts);
    return false;
  }
  await startOnboarding(ctx, session.lang);
  return true;
}

export async function handleOnboardLanguage(ctx: Context, language: Lang) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  await session.convex.mutation(api.users.updatePreferences, {
    telegramId: session.telegramId,
    language,
  });
  const tracks = await loadTracks();
  const c = t(language);
  await showScreen(ctx, {
    text: c.onboardTrack,
    keyboard: trackKeyboard(tracks, language, "o", 0, 6, "onboard"),
  });
}

/** Step 1: the user picks a study track, which scopes every subject list. */
export async function handleOnboardTrack(ctx: Context, slug: string) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  await session.convex.mutation(api.users.updatePreferences, {
    telegramId: session.telegramId,
    trackSlug: slug,
  });

  const tracks = await loadTracks();
  const track = tracks.find((row) => row.slug === slug);
  const subjects = await loadSubjects(slug);
  const c = t(session.lang);

  await showScreen(ctx, {
    text: `${fill(c.onboardDone, { track: esc(track?.nameEn ?? slug) })}\n\n${c.onboardSubject}`,
    keyboard: subjects.length
      ? subjectKeyboard(subjects, session.lang, "o", 0, 8, slug)
      : mainInlineMenu(session.lang),
  });
}

/** Step 2: the first subject choice is what completes onboarding. */
export async function handleOnboardSubject(ctx: Context, subjectSlug: string) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const trackSlug = session.profile.trackSlug;
  if (!trackSlug) {
    await sendTrackPicker(ctx, session.lang, "o");
    return;
  }

  // Persist the pick so the web app and the bot agree on the active subject.
  await session.convex.mutation(api.users.updatePreferences, {
    telegramId: session.telegramId,
    onboardingComplete: true,
    subjectSlugs: [subjectSlug],
  });

  const subjects = await loadSubjects(trackSlug);
  const subject = subjects.find((row) => row.slug === subjectSlug);
  const tracks = await loadTracks();
  const track = tracks.find((row) => row.slug === trackSlug);
  const c = t(session.lang);

  const name =
    session.lang === "am"
      ? subject?.nameAm ?? subjectSlug
      : subject?.nameEn ?? subjectSlug;

  await showScreen(ctx, {
    text: fill(c.onboardSubjectDone, {
      track: esc(track?.nameEn ?? trackSlug),
      subject: esc(name),
    }),
    keyboard: mainInlineMenu(session.lang),
  });
}

export async function handleTrackPage(ctx: Context, context: string, page: number) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  if (context === "o") {
    const tracks = await loadTracks();
    await showScreen(ctx, {
      text: t(session.lang).onboardTrack,
      keyboard: trackKeyboard(tracks, session.lang, "o", page, 6, "onboard"),
    });
    return;
  }
  await sendTrackPicker(ctx, session.lang, context, page);
}

/** Paging inside the subject list; the track is carried so Back can return. */
export async function handleSubjectPage(
  ctx: Context,
  context: string,
  trackSlug: string | undefined,
  page: number,
) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  await sendSubjectPicker(ctx, session.lang, context, page, trackSlug ?? session.profile.trackSlug ?? undefined);
}