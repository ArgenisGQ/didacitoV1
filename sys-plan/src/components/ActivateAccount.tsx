import { useState, useEffect } from 'react'
import { Lock, Check, AlertCircle, Loader2, Info, BookOpen, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import api from '@/lib/api-client'

export default function ActivateAccount({ onActivationSuccess }: { onActivationSuccess: () => void }) {
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isDecoding, setIsDecoding] = useState(true)
  const [supportEmail, setSupportEmail] = useState('soporte@didactico.edu')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  
  // zxcvbn password strength meter
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: '', warning: '' })

  useEffect(() => {
    // 1. Extract token from URL
    const params = new URLSearchParams(window.location.search)
    const tokenParam = params.get('token')
    if (tokenParam) {
      setToken(tokenParam)
    } else {
      setErrorMsg('No se encontró un token de activación en el enlace. Por favor compruebe el correo recibido.')
    }
    setIsDecoding(false)

    // 2. Fetch support email from public endpoint or backend
    const fetchSupportInfo = async () => {
      try {
        // Fetch public profile config or public settings if needed, or fallback to default
        const res = await api.get('/users/me/profile-config')
        if (res.data?.support_email) {
          setSupportEmail(res.data.support_email)
        }
      } catch (err) {
        // user is not logged in, ignore and use default
      }
    }
    fetchSupportInfo()
  }, [])

  // Real-time strength estimation
  useEffect(() => {
    if (!password) {
      setPasswordStrength({ score: 0, feedback: '', warning: '' })
      return
    }

    import('zxcvbn').then((zxcvbnModule) => {
      const evaluation = zxcvbnModule.default(password)
      const suggestions = evaluation.feedback.suggestions.join(', ')
      setPasswordStrength({
        score: evaluation.score,
        feedback: suggestions || 'Contraseña robusta',
        warning: evaluation.feedback.warning || ''
      })
    })
  }, [password])

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      setErrorMsg('Falta el token de activación.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.')
      return
    }

    if (passwordStrength.score < 3) {
      setErrorMsg('La contraseña no cumple con la robustez requerida (debe ser nivel 3 o superior).')
      return
    }

    setIsLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const response = await api.post('/activate', {
        token: token,
        password: password
      })

      setSuccessMsg(response.data?.detail || '¡Su cuenta ha sido activada con éxito!')
      
      // Redirect back to login after 3.5 seconds
      setTimeout(() => {
        onActivationSuccess()
      }, 3500)
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Error al activar la cuenta. El enlace podría haber expirado o ser inválido.')
    } finally {
      setIsLoading(false)
    }
  }

  const strengthColors = ['bg-rose-500', 'bg-orange-500', 'bg-amber-400', 'bg-sky-500', 'bg-emerald-500']
  const strengthLabels = ['Muy Débil', 'Débil', 'Aceptable', 'Segura', 'Excelente']

  if (isDecoding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-primary" size={32} />
          <span className="text-slate-400 font-semibold">Cargando verificación de invitación...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-6 relative overflow-hidden">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl -z-10" />

      {/* Main Container */}
      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="flex items-center gap-3 mb-2 animate-fade-in">
            <BookOpen size={40} className="text-primary animate-pulse" strokeWidth={2.5} />
            <span className="text-3xl font-black tracking-tight text-white">DIDACTICO</span>
          </div>
          <p className="text-slate-400 text-sm font-semibold tracking-wide">
            SISTEMA DE PLANIFICACIÓN ACADÉMICA
          </p>
        </div>

        <Card className="backdrop-blur-md bg-slate-900/60 border-slate-800 text-slate-100 shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <ShieldCheck className="text-primary" size={24} />
              Activar Cuenta Docente
            </CardTitle>
            <CardDescription className="text-slate-400 font-medium">
              Establezca su contraseña segura para comenzar a planificar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorMsg && (
              <div className="mb-6 p-4 rounded-xl flex items-start gap-3 bg-rose-950/30 border border-rose-900 text-rose-300 text-sm leading-relaxed font-semibold">
                <AlertCircle className="shrink-0 mt-0.5" size={16} />
                <div className="space-y-1.5">
                  <p>{errorMsg}</p>
                  <p className="text-xs text-rose-400/90 font-medium">
                    Si necesita ayuda, envíe un correo a: <span className="underline">{supportEmail}</span>
                  </p>
                </div>
              </div>
            )}

            {successMsg ? (
              <div className="py-6 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto animate-bounce">
                  <Check size={32} strokeWidth={3} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-emerald-400">{successMsg}</h3>
                  <p className="text-slate-400 text-sm mt-2 font-medium">
                    Redirigiendo a la pantalla de inicio de sesión seguro...
                  </p>
                </div>
                <Loader2 className="animate-spin text-primary mx-auto mt-4" size={24} />
              </div>
            ) : (
              <form onSubmit={handleActivate} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="font-bold text-slate-300">
                    Nueva Contraseña
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type="password"
                      placeholder="Ingrese contraseña fuerte"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading || !token}
                      className="bg-slate-950/80 border-slate-800 text-slate-100 font-mono pr-10 focus-visible:ring-primary focus-visible:border-primary"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                      <Lock size={16} />
                    </div>
                  </div>

                  {/* Password Strength Meter */}
                  {password && (
                    <div className="space-y-2 mt-2.5 p-3 bg-slate-950/50 rounded-xl border border-slate-800 text-xs">
                      <div className="flex justify-between items-center font-bold">
                        <span>Fortaleza de clave:</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black text-white ${
                            strengthColors[passwordStrength.score]
                          }`}
                        >
                          {strengthLabels[passwordStrength.score]}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex gap-0.5">
                        {[0, 1, 2, 3].map((val) => (
                          <div
                            key={val}
                            className={`h-full flex-1 transition-all duration-300 ${
                              passwordStrength.score > val
                                ? strengthColors[passwordStrength.score]
                                : 'bg-slate-800'
                            }`}
                          />
                        ))}
                      </div>

                      {/* Warnings and suggestions */}
                      {passwordStrength.warning && (
                        <p className="text-rose-400 font-semibold flex items-center gap-1 text-[11px]">
                          <AlertCircle size={10} className="shrink-0" />
                          {passwordStrength.warning}
                        </p>
                      )}
                      {passwordStrength.feedback && (
                        <p className="text-slate-400 leading-normal flex items-start gap-1 font-medium text-[11px]">
                          <Info size={11} className="mt-0.5 shrink-0 text-slate-500" />
                          <span>{passwordStrength.feedback}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="font-bold text-slate-300">
                    Confirmar Contraseña
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Repita la contraseña"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading || !token}
                      className="bg-slate-950/80 border-slate-800 text-slate-100 font-mono pr-10 focus-visible:ring-primary focus-visible:border-primary"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                      <Lock size={16} />
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !token || passwordStrength.score < 3}
                  className="w-full font-black h-12 text-base shadow-lg shadow-primary/20"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin mr-2" size={18} />
                      Activando cuenta...
                    </>
                  ) : (
                    'Activar Cuenta'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
