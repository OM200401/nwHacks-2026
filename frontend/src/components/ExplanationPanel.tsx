import { useState, useEffect } from "react";
import { Sparkles, ArrowRight } from "lucide-react";

type Mode = "explain" | "review" | "fix" | "summarize";

interface ExplanationPanelProps {
  mode: Mode;
  answer?: string;
  loading?: boolean;
}

// Format inline text: **bold**, `code`
function formatInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-xs font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// Parse the RAG response into structured sections
function parseAnswer(raw: string) {
  const lines = raw.split("\n");
  const rendered: React.ReactNode[] = [];
  let numberedGroup: string[] = [];
  let bulletGroup: string[] = [];
  let keyInsight: string | null = null;
  let inKeyInsight = false;

  const flushNumbered = (key: string) => {
    if (numberedGroup.length === 0) return;
    rendered.push(
      <ol key={key} className="list-none space-y-1.5 my-2">
        {numberedGroup.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <p className="text-muted-foreground text-sm leading-relaxed">{formatInline(item)}</p>
          </li>
        ))}
      </ol>
    );
    numberedGroup = [];
  };

  const flushBullets = (key: string) => {
    if (bulletGroup.length === 0) return;
    rendered.push(
      <div key={key} className="space-y-1.5 my-2">
        {bulletGroup.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <ArrowRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-muted-foreground text-sm leading-relaxed">{formatInline(item)}</p>
          </div>
        ))}
      </div>
    );
    bulletGroup = [];
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushNumbered(`n-${idx}`);
      flushBullets(`b-${idx}`);
      return;
    }

    // Key insight section
    if (trimmed.includes("Key Insight") || trimmed.includes("**Key Insight**")) {
      flushNumbered(`n-${idx}`);
      flushBullets(`b-${idx}`);
      inKeyInsight = true;
      return;
    }
    if (inKeyInsight) {
      keyInsight = trimmed.replace(/^\*\*Key Insight\*\*:\s*/, "");
      inKeyInsight = false;
      return;
    }

    // ## heading
    if (trimmed.startsWith("## ")) {
      flushNumbered(`n-${idx}`);
      flushBullets(`b-${idx}`);
      rendered.push(
        <h3 key={idx} className="text-sm font-semibold text-foreground mt-4 mb-1 first:mt-0">
          {trimmed.slice(3)}
        </h3>
      );
      return;
    }

    // # heading
    if (trimmed.startsWith("# ")) {
      flushNumbered(`n-${idx}`);
      flushBullets(`b-${idx}`);
      rendered.push(
        <h2 key={idx} className="text-base font-bold text-foreground mt-4 mb-2 first:mt-0">
          {trimmed.slice(2)}
        </h2>
      );
      return;
    }

    // Numbered list: "1. " or "2. "
    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (numberedMatch) {
      flushBullets(`b-${idx}`);
      numberedGroup.push(numberedMatch[1]);
      return;
    }

    // Bullet list: "- " or "• "
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      flushNumbered(`n-${idx}`);
      bulletGroup.push(trimmed.replace(/^[-•]\s*/, ""));
      return;
    }

    // Regular paragraph
    flushNumbered(`n-${idx}`);
    flushBullets(`b-${idx}`);
    rendered.push(
      <p key={idx} className="text-foreground text-sm leading-relaxed">
        {formatInline(trimmed)}
      </p>
    );
  });

  flushNumbered("final-n");
  flushBullets("final-b");

  return { rendered, keyInsight };
}

export function ExplanationPanel({ mode, answer, loading }: ExplanationPanelProps) {
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    setIsTyping(true);
    const timer = setTimeout(() => setIsTyping(false), 700);
    return () => clearTimeout(timer);
  }, [mode, answer]);

  const { rendered, keyInsight } = parseAnswer(answer || "");

  return (
    <div className="h-full flex flex-col bg-card overflow-hidden">
      <div className="flex-1 overflow-auto scrollbar-thin">

        {/* Loading skeleton */}
        {(loading || isTyping) && (
          <div className="p-4 space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 text-xs text-primary">
              <Sparkles className="w-3 h-3 animate-pulse" />
              <span>Searching through code history...</span>
            </div>
            {/* Paragraph skeleton */}
            <div className="space-y-2">
              <div className="h-3.5 bg-muted/60 rounded animate-pulse w-full" />
              <div className="h-3.5 bg-muted/60 rounded animate-pulse w-5/6" />
              <div className="h-3.5 bg-muted/60 rounded animate-pulse w-4/5" />
            </div>
            {/* Bullet skeleton */}
            <div className="space-y-2 pl-2">
              <div className="flex gap-2 items-center">
                <div className="w-4 h-4 rounded-full bg-primary/20 flex-shrink-0" />
                <div className="h-3 bg-muted/60 rounded animate-pulse flex-1" />
              </div>
              <div className="flex gap-2 items-center">
                <div className="w-4 h-4 rounded-full bg-primary/20 flex-shrink-0" />
                <div className="h-3 bg-muted/60 rounded animate-pulse w-3/4" />
              </div>
              <div className="flex gap-2 items-center">
                <div className="w-4 h-4 rounded-full bg-primary/20 flex-shrink-0" />
                <div className="h-3 bg-muted/60 rounded animate-pulse w-5/6" />
              </div>
            </div>
            {/* Insight box skeleton */}
            <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
              <div className="h-3 bg-primary/20 rounded animate-pulse w-24" />
              <div className="h-3 bg-muted/60 rounded animate-pulse w-full" />
              <div className="h-3 bg-muted/60 rounded animate-pulse w-4/5" />
            </div>
          </div>
        )}

        {/* AI Answer */}
        {!loading && !isTyping && answer && (
          <div className="p-4 animate-fade-in space-y-3">
            {rendered}
            {keyInsight && (
              <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2 mt-4">
                <div className="flex items-center gap-2 text-xs text-primary font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  Key Insight
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {formatInline(keyInsight)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!loading && !isTyping && !answer && (
          <div className="p-6 flex flex-col items-center justify-center h-full text-center gap-3">
            <Sparkles className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground max-w-[200px]">
              Ask a question about this repository to see AI explanations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
