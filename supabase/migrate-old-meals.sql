-- CalTrack: claim the pre-auth meals (user_id is null) for the owner's account.
-- Run AFTER logging in to the app once with this email (so the auth user exists).

update public.meals
set user_id = (select id from auth.users where email = 'peerasin.toey.ignite@gmail.com')
where user_id is null;
