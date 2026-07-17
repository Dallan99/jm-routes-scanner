CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1) Rotate seed admin password
-- Invalida a senha em texto simples registrada no histórico da migration.
UPDATE auth.users
   SET encrypted_password = extensions.crypt(
         extensions.gen_random_uuid()::text
         || extensions.gen_random_uuid()::text,
         extensions.gen_salt('bf')
       ),
       updated_at = now()
 WHERE email = 'dallan.zanini@jmdistribuicao.com.br';

-- 2) Column-level protection for PII on motoristas.
-- RLS não restringe colunas; por isso, removemos o SELECT geral
-- e liberamos somente as colunas não sensíveis.
REVOKE SELECT ON public.motoristas FROM authenticated;

GRANT SELECT (
  id,
  nome,
  placa,
  transportadora,
  base_id,
  ativo,
  created_at
) ON public.motoristas TO authenticated;

-- Mantém permissões de escrita para os campos gerenciados pela equipe.
GRANT INSERT, UPDATE, DELETE
ON public.motoristas
TO authenticated;

-- service_role mantém acesso total para operações administrativas.
GRANT ALL
ON public.motoristas
TO service_role;