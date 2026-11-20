-- RPCs for signed-in users. All raise 'phinas:<code>' on refusal.

create function private.require_signed_in() returns uuid
language plpgsql stable security definer set search_path = private, public as $$
begin
  if auth.uid() is null then raise exception 'phinas:not_signed_in'; end if;
  return auth.uid();
end $$;

create function private.require_active() returns uuid
language plpgsql stable security definer set search_path = private, public as $$
declare u uuid := require_signed_in();
begin
  if not is_active(u) then raise exception 'phinas:account_disabled'; end if;
  return u;
end $$;

-- Listen Together permission, from one side: does `owner` allow `other`?
create function private.scope_allows(owner uuid, other uuid) returns boolean
language sql stable security definer set search_path = private, public as $$
  select case (select listen_scope from profiles where id = owner)
    when 'friends' then are_friends(owner, other)
    when 'partner' then is_partner(owner, other)
    else false
  end
$$;

create function private.can_listen(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = private, public as $$
  select a <> b
    and coalesce((config('listen_together_enabled'))::boolean, false)
    and is_active(a) and is_active(b)
    and scope_allows(a, b) and scope_allows(b, a)
$$;

create function private.invites_left(u uuid) returns int
language sql stable security definer set search_path = private, public as $$
  select case
    when (select role from profiles where id = u) = 'admin' then null
    else greatest(0, coalesce((config('invite_quota'))::int, 0) - (
      select count(*)::int from invite_codes
      where created_by = u and (used_at is not null or (not revoked and expires_at > now()))
    ))
  end
$$;

-- Readable even when disabled, so the app can say so.
create function public.my_profile() returns jsonb
language plpgsql stable security definer set search_path = private, public as $$
declare u uuid := require_signed_in();
begin
  return (
    select jsonb_build_object(
      'id', p.id, 'displayName', p.display_name, 'role', p.role, 'disabled', p.disabled,
      'friendCode', p.friend_code, 'listenScope', p.listen_scope, 'invitesLeft', invites_left(p.id))
    from profiles p where p.id = u
  );
end $$;

create function public.update_my_profile(p_display_name text, p_listen_scope text) returns void
language plpgsql security definer set search_path = private, public as $$
declare
  u uuid := require_active();
  v_name text := btrim(p_display_name, E' \t\r\n');
begin
  if p_display_name is not null and (v_name = '' or length(v_name) > 30 or v_name ~ '[[:cntrl:]]') then
    raise exception 'phinas:name_invalid';
  end if;
  if p_listen_scope is not null and p_listen_scope not in ('friends', 'partner', 'off') then
    raise exception 'phinas:scope_invalid';
  end if;
  update profiles set
    display_name = coalesce(v_name, display_name),
    listen_scope = coalesce(p_listen_scope, listen_scope)
  where id = u;
end $$;

create function public.get_config() returns jsonb
language plpgsql stable security definer set search_path = private, public as $$
begin
  perform require_active();
  return jsonb_build_object(
    'listenTogetherEnabled', coalesce((config('listen_together_enabled'))::boolean, false),
    'registrationOpen', coalesce((config('registration_open'))::boolean, false),
    'inviteQuota', coalesce((config('invite_quota'))::int, 0));
end $$;

-- Accepted friends, partner first. canListen already applies both scopes and the global switch.
create function public.list_friends() returns jsonb
language plpgsql stable security definer set search_path = private, public as $$
declare u uuid := require_active();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'friendshipId', f.id,
      'userId', o.id,
      'name', o.display_name,
      'isPartner', f.is_partner,
      'partnerRequest', case
        when f.partner_requested_by is null then null
        when f.partner_requested_by = u then 'outgoing'
        else 'incoming' end,
      'canListen', can_listen(u, o.id)
    ) order by f.is_partner desc, lower(o.display_name))
    from friendships f
    join profiles o on o.id = case when f.user_a = u then f.user_b else f.user_a end
    where f.status = 'accepted' and u in (f.user_a, f.user_b) and not o.disabled
  ), '[]'::jsonb);
end $$;

create function public.list_friend_requests() returns jsonb
language plpgsql stable security definer set search_path = private, public as $$
declare u uuid := require_active();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'friendshipId', f.id, 'userId', o.id, 'name', o.display_name, 'incoming', f.requested_by <> u
    ) order by f.created_at desc)
    from friendships f
    join profiles o on o.id = case when f.user_a = u then f.user_b else f.user_a end
    where f.status = 'pending' and u in (f.user_a, f.user_b) and not o.disabled
  ), '[]'::jsonb);
end $$;

create function public.send_friend_request(p_friend_code text) returns uuid
language plpgsql security definer set search_path = private, public as $$
declare
  u uuid := require_active();
  v_other uuid;
  v_id uuid;
  f friendships;
begin
  select id into v_other from profiles
  where friend_code = upper(trim(coalesce(p_friend_code, ''))) and not disabled;
  if v_other is null then raise exception 'phinas:friend_code_invalid'; end if;
  if v_other = u then raise exception 'phinas:self_friend'; end if;

  -- Serialise this user's sends so the cap below cannot be raced past.
  perform 1 from profiles where id = u for no key update;

  if not exists (select 1 from friendships where user_a = least(u, v_other) and user_b = greatest(u, v_other)) then
    if (select count(*) from friendships where status = 'pending' and requested_by = u) >= 20 then
      raise exception 'phinas:too_many_requests';
    end if;
  end if;

  -- on conflict makes two people entering each other's codes at the same time safe:
  -- one inserts, the other falls through to the existing row and accepts it.
  insert into friendships (user_a, user_b, requested_by)
  values (least(u, v_other), greatest(u, v_other), u)
  on conflict (user_a, user_b) do nothing
  returning id into v_id;
  if v_id is not null then return v_id; end if;

  select * into f from friendships where user_a = least(u, v_other) and user_b = greatest(u, v_other) for update;
  if not found then raise exception 'phinas:request_not_found'; end if; -- removed in between
  if f.status = 'accepted' then raise exception 'phinas:already_friends'; end if;
  -- They already asked us: entering their code accepts it.
  if f.requested_by <> u then
    update friendships set status = 'accepted' where id = f.id;
  end if;
  return f.id;
end $$;

create function public.respond_friend_request(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = private, public as $$
declare u uuid := require_active();
begin
  if p_accept is null then raise exception 'phinas:invalid_args'; end if;
  perform 1 from friendships
  where id = p_id and status = 'pending' and u in (user_a, user_b) and requested_by <> u
    and is_active(case when user_a = u then user_b else user_a end)
  for update;
  if not found then raise exception 'phinas:request_not_found'; end if;
  if p_accept then
    update friendships set status = 'accepted' where id = p_id;
  else
    delete from friendships where id = p_id;
  end if;
end $$;

-- Also cancels an outgoing request.
create function public.remove_friend(p_id uuid) returns void
language plpgsql security definer set search_path = private, public as $$
declare u uuid := require_active();
begin
  delete from friendships where id = p_id and u in (user_a, user_b);
  if not found then raise exception 'phinas:request_not_found'; end if;
end $$;

-- Once a and b are partners, every other open partner request involving either of them is stale.
create function private.clear_partner_requests(p_id uuid, a uuid, b uuid) returns void
language sql security definer set search_path = private, public as $$
  update friendships set partner_requested_by = null
  where id <> p_id and partner_requested_by is not null
    and (user_a in (a, b) or user_b in (a, b))
$$;

create function public.request_partner(p_id uuid) returns void
language plpgsql security definer set search_path = private, public as $$
declare
  u uuid := require_active();
  f friendships;
begin
  select * into f from friendships
  where id = p_id and status = 'accepted' and u in (user_a, user_b)
    and is_active(case when user_a = u then user_b else user_a end)
  for update;
  if not found then raise exception 'phinas:request_not_found'; end if;
  if f.is_partner then return; end if;
  if exists (
    select 1 from friendships x
    where x.is_partner and (x.user_a in (f.user_a, f.user_b) or x.user_b in (f.user_a, f.user_b))
  ) then
    raise exception 'phinas:partner_taken';
  end if;
  if f.partner_requested_by is not null and f.partner_requested_by <> u then
    -- They asked first: asking back accepts.
    update friendships set is_partner = true, partner_requested_by = null where id = p_id;
    perform clear_partner_requests(p_id, f.user_a, f.user_b);
  else
    update friendships set partner_requested_by = u where id = p_id;
  end if;
end $$;

create function public.respond_partner(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = private, public as $$
declare
  u uuid := require_active();
  f friendships;
begin
  if p_accept is null then raise exception 'phinas:invalid_args'; end if;
  select * into f from friendships
  where id = p_id and u in (user_a, user_b) and partner_requested_by is not null and partner_requested_by <> u
    and is_active(case when user_a = u then user_b else user_a end)
  for update;
  if not found then raise exception 'phinas:request_not_found'; end if;
  if p_accept then
    update friendships set is_partner = true, partner_requested_by = null where id = p_id;
    perform clear_partner_requests(p_id, f.user_a, f.user_b);
  else
    update friendships set partner_requested_by = null where id = p_id;
  end if;
end $$;

create function public.end_partner(p_id uuid) returns void
language plpgsql security definer set search_path = private, public as $$
declare u uuid := require_active();
begin
  update friendships set is_partner = false, partner_requested_by = null
  where id = p_id and u in (user_a, user_b);
  if not found then raise exception 'phinas:request_not_found'; end if;
end $$;

create function public.create_invite() returns text
language plpgsql security definer set search_path = private, public as $$
declare
  u uuid := require_active();
  v_code text;
begin
  perform 1 from profiles where id = u for no key update; -- serialise quota checks per user
  if coalesce(invites_left(u), 1) <= 0 then raise exception 'phinas:quota_exceeded'; end if;
  loop
    v_code := gen_code('', 8);
    exit when not exists (select 1 from invite_codes where code = v_code);
  end loop;
  insert into invite_codes (code, created_by) values (v_code, u);
  return v_code;
end $$;

create function public.revoke_invite(p_code text) returns void
language plpgsql security definer set search_path = private, public as $$
declare u uuid := require_active();
begin
  update invite_codes set revoked = true
  where code = upper(trim(coalesce(p_code, ''))) and created_by = u and used_at is null;
  if not found then raise exception 'phinas:invite_invalid'; end if;
end $$;

create function public.list_my_invites() returns jsonb
language plpgsql stable security definer set search_path = private, public as $$
declare u uuid := require_active();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', i.code, 'createdAt', i.created_at, 'expiresAt', i.expires_at,
      'usedAt', i.used_at, 'usedByName', p.display_name, 'revoked', i.revoked
    ) order by i.created_at desc)
    from invite_codes i left join profiles p on p.id = i.used_by
    where i.created_by = u
  ), '[]'::jsonb);
end $$;

-- Deletes the auth user; profiles, friendships, playlists, likes and invites cascade.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = private, public as $$
declare u uuid := require_signed_in();
begin
  if (select role from profiles where id = u) = 'admin' then
    -- Serialise admin self-deletes so two admins cannot both leave at once.
    perform pg_advisory_xact_lock(hashtext('phinas:last_admin'));
    if not exists (select 1 from profiles where role = 'admin' and not disabled and id <> u) then
      raise exception 'phinas:last_admin';
    end if;
  end if;
  delete from auth.users where id = u;
end $$;
