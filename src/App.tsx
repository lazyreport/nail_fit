import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { supabase } from "./lib/supabase";
import { Auth } from "./components/Auth";
import { NailFitting } from "./components/NailFitting";
import { UserCredits } from "./components/UserCredits";
import { NailTipSetList } from "./components/NailTipSetList";
import { DatabaseSchema } from "./components/DatabaseSchema";
import { RelativeMeasuring } from "./components/RelativeMeasuring";
import Layout from "./components/Layout";
import NewNailTipSet from "./pages/nail-tip-sets/new";
import EditNailTipSet from "./pages/nail-tip-sets/edit";

// Protected Route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(!!session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === null) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

export default function App() {
  const [session, setSession] = useState<boolean>(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(!!session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            !session ? (
              <Auth onAuthSuccess={() => setSession(true)} />
            ) : (
              <Navigate to="/nail-fitting" />
            )
          }
        />
        <Route
          path="/nail-fitting"
          element={
            <ProtectedRoute>
              <Layout>
                <NailFitting />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/nail-sets"
          element={
            <ProtectedRoute>
              <Layout>
                <NailTipSetList />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/nail-tip-sets/new"
          element={
            <ProtectedRoute>
              <Layout>
                <NewNailTipSet />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/nail-tip-sets/edit/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <EditNailTipSet />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/credits"
          element={
            <ProtectedRoute>
              <Layout>
                <UserCredits />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/database"
          element={
            <ProtectedRoute>
              <Layout>
                <DatabaseSchema />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/relative-measuring"
          element={
            <ProtectedRoute>
              <Layout>
                <RelativeMeasuring
                  onMeasurementComplete={(measurement) =>
                    console.log("Measured:", measurement)
                  }
                />
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}
