-- Replaces the yes/no deposit_paid flag with an actual dollar amount --
-- a boolean couldn't represent a partial deposit, and made the
-- Outstanding Balance figure on the board header wrong for any project
-- that had paid part but not all of its balance (it showed the full
-- confirmed_price instead of what was actually still owed).
--
-- No data migration for existing deposit_paid=true rows: the real dollar
-- amount isn't derivable from a boolean. Re-entered by hand afterward.

alter table projects add column deposit_amount numeric;
alter table projects drop column deposit_paid;
