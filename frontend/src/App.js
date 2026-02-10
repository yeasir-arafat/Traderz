import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from './components/ui/sonner';
import { Layout } from './components/layout/Layout';
import { useAuthStore } from './store';

// Lazy load pages
const HomePage = React.lazy(() => import('./pages/HomePage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const BrowsePage = React.lazy(() => import('./pages/BrowsePage'));
const ListingDetailsPage = React.lazy(() => import('./pages/ListingDetailsPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const WalletPage = React.lazy(() => import('./pages/WalletPage'));
const OrdersPage = React.lazy(() => import('./pages/OrdersPage'));
const OrderDetailsPage = React.lazy(() => import('./pages/OrderDetailsPage'));
const ChatPage = React.lazy(() => import('./pages/ChatPage'));
const FAQPage = React.lazy(() => import('./pages/FAQPage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));
const KycPage = React.lazy(() => import('./pages/KycPage'));
const NotificationsPage = React.lazy(() => import('./pages/NotificationsPage'));
const SellerProfilePage = React.lazy(() => import('./pages/SellerProfilePage'));
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = React.lazy(() => import('./pages/ResetPasswordPage'));
const ComingSoonPage = React.lazy(() => import('./pages/ComingSoonPage'));

// Seller Pages
const MyListingsPage = React.lazy(() => import('./pages/seller/MyListingsPage'));
const CreateListingPage = React.lazy(() => import('./pages/seller/CreateListingPage'));

// Admin Pages
const AdminDashboardPage = React.lazy(() => import('./pages/admin/AdminDashboardPage'));
const PendingListingsPage = React.lazy(() => import('./pages/admin/PendingListingsPage'));
const PendingKycPage = React.lazy(() => import('./pages/admin/PendingKycPage'));
const DisputesPage = React.lazy(() => import('./pages/admin/DisputesPage'));

// Super Admin Pages
const SuperAdminDashboardPage = React.lazy(() => import('./pages/superadmin/SuperAdminDashboardPage'));
const UsersManagementPage = React.lazy(() => import('./pages/superadmin/UsersManagementPage'));
const FinanceConsolePage = React.lazy(() => import('./pages/superadmin/FinanceConsolePage'));
const AuditLogsPage = React.lazy(() => import('./pages/superadmin/AuditLogsPage'));
const LegalPage = React.lazy(() => import('./pages/superadmin/LegalPage'));
const GamesFeesPage = React.lazy(() => import('./pages/superadmin/GamesFeesPage'));
const ModerationPage = React.lazy(() => import('./pages/superadmin/ModerationPage'));
const ConfigPage = React.lazy(() => import('./pages/superadmin/ConfigPage'));
const AllOrdersPage = React.lazy(() => import('./pages/superadmin/AllOrdersPage'));
const WithdrawalsPage = React.lazy(() => import('./pages/superadmin/WithdrawalsPage'));
const GiftCardsPage = React.lazy(() => import('./pages/superadmin/GiftCardsPage'));
const AdminScopesPage = React.lazy(() => import('./pages/superadmin/AdminScopesPage'));
const SystemHealthPage = React.lazy(() => import('./pages/superadmin/SystemHealthPage'));
const SlidesManagementPage = React.lazy(() => import('./pages/admin/SlidesManagementPage'));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

// Loading Fallback
const LoadingSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center bg-black">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#13ec5b] border-t-transparent shadow-[0_0_15px_rgba(19,236,91,0.5)]"></div>
  </div>
);

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Seller Route wrapper
function SellerRoute({ children }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!user?.roles?.includes('seller')) {
    return <Navigate to="/profile" replace />;
  }
  return children;
}

// Admin Route wrapper
function AdminRoute({ children }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return children;
}

// Super Admin Route wrapper
function SuperAdminRoute({ children }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!user?.roles?.includes('super_admin')) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            {/* Auth pages without layout */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/coming-soon" element={<ComingSoonPage />} />

            {/* Pages with layout */}
            <Route
              path="/*"
              element={
                <Layout>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/browse" element={<BrowsePage />} />
                    <Route path="/listing/:id" element={<ListingDetailsPage />} />
                    <Route path="/seller/:username" element={<SellerProfilePage />} />
                    <Route path="/faq" element={<FAQPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/terms" element={<ComingSoonPage />} />
                    <Route path="/privacy" element={<ComingSoonPage />} />

                    {/* Protected routes */}
                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute>
                          <ProfilePage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/wallet"
                      element={
                        <ProtectedRoute>
                          <WalletPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/orders"
                      element={
                        <ProtectedRoute>
                          <OrdersPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/order/:id"
                      element={
                        <ProtectedRoute>
                          <OrderDetailsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/notifications"
                      element={
                        <ProtectedRoute>
                          <NotificationsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/chat"
                      element={
                        <ProtectedRoute>
                          <ChatPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/chat/:id"
                      element={
                        <ProtectedRoute>
                          <ChatPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/kyc"
                      element={
                        <ProtectedRoute>
                          <KycPage />
                        </ProtectedRoute>
                      }
                    />

                    {/* Seller routes */}
                    <Route
                      path="/sell"
                      element={
                        <SellerRoute>
                          <Navigate to="/my-listings" replace />
                        </SellerRoute>
                      }
                    />
                    <Route
                      path="/my-listings"
                      element={
                        <SellerRoute>
                          <MyListingsPage />
                        </SellerRoute>
                      }
                    />
                    <Route
                      path="/sell/new"
                      element={
                        <SellerRoute>
                          <CreateListingPage />
                        </SellerRoute>
                      }
                    />
                    <Route
                      path="/sell/:id/edit"
                      element={
                        <SellerRoute>
                          <CreateListingPage />
                        </SellerRoute>
                      }
                    />

                    {/* Admin routes */}
                    <Route
                      path="/admin"
                      element={
                        <AdminRoute>
                          <AdminDashboardPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/admin/listings"
                      element={
                        <AdminRoute>
                          <PendingListingsPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/admin/pending-listings"
                      element={
                        <AdminRoute>
                          <PendingListingsPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/admin/kyc"
                      element={
                        <AdminRoute>
                          <PendingKycPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/admin/disputes"
                      element={
                        <AdminRoute>
                          <DisputesPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/admin/slides"
                      element={
                        <AdminRoute>
                          <SlidesManagementPage />
                        </AdminRoute>
                      }
                    />

                    {/* Super Admin routes */}
                    <Route
                      path="/superadmin"
                      element={
                        <SuperAdminRoute>
                          <SuperAdminDashboardPage />
                        </SuperAdminRoute>
                      }
                    />
                    <Route
                      path="/superadmin/users"
                      element={
                        <SuperAdminRoute>
                          <UsersManagementPage />
                        </SuperAdminRoute>
                      }
                    />
                    <Route
                      path="/superadmin/config"
                      element={
                        <SuperAdminRoute>
                          <ConfigPage />
                        </SuperAdminRoute>
                      }
                    />
                    <Route
                      path="/superadmin/finance"
                      element={
                        <SuperAdminRoute>
                          <FinanceConsolePage />
                        </SuperAdminRoute>
                      }
                    />
                    <Route
                      path="/superadmin/audit-logs"
                      element={
                        <SuperAdminRoute>
                          <AuditLogsPage />
                        </SuperAdminRoute>
                      }
                    />
                    <Route
                      path="/superadmin/games-fees"
                      element={
                        <SuperAdminRoute>
                          <GamesFeesPage />
                        </SuperAdminRoute>
                      }
                    />
                    <Route
                      path="/superadmin/moderation"
                      element={
                        <SuperAdminRoute>
                          <ModerationPage />
                        </SuperAdminRoute>
                      }
                    />
                    <Route
                      path="/superadmin/legal"
                      element={
                        <SuperAdminRoute>
                          <LegalPage />
                        </SuperAdminRoute>
                      }
                    />
                    <Route
                      path="/superadmin/orders"
                      element={
                        <SuperAdminRoute>
                          <AllOrdersPage />
                        </SuperAdminRoute>
                      }
                    />
                    <Route
                      path="/superadmin/withdrawals"
                      element={
                        <SuperAdminRoute>
                          <WithdrawalsPage />
                        </SuperAdminRoute>
                      }
                    />
                    <Route
                      path="/superadmin/giftcards"
                      element={
                        <SuperAdminRoute>
                          <GiftCardsPage />
                        </SuperAdminRoute>
                      }
                    />
                    <Route
                      path="/superadmin/admin-scopes"
                      element={
                        <SuperAdminRoute>
                          <AdminScopesPage />
                        </SuperAdminRoute>
                      }
                    />
                    <Route
                      path="/superadmin/system-health"
                      element={
                        <SuperAdminRoute>
                          <SystemHealthPage />
                        </SuperAdminRoute>
                      }
                    />
                    {/* 404 */}
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Layout>
              }
            />
          </Routes>
        </Suspense>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
