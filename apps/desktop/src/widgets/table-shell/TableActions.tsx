import { Button } from "@shared/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@shared/ui/dropdown-menu";
import { LucideIcon, MoreHorizontal, Eye, Edit, Trash2, Download } from "lucide-react";
import { cn } from '@shared/lib/utils';
import { useLocalization } from "@app/providers/LocalizationProvider";

interface ActionItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "default" | "danger";
}

interface TableActionsProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onExportRow?: () => void;
  extraActions?: ActionItem[];
  align?: "start" | "end";
}

export function TableActions({ onView, onEdit, onDelete, onExportRow, extraActions, align = "end" }: TableActionsProps) {
  const { t } = useLocalization();
  return (
    <div onClick={e => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 transition-colors rounded-md"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="text-right min-w-[140px] rounded-xl shadow-xl border-slate-100">
          {onView && (
            <DropdownMenuItem onClick={onView} className="gap-2 cursor-pointer py-2.5">
              <Eye className="w-4 h-4 text-slate-400" />
              <span>{t('labels.viewDetails', { fallback: 'عرض التفاصيل' })}</span>
            </DropdownMenuItem>
          )}
          {onEdit && (
            <DropdownMenuItem onClick={onEdit} className="gap-2 cursor-pointer py-2.5">
              <Edit className="w-4 h-4 text-slate-400" />
              <span>{t('labels.editData', { fallback: 'تعديل البيانات' })}</span>
            </DropdownMenuItem>
          )}
          
          {extraActions?.map((action, idx) => (
            <DropdownMenuItem 
              key={idx} 
              onClick={action.onClick} 
              className={cn(
                "gap-2 cursor-pointer py-2.5",
                action.variant === "danger" && "text-red-600 focus:text-red-600 focus:bg-red-50/50"
              )}
            >
              <action.icon className={cn("w-4 h-4", action.variant === "danger" ? "text-red-400" : "text-slate-400")} />
              <span>{action.label}</span>
            </DropdownMenuItem>
          ))}

          {onExportRow && (
            <DropdownMenuItem onClick={onExportRow} className="gap-2 cursor-pointer py-2.5">
              <Download className="w-4 h-4 text-slate-400" />
              <span>{t('labels.exportExcel', { fallback: 'تصدير إكسل' })}</span>
            </DropdownMenuItem>
          )}

          {onDelete && (
            <>
              <div className="h-px bg-slate-50 my-1" />
              <DropdownMenuItem 
                onClick={onDelete} 
                className="gap-2 cursor-pointer py-2.5 text-red-600 focus:text-red-600 focus:bg-red-50/50 font-medium"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                <span>{t('labels.deleteRecord', { fallback: 'حذف السجل' })}</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
