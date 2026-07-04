import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type BaseResumo = {
  id: string;
  codigo: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  total_escalas: number;
  total_pacotes: number;
  ultima_importacao: string | null;
};

export const listarBasesComResumo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BaseResumo[]> => {
    const { supabase } = context;
    const { data: bases, error } = await supabase
      .from("bases")
      .select("id, codigo, nome, cidade, uf")
      .order("codigo");
    if (error) throw new Error(error.message);

    const { data: esc } = await supabase
      .from("escalas")
      .select("base_id, pacotes, created_at");

    const map = new Map<string, { total: number; pacotes: number; ultima: string | null }>();
    for (const e of esc ?? []) {
      const cur = map.get(e.base_id) ?? { total: 0, pacotes: 0, ultima: null };
      cur.total += 1;
      cur.pacotes += e.pacotes ?? 0;
      if (!cur.ultima || (e.created_at && e.created_at > cur.ultima)) cur.ultima = e.created_at;
      map.set(e.base_id, cur);
    }

    return (bases ?? []).map((b) => {
      const m = map.get(b.id);
      return {
        id: b.id,
        codigo: b.codigo,
        nome: b.nome,
        cidade: b.cidade,
        uf: b.uf,
        total_escalas: m?.total ?? 0,
        total_pacotes: m?.pacotes ?? 0,
        ultima_importacao: m?.ultima ?? null,
      };
    });
  });

const linhaSchema = z.object({
  planejada: z.string().nullish(),
  otimizada: z.string().nullish(),
  pacotes: z.number().int().nullish(),
  paradas: z.number().int().nullish(),
  modal: z.string().nullish(),
  bairro: z.string().nullish(),
  cidade: z.string().nullish(),
  giro: z.string().nullish(),
  vaga: z.string().nullish(),
  tipo: z.string().nullish(),
  roteiro: z.string().nullish(),
  placa: z.string().nullish(),
  driver: z.string().nullish(),
  placa_troca: z.string().nullish(),
});

const importSchema = z.object({
  baseId: z.string().uuid(),
  dataReferencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  substituir: z.boolean().default(false),
  linhas: z.array(linhaSchema).min(1).max(2000),
});

export const importarEscala = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => importSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const dataRef = data.dataReferencia ?? new Date().toISOString().slice(0, 10);

    if (data.substituir) {
      await supabase.from("escalas").delete().eq("base_id", data.baseId).eq("data_referencia", dataRef);
    }

    const rows = data.linhas.map((l) => ({
      base_id: data.baseId,
      data_referencia: dataRef,
      planejada: l.planejada ?? null,
      otimizada: l.otimizada ?? null,
      pacotes: l.pacotes ?? null,
      paradas: l.paradas ?? null,
      modal: l.modal ?? null,
      bairro: l.bairro ?? null,
      cidade: l.cidade ?? null,
      giro: l.giro ?? null,
      vaga: l.vaga ?? null,
      tipo: l.tipo ?? null,
      roteiro: l.roteiro ?? null,
      placa: l.placa ?? null,
      driver: l.driver ?? null,
      placa_troca: l.placa_troca ?? null,
      importado_por: userId,
    }));

    const { error } = await supabase.from("escalas").insert(rows);
    if (error) throw new Error(error.message);
    return { inseridos: rows.length, dataReferencia: dataRef };
  });

export const listarEscalaPorBase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { baseId: string }) => z.object({ baseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("escalas")
      .select("id, data_referencia, planejada, otimizada, pacotes, paradas, modal, bairro, cidade, giro, vaga, tipo, roteiro, placa, driver, placa_troca, created_at")
      .eq("base_id", data.baseId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });