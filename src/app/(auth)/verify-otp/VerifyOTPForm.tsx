"use client";

import { verifyOTPCode } from "@/app/actions/authActions";
import { Button } from "@nextui-org/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { HiOutlineMail } from "react-icons/hi";
import Link from "next/link";

export default function VerifyOTPForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = decodeURIComponent(searchParams.get("email") || "");

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    // Accept only digits
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // only last char (in case of paste)
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) {
      toast.error("Please enter all 6 digits");
      return;
    }

    setIsLoading(true);
    try {
      const result = await verifyOTPCode(email, code);
      if (result.status === "success") {
        toast.success("Email verified! Redirecting to login...");
        setTimeout(() => {
          router.push(`/login?email=${encodeURIComponent(email)}`);
        }, 1200);
      } else {
        toast.error(result.error as string);
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch (err: any) {
      toast.error(err?.message || "Verification failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Header gradient */}
        <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
            <HiOutlineMail className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Check your email</h1>
          <p className="text-pink-100 text-sm">
            We sent a 6-digit code to
          </p>
          <p className="text-white font-semibold text-sm mt-1 truncate">{email || "your email"}</p>
        </div>

        {/* OTP form */}
        <div className="p-8">
          <p className="text-gray-500 text-sm text-center mb-6">
            Enter the verification code below. It expires in <strong>10 minutes</strong>.
          </p>

          <form onSubmit={handleSubmit}>
            {/* 6-digit OTP boxes */}
            <div className="flex gap-3 justify-center mb-8" onPaste={handlePaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className={`
                    w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 outline-none transition-all
                    ${digit
                      ? "border-pink-400 bg-pink-50 text-pink-600"
                      : "border-gray-200 bg-gray-50 text-gray-800"
                    }
                    focus:border-pink-500 focus:ring-2 focus:ring-pink-200
                  `}
                />
              ))}
            </div>

            <Button
              type="submit"
              fullWidth
              isLoading={isLoading}
              isDisabled={otp.join("").length !== 6 || isLoading}
              className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold h-12 rounded-xl text-base"
            >
              Verify Email
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            Didn&apos;t receive the code?{" "}
            <Link href="/register" className="text-pink-500 hover:underline font-medium">
              Register again
            </Link>
          </div>

          <div className="mt-3 text-center text-sm text-gray-400">
            Already verified?{" "}
            <Link href={`/login?email=${encodeURIComponent(email)}`} className="text-purple-500 hover:underline font-medium">
              Login here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
