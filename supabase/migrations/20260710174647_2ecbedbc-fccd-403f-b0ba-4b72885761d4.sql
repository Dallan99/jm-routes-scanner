CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

UPDATE auth.users
SET encrypted_password = extensions.crypt(
        'JM@transportes1',
        extensions.gen_salt('bf')
    ),
    updated_at = now()
WHERE email = 'dallan.zanini@jmdistribuicao.com.br';