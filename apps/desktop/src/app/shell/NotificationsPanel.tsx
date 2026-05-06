import { useState, useMemo } from 'react';
import { Button } from '@shared/ui/button';
import { Card } from '@shared/ui/card';
import { ScrollArea } from '@shared/ui/scroll-area';
import { Bell, CheckCircle, AlertTriangle, Info, X, ExternalLink, Clock } from 'lucide-react';
import { formatDateTime } from '@shared/lib/format';

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
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
}: NotificationsPanelProps) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const defaultNotifications: Notification[] = useMemo(() => notifications || [
    {
      id: '1',
      type: 'success',
      title: 'تم إنشاء فاتورة مبيعات',
      message: 'فاتورة INV-2026-0235 تم إنشاؤها بنجاح للعميل شركة الأفق',
      timestamp: '2026-04-20T10:30:00',
      read: false,
      action: {
        label: 'عرض الفاتورة',
        onClick: () => {},
      },
    },
    {
      id: '2',
      type: 'warning',
      title: 'تنبيه مخزون منخفض',
      message: 'منتج "لابتوب Dell" وصل للحد الأدنى (5 وحدات)',
      timestamp: '2026-04-20T09:30:00',
      read: false,
      action: {
        label: 'عرض المخزون',
        onClick: () => {},
      },
    },
    {
      id: '3',
      type: 'error',
      title: 'فاتورة متأخرة',
      message: 'فاتورة INV-2026-0200 متأخرة 15 يوم للعميل شركة النور',
      timestamp: '2026-04-20T08:30:00',
      read: false,
      action: {
        label: 'عرض الفاتورة',
        onClick: () => {},
      },
    },
    {
      id: '4',
      type: 'info',
      title: 'تذكير بموعد',
      message: 'موعد مراجعة الحسابات غداً الساعة 10:00 صباحاً',
      timestamp: '2026-04-19T10:30:00',
      read: true,
    },
    {
      id: '5',
      type: 'success',
      title: 'تم ترحيل القيد',
      message: 'قيد JE-2026-0234 تم ترحيله بنجاح إلى دفتر الأستاذ',
      timestamp: '2026-04-18T10:30:00',
      read: true,
    },
  ], [notifications]);

  const filteredNotifications = defaultNotifications.filter((n) =>
    filter === 'unread' ? !n.read : true
  );

  const unreadCount = defaultNotifications.filter((n) => !n.read).length;

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getIconBg = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-100';
      case 'warning':
        return 'bg-amber-100';
      case 'error':
        return 'bg-red-100';
      case 'info':
      default:
        return 'bg-blue-100';
    }
  };

  const handleMarkAsRead = (id: string) => {
    if (onMarkAsRead) {
      onMarkAsRead(id);
    }
  };

  const handleMarkAllAsRead = () => {
    if (onMarkAllAsRead) {
      onMarkAllAsRead();
    }
  };

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
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead}>
                  تحديد الكل كمقروء
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 p-4 border-b">
            <Button
              variant={filter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              الكل ({defaultNotifications.length})
            </Button>
            <Button
              variant={filter === 'unread' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('unread')}
            >
              غير مقروء ({unreadCount})
            </Button>
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
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    <div className="flex gap-3">
                      <div className={`p-2 rounded-full ${getIconBg(notification.type)} shrink-0`}>
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className={`font-medium text-sm ${!notification.read ? 'font-semibold' : ''}`}>
                            {notification.title}
                          </h4>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(notification.timestamp)}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {notification.message}
                        </p>
                        {notification.action && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              notification.action?.onClick();
                            }}
                          >
                            <ExternalLink className="w-3 h-3 ml-1" />
                            {notification.action.label}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t">
            <Button variant="outline" className="w-full" size="sm">
              عرض جميع الإشعارات
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
