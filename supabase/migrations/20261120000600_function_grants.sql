-- Only signed-in users call RPCs; check_invite is the single pre-sign-up exception.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
grant execute on function public.check_invite(text) to anon;

-- Internal helpers live in the non-exposed private schema; policies still need them as authenticated.
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

-- Future functions created by postgres start closed to anon as well.
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;
alter default privileges for role postgres in schema private revoke execute on functions from public, anon;
