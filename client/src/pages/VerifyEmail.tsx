import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function getParam(key: string): string {
  return new URLSearchParams(window.location.search).get(key) || "";
}

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "idle">("idle");
  const [resendEmail, setResendEmail] = useState("");
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    const success = getParam("success");
    const error = getParam("error");
    if (success) {
      setStatus("success");
      setTimeout(() => setLocation("/dashboard"), 3000);
    } else if (error) {
      setStatus("error");
    }
  }, [setLocation]);

  const handleResend = async () => {
    if (!resendEmail) return;
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      setResendSent(true);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/"><span className="text-3xl font-black text-destructive tracking-tight cursor-pointer">NERVIX</span></Link>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          {status === "success" && (
            <>
              <div className="text-6xl mb-4">✅</div>
              <h1 className="text-xl font-bold mb-2">Email Verified!</h1>
              <p className="text-muted-foreground text-sm">Redirecting to dashboard...</p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-6xl mb-4">❌</div>
              <h1 className="text-xl font-bold mb-2">Invalid or Expired Link</h1>
              <p className="text-muted-foreground text-sm mb-6">This verification link has expired or is invalid.</p>
              {!resendSent ? (
                <div className="space-y-3">
                  <Input type="email" placeholder="Enter your email" value={resendEmail} onChange={(e) => setResendEmail(e.target.value)} />
                  <Button onClick={handleResend} className="w-full bg-destructive hover:bg-destructive/90">Resend Verification Email</Button>
                </div>
              ) : (
                <p className="text-green-500 text-sm">Check your inbox for a new link!</p>
              )}
            </>
          )}

          {status === "idle" && (
            <>
              <div className="text-6xl mb-4">📧</div>
              <h1 className="text-xl font-bold mb-2">Check Your Email</h1>
              <p className="text-muted-foreground text-sm mb-6">
                We sent a verification link to your email address. Click it to verify your account.
              </p>
              {!resendSent ? (
                <div className="space-y-3">
                  <Input type="email" placeholder="Resend to email..." value={resendEmail} onChange={(e) => setResendEmail(e.target.value)} />
                  <Button variant="outline" onClick={handleResend} className="w-full">Resend Verification</Button>
                </div>
              ) : (
                <p className="text-green-500 text-sm">Sent! Check your inbox.</p>
              )}
              <p className="mt-4 text-xs text-muted-foreground"><Link href="/dashboard" className="text-primary underline">Skip for now →</Link></p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
