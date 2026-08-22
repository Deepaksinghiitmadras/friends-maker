import { Suspense } from "react";
import VerifyOTPForm from "./VerifyOTPForm";

export const metadata = {
  title: "Verify Email | TrueFriends",
  description: "Enter the 6-digit code sent to your email to verify your account",
};

export default function VerifyOTPPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <VerifyOTPForm />
    </Suspense>
  );
}
