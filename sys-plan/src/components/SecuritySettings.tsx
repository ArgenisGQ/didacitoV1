import { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Key, Clipboard, Check, QrCode, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/lib/api-client';

export default function SecuritySettings() {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  // Setup stepper states
  const [step, setStep] = useState(1);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setIsProfileLoading(true);
    setProfileError('');
    try {
      const response = await api.get('/users/me');
      setMfaEnabled(response.data.mfa_enabled);
    } catch (err: any) {
      setProfileError('No se pudo cargar la configuración de seguridad. Intente de nuevo.');
    } finally {
      setIsProfileLoading(false);
    }
  };

  const handleStartSetup = async () => {
    setIsLoading(true);
    setActionError('');
    try {
      const response = await api.post('/api/auth/mfa/setup');
      setQrCode(response.data.qr_code_base64);
      setSecret(response.data.secret);
      setStep(2);
    } catch (err: any) {
      setActionError('Error al iniciar la configuración de MFA. Reintente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerifyAndEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setActionError('');
    try {
      await api.post('/api/auth/mfa/verify-and-enable', { token: totpCode });
      setMfaEnabled(true);
      setStep(1); // Return to main tab showing active status
      setTotpCode('');
    } catch (err: any) {
      setActionError(err.response?.data?.detail || 'Código de verificación incorrecto.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!confirm('¿Está seguro de que desea desactivar el doble factor de autenticación? Esto reducirá la seguridad de su cuenta.')) {
      return;
    }

    setIsLoading(true);
    setActionError('');
    try {
      await api.post('/api/auth/mfa/disable');
      setMfaEnabled(false);
      setStep(1);
    } catch (err: any) {
      setActionError('Error al desactivar MFA. Reintente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isProfileLoading) {
    return (
      <div className="py-12 flex justify-center items-center">
        <Loader2 className="animate-spin text-primary" size={32} />
        <span className="ml-3 text-slate-400 font-medium">Cargando opciones de seguridad...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-black tracking-tighter">Seguridad de la Cuenta</h1>
        <p className="text-lg text-muted-foreground font-medium mt-2">
          Administre la autenticación multifactor (MFA/2FA) para proteger sus datos didácticos.
        </p>
      </div>

      {profileError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="shrink-0 mt-0.5" size={20} />
          <p className="text-sm font-semibold">{profileError}</p>
        </div>
      )}

      {actionError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="shrink-0 mt-0.5" size={20} />
          <p className="text-sm font-semibold">{actionError}</p>
        </div>
      )}

      {/* MFA Main Status Card */}
      {mfaEnabled ? (
        <Card className="border-emerald-500/20 bg-emerald-500/5 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-emerald-400">
              <Shield size={32} />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-white">Doble Factor Activo (MFA)</CardTitle>
              <CardDescription className="text-slate-400 text-base mt-1">
                Su cuenta se encuentra protegida con los más altos estándares de autenticación.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <p className="text-slate-300 text-sm leading-relaxed max-w-xl">
              Cada vez que inicie sesión con su usuario y contraseña, se le solicitará ingresar un código dinámico único generado por su aplicación de autenticación para validar su identidad.
            </p>
            <Button
              variant="destructive"
              size="lg"
              className="font-bold h-12 shadow-lg hover:shadow-red-500/10 shrink-0"
              onClick={handleDisableMfa}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Desactivar Protección'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Setup stepper cards when MFA is not active */
        <div className="space-y-6">
          {step === 1 && (
            <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-full border border-primary/20 text-primary">
                  <ShieldAlert size={32} />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold text-white">Autenticación de Doble Factor (MFA)</CardTitle>
                  <CardDescription className="text-slate-400 text-base mt-1">
                    Añada una capa adicional de protección a sus accesos didácticos.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-4 border-t border-slate-800 space-y-6">
                <p className="text-slate-300 text-sm leading-relaxed">
                  MFA / 2FA vincula su cuenta a un dispositivo móvil inteligente mediante un generador de tokens TOTP estándar. Al habilitarlo, prevendrá accesos no autorizados incluso si alguien descubre su contraseña.
                </p>
                <div className="flex justify-end">
                  <Button
                    size="lg"
                    className="font-extrabold h-12 px-8 shadow-lg hover:shadow-primary/10"
                    onClick={handleStartSetup}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Comenzar Configuración'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-white">Paso 1: Vincular Aplicación</CardTitle>
                <CardDescription className="text-slate-400 text-base">
                  Escanee el código QR desde su aplicación móvil de autenticación.
                </CardDescription>
              </CardHeader>
              <CardContent className="border-t border-slate-800 pt-6 space-y-6">
                <div className="flex flex-col md:flex-row items-center gap-8 justify-center">
                  {/* Glowing QR wrapper */}
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl shadow-xl flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-md -z-10" />
                    {qrCode ? (
                      <img src={qrCode} alt="TOTP QR Code" className="w-48 h-48 rounded-lg select-none" />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center text-slate-500">
                        <QrCode size={48} />
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 max-w-md">
                    <p className="text-slate-300 text-sm leading-relaxed">
                      1. Abra su aplicación de autenticación (como <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong>, o <strong>Authy</strong>).
                    </p>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      2. Escanee este código QR o ingrese manualmente la clave secreta provista a continuación.
                    </p>

                    <div className="space-y-2 pt-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Key size={14} className="text-primary" /> Clave Secreta (Configuración Manual)
                      </Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-3 bg-slate-950 border border-slate-800 rounded-xl text-center font-bold tracking-wider text-primary text-sm select-all">
                          {secret}
                        </code>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
                          onClick={handleCopySecret}
                        >
                          {copied ? <Check className="text-emerald-400" size={18} /> : <Clipboard size={18} />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                  <Button
                    variant="ghost"
                    onClick={() => setStep(1)}
                    className="font-bold text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => setStep(3)}
                    className="font-extrabold h-12 px-8"
                  >
                    Continuar al Siguiente Paso
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-white">Paso 2: Confirmar Activación</CardTitle>
                <CardDescription className="text-slate-400 text-base">
                  Valide que la vinculación es correcta ingresando el código TOTP actual.
                </CardDescription>
              </CardHeader>
              <CardContent className="border-t border-slate-800 pt-6">
                <form onSubmit={handleVerifyAndEnable} className="max-w-md mx-auto space-y-6">
                  <div className="space-y-2 text-center">
                    <Label htmlFor="setupTotp" className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                      Código generado de 6 dígitos
                    </Label>
                    <Input
                      id="setupTotp"
                      type="text"
                      pattern="[0-9]{6}"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      autoFocus
                      className="h-14 bg-slate-950 border-slate-800 text-white placeholder-slate-600 text-center text-2xl font-bold tracking-[0.75em]"
                      placeholder="000000"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    />
                  </div>

                  <div className="flex justify-between items-center pt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep(2)}
                      className="font-bold text-slate-400 hover:text-white"
                      disabled={isLoading}
                    >
                      Atrás
                    </Button>
                    <Button
                      type="submit"
                      size="lg"
                      className="font-extrabold h-12 px-8 shadow-lg hover:shadow-primary/10"
                      disabled={isLoading || totpCode.length !== 6}
                    >
                      {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Activar MFA'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
