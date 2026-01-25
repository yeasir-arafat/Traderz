import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Search } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-md mx-auto">
        <h1 className="text-8xl font-heading font-bold text-primary neon-text mb-4">404</h1>
        <h2 className="text-2xl font-heading font-bold mb-4">Page Not Found</h2>
        <p className="text-muted-foreground mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild>
            <Link to="/">
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/browse">
              <Search className="w-4 h-4 mr-2" />
              Browse Listings
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
