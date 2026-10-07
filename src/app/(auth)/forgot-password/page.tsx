import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export default function ForgotPasswordPage() {
  return <Suspense fallback={null}><AuthForm initialMode="forgot" /></Suspense>;
}
