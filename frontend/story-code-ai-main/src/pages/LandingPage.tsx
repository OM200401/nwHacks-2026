import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Github, ArrowRight, Code2, Sparkles, History, Users, Zap, GitBranch, MessageSquare, Clock, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LandingPage() {
  const navigate = useNavigate();
  const [repoUrl, setRepoUrl] = useState("");
  const [question, setQuestion] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  const handleConnect = () => {
    if (repoUrl.trim()) {
      setIsConnected(true);
    }
  };

  const handleAsk = () => {
    if (question.trim() && isConnected) {
      navigate("/analyze");
    }
  };

  const exampleQuestions = [
    "Why was the authentication system refactored?",
    "Who introduced the caching layer and why?",
    "What was the original purpose of this function?",
    "Why did we switch from REST to GraphQL?"
  ];

  const features = [
    {
      icon: MessageSquare,
      title: "Ask a Question",
      description: "Ask anything about your codebase - architecture decisions, refactors, or mysterious functions."
    },
    {
      icon: Clock,
      title: "We Search History",
      description: "Our AI digs through commits, PRs, and code changes to find the relevant context."
    },
    {
      icon: Zap,
      title: "Get Answers",
      description: "See the code with highlights, linked commits, and explanations of why decisions were made."
    }
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
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Code2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl text-foreground">CodeAncestry</h1>
              <p className="text-xs text-muted-foreground">Legacy Code Explainer</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isConnected && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Connected
              </div>
            )}
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <Github className="w-4 h-4 mr-2" />
              Sign in
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-6">
            <History className="w-4 h-4" />
            AI-Powered Code Archaeology
          </div>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 leading-tight">
            Ask questions about your<br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              legacy code
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Connect your repo, ask a question. We'll dig through your commit history 
            to explain <span className="text-foreground font-medium">why</span> decisions were made, 
            not just what the code does.
          </p>
        </div>

        {/* Main Input Flow */}
        <div className="max-w-2xl mx-auto mb-16 space-y-4 animate-slide-in-right" style={{ animationDelay: "0.2s" }}>
          {/* Step 1: Connect Repo */}
          <div className={`p-6 rounded-2xl border-2 transition-all ${
            isConnected 
              ? 'border-primary/30 bg-primary/5' 
              : 'border-border bg-card/50 backdrop-blur-sm'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                isConnected 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {isConnected ? '✓' : '1'}
              </div>
              <span className="font-semibold text-foreground">Connect your repository</span>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <GitBranch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="https://github.com/your-org/your-repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="pl-11 h-12 bg-background"
                  disabled={isConnected}
                />
              </div>
              {!isConnected ? (
                <Button onClick={handleConnect} className="h-12 px-6 gap-2">
                  <Github className="w-4 h-4" />
                  Connect
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setIsConnected(false)} className="h-12">
                  Change
                </Button>
              )}
            </div>
          </div>

          {/* Step 2: Ask Question */}
          <div className={`p-6 rounded-2xl border-2 transition-all ${
            isConnected 
              ? 'border-border bg-card/50 backdrop-blur-sm' 
              : 'border-border/50 bg-muted/30 opacity-60'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                isConnected 
                  ? 'bg-muted text-foreground' 
                  : 'bg-muted/50 text-muted-foreground'
              }`}>
                2
              </div>
              <span className="font-semibold text-foreground">Ask about your code</span>
            </div>
            
            <div className="relative">
              <Search className="absolute left-4 top-4 w-5 h-5 text-muted-foreground" />
              <textarea
                placeholder="Why was this authentication module rewritten? Who made the decision and what problem were they solving?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={!isConnected}
                className="w-full h-28 pl-12 pr-4 py-3 rounded-xl bg-background border border-input resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              {exampleQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setQuestion(q)}
                  disabled={!isConnected}
                  className="px-3 py-1.5 text-sm rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {q.length > 35 ? q.slice(0, 35) + '...' : q}
                </button>
              ))}
            </div>

            <Button 
              onClick={handleAsk} 
              disabled={!isConnected || !question.trim()}
              className="w-full mt-4 h-12 gap-2 text-base"
            >
              <Sparkles className="w-4 h-4" />
              Analyze Code History
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* How it works */}
        <div className="grid md:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: "0.4s" }}>
          {features.map((feature) => (
            <div 
              key={feature.title}
              className="p-6 rounded-xl bg-card/30 border border-border/50 hover:border-primary/30 transition-colors group"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Social proof */}
        <div className="text-center mt-16 animate-fade-in" style={{ animationDelay: "0.6s" }}>
          <p className="text-sm text-muted-foreground mb-4">Built for developers who inherit code without context</p>
          <div className="flex items-center justify-center gap-8 opacity-50">
            {["Stripe", "Vercel", "Linear", "Notion"].map((company) => (
              <span key={company} className="font-semibold text-muted-foreground">
                {company}
              </span>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
