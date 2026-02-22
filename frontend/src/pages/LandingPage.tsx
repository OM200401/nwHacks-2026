import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Github, ArrowRight, Code2, Sparkles, History, Zap, GitBranch, MessageSquare, Clock, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const startGithubLogin = async () => {
  try {
    const res = await fetch(`${API_BASE}/auth/github`);
    if (!res.ok) throw new Error(`Auth init failed: ${res.status}`);
    const data = await res.json();
    if (!data?.auth_url) throw new Error("Missing auth_url from backend");
    window.location.href = data.auth_url;
  } catch (e: any) {
    toast.error(e.message ?? "Failed to start GitHub login");
  }
};

function useOAuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("access_token");
    if (accessToken) {
      localStorage.setItem("access_token", accessToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);
}

function parseGithubRepo(url: string) {
  const cleaned = url.replace("https://github.com/", "").replace(/^\//, "").replace(/\/$/, "");
  const [owner, repo] = cleaned.split("/");
  if (!owner || !repo) return null;
  return { owner, repo };
}

const ANALYSIS_STEPS = [
  "Registering repository...",
  "Fetching commits from GitHub...",
  "Generating AI embeddings...",
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [repoUrl, setRepoUrl] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<{ github_username: string; user_id: string } | null>(null);
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [showSignInDialog, setShowSignInDialog] = useState(false);
  const [availableRepos, setAvailableRepos] = useState<any[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState("");
  const [analysisStepNum, setAnalysisStepNum] = useState(0);
  const [showQuestionInput, setShowQuestionInput] = useState(false);
  const [userQuestion, setUserQuestion] = useState("");
  const [repoSearch, setRepoSearch] = useState("");

  useOAuthCallback();

  useEffect(() => {
    setIsConnected(!!localStorage.getItem("access_token"));
  }, []);

  useEffect(() => {
    const run = async () => {
      const t = localStorage.getItem("access_token");
      if (!t) return;
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) {
        localStorage.removeItem("access_token");
        return;
      }
      const data = await res.json();
      setUser(data);
      setIsConnected(true);
    };
    run();
  }, []);

  const fetchUserRepos = async () => {
    const t = localStorage.getItem("access_token");
    if (!t) return;
    setLoadingRepos(true);
    try {
      const res = await fetch(`${API_BASE}/api/repositories`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) throw new Error("Failed to fetch repositories");
      const data = await res.json();
      setAvailableRepos(data.repositories || []);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load repositories");
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleConnectCodebase = async () => {
    const t = localStorage.getItem("access_token");
    if (!t) {
      setShowSignInDialog(true);
      return;
    }
    setShowRepoSelector(true);
    fetchUserRepos();
  };

  const handleSelectRepo = (repo: any) => {
    setSelectedRepo(repo);
    setRepoUrl(repo.full_name);
    setShowRepoSelector(false);
    setShowQuestionInput(true);
    setIsConnected(true);
    setRepoSearch("");
  };

  const handleAsk = async () => {
    const t = localStorage.getItem("access_token");
    if (!t || !selectedRepo) return;

    setAnalyzing(true);
    setAnalysisStepNum(1);
    setAnalysisStep(ANALYSIS_STEPS[0]);

    const [repoOwner, repoName] = selectedRepo.full_name.split("/");
    const owner = repoOwner;
    const repo_name = repoName || selectedRepo.name;
    const full_name = selectedRepo.full_name;
    const github_repo_id = selectedRepo.id;
    const html_url = selectedRepo.html_url;
    const default_branch = selectedRepo.default_branch || "main";

    try {
      const res = await fetch(`${API_BASE}/api/repositories/analyze`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ owner, repo_name, full_name, github_repo_id, html_url, default_branch }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to analyze repository" }));
        toast.error(error.detail || "Failed to analyze repository");
        setAnalyzing(false);
        setAnalysisStepNum(0);
        return;
      }

      const data = await res.json();
      const repoId = data.repository.id;

      sessionStorage.setItem("last_question", userQuestion);
      sessionStorage.setItem("analysis_id", repoId);

      // Step 2: Fetch commits
      setAnalysisStepNum(2);
      setAnalysisStep(ANALYSIS_STEPS[1]);
      const fetchRes = await fetch(
        `${API_BASE}/api/repositories/${repoId}/fetch-commits?page=1&per_page=100`,
        { method: "POST", headers: { Authorization: `Bearer ${t}` } }
      );
      if (!fetchRes.ok) {
        console.error("Failed to fetch commits");
      }

      // Step 3: Generate embeddings
      setAnalysisStepNum(3);
      setAnalysisStep(ANALYSIS_STEPS[2]);
      const embedRes = await fetch(`${API_BASE}/api/repositories/${repoId}/cortex-embed`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "e5-base-v2", batch_size: 100 }),
      });
      if (!embedRes.ok) {
        console.error("Failed to generate embeddings");
      }

      navigate("/analyze");
    } catch (error: any) {
      toast.error("Failed to analyze repository. Please try again.");
    } finally {
      setAnalyzing(false);
      setAnalysisStepNum(0);
      setAnalysisStep("");
    }
  };

  const filteredRepos = availableRepos.filter(
    (repo) =>
      repoSearch === "" ||
      repo.full_name?.toLowerCase().includes(repoSearch.toLowerCase()) ||
      repo.description?.toLowerCase().includes(repoSearch.toLowerCase())
  );

  const features = [
    {
      icon: MessageSquare,
      title: "Ask a Question",
      description: "Ask anything about your codebase — architecture decisions, refactors, or mysterious functions.",
    },
    {
      icon: Clock,
      title: "We Search History",
      description: "Our AI digs through commits, PRs, and code changes to find the relevant context.",
    },
    {
      icon: Zap,
      title: "Get Answers",
      description: "See the code with highlights, linked commits, and explanations of why decisions were made.",
    },
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
              <Code2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg sm:text-xl text-foreground">CodeAncestry</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Brain for your Codebase</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {isConnected && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Connected
              </div>
            )}
            {user ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-muted/50">
                  <img
                    src={`https://github.com/${user.github_username}.png`}
                    alt={user.github_username}
                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-full"
                  />
                  <span className="text-sm font-medium text-foreground hidden sm:inline">
                    {user.github_username}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    localStorage.removeItem("access_token");
                    setUser(null);
                    setIsConnected(false);
                    setSelectedRepo(null);
                    window.location.reload();
                  }}
                >
                  Log out
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={startGithubLogin}>
                <Github className="w-4 h-4 mr-2" />
                Sign in
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center mb-10 sm:mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-6">
            <History className="w-4 h-4" />
            AI-Powered Code Archaeology
          </div>
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-4 leading-tight">
            Talk to your
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              codebase
            </span>
            <br />
            like it&apos;s your teammate
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Connect your repo, ask a question. We&apos;ll dig through your commit history to explain{" "}
            <span className="text-foreground font-medium">why</span> decisions were made, not just what
            the code does.
          </p>
        </div>

        {/* Main Input Flow */}
        <div className="max-w-2xl mx-auto mb-12 sm:mb-16 space-y-4 animate-slide-in-right" style={{ animationDelay: "0.2s" }}>
          <div
            className={`p-5 sm:p-6 rounded-2xl border-2 transition-all ${
              isConnected
                ? "border-primary/30 bg-primary/5"
                : "border-border bg-card/50 backdrop-blur-sm"
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  isConnected && selectedRepo
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isConnected && selectedRepo ? "✓" : "1"}
              </div>
              <span className="font-semibold text-foreground">
                {isConnected && selectedRepo ? "Repository Connected" : "Select your repository"}
              </span>
            </div>

            {isConnected ? (
              <div className="space-y-3">
                {selectedRepo ? (
                  <>
                    <div className="flex items-center gap-3 p-3 sm:p-4 bg-background border border-input rounded-lg">
                      <GitBranch className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium text-foreground flex-1 truncate text-sm sm:text-base">
                        {selectedRepo.full_name || selectedRepo.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowRepoSelector(true);
                          fetchUserRepos();
                        }}
                        className="gap-2 flex-shrink-0 text-xs sm:text-sm"
                      >
                        Change
                      </Button>
                    </div>

                    {showQuestionInput ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={userQuestion}
                          onChange={(e) => setUserQuestion(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && userQuestion.trim()) handleAsk();
                          }}
                          placeholder="Ask a question about your codebase..."
                          className="w-full px-3 py-2.5 rounded-lg bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          autoFocus
                          disabled={analyzing}
                        />

                        {analyzing ? (
                          <div className="space-y-2 py-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-2 text-muted-foreground">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary flex-shrink-0" />
                                {analysisStep}
                              </span>
                              <span className="text-muted-foreground font-mono">
                                {analysisStepNum}/3
                              </span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                                style={{ width: `${(analysisStepNum / 3) * 100}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              onClick={handleAsk}
                              disabled={!userQuestion.trim()}
                              className="flex-1 h-10 gap-2"
                            >
                              <Sparkles className="w-3 h-3" />
                              Analyze
                              <ArrowRight className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowQuestionInput(false);
                                setUserQuestion("");
                              }}
                              className="h-10"
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Button
                        onClick={() => setShowQuestionInput(true)}
                        className="w-full h-12 gap-2 text-base"
                      >
                        <Sparkles className="w-4 h-4" />
                        Analyze Repository
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    onClick={() => {
                      setShowRepoSelector(true);
                      fetchUserRepos();
                    }}
                    className="w-full h-12 gap-2 text-base"
                  >
                    <GitBranch className="w-4 h-4" />
                    Select Repository
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center py-6 sm:py-8">
                <p className="text-muted-foreground mb-4 text-sm sm:text-base">
                  Login to select a repository
                </p>
                <Button onClick={handleConnectCodebase} className="h-12 px-6 gap-2">
                  <Github className="w-4 h-4" />
                  Sign in with GitHub
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 animate-fade-in" style={{ animationDelay: "0.4s" }}>
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-5 sm:p-6 rounded-xl bg-card/30 border border-border/50 hover:border-primary/30 transition-colors group"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12 sm:mt-16 animate-fade-in" style={{ animationDelay: "0.6s" }}>
          <p className="text-sm text-muted-foreground">
            Built for developers who inherit code without context
          </p>
        </div>
      </main>

      {/* Sign In Dialog */}
      {showSignInDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-card rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-md p-6 sm:p-8 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl sm:text-2xl font-bold text-foreground">Sign in Required</h3>
              <button
                onClick={() => setShowSignInDialog(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-muted-foreground mb-6 text-sm sm:text-base">
              Please sign in with your GitHub account to connect your codebase and start analyzing your
              repositories.
            </p>
            <Button
              onClick={() => {
                setShowSignInDialog(false);
                startGithubLogin();
              }}
              className="w-full h-12 gap-2"
              size="lg"
            >
              <Github className="w-5 h-5" />
              Sign in with GitHub
            </Button>
          </div>
        </div>
      )}

      {/* Repository Selector Dialog */}
      {showRepoSelector && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-card rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-2xl sm:max-h-[80vh] flex flex-col shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-border flex-shrink-0">
              <h3 className="text-xl sm:text-2xl font-bold text-foreground">Select Repository</h3>
              <button
                onClick={() => {
                  setShowRepoSelector(false);
                  setRepoSearch("");
                }}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search input */}
            <div className="px-5 sm:px-6 py-3 border-b border-border flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search repositories..."
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 min-h-0 max-h-[50vh] sm:max-h-none">
              {loadingRepos ? (
                <div className="text-center py-12">
                  <div className="inline-block w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                  <p className="text-muted-foreground text-sm">Loading your repositories...</p>
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="text-center py-12">
                  <GitBranch className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {repoSearch ? "No matching repositories" : "No repositories found"}
                  </p>
                  {repoSearch && (
                    <button
                      onClick={() => setRepoSearch("")}
                      className="mt-2 text-sm text-primary hover:underline"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredRepos.map((repo) => (
                    <button
                      key={repo.id}
                      onClick={() => handleSelectRepo(repo)}
                      className="w-full p-3 sm:p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left group"
                    >
                      <div className="flex items-start gap-3">
                        <GitBranch className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground group-hover:text-primary mt-0.5 transition-colors flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm sm:text-base truncate">
                            {repo.full_name || repo.name}
                          </div>
                          {repo.description && (
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-1">
                              {repo.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            {repo.language && (
                              <span className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-primary" />
                                {repo.language}
                              </span>
                            )}
                            {repo.updated_at && (
                              <span>Updated {new Date(repo.updated_at).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 mt-1" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
