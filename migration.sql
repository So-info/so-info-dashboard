-- SO INFO — migration additive de préparation
-- À exécuter dans Supabase > SQL Editor uniquement après sauvegarde.
-- Ne supprime aucune table, carte, fonction ni historique existant.
alter table public.customers
  add column if not exists company text,
  add column if not exists address text,
  add column if not exists postcode text,
  add column if not exists city text,
  add column if not exists notes text;

-- Unicité : une seule carte par client. À exécuter seulement si aucun doublon
-- n'existe déjà dans loyalty_cards (vérification fournie ci-dessous).
-- select customer_id, count(*) from public.loyalty_cards group by customer_id having count(*) > 1;
create unique index if not exists loyalty_cards_customer_id_uidx
  on public.loyalty_cards(customer_id);

create table if not exists public.management_documents (
  id uuid primary key,
  type text not null check (type in ('quote','invoice','intake')),
  number text not null,
  document_date text,
  validity integer,
  due_date text,
  customer_id uuid references public.customers(id) on delete restrict,
  subject text,
  payload jsonb not null default '{}'::jsonb,
  status text,
  issued boolean not null default false,
  created_at timestamptz,
  updated_at timestamptz,
  unique(type, number)
);

alter table public.management_documents enable row level security;
drop policy if exists "admin_manage_management_documents" on public.management_documents;
create policy "admin_manage_management_documents"
on public.management_documents for all to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

grant select, insert, update, delete on public.management_documents to authenticated;
