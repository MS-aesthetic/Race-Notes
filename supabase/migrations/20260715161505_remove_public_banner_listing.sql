-- Public object URLs do not require a SELECT policy. Removing the broad policy
-- prevents clients from listing every team banner while existing URLs keep
-- working through the public bucket.
drop policy if exists "Banners are publicly accessible" on storage.objects;
