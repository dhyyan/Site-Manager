import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

export default function ResetPassword() {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Resend OTP cooldown
  const [canResend, setCanResend] = useState(true);
  const [countdown, setCountdown] = useState(0);

  const navigate = useNavigate();

  // Countdown timer effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api("auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      toast({ title: data.msg || "OTP sent" });
      if (res.ok) {
        setStep("otp");
        // Start 30-second cooldown before allowing resend
        setCountdown(30);
        setCanResend(false);
      }
    } catch {
      toast({ title: "Error", description: "Failed to send OTP", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Reusable function to request OTP (used for both initial and resend)
  const requestOtpResend = async () => {
    if (!canResend) return;

    setLoading(true);
    try {
      const res = await api("auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (res.ok) {
        toast({ title: "New OTP sent!", description: "Check your email" });
        setCountdown(30); // Reset cooldown
        setCanResend(false);
      } else {
        toast({ title: "Failed", description: data.msg || "Could not send OTP", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await api("auth/reset-password-otp", {
        method: "POST",
        body: JSON.stringify({ email, otp, password, confirmPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        toast({ title: "Success", description: data.msg });
        navigate("/login");
      } else {
        toast({
          title: "Invalid OTP",
          description: data.msg || "OTP is invalid or expired",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Error", description: "Failed to reset password", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
        </CardHeader>
        <CardContent>
          {step === "email" ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="you@example.com"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !email}>
                {loading ? "Sending..." : "Send OTP"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <Label>OTP (check your email)</Label>
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  disabled={loading}
                  maxLength={6}
                  placeholder="123456"
                  className="text-center text-lg tracking-widest"
                />
              </div>

              <div>
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Resetting..." : "Reset Password"}
              </Button>

              {/* Resend OTP Section */}
              <div className="text-center mt-4">
                <p className="text-sm text-muted-foreground">
                  Didn't receive the code?{" "}
                  {canResend ? (
                    <button
                      type="button"
                      onClick={requestOtpResend}
                      className="font-medium text-primary hover:underline"
                      disabled={loading}
                    >
                      Resend OTP
                    </button>
                  ) : (
                    <span className="text-muted-foreground">
                      Resend in {countdown}s
                    </span>
                  )}
                </p>
              </div>

              {/* Optional: Change email */}
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="text-sm text-primary hover:underline"
                >
                  ← Change email
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}