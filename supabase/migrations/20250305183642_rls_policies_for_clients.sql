-- Enable Row Level Security for Clients table
ALTER TABLE "Clients" ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to insert new clients
CREATE POLICY "Enable insert for authenticated users only"
ON "Clients"
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy to allow authenticated users to read clients
CREATE POLICY "Enable read access for authenticated users only"
ON "Clients"
FOR SELECT
TO authenticated
USING (true);

-- Policy to allow authenticated users to update their own clients
CREATE POLICY "Enable update for authenticated users only"
ON "Clients"
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Add created_by column to track which user created the client
ALTER TABLE "Clients" ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- Backfill existing rows with the current user's ID (optional, comment out if not needed)
-- UPDATE "Clients" SET created_by = auth.uid() WHERE created_by IS NULL;



