import { useState, useCallback, useRef, ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { Tab } from '@shared/types/tabs';

import { TabContext } from './TabContext';

export const TabProvider = ({ children }: { children: ReactNode }) => {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'main-tab', title: 'لوحة التحكم', path: '/dashboard', active: true, closable: false }
  ]);
  const [activeTabId, setActiveTabId] = useState('main-tab');
  const navigate = useNavigate();
  const location = useLocation();
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const switchTab = useCallback((id: string) => {
    const tab = tabsRef.current.find(t => t.id === id);
    if (!tab) return;
    setTabs(prev => prev.map(t => ({ ...t, active: t.id === id })));
    setActiveTabId(id);
    navigate(tab.path);
  }, [navigate]);

  const updateMainTab = useCallback((newTab: { title: string; path: string }) => {
    setTabs(prev => prev.map(t => 
      t.id === 'main-tab' 
        ? { ...t, title: newTab.title, path: newTab.path, active: true }
        : { ...t, active: false }
    ));
    setActiveTabId('main-tab');
    navigate(newTab.path);
  }, [navigate]);

  const nextTab = useCallback(() => {
    const current = tabsRef.current;
    if (current.length <= 1) return;
    const currentIndex = current.findIndex(t => t.active);
    const nextIndex = (currentIndex + 1) % current.length;
    const target = current[nextIndex];
    setTabs(prev => prev.map((t, i) => ({ ...t, active: i === nextIndex })));
    setActiveTabId(target.id);
    navigate(target.path);
  }, [navigate]);

  const prevTab = useCallback(() => {
    const current = tabsRef.current;
    if (current.length <= 1) return;
    const currentIndex = current.findIndex(t => t.active);
    const prevIndex = (currentIndex - 1 + current.length) % current.length;
    const target = current[prevIndex];
    setTabs(prev => prev.map((t, i) => ({ ...t, active: i === prevIndex })));
    setActiveTabId(target.id);
    navigate(target.path);
  }, [navigate]);

  const openTab = useCallback((newTab: { id: string; title: string; path: string; closable?: boolean }) => {
    const current = tabsRef.current;

    const exists = current.find(t => t.id === newTab.id);
    if (exists) {
      setTabs(prev => prev.map(t => ({ ...t, active: t.id === newTab.id })));
      setActiveTabId(newTab.id);
      navigate(newTab.path, { replace: true });
      return;
    }

    const existingByPath = current.find(t => t.path === newTab.path);
    if (existingByPath) {
      setTabs(prev => prev.map(t => ({ ...t, active: t.id === existingByPath.id })));
      setActiveTabId(existingByPath.id);
      navigate(newTab.path, { replace: true });
      return;
    }

    setTabs(prev => [...prev.map(t => ({ ...t, active: false })), { ...newTab, active: true, closable: newTab.closable ?? true }]);
    setActiveTabId(newTab.id);
    navigate(newTab.path);
  }, [navigate]);

  const closeTab = useCallback((id: string) => {
    const current = tabsRef.current;
    const tabToClose = current.find(t => t.id === id);
    if (!tabToClose || !tabToClose.closable) return;

    const wasActive = tabToClose.active;
    const remainingTabs = current.filter(t => t.id !== id);

    setTabs(prev => prev.filter(t => t.id !== id));

    if (wasActive && remainingTabs.length > 0) {
      const lastTab = remainingTabs[remainingTabs.length - 1];
      setActiveTabId(lastTab.id);
      navigate(lastTab.path, { replace: true });
    }
  }, [navigate]);

  // Handle browser back/forward (popstate only — not triggered by our own navigate())
  useEffect(() => {
    const handlePopState = () => {
      const currentFullPath = window.location.pathname + window.location.search;
      const currentTabs = tabsRef.current;

      const existingTab = currentTabs.find(t => t.path === currentFullPath);
      if (existingTab) {
        if (existingTab.id !== activeTabIdRef.current) {
          setActiveTabId(existingTab.id);
          setTabs(prev => prev.map(t => ({ ...t, active: t.id === existingTab.id })));
        }
        return;
      }

      // No tab matches — back/forward to a path outside open tabs
      if (currentFullPath !== '/' && !currentFullPath.startsWith('/auth/') && !currentFullPath.startsWith('/setup')) {
        // New-document paths (e.g. /sales-invoices/new-12345) — redirect to parent list
        if (currentFullPath.includes('/new-')) {
          const parentPath = currentFullPath.substring(0, currentFullPath.lastIndexOf('/'));
          setTabs(prev => prev.map(t =>
            t.id === 'main-tab'
              ? { ...t, path: parentPath, active: true }
              : { ...t, active: false }
          ));
          setActiveTabId('main-tab');
          navigate(parentPath, { replace: true });
          return;
        }

        // Document patterns (invoices, returns, opening-balance, account-ledger, statements)
        const isDocumentPath = /^\/(sales-invoices|purchase-invoices|sales-returns|purchase-returns|opening-balance|accounting\/account-ledger|partners\/(customer|supplier)-statement)\/[^/]+/.test(currentFullPath);

        if (isDocumentPath) {
          const id = `nav-${Date.now()}`;
          const title = currentFullPath.split('/').pop() || 'صفحة';
          setTabs(prev => [...prev.map(t => ({ ...t, active: false })), {
            id, title, path: currentFullPath, active: true, closable: true
          }]);
          setActiveTabId(id);
        } else {
          setTabs(prev => prev.map(t => 
            t.id === 'main-tab' 
              ? { ...t, path: currentFullPath, active: true }
              : { ...t, active: false }
          ));
          setActiveTabId('main-tab');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate]);

  // Sync browser URL to active tab when URL changes from our own navigate() calls
  useEffect(() => {
    const currentFullPath = location.pathname + location.search;
    const currentActiveTab = tabsRef.current.find(t => t.active);
    if (currentActiveTab && currentActiveTab.path !== currentFullPath) {
      // Our navigate() may have changed the URL — ensure the active tab reflects it
      const matchingTab = tabsRef.current.find(t => t.path === currentFullPath);
      if (matchingTab && matchingTab.id !== activeTabIdRef.current) {
        setActiveTabId(matchingTab.id);
        setTabs(prev => prev.map(t => ({ ...t, active: t.id === matchingTab.id })));
      }
    }
  }, [location.pathname, location.search]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.code === 'KeyW' || e.key.toLowerCase() === 'w') {
          e.preventDefault();
          closeTab(activeTabIdRef.current);
        }
        else if (e.code === 'Tab' || e.key === 'Tab' || e.code === 'PageDown' || e.key === 'PageDown') {
          e.preventDefault();
          if (e.shiftKey) {
            prevTab();
          } else {
            nextTab();
          }
        }
        else if (e.code === 'PageUp' || e.key === 'PageUp') {
          e.preventDefault();
          prevTab();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [closeTab, nextTab, prevTab]);

  return (
    <TabContext.Provider value={{ tabs, activeTabId, openTab, updateMainTab, closeTab, switchTab, nextTab, prevTab }}>
      {children}
    </TabContext.Provider>
  );
};
