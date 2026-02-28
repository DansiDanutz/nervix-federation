import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft, Package, Upload, CheckCircle2, XCircle, Globe, FileText,
  RefreshCw, Shield, ExternalLink, Hash, Clock, BarChart3, Search,
  AlertTriangle, Loader2, Eye, Zap
} from "lucide-react";

// ─── Status Badge ───────────────────────────────────────────────────────────

function StatusBadge({ published, upToDate }: { published: boolean; upToDate: boolean }) {
  if (!published) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <AlertTriangle className="w-3 h-3" /> Not Published
      </span>
    );
  }
  if (upToDate) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="w-3 h-3" /> Up to Date
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
      <Upload className="w-3 h-3" /> Update Available
    </span>
  );
}

// ─── File Tree ──────────────────────────────────────────────────────────────

function FileTree({ files }: { files: Array<{ path: string; size: number; hash: string }> }) {
  return (
    <div className="space-y-1">
      {files.map((f) => (
        <div key={f.path} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-mono truncate">{f.path}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <span className="text-xs text-muted-foreground font-mono">{f.hash}</span>
            <span className="text-xs text-muted-foreground">
              {f.size < 1024 ? `${f.size}B` : `${(f.size / 1024).toFixed(1)}KB`}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ClawHubPublish() {
  const { user, loading } = useAuth();
  const [publishVersion, setPublishVersion] = useState("");
  const [changelog, setChangelog] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("nervix");
  const [showPreview, setShowPreview] = useState(false);

  // Queries
  const statusQuery = trpc.clawhub.status.useQuery(undefined, {
    refetchInterval: 60000,
  });
  const previewQuery = trpc.clawhub.preview.useQuery(undefined, {
    enabled: showPreview,
  });
  const versionsQuery = trpc.clawhub.versions.useQuery(undefined, {
    enabled: statusQuery.data?.isPublished === true,
  });
  const searchResults = trpc.clawhub.search.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length > 0 }
  );

  // Mutations
  const validateMutation = trpc.clawhub.validateToken.useMutation();
  const publishMutation = trpc.clawhub.publish.useMutation();
  const autoBumpMutation = trpc.clawhub.autoBumpPublish.useMutation();

  // Change detection
  const changesQuery = trpc.clawhub.detectChanges.useQuery(undefined, {
    refetchInterval: 120000,
  });

  const handleValidateToken = async () => {
    const result = await validateMutation.mutateAsync();
    if (result.valid) {
      toast.success(`Token valid — authenticated as ${result.handle}`);
    } else {
      toast.error(`Token invalid: ${result.error}`);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const result = await publishMutation.mutateAsync({
        version: publishVersion || undefined,
        changelog: changelog || undefined,
      });
      if (result.success) {
        toast.success(`Published! ${result.slug} v${result.version} is now live on ClawHub`);
        statusQuery.refetch();
        versionsQuery.refetch();
        changesQuery.refetch();
        setPublishVersion("");
        setChangelog("");
      } else {
        toast.error(`Publish failed: ${result.error}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleAutoBump = async (bumpType: "patch" | "minor" | "major") => {
    setIsPublishing(true);
    try {
      const result = await autoBumpMutation.mutateAsync({
        bumpType,
        changelog: changelog || undefined,
      });
      if (result.success) {
        toast.success(`Auto-bumped ${bumpType}! ${'slug' in result ? result.slug : 'nervix-federation'} v${'newVersion' in result ? result.newVersion : ''} is now live`);
        statusQuery.refetch();
        versionsQuery.refetch();
        changesQuery.refetch();
        setChangelog("");
      } else {
        toast.error(`Auto-bump failed: ${result.error}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const status = statusQuery.data;
  const preview = previewQuery.data;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-white/[0.06] bg-white/[0.02]">
        <div className="container py-6">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
            </Link>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-lg">
                  🦞
                </div>
                <div>
                  <h1 className="text-2xl font-bold">ClawHub Publishing</h1>
                  <p className="text-sm text-muted-foreground">Manage the nervix-federation skill on OpenClaw ClawHub</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {status && <StatusBadge published={status.isPublished} upToDate={status.isUpToDate} />}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => statusQuery.refetch()}
                disabled={statusQuery.isFetching}
              >
                <RefreshCw className={`w-4 h-4 ${statusQuery.isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 space-y-8">
        {/* Status Overview */}
        {status && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={Globe}
              label="Registry Status"
              value={status.isPublished ? "Published" : "Not Published"}
              sub={status.isPublished ? `on clawhub.ai` : "Ready to publish"}
            />
            <StatCard
              icon={Hash}
              label="Latest Version"
              value={status.latestVersion || status.localVersion}
              sub={status.isPublished ? "Published" : "Local only"}
            />
            <StatCard
              icon={Package}
              label="Bundle Size"
              value={`${(status.localBundleSize / 1024).toFixed(1)} KB`}
              sub={`${status.localFileCount} files`}
            />
            <StatCard
              icon={BarChart3}
              label="Total Versions"
              value={status.totalVersions.toString()}
              sub={status.lastUpdated ? `Updated ${new Date(status.lastUpdated).toLocaleDateString()}` : "—"}
            />
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left Column: Publish Controls */}
          <div className="space-y-6">
            {/* Token Validation */}
            <Card className="bg-white/[0.02] border-white/[0.06]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="w-5 h-5 text-blue-400" /> API Authentication
                </CardTitle>
                <CardDescription>
                  Validate your ClawHub API token before publishing. Get a token at{" "}
                  <a href="https://clawhub.ai/settings" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                    clawhub.ai/settings <ExternalLink className="w-3 h-3 inline" />
                  </a>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    onClick={handleValidateToken}
                    disabled={validateMutation.isPending}
                    variant="outline"
                    className="gap-2"
                  >
                    {validateMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Shield className="w-4 h-4" />
                    )}
                    Validate Token
                  </Button>
                  {validateMutation.data && (
                    <div className="flex items-center gap-2 px-3">
                      {validateMutation.data.valid ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-sm text-emerald-400">Authenticated as {validateMutation.data.handle}</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-red-400" />
                          <span className="text-sm text-red-400">{validateMutation.data.error}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Smart Version Bump */}
            {changesQuery.data && (
              <Card className="bg-white/[0.02] border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <RefreshCw className="w-5 h-5 text-cyan-400" /> Smart Version Bump
                  </CardTitle>
                  <CardDescription>
                    Auto-detect changes and suggest the next version
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Current Version</span>
                      <span className="text-sm font-mono font-bold text-foreground">{changesQuery.data.currentVersion}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Suggested Version</span>
                      <span className="text-sm font-mono font-bold text-emerald-400">{changesQuery.data.suggestedVersion}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Suggested Bump</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        changesQuery.data.suggestedBump === "major" ? "bg-red-500/10 text-red-400" :
                        changesQuery.data.suggestedBump === "minor" ? "bg-amber-500/10 text-amber-400" :
                        "bg-blue-500/10 text-blue-400"
                      }`}>
                        {changesQuery.data.suggestedBump.toUpperCase()}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-white/[0.06]">
                      <p className="text-xs text-muted-foreground">{changesQuery.data.changeDescription}</p>
                    </div>
                    {changesQuery.data.changedFiles.length > 0 && (
                      <div className="pt-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Changed Files ({changesQuery.data.changedFiles.length})</p>
                        <div className="max-h-24 overflow-y-auto space-y-0.5">
                          {changesQuery.data.changedFiles.map((f: string) => (
                            <div key={f} className="text-xs font-mono text-muted-foreground/70 truncate">{f}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {(["patch", "minor", "major"] as const).map((type) => (
                      <Button
                        key={type}
                        onClick={() => handleAutoBump(type)}
                        disabled={isPublishing || !user}
                        variant={type === changesQuery.data?.suggestedBump ? "default" : "outline"}
                        size="sm"
                        className={type === changesQuery.data?.suggestedBump
                          ? "gap-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
                          : "gap-1.5 border-white/[0.1] text-foreground hover:bg-white/[0.05]"
                        }
                      >
                        {isPublishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Button>
                    ))}
                  </div>
                  {!user && (
                    <span className="text-xs text-muted-foreground">Login required to publish</span>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Manual Publish Form */}
            <Card className="bg-white/[0.02] border-white/[0.06]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Upload className="w-5 h-5 text-emerald-400" /> Manual Publish
                </CardTitle>
                <CardDescription>
                  Specify an exact version and changelog to publish manually
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                    Version (optional — defaults to {status?.localVersion || "1.0.0"})
                  </label>
                  <Input
                    placeholder="e.g. 1.1.0"
                    value={publishVersion}
                    onChange={(e) => setPublishVersion(e.target.value)}
                    className="bg-white/[0.03] border-white/[0.08]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                    Changelog (optional — also used by Smart Bump)
                  </label>
                  <Textarea
                    placeholder="What changed in this version..."
                    value={changelog}
                    onChange={(e) => setChangelog(e.target.value)}
                    rows={3}
                    className="bg-white/[0.03] border-white/[0.08] resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handlePublish}
                    disabled={isPublishing || !user}
                    className="gap-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500"
                  >
                    {isPublishing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    {isPublishing ? "Publishing..." : "Publish Now"}
                  </Button>
                  {!user && (
                    <span className="text-xs text-muted-foreground flex items-center">
                      Login required to publish
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Search ClawHub */}
            <Card className="bg-white/[0.02] border-white/[0.06]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Search className="w-5 h-5 text-purple-400" /> Search ClawHub
                </CardTitle>
                <CardDescription>Search for skills on the ClawHub registry</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search skills..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-white/[0.03] border-white/[0.08]"
                  />
                </div>
                {searchResults.data && searchResults.data.length > 0 ? (
                  <div className="space-y-2">
                    {searchResults.data.map((r: any) => (
                      <a
                        key={r.slug}
                        href={`https://clawhub.ai/skills/${r.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors group"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium group-hover:text-blue-400 transition-colors">
                            {r.displayName || r.slug}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{r.summary}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="text-xs text-muted-foreground">v{r.version}</span>
                          <ExternalLink className="w-3 h-3 text-muted-foreground" />
                        </div>
                      </a>
                    ))}
                  </div>
                ) : searchResults.data?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No results found</p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Bundle Preview & Versions */}
          <div className="space-y-6">
            {/* Bundle Preview */}
            <Card className="bg-white/[0.02] border-white/[0.06]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Eye className="w-5 h-5 text-cyan-400" /> Skill Bundle Preview
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                    className="gap-1.5"
                  >
                    <Eye className="w-4 h-4" /> {showPreview ? "Hide" : "Show"} Files
                  </Button>
                </div>
                <CardDescription>
                  Preview the files that will be published to ClawHub
                </CardDescription>
              </CardHeader>
              <CardContent>
                {preview ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-white/[0.03]">
                        <div className="text-xs text-muted-foreground">Slug</div>
                        <div className="text-sm font-mono">{preview.slug}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/[0.03]">
                        <div className="text-xs text-muted-foreground">Version</div>
                        <div className="text-sm font-mono">{preview.version}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/[0.03]">
                        <div className="text-xs text-muted-foreground">Files</div>
                        <div className="text-sm">{preview.fileCount} files</div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/[0.03]">
                        <div className="text-xs text-muted-foreground">Size</div>
                        <div className="text-sm">{(preview.totalSize / 1024).toFixed(1)} KB</div>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/[0.03]">
                      <div className="text-xs text-muted-foreground mb-1">Bundle Hash</div>
                      <div className="text-xs font-mono text-muted-foreground break-all">{preview.bundleHash}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">File Tree</div>
                      <FileTree files={preview.files} />
                    </div>
                  </div>
                ) : showPreview ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Click "Show Files" to preview the bundle
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Version History */}
            <Card className="bg-white/[0.02] border-white/[0.06]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="w-5 h-5 text-amber-400" /> Version History
                </CardTitle>
                <CardDescription>
                  {status?.isPublished
                    ? "Published versions on ClawHub"
                    : "No versions published yet — publish your first version above"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {versionsQuery.data && versionsQuery.data.length > 0 ? (
                  <div className="space-y-2">
                    {versionsQuery.data.map((v: any, i: number) => (
                      <div
                        key={v.version || i}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-mono font-semibold ${i === 0 ? "text-emerald-400" : ""}`}>
                            v{v.version}
                          </span>
                          {i === 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              LATEST
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {v.changelog && (
                            <span className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {v.changelog}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : status?.isPublished ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No versions published yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Use the publish form to push your first version
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Links */}
            <Card className="bg-white/[0.02] border-white/[0.06]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ExternalLink className="w-5 h-5 text-muted-foreground" /> Quick Links
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={status?.url || "https://clawhub.ai/skills/nervix-federation"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-sm"
                  >
                    <Globe className="w-4 h-4 text-blue-400" /> Skill Page
                  </a>
                  <a
                    href="https://clawhub.ai/settings"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-sm"
                  >
                    <Shield className="w-4 h-4 text-emerald-400" /> API Tokens
                  </a>
                  <a
                    href="https://clawhub.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-sm"
                  >
                    <Package className="w-4 h-4 text-purple-400" /> ClawHub Home
                  </a>
                  <Link href="/marketplace">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-sm cursor-pointer">
                      <Search className="w-4 h-4 text-amber-400" /> Marketplace
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
