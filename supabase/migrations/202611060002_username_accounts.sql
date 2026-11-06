-- Username-only accounts. No real email addresses or mail delivery.
-- Apply before enabling signup without email confirmation.
begin;
create function public.atlas_validate_identity() returns trigger
language plpgsql set search_path = '' as $$
declare username text := new.raw_user_meta_data->>'username';
begin
  if username is null or username !~ '^[a-z][a-z0-9_]{2,23}$'
     or new.email is distinct from ('atlas.' || username || '@accounts.invalid') then
    raise exception 'Invalid Atlas username identity';
  end if;
  if tg_op = 'UPDATE' then
    if new.email is distinct from old.email
       or username is distinct from (old.raw_user_meta_data->>'username') then
      raise exception 'Atlas usernames cannot be changed';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.atlas_validate_identity() from public, anon, authenticated;
create trigger atlas_identity_guard before insert or update of email, raw_user_meta_data
on auth.users for each row execute function public.atlas_validate_identity();
commit;
