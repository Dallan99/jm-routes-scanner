import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  Plus,
  Printer,
  Route as RouteIcon,
  Settings2,
  ShieldAlert,
  Truck,
  XCircle,
} from "lucide-react";
import { RequireBaseOperacional } from "@/components/base-operacional-selector";
import { useBaseOperacional } from "@/lib/base-operacional-context";
import { contextoBaseOperacional } from "@/lib/base-operacional.functions";
import {
  anexarEvidenciaTransferencia,
  cancelarTransferencia,
  caminhoEvidenciaTransferencia,
  criarTransferencia,
  listarMotivosTransferencia,
  listarTransferencias,
  proximaEtapa,
  registrarMarcoTransferencia,
  RESPONSABILIDADES,
  salvarSlaTransferencia,
  TRANSFERENCIA_ETAPAS,
  TRANSFERENCIA_STATUS,
  type TransferenciaDetalhe,
  type TransferenciaEtapa,
  type TransferenciaMotivo,
  type TransferenciaResponsabilidade,
} from "@/lib/transferencias.functions";
import { supabase } from "@/integrations/supabase/client";
import { abrirRelatorio, baixarCSV } from "@/lib/relatorio";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/transferencias")({
  head: () => ({ meta: [{ title: "Transferências — JM Transportes" }] }),
  component: TransferenciasGuard,
});

function hojeYmd() {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function agoraLocalInput() {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatarDataHora(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

function statusLabel(status: string) {
  return TRANSFERENCIA_STATUS.find((s) => s.value === status)?.label ?? status;
}

function etapaLabel(etapa: string) {
  return TRANSFERENCIA_ETAPAS.find((e) => e.value === etapa)?.label ?? etapa;
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "concluida_no_prazo") return "default";
  if (status === "concluida_com_atraso" || status === "cancelada") return "destructive";
  if (status === "pendente_evidencia" || status === "em_analise") return "outline";
  return "secondary";
}

function TransferenciasGuard() {
  return (
    <RequireBaseOperacional
      titulo="Transferências"
      descricao="Selecione a base e o dia para registrar a movimentação dos caminhões."
    >
      <TransferenciasPage />
    </RequireBaseOperacional>
  );
}

function TransferenciasPage() {
  const { base, diaOperacional } = useBaseOperacional();
  const contextoFn = useServerFn(contextoBaseOperacional);
  const listarFn = useServerFn(listarTransferencias);
  const motivosFn = useServerFn(listarMotivosTransferencia);
  const qc = useQueryClient();
  const [inicio, setInicio] = useState(diaOperacional ?? hojeYmd());
  const [fim, setFim] = useState(diaOperacional ?? hojeYmd());
  const [visaoGeral, setVisaoGeral] = useState(false);
  const [status, setStatus] = useState("todos");
  const [responsabilidade, setResponsabilidade] = useState("todas");
  const [motivoId, setMotivoId] = useState("todos");
  const [busca, setBusca] = useState("");
  const [novaOpen, setNovaOpen] = useState(false);
  const [slaOpen, setSlaOpen] = useState(false);
  const [selecionada, setSelecionada] = useState<TransferenciaDetalhe | null>(null);
  const [marco, setMarco] = useState<{
    transferencia: TransferenciaDetalhe;
    etapa: TransferenciaEtapa;
  } | null>(null);
  const [evidencia, setEvidencia] = useState<{
    transferencia: TransferenciaDetalhe;
    etapa: TransferenciaEtapa;
  } | null>(null);

  const contexto = useQuery({
    queryKey: ["contexto-base-operacional"],
    queryFn: () => contextoFn(),
    staleTime: 60_000,
  });
  const motivos = useQuery({
    queryKey: ["transferencias-motivos"],
    queryFn: () => motivosFn(),
    staleTime: 10 * 60_000,
  });
  const isAdmin = contexto.data?.isAdmin === true;

  const lista = useQuery({
    queryKey: [
      "transferencias",
      inicio,
      fim,
      visaoGeral,
      base?.id,
      status,
      responsabilidade,
      motivoId,
    ],
    queryFn: () =>
      listarFn({
        data: {
          inicio,
          fim,
          baseId: isAdmin && visaoGeral ? undefined : base!.id,
          status: status === "todos" ? undefined : status,
          responsabilidade: responsabilidade === "todas" ? undefined : responsabilidade,
          motivoId: motivoId === "todos" ? undefined : motivoId,
        },
      }),
    enabled: !!base && !!inicio && !!fim && !!contexto.data,
    refetchInterval: 30_000,
  });

  const linhas = useMemo(() => {
    const termo = busca.trim().toLocaleUpperCase("pt-BR");
    if (!termo) return lista.data ?? [];
    return (lista.data ?? []).filter((t) =>
      [t.codigo, t.service, t.motorista, t.placa, t.base_codigo, t.base_nome]
        .join(" ")
        .toLocaleUpperCase("pt-BR")
        .includes(termo),
    );
  }, [lista.data, busca]);

  const metricas = useMemo(() => {
    const validas = linhas.filter((t) => t.status !== "cancelada");
    const concluidas = validas.filter((t) => t.status.startsWith("concluida_"));
    const noPrazo = concluidas.filter((t) => t.status === "concluida_no_prazo").length;
    const atrasadas = validas.filter(
      (t) => t.status === "concluida_com_atraso" || t.eventos.some((e) => e.minutos_atraso > 0),
    ).length;
    const dwell = validas
      .map((t) => {
        const chegada = t.eventos.find((e) => e.etapa === "chegada_service");
        const saida = t.eventos.find((e) => e.etapa === "saida_service");
        return chegada && saida
          ? Math.max(
              0,
              Math.round(
                (Date.parse(saida.ocorrido_em) - Date.parse(chegada.ocorrido_em)) / 60_000,
              ),
            )
          : null;
      })
      .filter((v): v is number => v !== null);
    const transito = validas
      .map((t) => {
        const saida = t.eventos.find((e) => e.etapa === "saida_service");
        const chegada = t.eventos.find((e) => e.etapa === "chegada_xpt");
        return saida && chegada
          ? Math.max(
              0,
              Math.round(
                (Date.parse(chegada.ocorrido_em) - Date.parse(saida.ocorrido_em)) / 60_000,
              ),
            )
          : null;
      })
      .filter((v): v is number => v !== null);
    return {
      total: validas.length,
      andamento: validas.filter((t) => !t.status.startsWith("concluida_")).length,
      noPrazo,
      sla: concluidas.length ? Math.round((noPrazo / concluidas.length) * 100) : 0,
      atrasadas,
      pendentes: validas.filter((t) => t.status === "pendente_evidencia").length,
      dwell: dwell.length ? Math.round(dwell.reduce((a, b) => a + b, 0) / dwell.length) : 0,
      transito: transito.length
        ? Math.round(transito.reduce((a, b) => a + b, 0) / transito.length)
        : 0,
    };
  }, [linhas]);

  const rankings = useMemo(() => {
    const agregar = (chaves: string[], minutos: number[]) => {
      const map = new Map<string, { label: string; total: number; minutos: number }>();
      chaves.forEach((label, index) => {
        const atual = map.get(label) ?? { label, total: 0, minutos: 0 };
        atual.total += 1;
        atual.minutos += minutos[index] ?? 0;
        map.set(label, atual);
      });
      return Array.from(map.values()).sort((a, b) => b.minutos - a.minutos || b.total - a.total);
    };
    const atrasadas = linhas.filter((t) => t.eventos.some((e) => e.minutos_atraso > 0));
    const ocorrencias = linhas.flatMap((t) => t.ocorrencias);
    const motivoMap = new Map((motivos.data ?? []).map((m) => [m.id, m.nome]));
    return {
      bases: agregar(
        atrasadas.map((t) => `${t.base_codigo} · ${t.base_nome}`),
        atrasadas.map((t) => t.eventos.reduce((s, e) => s + e.minutos_atraso, 0)),
      ),
      motoristas: agregar(
        atrasadas.map((t) => t.motorista),
        atrasadas.map((t) => t.eventos.reduce((s, e) => s + e.minutos_atraso, 0)),
      ),
      motivos: agregar(
        ocorrencias.map((o) =>
          o.motivo_id ? (motivoMap.get(o.motivo_id) ?? "Motivo não encontrado") : "Em análise",
        ),
        ocorrencias.map((o) => o.minutos_atraso),
      ),
      responsabilidades: agregar(
        ocorrencias.map((o) => o.responsabilidade),
        ocorrencias.map((o) => o.minutos_atraso),
      ),
    };
  }, [linhas, motivos.data]);

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["transferencias"] });
  }

  const colunasRelatorio = [
    { header: "Código", value: (t: TransferenciaDetalhe) => t.codigo },
    { header: "Base", value: (t: TransferenciaDetalhe) => t.base_codigo },
    {
      header: "Data",
      value: (t: TransferenciaDetalhe) =>
        new Date(`${t.data_operacional}T00:00:00`).toLocaleDateString("pt-BR"),
    },
    { header: "Service", value: (t: TransferenciaDetalhe) => t.service },
    { header: "Motorista", value: (t: TransferenciaDetalhe) => t.motorista },
    { header: "Placa", value: (t: TransferenciaDetalhe) => t.placa },
    { header: "Status", value: (t: TransferenciaDetalhe) => statusLabel(t.status) },
    {
      header: "Chegada Service",
      value: (t: TransferenciaDetalhe) =>
        formatarDataHora(t.eventos.find((e) => e.etapa === "chegada_service")?.ocorrido_em),
    },
    {
      header: "Saída Service",
      value: (t: TransferenciaDetalhe) =>
        formatarDataHora(t.eventos.find((e) => e.etapa === "saida_service")?.ocorrido_em),
    },
    {
      header: "Chegada XPT",
      value: (t: TransferenciaDetalhe) =>
        formatarDataHora(t.eventos.find((e) => e.etapa === "chegada_xpt")?.ocorrido_em),
    },
    {
      header: "Atraso total (min)",
      value: (t: TransferenciaDetalhe) => t.eventos.reduce((s, e) => s + e.minutos_atraso, 0),
    },
    {
      header: "Responsabilidade",
      value: (t: TransferenciaDetalhe) =>
        Array.from(new Set(t.ocorrencias.map((o) => o.responsabilidade))).join(", "),
    },
  ] as const;

  function relatorio(autoPrint: boolean) {
    const config = {
      titulo: visaoGeral
        ? "Transferências — relatório geral"
        : `Transferências — ${base?.nome ?? "Base"}`,
      subtitulo: `Período ${new Date(`${inicio}T00:00:00`).toLocaleDateString("pt-BR")} a ${new Date(`${fim}T00:00:00`).toLocaleDateString("pt-BR")}`,
      nomeArquivo: `transferencias_${visaoGeral ? "geral" : (base?.codigo ?? "base")}_${inicio}_${fim}`,
      kpis: [
        { label: "Total", value: metricas.total },
        { label: "SLA", value: `${metricas.sla}%` },
        { label: "Com atraso", value: metricas.atrasadas },
        { label: "Evidência pendente", value: metricas.pendentes },
      ],
      colunas: [...colunasRelatorio],
      linhas,
    };
    if (autoPrint) {
      if (!abrirRelatorio({ ...config, autoPrint: true }))
        toast.error("Permita pop-ups para imprimir.");
    } else baixarCSV(config);
  }

  return (
    <div className="p-3 md:p-6 max-w-[1500px] mx-auto space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Truck className="w-7 h-7 text-primary" /> Transferências
          </h1>
          <p className="text-sm text-muted-foreground">
            Chegada no Service, saída do Service e chegada no XPT com evidência TimeMark.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setSlaOpen(true)}>
              <Settings2 className="w-4 h-4 mr-2" /> Configurar SLA
            </Button>
          )}
          <Button variant="outline" onClick={() => relatorio(false)} disabled={!linhas.length}>
            <Download className="w-4 h-4 mr-2" /> Excel / CSV
          </Button>
          <Button variant="outline" onClick={() => relatorio(true)} disabled={!linhas.length}>
            <Printer className="w-4 h-4 mr-2" /> Imprimir
          </Button>
          <Button onClick={() => setNovaOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nova transferência
          </Button>
        </div>
      </div>

      <Card className="p-3 md:p-4 space-y-3">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          <div>
            <Label>Início</Label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div>
            <Label>Fim</Label>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {TRANSFERENCIA_STATUS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsabilidade</Label>
            <Select value={responsabilidade} onValueChange={setResponsabilidade}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {RESPONSABILIDADES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Motivo</Label>
            <Select value={motivoId} onValueChange={setMotivoId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(motivos.data ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="xl:col-span-2">
            <Label>Buscar</Label>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Código, Service, motorista ou placa"
            />
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 border-t pt-3">
            <Switch checked={visaoGeral} onCheckedChange={setVisaoGeral} id="visao-geral" />
            <Label htmlFor="visao-geral">Visão geral de todas as bases</Label>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 md:gap-3">
        <Kpi label="Transferências" value={metricas.total} icon={Truck} />
        <Kpi label="Em andamento" value={metricas.andamento} icon={Clock3} />
        <Kpi label="SLA concluídas" value={`${metricas.sla}%`} icon={CheckCircle2} tone="success" />
        <Kpi label="Com atraso" value={metricas.atrasadas} icon={AlertTriangle} tone="danger" />
        <Kpi label="Evidência pendente" value={metricas.pendentes} icon={Camera} tone="warning" />
        <Kpi label="Média trajeto" value={`${metricas.transito} min`} icon={RouteIcon} />
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        <RankingCard titulo="Atrasos por responsabilidade" rows={rankings.responsabilidades} />
        <RankingCard titulo="Principais motivos" rows={rankings.motivos} />
        <RankingCard titulo="Bases com mais atraso" rows={rankings.bases} />
        <RankingCard titulo="Motoristas com mais atraso" rows={rankings.motoristas} />
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Operação no período</h2>
            <p className="text-xs text-muted-foreground">
              Permanência média no Service: {metricas.dwell} min
            </p>
          </div>
          <Badge variant="outline">{linhas.length} registros</Badge>
        </div>
        <div className="divide-y">
          {linhas.map((t) => {
            const proxima = proximaEtapa(t.eventos);
            const atraso = t.eventos.reduce((s, e) => s + e.minutos_atraso, 0);
            return (
              <div key={t.id} className="p-3 md:p-4 hover:bg-muted/30">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <button className="text-left min-w-0 flex-1" onClick={() => setSelecionada(t)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="font-mono">{t.codigo}</b>
                      <Badge variant={statusVariant(t.status)}>{statusLabel(t.status)}</Badge>
                      {atraso > 0 && <Badge variant="destructive">{atraso} min atraso</Badge>}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        <b className="text-foreground">{t.base_codigo}</b> · {t.service}
                      </span>
                      <span>{t.motorista}</span>
                      <span className="font-mono">{t.placa}</span>
                    </div>
                  </button>
                  <div className="grid grid-cols-3 gap-1 text-center text-[11px] min-w-[280px]">
                    {TRANSFERENCIA_ETAPAS.map((etapa) => {
                      const evento = t.eventos.find((e) => e.etapa === etapa.value);
                      return (
                        <div
                          key={etapa.value}
                          className={`rounded border p-2 ${evento ? "bg-primary/5 border-primary/30" : "bg-muted/30"}`}
                        >
                          <span className="block text-muted-foreground">
                            {etapa.label
                              .replace("Chegada no ", "Cheg. ")
                              .replace("Saída do ", "Saída ")}
                          </span>
                          <b>
                            {evento
                              ? new Date(evento.ocorrido_em).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </b>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 lg:justify-end">
                    <Button variant="outline" size="sm" onClick={() => setSelecionada(t)}>
                      Detalhes
                    </Button>
                    {proxima && t.status !== "cancelada" && (
                      <Button
                        size="sm"
                        onClick={() => setMarco({ transferencia: t, etapa: proxima })}
                      >
                        Registrar {etapaLabel(proxima)}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {!lista.isLoading && linhas.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma transferência encontrada.
            </div>
          )}
          {lista.isLoading && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Carregando transferências…
            </div>
          )}
        </div>
      </Card>

      <NovaTransferenciaDialog open={novaOpen} onOpenChange={setNovaOpen} onSuccess={refresh} />
      <SlaDialog open={slaOpen} onOpenChange={setSlaOpen} />
      <MarcoDialog
        marco={marco}
        motivos={motivos.data ?? []}
        onOpenChange={(open) => !open && setMarco(null)}
        onSuccess={refresh}
      />
      <EvidenciaDialog
        evidencia={evidencia}
        onOpenChange={(open) => !open && setEvidencia(null)}
        onSuccess={refresh}
      />
      <DetalheDialog
        transferencia={selecionada}
        motivos={motivos.data ?? []}
        onOpenChange={(open) => !open && setSelecionada(null)}
        onRegistrar={(t, etapa) => {
          setSelecionada(null);
          setMarco({ transferencia: t, etapa });
        }}
        onEvidencia={(t, etapa) => {
          setSelecionada(null);
          setEvidencia({ transferencia: t, etapa });
        }}
        onSuccess={refresh}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: typeof Truck;
  tone?: "default" | "success" | "danger" | "warning";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-destructive"
        : tone === "warning"
          ? "text-warning"
          : "text-primary";
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[11px] text-muted-foreground uppercase">{label}</span>
      </div>
      <b className="text-xl md:text-2xl mt-1 block">{value}</b>
    </Card>
  );
}

function RankingCard({
  titulo,
  rows,
}: {
  titulo: string;
  rows: Array<{ label: string; total: number; minutos: number }>;
}) {
  return (
    <Card className="p-3 md:p-4">
      <h3 className="text-sm font-semibold mb-3">{titulo}</h3>
      <div className="space-y-2">
        {rows.slice(0, 5).map((row, index) => (
          <div key={row.label} className="flex items-center gap-2 text-xs">
            <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center font-mono">
              {index + 1}
            </span>
            <span className="truncate flex-1" title={row.label}>
              {row.label}
            </span>
            <span className="text-right whitespace-nowrap">
              <b>{row.minutos} min</b>
              <span className="text-muted-foreground"> · {row.total} viagens</span>
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground">Sem atrasos no período.</p>
        )}
      </div>
    </Card>
  );
}

function SlaDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { base } = useBaseOperacional();
  const fn = useServerFn(salvarSlaTransferencia);
  const [service, setService] = useState("");
  const [chegada, setChegada] = useState("07:00");
  const [saida, setSaida] = useState("09:00");
  const [transito, setTransito] = useState("60");
  const mutation = useMutation({
    mutationFn: () =>
      fn({
        data: {
          baseId: base!.id,
          service,
          chegadaServiceLimite: chegada,
          saidaServiceLimite: saida,
          transitoMaxMinutos: Number(transito),
        },
      }),
    onSuccess: () => {
      toast.success("SLA salvo para esta base e Service.");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar SLA."),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar SLA de transferência</DialogTitle>
          <DialogDescription>
            Base {base?.nome}. A configuração vale para o Service informado; sem configuração, o
            sistema usa 07:00, 09:00 e 60 minutos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Service *</Label>
            <Input
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="Mesmo nome usado na transferência"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Chegada limite</Label>
              <Input type="time" value={chegada} onChange={(e) => setChegada(e.target.value)} />
            </div>
            <div>
              <Label>Saída limite</Label>
              <Input type="time" value={saida} onChange={(e) => setSaida(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Trajeto máximo até o XPT (minutos)</Label>
            <Input
              type="number"
              min={1}
              max={1440}
              value={transito}
              onChange={(e) => setTransito(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={mutation.isPending || service.trim().length < 2 || Number(transito) < 1}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Salvando…" : "Salvar SLA"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovaTransferenciaDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { base, diaOperacional } = useBaseOperacional();
  const fn = useServerFn(criarTransferencia);
  const [service, setService] = useState("");
  const [motorista, setMotorista] = useState("");
  const [placa, setPlaca] = useState("");
  const [tipo, setTipo] = useState("");
  const [obs, setObs] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      fn({
        data: {
          baseId: base!.id,
          dataOperacional: diaOperacional!,
          service,
          motorista,
          placa,
          tipoVeiculo: tipo || undefined,
          observacao: obs || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Transferência criada.");
      onOpenChange(false);
      setService("");
      setMotorista("");
      setPlaca("");
      setTipo("");
      setObs("");
      onSuccess();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar transferência."),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova transferência</DialogTitle>
          <DialogDescription>
            Base {base?.nome} · Dia{" "}
            {diaOperacional
              ? new Date(`${diaOperacional}T00:00:00`).toLocaleDateString("pt-BR")
              : "—"}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid sm:grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="sm:col-span-2">
            <Label>Service *</Label>
            <Input
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="Nome/código do Service"
              required
              minLength={2}
            />
          </div>
          <div>
            <Label>Motorista *</Label>
            <Input
              value={motorista}
              onChange={(e) => setMotorista(e.target.value)}
              required
              minLength={2}
            />
          </div>
          <div>
            <Label>Placa *</Label>
            <Input
              value={placa}
              onChange={(e) => setPlaca(e.target.value.toUpperCase())}
              required
              minLength={5}
              className="font-mono"
            />
          </div>
          <div>
            <Label>Tipo de veículo</Label>
            <Input
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              placeholder="Truck, carreta…"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Observação inicial</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={1000} />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Criando…" : "Criar transferência"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MarcoDialog({
  marco,
  motivos,
  onOpenChange,
  onSuccess,
}: {
  marco: { transferencia: TransferenciaDetalhe; etapa: TransferenciaEtapa } | null;
  motivos: TransferenciaMotivo[];
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const fn = useServerFn(registrarMarcoTransferencia);
  const anexarFn = useServerFn(anexarEvidenciaTransferencia);
  const [ocorrido, setOcorrido] = useState(agoraLocalInput());
  const [timemark, setTimemark] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [responsabilidade, setResponsabilidade] = useState<
    TransferenciaResponsabilidade | "nenhuma"
  >("nenhuma");
  const [motivo, setMotivo] = useState("nenhum");
  const [obs, setObs] = useState("");
  const motivosFiltrados = motivos.filter(
    (m) =>
      (!marco || !m.etapa || m.etapa === marco.etapa) &&
      (responsabilidade === "nenhuma" ||
        m.responsabilidade === responsabilidade ||
        responsabilidade === "EM_ANALISE"),
  );
  const mutation = useMutation({
    mutationFn: async () => {
      if (!marco) return;
      if ((file && !timemark) || (!file && timemark)) {
        throw new Error(
          "Informe a foto e o link TimeMark, ou deixe ambos em branco para salvar como pendente.",
        );
      }
      if (file) {
        if (file.size > 10 * 1024 * 1024) throw new Error("A foto deve ter no máximo 10 MB.");
        if (!file.type.startsWith("image/")) throw new Error("Selecione uma foto válida.");
      }
      await fn({
        data: {
          transferenciaId: marco.transferencia.id,
          etapa: marco.etapa,
          ocorridoEm: new Date(ocorrido).toISOString(),
          localizacaoTexto: localizacao || undefined,
          motivoCodigo: motivo === "nenhum" ? undefined : motivo,
          responsabilidade: responsabilidade === "nenhuma" ? undefined : responsabilidade,
          observacao: obs || undefined,
        },
      });
      if (file && timemark) {
        try {
          const storagePath = caminhoEvidenciaTransferencia(
            marco.transferencia.base_id,
            marco.transferencia.id,
            marco.etapa,
            file.name,
          );
          const { error } = await supabase.storage
            .from("transferencias-evidencias")
            .upload(storagePath, file, { upsert: false, contentType: file.type });
          if (error) throw new Error(error.message);
          await anexarFn({
            data: {
              transferenciaId: marco.transferencia.id,
              etapa: marco.etapa,
              storagePath,
              timemarkUrl: timemark,
              horarioEvidencia: new Date(ocorrido).toISOString(),
              localizacaoTexto: localizacao || undefined,
            },
          });
        } catch (error) {
          throw new Error(
            `MARCO_SALVO_EVIDENCIA_PENDENTE: ${error instanceof Error ? error.message : "falha no envio"}`,
          );
        }
      }
    },
    onSuccess: () => {
      toast.success("Marco registrado.");
      onOpenChange(false);
      setOcorrido(agoraLocalInput());
      setTimemark("");
      setLocalizacao("");
      setFile(null);
      setResponsabilidade("nenhuma");
      setMotivo("nenhum");
      setObs("");
      onSuccess();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Erro ao registrar marco.";
      onSuccess();
      if (msg.startsWith("MARCO_SALVO_EVIDENCIA_PENDENTE")) {
        toast.warning(
          "O marco foi salvo, mas a evidência ficou pendente. Abra os detalhes para completar.",
        );
        onOpenChange(false);
        return;
      }
      toast.error(
        msg.includes("responsabilidade_obrigatoria")
          ? "O horário está fora do SLA. Informe responsabilidade e motivo."
          : msg,
      );
    },
  });
  return (
    <Dialog open={!!marco} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{marco ? etapaLabel(marco.etapa) : "Registrar marco"}</DialogTitle>
          <DialogDescription>
            {marco?.transferencia.codigo} · {marco?.transferencia.motorista} ·{" "}
            {marco?.transferencia.placa}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid sm:grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div>
            <Label>Data e horário reais *</Label>
            <Input
              type="datetime-local"
              value={ocorrido}
              onChange={(e) => setOcorrido(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Localização</Label>
            <Input
              value={localizacao}
              onChange={(e) => setLocalizacao(e.target.value)}
              placeholder="Service / portaria / XPT"
            />
          </div>
          <div className="sm:col-span-2 rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Camera className="w-4 h-4" /> Evidência fotográfica
            </div>
            <p className="text-xs text-muted-foreground">
              Fotografe o caminhão no local e informe o link ativo do TimeMark. É possível salvar
              sem ambos, mas a transferência ficará pendente de evidência.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Foto do caminhão</Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <Label>Link TimeMark</Label>
                <Input
                  type="url"
                  value={timemark}
                  onChange={(e) => setTimemark(e.target.value)}
                  placeholder="https://timemark.app/..."
                />
              </div>
            </div>
          </div>
          <div>
            <Label>Responsabilidade (se houver atraso)</Label>
            <Select
              value={responsabilidade}
              onValueChange={(v) => {
                setResponsabilidade(v as TransferenciaResponsabilidade | "nenhuma");
                setMotivo("nenhum");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Sem classificação / no prazo</SelectItem>
                {RESPONSABILIDADES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Motivo (se houver atraso)</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Não informado</SelectItem>
                {motivosFiltrados.map((m) => (
                  <SelectItem key={m.id} value={m.codigo}>
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Observação</Label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              maxLength={1000}
              placeholder="Descreva o ocorrido quando necessário."
            />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Registrando…" : "Registrar marco"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EvidenciaDialog({
  evidencia,
  onOpenChange,
  onSuccess,
}: {
  evidencia: { transferencia: TransferenciaDetalhe; etapa: TransferenciaEtapa } | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const fn = useServerFn(anexarEvidenciaTransferencia);
  const [file, setFile] = useState<File | null>(null);
  const [timemark, setTimemark] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      if (!evidencia || !file || !timemark)
        throw new Error("Foto e link TimeMark são obrigatórios.");
      if (file.size > 10 * 1024 * 1024) throw new Error("A foto deve ter no máximo 10 MB.");
      const path = caminhoEvidenciaTransferencia(
        evidencia.transferencia.base_id,
        evidencia.transferencia.id,
        evidencia.etapa,
        file.name,
      );
      const { error } = await supabase.storage
        .from("transferencias-evidencias")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw new Error(error.message);
      return fn({
        data: {
          transferenciaId: evidencia.transferencia.id,
          etapa: evidencia.etapa,
          storagePath: path,
          timemarkUrl: timemark,
          localizacaoTexto: localizacao || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Evidência anexada.");
      onOpenChange(false);
      setFile(null);
      setTimemark("");
      setLocalizacao("");
      onSuccess();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao anexar evidência."),
  });
  return (
    <Dialog open={!!evidencia} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complementar evidência</DialogTitle>
          <DialogDescription>
            {evidencia ? etapaLabel(evidencia.etapa) : ""} · foto do caminhão e link TimeMark.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Foto *</Label>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <Label>Link TimeMark *</Label>
            <Input type="url" value={timemark} onChange={(e) => setTimemark(e.target.value)} />
          </div>
          <div>
            <Label>Localização</Label>
            <Input value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            Anexar evidência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetalheDialog({
  transferencia,
  motivos,
  onOpenChange,
  onRegistrar,
  onEvidencia,
  onSuccess,
}: {
  transferencia: TransferenciaDetalhe | null;
  motivos: TransferenciaMotivo[];
  onOpenChange: (open: boolean) => void;
  onRegistrar: (t: TransferenciaDetalhe, etapa: TransferenciaEtapa) => void;
  onEvidencia: (t: TransferenciaDetalhe, etapa: TransferenciaEtapa) => void;
  onSuccess: () => void;
}) {
  const cancelarFn = useServerFn(cancelarTransferencia);
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const cancelar = useMutation({
    mutationFn: () => cancelarFn({ data: { transferenciaId: transferencia!.id, justificativa } }),
    onSuccess: () => {
      toast.success("Transferência cancelada.");
      setCancelarOpen(false);
      onOpenChange(false);
      onSuccess();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao cancelar."),
  });
  if (!transferencia)
    return (
      <Dialog open={false}>
        <DialogContent />
      </Dialog>
    );
  const proxima = proximaEtapa(transferencia.eventos);
  const motivoMap = new Map(motivos.map((m) => [m.id, m.nome]));
  return (
    <>
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap gap-2 items-center">
              <span className="font-mono">{transferencia.codigo}</span>
              <Badge variant={statusVariant(transferencia.status)}>
                {statusLabel(transferencia.status)}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              {transferencia.base_nome} · {transferencia.service} · {transferencia.motorista} ·{" "}
              {transferencia.placa}
            </DialogDescription>
          </DialogHeader>
          <div className="grid md:grid-cols-3 gap-3">
            {TRANSFERENCIA_ETAPAS.map((etapa) => {
              const evento = transferencia.eventos.find((e) => e.etapa === etapa.value);
              const evid = transferencia.evidencias.find((e) => e.evento_id === evento?.id);
              const ocorr = transferencia.ocorrencias.find((o) => o.evento_id === evento?.id);
              const completa = !!evid?.storage_path && !!evid.timemark_url;
              return (
                <Card
                  key={etapa.value}
                  className={`p-3 space-y-2 ${evento ? "border-primary/40" : "opacity-70"}`}
                >
                  <div className="flex items-center justify-between">
                    <b className="text-sm">{etapa.label}</b>
                    {evento ? (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : (
                      <Clock3 className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="font-mono text-sm">{formatarDataHora(evento?.ocorrido_em)}</div>
                  {evento && (
                    <>
                      <div className="text-xs">
                        Atraso:{" "}
                        <b className={evento.minutos_atraso ? "text-destructive" : "text-success"}>
                          {evento.minutos_atraso} min
                        </b>
                      </div>
                      {ocorr && (
                        <div className="text-xs rounded bg-destructive/5 p-2">
                          <b>{ocorr.responsabilidade}</b>
                          <br />
                          {ocorr.motivo_id ? motivoMap.get(ocorr.motivo_id) : "Em análise"}
                          {ocorr.observacao ? ` · ${ocorr.observacao}` : ""}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {evid?.signed_url && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={evid.signed_url} target="_blank" rel="noreferrer">
                              <Camera className="w-3 h-3 mr-1" />
                              Foto
                            </a>
                          </Button>
                        )}
                        {evid?.timemark_url && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={evid.timemark_url} target="_blank" rel="noreferrer">
                              <ExternalLink className="w-3 h-3 mr-1" />
                              TimeMark
                            </a>
                          </Button>
                        )}
                        {!completa && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onEvidencia(transferencia, etapa.value)}
                          >
                            <ShieldAlert className="w-3 h-3 mr-1" />
                            Completar
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </Card>
              );
            })}
          </div>
          {transferencia.observacao && (
            <Card className="p-3 text-sm">
              <b>Observação:</b> {transferencia.observacao}
            </Card>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="destructive"
              disabled={transferencia.status === "cancelada"}
              onClick={() => setCancelarOpen(true)}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancelar transferência
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              {proxima && transferencia.status !== "cancelada" && (
                <Button onClick={() => onRegistrar(transferencia, proxima)}>
                  Registrar {etapaLabel(proxima)}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={cancelarOpen} onOpenChange={setCancelarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar transferência</DialogTitle>
            <DialogDescription>
              Nenhum dado será apagado. Informe uma justificativa auditável.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            minLength={10}
            placeholder="Mínimo de 10 caracteres"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelarOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={justificativa.trim().length < 10 || cancelar.isPending}
              onClick={() => cancelar.mutate()}
            >
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
