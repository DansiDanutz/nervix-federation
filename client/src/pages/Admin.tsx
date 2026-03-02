import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Bot, CheckSquare, Activity, Shield, Trash2, UserCheck, UserX, Heart, Server, Clock, Wifi, AlertTriangle, Zap } from "lucide-react";

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h < 24) return `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: number | string; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}><Icon className="w-5 h-5" /></div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const [, setLocation] = useLocation();
  const me = trpc.auth.me.useQuery();
  const stats = trpc.admin.stats.useQuery();
  const users = trpc.admin.users.list.useQuery({});
  const agents = trpc.agents.list.useQuery({ limit: 100 });
  const tasks = trpc.admin.tasksMgmt.list.useQuery({});
  const audit = trpc.admin.auditLog.useQuery({});
  const health = trpc.admin.systemHealth.useQuery(undefined, { refetchInterval: 30_000 });

  const setRole = trpc.admin.users.setRole.useMutation({ onSuccess: () => users.refetch() });
  const deleteUser = trpc.admin.users.delete.useMutation({ onSuccess: () => users.refetch() });
  const setAgentStatus = trpc.admin.agentsMgmt.setStatus.useMutation({ onSuccess: () => agents.refetch() });
  const deleteAgent = trpc.admin.agentsMgmt.delete.useMutation({ onSuccess: () => agents.refetch() });
  const deleteTask = trpc.admin.tasksMgmt.delete.useMutation({ onSuccess: () => tasks.refetch() });

  if (me.isLoading) return <DashboardLayout><div className="p-8 text-muted-foreground">Loading...</div></DashboardLayout>;
  if (!me.data || (me.data as any).role !== "admin") {
    setLocation("/dashboard");
    return null;
  }

  const s = stats.data;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-destructive" />
          <h1 className="text-2xl font-bold">Admin Panel</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard title="Total Users" value={s?.totalUsers ?? "..."} icon={Users} color="bg-blue-500/10 text-blue-500" />
          <StatCard title="Total Agents" value={s?.totalAgents ?? "..."} icon={Bot} color="bg-purple-500/10 text-purple-500" />
          <StatCard title="Active Agents" value={s?.activeAgents ?? "..."} icon={Activity} color="bg-green-500/10 text-green-500" />
          <StatCard title="Total Tasks" value={s?.totalTasks ?? "..."} icon={CheckSquare} color="bg-orange-500/10 text-orange-500" />
          <StatCard title="Completed" value={s?.completedTasks ?? "..."} icon={CheckSquare} color="bg-emerald-500/10 text-emerald-500" />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Users ({users.data?.length ?? 0})</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-4">Name / Email</th>
                      <th className="text-left py-2 pr-4">Role</th>
                      <th className="text-left py-2 pr-4">Method</th>
                      <th className="text-left py-2 pr-4">Verified</th>
                      <th className="text-left py-2">Actions</th>
                    </tr></thead>
                    <tbody>
                      {users.data?.map((u: any) => (
                        <tr key={u.openId} className="border-b hover:bg-muted/30">
                          <td className="py-2 pr-4">
                            <div className="font-medium">{u.name || "—"}</div>
                            <div className="text-muted-foreground text-xs">{u.email || u.openId}</div>
                          </td>
                          <td className="py-2 pr-4">
                            <Badge variant={u.role === "admin" ? "destructive" : "secondary"}>{u.role || "user"}</Badge>
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">{u.loginMethod || "email"}</td>
                          <td className="py-2 pr-4">
                            {u.emailVerified ? <span className="text-green-500">✓</span> : <span className="text-orange-500">✗</span>}
                          </td>
                          <td className="py-2 flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => setRole.mutate({ openId: u.openId, role: u.role === "admin" ? "user" : "admin" })}>
                              {u.role === "admin" ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => { if(confirm("Delete user?")) deleteUser.mutate({ openId: u.openId }); }}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agents" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Agents ({agents.data?.agents?.length ?? 0})</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-4">Name</th>
                      <th className="text-left py-2 pr-4">Roles</th>
                      <th className="text-left py-2 pr-4">Status</th>
                      <th className="text-left py-2">Actions</th>
                    </tr></thead>
                    <tbody>
                      {agents.data?.agents?.map((a: any) => (
                        <tr key={a.agentId} className="border-b hover:bg-muted/30">
                          <td className="py-2 pr-4">
                            <div className="font-medium">{a.name}</div>
                            <div className="text-muted-foreground text-xs">{a.agentId}</div>
                          </td>
                          <td className="py-2 pr-4">
                            {(a.roles || []).slice(0, 2).map((r: string) => <Badge key={r} variant="outline" className="text-xs mr-1">{r}</Badge>)}
                          </td>
                          <td className="py-2 pr-4">
                            <Badge variant={a.status === "active" ? "default" : "secondary"}>{a.status}</Badge>
                          </td>
                          <td className="py-2 flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => setAgentStatus.mutate({ agentId: a.agentId, status: a.status === "active" ? "inactive" : "active" })}>
                              {a.status === "active" ? "Deactivate" : "Activate"}
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => { if(confirm("Delete agent?")) deleteAgent.mutate({ agentId: a.agentId }); }}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-4">Title</th>
                      <th className="text-left py-2 pr-4">Status</th>
                      <th className="text-left py-2 pr-4">Priority</th>
                      <th className="text-left py-2">Actions</th>
                    </tr></thead>
                    <tbody>
                      {tasks.data?.map((t: any) => (
                        <tr key={t.taskId} className="border-b hover:bg-muted/30">
                          <td className="py-2 pr-4">
                            <div className="font-medium truncate max-w-[200px]">{t.title}</div>
                            <div className="text-muted-foreground text-xs">{t.taskId}</div>
                          </td>
                          <td className="py-2 pr-4"><Badge variant="outline">{t.status}</Badge></td>
                          <td className="py-2 pr-4 text-muted-foreground">{t.priority || "—"}</td>
                          <td className="py-2">
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => { if(confirm("Delete task?")) deleteTask.mutate({ taskId: t.taskId }); }}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="health" className="mt-4 space-y-4">
            {health.isLoading ? (
              <div className="text-muted-foreground p-4">Loading health data...</div>
            ) : health.isError ? (
              <Card><CardContent className="p-6 text-red-400 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Failed to load health data</CardContent></Card>
            ) : health.data ? (
              <>
                {/* Server Status */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Server className="w-4 h-4 text-green-500" />
                        <span className="text-xs text-muted-foreground">Status</span>
                      </div>
                      <p className="text-lg font-bold text-green-500">{health.data.server.status}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-muted-foreground">Uptime</span>
                      </div>
                      <p className="text-lg font-bold">{formatUptime(health.data.server.uptimeSeconds)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="w-4 h-4 text-orange-500" />
                        <span className="text-xs text-muted-foreground">HTTP Requests</span>
                      </div>
                      <p className="text-lg font-bold">{health.data.server.httpRequests.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="text-xs text-muted-foreground">Error Rate</span>
                      </div>
                      <p className="text-lg font-bold">{health.data.server.errorRate}%</p>
                      <p className="text-xs text-muted-foreground">{health.data.server.httpErrors} errors</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Agent Heartbeats */}
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Heart className="w-4 h-4 text-red-500" /> Agent Heartbeats</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 pr-4">Agent</th>
                          <th className="text-left py-2 pr-4">Status</th>
                          <th className="text-left py-2 pr-4">Last Heartbeat</th>
                          <th className="text-left py-2">Health</th>
                        </tr></thead>
                        <tbody>
                          {health.data.agents.heartbeats.map((a: any) => (
                            <tr key={a.agentId} className="border-b hover:bg-muted/30">
                              <td className="py-2 pr-4">
                                <div className="font-medium">{a.name}</div>
                                <div className="text-muted-foreground text-xs">{a.agentId.substring(0, 16)}...</div>
                              </td>
                              <td className="py-2 pr-4">
                                <Badge variant={a.status === "active" ? "default" : "secondary"}>{a.status}</Badge>
                              </td>
                              <td className="py-2 pr-4 text-muted-foreground">
                                {a.ageSeconds < 0 ? "Never" : formatUptime(a.ageSeconds) + " ago"}
                              </td>
                              <td className="py-2">
                                <div className={`w-3 h-3 rounded-full ${
                                  a.ageSeconds < 0 ? "bg-gray-500" :
                                  a.ageSeconds < 120 ? "bg-green-500 animate-pulse" :
                                  a.ageSeconds < 600 ? "bg-yellow-500" :
                                  "bg-red-500"
                                }`} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Status Breakdowns */}
                <div className="grid md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Agents by Status</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(health.data.agents.byStatus).map(([status, count]) => (
                          <div key={status} className="flex items-center justify-between">
                            <Badge variant="outline">{status}</Badge>
                            <span className="font-bold">{count as number}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Tasks by Status</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(health.data.tasks.byStatus).map(([status, count]) => (
                          <div key={status} className="flex items-center justify-between">
                            <Badge variant="outline">{status}</Badge>
                            <span className="font-bold">{count as number}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Wifi className="w-3 h-3" /> Webhooks</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(health.data.webhooks.byStatus).map(([status, count]) => (
                          <div key={status} className="flex items-center justify-between">
                            <Badge variant="outline">{status}</Badge>
                            <span className="font-bold">{count as number}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-xs text-muted-foreground">Errors (24h)</span>
                          <span className="font-bold text-red-400">{health.data.webhooks.recentErrors24h}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Audit Log</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {audit.data?.map((entry: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border text-sm">
                      <div className="text-muted-foreground text-xs whitespace-nowrap mt-0.5">
                        {new Date(entry.createdAt).toLocaleString()}
                      </div>
                      <div>
                        <Badge variant="outline" className="text-xs mr-2">{entry.eventType}</Badge>
                        <span>{entry.action}</span>
                        {entry.actorId && <span className="text-muted-foreground text-xs ml-2">by {entry.actorId.substring(0, 12)}...</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
