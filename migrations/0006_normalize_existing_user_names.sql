-- Normalize existing user names so each space-separated name part starts with an uppercase letter.
-- Example: "john smith" -> "John Smith"

WITH RECURSIVE
source(id, rest, built) AS (
  SELECT id, trim(name) || ' ', ''
  FROM users
  WHERE name IS NOT NULL AND trim(name) <> ''

  UNION ALL

  SELECT
    id,
    substr(rest, instr(rest, ' ') + 1),
    built ||
      CASE WHEN built = '' THEN '' ELSE ' ' END ||
      upper(substr(substr(rest, 1, instr(rest, ' ') - 1), 1, 1)) ||
      substr(substr(rest, 1, instr(rest, ' ') - 1), 2)
  FROM source
  WHERE rest <> ''
),
normalized AS (
  SELECT id, built AS normalized_name
  FROM source
  WHERE rest = ''
)
UPDATE users
SET name = (
  SELECT normalized_name
  FROM normalized
  WHERE normalized.id = users.id
)
WHERE id IN (SELECT id FROM normalized);
