create table if not exists profiles (
  user_id text primary key,
  email text,
  display_name text,
  invite_code text not null unique,
  birthday text,
  pair_id text,
  created_at timestamptz not null default now()
);

create table if not exists pairs (
  id text primary key,
  a_user_id text not null,
  b_user_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_invite_code_idx on profiles (invite_code);
create index if not exists pairs_a_user_id_idx on pairs (a_user_id);
create index if not exists pairs_b_user_id_idx on pairs (b_user_id);
