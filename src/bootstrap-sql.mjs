export const bootstrapSqlByRpc = {
  export_policies: `-- Export policies for automated sync (service_role only)
create or replace function public.export_policies()
returns table(line text)
language sql
security definer
set search_path = public, pg_catalog
as $$
with policies as (
  select schemaname, tablename, policyname, cmd, roles, qual, with_check
  from pg_policies
  where schemaname = 'public'
),
rls as (
  select distinct schemaname, tablename,
    'alter table ' || schemaname || '.' || tablename || ' enable row level security;' as line
  from policies
),
policy_lines as (
  select schemaname, tablename, policyname, 1 as seq,
    '-- ' || schemaname || '.' || tablename || ' / ' || policyname as line
  from policies
  union all
  select schemaname, tablename, policyname, 2 as seq,
    'create policy "' || policyname || '" on ' || schemaname || '.' || tablename ||
    ' for ' || lower(cmd) ||
    case when roles is null then '' else ' to ' || array_to_string(roles, ', ') end ||
    case when qual is null then '' else ' using (' || qual || ')' end ||
    case when with_check is null then '' else ' with check (' || with_check || ')' end ||
    ';' as line
  from policies
)
select line
from (
  select 1 as section, schemaname, tablename, null::text as policyname, 1 as seq, line
  from rls
  union all
  select 2 as section, null::text, null::text, null::text, 1 as seq, '' as line
  union all
  select 3 as section, schemaname, tablename, policyname, seq, line
  from policy_lines
) t
order by section, schemaname, tablename, policyname, seq;
$$;

revoke all on function public.export_policies() from public;
grant execute on function public.export_policies() to service_role;
`,
  export_functions: `-- Export SQL functions for automated sync (service_role only)
create or replace function public.export_functions()
returns table(line text)
language sql
security definer
set search_path = public, pg_catalog
as $$
with funcs as (
  select p.oid, n.nspname as schemaname, p.proname as functionname,
    pg_get_functiondef(p.oid) as def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
  order by p.proname
),
lines as (
  select oid, schemaname, functionname, ord, line
  from funcs,
  lateral regexp_split_to_table(def, E'\\n') with ordinality as t(line, ord)
),
output as (
  select 1 as section, schemaname, functionname, ord, line
  from lines
  union all
  select 2 as section, schemaname, functionname, 999999 as ord, '' as line
  from funcs
)
select line
from output
order by schemaname, functionname, section, ord;
$$;

revoke all on function public.export_functions() from public;
grant execute on function public.export_functions() to service_role;
`,
  export_schema_lean: `-- Export a lean schema definition (tables/columns/constraints/indexes)
-- for automated sync (service_role only)
create or replace function public.export_schema_lean()
returns table(line text)
language sql
security definer
set search_path = public, pg_catalog
as $$
with tables as (
  select c.oid, c.relname as table_name
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname
),
cols as (
  select t.table_name,
    a.attname as column_name,
    format_type(a.atttypid, a.atttypmod) as data_type,
    a.attnotnull as not_null,
    pg_get_expr(ad.adbin, ad.adrelid) as default_expr,
    a.attnum,
    count(*) over (partition by t.table_name) as col_count,
    row_number() over (partition by t.table_name order by a.attnum) as col_num
  from tables t
  join pg_attribute a on a.attrelid = t.oid
  left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
  where a.attnum > 0 and not a.attisdropped
),
table_lines as (
  select table_name, 1 as section, 1 as ord, 'create table public.' || table_name || ' (' as line
  from tables
  union all
  select table_name, 1 as section, 2 + col_num as ord,
    '  ' || column_name || ' ' || data_type ||
    case when default_expr is not null then ' default ' || default_expr else '' end ||
    case when not_null then ' not null' else '' end ||
    case when col_num < col_count then ',' else '' end as line
  from cols
  union all
  select table_name, 1 as section, 1000000 as ord, ');' as line
  from tables
  union all
  select table_name, 1 as section, 1000001 as ord, '' as line
  from tables
),
constraints as (
  select t.table_name,
    c.conname,
    pg_get_constraintdef(c.oid) as condef
  from tables t
  join pg_constraint c on c.conrelid = t.oid
  order by t.table_name, c.conname
),
constraint_lines as (
  select table_name, 2 as section,
    row_number() over (partition by table_name order by conname) as ord,
    'alter table public.' || table_name ||
    ' add constraint ' || conname || ' ' || condef || ';' as line
  from constraints
  union all
  select table_name, 2 as section, 1000000 as ord, '' as line
  from constraints
  group by table_name
),
indexes as (
  select t.table_name, i.relname as index_name, pg_get_indexdef(i.oid) as indexdef
  from tables t
  join pg_index ix on ix.indrelid = t.oid
  join pg_class i on i.oid = ix.indexrelid
  left join pg_constraint c on c.conindid = ix.indexrelid
  where c.oid is null
  order by t.table_name, i.relname
),
index_lines as (
  select table_name, 3 as section,
    row_number() over (partition by table_name order by index_name) as ord,
    indexdef || ';' as line
  from indexes
  union all
  select table_name, 3 as section, 1000000 as ord, '' as line
  from indexes
  group by table_name
),
col_comments as (
  select t.table_name, a.attname as column_name, d.description
  from tables t
  join pg_attribute a on a.attrelid = t.oid
  join pg_description d on d.objoid = t.oid and d.objsubid = a.attnum
  where a.attnum > 0 and not a.attisdropped
  order by t.table_name, a.attnum
),
comment_lines as (
  select table_name, 4 as section,
    row_number() over (partition by table_name order by column_name) as ord,
    'COMMENT ON COLUMN public.' || table_name || '.' || column_name ||
    ' IS ' || quote_literal(description) || ';' as line
  from col_comments
  union all
  select table_name, 4 as section, 1000000 as ord, '' as line
  from col_comments
  group by table_name
)
select line
from (
  select table_name, section, ord, line from table_lines
  union all
  select table_name, section, ord, line from constraint_lines
  union all
  select table_name, section, ord, line from index_lines
  union all
  select table_name, section, ord, line from comment_lines
) t
order by table_name, section, ord;
$$;

revoke all on function public.export_schema_lean() from public;
grant execute on function public.export_schema_lean() to service_role;
`,
};
