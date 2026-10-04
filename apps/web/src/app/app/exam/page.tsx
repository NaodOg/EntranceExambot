import { Suspense } from "react";
import ExamPageClient from "./exam-client";
import { ExamSkeleton } from "@/components/ui/Skeleton";

export default function ExamPage() {
  return (
    <Suspense fallback={<ExamSkeleton />}>
      <ExamPageClient />
    </Suspense>
  );
}
