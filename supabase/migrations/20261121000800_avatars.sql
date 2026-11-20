-- Profile photos: a small JPEG (resized in the app) kept as a data URL on the profile row.
-- No Storage bucket: the photo follows the same read rules as the display name.

alter table public.profiles
  add column avatar text
  constraint profiles_avatar_shape check (
    avatar is null
    or (avatar like 'data:image/jpeg;base64,%' and length(avatar) <= 60000)
  );

-- Friends (and owners of public playlists) may read it, like display_name.
grant select (avatar) on public.profiles to authenticated;

-- Sets or (with null) removes the caller's photo.
create function public.set_my_avatar(p_avatar text) returns void
language plpgsql security definer set search_path = private, public as $$
declare u uuid := require_active();
begin
  if p_avatar is not null
     and (p_avatar not like 'data:image/jpeg;base64,%' or length(p_avatar) > 60000) then
    raise exception 'phinas:avatar_invalid';
  end if;
  update profiles set avatar = p_avatar where id = u;
end $$;

revoke execute on function public.set_my_avatar(text) from public, anon;
grant execute on function public.set_my_avatar(text) to authenticated;

create or replace function public.my_profile() returns jsonb
language plpgsql stable security definer set search_path = private, public as $$
declare u uuid := require_signed_in();
begin
  return (
    select jsonb_build_object(
      'id', p.id, 'displayName', p.display_name, 'role', p.role, 'disabled', p.disabled,
      'friendCode', p.friend_code, 'listenScope', p.listen_scope, 'invitesLeft', invites_left(p.id),
      'avatar', p.avatar)
    from profiles p where p.id = u
  );
end $$;

create or replace function public.list_friends() returns jsonb
language plpgsql stable security definer set search_path = private, public as $$
declare u uuid := require_active();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'friendshipId', f.id,
      'userId', o.id,
      'name', o.display_name,
      'avatar', o.avatar,
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
