begin;
create extension if not exists pgtap with schema extensions;
select plan(2);
select has_table('public', 'profiles', 'profiles exists');
select has_function('public', 'handle_new_user', 'handle_new_user exists');
select * from finish();
rollback;
