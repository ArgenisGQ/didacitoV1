import { useState, useEffect } from 'react';
import apiClient from '../lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Loader2, Users, FileText, CheckCircle2, Clock, AlertTriangle, LayoutDashboard, PieChart as PieChartIcon } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Button } from '@/components/ui/button';

interface DashboardWidget {
  id: number;
  code: string;
  name: string;
  description: string;
  component_name: string;
  order: number;
}

export function DashboardView({ 
  userRole, 
  onEditPlan, 
  onPreviewPlan,
  onApprovePlan,
  onObservePlan,
  onWebPreviewPlan,
  plans = []
}: { 
  userRole: string;
  onEditPlan?: (planId: number) => void;
  onPreviewPlan?: (planId: number, title: string) => void;
  onApprovePlan?: (planId: number) => void;
  onObservePlan?: (planId: number) => void;
  onWebPreviewPlan?: (plan: any) => void;
  plans?: any[];
}) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let initialConnectTimeout: ReturnType<typeof setTimeout>;

    const fetchDashboardData = async () => {
      try {
        const [widgetsRes, analyticsRes] = await Promise.all([
          apiClient.get('/dashboard/widgets'),
          apiClient.get(userRole === 'DOCENTE' ? '/dashboard/analytics/personal' : '/dashboard/analytics/global')
        ]);
        if (isMounted) {
          setWidgets(widgetsRes.data);
          setAnalytics(analyticsRes.data);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching dashboard data", error);
        if (isMounted) setLoading(false);
      }
    };

    const connectWebSocket = () => {
      if (userRole === 'DOCENTE') return; // DOCENTE no usa tiempo real global por ahora

      const apiUrl = apiClient.defaults.baseURL || '/api';
      let wsUrl = '';
      
      if (apiUrl.startsWith('http')) {
        wsUrl = apiUrl.replace(/^http/, 'ws') + '/dashboard/ws';
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        let basePath = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
        
        // Si por alguna razón de entorno basePath queda vacío o como '/', forzar a '/api'
        if (!basePath || basePath === '' || basePath === '/') {
            basePath = '/api';
        } else if (!basePath.startsWith('/')) {
            basePath = '/' + basePath;
        }
        
        wsUrl = `${protocol}//${host}${basePath}/dashboard/ws`;
      }

      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ANALYTICS_UPDATE' && isMounted) {
            setAnalytics(data.data);
          }
        } catch (err) {
          console.error("Error parsing WS message", err);
        }
      };

      ws.onclose = () => {
        // Solo reconectamos si el componente sigue montado
        if (isMounted) {
          reconnectTimeout = setTimeout(connectWebSocket, 5000);
        }
      };
      
      ws.onerror = (err) => {
        // No cerramos explícitamente aquí para evitar el warning de "closed before established"
        // El navegador cerrará la conexión por sí solo si falla, disparando onclose.
        console.error("WebSocket error:", err);
      };
    };

    fetchDashboardData();
    
    // Retrasar la conexión un momento para evitar que el StrictMode de React
    // lo monte y desmonte instantáneamente, lo cual causa el warning en consola
    initialConnectTimeout = setTimeout(() => {
        if (isMounted) connectWebSocket();
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(initialConnectTimeout);
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null; // prevent reconnect loop
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
        }
      }
    };
  }, [userRole]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-indigo-500 w-10 h-10" />
      </div>
    );
  }

  // --- WIDGET COMPONENTS ---

  const renderStatCard = (title: string, value: string | number, desc: string, icon: any, colorClass: string) => (
    <Card className="shadow-sm border-border bg-card col-span-1">
      <CardContent className="p-6 flex items-center gap-4">
        <div className={`p-4 rounded-xl ${colorClass}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-2xl font-bold tracking-tight text-card-foreground">{value}</h3>
          <p className="text-xs text-muted-foreground mt-1">{desc}</p>
        </div>
      </CardContent>
    </Card>
  );

  const renderActiveUsersWidget = () => {
    let data = analytics?.active_users_series || [];
    
    // Safety fallback for old cache keys if needed, but normally we just trust the new backend format
    data = data.map((d: any) => ({
      name: d.name,
      connections: typeof d.connections === 'number' ? d.connections : (d.users || 0),
      plans: typeof d.plans === 'number' ? d.plans : 0
    }));

    const currentOnline = analytics?.current_online_users || 0;
    
    return (
      <Card className="shadow-lg border-border bg-card col-span-1 lg:col-span-3">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-card-foreground">Accesos en la Semana</CardTitle>
            <CardDescription>Actividad global: Conexiones y Creación de Planes</CardDescription>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Conectados Ahora</span>
            <div className="flex items-center gap-2">
              <div className="relative flex h-3 w-3 mt-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </div>
              <span className="text-3xl font-bold text-emerald-500">{currentOnline}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full mt-4 overflow-x-auto">
            {data.length > 0 ? (
              <div style={{ width: '800px', height: '300px' }}>
                <LineChart width={800} height={300} data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={true} axisLine={true} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickLine={true} axisLine={true} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f9fafb', borderRadius: '8px' }}
                    itemStyle={{ color: '#f9fafb' }}
                  />
                  <Legend verticalAlign="top" height={36}/>
                  <Line name="Conexiones" type="monotone" dataKey="connections" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                  <Line name="Planes Creados" type="monotone" dataKey="plans" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                </LineChart>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <LayoutDashboard className="h-10 w-10 mb-2 opacity-50" />
                <p>No hay datos suficientes para esta semana.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderPlanStatusWidget = () => {
    const statusMap: Record<string, { label: string, color: string }> = {
      'DRAFT': { label: 'Borradores', color: '#64748b' }, // Slate
      'IN_REVIEW': { label: 'En Revisión', color: '#f59e0b' }, // Amber
      'OBSERVED': { label: 'Observados', color: '#ef4444' }, // Red
      'APPROVED': { label: 'Aprobados', color: '#10b981' } // Emerald
    };

    let data: any[] = [];
    let totalPlans = 0;

    if (analytics?.status_counts) {
      data = Object.entries(analytics.status_counts)
        .filter(([_, count]: any) => count > 0)
        .map(([status, count]) => {
          totalPlans += count as number;
          return {
            name: statusMap[status]?.label || status,
            value: count,
            color: statusMap[status]?.color || '#cbd5e1'
          };
        });
    }
    
    const hasData = data.length > 0 && totalPlans > 0;
    
    return (
      <Card className="shadow-lg border-border bg-card col-span-1 lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-card-foreground">Estado de Planificaciones</CardTitle>
          <CardDescription>Distribución actual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full flex items-center justify-center mt-2">
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--card-foreground))', borderRadius: '8px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground w-full h-full border-2 border-dashed border-border rounded-full p-8 max-w-[200px] max-h-[200px] text-center">
                <PieChartIcon className="w-8 h-8 mb-2 opacity-50" />
                <span className="text-sm font-medium">Sin datos</span>
                <span className="text-xs opacity-75">No hay planes registrados</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderTeacherProgressWidget = () => {
    const drafts = analytics?.draft_plans || [];
    
    return (
      <Card className="shadow-md border-border bg-card border-l-4 border-l-indigo-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground"><Clock size={20} className="text-indigo-500"/> Mis Planes en Progreso</CardTitle>
          <CardDescription>Planes guardados como borrador (Continuar editando)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {drafts.length > 0 ? (
              drafts.map((d: any) => (
                <div key={d.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border border-border gap-3">
                  <span className="font-semibold text-card-foreground truncate flex-1" title={d.title}>{d.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-indigo-500/10 text-indigo-500 px-2 py-1 rounded-full font-bold">Borrador</span>
                    {onEditPlan && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditPlan(d.id)}
                        className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100"
                      >
                        Editar
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-muted-foreground border border-dashed border-border rounded-xl">
                <p>No tienes planes en progreso.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderTeacherAlertWidget = () => (
    <Card className="shadow-md border-slate-200 border-l-4 border-l-rose-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><AlertTriangle size={20} className="text-rose-500"/> Mis Planes Observados</CardTitle>
        <CardDescription>Planes que requieren tu atención o corrección</CardDescription>
      </CardHeader>
      <CardContent>
        {analytics?.needs_attention > 0 ? (
           <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
             Tienes <strong>{analytics.needs_attention}</strong> planes con observaciones.
           </div>
        ) : (
           <p className="text-slate-500 italic">No tienes planes observados.</p>
        )}
      </CardContent>
    </Card>
  );

  const renderTeacherSemesterWidget = () => null;
  const renderTeacherHistoryWidget = () => {
    const approved = analytics?.approved_plans || [];
    
    return (
      <Card className="shadow-md border-slate-200 border-l-4 border-l-emerald-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CheckCircle2 size={20} className="text-emerald-500"/> Mis Planes Aprobados</CardTitle>
          <CardDescription>Planes que han sido aceptados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {approved.length > 0 ? (
              approved.map((d: any) => (
                <div key={d.id} className="flex justify-between items-center p-3 bg-emerald-50/50 rounded-lg border border-emerald-100 gap-3">
                  <span className="font-semibold text-emerald-900 truncate flex-1" title={d.title}>{d.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-emerald-500/10 text-emerald-600 px-2 py-1 rounded-full font-bold">Aprobado</span>
                    {onPreviewPlan && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onPreviewPlan(d.id, d.title)}
                        className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100"
                      >
                        Ver Documento
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl">
                <p>No tienes planes aprobados aún.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderCoordinatorInboxWidget = () => {
    const pendingPlans = plans.filter(p => p.status === 'IN_REVIEW');
    
    return (
      <Card className="shadow-lg border-slate-200 bg-card col-span-1 lg:col-span-2 mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <LayoutDashboard size={20} className="text-purple-600"/> Bandeja de Entrada (Por Aprobar)
          </CardTitle>
          <CardDescription>Planificaciones esperando revisión</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pendingPlans.length > 0 ? (
              pendingPlans.map((d: any) => (
                <div key={d.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-muted/30 rounded-xl border border-border gap-4">
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-semibold text-card-foreground truncate" title={d.title}>{d.title}</span>
                    <span className="text-sm text-muted-foreground">{d.subject_code} - Sección {d.section}</span>
                    <span className="text-xs text-muted-foreground">Docente: {d.author_name}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {onWebPreviewPlan && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onWebPreviewPlan(d)}
                        className="gap-1 border-primary/20 hover:border-primary/40 text-primary"
                      >
                        Ver Borrador
                      </Button>
                    )}
                    {onApprovePlan && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onApprovePlan(d.id)}
                        className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        Aceptar
                      </Button>
                    )}
                    {onObservePlan && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onObservePlan(d.id)}
                        className="gap-1"
                      >
                        Corregir
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-2xl">
                <CheckCircle2 className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                <p>No hay planes pendientes de aprobación.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderWidget = (widget: DashboardWidget) => {
    switch (widget.code) {
      case 'total_plans':
        return renderStatCard('Total de Planes', analytics?.total_plans || 0, 'Registrados en el sistema', <FileText className="text-blue-600" />, 'bg-blue-600/20');
      case 'pending_approvals':
        return renderStatCard('Por Aprobar', analytics?.pending_approvals || 0, 'Esperando revisión', <Clock className="text-orange-600" />, 'bg-orange-600/20');
      case 'creation_time':
        const avgTime = analytics?.average_creation_time || 'N/A';
        return renderStatCard('Tiempo Promedio', avgTime, 'Tiempo en diseñar un plan', <CheckCircle2 className="text-emerald-600" />, 'bg-emerald-600/20');
      case 'coordinator_inbox':
        return renderCoordinatorInboxWidget();
      case 'active_users':
        return renderActiveUsersWidget();
      case 'plan_status':
        return renderPlanStatusWidget();
      case 'my_progress':
        return renderTeacherProgressWidget();
      case 'my_rejected':
        return renderTeacherAlertWidget();
      case 'my_semester':
        return renderTeacherSemesterWidget();
      case 'my_history':
        return renderTeacherHistoryWidget();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Panel de Control General</h2>
        <p className="text-muted-foreground mt-1">Bienvenido a tu área de trabajo personalizada.</p>
      </div>

      {/* Fila Superior: Tarjetas de Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {widgets.filter(w => ['total_plans', 'pending_approvals', 'creation_time', 'coordinator_inbox'].includes(w.code)).map(w => (
           <div key={w.code} className="w-full">
             {renderWidget(w)}
           </div>
        ))}
      </div>

      {/* Filas Inferiores: Gráficos y Otros */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {widgets.filter(w => !['total_plans', 'pending_approvals', 'creation_time', 'coordinator_inbox'].includes(w.code)).map(w => (
           <div key={w.code} className={w.code === 'active_users' ? 'col-span-1 lg:col-span-2' : 'col-span-1'}>
             {renderWidget(w)}
           </div>
        ))}
      </div>
      
      {widgets.length === 0 && (
         <div className="text-center py-20 text-slate-500">
           <LayoutDashboard className="mx-auto h-12 w-12 text-slate-300 mb-4" />
           <p className="text-lg font-semibold">No hay widgets asignados a tu rol.</p>
           <p className="text-sm">Contacta al Super Administrador para configurar tu Dashboard.</p>
         </div>
      )}
    </div>
  );
}
