import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate, Link, useLocation } from "react-router-dom";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [credits, setCredits] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchCredits = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: creditsData } = await supabase
        .from("User Credits")
        .select("credits, is_admin")
        .eq("user_id", user.id)
        .single();

      if (creditsData) {
        setCredits(creditsData.credits);
        setIsAdmin(creditsData.is_admin);
      }
    };

    fetchCredits();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const isActive = (path: string) => {
    return location.pathname === path ? "bg-gray-100" : "";
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              {/* Logo */}
              <Link to="/">
                <img
                  src="/logo.png"
                  alt="NailFit Logo"
                  className="h-8 w-auto"
                />
              </Link>
              {/* Navigation Links */}
              <nav className="ml-10 space-x-4">
                <Link
                  to="/nail-fitting"
                  className={`text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium ${isActive(
                    "/nail-fitting"
                  )}`}
                >
                  Nail Fitting
                </Link>
                <Link
                  to="/nail-sets"
                  className={`text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium ${isActive(
                    "/nail-sets"
                  )}`}
                >
                  Nail Sets
                </Link>
                <Link
                  to="/database"
                  className={`text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium ${isActive(
                    "/database"
                  )}`}
                >
                  Database
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm font-medium text-gray-700">
                Credits: {isAdmin ? "∞" : credits ?? 0}
              </div>
              <button
                onClick={handleSignOut}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <p>
              &copy; {new Date().getFullYear()} NailFit. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
