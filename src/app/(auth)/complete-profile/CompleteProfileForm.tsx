"use client";

import CardWrapper from "@/components/CardWrapper";
import {
  ProfileSchema,
  profileSchema,
} from "@/lib/schemas/RegisterSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormProvider,
  useForm,
} from "react-hook-form";
import { RiProfileLine } from "react-icons/ri";
import ProfileForm from "../register/ProfileDetailsForm";
import { Button } from "@nextui-org/react";
import { completeSocialLoginProfile } from "@/app/actions/authActions";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

export default function CompleteProfileForm() {
  const router = useRouter();
  const methods = useForm<ProfileSchema>({
    resolver: zodResolver(profileSchema),
    mode: "all",
  });

  const {
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = methods;

  const onSubmit = async (
    data: ProfileSchema
  ) => {
    const result =
      await completeSocialLoginProfile(data);

    if (result.status === "success") {
      // For social logins (google/github) re-signin refreshes the session token
      // For credentials users, just navigate to members
      if (result.data === "credentials") {
        router.push("/members");
        router.refresh();
      } else {
        signIn(result.data, {
          callbackUrl: "/members",
        });
      }
    } else {
      toast.error(result.error as string);
    }
  };

  return (
    <CardWrapper
      headerText="About you"
      subHeaderText="Please complete your profile to continue to the app"
      headerIcon={RiProfileLine}
      body={
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <ProfileForm />
              {errors.root?.serverError && (
                <p className="text-danger text-sm">
                  {
                    errors.root.serverError
                      .message
                  }
                </p>
              )}
              <div className="flex flex-row items-center gap-6">
                <Button
                  isLoading={isSubmitting}
                  isDisabled={!isValid}
                  fullWidth
                  color="default"
                  type="submit"
                >
                  Submit
                </Button>
              </div>
            </div>
          </form>
        </FormProvider>
      }
    />
  );
}
