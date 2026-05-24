import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Check, X, Loader2, AlertCircle, CheckCircle2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/lib/api-client';

interface ResetPasswordProps {
  onResetSuccess: () => void;
}

export default function ResetPassword({ onResetSuccess }: ResetPasswordProps) {
  const [token, setToken] = useState('');
  const [isValidating, setIsValidating] = useState(true);
  const [tokenError, setTokenError] = useState('');
  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Real-time password validation criteria
  const minLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const isFormValid = minLength && hasUpper && hasLower && hasNumber && hasSpecial && passwordsMatch;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') || '';
    setToken(t);

    if (!t) {
      setTokenError('Falta el token de recuperación en la URL. Solicite un nuevo enlace.');
      setIsValidating(false);
      return;
    }

    const validateToken = async () => {
      try {
        const response = await api.post('/auth/validate-reset-token', { token: t });
        setEmail(response.data.email);
      } catch (err: any) {
        setTokenError(
          err.response?.data?.detail || 
          'El token es inválido, ha expirado o ya fue utilizado.'
        );
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsLoading(true);
    setError('');

    try {
      await api.post('/auth/reset-password', {
        token,
        password,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        'No se pudo restablecer la contraseña. Intente nuevamente.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-primary mx-auto" size={40} />
          <p className="text-lg font-medium text-slate-400">Validando enlace de recuperación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100 relative overflow-hidden">
      <div className="absolute top-0 -left-4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      <Card className="w-full max-w-[460px] border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl relative z-10 text-slate-100">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center gap-3 text-primary mb-3">
            <BookOpen size={36} strokeWidth={2.5} />
            <span className="text-2xl font-bold tracking-tight text-white">DIDACTICO</span>
          </div>
          <CardTitle className="text-3xl font-extrabold tracking-tight text-white">
            Nueva Contraseña
          </CardTitle>
          <CardDescription className="text-slate-400 text-base">
            {tokenError 
              ? 'Error de Validación' 
              : success 
              ? 'Contraseña Restablecida' 
              : `Establezca su nueva clave para ${email}`
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {tokenError ? (
            <div className="space-y-6">
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3">
                <AlertCircle className="shrink-0 mt-0.5" size={20} />
                <p className="text-sm font-semibold">{tokenError}</p>
              </div>
              <Button
                onClick={onResetSuccess}
                className="w-full h-12 font-extrabold bg-slate-800 hover:bg-slate-700 text-white"
              >
                Volver al Login
              </Button>
            </div>
          ) : success ? (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="p-3 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-emerald-400 animate-bounce">
                  <CheckCircle2 size={48} />
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-emerald-400 font-bold text-lg">¡Contraseña Cambiada!</p>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Su credencial ha sido actualizada y la cuenta ha sido desbloqueada. Ya puede iniciar sesión.
                </p>
              </div>

              <Button
                onClick={onResetSuccess}
                size="lg"
                className="w-full h-12 text-base font-extrabold bg-primary hover:bg-primary/95 text-white"
              >
                Acceder Ahora
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3">
                  <AlertCircle className="shrink-0 mt-0.5" size={20} />
                  <p className="text-sm font-semibold">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pass" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Nueva Contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <Input
                      id="pass"
                      type={showPassword ? 'text' : 'password'}
                      required
                      className="pl-10 pr-12 h-12 bg-slate-800/50 border-slate-700 text-white focus:ring-primary text-base"
                      placeholder="Mínimo 8 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Confirmar Contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <Input
                      id="confirm"
                      type={showPassword ? 'text' : 'password'}
                      required
                      className="pl-10 h-12 bg-slate-800/50 border-slate-700 text-white focus:ring-primary text-base"
                      placeholder="Repita la contraseña"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Password strength checklist */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5 text-xs text-slate-400">
                <p className="font-bold text-slate-300 mb-1.5">Requisitos mínimos de seguridad:</p>
                <div className="flex items-center gap-2">
                  {minLength ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-slate-600" />}
                  <span className={minLength ? 'text-slate-300' : ''}>Al menos 8 caracteres ({password.length}/8)</span>
                </div>
                <div className="flex items-center gap-2">
                  {hasUpper && hasLower ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-slate-600" />}
                  <span className={hasUpper && hasLower ? 'text-slate-300' : ''}>Mayúsculas y minúsculas</span>
                </div>
                <div className="flex items-center gap-2">
                  {hasNumber ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-slate-600" />}
                  <span className={hasNumber ? 'text-slate-300' : ''}>Al menos un número (0-9)</span>
                </div>
                <div className="flex items-center gap-2">
                  {hasSpecial ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-slate-600" />}
                  <span className={hasSpecial ? 'text-slate-300' : ''}>Un carácter especial (!@#$...)</span>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                  {passwordsMatch ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-slate-600" />}
                  <span className={passwordsMatch ? 'text-emerald-400 font-semibold' : ''}>Las contraseñas coinciden</span>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full h-12 text-base font-extrabold bg-primary hover:bg-primary/95 text-white shadow-lg transition-all duration-300 transform hover:scale-[1.01]"
                disabled={isLoading || !isFormValid}
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  'Restablecer Contraseña'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
