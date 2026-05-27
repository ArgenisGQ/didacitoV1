import { useState, useEffect } from 'react';
import { Eye, EyeOff, BookOpen, Mail, Lock, AlertCircle, Loader2, ShieldCheck, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import api, { setAccessToken } from '@/lib/api-client';

interface LoginProps {
  onLoginSuccess: (token: string) => void;
  onForgotPassword: () => void;
}

export default function Login({ onLoginSuccess, onForgotPassword }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // MFA Flow States
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  // Lockout countdown states
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState<number | null>(null);

  // Mandatory password change states
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [tempPasswordToken, setTempPasswordToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<any>(null);

  // Lockout countdown timer effect
  useEffect(() => {
    if (lockoutTimeLeft === null) return;
    if (lockoutTimeLeft <= 0) {
      setLockoutTimeLeft(null);
      setError('');
      return;
    }

    const interval = setInterval(() => {
      setLockoutTimeLeft((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutTimeLeft]);

  // Handle password strength calculation dynamically
  useEffect(() => {
    if (!newPassword) {
      setPasswordStrength(null);
      return;
    }
    import('zxcvbn').then((zxcvbnModule) => {
      const evaluation = zxcvbnModule.default ? zxcvbnModule.default(newPassword) : (zxcvbnModule as any)(newPassword);
      setPasswordStrength(evaluation);
    });
  }, [newPassword]);

  const getStrengthLabel = (score: number) => {
    switch (score) {
      case 0: return { label: 'Muy débil', color: 'text-red-500 bg-red-500/10 border-red-500/20' };
      case 1: return { label: 'Débil', color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' };
      case 2: return { label: 'Regular', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' };
      case 3: return { label: 'Fuerte', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' };
      case 4: return { label: 'Excelente', color: 'text-green-500 bg-green-500/10 border-green-500/20' };
      default: return { label: 'Desconocido', color: 'text-slate-500 bg-slate-500/10 border-slate-500/20' };
    }
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    
    const minScore = 3; // Institutional requirement
    if (passwordStrength && passwordStrength.score < minScore) {
      setError('La contraseña no es lo suficientemente fuerte. Elija una contraseña más segura.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/first-login-change-password', {
        temp_token: tempPasswordToken,
        new_password: newPassword,
      });

      const data = response.data;
      
      // Successfully changed! Automatically log the user in
      setAccessToken(data.access_token);
      onLoginSuccess(data.access_token);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        'No se pudo cambiar la contraseña. Intente de nuevo.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrimarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTimeLeft !== null) return;

    setIsLoading(true);
    setError('');

    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await api.post('/token', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const data = response.data;

      if (data.mfa_required) {
        setMfaToken(data.mfa_token);
        setMfaRequired(true);
        setIsLoading(false);
        return;
      }

      if (data.needs_password_change) {
        setTempPasswordToken(data.temp_token);
        setPasswordChangeRequired(true);
        setIsLoading(false);
        return;
      }

      setAccessToken(data.access_token);
      onLoginSuccess(data.access_token);
    } catch (err: any) {
      if (err.response?.status === 423) {
        // Parse locked seconds from message (e.g. "... 840 segundos.")
        const detailMsg = err.response.data.detail || '';
        const match = detailMsg.match(/\b(\d+)\b/);
        const seconds = match ? parseInt(match[1], 10) : 900;
        setLockoutTimeLeft(seconds);
        setError(detailMsg);
      } else {
        setError(
          err.response?.data?.detail || 
          'Credenciales incorrectas o servidor inaccesible. Verifique.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/token/mfa', {
        mfa_token: mfaToken,
        code: mfaCode,
      });

      const data = response.data;
      setAccessToken(data.access_token);
      onLoginSuccess(data.access_token);
    } catch (err: any) {
      if (err.response?.status === 423) {
        const detailMsg = err.response.data.detail || '';
        const match = detailMsg.match(/\b(\d+)\b/);
        const seconds = match ? parseInt(match[1], 10) : 900;
        setLockoutTimeLeft(seconds);
        setMfaRequired(false);
        setError(detailMsg);
      } else {
        setError(
          err.response?.data?.detail || 
          'Código de verificación incorrecto.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-950 text-slate-100 transition-colors duration-500 relative overflow-hidden">
      {/* Background radial effects */}
      <div className="absolute top-0 -left-4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      {/* Left Side - Hero */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-slate-900/40 border-r border-slate-800 relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-3 text-primary">
          <BookOpen size={40} strokeWidth={2.5} className="text-primary animate-pulse" />
          <span className="text-3xl font-extrabold tracking-tight text-white">DIDACTICO</span>
        </div>

        <div className="relative z-10 space-y-6 max-w-lg">
          <h2 className="text-5xl font-extrabold leading-tight text-white tracking-tighter">
            Plataforma Avanzada de{' '}
            <span className="text-primary block mt-2">Planificación Didáctica</span>
          </h2>
          <p className="text-lg text-slate-400 font-medium leading-relaxed">
            Una herramienta institucional de última generación diseñada para la excelencia académica, 
            facilitando la gestión de objetivos de aprendizaje, estrategias y planes de clase.
          </p>
        </div>

        <div className="relative z-10 text-sm text-slate-500 font-medium">
          (c) 2026 Maestría en Informática - Argenis Gil
        </div>
      </div>

      {/* Right Side - Forms */}
      <div className="flex items-center justify-center p-8 relative z-10">
        <Card className="w-full max-w-[420px] border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl text-slate-100">
          <CardHeader className="space-y-1 text-center lg:text-left">
            <div className="lg:hidden flex items-center justify-center gap-3 text-primary mb-4">
              <BookOpen size={32} strokeWidth={2.5} />
              <span className="text-2xl font-bold tracking-tight text-white">DIDACTICO</span>
            </div>
            
            <CardTitle className="text-4xl font-extrabold tracking-tight text-white">
              {mfaRequired 
                ? 'Código de Seguridad' 
                : passwordChangeRequired 
                ? 'Nueva Contraseña' 
                : 'Iniciar Sesión'}
            </CardTitle>
            <CardDescription className="text-slate-400 text-base">
              {mfaRequired 
                ? 'Su cuenta está protegida con MFA. Ingrese el código de su aplicación móvil.'
                : passwordChangeRequired
                ? 'Su cuenta ha sido importada por primera vez. Por seguridad institucional, debe establecer una contraseña personal y segura.'
                : 'Bienvenido, identifíquese para gestionar sus planes de clase.'
              }
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Error alerts including lockout */}
            {error && (
              <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all duration-300 ${
                lockoutTimeLeft !== null
                  ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                <AlertCircle className="shrink-0 mt-0.5" size={20} />
                <div className="space-y-1">
                  <p className="text-sm font-bold">
                    {lockoutTimeLeft !== null ? 'Acceso Suspendido Temporalmente' : 'Error de Autenticación'}
                  </p>
                  <p className="text-xs font-semibold leading-relaxed">
                    {lockoutTimeLeft !== null
                      ? `Demasiados intentos fallidos. Su cuenta se encuentra bloqueada por seguridad. Espere ${formatTime(lockoutTimeLeft)} minutos.`
                      : error
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Password Change Flow */}
            {passwordChangeRequired ? (
              <form onSubmit={handlePasswordChangeSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Nueva Contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <Input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      className="pl-10 pr-12 h-12 bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 text-base"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmNewPassword" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Confirmar Contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <Input
                      id="confirmNewPassword"
                      type={showPassword ? 'text' : 'password'}
                      className="pl-10 h-12 bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 text-base"
                      placeholder="••••••••"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Password Strength Indicator */}
                {passwordStrength && (
                  <div className="space-y-2 p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-400">Fortaleza:</span>
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold uppercase tracking-wider ${getStrengthLabel(passwordStrength.score).color}`}>
                        {getStrengthLabel(passwordStrength.score).label}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {[0, 1, 2, 3].map((step) => {
                        let barColor = 'bg-slate-800';
                        if (passwordStrength.score > step) {
                          if (passwordStrength.score === 1) barColor = 'bg-red-500';
                          else if (passwordStrength.score === 2) barColor = 'bg-orange-500';
                          else if (passwordStrength.score === 3) barColor = 'bg-blue-500';
                          else if (passwordStrength.score === 4) barColor = 'bg-green-500';
                        }
                        return (
                          <div key={step} className={`h-1.5 rounded-full transition-colors duration-500 ${barColor}`} />
                        );
                      })}
                    </div>
                    {passwordStrength.feedback && (passwordStrength.feedback.warning || passwordStrength.feedback.suggestions?.length > 0) && (
                      <div className="text-[11px] leading-relaxed text-slate-400 pt-2 font-medium">
                        {passwordStrength.feedback.warning && (
                          <p className="text-red-400/90 font-bold">⚠ {passwordStrength.feedback.warning}</p>
                        )}
                        {passwordStrength.feedback.suggestions?.map((sug: string, idx: number) => (
                          <p key={idx} className="text-slate-400/80">• {sug}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full h-12 text-base font-extrabold bg-primary hover:bg-primary/90 text-white shadow-lg transition-transform duration-200 transform hover:scale-[1.01]"
                    disabled={isLoading || !newPassword || newPassword !== confirmNewPassword || (passwordStrength && passwordStrength.score < 3)}
                  >
                    {isLoading ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      'Establecer y Acceder'
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full h-12 font-bold text-slate-400 hover:text-white"
                    onClick={() => {
                      setPasswordChangeRequired(false);
                      setNewPassword('');
                      setConfirmNewPassword('');
                      setError('');
                    }}
                  >
                    Volver a credenciales
                  </Button>
                </div>
              </form>
            ) : mfaRequired ? (
              <form onSubmit={handleMfaSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="mfaCode" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Código de Verificación TOTP (6 dígitos)
                  </Label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <Input
                      id="mfaCode"
                      type="text"
                      pattern="[0-9]{6}"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      autoFocus
                      className="pl-10 h-12 bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 text-center text-xl font-bold tracking-[0.75em]"
                      placeholder="000000"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full h-12 text-base font-extrabold bg-primary hover:bg-primary/90 text-white shadow-lg transition-transform duration-200 transform hover:scale-[1.01]"
                    disabled={isLoading || mfaCode.length !== 6}
                  >
                    {isLoading ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      'Confirmar Código'
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full h-12 font-bold text-slate-400 hover:text-white"
                    onClick={() => {
                      setMfaRequired(false);
                      setMfaCode('');
                      setError('');
                    }}
                  >
                    Volver a credenciales
                  </Button>
                </div>
              </form>
            ) : (
              /* Standard login flow */
              <form onSubmit={handlePrimarySubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Correo Institucional
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <Input
                      id="email"
                      type="email"
                      className="pl-10 h-12 bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 text-base"
                      placeholder="usuario@universidad.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={lockoutTimeLeft !== null || isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Contraseña
                    </Label>
                    <button
                      type="button"
                      onClick={onForgotPassword}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      ¿Olvidó su contraseña?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className="pl-10 pr-12 h-12 bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 text-base"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={lockoutTimeLeft !== null || isLoading}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={lockoutTimeLeft !== null || isLoading}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-14 text-lg font-extrabold bg-primary hover:bg-primary/95 text-white shadow-xl transition-all duration-300 transform hover:scale-[1.01]"
                  disabled={lockoutTimeLeft !== null || isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin" size={24} />
                  ) : (
                    'Acceder al Sistema'
                  )}
                </Button>
              </form>
            )}

            <div className="pt-4 border-t border-slate-800 text-center">
              <p className="text-slate-400 text-sm font-medium flex items-center justify-center gap-1.5">
                <HelpCircle size={15} className="text-slate-500" />
                ¿No tiene cuenta?{' '}
                <span className="text-primary font-bold">Solicite acceso formal.</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
