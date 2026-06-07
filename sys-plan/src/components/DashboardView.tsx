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
  onDeletePlan,
  onPreviewPlan,
  onApprovePlan,
  onObservePlan,
  onWebPreviewPlan,
  plans = []
}: { 
  userRole: string;
  onEditPlan?: (planId: number) => void;
  onDeletePlan?: (planId: number) => void;
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

  // Refetch analytics when the external plans list changes (e.g. after a deletion)
  useEffect(() => {
    let isMounted = true;
    const updateAnalytics = async () => {
      try {
        const analyticsRes = await apiClient.get(userRole === 'DOCENTE' ? '/dashboard/analytics/personal' : '/dashboard/analytics/global');
        if (isMounted) {
          setAnalytics(analyticsRes.data);
        }
      } catch (error) {
        console.error("Error refreshing analytics", error);
      }
    };
    
    // Only refresh if initial load is done
    if (!loading) {
      updateAnalytics();
    }
    
    return () => { isMounted = false; };
  }, [plans, userRole]);

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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={true} axisLine={true} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={true} axisLine={true} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--card-foreground))', borderRadius: '8px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend verticalAlign="top" height={36}/>
                  <Line name="Conexiones" type="monotone" dataKey="connections" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))' }} activeDot={{ r: 6 }} />
                  <Line name="Planes Creados" type="monotone" dataKey="plans" stroke="hsl(var(--accent))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--accent))' }} activeDot={{ r: 6 }} />
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
      'APPROVED': { label: 'Aprobadas', color: '#10b981' }, // Verde
      'IN_REVIEW': { label: 'En Revisión', color: '#3b82f6' }, // Azul
      'DRAFT': { label: 'En Edición (Borrador)', color: '#94a3b8' }, // Gris
      'OBSERVED': { label: 'Rezagados Críticos', color: '#ef4444' } // Rojo
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
            color: statusMap[status]?.color || 'hsl(var(--muted-foreground))'
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
      <Card className="h-full shadow-md border-border border-l-4 border-l-primary bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground"><Clock size={20} className="text-primary"/> Mis Planes en Progreso</CardTitle>
          <CardDescription>Planes guardados como borrador (Continuar editando)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {drafts.length > 0 ? (
              drafts.map((d: any) => (
                <div key={d.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border border-border gap-3">
                  <span className="font-semibold text-card-foreground truncate flex-1" title={d.title || 'Plan sin título'}>
                    {d.title || <span className="text-muted-foreground italic font-normal">Plan sin título</span>}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-sky-500/10 border border-sky-500/30 text-sky-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Borrador</span>
                    {onEditPlan && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onEditPlan(d.id)}
                        className="h-7 px-3 text-xs font-bold"
                      >
                        Editar
                      </Button>
                    )}
                    {onDeletePlan && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onDeletePlan(d.id)}
                        className="h-7 px-3 text-xs font-bold"
                      >
                        Borrar
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
    <Card className="h-full shadow-md border-border border-l-4 border-l-destructive bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><AlertTriangle size={20} className="text-destructive"/> Mis Planes Observados</CardTitle>
        <CardDescription>Planes que requieren tu atención o corrección</CardDescription>
      </CardHeader>
      <CardContent>
        {analytics?.needs_attention > 0 ? (
           <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive font-semibold">
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
      <Card className="h-full shadow-md border-border border-l-4 border-l-emerald-500 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CheckCircle2 size={20} className="text-emerald-500"/> Mis Planes Aprobados</CardTitle>
          <CardDescription>Planes que han sido aceptados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {approved.length > 0 ? (
              approved.map((d: any) => (
                <div key={d.id} className="flex justify-between items-center p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 gap-3">
                  <span className="font-semibold text-card-foreground truncate flex-1" title={d.title}>{d.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-emerald-500/20 text-emerald-500 px-2 py-1 rounded-full font-bold">Aprobado</span>
                    {onPreviewPlan && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onPreviewPlan(d.id, d.title)}
                        className="h-7 px-2 text-success hover:text-success hover:bg-success/20"
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
      <Card className="shadow-lg border-border bg-card w-full mt-6 overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <LayoutDashboard size={20} className="text-primary"/> Bandeja de Entrada (Por Aprobar)
          </CardTitle>
          <CardDescription>Planificaciones esperando revisión</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {pendingPlans.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-y border-border">
                  <tr>
                    <th className="px-6 py-4 font-medium">Asignatura</th>
                    <th className="px-6 py-4 font-medium">Docente</th>
                    <th className="px-6 py-4 font-medium w-48">Progreso de Semanas</th>
                    <th className="px-6 py-4 font-medium text-center">Estado de Flujo</th>
                    <th className="px-6 py-4 font-medium text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingPlans.map((d: any) => {
                    const weeksProgress = Math.min(100, ((d.weeks_count || 0) / 12) * 100);
                    return (
                      <tr key={d.id} className="bg-card hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                           <div className="font-semibold text-foreground">{d.subject_code} <span className="font-normal text-muted-foreground">- Sec. {d.section}</span></div>
                           <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={d.title}>{d.title}</div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                           {d.author_name || 'No Asignado'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div className="bg-primary h-2 rounded-full" style={{ width: `${weeksProgress}%` }}></div>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1.5 text-right font-medium">{d.weeks_count || 0} / 12 Semanas</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-accent/10 text-accent border border-accent/20">
                            Pendiente Operativo
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <div className="flex justify-end gap-2">
                             {onWebPreviewPlan && (
                               <Button variant="ghost" size="sm" onClick={() => onWebPreviewPlan(d)} className="h-8 px-2 text-muted-foreground hover:text-foreground">Ver</Button>
                             )}
                             {onApprovePlan && (
                               <Button variant="default" size="sm" onClick={() => onApprovePlan(d.id)} className="h-8">Revisar</Button>
                             )}
                           </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground border-t border-border bg-muted/10">
              <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="font-medium text-foreground">No hay planes pendientes de aprobación.</p>
              <p className="text-sm mt-1">Todas las planificaciones operativas están al día.</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderWidget = (widget: DashboardWidget) => {
    switch (widget.code) {
      case 'total_plans':
        return renderStatCard('Total de Planes', analytics?.total_plans || 0, 'Registrados en el sistema', <FileText className="text-primary" />, 'bg-primary/20');
      case 'pending_approvals':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            <Card className="shadow-sm border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-3 rounded-lg bg-accent/20 text-accent">
                  <Clock size={18} />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Por Aprobar (Tú)</p>
                  <h3 className="text-lg font-bold tracking-tight text-card-foreground">{analytics?.pending_approvals || 0}</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Listos para validación logística</p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-3 rounded-lg bg-destructive/20 text-destructive">
                  <AlertTriangle size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground">Rezagados Activos</p>
                  <h3 className="text-lg font-bold tracking-tight text-card-foreground">{analytics?.rezagados || 0}</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">En Semana 0 sin enviar</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <AlertTriangle size={14} />
                </Button>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/20 text-primary">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">En Revisión (Calidad)</p>
                  <h3 className="text-lg font-bold tracking-tight text-card-foreground">{analytics?.in_quality_review || 0}</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Pendientes revisión pedagógica</p>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      case 'creation_time':
        const avgTime = analytics?.average_creation_time || 'N/A';
        return renderStatCard('Tiempo Promedio', avgTime, 'Tiempo en diseñar un plan', <CheckCircle2 className="text-success" />, 'bg-success/20');
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

      {/* Fila Superior: Tarjetas de Estadísticas y Contadores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {widgets.filter(w => ['total_plans', 'pending_approvals', 'creation_time'].includes(w.code)).map(w => (
           <div key={w.code} className={w.code === 'pending_approvals' ? 'col-span-1 md:col-span-2 lg:col-span-3' : 'w-full'}>
             {renderWidget(w)}
           </div>
        ))}
      </div>

      {/* Fila Media: Bandeja de Entrada Ancho Completo */}
      {widgets.filter(w => w.code === 'coordinator_inbox').map(w => (
        <div key={w.code} className="w-full mb-6">
          {renderWidget(w)}
        </div>
      ))}

      {/* Filas Inferiores: Gráficos y Otros */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {widgets.filter(w => !['total_plans', 'pending_approvals', 'creation_time', 'coordinator_inbox', 'plan_status'].includes(w.code)).map(w => (
           <div key={w.code} className={w.code === 'active_users' || w.code === 'my_history' ? 'col-span-1 lg:col-span-2' : 'col-span-1'}>
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
