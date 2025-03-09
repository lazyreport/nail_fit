-- Clean up duplicate measurements, keeping only the most recent one per finger position per client
WITH RankedMeasurements AS (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY client_id, finger_position
      ORDER BY date_measured DESC
    ) as rn
  FROM "Measurements"
)
DELETE FROM "Measurements"
WHERE id IN (
  SELECT id 
  FROM RankedMeasurements 
  WHERE rn > 1
); 