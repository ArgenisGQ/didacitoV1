import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, User, Loader2, Sparkles, MessageSquare } from 'lucide-react';
import api from '../lib/api-client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Pass the previous messages as history to provide context
      const response = await api.post('/ai/admin/chat-rag/', {
        message: userMessage,
        history: messages
      });
      
      if (response.data.status === 'success') {
        setMessages(prev => [...prev, { role: 'assistant', content: response.data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "Hubo un error: " + (response.data.error || "Desconocido") }]);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || "Error de conexión";
      setMessages(prev => [...prev, { role: 'assistant', content: `Lo siento, ocurrió un error: ${errorMsg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-[calc(100vh-16rem)] min-h-[500px] border-primary/20 shadow-xl rounded-3xl overflow-hidden bg-card/60 backdrop-blur-xl">
      <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2.5 rounded-2xl shadow-lg shadow-primary/20">
            <Sparkles size={24} className="text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              Asistente Pedagógico IA
            </CardTitle>
            <CardDescription className="text-sm font-medium mt-1">
              Haz preguntas sobre los programas sinópticos de las asignaturas.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden relative">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
              <MessageSquare size={64} className="mb-4 text-primary" strokeWidth={1} />
              <p className="text-lg font-bold">¡Hola! ¿En qué puedo ayudarte?</p>
              <p className="text-sm text-center mt-2 max-w-sm">
                Puedes preguntarme sobre competencias, estrategias de enseñanza o bibliografía de cualquier asignatura registrada en el sistema.
              </p>
            </div>
          )}
          
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-md ${
                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}>
                {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
              </div>
              
              {/* Bubble */}
              <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                  : 'bg-muted/60 text-foreground border border-border/50 rounded-tl-sm'
              }`}>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-4 flex-row">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shadow-md">
                <Bot size={20} />
              </div>
              <div className="bg-muted/60 text-foreground border border-border/50 rounded-2xl rounded-tl-sm p-4 shadow-sm flex items-center gap-2">
                <Loader2 className="animate-spin text-primary" size={18} />
                <span className="text-sm font-medium animate-pulse">Analizando programas sinópticos...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-background/50 border-t backdrop-blur-sm">
          <form 
            onSubmit={handleSend}
            className="flex gap-2 bg-card border rounded-full p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all"
          >
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu consulta pedagógica aquí..."
              className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent px-4"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="rounded-full h-10 w-10 shrink-0 shadow-md"
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
