-- Webhook dan polling outcome mencari post lewat `publishing_posts.outstand_post_id`.
-- Retry satu target menyimpan id Outstand BARU di
-- `publishing_post_targets.retry_outstand_post_id` tanpa mengganti id post.
-- CREATE OR REPLACE (bukan DROP) supaya GRANT EXECUTE yang sudah ada tidak hilang.
--
-- Lookup by id post asli: target yang sudah punya retry id berbeda tidak ikut,
-- supaya outcome post lama tidak menimpa target yang sudah dipublish ulang.
-- Lookup by retry id: hanya target dengan id itu.

CREATE OR REPLACE FUNCTION "public"."webhook_find_post_targets_by_outstand_post_id"(
  p_outstand_post_id text
)
RETURNS TABLE (
  post_id uuid,
  workspace_id uuid,
  author_id text,
  post_target_id uuid,
  connected_account_id uuid,
  outstand_account_id text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    p."id" AS post_id,
    p."workspace_id" AS workspace_id,
    p."author_id" AS author_id,
    pt."id" AS post_target_id,
    pt."connected_account_id" AS connected_account_id,
    wca."outstand_account_id" AS outstand_account_id
  FROM "publishing_posts" p
  JOIN "publishing_post_targets" pt ON pt."post_id" = p."id"
  JOIN "workspace_connected_accounts" wca ON wca."id" = pt."connected_account_id"
  WHERE p."deleted_at" IS NULL
    AND (
      pt."retry_outstand_post_id" = p_outstand_post_id
      OR (
        p."outstand_post_id" = p_outstand_post_id
        AND (
          pt."retry_outstand_post_id" IS NULL
          OR pt."retry_outstand_post_id" = p."outstand_post_id"
        )
      )
    )
$$;
