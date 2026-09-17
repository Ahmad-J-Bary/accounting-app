import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NAV_GROUPS } from '@app/shell/sidebarConfig';
import { useLocalization } from '@app/providers/LocalizationProvider';
import { useAppearance } from '@shared/hooks/useAppearance';
import { useNavLabels } from '@shared/hooks';
import { cn } from '@shared/lib/utils';

const MAX_VISIBLE_ITEMS = 4;

export function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useAppearance();
  const { t } = useLocalization();
  const { itemLabel } = useNavLabels();
  const [showOverflow, setShowOverflow] = useState(false);

  const items = NAV_GROUPS.flatMap((group) => group.items);
  const visibleItems = items.slice(0, MAX_VISIBLE_ITEMS);
  const overflowItems = items.slice(MAX_VISIBLE_ITEMS);

  const isLight = settings.verticalNavbarAppearance === 'light';
  const bgClass = isLight ? 'bg-white border-gray-200' : 'bg-slate-900 border-slate-700';
  const activeClass = isLight ? 'text-primary' : 'text-primary';
  const inactiveClass = isLight ? 'text-gray-500' : 'text-muted-foreground';
  const overflowBgClass = isLight ? 'bg-white' : 'bg-slate-900';
  const overflowBorderClass = isLight ? 'border-gray-200' : 'border-slate-700';

  return (
    <>
      {showOverflow && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setShowOverflow(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowOverflow(false); }}
        />
      )}

      <nav
        className={cn(
          "fixed bottom-0 start-0 end-0 border-t md:hidden z-50",
          bgClass,
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around h-14 px-1">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.to;
            const label = itemLabel({ id: item.id, defaultLabel: item.label });
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.to)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-0.5 min-w-0",
                  isActive ? activeClass : inactiveClass,
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="text-lg shrink-0"><item.icon /></span>
                <span className="text-[9px] leading-tight truncate max-w-[48px]">{label}</span>
              </button>
            );
          })}

          {overflowItems.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowOverflow(!showOverflow)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-0.5 min-w-0",
                  showOverflow ? activeClass : inactiveClass,
                )}
                aria-expanded={showOverflow}
                aria-label={t("accessibility.moreNavigation")}
              >
                <span className="text-lg shrink-0">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <circle cx="4" cy="10" r="1.5" />
                    <circle cx="10" cy="10" r="1.5" />
                    <circle cx="16" cy="10" r="1.5" />
                  </svg>
                </span>
                <span className="text-[9px] leading-tight">{t("actions.more")}</span>
              </button>

              {showOverflow && (
                <div
                  className={cn(
                    "absolute bottom-full mb-2 end-0 min-w-[180px] rounded-lg border shadow-lg z-50",
                    overflowBgClass,
                    overflowBorderClass,
                  )}
                  role="menu"
                >
                  {overflowItems.map((item) => {
                    const isActive = location.pathname === item.to;
                    const label = itemLabel({ id: item.id, defaultLabel: item.label });
                    return (
                      <button
                        key={item.id}
                        onClick={() => { navigate(item.to); setShowOverflow(false); }}
                        className={cn(
                          "flex items-center gap-3 w-full px-3 py-2.5 text-sm text-start",
                          isActive ? activeClass : inactiveClass,
                        )}
                        role="menuitem"
                      >
                        <item.icon />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
