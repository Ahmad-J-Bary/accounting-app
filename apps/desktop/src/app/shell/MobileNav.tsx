import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NAV_GROUPS } from '@app/shell/sidebarConfig';

export function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const topItems = NAV_GROUPS.flatMap((group) => group.items).slice(0, 5);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 md:hidden z-50">
      <div className="flex items-center justify-around h-16 px-2">
        {topItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.to)}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1
                ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}
              `}
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
