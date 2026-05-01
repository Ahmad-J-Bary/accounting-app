import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export interface Tab {
  id: string;
  title: string;
  path: string;
  active: boolean;
  closable: boolean;
}

interface TabContextType {
  tabs: Tab[];
  activeTabId: string;
  openTab: (tab: { id: string; title: string; path: string; closable?: boolean }) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  nextTab: () => void;
  prevTab: () => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export const TabProvider = ({ children }: { children: ReactNode }) => {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: '/dashboard', title: 'لوحة التحكم', path: '/dashboard', active: true, closable: false }
  ]);
  const [activeTabId, setActiveTabId] = useState('/dashboard');
  const navigate = useNavigate();
  const location = useLocation();

  const switchTab = useCallback((id: string) => {
    setTabs(prev => {
      const tab = prev.find(t => t.id === id);
      if (tab) {
        setActiveTabId(id);
        navigate(tab.path);
        return prev.map(t => ({ ...t, active: t.id === id }));
      }
      return prev;
    });
  }, [navigate]);

  const nextTab = useCallback(() => {
    setTabs(prev => {
      if (prev.length <= 1) return prev;
      const currentIndex = prev.findIndex(t => t.active);
      const nextIndex = (currentIndex + 1) % prev.length;
      const target = prev[nextIndex];
      setActiveTabId(target.id);
      navigate(target.path);
      return prev.map((t, i) => ({ ...t, active: i === nextIndex }));
    });
  }, [navigate]);

  const prevTab = useCallback(() => {
    setTabs(prev => {
      if (prev.length <= 1) return prev;
      const currentIndex = prev.findIndex(t => t.active);
      const prevIndex = (currentIndex - 1 + prev.length) % prev.length;
      const target = prev[prevIndex];
      setActiveTabId(target.id);
      navigate(target.path);
      return prev.map((t, i) => ({ ...t, active: i === prevIndex }));
    });
  }, [navigate]);

  const openTab = useCallback((newTab: { id: string; title: string; path: string; closable?: boolean }) => {
    setTabs(prev => {
      const exists = prev.find(t => t.id === newTab.id);
      if (exists) {
        setActiveTabId(newTab.id);
        navigate(newTab.path);
        return prev.map(t => ({ ...t, active: t.id === newTab.id }));
      }
      setActiveTabId(newTab.id);
      navigate(newTab.path);
      return [...prev.map(t => ({ ...t, active: false })), { ...newTab, active: true, closable: newTab.closable ?? true }];
    });
  }, [navigate]);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const tabToClose = prev.find(t => t.id === id);
      if (!tabToClose || !tabToClose.closable) return prev;
      
      const newTabs = prev.filter(t => t.id !== id);
      if (tabToClose.active && newTabs.length > 0) {
        const lastTab = newTabs[newTabs.length - 1];
        lastTab.active = true;
        setActiveTabId(lastTab.id);
        navigate(lastTab.path);
      }
      return newTabs;
    });
  }, [navigate]);

  // Sync tab with external URL changes
  useEffect(() => {
    const currentPath = location.pathname;
    const existingTab = tabs.find(t => t.path === currentPath);
    if (existingTab && existingTab.id !== activeTabId) {
      setActiveTabId(existingTab.id);
      setTabs(prev => prev.map(t => ({ ...t, active: t.id === existingTab.id })));
    }
  }, [location.pathname]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        // Ctrl + W: Close current tab
        if (e.key.toLowerCase() === 'w') {
          e.preventDefault();
          closeTab(activeTabId);
        }
        // Ctrl + Tab / Ctrl + PageDown: Next tab
        else if (e.key === 'Tab' || e.key === 'PageDown') {
          e.preventDefault();
          if (e.shiftKey) {
            prevTab();
          } else {
            nextTab();
          }
        }
        // Ctrl + PageUp / Ctrl + Shift + Tab: Previous tab
        else if (e.key === 'PageUp') {
          e.preventDefault();
          prevTab();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeTabId, closeTab, nextTab, prevTab]);

  return (
    <TabContext.Provider value={{ tabs, activeTabId, openTab, closeTab, switchTab, nextTab, prevTab }}>
      {children}
    </TabContext.Provider>
  );
};

export const useTabs = () => {
  const context = useContext(TabContext);
  if (!context) throw new Error('useTabs must be used within TabProvider');
  return context;
};
