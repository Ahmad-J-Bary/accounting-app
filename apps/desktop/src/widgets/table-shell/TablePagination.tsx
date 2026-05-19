import React from 'react';
import { Button } from "@shared/ui/button";
import { 
  ChevronRight, 
  ChevronLeft, 
  ChevronsRight, 
  ChevronsLeft 
} from "lucide-react";
import { cn } from '@shared/lib/utils';

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
  if (totalPages <= 1) return null;

  return (
    <div className={cn("flex items-center justify-between px-2 py-1", className)} dir="rtl">
      <div className="flex-1 text-sm text-slate-500 font-medium">
        {totalItems !== undefined && (
          <span>
            عرض {(currentPage - 1) * (pageSize || 0) + 1} إلى {Math.min(currentPage * (pageSize || 0), totalItems)} من {totalItems} سجل
          </span>
        )}
      </div>
      <div className="flex items-center space-x-2 space-x-reverse">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 border-slate-200"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 border-slate-200"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-1 px-2">
          <span className="text-sm font-bold text-slate-700">{currentPage}</span>
          <span className="text-sm text-slate-400">من</span>
          <span className="text-sm font-bold text-slate-700">{totalPages}</span>
        </div>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 border-slate-200"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 border-slate-200"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
