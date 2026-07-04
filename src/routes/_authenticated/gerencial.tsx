import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { gerencialData, type OperadorProd } from "@/lib/gerencial.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Line, LineChart, Legend,
} from "recharts";
import { Activity, AlertTriangle, Award, Clock, PackageCheck, TrendingDown, TrendingUp, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/gerencial")({
  head: () => ({ meta: [{ title: "Dashboard Gerencial — JM Transportes" }] }),
  component: GerencialPage,
});

type Periodo = "hoje" | "7d" | "30d";

function GerencialPage() {
  const [periodo, setPeriodo] = useState<Periodo>("7d");
  const fn = useServerFn(gerencialData);
  const q = useQuery({
    queryKey: ["gerencial", periodo],
    queryFn: () => fn({ data: { periodo } }),
    refetchInterval: 30_000,
  });
  const d = q.data;

  const fmtTempo = (ms: number | null) => (ms ? `${(ms / 1000).toFixed(1)}s` : "—");
  const fmtPct = (v: number) => `${v.toFixed(1)}%`;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Dashboard Gerencial</h1>
          <p className="text-sm text-muted-foreground">
            Produtividade por operador, comparativos e ranking de desempenho.
          </p>
        </div>
        <div className="inline-flex rounded-md border border-border bg-card p-1">
          {(["hoje", "7d", "30d"] as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-3 py-1.5 text-sm rounded ${
                periodo === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "hoje" ? "Hoje" : p === "7d" ? "7 dias" : "30 dias"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <Kpi label="Total leituras" value={d?.totais.total_leituras ?? "—"} icon={Activity} />
        <Kpi label="Sucesso" value={d?.totais.ok ?? "—"} icon={PackageCheck} accent="success" />
        <Kpi label="Erros/Divergências" value={d?.totais.erros ?? "—"} icon={AlertTriangle} accent="destructive" />
        <Kpi label="Operadores ativos" value={d?.totais.operadores_ativos ?? "—"} icon={Users} accent="info" />
        <Kpi label="Tempo médio/leitura" value={fmtTempo(d?.totais.tempo_medio_ms ?? null)} icon={Clock} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-success" />
            <h2 className="text-sm font-semibold">Top 3 — mais produtivos</h2>
          </div>
          <RankingLista rows={d?.top3 ?? []} tipo="top" />
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-warning" />
            <h2 className="text-sm font-semibold">Bottom 3 — atenção necessária</h2>
          </div>
          <RankingLista rows={d?.bottom3 ?? []} tipo="bottom" />
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">Evolução diária</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={d?.porDia ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="ok" name="Sucesso" stroke="var(--success)" strokeWidth={2} />
              <Line type="monotone" dataKey="erros" name="Erros" stroke="var(--destructive)" strokeWidth={2} />
              <Line type="monotone" dataKey="total" name="Total" stroke="var(--brand-navy)" strokeWidth={2} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Comparativo Hoje × 7 dias × 30 dias (Top 10)</h2>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={d?.comparativo ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="operador" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="hoje" name="Hoje" fill="var(--brand-yellow)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="semana" name="7 dias" fill="var(--brand-navy)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="mes" name="30 dias" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">Produtividade por operador — {periodo === "hoje" ? "hoje" : periodo === "7d" ? "últimos 7 dias" : "últimos 30 dias"}</h2>
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Operador</th>
                <th className="py-2 pr-3 text-right">Leituras</th>
                <th className="py-2 pr-3 text-right">Sucesso</th>
                <th className="py-2 pr-3 text-right">Erros</th>
                <th className="py-2 pr-3 text-right">Rotas</th>
                <th className="py-2 pr-3 text-right">Taxa acerto</th>
                <th className="py-2 pr-3 text-right">Tempo médio</th>
              </tr>
            </thead>
            <tbody>
              {(d?.porOperador ?? []).map((op, i) => (
                <tr key={op.operador_id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 pr-3 font-medium">{op.nome}</td>
                  <td className="py-2 pr-3 text-right font-mono">{op.total_leituras}</td>
                  <td className="py-2 pr-3 text-right font-mono text-success">{op.ok}</td>
                  <td className="py-2 pr-3 text-right font-mono text-destructive">{op.erros}</td>
                  <td className="py-2 pr-3 text-right font-mono">{op.rotas_atendidas}</td>
                  <td className="py-2 pr-3 text-right">
                    <Badge variant={op.taxa_acerto >= 95 ? "default" : op.taxa_acerto >= 85 ? "secondary" : "destructive"}>
                      {fmtPct(op.taxa_acerto)}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 text-right font-mono">{fmtTempo(op.tempo_medio_ms)}</td>
                </tr>
              ))}
              {!q.isLoading && (d?.porOperador?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    Sem leituras no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {q.isLoading && <p className="text-center text-sm text-muted-foreground">Carregando…</p>}
      {q.error && (
        <Card className="p-4 border-destructive">
          <p className="text-sm text-destructive">Erro ao carregar dados: {(q.error as Error).message}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => q.refetch()}>Tentar novamente</Button>
        </Card>
      )}
    </div>
  );
}

function RankingLista({ rows, tipo }: { rows: OperadorProd[]; tipo: "top" | "bottom" }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Sem dados no período.</p>;
  return (
    <ol className="space-y-2">
      {rows.map((op, i) => (
        <li key={op.operador_id} className="flex items-center justify-between gap-3 p-2 rounded bg-muted/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${
              tipo === "top"
                ? i === 0 ? "bg-[var(--brand-yellow)] text-[var(--brand-navy)]" : "bg-muted text-foreground"
                : "bg-warning/20 text-warning"
            }`}>{i + 1}</div>
            <div className="min-w-0">
              <div className="font-medium truncate">{op.nome}</div>
              <div className="text-xs text-muted-foreground">{op.rotas_atendidas} rota(s) · {op.taxa_acerto.toFixed(0)}% acerto</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display font-bold text-lg">{op.total_leituras}</div>
            <div className="text-[10px] text-muted-foreground uppercase">leituras</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Kpi({
  label, value, icon: Icon, accent,
}: {
  label: string; value: string | number;
  icon: typeof Activity;
  accent?: "success" | "warning" | "destructive" | "info";
}) {
  const ring =
    accent === "success" ? "text-success"
    : accent === "warning" ? "text-warning"
    : accent === "destructive" ? "text-destructive"
    : accent === "info" ? "text-[var(--info)]"
    : "text-primary";
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        <Icon className={`w-4 h-4 ${ring}`} />
      </div>
      <div className="font-display text-2xl md:text-3xl font-bold">{value}</div>
    </Card>
  );
}
