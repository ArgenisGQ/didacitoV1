import { useState, useEffect } from 'react'
import { User, Lock, Key, Check, AlertCircle, Loader2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import api from '@/lib/api-client'

interface ProfileConfig {
  editable_fields: string[]
  support_email: string
}

interface UserData {
  id: number
  email: string
  full_name: string
  role: string
  mfa_enabled: boolean
}

export default function UserProfile({ onForceLogout }: { onForceLogout?: () => void }) {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [config, setConfig] = useState<ProfileConfig>({ editable_fields: ['full_name'], support_email: 'soporte@didactico.edu' })
  const [fullName, setFullName] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' })

  // Password change states
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' })
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: '', warning: '' })

  useEffect(() => {
    fetchProfileData()
  }, [])

  const fetchProfileData = async () => {
    try {
      const resMe = await api.get('/users/me')
      setUserData(resMe.data)
      setFullName(resMe.data.full_name)

      const resConfig = await api.get('/users/me/profile-config')
      setConfig(resConfig.data)
    } catch (err) {
      console.error('Failed to load profile data', err)
    }
  }

  // Real-time zxcvbn strength estimation
  useEffect(() => {
    if (!newPassword) {
      setPasswordStrength({ score: 0, feedback: '', warning: '' })
      return
    }

    // Dynamic import to keep initial bundle smaller
    import('zxcvbn').then((zxcvbnModule) => {
      const evaluation = zxcvbnModule.default(newPassword)
      const suggestions = evaluation.feedback.suggestions.join(', ')
      setPasswordStrength({
        score: evaluation.score,
        feedback: suggestions || 'Contrasena robusta',
        warning: evaluation.feedback.warning || ''
      })
    })
  }, [newPassword])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingProfile(true)
    setProfileMsg({ type: '', text: '' })

    try {
      await api.patch('/users/me', { full_name: fullName })
      setProfileMsg({ type: 'success', text: 'Perfil actualizado exitosamente.' })
      // Update local state
      if (userData) {
        setUserData({ ...userData, full_name: fullName })
      }
    } catch (err: any) {
      setProfileMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Error al actualizar el perfil.'
      })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Las contrasenas no coinciden.' })
      return
    }

    if (passwordStrength.score < 3) {
      setPasswordMsg({
        type: 'error',
        text: 'La nueva contrasena no cumple con la robustez requerida (debe ser nivel 3 o superior).'
      })
      return
    }

    setIsChangingPassword(true)
    setPasswordMsg({ type: '', text: '' })

    try {
      await api.post('/users/me/change-password', {
        old_password: oldPassword,
        new_password: newPassword
      })

      setPasswordMsg({
        type: 'success',
        text: 'Contrasena cambiada con exito. Cerrando sesion de forma segura...'
      })

      // Force logout after 3 seconds as the active session is revoked
      setTimeout(() => {
        if (onForceLogout) {
          onForceLogout()
        } else {
          window.location.reload()
        }
      }, 3000)
    } catch (err: any) {
      setPasswordMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Error al cambiar la contrasena.'
      })
      setIsChangingPassword(false)
    }
  }

  if (!userData) {
    return (
      <div className="py-12 flex justify-center items-center">
        <Loader2 className="animate-spin text-primary" size={32} />
        <span className="ml-3 text-slate-400 font-medium">Cargando perfil docente...</span>
      </div>
    )
  }

  const isEmailEditable = config.editable_fields.includes('email')
  const isRoleEditable = config.editable_fields.includes('role')
  const isNameEditable = config.editable_fields.includes('full_name')

  // Helper colors for password score
  const strengthColors = ['bg-rose-500', 'bg-orange-500', 'bg-amber-400', 'bg-sky-500', 'bg-emerald-500']
  const strengthLabels = ['Muy Débil', 'Débil', 'Aceptable', 'Segura', 'Excelente']

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-4xl lg:text-5xl font-black tracking-tighter">Mi Perfil</h1>
        <p className="text-lg text-muted-foreground font-medium">
          Autogestiona tus datos personales y credenciales de acceso seguro.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Info Card */}
        <Card className="backdrop-blur-md bg-card/60 border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="text-primary" size={20} />
              Datos de Cuenta
            </CardTitle>
            <CardDescription>
              Información de tu identidad docente e institucional.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              {profileMsg.text && (
                <div
                  className={`p-4 rounded-xl flex items-start gap-3 border text-sm ${
                    profileMsg.type === 'success'
                      ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50/50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-800 dark:text-rose-300'
                  }`}
                >
                  <AlertCircle className="shrink-0 mt-0.5" size={16} />
                  <span>{profileMsg.text}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="font-bold flex items-center justify-between">
                  Correo Institucional
                  {!isEmailEditable && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-semibold">
                      <Lock size={10} /> Protegido
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    value={userData.email}
                    disabled={!isEmailEditable}
                    className="pr-10 disabled:opacity-75 disabled:bg-slate-50 dark:disabled:bg-slate-900/50 font-medium"
                  />
                  {!isEmailEditable && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground group">
                      <Lock size={16} className="cursor-help" />
                      <div className="pointer-events-none opacity-0 group-hover:opacity-100 absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-950 text-slate-100 text-xs rounded-xl shadow-xl transition-opacity duration-300 z-50 leading-relaxed font-semibold">
                        Este campo está protegido por la administración. Solicite cambios a: <span className="text-primary">{config.support_email}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="font-bold flex items-center justify-between">
                  Rol Asignado
                  {!isRoleEditable && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-semibold">
                      <Lock size={10} /> Protegido
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="role"
                    value={userData.role.replace('_', ' ')}
                    disabled={!isRoleEditable}
                    className="pr-10 disabled:opacity-75 disabled:bg-slate-50 dark:disabled:bg-slate-900/50 font-medium uppercase tracking-wider text-xs"
                  />
                  {!isRoleEditable && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground group">
                      <Lock size={16} className="cursor-help" />
                      <div className="pointer-events-none opacity-0 group-hover:opacity-100 absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-950 text-slate-100 text-xs rounded-xl shadow-xl transition-opacity duration-300 z-50 leading-relaxed font-semibold">
                        Tu rol es asignado exclusivamente por IT. Solicite un cambio a: <span className="text-primary">{config.support_email}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName" className="font-bold flex items-center justify-between">
                  Nombre Completo
                  {!isNameEditable && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-semibold">
                      <Lock size={10} /> Protegido
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={!isNameEditable}
                    className="pr-10 disabled:opacity-75 disabled:bg-slate-50 dark:disabled:bg-slate-900/50 font-semibold"
                  />
                  {!isNameEditable && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground group">
                      <Lock size={16} className="cursor-help" />
                      <div className="pointer-events-none opacity-0 group-hover:opacity-100 absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-950 text-slate-100 text-xs rounded-xl shadow-xl transition-opacity duration-300 z-50 leading-relaxed font-semibold">
                        Tu nombre docente está configurado administrativamente. Contacta a: <span className="text-primary">{config.support_email}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                disabled={!isNameEditable || isSavingProfile}
                className="w-full font-extrabold h-11"
              >
                {isSavingProfile ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Guardando...
                  </>
                ) : (
                  'Guardar Cambios'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Password Card */}
        <Card className="backdrop-blur-md bg-card/60 border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="text-primary" size={20} />
              Seguridad y Contraseña
            </CardTitle>
            <CardDescription>
              Actualiza tu clave de acceso con políticas de robustez activa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-5">
              {passwordMsg.text && (
                <div
                  className={`p-4 rounded-xl flex items-start gap-3 border text-sm ${
                    passwordMsg.type === 'success'
                      ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50/50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-800 dark:text-rose-300'
                  }`}
                >
                  <AlertCircle className="shrink-0 mt-0.5" size={16} />
                  <span>{passwordMsg.text}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="oldPassword" className="font-bold">
                  Contraseña Actual
                </Label>
                <Input
                  id="oldPassword"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="newPassword" className="font-bold">
                  Nueva Contraseña
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="font-mono"
                />

                {/* Password Entropy Meter */}
                {newPassword && (
                  <div className="space-y-2 mt-2 p-3 bg-muted/40 rounded-xl border border-border/50 text-xs">
                    <div className="flex justify-between items-center font-bold">
                      <span>Fuerza de la clave:</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black text-white ${
                          strengthColors[passwordStrength.score]
                        }`}
                      >
                        {strengthLabels[passwordStrength.score]}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex gap-0.5">
                      {[0, 1, 2, 3].map((val) => (
                        <div
                          key={val}
                          className={`h-full flex-1 transition-all duration-300 ${
                            passwordStrength.score > val
                              ? strengthColors[passwordStrength.score]
                              : 'bg-slate-200 dark:bg-slate-800'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Feedback */}
                    {passwordStrength.warning && (
                      <p className="text-rose-500 font-semibold flex items-center gap-1">
                        <AlertCircle size={10} />
                        {passwordStrength.warning}
                      </p>
                    )}
                    {passwordStrength.feedback && (
                      <p className="text-slate-500 dark:text-slate-400 leading-normal flex items-start gap-1 font-medium">
                        <Info size={11} className="mt-0.5 shrink-0" />
                        <span>{passwordStrength.feedback}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="font-bold">
                  Confirmar Nueva Contraseña
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="font-mono"
                />
              </div>

              <Button
                type="submit"
                disabled={isChangingPassword || passwordStrength.score < 3}
                className="w-full font-extrabold h-11"
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Cambiando contraseña...
                  </>
                ) : (
                  'Actualizar Contraseña'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
