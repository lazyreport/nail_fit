import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import Logger from "../lib/logger";
import { handleError, AuthError } from "../lib/errors";

interface UserCreditsProps {
  className?: string;
}

export function UserCredits({ className = "" }: UserCreditsProps) {
  const [credits, setCredits] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCredits();
  }, []);

  async function loadCredits() {
    try {
      setLoading(true);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw new AuthError("Failed to get user", authError);
      }

      if (!user) {
        Logger.warn("Credits Check: No user found");
        return;
      }

      const { data: userCredits, error: creditsError } = await supabase
        .from("User Credits")
        .select("credits, is_admin")
        .eq("user_id", user.id)
        .single();

      if (creditsError) {
        throw new Error(creditsError.message);
      }

      Logger.credits("Credits Status Updated", {
        available: userCredits?.credits ?? 0,
        isAdmin: userCredits?.is_admin ?? false,
        userId: user.id,
        email: user.email,
      });

      if (userCredits) {
        setCredits(userCredits.credits);
        setIsAdmin(userCredits.is_admin);
      }
    } catch (error) {
      const appError = handleError(error);
      Logger.error("Failed to load credits", appError);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className={`text-sm text-gray-600 ${className}`}>
        Loading credits...
      </div>
    );
  }

  if (credits === null) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm font-medium text-gray-700">
        {isAdmin ? "∞" : credits} Credits
      </span>
      {!isAdmin && credits <= 3 && (
        <span className="text-xs text-amber-600 font-medium">Low balance!</span>
      )}
    </div>
  );
}
