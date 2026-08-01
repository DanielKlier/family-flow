alter table accounts add column if not exists active boolean not null default true;
alter table categories add column if not exists active boolean not null default true;
