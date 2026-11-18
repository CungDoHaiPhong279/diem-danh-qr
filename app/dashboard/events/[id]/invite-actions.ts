"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import { rpcErrorMessage } from "@/lib/rpc-error";
import type { FormState } from "../actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function run(eventId: string, userId: string | null, rpc: "create_checker_invite" | "revoke_checker_invites" | "remove_checker"): Promise<FormState> {
  await requireUser();
  if (!UUID.test(eventId) || (userId !== null && !UUID.test(userId))) return { message: "Dữ liệu không hợp lệ" };
  const supabase = await createClient();
  const { error } =
    rpc === "remove_checker"
      ? await supabase.rpc(rpc, { p_event: eventId, p_user: userId! })
      : await supabase.rpc(rpc, { p_event: eventId });
  if (error) return { message: rpcErrorMessage(error) };
  revalidatePath(`/dashboard/events/${eventId}`);
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by useActionState
export async function createInvite(eventId: string, _prev?: FormState): Promise<FormState> {
  return run(eventId, null, "create_checker_invite");
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by useActionState
export async function revokeInvites(eventId: string, _prev?: FormState): Promise<FormState> {
  return run(eventId, null, "revoke_checker_invites");
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by useActionState
export async function removeChecker(eventId: string, userId: string, _prev?: FormState): Promise<FormState> {
  return run(eventId, userId, "remove_checker");
}
