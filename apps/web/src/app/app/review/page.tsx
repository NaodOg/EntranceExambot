import { Suspense } from "react";
import ReviewPageClient from "./review-client";
import { PageSkeleton } from "@/components/ui/Skeleton";

export default function ReviewPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReviewPageClient />
    </Suspense>
  );
}
