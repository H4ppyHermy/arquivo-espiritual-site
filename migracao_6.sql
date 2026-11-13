-- Beta 2.6 — Broadcast após mudança de revisão.
-- Evento sem dados privados; clientes consultam ae_read_document com as permissões próprias.
create or replace function public.ae_document_changed_notify()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
 if new.revision is distinct from old.revision then
   perform realtime.send(jsonb_build_object('revision',new.revision),'document-changed','ae-live-notify',true);
 end if;
 return new;
end;
$function$;
revoke all on function public.ae_document_changed_notify() from public,anon,authenticated;
drop trigger if exists ae_document_changed_notify_trigger on public.ae_document;
create trigger ae_document_changed_notify_trigger
after update of revision on public.ae_document
for each row execute function public.ae_document_changed_notify();
