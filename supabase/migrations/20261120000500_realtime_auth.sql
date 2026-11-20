-- Private Realtime channels for Listen Together.
--   pair:<uuidA>:<uuidB>  (A < B)  one session between two friends
--   presence:<uuid>                 the owner tracks presence; friends watch it

create function private.can_join_topic(p_topic text) returns boolean
language plpgsql stable security definer set search_path = private, public as $$
declare
  u uuid := auth.uid();
  parts text[] := string_to_array(coalesce(p_topic, ''), ':');
  a uuid;
  b uuid;
begin
  if u is null then return false; end if;
  begin
    if parts[1] = 'pair' and array_length(parts, 1) = 3 then
      a := parts[2]::uuid;
      b := parts[3]::uuid;
      -- Only the canonical spelling: a second spelling of the same uuid is a second channel.
      if parts[2] <> a::text or parts[3] <> b::text then return false; end if;
      return a < b and u in (a, b) and can_listen(a, b);
    elsif parts[1] = 'presence' and array_length(parts, 1) = 2 then
      a := parts[2]::uuid;
      if parts[2] <> a::text then return false; end if;
      return is_active(u) and is_active(a) and (a = u or are_friends(u, a));
    end if;
  exception when invalid_text_representation then
    return false;
  end;
  return false;
end $$;

-- realtime.messages is created by the Realtime service. Skip on a stack without it.
do $$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'realtime.messages not found; Listen Together policies skipped';
    return;
  end if;
  execute $p$
    create policy "phinas join" on realtime.messages for select to authenticated
    using (private.can_join_topic(realtime.topic()))
  $p$;
  -- Anyone in a pair may send; on a presence channel only the owner tracks.
  execute $p$
    create policy "phinas send" on realtime.messages for insert to authenticated
    with check (
      private.can_join_topic(realtime.topic())
      and (left(realtime.topic(), 5) = 'pair:' or realtime.topic() = 'presence:' || auth.uid()::text)
    )
  $p$;
end $$;
