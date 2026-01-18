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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ExplanationPanel } from "@/components/ExplanationPanel";
import { useNavigate } from "react-router-dom";

// Mock commit data
const currentCommit = {
  hash: "a7c3d2f",
  fullHash: "a7c3d2f8e91b4c5d6e7f8a9b0c1d2e3f4a5b6c7d",
  message: "Refactor authentication flow",
  description:
    "Added logging for admin token bypass and improved JWT validation",
  author: "Sarah Chen",
  authorEmail: "sarah.chen@company.com",
  date: "Jan 16, 2026",
  timeAgo: "2 days ago",
  branch: "main",
  files: [
    {
      name: "OldSessionHandler.js",
      additions: 12,
      deletions: 5,
      path: "src/legacy",
      active: true,
    },
    {
      name: "AuthProvider.tsx",
      additions: 45,
      deletions: 23,
      path: "src/auth",
      active: false,
    },
    {
      name: "useAuth.ts",
      additions: 8,
      deletions: 2,
      path: "src/hooks",
      active: false,
    },
  ],
};

// High-level commit nodes for graph view
type CommitNode = {
  id: string;
  hash: string;
  summary: string;
  description: string;
  date: string;
  author: string;
  relevance: "high" | "medium" | "low";
  fileCount: number;
  linkedSections: string[]; // IDs of related code sections
};

const commitNodes: CommitNode[] = [
  {
    id: "c1",
    hash: "a7c3d2f",
    summary: "Refactor authentication flow",
    description:
      "Added logging for admin token bypass and improved JWT validation",
    date: "Jan 16, 2026",
    author: "Sarah Chen",
    relevance: "high",
    fileCount: 3,
    linkedSections: ["1", "2"],
  },
  {
    id: "c2",
    hash: "b4e5f6a",
    summary: "Add token refresh logging",
    description: "Enhanced debugging capabilities for auth token lifecycle",
    date: "Jan 14, 2026",
    author: "Mike Torres",
    relevance: "medium",
    fileCount: 1,
    linkedSections: ["3"],
  },
  {
    id: "c3",
    hash: "c8d9e0b",
    summary: "Initial session handler setup",
    description: "Legacy session management foundation",
    date: "Jan 10, 2026",
    author: "Sarah Chen",
    relevance: "low",
    fileCount: 2,
    linkedSections: [],
  },
  {
    id: "c4",
    hash: "d1f2a3c",
    summary: "Auth provider migration",
    description: "Moved from class-based to hook-based auth context",
    date: "Jan 8, 2026",
    author: "Alex Kim",
    relevance: "medium",
    fileCount: 2,
    linkedSections: ["2"],
  },
];

// Relevant code sections across multiple files
type CodeSection = {
  id: string;
  file: string;
  path: string;
  functionName: string;
  lineStart: number;
  lineEnd: number;
  relevance: "high" | "medium" | "low";
  summary: string;
  lines: {
    type: "context" | "addition" | "deletion";
    line: number;
    content: string;
    relevant?: boolean;
  }[];
};

const relevantSections: CodeSection[] = [
  {
    id: "1",
    file: "OldSessionHandler.js",
    path: "src/legacy",
    functionName: "_validateToken()",
    lineStart: 33,
    lineEnd: 44,
    relevance: "high",
    summary: "Admin token bypass was made auditable",
    lines: [
      { type: "context", line: 33, content: "  _validateToken(token) {" },
      { type: "context", line: 34, content: "    if (!token) return false;" },
      {
        type: "context",
        line: 35,
        content: "    // HACK: Skip validation for admin tokens",
        relevant: true,
      },
      {
        type: "deletion",
        line: 36,
        content: "    if (token.startsWith('admin_')) return true;",
        relevant: true,
      },
      {
        type: "addition",
        line: 36,
        content: "    if (token.startsWith('admin_')) {",
        relevant: true,
      },
      {
        type: "addition",
        line: 37,
        content: "      console.warn('Admin token bypass used');",
        relevant: true,
      },
      { type: "addition", line: 38, content: "      return true;" },
      { type: "addition", line: 39, content: "    }" },
      { type: "context", line: 40, content: "" },
      {
        type: "context",
        line: 41,
        content: "    const parts = token.split('.');",
      },
      {
        type: "deletion",
        line: 42,
        content: "    return parts.length >= 2;",
        relevant: true,
      },
      {
        type: "addition",
        line: 42,
        content: "    // Should be 3 parts for JWT but legacy tokens have 2",
      },
      {
        type: "addition",
        line: 43,
        content: "    return parts.length >= 2 && parts.length <= 3;",
        relevant: true,
      },
      { type: "context", line: 44, content: "  }" },
    ],
  },
  {
    id: "2",
    file: "AuthProvider.tsx",
    path: "src/auth",
    functionName: "useAuthState()",
    lineStart: 45,
    lineEnd: 58,
    relevance: "high",
    summary: "Auth state now checks token validity",
    lines: [
      { type: "context", line: 45, content: "  const useAuthState = () => {" },
      {
        type: "context",
        line: 46,
        content: "    const [user, setUser] = useState(null);",
      },
      {
        type: "addition",
        line: 47,
        content: "    const [isValidating, setIsValidating] = useState(true);",
        relevant: true,
      },
      { type: "context", line: 48, content: "" },
      { type: "context", line: 49, content: "    useEffect(() => {" },
      {
        type: "deletion",
        line: 50,
        content: "      const session = sessionHandler.getSession();",
        relevant: true,
      },
      {
        type: "addition",
        line: 50,
        content: "      const session = await sessionHandler.getSession();",
        relevant: true,
      },
      {
        type: "addition",
        line: 51,
        content: "      setIsValidating(false);",
        relevant: true,
      },
      {
        type: "context",
        line: 52,
        content: "      if (session) setUser(session.user);",
      },
      { type: "context", line: 53, content: "    }, []);" },
    ],
  },
  {
    id: "3",
    file: "useAuth.ts",
    path: "src/hooks",
    functionName: "refreshToken()",
    lineStart: 22,
    lineEnd: 35,
    relevance: "medium",
    summary: "Token refresh now logs attempts",
    lines: [
      {
        type: "context",
        line: 22,
        content: "  async function refreshToken() {",
      },
      {
        type: "addition",
        line: 23,
        content: "    console.log('Refreshing auth token...');",
        relevant: true,
      },
      { type: "context", line: 24, content: "    try {" },
      {
        type: "context",
        line: 25,
        content: "      const newToken = await api.refresh();",
      },
      {
        type: "addition",
        line: 26,
        content: "      console.log('Token refreshed successfully');",
        relevant: true,
      },
      { type: "context", line: 27, content: "      return newToken;" },
      { type: "context", line: 28, content: "    } catch (e) {" },
      {
        type: "addition",
        line: 29,
        content: "      console.error('Token refresh failed:', e);",
        relevant: true,
      },
      { type: "context", line: 30, content: "      throw e;" },
      { type: "context", line: 31, content: "    }" },
      { type: "context", line: 32, content: "  }" },
    ],
  },
];

const Index = () => {
  const navigate = useNavigate();
  const [selectedCommitNode, setSelectedCommitNode] = useState<string | null>(
    null
  );

  const [activeSection, setActiveSection] = useState("1");
  const [expandedSections, setExpandedSections] = useState<string[]>(["1"]);
  const [userQuestion, setUserQuestion] = useState(
    "Why was the authentication system refactored in 2023?"
  );
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [questionInput, setQuestionInput] = useState("");

  const [repoId, setRepoId] = useState<string | null>(null);

  useEffect(() => {
    async function loadRepo() {
      try {
        const res = await fetch("http://localhost:8000/repositories", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        });

        const repos = await res.json();

        if (repos.length > 0) {
          setRepoId(repos[0].id);
        } else {
          setAnswer("No repositories found in your account.");
        }
      } catch (err) {
        console.error(err);
        setAnswer("Failed to load repositories.");
      }
    }

    loadRepo();
  }, []);

  async function askRepoQuestion(question: string) {
    try {
      setLoading(true);

      const res = await fetch(
        `http://localhost:8000/repositories/${repoId}/cortex-query`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify({
            question: question,
            top_k: 5,
            model: "mistral-7b",
          }),
        }
      );

      const data = await res.json();

      setAnswer(data.answer || "No answer returned from backend.");
    } catch (err) {
      console.error(err);
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
  };

  // Get active commit data based on selection
  const activeCommit = selectedCommitNode
    ? commitNodes.find((n) => n.id === selectedCommitNode)
    : commitNodes[0];

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (selectedCommitNode === nodeId) {
        // Clicking same node closes the panel
        setSelectedCommitNode(null);
      } else {
        setSelectedCommitNode(nodeId);
        const node = commitNodes.find((n) => n.id === nodeId);
        if (node && node.linkedSections.length > 0) {
          setExpandedSections(node.linkedSections);
          setActiveSection(node.linkedSections[0]);
        }
      }
    },
    [selectedCommitNode]
  );

  const handleCloseDetails = useCallback(() => {
    setSelectedCommitNode(null);
  }, []);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Commit Header - More Prominent */}
      <header className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent flex-shrink-0">
        <div className="px-4 py-3">
          {/* Top row: Back + Commit hash */}
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
                  {activeCommit?.hash || currentCommit.hash}
                </code>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                on {currentCommit.branch}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-muted-foreground"
            >
              <ExternalLink className="w-3 h-3" />
              View on GitHub
            </Button>
          </div>

          {/* Commit message */}
          <h1 className="text-lg font-semibold text-foreground mb-1">
            {activeCommit?.summary || currentCommit.message}
          </h1>
          <p className="text-sm text-muted-foreground mb-3">
            {activeCommit?.description || currentCommit.description}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium text-[10px]">
                {(activeCommit?.author || currentCommit.author)
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <span className="text-foreground font-medium">
                {activeCommit?.author || currentCommit.author}
              </span>
            </div>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              {activeCommit?.date || currentCommit.date}
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <span className="flex items-center gap-1 text-muted-foreground">
                <FileCode className="w-3 h-3" />
                {activeCommit?.fileCount || currentCommit.files.length} files
                changed
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Graph - Always visible */}
        <div
          className={cn(
            "flex flex-col border-r border-border transition-all duration-300",
            selectedCommitNode ? "w-[320px]" : "flex-1"
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
            <GitCommit className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Commit Graph
            </span>
            <div className="ml-auto text-xs text-muted-foreground">
              {commitNodes.length} commits
            </div>
          </div>

          {/* Graph Content */}
          <div
            className={cn(
              "flex-1 overflow-auto",
              selectedCommitNode ? "p-4" : "p-6"
            )}
          >
            <div className="relative">
              {/* Timeline line */}
              <div
                className={cn(
                  "absolute top-6 bottom-6 w-0.5 bg-border",
                  selectedCommitNode ? "left-6" : "left-8"
                )}
              />

              {/* Graph nodes */}
              <div
                className={cn(
                  "flex flex-col",
                  selectedCommitNode ? "space-y-4" : "space-y-6"
                )}
              >
                {commitNodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => handleNodeClick(node.id)}
                    className={cn(
                      "relative flex items-start gap-4 rounded-xl transition-all duration-200 text-left",
                      "hover:bg-muted/50",
                      selectedCommitNode ? "p-2" : "p-4",
                      selectedCommitNode === node.id &&
                        "bg-primary/10 ring-1 ring-primary"
                    )}
                  >
                    {/* Circle Node */}
                    <div
                      className={cn(
                        "relative z-10 rounded-full border-4 flex items-center justify-center flex-shrink-0 transition-all",
                        selectedCommitNode ? "w-12 h-12" : "w-16 h-16",
                        node.relevance === "high" &&
                          "border-green-500 bg-green-500/10",
                        node.relevance === "medium" &&
                          "border-yellow-500 bg-yellow-500/10",
                        node.relevance === "low" &&
                          "border-muted-foreground/50 bg-muted/50",
                        selectedCommitNode === node.id && "scale-110 shadow-lg"
                      )}
                    >
                      <GitCommit
                        className={cn(
                          selectedCommitNode ? "w-5 h-5" : "w-7 h-7",
                          node.relevance === "high" && "text-green-500",
                          node.relevance === "medium" && "text-yellow-500",
                          node.relevance === "low" && "text-muted-foreground"
                        )}
                      />
                    </div>

                    {/* Node info */}
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code
                          className={cn(
                            "font-mono font-bold text-primary",
                            selectedCommitNode ? "text-xs" : "text-base"
                          )}
                        >
                          {node.hash}
                        </code>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded font-medium",
                            selectedCommitNode ? "text-[9px]" : "text-xs",
                            node.relevance === "high" &&
                              "bg-green-500/20 text-green-600",
                            node.relevance === "medium" &&
                              "bg-yellow-500/20 text-yellow-600",
                            node.relevance === "low" &&
                              "bg-muted text-muted-foreground"
                          )}
                        >
                          {node.relevance}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "text-foreground font-medium mt-1",
                          selectedCommitNode ? "text-xs truncate" : "text-base"
                        )}
                      >
                        {node.summary}
                      </p>
                      {!selectedCommitNode && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {node.description}
                        </p>
                      )}
                      <div
                        className={cn(
                          "flex items-center gap-3 text-muted-foreground mt-2",
                          selectedCommitNode ? "text-[10px]" : "text-sm"
                        )}
                      >
                        <span className="flex items-center gap-1">
                          <User
                            className={
                              selectedCommitNode ? "w-3 h-3" : "w-4 h-4"
                            }
                          />
                          {selectedCommitNode
                            ? node.author.split(" ")[0]
                            : node.author}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock
                            className={
                              selectedCommitNode ? "w-3 h-3" : "w-4 h-4"
                            }
                          />
                          {node.date}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <FileCode
                            className={
                              selectedCommitNode ? "w-3 h-3" : "w-4 h-4"
                            }
                          />
                          {node.fileCount} files
                        </span>
                      </div>
                    </div>

                    <ChevronRight
                      className={cn(
                        "text-muted-foreground flex-shrink-0 transition-transform",
                        selectedCommitNode ? "w-4 h-4 mt-2" : "w-5 h-5 mt-3",
                        selectedCommitNode === node.id &&
                          "rotate-90 text-primary"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Middle Panel: Code Details - Slides in when commit selected */}
        <div
          className={cn(
            "flex flex-col border-r border-border bg-card/50 transition-all duration-300 overflow-hidden",
            selectedCommitNode ? "flex-1 opacity-100" : "w-0 opacity-0"
          )}
        >
          {selectedCommitNode && (
            <>
              {/* Details Header */}
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-primary/5">
                <FileCode className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Code Details
                </span>
                <span className="text-xs text-muted-foreground ml-1">
                  {relevantSections.length} sections
                </span>
                <button
                  onClick={handleCloseDetails}
                  className="ml-auto p-1 rounded hover:bg-muted/50 transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Details Content */}
              <div className="flex-1 overflow-auto p-3 space-y-3 animate-fade-in">
                {relevantSections.map((section) => {
                  const isExpanded = expandedSections.includes(section.id);
                  return (
                    <div
                      key={section.id}
                      className={cn(
                        "rounded-lg border overflow-hidden transition-all duration-200",
                        activeSection === section.id
                          ? "border-primary/50 bg-primary/5 shadow-sm"
                          : "border-border bg-card/50 hover:border-muted-foreground/30"
                      )}
                    >
                      {/* Section header */}
                      <button
                        onClick={() => {
                          setActiveSection(section.id);
                          setExpandedSections((prev) =>
                            prev.includes(section.id)
                              ? prev.filter((id) => id !== section.id)
                              : [...prev, section.id]
                          );
                        }}
                        className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={cn(
                              "w-2 h-2 rounded-full flex-shrink-0",
                              section.relevance === "high" && "bg-green-500",
                              section.relevance === "medium" && "bg-yellow-500",
                              section.relevance === "low" &&
                                "bg-muted-foreground"
                            )}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm">
                              <FileCode className="w-4 h-4 text-primary flex-shrink-0" />
                              <span className="font-medium text-foreground truncate">
                                {section.file}
                              </span>
                              <code className="text-xs font-mono text-primary truncate">
                                {section.functionName}
                              </code>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">
                            L{section.lineStart}-{section.lineEnd}
                          </span>
                          <ChevronDown
                            className={cn(
                              "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                              isExpanded && "rotate-180"
                            )}
                          />
                        </div>
                      </button>

                      {/* Code snippet with animation */}
                      <div
                        className={cn(
                          "overflow-hidden transition-all duration-200",
                          isExpanded
                            ? "max-h-[400px] opacity-100"
                            : "max-h-0 opacity-0"
                        )}
                      >
                        <div className="border-t border-border bg-code-bg">
                          <div className="px-3 py-1.5 border-b border-border bg-muted/20">
                            <span className="text-xs font-mono text-muted-foreground">
                              {section.path}/{section.file}
                            </span>
                          </div>
                          <pre className="p-3 text-sm font-mono overflow-x-auto max-h-[300px] overflow-y-auto">
                            {section.lines.map((line, i) => (
                              <div
                                key={i}
                                className={cn(
                                  "flex px-1.5 -mx-1.5 relative",
                                  line.type === "addition" && "bg-green-500/10",
                                  line.type === "deletion" && "bg-red-500/10",
                                  line.relevant &&
                                    "ring-1 ring-inset ring-primary/40 bg-primary/5"
                                )}
                              >
                                {line.relevant && (
                                  <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />
                                )}
                                <span className="w-8 text-muted-foreground/50 text-right pr-3 select-none flex-shrink-0">
                                  {line.line}
                                </span>
                                <span
                                  className={cn(
                                    "w-2.5 flex-shrink-0",
                                    line.type === "addition" &&
                                      "text-green-500",
                                    line.type === "deletion" && "text-red-500"
                                  )}
                                >
                                  {line.type === "addition"
                                    ? "+"
                                    : line.type === "deletion"
                                    ? "-"
                                    : " "}
                                </span>
                                <span
                                  className={cn(
                                    "flex-1",
                                    line.type === "addition" &&
                                      "text-green-400",
                                    line.type === "deletion" && "text-red-400",
                                    line.type === "context" &&
                                      "text-muted-foreground"
                                  )}
                                >
                                  {line.content}
                                </span>
                              </div>
                            ))}
                          </pre>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Right Panel: Answer + Context */}
        <div
          className={cn(
            "flex-shrink-0 flex flex-col h-full overflow-hidden transition-all duration-300",
            selectedCommitNode ? "w-[340px]" : "w-[480px]"
          )}
        >
          {/* User's Question - Fixed at top */}
          <div className="px-4 py-3 border-b border-border bg-primary/5 flex-shrink-0">
            <div className="text-xs text-muted-foreground mb-1">
              Your question
            </div>
            <p className="text-sm font-medium text-foreground">
              "{userQuestion}"
            </p>
          </div>

          {/* Scrollable Answer Area */}
          <div className="flex-1 overflow-auto min-h-0">
            <ExplanationPanel
              mode="explain"
              answer={answer}
              loading={loading}
            />
          </div>

          {/* Follow-up Question Input - Fixed at bottom */}
          <div className="p-3 border-t border-border bg-card/50 flex-shrink-0">
            <div className="relative">
              <input
                type="text"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && questionInput.trim()) {
                    const q = questionInput.trim();
                    setUserQuestion(q);
                    setQuestionInput("");
                    askRepoQuestion(q);
                  }
                }}
                placeholder="Ask a follow-up question..."
                className="w-full px-3 py-2.5 pr-16 rounded-lg bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <Button
                size="sm"
                className="absolute right-1 top-1"
                onClick={() => {
                  if (questionInput.trim()) {
                    const q = questionInput.trim();
                    setUserQuestion(q);
                    setQuestionInput("");
                    askRepoQuestion(q);
                  }
                }}
              >
                Ask
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
