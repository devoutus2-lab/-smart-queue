import "./global.css";
import { lazy, Suspense, useEffect } from "react";
import { AppLoadingState } from "@/components/AppLoadingState";
import ProtectedRoute from "@/components/ProtectedRoute";
import RuntimeErrorBoundary from "@/components/RuntimeErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DemoModeProvider, type DemoPreset, useDemoMode } from "./context/DemoModeContext";
import { EasterEggProvider } from "./context/EasterEggContext";
import { OfflineProvider } from "./context/OfflineContext";
import { PreferencesProvider } from "./context/PreferencesContext";
import { SessionProvider, useSession } from "./context/SessionContext";
import { OfflineStatusBanner } from "./components/OfflineStatusBanner";
import { queryClient } from "./lib/queryClient";
import { getHomeRouteForRole } from "./lib/navigation";

const FloatingAssistantBubble = lazy(() =>
  import("@/components/FloatingAssistantBubble").then((module) => ({
    default: module.FloatingAssistantBubble,
  })),
);
const AppHealthMonitor = lazy(() => import("@/components/AppHealthMonitor"));
const DemoModeControls = lazy(() =>
  import("@/components/DemoModeControls").then((module) => ({
    default: module.DemoModeControls,
  })),
);
const NotificationToaster = lazy(() => import("@/components/NotificationToaster"));
const QueueDashOverlay = lazy(() =>
  import("@/components/QueueDashOverlay").then((module) => ({
    default: module.QueueDashOverlay,
  })),
);

const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const RegisterUser = lazy(() => import("./pages/RegisterUser"));
const RegisterBusiness = lazy(() => import("./pages/RegisterBusiness"));
const RegisterAdmin = lazy(() => import("./pages/RegisterAdmin"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Pricing = lazy(() => import("./pages/Pricing"));
const NotFound = lazy(() => import("./pages/NotFound"));

const BusinessProfile = lazy(() => import("./pages/BusinessProfile"));
const ExternalBusinessProfile = lazy(() => import("./pages/ExternalBusinessProfile"));
const QueuePreview = lazy(() => import("./pages/QueuePreview"));

const UserHome = lazy(() => import("./pages/UserHome"));
const UserQueues = lazy(() => import("./pages/UserQueues"));
const UserSearch = lazy(() => import("./pages/UserSearch"));
const UserMap = lazy(() => import("./pages/UserMap"));
const Appointments = lazy(() => import("./pages/Appointments"));
const UserReceipts = lazy(() => import("./pages/UserReceipts"));
const UserMessages = lazy(() => import("./pages/UserMessages"));
const UserNotifications = lazy(() => import("./pages/UserNotifications"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const UserSettings = lazy(() => import("./pages/UserSettings"));
const UserSupport = lazy(() => import("./pages/UserSupport"));
const ScheduleQueue = lazy(() => import("./pages/ScheduleQueue"));

const OwnerDashboard = lazy(() => import("./pages/OwnerDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

const DemoFigureSix = lazy(() => import("./pages/DemoFigureSix"));

function RouteLoadingState({ title, message }: { title: string; message: string }) {
  return (
    <AppLoadingState title={title} message={message} />
  );
}

function RouteBoundary({
  children,
  title = "Loading page",
  message = "Preparing the next screen for you.",
}: {
  children: JSX.Element;
  title?: string;
  message?: string;
}) {
  return (
    <Suspense fallback={<RouteLoadingState title={title} message={message} />}>
      {children}
    </Suspense>
  );
}

function DemoPresetRoute({ preset, children }: { preset: DemoPreset; children: JSX.Element }) {
  const { currentPreset, enabled, enableDemo } = useDemoMode();

  useEffect(() => {
    if (enabled && currentPreset === preset) return;
    enableDemo(preset);
  }, [currentPreset, enableDemo, enabled, preset]);

  return children;
}

function RootEntry() {
  const { user, isLoading } = useSession();

  if (isLoading) {
    return <AppLoadingState title="Loading Smart Queue" message="Checking your session and opening the right route for you." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <RouteBoundary title="Loading home" message="Preparing your Smart Queue dashboard.">
      <Index />
    </RouteBoundary>
  );
}

function AuthEntry({ children }: { children: JSX.Element }) {
  const { user, isLoading } = useSession();

  if (isLoading) {
    return <AppLoadingState title="Preparing sign-in" message="Checking if you already have an active session." />;
  }

  if (user) {
    return <Navigate to={getHomeRouteForRole(user.role)} replace />;
  }

  return children;
}

function AppShell() {
  return (
    <EasterEggProvider>
      <Suspense fallback={null}>
        <AppHealthMonitor />
        <DemoModeControls />
        <NotificationToaster />
        <FloatingAssistantBubble />
        <QueueDashOverlay />
      </Suspense>
      <Routes>
        <Route path="/" element={<RootEntry />} />
        <Route
          path="/login"
          element={
            <AuthEntry>
              <RouteBoundary title="Loading sign in" message="Preparing the login screen.">
                <Login />
              </RouteBoundary>
            </AuthEntry>
          }
        />
        <Route
          path="/register"
          element={
            <AuthEntry>
              <RouteBoundary title="Loading registration" message="Preparing your registration options.">
                <Register />
              </RouteBoundary>
            </AuthEntry>
          }
        />
        <Route
          path="/register/user"
          element={
            <AuthEntry>
              <RouteBoundary title="Loading user registration" message="Preparing the guest sign-up form.">
                <RegisterUser />
              </RouteBoundary>
            </AuthEntry>
          }
        />
        <Route
          path="/register/business"
          element={
            <AuthEntry>
              <RouteBoundary title="Loading business registration" message="Preparing the business registration flow.">
                <RegisterBusiness />
              </RouteBoundary>
            </AuthEntry>
          }
        />
        <Route
          path="/register/platform-admin-access"
          element={
            <AuthEntry>
              <RouteBoundary title="Loading admin registration" message="Preparing the admin access form.">
                <RegisterAdmin />
              </RouteBoundary>
            </AuthEntry>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <AuthEntry>
              <RouteBoundary title="Loading password recovery" message="Preparing the reset request screen.">
                <ForgotPassword />
              </RouteBoundary>
            </AuthEntry>
          }
        />
        <Route
          path="/reset-password"
          element={
            <AuthEntry>
              <RouteBoundary title="Loading password reset" message="Preparing the password reset form.">
                <ResetPassword />
              </RouteBoundary>
            </AuthEntry>
          }
        />
        <Route
          path="/business/:id"
          element={
            <RouteBoundary title="Loading business details" message="Preparing business details, services, and queue status.">
              <BusinessProfile />
            </RouteBoundary>
          }
        />
        <Route
          path="/places/external/:provider/:placeId"
          element={
            <RouteBoundary title="Loading place details" message="Preparing place details and Smart Queue options.">
              <ExternalBusinessProfile />
            </RouteBoundary>
          }
        />
        <Route
          path="/pricing"
          element={
            <RouteBoundary title="Loading pricing" message="Preparing the pricing page.">
              <Pricing />
            </RouteBoundary>
          }
        />
        <Route
          path="/demo/figure-3"
          element={
            <DemoPresetRoute preset="figure3_main_user">
              <RouteBoundary title="Loading demo" message="Preparing the main user demo view.">
                <UserHome />
              </RouteBoundary>
            </DemoPresetRoute>
          }
        />
        <Route
          path="/demo/figure-4/:entryId"
          element={
            <DemoPresetRoute preset="figure4_queue_tracking">
              <RouteBoundary title="Loading demo" message="Preparing the queue tracking demo view.">
                <QueuePreview />
              </RouteBoundary>
            </DemoPresetRoute>
          }
        />
        <Route
          path="/demo/figure-5"
          element={
            <DemoPresetRoute preset="figure5_owner_dashboard">
              <RouteBoundary title="Loading demo" message="Preparing the owner dashboard demo view.">
                <OwnerDashboard />
              </RouteBoundary>
            </DemoPresetRoute>
          }
        />
        <Route
          path="/demo/figure-6"
          element={
            <DemoPresetRoute preset="figure6_full_flow">
              <RouteBoundary title="Loading demo" message="Preparing the full application flow demo.">
                <DemoFigureSix />
              </RouteBoundary>
            </DemoPresetRoute>
          }
        />
        <Route path="/user-home" element={<Navigate to="/account" replace />} />
        <Route
          path="/account"
          element={
            <ProtectedRoute role="user">
              <RouteBoundary title="Loading account" message="Preparing your home workspace.">
                <UserHome />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/queues"
          element={
            <ProtectedRoute role="user">
              <RouteBoundary title="Loading queues" message="Preparing your live queue list.">
                <UserQueues />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/search"
          element={
            <ProtectedRoute role="user">
              <RouteBoundary title="Loading search" message="Preparing business search and filters.">
                <UserSearch />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/map"
          element={
            <ProtectedRoute role="user">
              <RouteBoundary title="Loading map" message="Preparing the map and nearby places view.">
                <UserMap />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/appointments"
          element={
            <ProtectedRoute role="user">
              <RouteBoundary title="Loading appointments" message="Preparing your booking history and upcoming visits.">
                <Appointments />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/receipts"
          element={
            <ProtectedRoute role="user">
              <RouteBoundary title="Loading receipts" message="Preparing your digital receipts.">
                <UserReceipts />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/messages"
          element={
            <ProtectedRoute role="user">
              <RouteBoundary title="Loading messages" message="Preparing your business conversations.">
                <UserMessages />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/notifications"
          element={
            <ProtectedRoute role="user">
              <RouteBoundary title="Loading notifications" message="Preparing your notification center.">
                <UserNotifications />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/profile"
          element={
            <ProtectedRoute role="user">
              <RouteBoundary title="Loading profile" message="Preparing your account profile.">
                <UserProfile />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/settings"
          element={
            <ProtectedRoute role="user">
              <RouteBoundary title="Loading settings" message="Preparing your account preferences.">
                <UserSettings />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/support"
          element={
            <ProtectedRoute role="user">
              <RouteBoundary title="Loading technical support" message="Preparing your Smart Queue support conversation.">
                <UserSupport />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/schedule-queue"
          element={
            <ProtectedRoute role="user">
              <RouteBoundary title="Loading scheduling" message="Preparing queue and appointment scheduling.">
                <ScheduleQueue />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route path="/appointments" element={<Navigate to="/account/appointments" replace />} />
        <Route
          path="/queue-preview/:entryId"
          element={
            <ProtectedRoute role="user">
              <RouteBoundary title="Loading queue card" message="Preparing your live queue card and updates.">
                <QueuePreview />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route path="/join-queue" element={<Navigate to="/" replace />} />
        <Route path="/owner-dashboard" element={<Navigate to="/business-dashboard" replace />} />
        <Route
          path="/business-dashboard"
          element={
            <ProtectedRoute role="owner">
              <RouteBoundary title="Loading business dashboard" message="Preparing the owner workspace.">
                <OwnerDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-dashboard/today"
          element={
            <ProtectedRoute role="owner">
              <RouteBoundary title="Loading business dashboard" message="Preparing today's owner view.">
                <OwnerDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-dashboard/queue"
          element={
            <ProtectedRoute role="owner">
              <RouteBoundary title="Loading business dashboard" message="Preparing queue operations.">
                <OwnerDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-dashboard/appointments"
          element={
            <ProtectedRoute role="owner">
              <RouteBoundary title="Loading business dashboard" message="Preparing appointment operations.">
                <OwnerDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-dashboard/services"
          element={
            <ProtectedRoute role="owner">
              <RouteBoundary title="Loading business dashboard" message="Preparing service and counter management.">
                <OwnerDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-dashboard/receipts"
          element={
            <ProtectedRoute role="owner">
              <RouteBoundary title="Loading business dashboard" message="Preparing receipts and visit records.">
                <OwnerDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-dashboard/messages"
          element={
            <ProtectedRoute role="owner">
              <RouteBoundary title="Loading business dashboard" message="Preparing business messaging.">
                <OwnerDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-dashboard/analytics"
          element={
            <ProtectedRoute role="owner">
              <RouteBoundary title="Loading business dashboard" message="Preparing analytics and insights.">
                <OwnerDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-dashboard/feedback"
          element={
            <ProtectedRoute role="owner">
              <RouteBoundary title="Loading business dashboard" message="Preparing customer feedback tools.">
                <OwnerDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-dashboard/notifications"
          element={
            <ProtectedRoute role="owner">
              <RouteBoundary title="Loading business dashboard" message="Preparing owner notifications.">
                <OwnerDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route path="/business-dashboard/profile" element={<Navigate to="/business-dashboard/settings" replace />} />
        <Route
          path="/business-dashboard/settings"
          element={
            <ProtectedRoute role="owner">
              <RouteBoundary title="Loading business dashboard" message="Preparing business settings.">
                <OwnerDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-dashboard/support"
          element={
            <ProtectedRoute role="owner">
              <RouteBoundary title="Loading technical support" message="Preparing the owner support conversation.">
                <OwnerDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route path="/admin-dashboard" element={<Navigate to="/admin-panel" replace />} />
        <Route
          path="/admin-panel"
          element={
            <ProtectedRoute role="admin">
              <RouteBoundary title="Loading admin panel" message="Preparing the platform administration workspace.">
                <AdminDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-panel/overview"
          element={
            <ProtectedRoute role="admin">
              <RouteBoundary title="Loading admin panel" message="Preparing platform overview data.">
                <AdminDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-panel/businesses"
          element={
            <ProtectedRoute role="admin">
              <RouteBoundary title="Loading admin panel" message="Preparing business management.">
                <AdminDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-panel/owners"
          element={
            <ProtectedRoute role="admin">
              <RouteBoundary title="Loading admin panel" message="Preparing owner account management.">
                <AdminDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-panel/accounts"
          element={
            <ProtectedRoute role="admin">
              <RouteBoundary title="Loading admin panel" message="Preparing account management.">
                <AdminDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-panel/analytics"
          element={
            <ProtectedRoute role="admin">
              <RouteBoundary title="Loading admin analytics" message="Preparing platform analytics and recent trends.">
                <AdminDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-panel/assistant"
          element={
            <ProtectedRoute role="admin">
              <RouteBoundary title="Loading assistant analytics" message="Preparing A.I. assistant performance analytics.">
                <AdminDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-panel/support"
          element={
            <ProtectedRoute role="admin">
              <RouteBoundary title="Loading support inbox" message="Preparing technical support conversations.">
                <AdminDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-panel/claims"
          element={
            <ProtectedRoute role="admin">
              <RouteBoundary title="Loading claims" message="Preparing claims review and import workflows.">
                <AdminDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-panel/subscriptions"
          element={
            <ProtectedRoute role="admin">
              <RouteBoundary title="Loading subscriptions" message="Preparing subscription management.">
                <AdminDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-panel/moderation"
          element={
            <ProtectedRoute role="admin">
              <RouteBoundary title="Loading moderation" message="Preparing moderation and enforcement tools.">
                <AdminDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-panel/announcements"
          element={
            <ProtectedRoute role="admin">
              <RouteBoundary title="Loading announcements" message="Preparing platform announcements.">
                <AdminDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-panel/activity"
          element={
            <ProtectedRoute role="admin">
              <RouteBoundary title="Loading activity log" message="Preparing admin activity records.">
                <AdminDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-panel/settings"
          element={
            <ProtectedRoute role="admin">
              <RouteBoundary title="Loading platform settings" message="Preparing platform configuration.">
                <AdminDashboard />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={
            <RouteBoundary title="Loading page" message="Preparing the requested page.">
              <NotFound />
            </RouteBoundary>
          }
        />
      </Routes>
    </EasterEggProvider>
  );
}

export const App = () => (
  <RuntimeErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <DemoModeProvider>
        <OfflineProvider>
          <SessionProvider>
            <PreferencesProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <OfflineStatusBanner />
                  <AppShell />
                </BrowserRouter>
              </TooltipProvider>
            </PreferencesProvider>
          </SessionProvider>
        </OfflineProvider>
      </DemoModeProvider>
    </QueryClientProvider>
  </RuntimeErrorBoundary>
);

export default App;
