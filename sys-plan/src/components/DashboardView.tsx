import { useState, useEffect } from 'react';
import apiClient from '../lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Loader2, Users, FileText, CheckCircle2, Clock, AlertTriangle, LayoutDashboard, PieChart as PieChartIcon } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardWidget {
  id: number;
  code: string;
  name: string;
  description: string;
  component_name: string;
  order: number;
}

export function DashboardView({ userRole }: { userRole: string }) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [userRole]);

  const fetchDashboardData = async () => {
    try {
      const [widgetsRes, analyticsRes] = await Promise.all([
        apiClient.get('/dashboard/widgets'),
        apiClient.get(userRole === 'DOCENTE' ? '/dashboard/analytics/personal' : '/dashboard/analytics/global')
      ]);
      setWidgets(widgetsRes.data);
      setAnalytics(analyticsRes.data);
    } catch (error) {
      console.error("Error fetching dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

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
    if (data.length === 0) {
      data = [
        { name: 'Lun', users: 12 }, { name: 'Mar', users: 15 }, { name: 'Mie', users: 18 },
        { name: 'Jue', users: 14 }, { name: 'Vie', users: 20 }, { name: 'Sab', users: 9 }, { name: 'Dom', users: 6 }
      ];
    }
    return (
      <Card className="shadow-lg border-border bg-card col-span-1 lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-card-foreground">Accesos en la Semana</CardTitle>
          <CardDescription>Conexiones activas de usuarios al sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--card-foreground))', borderRadius: '8px' }}
                  itemStyle={{ color: 'hsl(var(--primary))' }}
                />
                <Line type="monotone" dataKey="users" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderPlanStatusWidget = () => {
    let data: any[] = [];
    if (analytics?.status_counts) {
      data = Object.entries(analytics.status_counts).map(([status, count]) => ({
        name: status,
        value: count
      })).filter((item: any) => item.value > 0);
    }
    
    if (data.length === 0) {
      data = [
        { name: 'Borradores', value: 3 },
        { name: 'En Revisión', value: 2 },
        { name: 'Aprobados', value: 8 }
      ];
    }
    
    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];
    
    return (
      <Card className="shadow-lg border-border bg-card col-span-1 lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-card-foreground">Estado de Planificaciones</CardTitle>
          <CardDescription>Distribución actual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full flex items-center justify-center mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--card-foreground))', borderRadius: '8px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
              </PieChart>
            </ResponsiveContainer>
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
                <div key={d.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border border-border">
                  <span className="font-semibold text-card-foreground truncate max-w-[70%]">{d.title}</span>
                  <span className="text-xs bg-indigo-500/10 text-indigo-500 px-2 py-1 rounded-full font-bold">Borrador</span>
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
  const renderTeacherHistoryWidget = () => null;

  const renderWidget = (widget: DashboardWidget) => {
    switch (widget.code) {
      case 'total_plans':
        return renderStatCard('Total de Planes', analytics?.total_plans || 0, 'Registrados en el sistema', <FileText className="text-blue-600" />, 'bg-blue-600/20');
      case 'pending_approvals':
        return renderStatCard('Por Aprobar', analytics?.pending_approvals || 0, 'Esperando revisión', <Clock className="text-orange-600" />, 'bg-orange-600/20');
      case 'creation_time':
        return renderStatCard('Tiempo Promedio', '2.5h', 'Tiempo en diseñar un plan', <CheckCircle2 className="text-emerald-600" />, 'bg-emerald-600/20');
      case 'coordinator_inbox':
        return renderStatCard('Bandeja Entrada', analytics?.pending_approvals || 0, 'Planes para hoy', <LayoutDashboard className="text-purple-600" />, 'bg-purple-600/20');
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
