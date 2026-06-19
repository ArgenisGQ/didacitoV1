import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, User, Loader2, Sparkles, MessageSquare, Trash2, Plus, Pause, Play, Square } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import axios from 'axios';
import api from '../lib/api-client';
import { toast } from 'sonner';
import { getDecodedToken } from '../lib/permissions';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('none');
  const [activeSessionId, setActiveSessionId] = useState<string | number>('new');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const decodedToken = getDecodedToken();
  const isAdmin = decodedToken?.role === 'SUPER_ADMIN';

  // Obtener agentes activos
  const { data: agents = [] } = useQuery({
    queryKey: ['ai-templates'],
    queryFn: async () => {
      const { data } = await api.get('/ai/admin/templates');
      return data.filter((a: any) => a.is_active);
    },
    retry: false
  });

  // Obtener historial de sesiones
  const { data: groupedSessions = {}, refetch: refetchSessions } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: async () => {
      const { data } = await api.get('/ai/chat/sessions/');
      return data;
    },
    retry: false
  });

  // Cargar mensajes al cambiar de sesión activa
  useEffect(() => {
    if (activeSessionId && activeSessionId !== 'new') {
      setIsLoading(true);
      api.get(`/ai/chat/sessions/${activeSessionId}/messages/`)
        .then(res => {
          const formatted = res.data.messages.map((m: any) => ({
            role: m.role,
            content: m.content
          }));
          setMessages(formatted);
          // Si el chat tenía un agente pre-guardado, podemos sincronizarlo
          const sessionObj = findSessionById(activeSessionId);
          if (sessionObj?.agent_id) {
            setSelectedAgent(sessionObj.agent_id.toString());
          } else {
            setSelectedAgent('none');
          }
        })
        .catch(err => {
          toast.error("Error al cargar mensajes del historial");
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setMessages([]);
      setSelectedAgent('none');
    }
  }, [activeSessionId]);

  // Auxiliar para buscar sesión dentro de los grupos
  const findSessionById = (id: string | number) => {
    for (const group in groupedSessions) {
      const found = groupedSessions[group].find((s: any) => s.id === id);
      if (found) return found;
    }
    return null;
  };

  // Scroll al fondo
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setIsPaused(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await api.post('/ai/admin/chat-rag/', {
        message: userMessage,
        session_id: activeSessionId,
        agent_id: (selectedAgent && selectedAgent !== 'none') ? parseInt(selectedAgent) : null
      }, {
        signal: controller.signal
      });
      
      if (response.data.status === 'success') {
        setMessages(prev => [...prev, { role: 'assistant', content: response.data.reply }]);
        
        // Si fue una sesión nueva creada, actualizar el activeSessionId
        if (activeSessionId === 'new') {
          setActiveSessionId(response.data.session_id);
        }
        refetchSessions();
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "Hubo un error: " + (response.data.error || "Desconocido") }]);
      }
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError' || axios.isCancel(err)) {
        setMessages(prev => [...prev, { role: 'assistant', content: "🛑 Consulta detenida por el usuario." }]);
      } else {
        const errorMsg = err.response?.data?.error || err.message || "Error de conexión";
        setMessages(prev => [...prev, { role: 'assistant', content: `Lo siento, ocurrió un error: ${errorMsg}` }]);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
      setIsPaused(false);
    }
  };

  const deleteSession = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!window.confirm("¿Seguro que deseas eliminar esta conversación del historial?")) return;
    try {
      await api.delete(`/ai/chat/sessions/${id}/`);
      toast.success("Conversación eliminada");
      refetchSessions();
      if (activeSessionId === id) {
        setActiveSessionId('new');
      }
    } catch (err) {
      toast.error("Error al eliminar la conversación");
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("¿Estás seguro de que deseas limpiar todo tu historial de chat? Esta acción no se puede deshacer.")) return;
    try {
      await api.delete('/ai/chat/sessions/clear-all/');
      toast.success("Historial de chat limpio");
      refetchSessions();
      setActiveSessionId('new');
    } catch (err) {
      toast.error("Error al limpiar historial");
    }
  };

  return (
    <div className="grid grid-cols-4 gap-6 h-[calc(100vh-16rem)] min-h-[550px]">
      
      {/* Barra lateral de historial: col-span-1 */}
      <div className="col-span-1 flex flex-col border border-primary/20 rounded-3xl p-4 bg-card/60 backdrop-blur-xl justify-between overflow-hidden shadow-lg">
        <div className="flex flex-col gap-4 overflow-hidden h-full">
          <Button 
            onClick={() => setActiveSessionId('new')} 
            variant="outline" 
            className="w-full gap-2 border-primary/30 hover:bg-primary/10 rounded-2xl justify-start font-semibold"
          >
            <Plus size={18} />
            Nueva Conversación
          </Button>

          {/* Lista de Chats agrupados */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin">
            {Object.keys(groupedSessions).length === 0 ? (
              <div className="text-center text-muted-foreground text-xs py-8 opacity-75">
                No hay conversaciones previas
              </div>
            ) : (
              Object.keys(groupedSessions).map((groupName) => (
                <div key={groupName} className="space-y-1">
                  <h4 className="text-xs font-black tracking-wider text-muted-foreground/80 px-2 uppercase">
                    {groupName}
                  </h4>
                  <div className="space-y-1">
                    {groupedSessions[groupName].map((session: any) => (
                      <div
                        key={session.id}
                        onClick={() => setActiveSessionId(session.id)}
                        className={`flex items-center justify-between p-2.5 rounded-2xl cursor-pointer transition-all group ${
                          activeSessionId === session.id 
                            ? 'bg-primary text-primary-foreground font-medium shadow-sm shadow-primary/25' 
                            : 'hover:bg-muted/70 text-foreground/80'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden w-full">
                          <MessageSquare size={16} className="shrink-0 opacity-70" />
                          <span className="text-xs truncate w-full">{session.title}</span>
                        </div>
                        <button
                          onClick={(e) => deleteSession(e, session.id)}
                          className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 ${
                            activeSessionId === session.id 
                              ? 'text-primary-foreground hover:bg-white/10' 
                              : 'text-muted-foreground hover:text-destructive'
                          }`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Zona inferior de borrado masivo para administradores */}
        {isAdmin && Object.keys(groupedSessions).length > 0 && (
          <div className="pt-4 border-t border-border/60">
            <Button
              onClick={handleClearAll}
              variant="ghost"
              className="w-full text-xs font-semibold text-destructive hover:bg-destructive/10 justify-start gap-2 rounded-xl"
            >
              <Trash2 size={15} />
              Limpiar Todo el Historial
            </Button>
          </div>
        )}
      </div>

      {/* Ventana de Chat Principal: col-span-3 */}
      <Card className="col-span-3 flex flex-col border-primary/20 shadow-xl rounded-3xl overflow-hidden bg-card/60 backdrop-blur-xl">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/10 pb-4">
          <div className="flex items-center justify-between">
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
            
            <div className="max-w-xs w-48">
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="bg-background rounded-xl">
                  <SelectValue placeholder="Agente IA (Opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin agente (RAG Básico)</SelectItem>
                  {agents.map((a: any) => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  msg.role === 'user' ? 'bg-primary text-primary-foreground font-black' : 'bg-secondary text-secondary-foreground'
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
              <div className="flex gap-4 flex-row animate-in fade-in-0 duration-300">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shadow-md">
                  <Bot size={20} />
                </div>
                <div className="bg-muted/60 text-foreground border border-border/50 rounded-2xl rounded-tl-sm p-4 shadow-sm flex flex-col gap-3 min-w-[280px]">
                  <div className="flex items-center gap-2">
                    {isPaused ? (
                      <Pause className="text-amber-500 animate-pulse" size={18} />
                    ) : (
                      <Loader2 className="animate-spin text-primary" size={18} />
                    )}
                    <span className="text-sm font-medium">
                      {isPaused ? 'Procesando consulta (Pausado)...' : 'Procesando consulta...'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 border-t pt-2 border-border/40">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsPaused(!isPaused)}
                      className="text-xs h-7 px-2.5 gap-1.5 hover:bg-primary/10 rounded-lg text-muted-foreground hover:text-foreground transition-all"
                    >
                      {isPaused ? (
                        <>
                          <Play size={13} className="text-emerald-500 fill-emerald-500" />
                          Reanudar
                        </>
                      ) : (
                        <>
                          <Pause size={13} className="text-amber-500 fill-amber-500" />
                          Pausar
                        </>
                      )}
                    </Button>
                    
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleStop}
                      className="text-xs h-7 px-2.5 gap-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg text-muted-foreground transition-all"
                    >
                      <Square size={13} className="fill-destructive/20" />
                      Detener
                    </Button>
                  </div>
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
    </div>
  );
}
