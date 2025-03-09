-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own credits" ON "User Credits";
DROP POLICY IF EXISTS "Admin users can view all credits" ON "User Credits";
DROP POLICY IF EXISTS "Admin users can update credits" ON "User Credits";
DROP POLICY IF EXISTS "Users can update their own credits" ON "User Credits";
DROP POLICY IF EXISTS "Users can insert their own credits" ON "User Credits";

-- Create new policies
CREATE POLICY "Users can view their own credits"
ON "User Credits"
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR is_admin = true);

CREATE POLICY "Users can update their own credits"
ON "User Credits"
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR is_admin = true);

CREATE POLICY "Users can insert their own credits"
ON "User Credits"
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);














