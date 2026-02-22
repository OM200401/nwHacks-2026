import { useState, useCallback, useEffect } from "react";
import {
  GitCommit,
  FileCode,
  ChevronRight,
  ChevronDown,
  Clock,
  ArrowLeft,
  ExternalLink,
  User,
  X,
  MessageSquare,
  Code2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ExplanationPanel } from "@/components/ExplanationPanel";
import { useNavigate } from "react-router-dom";
import { fetchCommitDetails } from "@/lib/api";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

type CommitNode = {
  id: string;
  hash: string;
  summary: string;
  description: string;
  date: string;
  author: string;
  relevance: "high" | "medium" | "low";
  fileCount: number;
  linkedSections: string[];
};

const Index = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<"answer" | "commits" | "files">("answer");
  const [selectedCommitNode, setSelectedCommitNode] = useState<string | null>(null);
  const [commitNodesState, setCommitNodesState] = useState<CommitNode[]>([]);
  const [commitDetails, setCommitDetails] = useState<any>(null);
  const [loadingCommitDetails, setLoadingCommitDetails] = useState(false);
  const [activeSection, setActiveSection] = useState("1");
  const [expandedSections, setExpandedSections] = useState<string[]>(["1"]);
  const [userQuestion, setUserQuestion] = useState(
    "Why was the authentication system refactored in 2023?"
  );
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [questionInput, setQuestionInput] = useState("");

  const repoId = sessionStorage.getItem("analysis_id") || "";

  useEffect(() => {
    const savedQuestion = sessionStorage.getItem("last_question");
    if (savedQuestion) setUserQuestion(savedQuestion);
  }, []);

  useEffect(() => {
    const runAutoQuery = async () => {
      const savedQuestion = sessionStorage.getItem("last_question");
      if (savedQuestion && repoId && commitNodesState.length === 0) {
        await askRepoQuestion(savedQuestion);
      }
    };
    runAutoQuery();
  }, [repoId]);

  async function askRepoQuestion(question: string) {
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token");
      if (!token) {
        toast.error("Please log in first.");
        setAnswer("Please log in first — no authentication token found.");
        return;
      }

      const res = await fetch(`${API_BASE}/api/repositories/${repoId}/cortex-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, top_k: 5, model: "mistral-7b" }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const msg = `Error ${res.status}: ${errorData.detail || "Unknown error"}`;
        toast.error(msg);
        setAnswer(msg);
        return;
      }

      const data = await res.json();
      setAnswer(data.answer || "No answer returned from backend.");

      if (data.sources && data.sources.length > 0) {
        const ragCommits: CommitNode[] = data.sources.map((source: any) => {
          let relevance: "high" | "medium" | "low" = "low";
          if (source.similarity >= 0.7) relevance = "high";
          else if (source.similarity >= 0.5) relevance = "medium";

          let formattedDate = "Unknown";
          if (source.commit_date) {
            try {
              formattedDate = new Date(source.commit_date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              });
            } catch {
              formattedDate = source.commit_date;
            }
          }

          return {
            id: source.sha.substring(0, 7),
            hash: source.sha.substring(0, 7),
            summary: source.ai_summary || source.message,
            description: source.message,
            date: formattedDate,
            author: source.author_name || "Unknown",
            relevance,
            fileCount: 0,
            linkedSections: [],
          };
        });
        setCommitNodesState(ragCommits);
      }
    } catch (err) {
      toast.error("Failed to reach CodeAncestry backend.");
      setAnswer("Failed to reach CodeAncestry backend.");
    } finally {
      setLoading(false);
    }
  }

  const handleAsk = () => {
    if (!questionInput.trim()) return;
    const q = questionInput.trim();
    setUserQuestion(q);
    setQuestionInput("");
    askRepoQuestion(q);
    if (isMobile) setMobileTab("answer");
  };

  const activeCommit = selectedCommitNode
    ? commitNodesState.find((n) => n.id === selectedCommitNode)
    : commitNodesState[0];

  const handleNodeClick = useCallback(
    async (nodeId: string) => {
      if (selectedCommitNode === nodeId) {
        setSelectedCommitNode(null);
        setCommitDetails(null);
      } else {
        setSelectedCommitNode(nodeId);
        setMobileTab("files");

        const token = localStorage.getItem("access_token");
        if (token && repoId) {
          setLoadingCommitDetails(true);
          try {
            const data = await fetchCommitDetails(repoId, nodeId, token);
            setCommitDetails(data.commit);
          } catch {
            toast.error("Failed to load commit details.");
          } finally {
            setLoadingCommitDetails(false);
          }
        }

        const node = commitNodesState.find((n) => n.id === nodeId);
        if (node && node.linkedSections.length > 0) {
          setExpandedSections(node.linkedSections);
          setActiveSection(node.linkedSections[0]);
        }
      }
    },
    [selectedCommitNode, commitNodesState, repoId]
  );

  const handleCloseDetails = useCallback(() => {
    setSelectedCommitNode(null);
  }, []);

  // ─── Shared sub-renders ────────────────────────────────────────────────────

  const renderCommitCard = (node: CommitNode, compact: boolean) => (
    <button
      key={node.id}
      onClick={() => handleNodeClick(node.id)}
      className={cn(
        "relative flex items-start gap-3 sm:gap-4 rounded-xl transition-all duration-200 text-left w-full",
        "hover:bg-muted/50",
        compact ? "p-2" : "p-4",
        selectedCommitNode === node.id && "bg-primary/10 ring-1 ring-primary"
      )}
    >
      {/* Circle Node */}
      <div
        className={cn(
          "relative z-10 rounded-full border-4 flex items-center justify-center flex-shrink-0 transition-all",
          compact ? "w-10 h-10" : "w-14 h-14 sm:w-16 sm:h-16",
          node.relevance === "high" && "border-green-500 bg-green-500/20 shadow-green-500/50 shadow-lg",
          node.relevance === "medium" && "border-amber-500 bg-amber-500/20 shadow-amber-500/50 shadow-md",
          node.relevance === "low" && "border-slate-400 bg-slate-400/10",
          selectedCommitNode === node.id && "scale-110 ring-2 ring-primary ring-offset-2"
        )}
      >
        <GitCommit
          className={cn(
            compact ? "w-4 h-4" : "w-6 h-6 sm:w-7 sm:h-7",
            node.relevance === "high" && "text-green-600",
            node.relevance === "medium" && "text-amber-600",
            node.relevance === "low" && "text-slate-500"
          )}
        />
      </div>

      {/* Node info */}
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <code
            className={cn(
              "font-mono font-bold text-primary",
              compact ? "text-xs" : "text-sm sm:text-base"
            )}
          >
            {node.hash}
          </code>
          <span
            className={cn(
              "px-2 py-0.5 rounded-full font-semibold tracking-wide",
              compact ? "text-[9px]" : "text-[10px] sm:text-xs",
              node.relevance === "high" && "bg-green-500/30 text-green-700 border border-green-500/50",
              node.relevance === "medium" && "bg-amber-500/30 text-amber-700 border border-amber-500/50",
              node.relevance === "low" && "bg-slate-300/30 text-slate-600 border border-slate-400/50"
            )}
          >
            {node.relevance === "high" ? "🎯 HIGH" : node.relevance === "medium" ? "⚡ MED" : "📍 LOW"}
          </span>
        </div>
        <p
          className={cn(
            "text-foreground font-medium mt-1",
            compact ? "text-xs truncate" : "text-sm sm:text-base"
          )}
        >
          {node.summary}
        </p>
        {!compact && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
            {node.description}
          </p>
        )}
        <div
          className={cn(
            "flex items-center gap-2 sm:gap-3 text-muted-foreground mt-2 flex-wrap",
            compact ? "text-[10px]" : "text-xs sm:text-sm"
          )}
        >
          <span className="flex items-center gap-1">
            <User className={compact ? "w-3 h-3" : "w-3.5 h-3.5 sm:w-4 sm:h-4"} />
            {compact ? node.author.split(" ")[0] : node.author}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Clock className={compact ? "w-3 h-3" : "w-3.5 h-3.5 sm:w-4 sm:h-4"} />
            {node.date}
          </span>
        </div>
      </div>

      <ChevronRight
        className={cn(
          "text-muted-foreground flex-shrink-0 transition-transform mt-2",
          compact ? "w-3.5 h-3.5" : "w-4 h-4 sm:w-5 sm:h-5",
          selectedCommitNode === node.id && "rotate-90 text-primary"
        )}
      />
    </button>
  );

  const renderFilesList = () => {
    if (loadingCommitDetails) {
      return (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          <div className="space-y-2 w-full max-w-sm">
            <div className="h-3 bg-muted/60 rounded animate-pulse w-2/3" />
            <div className="h-3 bg-muted/60 rounded animate-pulse w-full" />
            <div className="h-3 bg-muted/60 rounded animate-pulse w-4/5" />
          </div>
        </div>
      );
    }

    if (!commitDetails?.files_changed) {
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
          Select a commit to view file changes
        </div>
      );
    }

    return commitDetails.files_changed.map((file: any, idx: number) => {
      const isExpanded = expandedSections.includes(String(idx));
      return (
        <div
          key={idx}
          className={cn(
            "rounded-lg border overflow-hidden transition-all duration-200",
            activeSection === String(idx)
              ? "border-primary/50 bg-primary/5 shadow-sm"
              : "border-border bg-card/50 hover:border-muted-foreground/30"
          )}
        >
          <button
            onClick={() => {
              setActiveSection(String(idx));
              setExpandedSections((prev) =>
                prev.includes(String(idx))
                  ? prev.filter((id) => id !== String(idx))
                  : [...prev, String(idx)]
              );
            }}
            className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  file.status === "added" && "bg-green-500",
                  file.status === "modified" && "bg-yellow-500",
                  file.status === "removed" && "bg-red-500"
                )}
              />
              <FileCode className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="font-medium text-foreground text-sm truncate">{file.filename}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">{file.status}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-green-500">+{file.additions}</span>
              <span className="text-xs text-red-500">-{file.deletions}</span>
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                  isExpanded && "rotate-180"
                )}
              />
            </div>
          </button>

          <div
            className={cn(
              "overflow-hidden transition-all duration-200",
              isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="border-t border-border bg-code-bg">
              <pre className="p-3 text-xs font-mono overflow-x-auto max-h-[400px] sm:max-h-[500px] overflow-y-auto">
                {file.patch ? (
                  file.patch.split("\n").map((line: string, i: number) => (
                    <div
                      key={i}
                      className={cn(
                        "px-2 -mx-2",
                        line.startsWith("+") && !line.startsWith("+++") && "bg-green-500/10 text-green-400",
                        line.startsWith("-") && !line.startsWith("---") && "bg-red-500/10 text-red-400",
                        line.startsWith("@@") && "text-blue-400 bg-blue-500/10"
                      )}
                    >
                      {line || " "}
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground italic">No diff available</div>
                )}
              </pre>
            </div>
          </div>
        </div>
      );
    });
  };

  const renderAnswerInput = () => (
    <div className="p-3 border-t border-border bg-card/50 flex-shrink-0">
      <div className="relative">
        <input
          type="text"
          value={questionInput}
          onChange={(e) => setQuestionInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && questionInput.trim()) handleAsk();
          }}
          placeholder="Ask a follow-up question..."
          className="w-full px-3 py-2.5 pr-16 rounded-lg bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <Button size="sm" className="absolute right-1 top-1" onClick={handleAsk}>
          Ask
        </Button>
      </div>
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* ── Mobile Header ── */}
      <header className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent flex-shrink-0 md:hidden">
        <div className="flex items-center justify-between px-3 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="gap-1 text-muted-foreground hover:text-foreground px-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">CodeAncestry</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs text-muted-foreground px-2"
            onClick={() => activeCommit && commitDetails?.html_url && window.open(commitDetails.html_url, "_blank")}
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* ── Desktop Header ── */}
      <header className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent flex-shrink-0 hidden md:block">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="gap-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                <GitCommit className="w-4 h-4 text-primary" />
                <code className="text-sm font-mono font-bold text-primary">
                  {activeCommit?.hash || "---"}
                </code>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-muted-foreground"
              onClick={() => commitDetails?.html_url && window.open(commitDetails.html_url, "_blank")}
            >
              <ExternalLink className="w-3 h-3" />
              View on GitHub
            </Button>
          </div>

          <h1 className="text-lg font-semibold text-foreground mb-1">
            {activeCommit?.summary || "Select a commit to view details"}
          </h1>
          <p className="text-sm text-muted-foreground mb-3">
            {activeCommit?.description || "No description available"}
          </p>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium text-[10px]">
                {activeCommit?.author
                  ? activeCommit.author.split(" ").map((n) => n[0]).join("")
                  : "?"}
              </div>
              <span className="text-foreground font-medium">
                {activeCommit?.author || "Unknown"}
              </span>
            </div>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              {activeCommit?.date || "---"}
            </span>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════
           MOBILE LAYOUT  (hidden on md+)
         ══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col flex-1 overflow-hidden md:hidden">
        {/* Panel content */}
        <div className="flex-1 overflow-hidden">

          {/* Answer tab */}
          {mobileTab === "answer" && (
            <div className="h-full flex flex-col">
              <div className="px-4 py-3 border-b border-border bg-primary/5 flex-shrink-0">
                <div className="text-xs text-muted-foreground mb-1">Your question</div>
                <p className="text-sm font-medium text-foreground">"{userQuestion}"</p>
              </div>
              <div className="flex-1 overflow-auto min-h-0">
                <ExplanationPanel mode="explain" answer={answer} loading={loading} />
              </div>
              {renderAnswerInput()}
            </div>
          )}

          {/* Commits tab */}
          {mobileTab === "commits" && (
            <div className="h-full overflow-auto">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30 sticky top-0 z-10">
                <GitCommit className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Relevant Commits</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {commitNodesState.length} found
                </span>
              </div>

              {loading && commitNodesState.length === 0 ? (
                <div className="p-4 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex gap-3 p-4 rounded-xl border border-border animate-pulse">
                      <div className="w-14 h-14 rounded-full bg-muted flex-shrink-0" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="h-3 bg-muted rounded w-1/3" />
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : commitNodesState.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center p-8 gap-3">
                  <GitCommit className="w-12 h-12 text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm">
                    No commits yet. Ask a question in the Answer tab to find relevant commits.
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setMobileTab("answer")}>
                    Go to Answer
                  </Button>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {commitNodesState.map((node) => renderCommitCard(node, false))}
                </div>
              )}
            </div>
          )}

          {/* Files tab */}
          {mobileTab === "files" && (
            <div className="h-full overflow-auto">
              {!selectedCommitNode ? (
                <div className="flex flex-col items-center justify-center h-64 text-center p-8 gap-3">
                  <FileCode className="w-12 h-12 text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm">
                    Select a commit from the Commits tab to view file changes.
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setMobileTab("commits")}>
                    View Commits
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-primary/5 sticky top-0 z-10">
                    <FileCode className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Files Changed</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      {commitDetails?.files_changed?.length || 0} files
                    </span>
                    <button
                      onClick={handleCloseDetails}
                      className="ml-auto p-1 rounded hover:bg-muted/50 transition-colors"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="p-3 space-y-3">{renderFilesList()}</div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Mobile Tab Bar */}
        <nav className="border-t border-border bg-card/80 backdrop-blur-sm grid grid-cols-3 flex-shrink-0">
          {(
            [
              { id: "answer", label: "Answer", icon: MessageSquare },
              { id: "commits", label: "Commits", icon: GitCommit, badge: commitNodesState.length },
              { id: "files", label: "Files", icon: FileCode },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors relative",
                mobileTab === tab.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {mobileTab === tab.id && (
                <div className="absolute top-0 left-4 right-4 h-0.5 bg-primary rounded-b-full" />
              )}
              <div className="relative">
                <tab.icon className="w-5 h-5" />
                {"badge" in tab && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[1rem] h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {tab.badge > 9 ? "9+" : tab.badge}
                  </span>
                )}
              </div>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ══════════════════════════════════════════════════════════
           DESKTOP LAYOUT  (hidden on mobile)
         ══════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-hidden hidden md:flex">
        {/* Left Panel: Commit Graph */}
        <div
          className={cn(
            "flex flex-col border-r border-border transition-all duration-300",
            selectedCommitNode ? "w-[320px]" : "flex-1"
          )}
        >
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
            <GitCommit className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Commit Graph</span>
            <div className="ml-auto text-xs text-muted-foreground">
              {commitNodesState.length} commits
            </div>
          </div>

          <div
            className={cn("flex-1 overflow-auto", selectedCommitNode ? "p-4" : "p-6")}
          >
            {loading && commitNodesState.length === 0 ? (
              <div className="space-y-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-xl border border-border animate-pulse">
                    <div className="w-16 h-16 rounded-full bg-muted flex-shrink-0" />
                    <div className="flex-1 space-y-2 pt-2">
                      <div className="h-3 bg-muted rounded w-1/4" />
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                      <div className="h-3 bg-muted rounded w-2/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : commitNodesState.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4 p-8 text-muted-foreground">
                <GitCommit className="w-14 h-14 opacity-30" />
                <p className="text-sm">Ask a question to see relevant commits here.</p>
              </div>
            ) : (
              <div className={cn("flex flex-col", selectedCommitNode ? "space-y-4" : "space-y-6")}>
                {commitNodesState.map((node) => renderCommitCard(node, !!selectedCommitNode))}
              </div>
            )}
          </div>
        </div>

        {/* Middle Panel: Code Details */}
        <div
          className={cn(
            "flex flex-col border-r border-border bg-card/50 transition-all duration-300 overflow-hidden",
            selectedCommitNode ? "flex-1 opacity-100" : "w-0 opacity-0"
          )}
        >
          {selectedCommitNode && (
            <>
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-primary/5">
                <FileCode className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Files Changed</span>
                <span className="text-xs text-muted-foreground ml-1">
                  {commitDetails?.files_changed?.length || 0} files
                </span>
                <button
                  onClick={handleCloseDetails}
                  className="ml-auto p-1 rounded hover:bg-muted/50 transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-3 space-y-3 animate-fade-in">
                {renderFilesList()}
              </div>
            </>
          )}
        </div>

        {/* Right Panel: Answer + Input */}
        <div
          className={cn(
            "flex-shrink-0 flex flex-col h-full overflow-hidden transition-all duration-300",
            selectedCommitNode ? "w-[340px]" : "w-[480px]"
          )}
        >
          <div className="px-4 py-3 border-b border-border bg-primary/5 flex-shrink-0">
            <div className="text-xs text-muted-foreground mb-1">Your question</div>
            <p className="text-sm font-medium text-foreground">"{userQuestion}"</p>
          </div>
          <div className="flex-1 overflow-auto min-h-0">
            <ExplanationPanel mode="explain" answer={answer} loading={loading} />
          </div>
          {renderAnswerInput()}
        </div>
      </div>
    </div>
  );
};

export default Index;
