-- The public mobile query embeds the new group_buys -> influencers relation.
-- Reload PostgREST after the foreign key migration so the relationship is
-- available immediately in hosted Preview and Production deployments.
NOTIFY pgrst, 'reload schema';
