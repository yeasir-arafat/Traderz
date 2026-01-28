import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Loader2, RefreshCw, Database, Cpu, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { superAdminAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { toast } from 'sonner';

export default function SystemHealthPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);

  const isSuperAdmin = user?.roles?.includes('super_admin');

  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) {
      navigate('/');
      return;
    }
    loadHealth();
  }, [isAuthenticated, isSuperAdmin]);

  const loadHealth = async () => {
    setLoading(true);
    try {
      const data = await superAdminAPI.getSystemHealth();
      setHealth(data);
    } catch (error) {
      toast.error(error.message || 'Failed to load system health');
    } finally {
      setLoading(false);
    }
  };

  const formatNextRun = (dateStr) => {
    if (!dateStr) return 'Not scheduled';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date - now;
    
    if (diffMs < 0) return 'Overdue';
    
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `In ${diffMins} min`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `In ${diffHours}h ${diffMins % 60}m`;
    
    return date.toLocaleString();
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl" data-testid="system-health-page">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-heading font-bold">System Health</h1>
            <p className="text-sm text-muted-foreground">
              Monitor database, scheduler, and background job status
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadHealth} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !health ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Unable to load system health data
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Database Status */}
            <Card className={health.db_connected ? 'border-green-500/30' : 'border-red-500/30'}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="w-5 h-5" />
                  Database Connection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {health.db_connected ? (
                    <>
                      <CheckCircle className="w-6 h-6 text-green-400" />
                      <span className="text-green-400 font-medium">Connected</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-6 h-6 text-red-400" />
                      <span className="text-red-400 font-medium">Disconnected</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">PostgreSQL (Neon)</p>
              </CardContent>
            </Card>

            {/* Scheduler Status */}
            <Card className={health.scheduler_running ? 'border-green-500/30' : 'border-yellow-500/30'}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cpu className="w-5 h-5" />
                  Background Scheduler
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {health.scheduler_running ? (
                    <>
                      <CheckCircle className="w-6 h-6 text-green-400" />
                      <span className="text-green-400 font-medium">Running</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-6 h-6 text-yellow-400" />
                      <span className="text-yellow-400 font-medium">Not Running</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">APScheduler</p>
              </CardContent>
            </Card>
          </div>

          {/* Scheduled Jobs */}
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Jobs</CardTitle>
              <CardDescription>Background tasks managed by APScheduler</CardDescription>
            </CardHeader>
            <CardContent>
              {!health.scheduler_running ? (
                <p className="text-center text-muted-foreground py-4">
                  Scheduler is not running. Jobs are paused.
                </p>
              ) : health.jobs?.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No scheduled jobs found
                </p>
              ) : (
                <div className="space-y-3">
                  {health.jobs?.map((job, i) => (
                    <div
                      key={job.id || i}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                      data-testid={`job-${job.id}`}
                    >
                      <div>
                        <p className="font-medium">{job.name || job.id}</p>
                        <p className="text-xs text-muted-foreground font-mono">{job.id}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatNextRun(job.next_run_time)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Info */}
          <Card>
            <CardHeader>
              <CardTitle>System Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Backend</p>
                  <p className="font-medium">FastAPI + SQLAlchemy</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Frontend</p>
                  <p className="font-medium">React + Vite</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Database</p>
                  <p className="font-medium">PostgreSQL (Neon)</p>
                </div>
                <div>
                  <p className="text-muted-foreground">File Storage</p>
                  <p className="font-medium">Local Filesystem</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
