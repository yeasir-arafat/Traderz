import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Loader2, ArrowLeft, Shield, Wifi, WifiOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { chatsAPI } from '../lib/api';
import { useAuthStore } from '../store';
import { formatDateTime } from '../lib/utils';
import { toast } from 'sonner';

const WS_URL = process.env.REACT_APP_BACKEND_URL?.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws';

export default function ChatPage() {
  const { id: conversationId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  
  const wsRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  
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
        // Join conversation if selected
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
        // Reconnect after 3 seconds
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
        // Update unread count in conversations list
        setConversations(prev => prev.map(c => 
          c.id === data.conversation_id 
            ? { ...c, last_message: data.message, unread_count: c.id === conversationId ? 0 : c.unread_count + 1 }
            : c
        ));
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
  }, []);
  
  useEffect(() => {
    if (conversationId) {
      fetchMessages(conversationId);
    }
  }, [conversationId]);
  
  const fetchConversations = async () => {
    try {
      const data = await chatsAPI.getAll();
      setConversations(data?.conversations || []);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchMessages = async (convId) => {
    try {
      const [convData, msgData] = await Promise.all([
        conversations.find(c => c.id === convId) || null,
        chatsAPI.getMessages(convId, { limit: 100 }),
      ]);
      setSelectedConversation(convData);
      setMessages(msgData?.messages || []);
    } catch (error) {
      toast.error('Failed to load messages');
    }
  };
  
  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversationId) return;
    
    const messageContent = newMessage.trim();
    setNewMessage('');
    
    // Send via WebSocket if connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        conversation_id: conversationId,
        content: messageContent
      }));
      // Clear typing indicator
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        conversation_id: conversationId,
        is_typing: false
      }));
    } else {
      // Fallback to HTTP API
      setSending(true);
      try {
        const message = await chatsAPI.sendMessage(conversationId, messageContent);
        setMessages([...messages, message]);
      } catch (error) {
        toast.error('Failed to send message');
        setNewMessage(messageContent); // Restore message on failure
      } finally {
        setSending(false);
      }
    }
  };
  
  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    // Send typing indicator
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && conversationId) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        conversation_id: conversationId,
        is_typing: true
      }));
      
      // Clear typing after 2 seconds of no input
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
      <div className="flex h-full border border-border rounded-lg overflow-hidden">
        {/* Conversation List */}
        <div className={`w-full md:w-80 border-r border-border flex-shrink-0 ${conversationId ? 'hidden md:block' : ''}`}>
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-heading font-bold text-lg">Messages</h2>
            <div className="flex items-center gap-1 text-xs">
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3 text-green-500" />
                  <span className="text-green-500">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Offline</span>
                </>
              )}
            </div>
          </div>
          <ScrollArea className="h-[calc(100%-4rem)]">
            {conversations.length > 0 ? (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/chat/${conv.id}`)}
                  className={`w-full p-4 text-left border-b border-border hover:bg-muted/50 transition-colors ${
                    conversationId === conv.id ? 'bg-muted' : ''
                  }`}
                  data-testid={`conversation-${conv.id}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">
                      {conv.name || (conv.conversation_type === 'order' ? 'Order Chat' : 'Direct Message')}
                    </span>
                    {conv.unread_count > 0 && (
                      <span className="w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  {conv.last_message && (
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.last_message.content}
                    </p>
                  )}
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                No conversations yet
              </div>
            )}
          </ScrollArea>
        </div>
        
        {/* Message Area */}
        <div className="flex-1 flex flex-col">
          {conversationId ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-border flex items-center justify-between">
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
                      {selectedConversation?.name || 'Chat'}
                    </h3>
                    {selectedConversation?.conversation_type === 'order' && (
                      <p className="text-xs text-muted-foreground">Order Chat</p>
                    )}
                  </div>
                </div>
                
                {selectedConversation?.conversation_type === 'order' && !selectedConversation?.admin_joined && (
                  <Button variant="outline" size="sm" onClick={handleCallAdmin} data-testid="call-admin-btn">
                    <Shield className="w-4 h-4 mr-1" />
                    Call Admin
                  </Button>
                )}
              </div>
              
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const isOwn = msg.sender_id === user?.id;
                    const isSystem = msg.is_system_message;
                    
                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center">
                          <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                            {msg.content}
                          </span>
                        </div>
                      );
                    }
                    
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] p-3 rounded-lg ${
                            isOwn
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {formatDateTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              
              {/* Input */}
              <form onSubmit={handleSend} className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 bg-muted/50"
                    data-testid="message-input"
                  />
                  <Button type="submit" disabled={sending || !newMessage.trim()} data-testid="send-btn">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a conversation to start chatting
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
