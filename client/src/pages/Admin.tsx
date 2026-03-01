import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Bot, CheckSquare, Activity, Shield, Trash2, UserCheck, UserX } from "lucide-react";

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
