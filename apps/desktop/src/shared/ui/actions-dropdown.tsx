import { MoreHorizontal } from "lucide-react";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

export interface ActionItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  className?: string;
}

interface ActionsDropdownProps {
  actions: ActionItem[];
}

export function ActionsDropdown({ actions }: ActionsDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {actions.map((action, i) => (
          <DropdownMenuItem key={i} onClick={action.onClick} className={`flex-row-reverse gap-2 ${action.className || ""}`}>
            {action.icon} {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
