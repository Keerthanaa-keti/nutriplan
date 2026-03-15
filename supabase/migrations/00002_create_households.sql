create extension if not exists pgcrypto;

create or replace function nanoid(size int default 8)
returns text as $$
declare
  id text := '';
  i int := 0;
  alphabet char[] := '{0,1,2,3,4,5,6,7,8,9,a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z}';
begin
  while i < size loop
    id := id || alphabet[1 + (random() * 61)::int];
    i := i + 1;
  end loop;
  return id;
end;
$$ language plpgsql;

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our Home',
  invite_code text unique not null default nanoid(8),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table household_members (
  household_id uuid references households(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  role text check (role in ('owner', 'member')) default 'member',
  joined_at timestamptz default now(),
  primary key (household_id, profile_id)
);

alter table households enable row level security;
alter table household_members enable row level security;

create policy "Members can view household" on households for select
  using (id in (select household_id from household_members where profile_id = auth.uid()));
create policy "Owner can update household" on households for update
  using (created_by = auth.uid());
create policy "Authenticated users can create household" on households for insert
  with check (auth.uid() is not null);

create policy "Members can view members" on household_members for select
  using (household_id in (select household_id from household_members where profile_id = auth.uid()));
create policy "Can join household" on household_members for insert
  with check (profile_id = auth.uid());
