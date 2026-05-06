import { useState } from 'react'
import { Eye, EyeOff, BookOpen, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Login({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const formData = new URLSearchParams()
      formData.append('username', email)
      formData.append('password', password)

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8001'}/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData,
        }
      )

      if (!response.ok) {
        let errorMsg = 'Authentication failed'
        try {
          const errorData = await response.json()
          errorMsg = errorData.detail || errorMsg
        } catch {
          errorMsg = response.statusText || errorMsg
        }
        throw new Error(errorMsg)
      }

      const data = await response.json()
      localStorage.setItem('token', data.access_token)
      onLoginSuccess()
    } catch (err: any) {
      setError(
        err.message === 'Failed to fetch'
          ? 'Cannot reach server. Please check if Docker is running.'
          : err.message
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background transition-colors duration-500">
      {/* Left Side - Hero */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-primary/5 border-r border-border relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-3 text-primary">
          <BookOpen size={40} strokeWidth={2.5} />
          <span className="text-3xl font-bold tracking-tight">DIDACTICO</span>
        </div>

        <div className="relative z-10 space-y-6 max-w-lg">
          <h2 className="text-5xl font-extrabold leading-tight text-foreground tracking-tighter">
            Plataforma Avanzada de{' '}
            <span className="text-primary">Planificacion Didactica</span>
          </h2>
          <p className="text-xl text-muted-foreground font-medium leading-relaxed">
            Una herramienta institucional disenada para la excelencia academica,
            facilitando la gestion de objetivos y estrategias educativas.
          </p>
        </div>

        <div className="relative z-10 text-sm text-muted-foreground font-medium">
          (c) 2026 Maestria en Informatica - Argenis Gil
        </div>

        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/4 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-2xl" />
      </div>

      {/* Right Side - Login Form */}
      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-[420px] border-0 shadow-none">
          <CardHeader className="space-y-1 text-center lg:text-left">
            <div className="lg:hidden flex items-center justify-center gap-3 text-primary mb-4">
              <BookOpen size={32} strokeWidth={2.5} />
              <span className="text-2xl font-bold tracking-tight">DIDACTICO</span>
            </div>
            <CardTitle className="text-4xl font-extrabold tracking-tighter">
              Iniciar Sesion
            </CardTitle>
            <CardDescription className="text-lg">
              Bienvenido, identifiquese para gestionar sus planes.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-start gap-3">
                <AlertCircle className="shrink-0 mt-0.5" size={20} />
                <p className="text-sm font-semibold">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-bold uppercase tracking-wide">
                  Correo Institucional
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <Input
                    id="email"
                    type="email"
                    className="pl-10 h-12 text-base"
                    placeholder="usuario@universidad.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-bold uppercase tracking-wide">
                    Contrasena
                  </Label>
                  <a href="#" className="text-sm font-bold text-primary hover:underline">
                    Olvido su contrasena?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="pl-10 pr-12 h-12 text-base"
                    placeholder="........"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full h-14 text-lg font-extrabold"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={24} />
                ) : (
                  'Acceder al Sistema'
                )}
              </Button>
            </form>

            <div className="pt-4 border-t text-center">
              <p className="text-muted-foreground font-medium">
                No tiene cuenta?{' '}
                <a href="#" className="text-primary font-bold hover:underline">
                  Solicite acceso al administrador
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
