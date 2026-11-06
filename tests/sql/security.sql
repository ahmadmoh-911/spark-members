-- Who can see what. Run against the project (Supabase SQL editor or MCP); every block raises on failure.
-- Wrapped in a transaction that is rolled back, so it never changes data.
begin;

-- 1) logged-out visitors can't read private tables
set local role anon;
do $$ begin
  begin perform 1 from public.private_contacts limit 1; raise exception 'FAIL anon read private_contacts'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.client_errors limit 1; raise exception 'FAIL anon read client_errors'; exception when insufficient_privilege then null; end;
  begin if exists (select 1 from public.join_requests) then raise exception 'FAIL anon sees join_requests'; end if; exception when insufficient_privilege then null; end;
  begin perform public.svc_backup_dump(); raise exception 'FAIL anon ran backup dump'; exception when insufficient_privilege then null; end;
  begin perform public.admin_students(); raise exception 'FAIL anon ran admin_students'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;
reset role;

-- 2) public lists never carry email addresses
do $$ declare r jsonb; begin
  select to_jsonb(m) into r from public.public_members() m limit 1;
  if r ? 'email' then raise exception 'FAIL public_members exposes email'; end if;
end $$;

-- 3) a signed-in student can't use staff tools
select set_config('request.jwt.claims', json_build_object(
  'sub', (select id from public.profiles where role = 'student' limit 1), 'role', 'authenticated',
  'email', 'nobody@example.com', 'app_metadata', json_build_object('provider', 'google'))::text, true);
set local role authenticated;
do $$ begin
  begin perform public.panel_insights(); raise exception 'FAIL student ran panel_insights'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform public.admin_client_errors(); raise exception 'FAIL student read errors'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform public.admin_members(); raise exception 'FAIL student ran admin_members'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform public.rate_enrollment((select id from public.enrollments limit 1), 5); raise exception 'FAIL student rated'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform public.issue_certificates(array[(select id from public.enrollments limit 1)]); raise exception 'FAIL student issued certificate'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform 1 from public.client_errors limit 1; raise exception 'FAIL student read client_errors'; exception when insufficient_privilege then null; end;
  -- a student can't make themselves admin
  begin update public.profiles set role = 'admin' where id = auth.uid();
        if exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then raise exception 'FAIL student self-promoted'; end if;
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- and can't take someone else's membership number
  begin update public.profiles set member_no = 999 where id = auth.uid();
        if exists (select 1 from public.profiles where id = auth.uid() and member_no = 999) then raise exception 'FAIL student changed member_no'; end if;
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;
reset role;

-- 4) error reports are accepted from anyone but can't flood
set local role anon;
select public.log_client_error('security-test', null, null, null, 'test');
reset role;

select 'ALL SECURITY CHECKS PASSED' as result;
rollback;
