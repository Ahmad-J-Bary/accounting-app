import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { SidebarAddAction } from "@shared/components/SidebarAddAction";
import { useLocalization } from "@app/providers/LocalizationProvider";
import {
  ResponsiveActions,
  type ResponsiveActionItem,
} from "./ResponsiveActions";

interface Crumb {
  label: string;
  to?: string;
  onClick?: () => void;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
  actionItems?: ResponsiveActionItem[];
}

export function PageHeader({ title, subtitle, breadcrumbs, actions, actionItems }: PageHeaderProps) {
  const { direction } = useLocalization();
  const isRTL = direction === "rtl";
  const hasResponsiveActions = Boolean(actionItems?.length);

  return (
    <div className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          {breadcrumbs.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              {c.to ? (
                <Link to={c.to} className="hover:text-primary transition-colors">{c.label}</Link>
              ) : c.onClick ? (
                <button onClick={c.onClick} className="hover:text-primary border-none bg-transparent p-0 cursor-pointer transition-colors">{c.label}</button>
              ) : (
                <span>{c.label}</span>
              )}
              {i < breadcrumbs.length - 1 && (
                isRTL ? <ChevronLeft className="w-3 h-3 text-muted-foreground/60" /> : <ChevronRight className="w-3 h-3 text-muted-foreground/60" />
              )}
            </div>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{title}</h1>
            <SidebarAddAction label={title} />
          </div>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {(hasResponsiveActions || actions) && (
          <div className="min-w-0 flex-1 flex justify-end max-w-full">
            {hasResponsiveActions ? (
              <ResponsiveActions actions={actionItems ?? []} className="w-full flex justify-end" />
            ) : (
              <div className="flex items-center gap-2 flex-wrap justify-end">{actions}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
