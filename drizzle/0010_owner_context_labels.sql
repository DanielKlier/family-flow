create table owner_context_labels (
  owner_context text primary key,
  label text not null
);

insert into owner_context_labels (owner_context, label)
values
  ('person_a', 'Person A'),
  ('person_b', 'Person B'),
  ('shared', 'Shared')
on conflict (owner_context) do nothing;
