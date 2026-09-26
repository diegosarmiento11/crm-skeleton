import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Inicio de sesión de DESARROLLO: el servidor (AUTH_ENABLED=false) confía en el
 * correo. Con un proveedor real, esta pantalla se reemplaza por el botón del
 * proveedor y `session.token` recibe su token; nada más del cliente cambia.
 */
export function LoginPage() {
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/crm/pipeline';

  if (isAuthenticated) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await signIn(email);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm rounded-2xl">
        <CardHeader>
          <CardTitle>Entrar al CRM</CardTitle>
          <CardDescription>
            Modo desarrollo: escribe el correo de un miembro del equipo (p. ej. <code>gerente@example.com</code>).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs">
                Correo
              </Label>
              <Input
                id="email"
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy || isLoading || !email.trim()}>
              {busy || isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
