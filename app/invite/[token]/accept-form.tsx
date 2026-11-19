"use client";

import { useActionState } from "react";
import { Alert, Button, Spinner } from "@/components/ui";
import { acceptInvite } from "./actions";

export function AcceptForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(() => acceptInvite(token), null);
  return (
    <form action={action} className="mt-6">
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending && <Spinner />} Nhận vai trò soát vé
      </Button>
      {state?.error && (
        <div className="mt-4">
          <Alert>{state.error}</Alert>
        </div>
      )}
    </form>
  );
}
