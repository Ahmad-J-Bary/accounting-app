import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NAV_GROUPS } from '@app/shell/sidebarConfig';
import { useAppearance } from '@shared/hooks/useAppearance';
import { cn } from '@shared/lib/utils';

export function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useAppearance();

  const topItems = NAV_GROUPS.flatMap((group) => group.items).slice(0, 5);

  const isLight = settings.verticalNavbarAppearance === 'light';
  const bgClass = isLight ? 'bg-white border-gray-200' : 'bg-slate-900 border-slate-700';
  const activeClass = isLight ? 'text-blue-600' : 'text-blue-400';
  const inactiveClass = isLight ? 'text-gray-500' : 'text-slate-400';

  return (
    <nav className={cn(
      "fixed bottom-0 left-0 right-0 border-t md:hidden z-50",
      bgClass,
    )}>
      <div className="flex items-center justify-around h-16 px-2">
        {topItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.to)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1",
                isActive ? activeClass : inactiveClass,
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="text-lg"><item.icon /></span>
              <span className="text-[10px] leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
