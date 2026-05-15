import { useQuery } from "@tanstack/react-query";
import { fetchAndEvaluateSubscription } from "@/lib/subscription";

export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: fetchAndEvaluateSubscription,
    staleTime: 60_000,
  });
}
