import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface Crumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          {breadcrumbs.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              {c.to ? (
                <Link to={c.to} className="hover:text-primary">{c.label}</Link>
              ) : (
                <span>{c.label}</span>
              )}
              {i < breadcrumbs.length - 1 && <ChevronLeft className="w-3 h-3" />}
            </div>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
    </div>
  );
}