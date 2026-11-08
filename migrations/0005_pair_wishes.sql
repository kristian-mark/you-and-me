create table if not exists pair_wishes (
  id text primary key,
  pair_id text not null,
  owner_user_id text,
  title text not null,
  fulfilled boolean not null default false,
  payload text not null default '{}',
  updated_at timestamptz not null default now()
);

create index if not exists pair_wishes_pair_id_idx on pair_wishes (pair_id);
