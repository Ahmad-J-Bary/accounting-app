import React from 'react';
import { Button } from "@shared/ui/button";
import { 
  ChevronRight, 
  ChevronLeft, 
  ChevronsRight, 
  ChevronsLeft 
} from "lucide-react";
import { cn } from '@shared/lib/utils';
import { useLocalization } from "@app/providers/LocalizationProvider";

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  className?: string;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  className,
}) => {
  const { t, isRTL } = useLocalization();

  if (totalPages <= 1) return null;

  const FirstIcon = isRTL ? ChevronsRight : ChevronsLeft;
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;
  const LastIcon = isRTL ? ChevronsLeft : ChevronsRight;

  const startRecord = totalItems !== undefined ? (currentPage - 1) * (pageSize || 0) + 1 : 0;
  const endRecord = totalItems !== undefined ? Math.min(currentPage * (pageSize || 0), totalItems) : 0;

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 px-2 py-1", className)}>
      <div className="flex-1 min-w-[140px] text-xs text-muted-foreground font-medium tabular-nums">
        {totalItems !== undefined && (
          <span>
            {t('labels.showing', )} {startRecord} {t('labels.to', )} {endRecord} {t('labels.of', )} {totalItems} {t('labels.record', )}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 ms-auto">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label={t("accessibility.goToFirstPage", { namespace: "common" })}
        >
          <FirstIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label={t("accessibility.goToPreviousPage", { namespace: "common" })}
        >
          <PrevIcon className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-1 px-2 tabular-nums">
          <span className="text-xs font-bold text-foreground">{currentPage}</span>
          <span className="text-xs text-muted-foreground">/</span>
          <span className="text-xs font-medium text-muted-foreground">{totalPages}</span>
        </div>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label={t("accessibility.goToNextPage", { namespace: "common" })}
        >
          <NextIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          aria-label={t("accessibility.goToLastPage", { namespace: "common" })}
        >
          <LastIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
