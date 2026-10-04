export type QuestionOption = {
  key: string;
  textEn: string;
  textAm: string;
};

export type QuestionView = {
  unit: string;
  chapter?: string;
  textEn: string;
  textAm: string;
  options: QuestionOption[];
  correctKey: string;
  explanationEn: string;
  explanationAm: string;
  imageUrl?: string | null;
};

export type QuestionCardProps = {
  question: QuestionView;
  selected?: string;
  onSelect: (key: string) => void;
  onReport?: (reason: string) => void;
  reported?: boolean;
  lang?: "en" | "am";
  instant?: boolean;
  locked?: boolean;
};

export function optionTone(
  selected: string | undefined,
  key: string,
  correctKey: string,
  reveal: boolean,
) {
  if (reveal && key === correctKey) return "correct" as const;
  if (reveal && selected === key) return "wrong" as const;
  if (selected === key) return "selected" as const;
  return "idle" as const;
}