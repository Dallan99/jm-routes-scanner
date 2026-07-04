import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { JmLogo } from "@/components/jm-logo";
import { toast } from "sonner";
import { Loader2, Truck, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — JM Transportes" },
      { name: "description", content: "Acesso ao sistema de recebimento de rotas." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  // Se já logado, manda para /recebimento
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/recebimento", replace: true });
    });
  }, [navigate]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo!");
    navigate({ to: "/recebimento", replace: true });
  }

  async function enviarResetSenha(e: React.FormEvent) {
    e.preventDefault();
    const emailNorm = forgotEmail.trim().toLowerCase();
    if (!emailNorm.endsWith("@jmdistribuicao.com.br")) {
      return toast.error("Apenas emails @jmdistribuicao.com.br podem redefinir a senha.");
    }
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(emailNorm, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Enviamos um link de redefinição para seu email.");
    setForgotOpen(false);
    setForgotEmail("");
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 brand-gradient">
      {/* Coluna esquerda — branding */}
      <div className="hidden lg:flex flex-col justify-between p-12 text-white">
        <JmLogo size={56} />
        <div>
          <h1 className="font-display text-5xl font-bold leading-tight">
            Recebimento<br />de Rotas
          </h1>
          <p className="mt-4 text-white/70 max-w-md">
            Bipagem, controle de volumes e dashboard em tempo real para a operação Last Mile da JM Transportes.
          </p>
          <div className="mt-10 flex items-center gap-3 text-sm text-white/60">
            <Truck className="w-4 h-4 text-[var(--brand-yellow)]" />
            Compatível com leitores Zebra, Honeywell e Datalogic
          </div>
        </div>
        <p className="text-xs text-white/40">© JM Transportes · Last Mile Operations</p>
      </div>

      {/* Coluna direita — form */}
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-6 shadow-2xl border-0">
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <JmLogo size={40} />
            <div>
              <div className="font-display font-bold text-lg">JM Transportes</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Last Mile</div>
            </div>
          </div>
          <div>
            <div className="mb-4">
              <h2 className="font-display text-2xl font-bold">Entrar</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Acesso restrito. Solicite credenciais ao administrador.
              </p>
            </div>
            <form onSubmit={entrar} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="operador@jmtransportes.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senha">Senha</Label>
                  <div className="relative">
                    <Input
                      id="senha"
                      type={showSenha ? "text" : "password"}
                      required
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenha((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                      aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
                      tabIndex={-1}
                    >
                      {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
                      <DialogTrigger asChild>
                        <button type="button" className="text-xs text-primary hover:underline">
                          Esqueci minha senha
                        </button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Redefinir senha</DialogTitle>
                          <DialogDescription>
                            Informe seu email e enviaremos um link para você criar uma nova senha.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={enviarResetSenha} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="forgot-email">Email</Label>
                            <Input
                              id="forgot-email"
                              type="email"
                              required
                              value={forgotEmail}
                              onChange={(e) => setForgotEmail(e.target.value)}
                              placeholder="voce@jmtransportes.com"
                            />
                          </div>
                          <DialogFooter>
                            <Button type="submit" disabled={forgotLoading} className="w-full">
                              {forgotLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                              Enviar link de redefinição
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Entrar
                </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}