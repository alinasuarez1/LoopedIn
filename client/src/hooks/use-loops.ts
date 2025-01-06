import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Loop, InsertLoop } from "@db/schema";

export function useLoops() {
  const queryClient = useQueryClient();

  const { data: loops, isLoading } = useQuery<Loop[]>({
    queryKey: ["/api/loops"],
  });

  const createLoop = useMutation({
    mutationFn: async (loop: InsertLoop) => {
      const res = await fetch("/api/loops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loop),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loops"] });
    },
  });

  const updateLoop = useMutation({
    mutationFn: async ({ id, ...loop }: Loop) => {
      const res = await fetch(`/api/loops/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loop),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loops"] });
    },
  });

  const deleteLoop = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/loops/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loops"] });
    },
  });

  return {
    loops,
    isLoading,
    createLoop: createLoop.mutateAsync,
    updateLoop: updateLoop.mutateAsync,
    deleteLoop: deleteLoop.mutateAsync,
  };
}

export function useLoop(id: number) {
  const { data: loop, isLoading } = useQuery<Loop>({
    queryKey: [`/api/loops/${id}`],
  });

  return {
    loop,
    isLoading,
  };
}
