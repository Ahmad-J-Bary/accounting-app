import { useState } from 'react';
import { Button } from '@shared/ui/button';
import { Card } from '@shared/ui/card';
import { ScrollArea } from '@shared/ui/scroll-area';
import { Bell, X } from 'lucide-react';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications?: Notification[];
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
}

export function NotificationsPanel({
  isOpen,
  onClose,
  notifications = [],
}: NotificationsPanelProps) {
  const [filter] = useState<'all' | 'unread'>('all');

  const filteredNotifications = notifications.filter((n) =>
    filter === 'unread' ? !n.read : true
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pt-16 px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md">
        <Card className="shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              <h3 className="font-semibold">الإشعارات</h3>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-destructive text-destructive-foreground ml-2">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Notifications List */}
          <ScrollArea className="h-96">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Bell className="w-12 h-12 mb-4 opacity-50" />
                <p>لا توجد إشعارات</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors ${
                      !notification.read ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className={`font-medium text-sm ${!notification.read ? 'font-semibold' : ''}`}>
                            {notification.title}
                          </h4>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {notification.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
