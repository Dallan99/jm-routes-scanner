# Módulo Transferências — especificação operacional

## Objetivo

Controlar a viagem de transferência entre o Service e a base XPT diretamente no JMRoutes, sem depender de planilhas ou integração com WhatsApp. O módulo registra os horários, as evidências fotográficas, os atrasos e a responsabilidade por etapa.

## Linha do tempo obrigatória

1. **Chegada no Service** — SLA corporativo inicial: até 07:00.
2. **Saída do Service** — SLA corporativo inicial: até 09:00.
3. **Chegada no XPT** — SLA corporativo inicial: até 60 minutos após a saída do Service.

Os marcos só podem ser registrados nessa ordem. O banco impede etapa duplicada e horários cronologicamente incompatíveis.

## Evidência

Cada etapa deve conter:

- foto real do caminhão no local;
- link HTTPS ativo do TimeMark;
- horário e localização informados.

É permitido registrar o horário sem a evidência completa para não interromper a operação. Nesse caso, a transferência recebe o status **Pendente de evidência** e não é tratada como plenamente regular até a complementação. As fotos ficam em bucket privado e são exibidas por URL temporária assinada.

## Responsabilidade pelo atraso

A responsabilidade é registrada por etapa:

- `JM_FROTA` — motorista, veículo, documentação ou operação da frota;
- `MELI` — carregamento, fila/doca, liberação ou sistema do Service;
- `EXTERNO` — trânsito severo, acidente/interdição, clima ou fiscalização;
- `EM_ANALISE` — pendência de apuração;
- `SEM_ATRASO` — derivado pelo sistema quando o marco está dentro do SLA.

O servidor calcula os minutos de atraso. O cliente não pode enviar o valor calculado.

## Perfis e bases

- **Administrador ativo:** visão de todas as bases, relatório geral e configuração de SLA por base + Service.
- **Demais perfis ativos:** somente a base definida em `profiles.base_id`.
- **Usuário inativo ou sem base:** bloqueado.

A autorização é revalidada no banco por `transferencia_base_access`. Alterar `baseId` no navegador não amplia o acesso.

## Relatórios e dashboard

A tela oferece:

- KPIs de volume, andamento, SLA, atrasos, evidências pendentes e tempos médios;
- rankings por responsabilidade, motivo, base e motorista, sempre acompanhados de minutos e quantidade de viagens;
- filtros por período, status, responsabilidade, motivo e busca textual;
- relatório por base ou geral;
- impressão/PDF pelo navegador e exportação CSV compatível com Excel.

Consultas de transferências são paginadas em blocos de 1.000; tabelas filhas são carregadas em lotes para evitar o limite padrão do PostgREST.

## Implantação segura

1. Revisar o PR e a migration `20260714143500_transferencias_module.sql`.
2. Confirmar backup recuperável do Supabase.
3. Aplicar a migration em homologação.
4. Regenerar os tipos do Supabase e comparar com `src/integrations/supabase/types.ts`.
5. Testar com duas bases fictícias e perfis admin/não-admin.
6. Validar upload, leitura privada e complementação de evidência em celular.
7. Executar testes, TypeScript e build.
8. Somente então aplicar em produção e publicar o frontend.

## Critérios de parada

Não publicar se ocorrer qualquer um destes pontos:

- acesso cruzado entre bases para usuário não-admin;
- bucket público ou foto acessível sem URL assinada;
- evento sem auditoria;
- divergência entre atraso calculado e SLA configurado;
- perda de dados ao cancelar;
- falha no fluxo móvel de câmera/upload;
- migration parcialmente aplicada.

## Reversibilidade

Não há `DROP`, `TRUNCATE`, backfill nem exclusão de dados na migration. Antes de existir dado real, os objetos podem ser removidos em ordem inversa. Depois do piloto, o rollback padrão é reverter o frontend e manter tabelas/auditoria intactas; não apagar dados operacionais.
