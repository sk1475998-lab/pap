import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { JobsPage } from "./pages/JobsPage";
import { TrackerPage } from "./pages/TrackerPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { ResumePage } from "./pages/ResumePage";
import { FleetPage } from "./pages/FleetPage";
import { CopilotPage } from "./pages/CopilotPage";
import { VaultPage } from "./pages/VaultPage";
import { BillingPage } from "./pages/BillingPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LoginPage } from "./pages/LoginPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage initialMode="signin" />} />
          <Route path="/signin" element={<LoginPage initialMode="signin" />} />
          <Route path="/signup" element={<LoginPage initialMode="register" />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="tracker" element={<TrackerPage />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="resume" element={<ResumePage />} />
            <Route path="fleet" element={<FleetPage />} />
            <Route path="copilot" element={<CopilotPage />} />
            <Route path="vault" element={<VaultPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

