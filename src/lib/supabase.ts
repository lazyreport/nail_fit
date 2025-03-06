import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Function to ensure we have an authenticated session
export async function ensureAuthenticated() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    // Sign in anonymously if no session exists
    const { error } = await supabase.auth.signInWithPassword({
      email: "service@nailfit.com",
      password: import.meta.env.VITE_SUPABASE_PROJECT_PASSWORD || "",
    });
    
    if (error) {
      console.error("Authentication error:", error);
      throw error;
    }
  }
  
  return session;
}
