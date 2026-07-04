import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Role = "admin" | "supervisor" | "gerente" | "operador";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Falha ao verificar permissões.");
  if (!data) throw new Error("Acesso negado: apenas administradores.");
}

export type UsuarioRow = {
  id: string;
  email: string;
  nome: string;
  matricula: string | null;
  base_id: string | null;
  base_nome: string | null;
  ativo: boolean;
  roles: Role[];
  last_sign_in_at: string | null;
  created_at: string;
};

export const listarUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsuarioRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, email, matricula, base_id, ativo, created_at, bases(nome)")
      .order("created_at", { ascending: false });
    if (pErr) throw new Error(pErr.message);

    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rErr) throw new Error(rErr.message);

    const rolesByUser = new Map<string, Role[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as Role);
      rolesByUser.set(r.user_id, arr);
    }

    // Buscar last_sign_in_at via admin listUsers (paginação simples até 1000)
    const lastByUser = new Map<string, string | null>();
    let page = 1;
    for (;;) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      for (const u of data.users) lastByUser.set(u.id, u.last_sign_in_at ?? null);
      if (data.users.length < 200) break;
      page++;
      if (page > 10) break;
    }

    return (profiles ?? []).map((p: any) => ({
      id: p.id,
      email: p.email,
      nome: p.nome,
      matricula: p.matricula,
      base_id: p.base_id,
      base_nome: p.bases?.nome ?? null,
      ativo: p.ativo,
      roles: rolesByUser.get(p.id) ?? [],
      last_sign_in_at: lastByUser.get(p.id) ?? null,
      created_at: p.created_at,
    }));
  });

const criarSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  nome: z.string().trim().min(2).max(120),
  senha: z.string().min(8).max(72),
  role: z.enum(["admin", "gerente", "supervisor", "operador"]),
  matricula: z.string().trim().max(40).optional().nullable(),
  base_id: z.string().uuid().optional().nullable(),
});

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => criarSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (!data.email.endsWith("@jmdistribuicao.com.br")) {
      throw new Error("Apenas emails @jmdistribuicao.com.br são permitidos.");
    }
    if (data.role === "operador" && !data.base_id) {
      throw new Error("Operadores devem estar vinculados a uma base.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (error) throw new Error(error.message);
    const uid = created.user.id;

    // O trigger handle_new_user cria profile + role 'operador'. Ajustamos.
    await supabaseAdmin
      .from("profiles")
      .update({
        nome: data.nome,
        matricula: data.matricula ?? null,
        base_id: data.base_id ?? null,
      })
      .eq("id", uid);

    if (data.role !== "operador") {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", uid).eq("role", "operador");
      await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    }
    return { ok: true, id: uid };
  });

const atualizarSchema = z.object({
  user_id: z.string().uuid(),
  matricula: z.string().trim().max(40).optional().nullable(),
  base_id: z.string().uuid().optional().nullable(),
  role: z.enum(["admin", "gerente", "supervisor", "operador"]),
});

export const atualizarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => atualizarSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.role === "operador" && !data.base_id) {
      throw new Error("Operadores devem estar vinculados a uma base.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ matricula: data.matricula ?? null, base_id: data.base_id ?? null })
      .eq("id", data.user_id);
    if (upErr) throw new Error(upErr.message);

    // Sincroniza role: remove tudo, insere a nova
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (rErr) throw new Error(rErr.message);
    return { ok: true };
  });

const toggleSchema = z.object({ user_id: z.string().uuid(), ativo: z.boolean() });

export const setUsuarioAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => toggleSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId && !data.ativo) {
      throw new Error("Você não pode desativar sua própria conta.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ ativo: data.ativo }).eq("id", data.user_id);
    // Bloqueia login via ban se desativado
    await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.ativo ? "none" : "876000h",
    });
    return { ok: true };
  });

const resetSchema = z.object({ user_id: z.string().uuid(), senha: z.string().min(8).max(72) });

export const resetSenhaUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => resetSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.senha,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const excluirSchema = z.object({ user_id: z.string().uuid() });

export const excluirUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => excluirSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) {
      throw new Error("Você não pode excluir sua própria conta.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Remove role admin primeiro (trigger prevent_admin_role_grant permite service_role)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listarBasesUsuario = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("bases")
      .select("id, codigo, nome, cidade, uf")
      .order("codigo");
    if (error) throw new Error(error.message);
    return data ?? [];
  });