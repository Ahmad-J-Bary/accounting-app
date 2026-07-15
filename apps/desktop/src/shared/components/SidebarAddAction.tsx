import { useLocation } from 'react-router-dom';
import { useSidebarQuickAdd } from '@shared/hooks/useSidebarQuickAdd';
import { Plus, Pin } from 'lucide-react';
import { Button } from '@shared/ui/button';
import { cn } from '@shared/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/ui/tooltip';

interface SidebarAddActionProps {
  label: string;
  to?: string;
  icon?: string;
  className?: string;
}

export function SidebarAddAction({ label, to, icon = 'Layers', className }: SidebarAddActionProps) {
  const location = useLocation();
  const targetPath = to || location.pathname + location.search;

  const { toggleInSidebar, isInSidebar } = useSidebarQuickAdd();
  const added = isInSidebar(targetPath);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleInSidebar(label, targetPath, icon)}
            className={cn(
              "h-7 w-7 rounded-lg transition-all duration-200 shrink-0",
              added
                ? "bg-amber-50 text-amber-600 hover:bg-amber-100"
                : "text-slate-400 hover:bg-slate-100 hover:text-slate-600",
              className
            )}
          >
            {added ? (
              <Pin className="w-3.5 h-3.5" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {added ? 'إزالة من الشريط' : 'إضافة للشريط'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
export default SidebarAddAction;
