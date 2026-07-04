import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const inputSchema = z.object({
  periodo: z.enum(["hoje", "7d", "30d"]).default("7d"),
});

export type OperadorProd = {
  operador_id: string;
  nome: string;
  total_leituras: number;
  ok: number;
  erros: number;
  rotas_atendidas: number;
  tempo_medio_ms: number | null;
  taxa_acerto: number;
};

export type GerencialData = {
  periodo: "hoje" | "7d" | "30d";
  totais: {
    total_leituras: number;
    ok: number;
    erros: number;
    operadores_ativos: number;
    tempo_medio_ms: number | null;
  };
  porOperador: OperadorProd[];
  top3: OperadorProd[];
  bottom3: OperadorProd[];
  porDia: { dia: string; total: number; ok: number; erros: number }[];
  comparativo: { operador: string; hoje: number; semana: number; mes: number }[];
};

function inicioPeriodo(p: "hoje" | "7d" | "30d") {
  const now = new Date();
  if (p === "hoje") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const dias = p === "7d" ? 7 : 30;
  return new Date(now.getTime() - dias * 24 * 3600 * 1000);
}

export const gerencialData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<GerencialData> => {
    const { supabase } = context;
    const desde = inicioPeriodo(data.periodo);

    const inicioHoje = inicioPeriodo("hoje");
    const inicioSemana = inicioPeriodo("7d");
    const inicioMes = inicioPeriodo("30d");

    const { data: recebimentos, error } = await supabase
      .from("recebimentos")
      .select("created_at, resultado, tempo_desde_ultima_ms, operador_id, rota_id")
      .gte("created_at", inicioMes.toISOString())
      .order("created_at", { ascending: false })
      .limit(20000);
    if (error) throw new Error(error.message);

    type Rec = {
      created_at: string;
      resultado: string;
      tempo_desde_ultima_ms: number | null;
      operador_id: string | null;
      rota_id: string | null;
    };
    const all = (recebimentos ?? []) as Rec[];
    const periodoRows = all.filter((r) => new Date(r.created_at) >= desde);

    const operadorIds = Array.from(
      new Set(all.map((r) => r.operador_id).filter(Boolean)),
    ) as string[];
    const { data: profs } = operadorIds.length
      ? await supabase.from("profiles").select("id, nome, email").in("id", operadorIds)
      : { data: [] as { id: string; nome: string; email: string }[] };
    const perfilMap = new Map((profs ?? []).map((p) => [p.id, p.nome ?? p.email ?? "—"] as const));

    const OK = new Set(["ok", "primeira_leitura", "concluiu_rota"]);

    // Agrupamento por operador no período
    const grupos = new Map<string, Rec[]>();
    for (const r of periodoRows) {
      if (!r.operador_id) continue;
      const arr = grupos.get(r.operador_id) ?? [];
      arr.push(r);
      grupos.set(r.operador_id, arr);
    }

    const porOperador: OperadorProd[] = Array.from(grupos.entries()).map(([id, arr]) => {
      const ok = arr.filter((r) => OK.has(r.resultado)).length;
      const total = arr.length;
      const erros = total - ok;
      const rotas = new Set(arr.map((r) => r.rota_id).filter(Boolean)).size;
      const tempos = arr.map((r) => r.tempo_desde_ultima_ms).filter((v): v is number => typeof v === "number" && v > 0 && v < 300000);
      const tempoMedio = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null;
      return {
        operador_id: id,
        nome: perfilMap.get(id) ?? "—",
        total_leituras: total,
        ok,
        erros,
        rotas_atendidas: rotas,
        tempo_medio_ms: tempoMedio,
        taxa_acerto: total ? (ok / total) * 100 : 0,
      };
    });
    porOperador.sort((a, b) => b.total_leituras - a.total_leituras);

    const totais = {
      total_leituras: periodoRows.length,
      ok: periodoRows.filter((r) => OK.has(r.resultado)).length,
      erros: periodoRows.filter((r) => !OK.has(r.resultado)).length,
      operadores_ativos: porOperador.length,
      tempo_medio_ms: (() => {
        const t = periodoRows.map((r) => r.tempo_desde_ultima_ms).filter((v): v is number => typeof v === "number" && v > 0 && v < 300000);
        return t.length ? t.reduce((a, b) => a + b, 0) / t.length : null;
      })(),
    };

    // Série por dia
    const porDiaMap = new Map<string, { total: number; ok: number; erros: number }>();
    for (const r of periodoRows) {
      const dia = r.created_at.slice(0, 10);
      const cur = porDiaMap.get(dia) ?? { total: 0, ok: 0, erros: 0 };
      cur.total++;
      if (OK.has(r.resultado)) cur.ok++;
      else cur.erros++;
      porDiaMap.set(dia, cur);
    }
    const porDia = Array.from(porDiaMap.entries())
      .map(([dia, v]) => ({ dia, ...v }))
      .sort((a, b) => a.dia.localeCompare(b.dia));

    // Comparativo hoje / semana / mês por operador (top 10)
    const contar = (rows: Rec[], id: string) => rows.filter((r) => r.operador_id === id).length;
    const rowsHoje = all.filter((r) => new Date(r.created_at) >= inicioHoje);
    const rowsSem = all.filter((r) => new Date(r.created_at) >= inicioSemana);
    const rowsMes = all;
    const comparativo = porOperador.slice(0, 10).map((op) => ({
      operador: op.nome,
      hoje: contar(rowsHoje, op.operador_id),
      semana: contar(rowsSem, op.operador_id),
      mes: contar(rowsMes, op.operador_id),
    }));

    return {
      periodo: data.periodo,
      totais,
      porOperador,
      top3: porOperador.slice(0, 3),
      bottom3: [...porOperador].filter((o) => o.total_leituras > 0).sort((a, b) => a.total_leituras - b.total_leituras).slice(0, 3),
      porDia,
      comparativo,
    };
  });
