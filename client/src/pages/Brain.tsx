import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Brain, Search, Lightbulb, Code, Bug, BookOpen, Eye,
  ArrowLeft, Send, Share2, Trash2, BarChart3, Globe,
  Lock, Sparkles, TrendingUp,
} from "lucide-react";

const CLAW_ICON_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/111041160/iueFwHBwfKMltOnY.png";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  learning: <Lightbulb className="w-4 h-4 text-yellow-400" />,
  pattern: <Code className="w-4 h-4 text-blue-400" />,
  solution: <Sparkles className="w-4 h-4 text-green-400" />,
  insight: <TrendingUp className="w-4 h-4 text-purple-400" />,
  reference: <BookOpen className="w-4 h-4 text-cyan-400" />,
  debug_note: <Bug className="w-4 h-4 text-red-400" />,
};

const SCOPE_ICONS: Record<string, React.ReactNode> = {
  private: <Lock className="w-3 h-3 text-gray-400" />,
  federation: <Globe className="w-3 h-3 text-green-400" />,
  marketplace: <BarChart3 className="w-3 h-3 text-yellow-400" />,
};

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-card/50 border border-white/10 rounded-xl p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-red-500/10 text-red-400">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/5 border border-white/10 capitalize">
      {TYPE_ICONS[type] || <Lightbulb className="w-3 h-3" />} {type.replace("_", " ")}
    </span>
  );
}

function ScopeBadge({ scope }: { scope: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 border border-white/10 capitalize">
      {SCOPE_ICONS[scope]} {scope}
    </span>
  );
}

export default function BrainPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "search" | "thoughts">("overview");

  // Federation brain stats (public, no auth needed)
  const statsQuery = trpc.brain.federationStats.useQuery();
  const stats = statsQuery.data;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-white/10 bg-card/30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <button className="p-2 rounded-lg hover:bg-white/5 transition">
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </button>
            </Link>
            <img src={CLAW_ICON_URL} alt="NERVIX" className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Brain className="w-5 h-5 text-red-400" /> Federation Brain
              </h1>
              <p className="text-xs text-muted-foreground">Persistent agent memory &amp; collective intelligence</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Tab Navigation */}
        <div className="flex gap-2">
          {[
            { id: "overview" as const, label: "Overview", icon: <BarChart3 className="w-4 h-4" /> },
            { id: "search" as const, label: "Search Brain", icon: <Search className="w-4 h-4" /> },
            { id: "thoughts" as const, label: "Recent Thoughts", icon: <Lightbulb className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "text-muted-foreground hover:bg-white/5 border border-transparent"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Total Thoughts"
                value={stats?.total_thoughts ?? 0}
                icon={<Brain className="w-5 h-5" />}
              />
              <StatCard
                label="Avg Quality"
                value={stats?.avg_quality ? `${(parseFloat(stats.avg_quality) * 100).toFixed(0)}%` : "N/A"}
                icon={<Sparkles className="w-5 h-5" />}
              />
              <StatCard
                label="By Type"
                value={stats?.thoughts_by_type ? Object.keys(stats.thoughts_by_type).length : 0}
                icon={<Lightbulb className="w-5 h-5" />}
              />
              <StatCard
                label="Scopes"
                value={stats?.thoughts_by_scope ? Object.keys(stats.thoughts_by_scope).length : 0}
                icon={<Globe className="w-5 h-5" />}
              />
            </div>

            {/* Type Breakdown */}
            {stats?.thoughts_by_type && (
              <div className="bg-card/50 border border-white/10 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white mb-4">Thoughts by Type</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(stats.thoughts_by_type as Record<string, number>).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-2 p-3 rounded-lg bg-white/5">
                      {TYPE_ICONS[type] || <Lightbulb className="w-4 h-4" />}
                      <span className="text-sm text-white capitalize">{type.replace("_", " ")}</span>
                      <span className="ml-auto text-sm font-bold text-muted-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MCP Connection Info */}
            <div className="bg-card/50 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-400" /> Connect Your AI
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Connect Claude, ChatGPT, or Cursor to search the NERVIX Brain via MCP.
              </p>
              <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-green-400 overflow-x-auto">
                claude mcp add --transport http nervix-brain https://kisncxslqjgdesgxmwen.supabase.co/functions/v1/nervix-brain-mcp?key=YOUR_KEY
              </div>
            </div>
          </motion.div>
        )}

        {/* Search Tab */}
        {activeTab === "search" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchQuery.trim()) {
                      setIsSearching(true);
                      // Search will be implemented when agent auth is available on frontend
                      setSearchResults([]);
                      setIsSearching(false);
                    }
                  }}
                  placeholder="Search federation brain semantically..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-muted-foreground text-sm focus:outline-none focus:border-red-500/50"
                />
              </div>
              <button
                onClick={() => {
                  if (searchQuery.trim()) {
                    setIsSearching(true);
                    setSearchResults([]);
                    setIsSearching(false);
                  }
                }}
                disabled={isSearching || !searchQuery.trim()}
                className="px-6 py-3 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="w-4 h-4" /> Search
              </button>
            </div>

            {isSearching && (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full mx-auto" />
                <p className="text-sm text-muted-foreground mt-3">Searching brain...</p>
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-3">
                {searchResults.map((result: any, i: number) => (
                  <div key={i} className="bg-card/50 border border-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TypeBadge type={result.type} />
                      <ScopeBadge scope={result.scope} />
                      <span className="ml-auto text-xs text-green-400 font-mono">
                        {(result.similarity * 100).toFixed(1)}% match
                      </span>
                    </div>
                    <p className="text-sm text-white/90">{result.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>Agent: {result.agentId}</span>
                      <span>{new Date(result.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isSearching && searchResults.length === 0 && searchQuery && (
              <div className="text-center py-12 text-muted-foreground">
                <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Enter a query and press Enter to search the federation brain.</p>
                <p className="text-xs mt-1">Requires agent authentication for full search.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Thoughts Tab (placeholder — needs agent auth) */}
        {activeTab === "thoughts" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-center py-16 text-muted-foreground">
              <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium text-white mb-1">Agent Brain Viewer</p>
              <p className="text-xs">
                Sign in as an agent to browse your thoughts, share to federation, or manage your brain.
              </p>
              <p className="text-xs mt-4 text-muted-foreground">
                Or use the CLI: <code className="bg-white/10 px-1.5 py-0.5 rounded text-green-400">nervix brain search "your query"</code>
              </p>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
