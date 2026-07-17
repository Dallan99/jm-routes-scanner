import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MoreVertical,
  Plus,
  RefreshCcw,
  Route as RouteIcon,
  Truck,
} from "lucide-react";
import { RequireBaseOperacional } from "@/components/base-operacional-selector";
import { useBaseOperacional } from "@/lib/base-operacional-context";
import { contextoBaseOperacional } from "@/lib/base-operacional.functions";
import {
  caminhoEvidenciaTransferencia,
  listarTransferencias,
  proximaEtapa,
  registrarMarcoTransferencia,
  type TransferenciaDetalhe,
  type TransferenciaEtapa,
} from "@/lib/transferencias.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  criarTransferenciasLote,
  registrarMarcosTransferenciaLote,
  type LinhaCadastroTransferencia,
} from "@/lib/transferencias-lote.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
function hora(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function minutosEntre(inicio?: string, fim?: string) {
  if (!inicio || !fim) return null;
  return Math.max(0, Math.round((Date.parse(fim) - Date.parse(inicio)) / 60_000));
}

function duracao(minutos: number | null) {
  if (minutos == null) return "—";
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function eventoDe(t: TransferenciaDetalhe, etapa: TransferenciaEtapa) {
  return t.eventos.find((e) => e.etapa === etapa);
}

function serviceDaBase(nome?: string) {
  const base = (nome ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (base.includes("ibiuna")) return "SSP20";
  if (base.includes("guaruja")) return "SSP15";
  if (base.includes("embu")) return "SSP34";
  if (base.includes("franco")) return "SSP25";
  return "";
}

function TransferenciasGuard() {
  return (
    <RequireBaseOperacional
      titulo="Transferências"
      descricao="Selecione a base e o dia para acompanhar a movimentação dos caminhões."
    >
      <TransferenciasPage />
    </RequireBaseOperacional>
  );
}

function TransferenciasPage() {
  const { base, diaOperacional } = useBaseOperacional();
  const listarFn = useServerFn(listarTransferencias);
  const contextoFn = useServerFn(contextoBaseOperacional);
  const criarLoteFn = useServerFn(criarTransferenciasLote);
  const marcoLoteFn = useServerFn(registrarMarcosTransferenciaLote);
  const marcoFn = useServerFn(registrarMarcoTransferencia);
  const qc = useQueryClient();

  const [dataRota, setDataRota] = useState(diaOperacional ?? hojeYmd());
  const [service, setService] = useState("todos");
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [adicionarOpen, setAdicionarOpen] = useState(false);
  const [marcoLote, setMarcoLote] = useState<TransferenciaEtapa | null>(null);
  const [marcoIndividual, setMarcoIndividual] = useState<{ transferencia: TransferenciaDetalhe; etapa: TransferenciaEtapa } | null>(null);

  const contexto = useQuery({
    queryKey: ["contexto-base-operacional"],
    queryFn: () => contextoFn(),
    staleTime: 60_000,
  });

  const isAdmin = contexto.data?.isAdmin === true;

  const lista = useQuery({
    queryKey: ["transferencias-painel", dataRota, base?.id, isAdmin],
    queryFn: () =>
      listarFn({
        data: {
          inicio: dataRota,
          fim: dataRota,
          baseId: isAdmin && !base?.id ? undefined : base!.id,
        },
      }),
    enabled: !!dataRota && (!!base || isAdmin) && !!contexto.data,
    refetchInterval: 30_000,
  });

  const linhas = useMemo(() => {
    const termo = busca.trim().toLocaleUpperCase("pt-BR");
    return (lista.data ?? []).filter((t) => {
      if (service !== "todos" && t.service !== service) return false;
      if (!termo) return true;
      return [t.motorista, t.placa, t.codigo, t.service, t.base_nome]
        .join(" ")
        .toLocaleUpperCase("pt-BR")
        .includes(termo);
    });
  }, [lista.data, busca, service]);

  const services = useMemo(
    () => Array.from(new Set((lista.data ?? []).map((t) => t.service))).sort(),
    [lista.data],
  );

  const indicadores = useMemo(() => {
    const concluidas = linhas.filter((t) => eventoDe(t, "chegada_xpt"));
    const deslocamentos = concluidas
      .map((t) => minutosEntre(eventoDe(t, "saida_service")?.ocorrido_em, eventoDe(t, "chegada_xpt")?.ocorrido_em))
      .filter((v): v is number => v != null);
    const permanencias = linhas
      .map((t) => minutosEntre(eventoDe(t, "chegada_service")?.ocorrido_em, eventoDe(t, "saida_service")?.ocorrido_em))
      .filter((v): v is number => v != null);
    const noPrazo = deslocamentos.filter((m) => m <= 60).length;
    const atencao = deslocamentos.filter((m) => m > 60 && m <= 80).length;
    const atraso = deslocamentos.filter((m) => m > 80).length;
    return {
      total: linhas.length,
      noPrazo,
      atencao,
      atraso,
      mediaService: permanencias.length
        ? Math.round(permanencias.reduce((a, b) => a + b, 0) / permanencias.length)
        : 0,
      mediaDeslocamento: deslocamentos.length
        ? Math.round(deslocamentos.reduce((a, b) => a + b, 0) / deslocamentos.length)
        : 0,
    };
  }, [linhas]);

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["transferencias-painel"] });
    void qc.invalidateQueries({ queryKey: ["transferencias"] });
  }

  function selecionarTodos() {
    setSelecionados((atual) => (atual.length === linhas.length ? [] : linhas.map((t) => t.id)));
  }

  return (
    <div className="p-3 md:p-6 max-w-[1700px] mx-auto space-y-5">
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Truck className="w-8 h-8 text-primary" /> Transferências
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe em tempo real as transferências do Service para o XPT.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selecionados.length > 0 && (
            <>
              <Button variant="outline" onClick={() => setMarcoLote("chegada_service")}>
                Registrar chegada ({selecionados.length})
              </Button>
              <Button variant="outline" onClick={() => setMarcoLote("saida_service")}>
                Registrar saída ({selecionados.length})
              </Button>
              <Button variant="outline" onClick={() => setMarcoLote("chegada_xpt")}>
                Registrar chegada XPT ({selecionados.length})
              </Button>
              <Button variant="outline" onClick={() => setMarcoLote("saida_xpt")}>
                Registrar saída XPT ({selecionados.length})
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => refresh()} disabled={lista.isFetching}>
            <RefreshCcw className={`w-4 h-4 mr-2 ${lista.isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button onClick={() => setAdicionarOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Adicionar veículos
          </Button>
        </div>
      </header>

      <Card className="p-4">
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 items-end">
          <div>
            <Label>Base</Label>
            <Input value={base?.nome ?? (isAdmin ? "Todas as bases" : "—")} disabled />
          </div>
          <div>
            <Label>Service (origem)</Label>
            <Select value={service} onValueChange={setService}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Services</SelectItem>
                {services.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data da rota</Label>
            <Input type="date" value={dataRota} onChange={(e) => setDataRota(e.target.value)} />
          </div>
          <div>
            <Label>Buscar veículo</Label>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Motorista, placa ou código" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi titulo="Total de veículos" valor={indicadores.total} icone={Truck} />
        <Kpi titulo="No prazo" valor={indicadores.noPrazo} subtitulo={percentual(indicadores.noPrazo, indicadores.total)} icone={CheckCircle2} tom="success" />
        <Kpi titulo="Atenção (1h–1h20)" valor={indicadores.atencao} subtitulo={percentual(indicadores.atencao, indicadores.total)} icone={Clock3} tom="warning" />
        <Kpi titulo="Atraso (>1h20)" valor={indicadores.atraso} subtitulo={percentual(indicadores.atraso, indicadores.total)} icone={AlertTriangle} tom="danger" />
        <Kpi titulo="Média no Service" valor={`${indicadores.mediaService} min`} icone={Clock3} />
        <Kpi titulo="Média deslocamento" valor={`${indicadores.mediaDeslocamento} min`} icone={RouteIcon} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="p-3 text-center w-12">
                  <input type="checkbox" checked={linhas.length > 0 && selecionados.length === linhas.length} onChange={selecionarTodos} />
                </th>
                <th className="p-3 text-left">Motorista</th>
                <th className="p-3 text-left">Placa</th>
                <th className="p-3 text-center" colSpan={2}>Chegada Service</th>
                <th className="p-3 text-center" colSpan={2}>Saída Service</th>
                <th className="p-3 text-center" colSpan={2}>Chegada XPT</th>
                <th className="p-3 text-center" colSpan={2}>Saída XPT</th>
                <th className="p-3 text-center">Tempo no Service</th>
                <th className="p-3 text-center">Deslocamento</th>
                <th className="p-3 text-center">Situação</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
              <tr className="text-xs text-muted-foreground border-t">
                <th />
                <th />
                <th />
                <th className="p-2">Horário</th>
                <th className="p-2">Evidência</th>
                <th className="p-2">Horário</th>
                <th className="p-2">TimeMark</th>
                <th className="p-2">Horário</th>
                <th className="p-2">Evidência</th>
                <th className="p-2">Horário</th>
                <th className="p-2">Evidência</th>
                <th /><th /><th /><th />
              </tr>
            </thead>
            <tbody>
              {linhas.map((t) => {
                const chegadaService = eventoDe(t, "chegada_service");
                const saidaService = eventoDe(t, "saida_service");
                const chegadaXpt = eventoDe(t, "chegada_xpt");
                const saidaXpt = eventoDe(t, "saida_xpt");
                const permanencia = minutosEntre(chegadaService?.ocorrido_em, saidaService?.ocorrido_em);
                const deslocamento = minutosEntre(saidaService?.ocorrido_em, chegadaXpt?.ocorrido_em);
                const situacao = classificar(deslocamento);
                const evidChegada = t.evidencias.find((e) => e.etapa === "chegada_service");
                const evidSaida = t.evidencias.find((e) => e.etapa === "saida_service");
                const evidXpt = t.evidencias.find((e) => e.etapa === "chegada_xpt");
                const evidSaidaXpt = t.evidencias.find((e) => e.etapa === "saida_xpt");
                return (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={selecionados.includes(t.id)}
                        onChange={() => setSelecionados((atual) => atual.includes(t.id) ? atual.filter((id) => id !== t.id) : [...atual, t.id])}
                      />
                    </td>
                    <td className="p-3"><b>{t.motorista}</b><div className="text-xs text-muted-foreground">{t.codigo}</div></td>
                    <td className="p-3 font-mono">{t.placa}</td>
                    <td className="p-3 text-center font-mono">{hora(chegadaService?.ocorrido_em)}</td>
                    <td className="p-3 text-center"><EvidenceLink evidencia={evidChegada} /></td>
                    <td className="p-3 text-center font-mono">{hora(saidaService?.ocorrido_em)}</td>
                    <td className="p-3 text-center"><EvidenceLink evidencia={evidSaida} /></td>
                    <td className="p-3 text-center font-mono">{hora(chegadaXpt?.ocorrido_em)}</td>
                    <td className="p-3 text-center"><EvidenceLink evidencia={evidXpt} /></td>
                    <td className="p-3 text-center font-mono">{hora(saidaXpt?.ocorrido_em)}</td>
                    <td className="p-3 text-center"><EvidenceLink evidencia={evidSaidaXpt} /></td>
                    <td className="p-3 text-center font-semibold">{duracao(permanencia)}</td>
                    <td className={`p-3 text-center font-semibold ${situacao.cor}`}>{duracao(deslocamento)}</td>
                    <td className="p-3 text-center"><span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${situacao.badge}`}>{situacao.label}</span></td>
                    <td className="p-3 text-center"><Button variant="ghost" size="icon" title="Registrar próxima etapa" disabled={!proximaEtapa(t.eventos)} onClick={() => { const etapa = proximaEtapa(t.eventos); if (etapa) setMarcoIndividual({ transferencia: t, etapa }); }}><MoreVertical className="w-4 h-4" /></Button></td>
                  </tr>
                );
              })}
              {!lista.isLoading && linhas.length === 0 && (
                <tr><td colSpan={15} className="p-12 text-center text-muted-foreground">Nenhum veículo encontrado para os filtros selecionados.</td></tr>
              )}
              {lista.isLoading && (
                <tr><td colSpan={15} className="p-12 text-center text-muted-foreground">Carregando transferências…</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t flex flex-wrap gap-6 text-xs text-muted-foreground">
          <Legenda classe="bg-emerald-500" texto="No prazo: deslocamento até 1h" />
          <Legenda classe="bg-amber-500" texto="Atenção: entre 1h e 1h20" />
          <Legenda classe="bg-red-500" texto="Atraso: acima de 1h20" />
          <Legenda classe="bg-slate-400" texto="Há chegadas ou saídas pendentes" />
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Resumo da operação</h2>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Resumo label="Data da rota" valor={new Date(`${dataRota}T00:00:00`).toLocaleDateString("pt-BR")} />
            <Resumo label="Base" valor={base?.nome ?? "Todas as bases"} />
            <Resumo label="Veículos" valor={String(linhas.length)} />
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Observações gerais</h2>
          <p className="text-sm text-muted-foreground">Use o cadastro em lote para incluir vários veículos e as caixas de seleção para registrar chegadas e saídas de uma vez.</p>
        </Card>
      </div>

      <AdicionarVeiculosDialog
        open={adicionarOpen}
        onOpenChange={setAdicionarOpen}
        baseId={base?.id}
        servicePadrao={serviceDaBase(base?.nome)}
        dataRota={dataRota}
        criarFn={criarLoteFn}
        onSuccess={refresh}
      />
      <MarcoLoteDialog
        etapa={marcoLote}
        onOpenChange={(open) => !open && setMarcoLote(null)}
        ids={selecionados}
        registrarFn={marcoLoteFn}
        onSuccess={() => { setSelecionados([]); refresh(); }}
      />
      <MarcoIndividualDialog
        marco={marcoIndividual}
        onOpenChange={(open) => !open && setMarcoIndividual(null)}
        registrarFn={marcoFn}
        onSuccess={() => { setMarcoIndividual(null); refresh(); }}
      />
    </div>
  );
}

function percentual(valor: number, total: number) {
  return total ? `${Math.round((valor / total) * 100)}%` : "0%";
}

function classificar(minutos: number | null) {
  if (minutos == null) return { label: "Pendente", cor: "text-muted-foreground", badge: "bg-muted text-muted-foreground" };
  if (minutos <= 60) return { label: "No prazo", cor: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700" };
  if (minutos <= 80) return { label: "Atenção", cor: "text-amber-600", badge: "bg-amber-100 text-amber-700" };
  return { label: "Atraso", cor: "text-red-600", badge: "bg-red-100 text-red-700" };
}

function EvidenceLink({ evidencia }: { evidencia?: TransferenciaDetalhe["evidencias"][number] }) {
  const url = evidencia?.signed_url ?? evidencia?.timemark_url;
  if (!url) return <span className="text-muted-foreground">—</span>;
  return <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Ver <ExternalLink className="w-3 h-3" /></a>;
}

function Kpi({ titulo, valor, subtitulo, icone: Icon, tom = "default" }: { titulo: string; valor: string | number; subtitulo?: string; icone: typeof Truck; tom?: "default" | "success" | "warning" | "danger" }) {
  const caixa = tom === "success" ? "bg-emerald-50 text-emerald-600" : tom === "warning" ? "bg-amber-50 text-amber-600" : tom === "danger" ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary";
  return <Card className="p-4"><div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${caixa}`}><Icon className="w-5 h-5" /></div><div><div className="text-2xl font-bold">{valor}</div><div className="text-xs text-muted-foreground">{titulo}</div></div>{subtitulo && <b className="ml-auto text-xs">{subtitulo}</b>}</div></Card>;
}

function Legenda({ classe, texto }: { classe: string; texto: string }) {
  return <span className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${classe}`} />{texto}</span>;
}

function Resumo({ label, valor }: { label: string; valor: string }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><b>{valor}</b></div>;
}

function parseLinhas(texto: string, servicePadrao: string, fixarService = false): LinhaCadastroTransferencia[] {
  return texto.split(/\r?\n/).map((linha) => linha.trim()).filter(Boolean).map((linha) => {
    const partes = linha.split(/\t|;|,/).map((x) => x.trim());
    if (partes.length >= 4) return { service: fixarService ? servicePadrao : partes[0], motorista: partes[1], placa: partes[2].toUpperCase(), tipoVeiculo: partes[3] || undefined };
    return { service: servicePadrao, motorista: partes[0] ?? "", placa: (partes[1] ?? "").toUpperCase(), tipoVeiculo: partes[2] || undefined };
  });
}

function AdicionarVeiculosDialog({ open, onOpenChange, baseId, servicePadrao, dataRota, criarFn, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; baseId?: string; servicePadrao: string; dataRota: string; criarFn: ReturnType<typeof useServerFn<typeof criarTransferenciasLote>>; onSuccess: () => void }) {
  const [serviceManual, setServiceManual] = useState("");
  const [texto, setTexto] = useState("");
  const service = servicePadrao || serviceManual;
  useEffect(() => { if (servicePadrao) setServiceManual(""); }, [servicePadrao]);
  const linhas = useMemo(() => parseLinhas(texto, service, !!servicePadrao), [texto, service, servicePadrao]);
  const mutation = useMutation({
    mutationFn: () => criarFn({ data: { baseId: baseId!, dataOperacional: dataRota, linhas } }),
    onSuccess: (resultado) => { toast.success(`${resultado.sucessos} veículo(s) adicionado(s).`); if (resultado.falhas) toast.warning(`${resultado.falhas} linha(s) com erro.`); setTexto(""); onOpenChange(false); onSuccess(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao adicionar veículos."),
  });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Adicionar veículos</DialogTitle><DialogDescription>Cole várias linhas do Excel. Formato simples: Motorista, Placa e Tipo.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label>Service da base</Label><Input value={service} onChange={(e) => setServiceManual(e.target.value)} disabled={!!servicePadrao} placeholder="Informe o código do Service" /></div><div><Label>Veículos</Label><Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={10} placeholder={"João Silva\tABC1D23\tTruck\nCarlos Santos\tDEF4G56\tVan"} /></div><p className="text-xs text-muted-foreground">{linhas.length} linha(s) identificada(s).</p></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={!baseId || !service.trim() || !linhas.length || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Adicionando…" : `Adicionar ${linhas.length} veículo(s)`}</Button></DialogFooter></DialogContent></Dialog>;
}

function MarcoLoteDialog({ etapa, onOpenChange, ids, registrarFn, onSuccess }: { etapa: TransferenciaEtapa | null; onOpenChange: (open: boolean) => void; ids: string[]; registrarFn: ReturnType<typeof useServerFn<typeof registrarMarcosTransferenciaLote>>; onSuccess: () => void }) {
  const [horario, setHorario] = useState(() => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); });
  const [localizacao, setLocalizacao] = useState("");
  const mutation = useMutation({
    mutationFn: () => registrarFn({ data: { transferenciaIds: ids, etapa: etapa!, ocorridoEm: new Date(horario).toISOString(), localizacaoTexto: localizacao, responsabilidade: etapa === "saida_service" && new Date(horario).getHours() >= 9 ? "MELI" : undefined, motivoCodigo: etapa === "saida_service" && new Date(horario).getHours() >= 9 ? "ATRASO_CARREGAMENTO" : undefined } }),
    onSuccess: (resultado) => { toast.success(`${resultado.sucessos} marco(s) registrado(s).`); if (resultado.falhas) toast.warning(`${resultado.falhas} registro(s) falharam.`); onOpenChange(false); onSuccess(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao registrar marcos."),
  });
  const titulo = etapa === "chegada_service"
    ? "Chegada no Service em lote"
    : etapa === "saida_service"
      ? "Saída do Service em lote"
      : etapa === "chegada_xpt"
        ? "Chegada no XPT em lote"
        : "Saída do XPT em lote";
  return <Dialog open={!!etapa} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{titulo}</DialogTitle><DialogDescription>O mesmo horário será aplicado aos {ids.length} veículos selecionados. As evidências poderão ser anexadas depois.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label>Data e horário reais</Label><Input type="datetime-local" value={horario} onChange={(e) => setHorario(e.target.value)} /></div><div><Label>Localização</Label><Input value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} placeholder="Ex.: SP17" /></div>{etapa === "saida_service" && new Date(horario).getHours() >= 9 && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">Saída após 09:00: responsabilidade atribuída automaticamente ao Mercado Livre por atraso no carregamento/liberação.</div>}</div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={!localizacao.trim() || !ids.length || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Registrando…" : "Registrar em lote"}</Button></DialogFooter></DialogContent></Dialog>;
}

function MarcoIndividualDialog({ marco, onOpenChange, registrarFn, onSuccess }: { marco: { transferencia: TransferenciaDetalhe; etapa: TransferenciaEtapa } | null; onOpenChange: (open: boolean) => void; registrarFn: ReturnType<typeof useServerFn<typeof registrarMarcoTransferencia>>; onSuccess: () => void }) {
  const [horario, setHorario] = useState(() => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); });
  const [localizacao, setLocalizacao] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [timemark, setTimemark] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      if (!marco) throw new Error("Etapa não selecionada.");
      let storagePath: string | undefined;
      if (foto) {
        if (foto.size > 10 * 1024 * 1024) throw new Error("A foto deve ter no máximo 10 MB.");
        storagePath = caminhoEvidenciaTransferencia(marco.transferencia.base_id, marco.transferencia.id, marco.etapa, foto.name);
        const { error } = await supabase.storage.from("transferencias-evidencias").upload(storagePath, foto, { upsert: false, contentType: foto.type });
        if (error) throw new Error(error.message);
      }
      try {
        return await registrarFn({ data: { transferenciaId: marco.transferencia.id, etapa: marco.etapa, ocorridoEm: new Date(horario).toISOString(), storagePath, timemarkUrl: timemark || undefined, horarioEvidencia: foto || timemark ? new Date(horario).toISOString() : undefined, localizacaoTexto: localizacao || undefined } });
      } catch (error) {
        if (storagePath) await supabase.storage.from("transferencias-evidencias").remove([storagePath]);
        throw error;
      }
    },
    onSuccess: () => { toast.success("Etapa registrada."); setFoto(null); setTimemark(""); onSuccess(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao registrar etapa."),
  });
  const titulo = marco ? ({ chegada_service: "Chegada no Service", saida_service: "Saída do Service", chegada_xpt: "Chegada no XPT", saida_xpt: "Saída do XPT" } as const)[marco.etapa] : "Registrar etapa";
  return <Dialog open={!!marco} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{titulo}</DialogTitle><DialogDescription>{marco?.transferencia.motorista} · {marco?.transferencia.placa}. A foto é opcional nesta fase.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label>Data e horário reais</Label><Input type="datetime-local" value={horario} onChange={(e) => setHorario(e.target.value)} /></div><div><Label>Localização</Label><Input value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} placeholder="Service ou XPT" /></div><div><Label>Foto opcional</Label><Input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} /></div><div><Label>Link TimeMark opcional</Label><Input type="url" value={timemark} onChange={(e) => setTimemark(e.target.value)} placeholder="https://..." /></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={mutation.isPending} onClick={() => mutation.mutate()}><Camera className="w-4 h-4 mr-2" />{mutation.isPending ? "Registrando…" : "Registrar etapa"}</Button></DialogFooter></DialogContent></Dialog>;
}
