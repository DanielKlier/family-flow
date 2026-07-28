create table if not exists accounts (
  id text primary key,
  name text not null,
  owner_context text not null check (owner_context in ('person_a', 'person_b', 'shared'))
);

create table if not exists categories (
  id text primary key,
  name text not null
);
