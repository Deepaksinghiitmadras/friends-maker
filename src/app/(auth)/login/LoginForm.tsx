"use client";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
} from "@nextui-org/react";
import React, { useState } from "react";
import { GiPadlock } from "react-icons/gi";
import { useForm } from "react-hook-form";
import {
  loginSchema,
  LoginSchema,
} from "@/lib/schemas/LoginSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import Link from "next/link";
import SocialLogin from "./SocialLogin";
import { signIn } from "next-auth/react";

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/members";

  const {
    register,
    handleSubmit,
    formState: { isValid, errors },
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    mode: "all",
  });

  const onSubmit = async (data: LoginSchema) => {
    setIsLoading(true);
    try {
      const res = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (res?.error) {
        toast.error("Invalid email or password");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (error: any) {
      toast.error(error?.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-3/5 mx-auto">
      <CardHeader className="flex flex-col items-center justify-center">
        <div className="flex flex-col gap-2 items-center text-secondary">
          <div className="flex flex-row items-center gap-3">
            <GiPadlock size={30} />
            <h1 className="text-3xl font-semibold">
              Login
            </h1>
          </div>
          <p className="text-neutral-500">
            Welcome back to TrueFriends!
          </p>
        </div>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <Input
              defaultValue=""
              label="Email"
              variant="bordered"
              {...register("email")}
              isInvalid={!!errors.email}
              errorMessage={
                errors.email?.message as string
              }
            />
            <Input
              defaultValue=""
              label="Password"
              variant="bordered"
              type="password"
              {...register("password")}
              isInvalid={!!errors.password}
              errorMessage={
                errors.password?.message as string
              }
            />
            <Button
              fullWidth
              color="default"
              type="submit"
              isDisabled={!isValid || isLoading}
              isLoading={isLoading}
            >
              Login
            </Button>
            <SocialLogin />
            <div className="flex justify-center hover:underline text-sm">
              <Link href="/forgot-password">
                Forgot password?
              </Link>
            </div>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

