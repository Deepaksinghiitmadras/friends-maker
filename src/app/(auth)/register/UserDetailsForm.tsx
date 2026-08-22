"use client";

import { Input } from "@nextui-org/react";
import { useFormContext } from "react-hook-form";
import { useState } from "react";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

export default function UserDetailsForm() {
  const {
    register,
    getValues,
    formState: { errors },
  } = useFormContext();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-4">
      <Input
        defaultValue={getValues("name")}
        label="Name"
        variant="bordered"
        {...register("name")}
        isInvalid={!!errors.name}
        errorMessage={
          errors.name?.message as string
        }
      />
      <Input
        defaultValue={getValues("email")}
        label="Email"
        variant="bordered"
        {...register("email")}
        isInvalid={!!errors.email}
        errorMessage={
          errors.email?.message as string
        }
      />
      <Input
        defaultValue={getValues("password")}
        label="Password"
        variant="bordered"
        type={showPassword ? "text" : "password"}
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
        errorMessage={
          errors.password?.message as string
        }
      />
    </div>
  );
}
