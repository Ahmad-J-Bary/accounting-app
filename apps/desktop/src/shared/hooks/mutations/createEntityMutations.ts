/**
 * createEntityMutations - Generic CRUD mutation factory.
 *
 * Eliminates the repetitive boilerplate of useCreate / useUpdate / useDelete
 * hooks across the entire application. Each entity-specific mutations file
 * simply calls this factory and re-exports the named hooks.
 *
 * Usage:
 *   const { useCreate, useUpdate, useDelete } = createEntityMutations({
 *     queryKey: QUERY_KEYS.customers,
 *     mutations: {
 *       create: { fn: customerService.create, successMsg: "تم إضافة العميل بنجاح", errorMsg: "فشل إضافة العميل" },
 *       update: { fn: customerService.update, successMsg: "تم تحديث العميل بنجاح", errorMsg: "فشل تحديث العميل" },
 *       delete: { fn: customerService.delete, successMsg: "تم حذف العميل بنجاح",  errorMsg: "فشل حذف العميل"  },
 *     },
 *   });
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ─── types ─────────────────────────────────────────────────────────────────

interface MutationDef<TArg> {
  /** The async function that performs the mutation. */
  fn: (arg: TArg) => Promise<unknown>;
  /** Toast message shown on success. */
  successMsg: string;
  /** Prefix for the toast error message (": " + error.message is appended). */
  errorMsg: string;
  /** Extra query keys to invalidate in addition to the primary `queryKey`. */
  extraInvalidations?: ReadonlyArray<readonly unknown[]>;
}

interface EntityMutationsConfig<TCreate, TUpdate> {
  /** The primary cache key to invalidate after any mutation. */
  queryKey: readonly unknown[];
  mutations: {
    create?: MutationDef<TCreate>;
    update?: MutationDef<TUpdate>;
    delete?: MutationDef<string>;
  };
}

// ─── factory ───────────────────────────────────────────────────────────────

export function createEntityMutations<TCreate = unknown, TUpdate = unknown>(
  config: EntityMutationsConfig<TCreate, TUpdate>,
) {
  const { queryKey, mutations } = config;

  /** React hook for the "create" mutation. Returns `undefined` if not configured. */
  function useCreate() {
    const qc = useQueryClient();
    const def = mutations.create;
    if (!def) throw new Error("createEntityMutations: 'create' mutation is not configured");
    return useMutation({
      mutationFn: def.fn as (arg: TCreate) => Promise<unknown>,
      onSuccess: () => {
        qc.invalidateQueries({ queryKey });
        def.extraInvalidations?.forEach((key) => qc.invalidateQueries({ queryKey: key }));
        toast.success(def.successMsg);
      },
      onError: (e: Error) => toast.error(`${def.errorMsg}: ${e.message}`),
    });
  }

  /** React hook for the "update" mutation. Returns `undefined` if not configured. */
  function useUpdate() {
    const qc = useQueryClient();
    const def = mutations.update;
    if (!def) throw new Error("createEntityMutations: 'update' mutation is not configured");
    return useMutation({
      mutationFn: def.fn as (arg: TUpdate) => Promise<unknown>,
      onSuccess: () => {
        qc.invalidateQueries({ queryKey });
        def.extraInvalidations?.forEach((key) => qc.invalidateQueries({ queryKey: key }));
        toast.success(def.successMsg);
      },
      onError: (e: Error) => toast.error(`${def.errorMsg}: ${e.message}`),
    });
  }

  /** React hook for the "delete" mutation (always receives a string id). */
  function useDelete() {
    const qc = useQueryClient();
    const def = mutations.delete;
    if (!def) throw new Error("createEntityMutations: 'delete' mutation is not configured");
    return useMutation({
      mutationFn: (id: string) => def.fn(id),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey });
        def.extraInvalidations?.forEach((key) => qc.invalidateQueries({ queryKey: key }));
        toast.success(def.successMsg);
      },
      onError: (e: Error) => toast.error(`${def.errorMsg}: ${e.message}`),
    });
  }

  return { useCreate, useUpdate, useDelete };
}
