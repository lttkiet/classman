import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export default function ResetPasswordPage() {
  return <Suspense fallback={null}><AuthForm initialMode="reset" /></Suspense>;
}
