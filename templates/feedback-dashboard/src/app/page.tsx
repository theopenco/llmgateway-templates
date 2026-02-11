"use client";

import { useState } from "react";
import { BarChart3, Loader2, MessageSquare, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Theme = {
  name: string;
  count: number;
  sentiment: string;
};

type ReviewAnalysis = {
  text: string;
  sentiment: string;
  score: number;
  keyPhrase: string;
};

type Analysis = {
  overallSentiment: string;
  averageScore: number;
  summary: string;
  themes: Theme[];
  reviews: ReviewAnalysis[];
};

const SAMPLE_REVIEWS = `Great product, really easy to use and the support team is amazing!
The pricing is too high for what you get. Not worth it.
Love the new features, but the app crashes sometimes on mobile.
Customer service responded within minutes. Very impressed!
The UI is confusing and the documentation is lacking.
Best tool I've used for this purpose. Highly recommend!
Average experience. Nothing special but it gets the job done.
The onboarding process was smooth and intuitive.`;

const sentimentColors: Record<string, string> = {
  positive: "bg-emerald-500/20 text-emerald-400",
  negative: "bg-red-500/20 text-red-400",
  neutral: "bg-zinc-500/20 text-zinc-400",
  mixed: "bg-amber-500/20 text-amber-400",
};

const sentimentDots: Record<string, string> = {
  positive: "bg-emerald-500",
  negative: "bg-red-500",
  neutral: "bg-zinc-500",
  mixed: "bg-amber-500",
};

export default function Home() {
  const [reviews, setReviews] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!reviews.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviews }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to analyze");
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  function handleReset() {
    setAnalysis(null);
    setReviews("");
    setError(null);
  }

  if (analysis) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-4xl">
          <header className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="mb-1 text-3xl font-bold">Analysis Results</h1>
              <p className="text-sm text-muted-foreground">
                {analysis.reviews.length} reviews analyzed
              </p>
            </div>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="size-4" />
              Analyze New
            </Button>
          </header>

          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="flex items-center gap-4 pt-6">
                <div
                  className={`rounded-full px-3 py-1 text-sm font-medium ${sentimentColors[analysis.overallSentiment]}`}
                >
                  {analysis.overallSentiment}
                </div>
                <span className="text-sm text-muted-foreground">
                  Overall Sentiment
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 pt-6">
                <span className="text-3xl font-bold">
                  {analysis.averageScore.toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">
                  Average Score (0-10)
                </span>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {analysis.summary}
              </p>
            </CardContent>
          </Card>

          {analysis.themes.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Key Themes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analysis.themes.map((theme) => (
                    <span
                      key={theme.name}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${sentimentColors[theme.sentiment]}`}
                    >
                      {theme.name}
                      <span className="opacity-70">({theme.count})</span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Individual Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysis.reviews.map((review, i) => (
                  <div
                    key={i}
                    className="flex gap-3 rounded-lg border border-border p-4"
                  >
                    <div className="mt-1 flex flex-col items-center gap-1">
                      <span
                        className={`size-2.5 rounded-full ${sentimentDots[review.sentiment]}`}
                      />
                      <span className="text-xs font-medium text-muted-foreground">
                        {review.score}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="mb-1 text-sm">{review.text}</p>
                      <p className="text-xs text-muted-foreground">
                        {review.keyPhrase}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold">Feedback Dashboard</h1>
          <p className="text-lg text-muted-foreground">
            Analyze customer feedback with AI-powered sentiment analysis
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="size-5" />
              Paste Reviews
            </CardTitle>
            <CardDescription>
              Enter customer reviews, one per line
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAnalyze} className="space-y-4">
              <textarea
                value={reviews}
                onChange={(e) => setReviews(e.target.value)}
                placeholder="Paste your reviews here, one per line..."
                rows={10}
                className="w-full resize-none rounded-md border border-input bg-secondary px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
              />
              <div className="flex gap-3">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isLoading || !reviews.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <BarChart3 className="size-4" />
                  )}
                  {isLoading ? "Analyzing..." : "Analyze Reviews"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReviews(SAMPLE_REVIEWS)}
                >
                  Load Sample
                </Button>
              </div>
            </form>
            {error && (
              <p className="mt-3 text-sm text-destructive-foreground">
                {error}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
