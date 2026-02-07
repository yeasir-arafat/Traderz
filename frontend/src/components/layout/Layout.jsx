import React, { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, PlusCircle, MessageCircle, User, Bell, Wallet, LogOut, Settings, Shield } from 'lucide-react';
import { useAuthStore, useCurrencyStore, useNotificationStore, useChatNotificationStore } from '../../store';
import { chatsAPI } from '../../lib/api';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';

export function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, token } = useAuthStore();
  const { currency, setCurrency } = useCurrencyStore();
  const { unreadCount } = useNotificationStore();
  const { 
    unreadChatCount, 
    hasNewMessage, 
    setUnreadCount: setChatUnreadCount, 
    clearNewMessageFlag,
    incrementUnread: incrementChatUnread,
    playNotificationSound 
  } = useChatNotificationStore();
  
  const wsRef = useRef(null);
  const WS_URL = process.env.REACT_APP_BACKEND_URL?.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws';
  
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');
  const isSuperAdmin = user?.roles?.includes('super_admin');
  const isSeller = user?.roles?.includes('seller');
  
  // Fetch initial unread chat count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (isAuthenticated && token) {
        try {
          const data = await chatsAPI.getUnreadCount();
          setChatUnreadCount(data?.unread_count || 0);
        } catch (error) {
          console.error('Failed to fetch unread count:', error);
        }
      }
    };
    fetchUnreadCount();
  }, [isAuthenticated, token, setChatUnreadCount]);
  
  // WebSocket connection for real-time chat notifications
  useEffect(() => {
    if (!token || !isAuthenticated) return;
    
    const connectWebSocket = () => {
      const ws = new WebSocket(`${WS_URL}?token=${token}`);
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_message') {
            // Only notify if not on chat page or not in that conversation
            const onChatPage = location.pathname.startsWith('/chat');
            const inConversation = location.pathname.includes(data.conversation_id);
            
            if (!onChatPage || !inConversation) {
              incrementChatUnread();
              playNotificationSound();
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }
      };
      
      ws.onclose = () => {
        // Reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
      };
      
      wsRef.current = ws;
    };
    
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [token, isAuthenticated, location.pathname, incrementChatUnread, playNotificationSound]);
  
  // Clear new message flag after animation
  useEffect(() => {
    if (hasNewMessage) {
      const timer = setTimeout(() => {
        clearNewMessageFlag();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [hasNewMessage, clearNewMessageFlag]);
  
  const handleLogout = () => {
    logout();
    navigate('/');
  };
  
  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Search, label: 'Browse', path: '/browse' },
    ...(isSeller ? [{ icon: PlusCircle, label: 'Sell', path: '/sell' }] : []),
    { icon: MessageCircle, label: 'Chat', path: '/chat' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];
  
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Header */}
      <header className="hidden md:block sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl font-heading font-bold text-primary neon-text">
              PlayTraderz
            </span>
          </Link>
          
          <nav className="flex items-center gap-6">
            {navItems.slice(0, 3).map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  location.pathname === item.path ? "text-primary" : "text-muted-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          
          <div className="flex items-center gap-4">
            {/* Currency Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrency(currency === 'USD' ? 'BDT' : 'USD')}
              className="text-xs font-mono"
              data-testid="currency-toggle"
            >
              {currency}
            </Button>
            
            {isAuthenticated ? (
              <>
                {/* Notifications */}
                <Link to="/notifications" className="relative" data-testid="notifications-link">
                  <Bell className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
                
                {/* Wallet */}
                <Link to="/wallet" data-testid="wallet-link">
                  <Wallet className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                </Link>
                
                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2" data-testid="user-menu">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-primary font-bold">
                          {user?.username?.[0]?.toUpperCase() || 'U'}
                        </span>
                      </div>
                      <span className="hidden lg:inline text-sm">{user?.username}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => navigate('/profile')} data-testid="profile-menu-item">
                      <User className="w-4 h-4 mr-2" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/orders')} data-testid="orders-menu-item">
                      <Settings className="w-4 h-4 mr-2" />
                      My Orders
                    </DropdownMenuItem>
                    {isSeller && (
                      <DropdownMenuItem onClick={() => navigate('/my-listings')} data-testid="my-listings-menu-item">
                        <PlusCircle className="w-4 h-4 mr-2" />
                        My Listings
                      </DropdownMenuItem>
                    )}
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate('/admin')} data-testid="admin-menu-item">
                          <Shield className="w-4 h-4 mr-2" />
                          Admin Panel
                        </DropdownMenuItem>
                      </>
                    )}
                    {isSuperAdmin && (
                      <>
                        <DropdownMenuItem onClick={() => navigate('/superadmin')} data-testid="superadmin-menu-item">
                          <Shield className="w-4 h-4 mr-2 text-primary" />
                          Super Admin
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive" data-testid="logout-menu-item">
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')} data-testid="login-btn">
                  Login
                </Button>
                <Button size="sm" onClick={() => navigate('/register')} data-testid="register-btn">
                  Sign Up
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="pb-20 md:pb-0">
        {children}
      </main>
      
      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-lg border-t border-border z-50 h-16 flex items-center justify-around pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={isAuthenticated || item.path === '/' || item.path === '/browse' ? item.path : '/login'}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
