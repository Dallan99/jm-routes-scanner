import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { beepError, beepOk, beepWarn } from "@/lib/scanner-sound";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Printer, RotateCcw, ScanLine, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/contagem")({
  head: () => ({ meta: [{ title: "Contagem Manual — JM Transportes" }] }),
  component: ContagemManualPage,
});

type Leitura = {
  id: string;
  codigo: string;
  hora: string;
  status: "ok" | "duplicado" | "fora_padrao";
};

const DEDUPE_MS = 700;

// Padrão Mercado Livre: normalmente códigos numéricos longos (>= 10 dígitos)
// ou prefixos MLB/ML. Ajuste conforme necessário.
function isPadraoML(codigo: string): boolean {
  const c = codigo.trim().toUpperCase();
  if (/^\d{10,}$/.test(c)) return true;
  if (/^ML[AB]?\d{6,}/.test(c)) return true;
  if (/^[0-9]{8,}[A-Z0-9]{0,6}$/.test(c) && /\d{8,}/.test(c)) return true;
  return false;
}

function ContagemManualPage() {
  const [rota, setRota] = useState("");
  const [previsto, setPrevisto] = useState<number>(0);
  const [iniciado, setIniciado] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [leituras, setLeituras] = useState<Leitura[]>([]);
  const [flash, setFlash] = useState<"ok" | "error" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastBipRef = useRef<{ codigo: string; ts: number } | null>(null);

  const bipadosOk = useMemo(() => leituras.filter((l) => l.status !== "duplicado").length, [leituras]);
  const percentual = previsto > 0 ? Math.min(100, Math.round((bipadosOk / previsto) * 100)) : 0;
  const restantes = Math.max(0, previsto - bipadosOk);

  const iniciar = () => {
    if (!rota.trim()) return toast.error("Informe o nome da rota.");
    if (!previsto || previsto <= 0) return toast.error("Informe a quantidade de volumes.");
    setIniciado(true);
    setLeituras([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const resetar = () => {
    if (leituras.length > 0 && !confirm("Descartar contagem atual?")) return;
    setIniciado(false);
    setLeituras([]);
    setCodigo("");
    lastBipRef.current = null;
  };

  const submit = useCallback(
    (cod: string) => {
      const trimmed = cod.trim();
      if (trimmed.length < 3) return;
      const now = Date.now();
      if (lastBipRef.current && lastBipRef.current.codigo === trimmed && now - lastBipRef.current.ts < DEDUPE_MS) {
        setCodigo("");
        inputRef.current?.focus();
        return;
      }
      lastBipRef.current = { codigo: trimmed, ts: now };

      const duplicado = leituras.some((l) => l.codigo === trimmed && l.status !== "duplicado");
      const foraPadrao = !isPadraoML(trimmed);
      const status: Leitura["status"] = duplicado ? "duplicado" : foraPadrao ? "fora_padrao" : "ok";

      const leitura: Leitura = {
        id: crypto.randomUUID(),
        codigo: trimmed,
        hora: new Date().toISOString(),
        status,
      };
      setLeituras((prev) => [leitura, ...prev]);

      if (status === "ok") {
        beepOk();
        setFlash("ok");
      } else if (status === "duplicado") {
        beepError();
        setFlash("error");
        toast.warning(`Volume duplicado: ${trimmed}`);
      } else {
        beepWarn();
        setFlash("ok");
        toast.warning(`Etiqueta fora do padrão Mercado Livre: ${trimmed}`);
      }
      setTimeout(() => setFlash(null), 500);
      setCodigo("");
      inputRef.current?.focus();
    },
    [leituras],
  );

  useEffect(() => {
    if (!iniciado) return;
    const focus = () => inputRef.current?.focus();
    focus();
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("button, a, input, textarea, [role=button]")) return;
      focus();
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [iniciado]);

  const removerLeitura = (id: string) => {
    setLeituras((prev) => prev.filter((l) => l.id !== id));
  };

  const imprimir = () => {
    window.print();
  };

  const flashClass = flash === "ok" ? "scan-flash-ok" : flash === "error" ? "scan-flash-error" : "";

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 16px; }
          .no-print { display: none !important; }
        }
      `}</style>

      {!iniciado ? (
        <Card className="p-6 md:p-8 no-print">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-md brand-gradient flex items-center justify-center">
              <ScanLine className="w-5 h-5 text-[var(--brand-yellow)]" />
            </div>
            <div>
              <h1 className="font-display text-xl md:text-2xl font-bold">Contagem Manual</h1>
              <p className="text-xs md:text-sm text-muted-foreground">
                Conferência de volumes sem escala importada. Informe a rota e a quantidade prevista.
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rota">Nome da rota</Label>
              <Input
                id="rota"
                value={rota}
                onChange={(e) => setRota(e.target.value.toUpperCase())}
                placeholder="Ex.: AV1_AM1"
                className="h-12 font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qtd">Quantidade de volumes prevista</Label>
              <Input
                id="qtd"
                type="number"
                min={1}
                value={previsto || ""}
                onChange={(e) => setPrevisto(parseInt(e.target.value || "0", 10))}
                placeholder="Ex.: 105"
                className="h-12"
              />
            </div>
          </div>
          <Button onClick={iniciar} size="lg" className="mt-6 w-full md:w-auto">
            Iniciar contagem
          </Button>
        </Card>
      ) : (
        <>
          <Card className={`p-6 md:p-8 ${flashClass} no-print`}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Rota</div>
                <div className="font-display text-2xl font-bold font-mono">{rota}</div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Progresso</div>
                <div className="font-display text-2xl">
                  <span className="font-bold">{bipadosOk}</span>
                  <span className="text-muted-foreground"> / {previsto}</span>
                  <span className="ml-2 text-sm text-muted-foreground">({percentual}%)</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {restantes > 0 ? `Faltam ${restantes} volume(s)` : bipadosOk === previsto ? "Contagem completa" : `${bipadosOk - previsto} a mais que o previsto`}
                </div>
              </div>
            </div>
            <Progress value={percentual} className="h-3 mb-4" />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(codigo);
              }}
              className="flex gap-2"
            >
              <Input
                ref={inputRef}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                autoFocus
                spellCheck={false}
                autoComplete="off"
                placeholder="Aguardando leitura..."
                className="h-14 text-xl font-mono tracking-wider"
              />
              <Button type="submit" size="lg" className="h-14 px-8">Bipar</Button>
            </form>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button variant="outline" onClick={imprimir}><Printer className="w-4 h-4 mr-2" />Imprimir relatório</Button>
              <Button variant="outline" onClick={resetar}><RotateCcw className="w-4 h-4 mr-2" />Nova contagem</Button>
            </div>
          </Card>

          <Card className="p-4 md:p-6" id="print-area">
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <div>
                <h2 className="font-display text-lg font-bold">Relatório de Contagem Manual</h2>
                <div className="text-sm text-muted-foreground">
                  Rota <span className="font-mono font-bold">{rota}</span> · Previsto: {previsto} · Bipado: {bipadosOk} · Duplicados: {leituras.filter((l) => l.status === "duplicado").length} · Fora do padrão: {leituras.filter((l) => l.status === "fora_padrao").length}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Gerado em {new Date().toLocaleString("pt-BR")}
                </div>
              </div>
            </div>
            <div className="divide-y">
              {leituras.map((l, idx) => (
                <div key={l.id} className="py-2 flex items-center gap-3 text-sm">
                  <span className="font-mono text-xs text-muted-foreground w-8 shrink-0 text-right">{leituras.length - idx}</span>
                  <StatusIcon status={l.status} />
                  <span className="font-mono text-sm flex-1 truncate">{l.codigo}</span>
                  <span className="text-xs text-muted-foreground font-mono w-20 shrink-0">
                    {new Date(l.hora).toLocaleTimeString("pt-BR")}
                  </span>
                  <StatusBadge status={l.status} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="no-print h-7 w-7 p-0"
                    onClick={() => removerLeitura(l.id)}
                    aria-label="Remover"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              {leituras.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma leitura ainda.</div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: Leitura["status"] }) {
  if (status === "ok") return <CheckCircle2 className="w-4 h-4 text-success shrink-0" />;
  if (status === "duplicado") return <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />;
  return <AlertTriangle className="w-4 h-4 text-warning shrink-0" />;
}

function StatusBadge({ status }: { status: Leitura["status"] }) {
  if (status === "ok") return <Badge className="bg-success text-success-foreground text-[10px]">OK</Badge>;
  if (status === "duplicado") return <Badge className="bg-destructive text-destructive-foreground text-[10px]">DUPLICADO</Badge>;
  return <Badge className="bg-warning text-warning-foreground text-[10px]">FORA DO PADRÃO</Badge>;
}