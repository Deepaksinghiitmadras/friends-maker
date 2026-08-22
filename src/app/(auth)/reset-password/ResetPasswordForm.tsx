"use client";

import { resetPasswordWithOTP } from "@/app/actions/authActions";
import CardWrapper from "@/components/CardWrapper";
import ResultMessage from "@/components/ResultMessage";
import {
  ResetPasswordSchema,
  resetPasswordSchema,
} from "@/lib/schemas/ForgotPasswordSchema";
import { ActionResult } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input } from "@nextui-org/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { GiPadlock } from "react-icons/gi";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { toast } from "react-toastify";
import Link from "next/link";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const emailParam = searchParams.get("email") || "";

  const [result, setResult] = useState<ActionResult<string> | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ResetPasswordSchema>({
    mode: "all",
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: emailParam,
      otp: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (emailParam) {
      setValue("email", emailParam, { shouldValidate: true });
    }
  }, [emailParam, setValue]);

  const onSubmit = async (data: ResetPasswordSchema) => {
    const res = await resetPasswordWithOTP({
      email: data.email,
      otp: data.otp,
      password: data.password,
    });
    setResult(res);

    if (res.status === "success") {
      toast.success("Password reset successfully! Redirecting to login...");
      setTimeout(() => {
        router.push(`/login?email=${encodeURIComponent(data.email)}`);
      }, 1500);
    } else {
      toast.error(res.error as string);
    }
  };

  return (
    <CardWrapper
      headerIcon={GiPadlock}
      headerText="Reset password"
      subHeaderText="Enter the 6-digit code sent to your email and your new password"
      body={
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col space-y-4"
        >
          <Input
            label="Email address"
            variant="bordered"
            {...register("email")}
            isInvalid={!!errors.email}
            errorMessage={errors.email?.message as string}
          />

          <Input
            label="6-Digit Reset Code (OTP)"
            placeholder="e.g. 123456"
            variant="bordered"
            maxLength={6}
            {...register("otp")}
            isInvalid={!!errors.otp}
            errorMessage={errors.otp?.message as string}
          />

          <Input
            type={showPassword ? "text" : "password"}
            label="New Password"
            variant="bordered"
            endContent={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="focus:outline-none text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <AiOutlineEyeInvisible size={20} />
                ) : (
                  <AiOutlineEye size={20} />
                )}
              </button>
            }
            {...register("password")}
            isInvalid={!!errors.password}
            errorMessage={errors.password?.message as string}
          />

          <Input
            type={showConfirmPassword ? "text" : "password"}
            label="Confirm New Password"
            variant="bordered"
            endContent={
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="focus:outline-none text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? (
                  <AiOutlineEyeInvisible size={20} />
                ) : (
                  <AiOutlineEye size={20} />
                )}
              </button>
            }
            {...register("confirmPassword")}
            isInvalid={!!errors.confirmPassword}
            errorMessage={errors.confirmPassword?.message as string}
          />

          <Button
            type="submit"
            color="default"
            isLoading={isSubmitting}
            isDisabled={!isValid || isSubmitting}
          >
            Reset password
          </Button>

          <div className="flex justify-center text-sm text-gray-500 hover:underline">
            <Link href="/login">Back to login</Link>
          </div>
        </form>
      }
      footer={<ResultMessage result={result} />}
    />
  );
}
