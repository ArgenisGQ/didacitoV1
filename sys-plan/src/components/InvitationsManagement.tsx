import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Mail,
  Calendar,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  Search,
  Key
} from 'lucide-react'
import api from '../lib/api-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface InvitationData {
  id: number
  email: string
  expires_at: string
  is_revoked: boolean
  created_at: string
}

export default function InvitationsManagement() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' })
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [processingId, setProcessingId] = useState<number | null>(null)

  // 1. Fetch invitations query
  const { data: invitations = [], isLoading } = useQuery<InvitationData[]>({
    queryKey: ['invitations'],
    queryFn: async () => {
      const { data } = await api.get('/admin/invitations')
      return data
    },
  })

  // 2. Resend invitation mutation
  const resendMutation = useMutation({
    mutationFn: async (id: number) => {
      setProcessingId(id)
      const { data } = await api.post(`/admin/invitations/${id}/resend`)
      return data
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] })
      const actLink = `${window.location.origin}/activate-account?token=${data.new_token}`
      navigator.clipboard.writeText(actLink)
      setActionMsg({
        type: 'success',
        text: `Invitación reenviada con éxito para el ID ${id}. ¡El enlace de activación ha sido copiado en su portapapeles!`,
      })
      setTimeout(() => setActionMsg({ type: '', text: '' }), 5000)
    },
    onError: (err: any) => {
      setActionMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Error al reenviar la invitación.',
      })
    },
    onSettled: () => {
      setProcessingId(null)
    }
  })

  // 3. Revoke invitation mutation
  const revokeMutation = useMutation({
    mutationFn: async (id: number) => {
      setProcessingId(id)
      await api.delete(`/admin/invitations/${id}`)
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setActionMsg({
        type: 'success',
        text: `La invitación con ID ${id} y su usuario inactivo asociado fueron eliminados correctamente.`,
      })
      setTimeout(() => setActionMsg({ type: '', text: '' }), 4000)
    },
    onError: (err: any) => {
      setActionMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Error al revocar la invitación.',
      })
    },
    onSettled: () => {
      setProcessingId(null)
    }
  })

  const getStatus = (inv: InvitationData) => {
    if (inv.is_revoked) return { label: 'Revocada', variant: 'destructive' as const, bgClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-none' }
    const isExpired = new Date(inv.expires_at) < new Date()
    if (isExpired) return { label: 'Expirada', variant: 'outline' as const, bgClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' }
    return { label: 'Activa', variant: 'secondary' as const, bgClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none' }
  }

  const handleResend = (id: number) => {
    resendMutation.mutate(id)
  }

  const handleRevoke = (id: number) => {
    if (window.confirm('¿Está seguro que desea revocar esta invitación? Se eliminará la invitación y el usuario inactivo asociado en DIDACTICO de forma atómica.')) {
      revokeMutation.mutate(id)
    }
  }

  const filteredInvs = invitations.filter((inv) =>
    inv.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Card className="glass-morphism border-slate-200/80 dark:border-slate-800/80 shadow-lg">
      <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Mail size={20} className="text-primary" />
            Invitaciones de Acceso Pendientes
          </CardTitle>
          <CardDescription className="text-sm font-medium text-slate-500 mt-1">
            Gestione las solicitudes enviadas a docentes que aún no han completado su registro autogestionado.
          </CardDescription>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            placeholder="Buscar por correo..."
            className="pl-9 h-10 bg-slate-50/50 dark:bg-slate-900/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {actionMsg.text && (
          <div className={`p-4 rounded-xl border flex items-start gap-2.5 text-sm font-semibold animate-fadeIn ${
            actionMsg.type === 'success' 
              ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600' 
              : 'border-destructive/20 bg-destructive/5 text-destructive'
          }`}>
            {actionMsg.type === 'success' ? <Check size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0" />}
            <div className="flex-1">
              <p className="font-bold">{actionMsg.type === 'success' ? 'Operación completada' : 'Error en la solicitud'}</p>
              <p className="text-xs mt-0.5 font-medium opacity-90">{actionMsg.text}</p>
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-current hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setActionMsg({ type: '', text: '' })}>
              Cerrar
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3 py-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 w-full bg-slate-100 dark:bg-slate-900 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredInvs.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Mail size={32} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Sin invitaciones pendientes</h3>
              <p className="text-sm text-slate-500 mt-1 font-medium">
                {searchQuery ? 'No se encontraron invitaciones que coincidan con la búsqueda.' : 'No existen invitaciones inactivas creadas en el sistema actualmente.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                <TableRow>
                  <TableHead className="p-3.5 font-bold text-slate-500 uppercase tracking-wider text-xs">Correo Invitado</TableHead>
                  <TableHead className="p-3.5 font-bold text-slate-500 uppercase tracking-wider text-xs">Fecha Envío</TableHead>
                  <TableHead className="p-3.5 font-bold text-slate-500 uppercase tracking-wider text-xs">Expiración</TableHead>
                  <TableHead className="p-3.5 font-bold text-slate-500 uppercase tracking-wider text-xs w-28 text-center">Estado</TableHead>
                  <TableHead className="p-3.5 font-bold text-slate-500 uppercase tracking-wider text-xs w-32 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvs.map((inv) => {
                  const status = getStatus(inv)
                  const isPendingAction = processingId === inv.id
                  const isExpired = new Date(inv.expires_at) < new Date()
                  return (
                    <TableRow key={inv.id} className="hover:bg-slate-50/35 dark:hover:bg-slate-950/10 font-medium">
                      <TableCell className="p-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                            {inv.email.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={inv.email}>
                            {inv.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="p-3.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} />
                          {new Date(inv.created_at).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="p-3.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1" title={new Date(inv.expires_at).toLocaleString()}>
                          <Key size={13} />
                          {new Date(inv.expires_at).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="p-3.5 text-center">
                        <Badge className={`${status.bgClass} font-extrabold text-[10px] uppercase border`}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-3.5 text-right">
                        <div className="flex justify-end items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:bg-primary/10"
                            title="Reenviar enlace de activación (Copiar)"
                            onClick={() => handleResend(inv.id)}
                            disabled={isPendingAction || inv.is_revoked}
                          >
                            {isPendingAction ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <RefreshCw size={14} />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title="Revocar invitación y borrar usuario inactivo"
                            onClick={() => handleRevoke(inv.id)}
                            disabled={isPendingAction}
                          >
                            {isPendingAction ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
