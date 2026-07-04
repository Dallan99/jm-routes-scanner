import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — JM Transportes" }] }),
  component: AuditoriaPage,
});

function AuditoriaPage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Auditoria</h1>
        <p className="text-sm text-muted-foreground">
          Rastreamento completo de eventos: acessos, alterações e operações críticas.
        </p>
      </div>
      <Card className="p-10 flex flex-col items-center justify-center text-center gap-3 border-dashed">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-primary" />
        </div>
        <div className="space-y-1">
          <div className="font-medium">Módulo em construção</div>
          <p className="text-sm text-muted-foreground max-w-md">
            Em breve: consulta de logs por usuário, base e período, com exportação e
            filtros avançados.
          </p>
        </div>
      </Card>
    </div>
  );
}