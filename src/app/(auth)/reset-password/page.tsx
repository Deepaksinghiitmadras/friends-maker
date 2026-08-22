import { Suspense } from "react";
import ResetPasswordForm from "./ResetPasswordForm";

export default function ResetPassword() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-8">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
