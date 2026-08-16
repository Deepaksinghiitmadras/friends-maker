import { verifyEmail } from "@/app/actions/authActions";
import CardWrapper from "@/components/CardWrapper";
import ResultMessage from "@/components/ResultMessage";
import { MdOutlineMailOutline } from "react-icons/md";

import { Button } from "@nextui-org/react";
import Link from "next/link";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token: string };
}) {
  const result = await verifyEmail(
    searchParams.token
  );

  return (
    <CardWrapper
      headerText="Verify your email address"
      headerIcon={MdOutlineMailOutline}
      body={
        <div className="flex flex-col items-center gap-4">
          <ResultMessage result={result} />
          {result.status === "success" && (
            <Button
              as={Link}
              href="/login"
              color="primary"
              variant="bordered"
              className="w-full mt-2 font-semibold"
            >
              Sign In to Your Account
            </Button>
          )}
        </div>
      }
    />
  );
}
