import { useDistributionSource } from "../hooks/useDistributionSource";
import { useDistributionPool } from "../hooks/useDistributionPool";
import { ProfitDistributionWorkflow } from "./ProfitDistributionWorkflow";
import type { ProfitDistributionSource } from "@modules/accounting/api/openingBalanceService";

interface ProfitDistributionSidePanelProps {
  onClose: () => void;
  source?: ProfitDistributionSource | null;
  sourceLabel?: string;
  windowStart?: string;
  windowEnd?: string;
}

/**
 * Thin data-fetching shell. All UI (FormPanel, header, footer, steps) lives
 * inside ProfitDistributionWorkflow so there is exactly ONE panel rendered.
 */
export function ProfitDistributionSidePanel({
  onClose,
  source: externalSource,
  sourceLabel: externalLabel,
  windowStart: externalStart,
  windowEnd: externalEnd,
}: ProfitDistributionSidePanelProps) {
  const {
    source: autoSource,
    sourceLabel: autoLabel,
    windowStart: autoStart,
    windowEnd: autoEnd,
    isLoading: sourceLoading,
  } = useDistributionSource();

  const source = externalSource ?? autoSource;
  const sourceLabel = externalLabel ?? autoLabel;
  const windowStart = externalStart ?? autoStart;
  const windowEnd = externalEnd ?? autoEnd;

  const { pool, isLoading: poolLoading, isError, error, refetch } =
    useDistributionPool(source, windowStart, windowEnd);

  return (
    <ProfitDistributionWorkflow
      onClose={onClose}
      source={source}
      sourceLabel={sourceLabel}
      windowStart={windowStart}
      windowEnd={windowEnd}
      pool={pool}
      isLoading={sourceLoading || poolLoading}
      isError={isError}
      error={error}
      refetch={refetch}
    />
  );
}
