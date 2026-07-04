import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { PackageSearch } from "lucide-react";

export const Route = createFileRoute("/_authenticated/triagem")({
  head: () => ({ meta: [{ title: "Triagem — JM Transportes" }] }),
  component: TriagemPage,
});

function TriagemPage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Triagem</h1>
        <p className="text-sm text-muted-foreground">
          Separação e classificação de volumes por rota, base e modal.
        </p>
      </div>
      <Card className="p-10 flex flex-col items-center justify-center text-center gap-3 border-dashed">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <PackageSearch className="w-6 h-6 text-primary" />
        </div>
        <div className="space-y-1">
          <div className="font-medium">Módulo em construção</div>
          <p className="text-sm text-muted-foreground max-w-md">
            Em breve: leitura de volume, sugestão automática de rota, alertas de divergência
            e integração com o Recebimento.
          </p>
        </div>
      </Card>
    </div>
  );
}