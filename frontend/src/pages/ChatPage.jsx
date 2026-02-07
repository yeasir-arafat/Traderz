import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Send, Loader2, ArrowLeft, Shield, Wifi, WifiOff, 
  MessageSquare, ShoppingBag, Headphones, Plus, Paperclip,
  X, FileText, Image, File, Check, CheckCheck, Users
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { chatsAPI, getUploadUrl } from '../lib/api';
import { useAuthStore } from '../store';
import { formatDateTime } from '../lib/utils';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

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
  const { user, token } = useAuthStore();
  
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
        console.log('WebSocket connected');
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
        console.log('WebSocket disconnected');
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
        console.log('Joined conversation:', data.conversation_id);
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
      const allConversations = [
        ...conversations.casual,
        ...conversations.order,
        ...conversations.support,
        ...supportRequests.pending,
        ...supportRequests.active,
      ];
      const conv = allConversations.find(c => c.id === convId);
      
      const msgData = await chatsAPI.getMessages(convId, { limit: 100 });
      setSelectedConversation(conv);
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
    
    // Send via WebSocket if connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        conversation_id: conversationId,
        content: messageContent,
        attachments: attachments
      }));
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        conversation_id: conversationId,
        is_typing: false
      }));
    } else {
      // Fallback to HTTP API
      setSending(true);
      try {
        const message = await chatsAPI.sendMessage(conversationId, messageContent, attachments);
        setMessages([...messages, message]);
      } catch (error) {
        toast.error('Failed to send message');
        setNewMessage(messageContent);
        setMessageAttachments(attachments);
      } finally {
        setSending(false);
      }
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
  
  // Get display name for conversation
  const getConversationDisplayName = (conv) => {
    if (!conv) return 'Chat';
    if (conv.conversation_type === 'support') {
      if (isAdmin && conv.requester_info) {
        return `${conv.requester_info.full_name} (@${conv.requester_info.username})`;
      }
      return 'Admin Support';
    }
    return conv.name || (conv.conversation_type === 'order' ? 'Order Chat' : 'Direct Message');
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
  
  const renderConversationList = (convs, type) => (
    <div className="space-y-1">
      {convs.length > 0 ? (
        convs.map((conv) => (
          <button
            key={conv.id}
            onClick={() => navigate(`/chat/${conv.id}`)}
            className={cn(
              "w-full p-3 text-left rounded-lg transition-all duration-200",
              "hover:bg-muted/80 border border-transparent",
              conversationId === conv.id 
                ? "bg-primary/10 border-primary/30" 
                : "hover:border-border"
            )}
            data-testid={`conversation-${conv.id}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm truncate flex-1">
                {getConversationDisplayName(conv)}
              </span>
              <div className="flex items-center gap-2">
                {conv.support_status && (
                  <Badge 
                    variant={conv.support_status === 'active' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {conv.support_status}
                  </Badge>
                )}
                {conv.unread_count > 0 && (
                  <span className="w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-semibold">
                    {conv.unread_count > 9 ? '9+' : conv.unread_count}
                  </span>
                )}
              </div>
            </div>
            {conv.last_message && (
              <p className="text-xs text-muted-foreground truncate">
                {conv.last_message.content}
              </p>
            )}
            {conv.last_message_at && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                {formatDateTime(conv.last_message_at)}
              </p>
            )}
          </button>
        ))
      ) : (
        <div className="p-4 text-center text-muted-foreground text-sm">
          No {type} conversations
        </div>
      )}
    </div>
  );
  
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
    <div className="container mx-auto px-4 py-4 h-[calc(100vh-8rem)]">
      <div className="flex h-full bg-background rounded-xl border border-border overflow-hidden shadow-lg">
        {/* Sidebar */}
        <div className={cn(
          "w-full md:w-80 lg:w-96 border-r border-border flex flex-col",
          conversationId ? 'hidden md:flex' : 'flex'
        )}>
          {/* Header */}
          <div className="p-4 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading font-bold text-xl">Messages</h2>
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10">
                    <Wifi className="w-3 h-3 mr-1" />
                    Live
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    <WifiOff className="w-3 h-3 mr-1" />
                    Offline
                  </Badge>
                )}
              </div>
            </div>
            
            {/* New Support Button for non-admins */}
            {!isAdmin && (
              <Button 
                size="sm" 
                variant="outline"
                className="w-full"
                onClick={() => setShowSupportDialog(true)}
                data-testid="new-support-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                Contact Support
              </Button>
            )}
          </div>
          
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full rounded-none border-b border-border p-0 h-auto bg-transparent" style={{ 
              gridTemplateColumns: isAdmin ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)' 
            }}>
              {isAdmin && (
                <TabsTrigger 
                  value="requests" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:text-purple-500 py-3"
                  data-testid="tab-requests"
                >
                  <Headphones className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Requests</span>
                  {supportRequests.pending.length > 0 && (
                    <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-xs">
                      {supportRequests.pending.length}
                    </Badge>
                  )}
                </TabsTrigger>
              )}
              <TabsTrigger 
                value="casual" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-500 py-3"
                data-testid="tab-casual"
              >
                <MessageSquare className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Casual</span>
              </TabsTrigger>
              <TabsTrigger 
                value="order" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-green-500 data-[state=active]:text-green-500 py-3"
                data-testid="tab-order"
              >
                <ShoppingBag className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Orders</span>
              </TabsTrigger>
              <TabsTrigger 
                value="support" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:text-purple-500 py-3"
                data-testid="tab-support"
              >
                <Headphones className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Support</span>
              </TabsTrigger>
            </TabsList>
            
            <ScrollArea className="flex-1">
              <div className="p-2">
                {isAdmin && (
                  <TabsContent value="requests" className="mt-0">
                    {renderSupportRequests()}
                  </TabsContent>
                )}
                <TabsContent value="casual" className="mt-0">
                  {renderConversationList(conversations.casual, 'casual')}
                </TabsContent>
                <TabsContent value="order" className="mt-0">
                  {renderConversationList(conversations.order, 'order')}
                </TabsContent>
                <TabsContent value="support" className="mt-0">
                  {renderConversationList(conversations.support, 'support')}
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>
        
        {/* Message Area */}
        <div className="flex-1 flex flex-col bg-gradient-to-b from-background to-muted/10">
          {conversationId ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-border bg-background/80 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden"
                      onClick={() => navigate('/chat')}
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                      <h3 className="font-semibold">
                        {getConversationDisplayName(selectedConversation)}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {selectedConversation?.conversation_type === 'support' 
                          ? `Support • ${selectedConversation?.support_status || 'pending'}`
                          : selectedConversation?.conversation_type === 'order' 
                            ? 'Order Chat'
                            : 'Direct Message'
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {selectedConversation?.conversation_type === 'order' && !selectedConversation?.admin_joined && (
                      <Button variant="outline" size="sm" onClick={handleCallAdmin} data-testid="call-admin-btn">
                        <Shield className="w-4 h-4 mr-1" />
                        Call Admin
                      </Button>
                    )}
                    
                    {selectedConversation?.conversation_type === 'support' && 
                     selectedConversation?.support_status === 'active' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleCloseSupportRequest}
                        data-testid="close-support-btn"
                      >
                        Close Chat
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4 max-w-3xl mx-auto">
                  {messages.map((msg) => {
                    const isOwn = msg.sender_id === user?.id;
                    const isSystem = msg.is_system_message;
                    
                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center">
                          <span className="text-xs text-muted-foreground bg-muted/50 px-4 py-1.5 rounded-full">
                            {msg.content}
                          </span>
                        </div>
                      );
                    }
                    
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex gap-2",
                          isOwn ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm",
                            isOwn
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-card border border-border rounded-bl-md'
                          )}
                        >
                          {!isOwn && (
                            <p className={cn(
                              "text-xs font-medium mb-1",
                              isOwn ? 'text-primary-foreground/80' : 'text-muted-foreground'
                            )}>
                              {getSenderDisplayName(msg, selectedConversation)}
                            </p>
                          )}
                          
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          
                          {/* Attachments */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {msg.attachments.map((url, idx) => {
                                const fullUrl = getUploadUrl(url);
                                if (isImage(url)) {
                                  return (
                                    <a 
                                      key={idx} 
                                      href={fullUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="block"
                                    >
                                      <img 
                                        src={fullUrl} 
                                        alt="Attachment" 
                                        className="max-w-full rounded-lg max-h-48 object-cover"
                                      />
                                    </a>
                                  );
                                } else {
                                  const FileIcon = getFileIcon(url);
                                  return (
                                    <a
                                      key={idx}
                                      href={fullUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={cn(
                                        "flex items-center gap-2 p-2 rounded-lg transition-colors",
                                        isOwn ? 'bg-primary-foreground/10 hover:bg-primary-foreground/20' : 'bg-muted hover:bg-muted/80'
                                      )}
                                    >
                                      <FileIcon className="w-4 h-4" />
                                      <span className="text-xs truncate">{url.split('/').pop()}</span>
                                    </a>
                                  );
                                }
                              })}
                            </div>
                          )}
                          
                          <div className={cn(
                            "flex items-center gap-1 mt-1",
                            isOwn ? 'justify-end' : 'justify-start'
                          )}>
                            <p className={cn(
                              "text-[10px]",
                              isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground/60'
                            )}>
                              {formatDateTime(msg.created_at)}
                            </p>
                            {isOwn && (
                              msg.read_by?.length > 1 
                                ? <CheckCheck className="w-3 h-3 text-primary-foreground/60" />
                                : <Check className="w-3 h-3 text-primary-foreground/60" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              
              {/* Typing indicator */}
              {typingUsers.size > 0 && (
                <div className="px-4 py-2 text-xs text-muted-foreground animate-pulse">
                  Someone is typing...
                </div>
              )}
              
              {/* Message Input */}
              {selectedConversation?.support_status !== 'closed' && (
                <div className="p-4 border-t border-border bg-background">
                  {/* Attachment previews */}
                  {messageAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {messageAttachments.map((url, idx) => (
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
                            onClick={() => setMessageAttachments(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <form onSubmit={handleSend} className="flex gap-2">
                    {/* File attachment button for support chats */}
                    {selectedConversation?.conversation_type === 'support' && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          onChange={(e) => handleFileUpload(e, false)}
                          className="hidden"
                          id="chat-file-upload"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingFile}
                          data-testid="attach-file-btn"
                        >
                          {uploadingFile ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Paperclip className="w-4 h-4" />
                          )}
                        </Button>
                      </>
                    )}
                    
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={handleTyping}
                      className="flex-1 bg-muted/50 border-0 focus-visible:ring-1"
                      data-testid="message-input"
                    />
                    <Button 
                      type="submit" 
                      disabled={sending || (!newMessage.trim() && messageAttachments.length === 0)} 
                      data-testid="send-btn"
                      className="px-6"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </form>
                </div>
              )}
              
              {/* Closed chat notice */}
              {selectedConversation?.support_status === 'closed' && (
                <div className="p-4 border-t border-border bg-muted/50 text-center">
                  <p className="text-sm text-muted-foreground">This support chat has been closed</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageSquare className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Select a conversation</h3>
              <p className="text-muted-foreground max-w-sm">
                Choose a conversation from the sidebar to start chatting, or create a new support request if you need help.
              </p>
            </div>
          )}
        </div>
      </div>
      
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
    </div>
  );
}
