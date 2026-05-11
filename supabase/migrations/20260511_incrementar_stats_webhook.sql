-- Helper para que la edge function notif-webhook actualice stats.

create or replace function public.incrementar_stats_webhook(
  p_webhook_id uuid,
  p_ok         boolean,
  p_status     int,
  p_error      text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.webhooks
     set ultimo_enviado_at = now(),
         ultimo_status     = p_status,
         ultimo_error      = case when p_ok then null else p_error end,
         total_enviados    = total_enviados + 1,
         total_fallidos    = total_fallidos + case when p_ok then 0 else 1 end
   where id = p_webhook_id;
end;
$$;

grant execute on function public.incrementar_stats_webhook(uuid, boolean, int, text)
  to authenticated, service_role;
