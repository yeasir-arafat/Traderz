import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from './components/ui/sonner';
import { Layout } from './components/layout/Layout';
import { useAuthStore } from './store';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import BrowsePage from './pages/BrowsePage';
import ListingDetailsPage from './pages/ListingDetailsPage';
import ProfilePage from './pages/ProfilePage';
import WalletPage from './pages/WalletPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailsPage from './pages/OrderDetailsPage';
import ChatPage from './pages/ChatPage';
import FAQPage from './pages/FAQPage';
import NotFoundPage from './pages/NotFoundPage';
import KycPage from './pages/KycPage';
import NotificationsPage from './pages/NotificationsPage';
import SellerProfilePage from './pages/SellerProfilePage';

// Seller Pages
import MyListingsPage from './pages/seller/MyListingsPage';
import CreateListingPage from './pages/seller/CreateListingPage';

// Admin Pages
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import PendingListingsPage from './pages/admin/PendingListingsPage';
import PendingKycPage from './pages/admin/PendingKycPage';
import DisputesPage from './pages/admin/DisputesPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Auth pages without layout */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Pages with layout */}
          <Route
            path="/*"
            element={
              <Layout>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/browse" element={<BrowsePage />} />
                  <Route path="/listing/:id" element={<ListingDetailsPage />} />
                  <Route path="/seller/:id" element={<SellerProfilePage />} />
                  <Route path="/faq" element={<FAQPage />} />
                  
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
                  
                  {/* 404 */}
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Layout>
            }
          />
        </Routes>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
