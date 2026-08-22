"use client";

import { generateResetPasswordEmail } from "@/app/actions/authActions";
import CardWrapper from "@/components/CardWrapper";
import ResultMessage from "@/components/ResultMessage";
import { ActionResult } from "@/types";
import { Button, Input } from "@nextui-org/react";
import { useState } from "react";
import { FieldValues, useForm } from "react-hook-form";
import { GiPadlock } from "react-icons/gi";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Link from "next/link";

export default function ForgotPasswordForm() {
  const [result, setResult] = useState<ActionResult<string> | null>(null);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { isSubmitting, isValid },
  } = useForm({ mode: "all" });

  const onSubmit = async (data: FieldValues) => {
    const res = await generateResetPasswordEmail(data.email);
    setResult(res);
    if (res.status === "success") {
      toast.success("6-digit code sent to your email!");
      setTimeout(() => {
        router.push(`/reset-password?email=${encodeURIComponent(data.email)}`);
      }, 1000);
    } else {
      toast.error(res.error as string);
    }
  };

  return (
    <CardWrapper
      headerIcon={GiPadlock}
      headerText="Forgot password"
      subHeaderText="Enter your email to receive a 6-digit reset code"
      body={
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col space-y-4"
        >
          <Input
            type="email"
            label="Email address"
            variant="bordered"
            defaultValue=""
            {...register("email", {
              required: true,
            })}
          />
          <Button
            type="submit"
            color="default"
            isLoading={isSubmitting}
            isDisabled={!isValid || isSubmitting}
          >
            Send reset code
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
