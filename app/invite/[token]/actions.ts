"use server";

import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import { isValidToken } from "@/lib/ticket";
import { rpcErrorMessage } from "@/lib/rpc-error";

export async function acceptInvite(token: string): Promise<{ error: string }> {
  await requireUser();
  if (!isValidToken(token)) return { error: rpcErrorMessage({ message: "INVITE_INVALID" }) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_checker_invite", { p_token: token });
  if (error || !data) return { error: rpcErrorMessage(error ?? { message: "INVITE_INVALID" }) };
  redirect(`/dashboard/events/${data}/scan`);
}
