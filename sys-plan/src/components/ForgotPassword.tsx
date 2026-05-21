import { useState } from 'react';
import { Mail, ArrowLeft, CheckCircle2, Loader2, AlertCircle, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/lib/api-client';

interface ForgotPasswordProps {
  onBackToLogin: () => void;
}

export default function ForgotPassword({ onBackToLogin }: ForgotPasswordProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await api.post('/api/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        'No se pudo conectar con el servidor. Intente nuevamente.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 -left-4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      <Card className="w-full max-w-[440px] border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl relative z-10 text-slate-100">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center gap-3 text-primary mb-3">
            <BookOpen size={36} strokeWidth={2.5} className="animate-pulse" />
            <span className="text-2xl font-bold tracking-tight text-white">DIDACTICO</span>
          </div>
          <CardTitle className="text-3xl font-extrabold tracking-tight text-white">
            Recuperar Acceso
          </CardTitle>
          <CardDescription className="text-slate-400 text-base">
            {!success 
              ? 'Ingrese su correo institucional para recibir un enlace de restablecimiento.'
              : 'Verificación enviada exitosamente.'
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="shrink-0 mt-0.5" size={20} />
              <p className="text-sm font-semibold">{error}</p>
            </div>
          )}

          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Correo Electrónico
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <Input
                    id="email"
                    type="email"
                    required
                    className="pl-10 h-12 bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 focus:ring-primary focus:border-primary text-base"
                    placeholder="correo@universidad.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full h-12 text-base font-extrabold bg-primary hover:bg-primary/95 text-white shadow-lg transition-all duration-300 transform hover:scale-[1.01]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  'Enviar Enlace'
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="p-3 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-emerald-400 animate-bounce">
                  <CheckCircle2 size={48} />
                </div>
              </div>
              
              <div className="space-y-3">
                <p className="text-emerald-400 font-bold text-lg">¡Solicitud Procesada!</p>
                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 text-left text-sm text-slate-300 space-y-2 leading-relaxed">
                  <p>
                    🔒 En producción se enviará un enlace seguro a su casilla de correo.
                  </p>
                  <p className="font-semibold text-primary">
                    💡 Entorno Local (Docker): Copie el enlace de recuperación impreso directamente en la consola / logs del contenedor de FastAPI para continuar con el restablecimiento de su clave.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-800 text-center">
            <button
              onClick={onBackToLogin}
              className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} />
              Volver al inicio de sesión
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
