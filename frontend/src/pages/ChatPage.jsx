import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Send, Loader2, ArrowLeft, Shield, Wifi, WifiOff,
  MessageSquare, ShoppingBag, Headphones, Plus, Paperclip,
  X, FileText, Image, File, Check, CheckCheck, Search, Settings
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { chatsAPI, usersAPI } from '../lib/api';
import { useAuthStore, useChatNotificationStore } from '../store';
import { formatDateTime, formatTimeShort, formatMessageDate, formatTimeAgo, cn, getUploadUrl } from '../lib/utils';
import { toast } from 'sonner';

const WS_URL = process.env.REACT_APP_BACKEND_URL?.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws';

// Chat type icons
const chatTypeConfig = {
  casual: { icon: MessageSquare, label: 'Casual', color: 'text-blue-500' },
  order: { icon: ShoppingBag, label: 'Orders', color: 'text-green-500' },
  support: { icon: Headphones, label: 'Support', color: 'text-purple-500' },
};

// File type helpers
const getFileIcon = (filename) => {
  const ext = filename?.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return Image;
  if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return FileText;
  return File;
};

const isImage = (filename) => {
  const ext = filename?.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
};

export default function ChatPage() {
  const { id: conversationId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, token, updateUser } = useAuthStore();
  const { decrementUnread } = useChatNotificationStore();

  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');
  const defaultTab = searchParams.get('tab') || (isAdmin ? 'requests' : 'casual');

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [conversations, setConversations] = useState({ casual: [], order: [], support: [] });
  const [supportRequests, setSupportRequests] = useState({ pending: [], active: [] });
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());

  // New support request dialog
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportAttachments, setSupportAttachments] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Message attachments
  const [messageAttachments, setMessageAttachments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  // Telegram username dialog (when clicking profile in chat)
  const [showTelegramDialog, setShowTelegramDialog] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState('');
  const [telegramSaving, setTelegramSaving] = useState(false);

  const wsRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const supportFileInputRef = useRef(null);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // WebSocket connection
  useEffect(() => {
    if (!token) return;

    const connectWebSocket = () => {
      const ws = new WebSocket(`${WS_URL}?token=${token}`);

      ws.onopen = () => {
        // ws.onopen
        setIsConnected(true);
        if (conversationId) {
          ws.send(JSON.stringify({ type: 'join', conversation_id: conversationId }));
        }
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWsMessage(data);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [token]);

  // Join conversation when it changes
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && conversationId) {
      wsRef.current.send(JSON.stringify({ type: 'join', conversation_id: conversationId }));
    }
  }, [conversationId]);

  const handleWsMessage = useCallback((data) => {
    switch (data.type) {
      case 'new_message':
        if (data.conversation_id === conversationId) {
          setMessages(prev => [...prev, data.message]);
          // Mark as read immediately if window is focused
          if (document.hasFocus()) {
            markMessagesAsRead(conversationId, [data.message.id]);
          }
        }
        // Refresh conversations to update unread counts
        fetchConversations();
        break;
      case 'typing':
        if (data.conversation_id === conversationId && data.user_id !== user?.id) {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            if (data.is_typing) {
              newSet.add(data.user_id);
            } else {
              newSet.delete(data.user_id);
            }
            return newSet;
          });
        }
        break;
      case 'joined':
        // joined conversation
        break;
      case 'error':
        toast.error(data.message);
        break;
      default:
        break;
    }
  }, [conversationId, user?.id]);

  useEffect(() => {
    fetchConversations();
    if (isAdmin) {
      fetchSupportRequests();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (conversationId) {
      fetchMessages(conversationId);
    }
  }, [conversationId]);

  const markMessagesAsRead = async (convId, messageIds) => {
    if (!messageIds?.length) return;
    try {
      await chatsAPI.markRead(convId, messageIds);
      // Update local state to show read
      setMessages(prev => prev.map(msg =>
        messageIds.includes(msg.id)
          ? { ...msg, read_by: [...(msg.read_by || []), user.id] }
          : msg
      ));
      // Refresh conversations to update badges
      fetchConversations();
      // Update global unread count
      decrementUnread(messageIds.length);
    } catch (error) {
      console.error('Failed to mark read:', error);
    }
  };

  useEffect(() => {
    if (messages.length > 0 && conversationId) {
      const unreadIds = messages
        .filter(m => !m.read_by?.includes(user?.id) && m.sender_id !== user?.id)
        .map(m => m.id);

      if (unreadIds.length > 0) {
        markMessagesAsRead(conversationId, unreadIds);
      }
    }
  }, [messages, conversationId, user?.id]);

  const fetchConversations = async () => {
    try {
      const [casual, order, support] = await Promise.all([
        chatsAPI.getAll('casual'),
        chatsAPI.getAll('order'),
        chatsAPI.getAll('support'),
      ]);
      setConversations({
        casual: casual?.conversations || [],
        order: order?.conversations || [],
        support: support?.conversations || [],
      });
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSupportRequests = async () => {
    try {
      const data = await chatsAPI.getSupportRequests();
      setSupportRequests({
        pending: data?.pending_requests || [],
        active: data?.active_chats || [],
      });
    } catch (error) {
      console.error('Failed to fetch support requests:', error);
    }
  };

  const fetchMessages = async (convId) => {
    try {
      // Find conversation from all sources
      let allConversations = [
        ...conversations.casual,
        ...conversations.order,
        ...conversations.support,
        ...supportRequests.pending,
        ...supportRequests.active,
      ];
      let conv = allConversations.find(c => c.id === convId);

      // If not found in state, fetch fresh data
      if (!conv) {
        const freshData = await chatsAPI.getAll();
        allConversations = freshData?.conversations || [];
        conv = allConversations.find(c => c.id === convId);
      }

      const msgData = await chatsAPI.getMessages(convId, { limit: 100 });
      setSelectedConversation(conv || { id: convId, conversation_type: 'unknown' });
      setMessages(msgData?.messages || []);
    } catch (error) {
      toast.error('Failed to load messages');
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && messageAttachments.length === 0) || !conversationId) return;

    const messageContent = newMessage.trim() || (messageAttachments.length > 0 ? 'Attached files' : '');
    const attachments = [...messageAttachments];
    setNewMessage('');
    setMessageAttachments([]);
    setSending(true);

    try {
      const message = await chatsAPI.sendMessage(conversationId, messageContent, attachments);
      setMessages(prev => [...prev, message]);

      // Also notify via WebSocket if connected (for typing indicator stop)
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'typing',
          conversation_id: conversationId,
          is_typing: false
        }));
      }
    } catch (error) {
      toast.error('Failed to send message');
      setNewMessage(messageContent);
      setMessageAttachments(attachments);
    } finally {
      setSending(false);
    }
  };

  const handleSaveTelegram = async () => {
    setTelegramSaving(true);
    try {
      const value = telegramUsername.trim() || null;
      const updated = await usersAPI.updateProfile({ telegram_username: value });
      updateUser(updated);

      // After saving username, check if this user has already started the bot
      const status = await usersAPI.getTelegramStatus();
      if (status?.linked) {
        toast.success('Notification setup successful. You will receive Telegram alerts for new chats.');
        setShowTelegramDialog(false);
      } else {
        toast.error('We could not verify your Telegram. Please send /start to @gamestopupcheap_bot from your Telegram account, then try again.');
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to save');
    } finally {
      setTelegramSaving(false);
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && conversationId) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        conversation_id: conversationId,
        is_typing: true
      }));

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'typing',
            conversation_id: conversationId,
            is_typing: false
          }));
        }
      }, 2000);
    }
  };

  const handleFileUpload = async (e, isSupport = false) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploadingFile(true);

    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/upload/chat`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Upload failed');
        }

        const data = await response.json();
        return data.data.url;
      });

      const urls = await Promise.all(uploadPromises);

      if (isSupport) {
        setSupportAttachments(prev => [...prev, ...urls]);
      } else {
        setMessageAttachments(prev => [...prev, ...urls]);
      }

      toast.success(`${urls.length} file(s) uploaded`);
    } catch (error) {
      toast.error(error.message || 'Failed to upload files');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (supportFileInputRef.current) supportFileInputRef.current.value = '';
    }
  };

  const handleCreateSupportRequest = async () => {
    if (!supportSubject.trim() || !supportMessage.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const result = await chatsAPI.createSupportRequest(
        supportSubject.trim(),
        supportMessage.trim(),
        supportAttachments
      );
      toast.success('Support request created');
      setShowSupportDialog(false);
      setSupportSubject('');
      setSupportMessage('');
      setSupportAttachments([]);
      fetchConversations();
      navigate(`/chat/${result.id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to create support request');
    }
  };

  const handleAcceptSupportRequest = async (convId) => {
    try {
      await chatsAPI.acceptSupportRequest(convId);
      toast.success('Support request accepted');
      fetchSupportRequests();
      navigate(`/chat/${convId}`);
    } catch (error) {
      toast.error(error.message || 'Failed to accept request');
    }
  };

  const handleCloseSupportRequest = async () => {
    if (!conversationId) return;
    try {
      await chatsAPI.closeSupportRequest(conversationId);
      toast.success('Support chat closed');
      fetchConversations();
      if (isAdmin) fetchSupportRequests();
      navigate('/chat');
    } catch (error) {
      toast.error(error.message || 'Failed to close chat');
    }
  };

  const handleCallAdmin = async () => {
    if (!conversationId) return;
    try {
      await chatsAPI.inviteAdmin(conversationId);
      toast.success('Admin has been invited to the conversation');
      fetchConversations();
    } catch (error) {
      toast.error(error.message || 'Failed to invite admin');
    }
  };

  // Get display name for conversation (casual = other person's name, not "Direct Message")
  const getConversationDisplayName = (conv) => {
    if (!conv) return 'Chat';
    if (conv.conversation_type === 'support') {
      if (isAdmin) {
        if (conv.requester_info) {
          return conv.requester_info.full_name
            ? `${conv.requester_info.full_name} (@${conv.requester_info.username})`
            : conv.requester_info.username;
        }
        if (conv.display_name) return conv.display_name;
      }
      return 'Admin Support';
    }
    // Casual and order: use backend display_name (other participant's name)
    if (conv.display_name) return conv.display_name;
    if (conv.name) return conv.name;
    return conv.conversation_type === 'order' ? 'Order Chat' : 'Chat';
  };

  // Get sender display name for messages
  const getSenderDisplayName = (msg, conv) => {
    if (msg.is_system_message) return 'System';
    if (msg.sender_id === user?.id) return 'You';

    // In support chats, users see "Admin" for admin messages
    if (conv?.conversation_type === 'support' && !isAdmin) {
      // Check if sender is admin (not the requester)
      if (msg.sender_id !== conv.requester_id) {
        return 'Admin';
      }
    }

    return msg.sender?.username || 'Unknown';
  };

  // Avatar initial from display name
  const getInitial = (conv) => {
    const name = getConversationDisplayName(conv);
    if (!name) return '?';
    const match = name.match(/@(\w)/);
    if (match) return match[1].toUpperCase();
    return (name.charAt(0) || '?').toUpperCase();
  };

  // Filter conversations by search
  const filterConvs = (convs) => {
    if (!searchQuery.trim()) return convs;
    const q = searchQuery.toLowerCase();
    return convs.filter((c) =>
      getConversationDisplayName(c).toLowerCase().includes(q) ||
      (c.last_message?.content || '').toLowerCase().includes(q)
    );
  };

  const renderConversationList = (convs, type) => {
    const list = filterConvs(convs);
    return (
      <div className="flex flex-col">
        {list.length > 0 ? (
          list.map((conv) => {
            const isActive = conversationId === conv.id;
            const hasUnread = conv.unread_count > 0;
            return (
              <button
                key={conv.id}
                onClick={() => navigate(`/chat/${conv.id}`)}
                className={cn(
                  "group flex items-center gap-4 p-3 rounded-xl transition-all cursor-pointer relative w-full text-left",
                  "hover:bg-white/5",
                  isActive && "bg-primary/10 hover:bg-primary/15"
                )}
                data-testid={`conversation-${conv.id}`}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg ring-2 ring-transparent group-hover:ring-primary/20">
                    {getInitial(conv)}
                  </div>
                  {hasUnread && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-background rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pr-8 border-b border-white/10 pb-3 group-hover:border-transparent">
                  <div className="flex justify-between items-baseline mb-1">
                    <h4 className={cn(
                      "text-base truncate transition-colors",
                      hasUnread ? "font-bold text-white" : "font-medium text-white/70"
                    )}>
                      {getConversationDisplayName(conv)}
                    </h4>
                    <span className={cn(
                      "text-xs font-semibold flex-shrink-0 ml-2",
                      hasUnread ? "text-primary" : "text-white/40"
                    )}>
                      {conv.last_message_at ? formatTimeShort(conv.last_message_at) : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Read receipt check for own messages */}
                    {conv.last_message?.sender_id === user?.id && (
                      <CheckCheck className={cn(
                        "w-3 h-3",
                        (conv.last_message.read_by?.length > 1) ? "text-blue-500" : "text-zinc-500"
                      )} />
                    )}
                    <p className={cn(
                      "text-sm truncate transition-colors",
                      hasUnread ? "font-bold text-white" : "font-normal text-white/50"
                    )}>
                      {conv.last_message?.content || 'New message'}
                    </p>
                  </div>
                </div>
                {conv.unread_count > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-primary text-black text-[10px] font-bold rounded-full shadow-sm">
                    {conv.unread_count > 9 ? '9+' : conv.unread_count}
                  </span>
                )}
              </button>
            );
          })
        ) : (
          <div className="p-6 text-center text-white/60 text-sm rounded-xl bg-white/5">
            No {type} conversations yet
          </div>
        )}
      </div>
    );
  };

  const renderSupportRequests = () => (
    <div className="space-y-4">
      {/* Pending Requests */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
          <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
          Pending Requests ({supportRequests.pending.length})
        </h3>
        {supportRequests.pending.length > 0 ? (
          supportRequests.pending.map((conv) => (
            <div
              key={conv.id}
              className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 mb-2"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{conv.display_name || conv.requester_info?.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{conv.support_subject}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAcceptSupportRequest(conv.id)}
                  className="ml-2"
                  data-testid={`accept-support-${conv.id}`}
                >
                  Accept
                </Button>
              </div>
              {conv.last_message && (
                <p className="text-xs text-muted-foreground truncate italic">
                  "{conv.last_message.content}"
                </p>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground p-2">No pending requests</p>
        )}
      </div>

      {/* Active Support Chats */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          Active Chats ({supportRequests.active.length})
        </h3>
        {renderConversationList(supportRequests.active, 'support')}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 top-[var(--header-height,4rem)] md:static md:container md:mx-auto h-[calc(100vh-var(--header-height,4rem))] md:h-[calc(100vh-8rem)] bg-background-light dark:bg-background-dark flex flex-col">
      {/* Subtle background orbs */}
      <div className="fixed inset-0 top-[var(--header-height,4rem)] -z-10 pointer-events-none overflow-hidden md:hidden">
        <div className="absolute top-[-10%] right-[-20%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-20%] w-[400px] h-[400px] rounded-full bg-blue-500/5 blur-[100px]" />
      </div>
      <div className="flex flex-1 min-h-0 bg-[#101922] overflow-hidden">
        {/* Sidebar - List */}
        <div className={cn(
          "w-full md:w-80 lg:w-96 border-r border-white/10 flex flex-col bg-[#101922]",
          conversationId ? 'hidden md:flex' : 'flex'
        )}>
          <header className="flex-none pt-2 px-4 pb-2 z-20 bg-[#101922] backdrop-blur-md border-b border-white/10">
            <div className="flex items-center justify-between py-3">
              <h1 className="text-3xl font-bold tracking-tight pl-2">Chats</h1>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-white/70 hover:text-white"
                  aria-label="Chat settings"
                  onClick={() => { setTelegramUsername(user?.telegram_username || ''); setShowTelegramDialog(true); }}
                >
                  <Settings className="w-5 h-5" />
                </Button>
              </div>
            </div>
            {/* Segment: Casual | Orders | Support (pill style) */}
            <div className="mt-2 p-1 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-between gap-1">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('requests')}
                  className={cn(
                    "flex-1 flex items-center justify-center py-1.5 px-3 rounded-lg text-sm font-semibold transition-all duration-300",
                    activeTab === 'requests'
                      ? "bg-white/15 text-purple-400 shadow-sm"
                      : "text-white/60 hover:text-white"
                  )}
                  data-testid="tab-requests"
                >
                  <Headphones className="w-4 h-4 mr-1" />
                  Requests
                  {supportRequests.pending.length > 0 && (
                    <span className="ml-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                      {supportRequests.pending.length}
                    </span>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('casual')}
                className={cn(
                  "flex-1 flex items-center justify-center py-1.5 px-3 rounded-lg text-sm font-semibold transition-all duration-300",
                  activeTab === 'casual'
                    ? "bg-white/15 text-primary shadow-sm"
                    : "text-white/60 hover:text-white"
                )}
                data-testid="tab-casual"
              >
                Casual
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('order')}
                className={cn(
                  "flex-1 flex items-center justify-center py-1.5 px-3 rounded-lg text-sm font-semibold transition-all duration-300",
                  activeTab === 'order'
                    ? "bg-white/15 text-green-400 shadow-sm"
                    : "text-white/60 hover:text-white"
                )}
                data-testid="tab-order"
              >
                Orders
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('support')}
                className={cn(
                  "flex-1 flex items-center justify-center py-1.5 px-3 rounded-lg text-sm font-semibold transition-all duration-300",
                  activeTab === 'support'
                    ? "bg-white/15 text-purple-400 shadow-sm"
                    : "text-white/60 hover:text-white"
                )}
                data-testid="tab-support"
              >
                Support
              </button>
            </div>
          </header>
          <div className="px-4 mb-4 pt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
              <input
                type="text"
                placeholder="Search conversations"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/50 focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
              />
            </div>
          </div>
          <ScrollArea className="flex-1 px-2 pb-[0.5rem]">
            {activeTab === 'requests' && isAdmin && renderSupportRequests()}
            {activeTab === 'casual' && renderConversationList(conversations.casual, 'casual')}
            {activeTab === 'order' && renderConversationList(conversations.order, 'order')}
            {activeTab === 'support' && renderConversationList(conversations.support, 'support')}
          </ScrollArea>
        </div>

        {/* Message Area - Conversation view */}
        <div className={cn(
          "flex-1 flex flex-col min-h-0 bg-[#101922] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-from)_0%,_transparent_50%),radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-from)_0%,_transparent_50%)] from-primary/5",
          !conversationId ? 'hidden md:flex' : 'flex'
        )}>
          {conversationId ? (
            <>
              {/* Chatbox Header */}
              <header className="flex-none z-30 bg-[#101922]/95 backdrop-blur-md border-b border-white/10 shadow-sm">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="md:hidden -ml-2 rounded-full" onClick={() => navigate('/chat')}>
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold ring-2 ring-white dark:ring-slate-800 shadow-sm">
                        {selectedConversation ? getInitial(selectedConversation) : '?'}
                      </div>
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#101922] rounded-full" />
                    </div>
                    <div className="cursor-default min-w-0">
                      <h1 className="font-bold text-sm md:text-base text-white leading-tight truncate">
                        {getConversationDisplayName(selectedConversation)}
                      </h1>
                      <div className="text-xs font-medium">
                        {(() => {
                          if (selectedConversation?.conversation_type === 'support') {
                            return <p className="text-green-600 dark:text-green-400">Support Chat</p>;
                          }
                          const lastActive = selectedConversation?.last_active_at;
                          if (!lastActive) return <p className="text-white/40">Offline</p>;

                          const diffInMinutes = (new Date() - new Date(lastActive)) / 1000 / 60;
                          if (diffInMinutes < 5) {
                            return <p className="text-green-600 dark:text-green-400">Active now</p>;
                          }
                          return <p className="text-white/40">Last seen {formatTimeAgo(lastActive)}</p>;
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedConversation?.conversation_type === 'order' && !selectedConversation?.admin_joined && (
                      <Button variant="outline" size="sm" onClick={handleCallAdmin} className="ml-1" data-testid="call-admin-btn">
                        <Shield className="w-4 h-4 mr-1" />
                        Call Admin
                      </Button>
                    )}
                    {selectedConversation?.conversation_type === 'support' && selectedConversation?.support_status === 'active' && (
                      <Button variant="outline" size="sm" onClick={handleCloseSupportRequest} className="ml-1" data-testid="close-support-btn">
                        Close Chat
                      </Button>
                    )}
                  </div>
                </div>
              </header>

              {/* Messages with date groups */}
              <ScrollArea className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-6 max-w-3xl mx-auto">
                  {(() => {
                    let lastDate = null;
                    return messages.map((msg) => {
                      const isOwn = msg.sender_id === user?.id;
                      const isSystem = msg.is_system_message;
                      const msgDate = msg.created_at ? formatMessageDate(msg.created_at).split(',')[0] : null;
                      const showDateLabel = msgDate && msgDate !== lastDate;
                      if (showDateLabel) lastDate = msgDate;

                      if (isSystem) {
                        return (
                          <div key={msg.id} className="flex justify-center">
                            <span className="text-[11px] font-medium text-white/60 px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full">
                              {msg.content}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <React.Fragment key={msg.id}>
                          {showDateLabel && (
                            <div className="flex justify-center">
                              <span className="text-[11px] font-medium text-white/60 px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full">
                                {formatMessageDate(msg.created_at)}
                              </span>
                            </div>
                          )}
                          <div className={cn("flex items-end gap-2 max-w-[85%] group", isOwn && "ml-auto flex-row-reverse")}>
                            {!isOwn && (
                              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0 shadow-sm">
                                {msg.sender ? (msg.sender.username?.charAt(0) || '?').toUpperCase() : '?'}
                              </div>
                            )}
                            <div className={cn("flex flex-col gap-1", isOwn && "items-end")}>
                              <div
                                className={cn(
                                  "p-3.5 shadow-sm rounded-2xl",
                                  isOwn
                                    ? "bg-gradient-to-br from-primary to-blue-600 text-white rounded-br-md"
                                    : "bg-white/10 border border-white/10 rounded-tl-[4px] text-white"
                                )}
                              >
                                <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                                  {msg.content}
                                </p>
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div className="mt-2 space-y-2">
                                    {msg.attachments.map((url, idx) => {
                                      const fullUrl = getUploadUrl(url);
                                      if (isImage(url)) {
                                        return (
                                          <a key={idx} href={fullUrl} target="_blank" rel="noopener noreferrer" className="block mt-1 rounded-xl overflow-hidden shadow-sm border border-white/20 max-w-[240px]">
                                            <img src={fullUrl} alt="Attachment" className="w-full h-auto object-cover block" />
                                          </a>
                                        );
                                      }
                                      const FileIcon = getFileIcon(url);
                                      return (
                                        <a key={idx} href={fullUrl} target="_blank" rel="noopener noreferrer" className={cn("flex items-center gap-2 p-2 rounded-lg", isOwn ? "bg-white/10" : "bg-white/10 text-white")}>
                                          <FileIcon className="w-4 h-4" />
                                          <span className="text-xs truncate">{url.split('/').pop()}</span>
                                        </a>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                              <div className={cn("flex items-center gap-1", isOwn ? "mr-1" : "ml-1")}>
                                <span className="text-[10px] text-white/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {msg.created_at && new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                </span>
                                {isOwn && (msg.read_by?.length > 1 ? <CheckCheck className="w-3.5 h-3.5 text-primary" /> : <Check className="w-3.5 h-3.5 text-primary/80" />)}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    });
                  })()}
                  {typingUsers.size > 0 && (
                    <div className="flex items-end gap-2 max-w-[85%]">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">?</div>
                      <div className="p-4 bg-white/10 rounded-2xl rounded-tl-[4px] border border-white/10 flex items-center gap-1.5 h-11 w-20">
                        <span className="w-2 h-2 bg-white/70 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-2 h-2 bg-white/70 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-2 h-2 bg-white/70 rounded-full animate-bounce" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input - pill style */}
              {selectedConversation?.support_status !== 'closed' && (
                (() => {
                  const isParticipant = selectedConversation?.participant_ids?.includes(user?.id);
                  // If superadmin but not participant, show read-only message
                  if (!isParticipant && (user?.roles?.includes('super_admin') || user?.roles?.includes('admin'))) {
                    return (
                      <div className="p-4 border-t border-border bg-muted/50 text-center">
                        <p className="text-sm text-muted-foreground">You are viewing this chat as an administrator (Read-only)</p>
                      </div>
                    );
                  }

                  return (
                    <footer className="flex-none p-4 pb-20 md:pb-4 bg-[#101922] border-t border-white/10 z-30">
                      {messageAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {messageAttachments.map((url, idx) => (
                            <div key={idx} className="relative group">
                              {isImage(url) ? (
                                <img src={getUploadUrl(url)} alt="Attachment" className="w-16 h-16 object-cover rounded-lg border" />
                              ) : (
                                <div className="w-16 h-16 flex items-center justify-center bg-muted rounded-lg border">
                                  <File className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                              <button type="button" onClick={() => setMessageAttachments((p) => p.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-end gap-2 max-w-4xl mx-auto">
                        <div className="flex-1 bg-white/10 rounded-2xl flex items-end px-4 py-2 transition-shadow border-0">
                          <textarea
                            placeholder="Message..."
                            value={newMessage}
                            onChange={handleTyping}
                            className="w-full bg-transparent border-none text-[15px] text-white placeholder-white/50 focus:ring-0 focus:outline-none p-0 resize-none max-h-32 min-h-[24px] scrollbar-hide py-1"
                            rows={1}
                            onInput={(e) => {
                              e.target.style.height = 'auto';
                              e.target.style.height = e.target.scrollHeight + 'px';
                            }}

                            data-testid="message-input"
                          />
                        </div>
                        <Button
                          onClick={handleSend}
                          disabled={sending || (!newMessage.trim() && messageAttachments.length === 0)}
                          className="flex-shrink-0 w-11 h-11 mb-0.5 bg-gradient-to-r from-primary to-blue-600 hover:to-primary text-white rounded-full shadow-lg shadow-primary/30 flex items-center justify-center transition-all active:scale-95"
                          data-testid="send-btn"
                        >
                          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 translate-x-0.5" />}
                        </Button>
                      </div>
                    </footer>
                  );
                })()
              )}
              {selectedConversation?.support_status === 'closed' && (
                <div className="p-4 border-t border-border bg-muted/50 text-center">
                  <p className="text-sm text-muted-foreground">This support chat has been closed</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-24 h-24 rounded-2xl bg-muted/50 flex items-center justify-center mb-5 ring-2 ring-border/50">
                <MessageSquare className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Select a conversation</h3>
              <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
                Choose a chat from the sidebar or start a new support request if you need help.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* FAB - New support / compose */}
      {
        !conversationId && !isAdmin && (
          <button
            type="button"
            onClick={() => setShowSupportDialog(true)}
            className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-primary text-white shadow-glow flex items-center justify-center hover:scale-105 transition-transform z-40 md:bottom-8"
            data-testid="new-support-btn"
            aria-label="Contact Support"
          >
            <Plus className="w-7 h-7" />
          </button>
        )
      }

      {/* New Support Request Dialog */}
      <Dialog open={showSupportDialog} onOpenChange={setShowSupportDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Headphones className="w-5 h-5 text-purple-500" />
              Contact Support
            </DialogTitle>
            <DialogDescription>
              Describe your issue and our team will get back to you as soon as possible.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="support-subject">Subject</Label>
              <Input
                id="support-subject"
                placeholder="Brief description of your issue"
                value={supportSubject}
                onChange={(e) => setSupportSubject(e.target.value)}
                data-testid="support-subject-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-message">Message</Label>
              <Textarea
                id="support-message"
                placeholder="Please describe your issue in detail..."
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                className="min-h-[120px]"
                data-testid="support-message-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Attachments (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {supportAttachments.map((url, idx) => (
                  <div key={idx} className="relative group">
                    {isImage(url) ? (
                      <img
                        src={getUploadUrl(url)}
                        alt="Attachment"
                        className="w-16 h-16 object-cover rounded-lg border"
                      />
                    ) : (
                      <div className="w-16 h-16 flex items-center justify-center bg-muted rounded-lg border">
                        <File className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setSupportAttachments(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                <input
                  ref={supportFileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => handleFileUpload(e, true)}
                  className="hidden"
                  id="support-file-upload"
                />
                <button
                  type="button"
                  onClick={() => supportFileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed rounded-lg hover:border-primary transition-colors"
                >
                  {uploadingFile ? (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground mt-1">Add file</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSupportDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSupportRequest}
              disabled={!supportSubject.trim() || !supportMessage.trim()}
              data-testid="submit-support-btn"
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Telegram notifications setup – guided instructions for linking the bot */}
      <Dialog open={showTelegramDialog} onOpenChange={setShowTelegramDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Telegram notifications</DialogTitle>
            <DialogDescription>
              To receive Telegram alerts when you get a new Casual or Order chat:
              <br />
              1) Open Telegram and search for <span className="font-semibold">@gamestopupcheap_bot</span>.
              <br />
              2) Send the command <span className="font-mono text-sm">/start</span> to that bot.
              <br />
              3) Then enter your Telegram username below and click Verify.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="telegram-username">Telegram username</Label>
              <Input
                id="telegram-username"
                placeholder="@username or username"
                value={telegramUsername}
                onChange={(e) => setTelegramUsername(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTelegramDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTelegram} disabled={telegramSaving}>
              {telegramSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}
