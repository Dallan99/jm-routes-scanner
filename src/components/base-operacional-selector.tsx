import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { listarBasesSimples, listarDiasOperacionais } from "@/lib/bases.functions";
import { useBaseOperacional, type BaseSelecionada } from "@/lib/base-operacional-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, CalendarDays, CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * Guarda uma tela dependente da Base Operacional. Se o usuário ainda não escolheu
 * Base + Dia, mostra a tela de seleção; caso contrário renderiza `children`.
 */
export function RequireBaseOperacional({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  const { base, diaOperacional } = useBaseOperacional();
  if (!base || !diaOperacional) {
    return <SeletorBaseDia titulo={titulo} descricao={descricao} />;
  }
  return <>{children}</>;
}

export function SeletorBaseDia({
  titulo,
  descricao,
  onSelecionar,
}: {
  titulo: string;
  descricao?: string;
  onSelecionar?: () => void;
}) {
  const { setSelecao } = useBaseOperacional();
  const listar = useServerFn(listarBasesSimples);
  const q = useQuery({ queryKey: ["bases-simples"], queryFn: () => listar() });
  const bases = q.data ?? [];

  const [baseId, setBaseId] = useState<string>("");
  const [dia, setDia] = useState<string>(new Date().toISOString().slice(0, 10));
  const baseUnica = bases.length === 1;
  const autoConfirmadaRef = useRef(false);

  // Auto-seleciona quando o usuário só tem 1 base permitida
  useEffect(() => {
    if (baseUnica && !baseId) setBaseId(bases[0].id);
  }, [baseUnica, baseId, bases]);

  const listarDias = useServerFn(listarDiasOperacionais);
  const diasQuery = useQuery({
    queryKey: ["dias-operacionais", baseId],
    queryFn: () => listarDias({ data: { baseId } }),
    enabled: !!baseId,
  });

  const baseSelecionada = useMemo(
    () => bases.find((b) => b.id === baseId) ?? null,
    [bases, baseId],
  );

  const diasComVersaoAtiva = diasQuery.data ?? [];
  const temAtivaNaData = diasComVersaoAtiva.some(
    (d) => d.data_operacional === dia && d.versao_ativa != null,
  );

  const confirmar = () => {
    if (!baseSelecionada || !dia) return;
    setSelecao(
      {
        id: baseSelecionada.id,
        codigo: baseSelecionada.codigo,
        nome: baseSelecionada.nome,
        cidade: baseSelecionada.cidade,
      } as BaseSelecionada,
      dia,
    );
    onSelecionar?.();
  };

  // Se só há 1 base permitida, entra direto na operação com o dia de hoje
  useEffect(() => {
    if (!baseUnica || autoConfirmadaRef.current) return;
    if (!baseSelecionada || !dia) return;
    autoConfirmadaRef.current = true;
    setSelecao(
      {
        id: baseSelecionada.id,
        codigo: baseSelecionada.codigo,
        nome: baseSelecionada.nome,
        cidade: baseSelecionada.cidade,
      } as BaseSelecionada,
      dia,
    );
    onSelecionar?.();
  }, [baseUnica, baseSelecionada, dia, setSelecao, onSelecionar]);

  if (baseUnica && bases.length > 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Entrando na operação da base <b className="font-mono">{bases[0].codigo}</b>…
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <Card className="p-6 md:p-8 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-md brand-gradient flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[var(--brand-yellow)]" />
            </div>
            <h1 className="font-display text-2xl font-bold">{titulo}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {descricao ??
              "Selecione a Base Operacional e o Dia Operacional para começar. Toda operação ficará vinculada a esta seleção."}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Base</Label>
            <Select value={baseId} onValueChange={setBaseId}>
              <SelectTrigger>
                <SelectValue placeholder={q.isLoading ? "Carregando…" : "Selecione a Base"} />
              </SelectTrigger>
              <SelectContent>
                {bases.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    <span className="font-mono mr-2">{b.codigo}</span>
                    {b.nome} {b.cidade ? `· ${b.cidade}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dia-op">Dia Operacional</Label>
            <Input
              id="dia-op"
              type="date"
              value={dia}
              onChange={(e) => setDia(e.target.value)}
            />
          </div>
        </div>

        {baseId && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5" /> Dias já importados nesta Base
            </div>
            {diasQuery.isLoading ? (
              <div className="text-muted-foreground">Carregando…</div>
            ) : diasComVersaoAtiva.length === 0 ? (
              <div className="text-muted-foreground">Nenhuma importação registrada.</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {diasComVersaoAtiva.slice(0, 12).map((d) => (
                  <button
                    key={d.data_operacional}
                    onClick={() => setDia(d.data_operacional)}
                    className={`px-2 py-0.5 rounded border text-[11px] font-mono transition ${
                      d.data_operacional === dia
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    {new Date(d.data_operacional + "T00:00:00").toLocaleDateString("pt-BR")}
                    {d.versoes > 1 && (
                      <span className="ml-1 opacity-70">v{d.versao_ativa}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {baseId && dia && (
              <div className="pt-1">
                {temAtivaNaData ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Existe Base Operacional ativa para este dia.
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Ainda não existe importação para este dia. Você poderá operar assim mesmo,
                    mas os dados de escala não estarão disponíveis.
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button disabled={!baseId || !dia} onClick={confirmar}>
            Entrar na operação
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function BaseOperacionalChip({ onTrocar }: { onTrocar: () => void }) {
  const { base, diaOperacional } = useBaseOperacional();
  if (!base || !diaOperacional) return null;
  return (
    <button
      onClick={onTrocar}
      className="flex items-center gap-2 rounded-md border bg-card hover:bg-muted/50 transition px-2.5 py-1 text-xs"
      title="Trocar Base / Dia Operacional"
    >
      <Building2 className="w-3.5 h-3.5 text-[var(--brand-yellow)]" />
      <Badge variant="outline" className="font-mono">{base.codigo}</Badge>
      <span className="hidden md:inline font-medium">{base.nome}</span>
      <span className="text-muted-foreground">·</span>
      <span className="font-mono">
        {new Date(diaOperacional + "T00:00:00").toLocaleDateString("pt-BR")}
      </span>
    </button>
  );
}
