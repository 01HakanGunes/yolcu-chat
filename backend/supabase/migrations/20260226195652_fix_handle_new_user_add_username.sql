-- Fix handle_new_user trigger to include the required `username` column.
-- The `username` column on `profiles` is NOT NULL with no default,
-- but the original trigger did not insert a value for it, causing
-- sign-up to fail with: "null value in column 'username' violates not-null constraint"

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
begin
  insert into public.profiles (id, display_name, avatar_url, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    new.raw_user_meta_data->>'avatar_url',
    'user_' || replace(left(new.id::text, 8), '-', '')
  );
  return new;
end;
$$;
