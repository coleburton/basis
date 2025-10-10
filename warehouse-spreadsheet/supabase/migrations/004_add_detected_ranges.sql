-- Add detected_ranges column to sheets table
-- This stores the detected date ranges for each sheet to avoid re-scanning on every load

ALTER TABLE sheets 
ADD COLUMN IF NOT EXISTS detected_ranges JSONB DEFAULT '[]'::jsonb;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_sheets_detected_ranges ON sheets USING gin(detected_ranges);

-- Add comment for documentation
COMMENT ON COLUMN sheets.detected_ranges IS 'Cached detected date ranges to avoid re-scanning cells on every workbook load';

