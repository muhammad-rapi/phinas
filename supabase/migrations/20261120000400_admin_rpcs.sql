-- Admin panel RPCs. Each checks is_admin(); none needs the service-role key.

create function private.require_admin() returns uuid
language plpgsql stable security definer set search_path = private, public as $$
begin
  if not is_admin() then raise exception 'phinas:not_admin'; end if;
  return auth.uid();
end $$;

create function public.admin_list_users() returns jsonb
language plpgsql stable security definer set search_path = private, public as $$
begin
  perform require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'email', u.email,
      'displayName', p.display_name,
      'role', p.role,
      'disabled', p.disabled,
      'createdAt', u.created_at,
      'lastSignInAt', u.last_sign_in_at,
      'invitedById', p.invited_by,
      'invitedByName', inv.display_name,
      'friendCount', (
        select count(*)::int from public.friendships f
        where f.status = 'accepted' and p.id in (f.user_a, f.user_b))
    ) order by u.created_at desc)
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.profiles inv on inv.id = p.invited_by
  ), '[]'::jsonb);
end $$;

create function public.admin_list_invites() returns jsonb
language plpgsql stable security definer set search_path = private, public as $$
begin
  perform require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', i.code,
      'createdByName', c.display_name,
      'createdAt', i.created_at,
      'expiresAt', i.expires_at,
      'usedByName', u.display_name,
      'usedAt', i.used_at,
      'revoked', i.revoked
    ) order by i.created_at desc)
    from invite_codes i
    join profiles c on c.id = i.created_by
    left join profiles u on u.id = i.used_by
  ), '[]'::jsonb);
end $$;

create function public.admin_set_disabled(p_user uuid, p_disabled boolean) returns void
language plpgsql security definer set search_path = private, public as $$
declare me uuid := require_admin();
begin
  if p_user is null or p_disabled is null then raise exception 'phinas:invalid_args'; end if;
  if p_user = me then raise exception 'phinas:self_disable'; end if;
  -- Same key as delete_my_account: two admins disabling each other at once would leave none.
  perform pg_advisory_xact_lock(hashtext('phinas:last_admin'));
  -- Re-check after the lock: another admin may have just disabled us.
  if not is_admin() then raise exception 'phinas:not_admin'; end if;
  update profiles set disabled = p_disabled where id = p_user;
  if not found then raise exception 'phinas:user_not_found'; end if;
  -- End the sessions too, so the access token cannot be refreshed (refresh_tokens cascade).
  if p_disabled then
    delete from auth.sessions where user_id = p_user;
  end if;
end $$;

create function public.admin_set_config(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = private, public as $$
begin
  perform require_admin();
  if p_value is null then raise exception 'phinas:config_invalid'; end if;
  -- Separate statements so the numeric casts only run on JSON numbers.
  if p_key in ('listen_together_enabled', 'registration_open')
     and jsonb_typeof(p_value) <> 'boolean' then
    raise exception 'phinas:config_invalid';
  end if;
  if p_key = 'invite_quota' then
    if jsonb_typeof(p_value) <> 'number' then raise exception 'phinas:config_invalid'; end if;
    if p_value::numeric <> trunc(p_value::numeric) or p_value::numeric not between 0 and 1000 then
      raise exception 'phinas:config_invalid';
    end if;
  end if;
  update app_config set value = p_value where key = p_key;
  if not found then raise exception 'phinas:config_unknown'; end if;
end $$;
