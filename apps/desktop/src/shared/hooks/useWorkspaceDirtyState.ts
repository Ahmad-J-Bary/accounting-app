import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTabs } from "@app/providers/TabContext";
import { useWorkspaceTab } from "@app/providers/WorkspaceTabContext";

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return String(value);

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`);
    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(value);
}

interface WorkspaceDirtyStateOptions<T> {
  value: T;
  enabled?: boolean;
}

export function useWorkspaceDirtyState<T>({
  value,
  enabled = true,
}: WorkspaceDirtyStateOptions<T>) {
  const { markDirty } = useTabs();
  const { tabId } = useWorkspaceTab();
  const snapshot = useMemo(() => stableSerialize(value), [value]);
  const [baseline, setBaseline] = useState(snapshot);
  const latestSnapshotRef = useRef(snapshot);

  latestSnapshotRef.current = snapshot;

  const dirty = enabled && baseline !== snapshot;

  useEffect(() => {
    markDirty(tabId, dirty);

    return () => {
      markDirty(tabId, false);
    };
  }, [dirty, markDirty, tabId]);

  const resetDirtyBaseline = useCallback(() => {
    setBaseline(latestSnapshotRef.current);
    markDirty(tabId, false);
  }, [markDirty, tabId]);

  return {
    isDirty: dirty,
    resetDirtyBaseline,
  };
}
