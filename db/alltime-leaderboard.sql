-- Drop existing function first
DROP FUNCTION IF EXISTS public.get_alltime_leaderboard();

-- Create function for all-time leaderboard
CREATE FUNCTION public.get_alltime_leaderboard()
RETURNS TABLE (
  address text,
  alias text,
  pfp_url text,
  wins bigint,
  draws bigint,
  losses bigint,
  points bigint,
  fid integer
) 
LANGUAGE sql
AS $$
  WITH latest_profiles AS (
    -- Get the most recent alias and pfp_url for each address
    SELECT DISTINCT ON (address)
      address,
      alias,
      pfp_url
    FROM public.leaderboard_entries
    WHERE alias IS NOT NULL
    ORDER BY address, updated_at DESC
  ),
  latest_fids AS (
    -- Get the most recent FID for each address
    SELECT DISTINCT ON (address)
      address,
      fid
    FROM public.user_notifications
    ORDER BY address, updated_at DESC
  )
  SELECT 
    le.address,
    lp.alias,
    lp.pfp_url,
    SUM(le.wins)::bigint as wins,
    SUM(le.draws)::bigint as draws,
    SUM(le.losses)::bigint as losses,
    SUM(le.points)::bigint as points,
    lf.fid
  FROM public.leaderboard_entries le
  LEFT JOIN latest_profiles lp ON le.address = lp.address
  LEFT JOIN latest_fids lf ON le.address = lf.address
  GROUP BY le.address, lp.alias, lp.pfp_url, lf.fid
  ORDER BY SUM(le.points) DESC, SUM(le.wins) DESC;
$$;
