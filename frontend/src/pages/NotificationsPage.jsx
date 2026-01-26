import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Loader2, CheckCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { notificationsAPI } from '../lib/api';
import { useAuthStore, useNotificationStore } from '../store';
import { formatDate } from '../lib/utils';
import { toast } from 'sonner';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { setNotifications, clearUnread } = useNotificationStore();
  const [list, setList] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchNotifications();
  }, [isAuthenticated, navigate]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationsAPI.getAll({ limit: 100 });
      setList(data?.notifications || []);
      setUnreadCount(data?.unread_count ?? 0);
      setNotifications(data?.notifications || [], data?.unread_count ?? 0);
    } catch (e) {
      toast.error(e?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationsAPI.markRead(id);
      setList((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      toast.error(e?.message || 'Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setList((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      clearUnread();
      toast.success('All marked as read');
    } catch (e) {
      toast.error(e?.message || 'Failed to mark all as read');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bell className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-heading font-bold">Notifications</h1>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="w-4 h-4 mr-1" />
            Mark all read
          </Button>
        )}
      </div>
      {list.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No notifications yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((n) => (
            <Card
              key={n.id}
              className={n.is_read ? 'opacity-75' : ''}
              data-testid={`notification-${n.id}`}
            >
              <CardContent className="p-4">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-medium">{n.title}</p>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(n.created_at)}
                    </p>
                  </div>
                  {!n.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkRead(n.id)}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
                {n.order_id && (
                  <Link to={`/order/${n.order_id}`} className="text-sm text-primary mt-2 inline-block">
                    View order →
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
