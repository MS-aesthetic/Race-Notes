-- Update handle_new_user() so profiles created via Google OAuth (and any other
-- OAuth provider) get a sensible display name and avatar instead of falling
-- back to the email prefix with no photo.
--
-- Google populates raw_user_meta_data with `full_name`, `name`, and
-- `avatar_url` / `picture` on first sign-in. Email/password sign-ups continue
-- to work as before via the `display_name` key set in signUp().

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    ),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;
