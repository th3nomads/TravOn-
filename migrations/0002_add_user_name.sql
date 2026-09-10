ALTER TABLE users ADD COLUMN name TEXT;

-- Existing accounts predate the name field.
-- After running this migration, existing users can have names assigned with:
-- UPDATE users SET name = 'Your Name' WHERE email = 'you@example.com';
