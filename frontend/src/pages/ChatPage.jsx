import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Loader2, ArrowLeft, Shield } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { chatsAPI } from '../lib/api';
import { useAuthStore } from '../store';
import { formatDateTime } from '../lib/utils';
import { toast } from 'sonner';

export default function ChatPage() {
  const { id: conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
  
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
    
    setSending(true);
    try {
      const message = await chatsAPI.sendMessage(conversationId, newMessage.trim());
      setMessages([...messages, message]);
      setNewMessage('');
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
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
          <div className="p-4 border-b border-border">
            <h2 className="font-heading font-bold text-lg">Messages</h2>
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
