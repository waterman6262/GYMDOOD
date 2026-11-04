-- Run once on a freshly migrated, EMPTY database before loading a
-- data-only backup: the migrations create these rows and the backup has them too.
delete from public.settings where id = 1;
set local storage.allow_delete_query = 'true';
delete from storage.buckets where id = 'member-photos';
