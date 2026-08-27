import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingCard() {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="size-10 rounded-xl" />
      </div>
      <Skeleton className="mt-3 h-4 w-20" />
    </Card>
  );
}

export function LoadingChart() {
  return (
    <Card className="p-6">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-4 h-[260px] w-full rounded-xl" />
    </Card>
  );
}
