import {
  Atom,
  Award,
  BookOpen,
  ChartLine,
  Dna,
  FlaskConical,
  FunctionSquare,
  Landmark,
  Languages,
  Leaf,
  Microscope,
  NotebookPen,
  ScrollText,
  Sigma,
  Telescope,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { createElement } from "react";

/**
 * Icons for matric study tracks and their subjects. Matched on slug substrings
 * so a subject can be renamed in the admin panel without losing its icon.
 */
const SUBJECT_ICONS: Array<[string, LucideIcon]> = [
  ["math", Sigma],
  ["additional-math", Sigma],
  ["english", Languages],
  ["physics", Atom],
  ["chemistry", FlaskConical],
  ["biology", Dna],
  ["general-science", Microscope],
  ["geography", Telescope],
  ["history", ScrollText],
  ["civics", Landmark],
  ["political", Landmark],
  ["economics", ChartLine],
  ["commerce", TrendingUp],
  ["technical", FunctionSquare],
  ["agriculture", Leaf],
  ["journalism", NotebookPen],
  ["bookkeeping", ChartLine],
  ["literature", BookOpen],
];

const TRACK_ICONS: Array<[string, LucideIcon]> = [
  ["natural", Atom],
  ["social", Landmark],
];

/** Icon for a study track (Natural Science, Social Science, ...). */
export function getTrackIcon(slug: string): LucideIcon {
  const s = slug.toLowerCase();
  for (const [needle, icon] of TRACK_ICONS) {
    if (s.includes(needle)) return icon;
  }
  return Award;
}

/** Icon for an examinable subject (Mathematics, English, Physics, ...). */
export function getSubjectIcon(slug: string): LucideIcon {
  const s = slug.toLowerCase();
  for (const [needle, icon] of SUBJECT_ICONS) {
    if (s.includes(needle)) return icon;
  }
  return BookOpen;
}

/**
 * Renders a subject's icon by slug.
 *
 * Callers must not do `const Icon = getSubjectIcon(slug)` inside a component:
 * that reads as creating a component during render, which remounts the icon on
 * every render and trips `react-hooks/static-components`. `createElement` keeps
 * the resolved icon out of JSX render scope entirely.
 */
export function SubjectIcon({
  slug,
  size = 14,
  className,
}: {
  slug: string;
  size?: number;
  className?: string;
}) {
  return createElement(getSubjectIcon(slug), { size, className });
}

/** Same as {@link SubjectIcon} but for a study track. */
export function TrackIcon({
  slug,
  size = 14,
  className,
}: {
  slug: string;
  size?: number;
  className?: string;
}) {
  return createElement(getTrackIcon(slug), { size, className });
}