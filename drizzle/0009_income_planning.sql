create table income_plans (
  id text primary key,
  owner_context text not null,
  name text not null,
  amount_cents integer not null,
  start_month text not null,
  end_month text,
  active boolean not null default true
);

create table monthly_income_overrides (
  id text primary key,
  income_plan_id text not null references income_plans(id),
  month text not null,
  amount_cents integer not null,
  note text
);
