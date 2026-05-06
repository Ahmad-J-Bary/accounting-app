import { useEffect } from 'react';

interface Shortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatch = (event.key || "").toLowerCase() === (shortcut.key || "").toLowerCase();
        const ctrlMatch = shortcut.ctrlKey ? event.ctrlKey : !event.ctrlKey;
        const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.altKey ? event.altKey : !event.altKey;
        const metaMatch = shortcut.metaKey ? event.metaKey : !event.metaKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

export const defaultShortcuts: Array<{ keys: string; description: string }> = [
  { keys: 'Ctrl + K', description: 'فتح البحث' },
  { keys: 'Ctrl + N', description: 'فاتورة مبيعات جديدة' },
  { keys: 'Ctrl + B', description: 'فاتورة مشتريات جديدة' },
  { keys: 'Ctrl + R', description: 'سند قبض جديد' },
  { keys: 'Ctrl + P', description: 'سند صرف جديد' },
  { keys: 'Ctrl + J', description: 'قيد يومية جديد' },
  { keys: 'Ctrl + /', description: 'عرض الاختصارات' },
  { keys: 'Escape', description: 'إغلاق النافذة' },
];
