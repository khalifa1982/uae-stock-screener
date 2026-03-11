import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Mail, CheckCircle2, Copy, ExternalLink } from "lucide-react";

export default function ForgotPassword() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const resp = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        toast.error(data.error || "Failed to process request");
        return;
      }

      setSubmitted(true);

      if (data.resetToken) {
        // Build the reset link using current origin
        const link = `${window.location.origin}/reset-password?token=${data.resetToken}`;
        setResetLink(link);
      }

      toast.success("Reset request processed successfully");
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (resetLink) {
      navigator.clipboard.writeText(resetLink);
      toast.success("Reset link copied to clipboard");
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <CardTitle className="text-xl font-bold">Reset Link Generated</CardTitle>
            <CardDescription>
              A password reset link has been created for your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resetLink && (
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground">Your reset link (valid for 1 hour):</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={resetLink}
                    className="text-xs font-mono"
                  />
                  <Button variant="outline" size="icon" onClick={copyLink} title="Copy link">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    const url = new URL(resetLink);
                    navigate(url.pathname + url.search);
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Go to Reset Page
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              In a production environment, this link would be sent to your email address. 
              Since this is a self-hosted deployment, the link is shown directly.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <button
              type="button"
              className="text-sm text-primary underline hover:no-underline"
              onClick={() => navigate("/login")}
            >
              Back to Sign In
            </button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl font-bold">Forgot Password</CardTitle>
          <CardDescription>
            Enter your email address and we'll generate a password reset link.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Processing..." : "Generate Reset Link"}
            </Button>
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
              onClick={() => navigate("/login")}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Sign In
            </button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
