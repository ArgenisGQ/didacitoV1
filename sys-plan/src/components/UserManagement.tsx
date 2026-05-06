import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  flexRender,
} from '@tanstack/react-table'
import {
  UserPlus,
  Edit2,
  Trash2,
  Mail,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import api from '../lib/api-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import UserModal from './UserModal'

interface UserData {
  id: number
  email: string
  full_name: string
  role: string
  is_active: boolean
  date_joined: string
}

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_GESTION: 'Admin Gestion',
  COORDINADOR: 'Coordinador',
  DOCENTE: 'Docente',
}

const roleVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  SUPER_ADMIN: 'destructive',
  ADMIN_GESTION: 'default',
  COORDINADOR: 'secondary',
  DOCENTE: 'outline',
}

export default function UserManagement() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const queryClient = useQueryClient()

  const { data: users = [], isLoading } = useQuery<UserData[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/users')
      return data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/users/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const handleEdit = (user: UserData) => {
    setEditingUser(user)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (window.confirm('Estas seguro de desactivar este usuario? (Borrado logico)')) {
      await deleteMutation.mutateAsync(id)
    }
  }

  const columns: ColumnDef<UserData>[] = [
    {
      accessorKey: 'full_name',
      header: 'Usuario',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary font-bold">
              {row.original.full_name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{row.original.full_name}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mail size={12} />
              {row.original.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Rol',
      cell: ({ row }) => (
        <Badge variant={roleVariants[row.original.role] || 'outline'}>
          {roleLabels[row.original.role] || row.original.role}
        </Badge>
      ),
    },
    {
      accessorKey: 'is_active',
      header: 'Estado',
      cell: ({ row }) =>
        row.original.is_active ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-sm">
            <CheckCircle2 size={14} /> Activo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-destructive font-semibold text-sm">
            <XCircle size={14} /> Inactivo
          </span>
        ),
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Acciones</div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(row.original)}
          >
            <Edit2 size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => handleDelete(row.original.id)}
            disabled={!row.original.is_active}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl lg:text-5xl font-black tracking-tighter">
            Gestion de Identidades
          </h1>
          <p className="text-lg text-muted-foreground font-medium">
            Control de acceso y administracion de roles institucionales.
          </p>
        </div>

        <Button
          size="lg"
          className="gap-2 font-extrabold text-base h-14 px-8"
          onClick={() => setIsModalOpen(true)}
        >
          <UserPlus size={22} strokeWidth={2.5} />
          Nuevo Usuario
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Todos los Usuarios</CardTitle>
          <CardDescription>
            {users.length} usuarios registrados en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={!row.original.is_active ? 'opacity-60' : ''}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="text-center h-24 text-muted-foreground"
                    >
                      No hay usuarios registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isModalOpen && (
        <UserModal
          onClose={() => {
            setIsModalOpen(false)
            setEditingUser(null)
          }}
          initialData={editingUser}
        />
      )}
    </div>
  )
}
