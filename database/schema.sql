-- Portability-oriented PostgreSQL schema reconstructed from information_schema.
-- Table/column SQL types are grounded in the original application database.
-- Constraints/indexes not introspected are deliberately not invented.
CREATE TABLE IF NOT EXISTS spherex_targets (
 id text, label_tr text, label_en text, object_type text,
 ra_deg double precision, dec_deg double precision, detector text,
 description_tr text, bundled_zip boolean, available_count integer,
 cached_frame_count integer, catalog_source text,
 last_checked_at timestamptz, newest_observation_at timestamptz,
 updated_at timestamptz
);
CREATE TABLE IF NOT EXISTS spherex_catalog_cache (
 cache_key text, target_id text, ra_deg double precision,
 dec_deg double precision, detector text, result_json jsonb,
 cached_at timestamptz, fresh_until timestamptz
);
CREATE TABLE IF NOT EXISTS spherex_processed_frames (
 cache_key text, target_id text, observed_utc timestamptz,
 source_url text, preview_png text, science_gzip text, source_sha256 text,
 native_width integer, native_height integer,
 valid_fraction double precision, wave_center_um double precision,
 notes text, created_at timestamptz
);
CREATE TABLE IF NOT EXISTS spherex_reports (
 report_key text, target_id text, report_json jsonb,
 created_at timestamptz
);
