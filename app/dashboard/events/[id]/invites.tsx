"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Spinner } from "@/components/ui";
import { CopyButton } from "../forms";
import { createInvite, removeChecker, revokeInvites } from "./invite-actions";

function Remove({ eventId, userId, name }: { eventId: string; userId: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(removeChecker.bind(null, eventId, userId), null);
  return (
    <li className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[15px]">{name}</span>
        {confirming ? (
          <form action={action} className="flex shrink-0 items-center gap-2">
            <span className="text-sm text-ink-soft">Gỡ người này?</span>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Spinner /> : "Gỡ"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Hủy
            </Button>
          </form>
        ) : (
          <Button type="button" size="sm" variant="secondary" aria-label={`Gỡ ${name}`} onClick={() => setConfirming(true)}>
            Gỡ
          </Button>
        )}
      </div>
      {state?.message && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {state.message}
        </p>
      )}
    </li>
  );
}

export function Invites({
  eventId,
  link,
  expires,
  checkers,
  loadFailed,
}: {
  eventId: string;
  link: string | null;
  expires: string | null;
  checkers: { user_id: string; name: string }[];
  loadFailed: boolean;
}) {
  // Whichever action ran last owns the error; a success clears the other's stale message.
  const [last, setLast] = useState<"create" | "revoke" | null>(null);
  const [createState, create, creating] = useActionState(createInvite.bind(null, eventId), null);
  const [revokeState, revoke, revoking] = useActionState(revokeInvites.bind(null, eventId), null);
  const message = last === "create" ? createState?.message : last === "revoke" ? revokeState?.message : undefined;
  return (
    <div>
      <h2 className="font-semibold">Người soát vé</h2>
      <p className="mt-1 text-sm text-ink-soft">Gửi link cho người soát vé. Họ đăng nhập Google rồi bấm nhận. Mỗi sự kiện chỉ có một link đang dùng.</p>
      {loadFailed && (
        <div className="mt-4">
          <Alert>Không tải được danh sách người soát vé, hãy tải lại trang</Alert>
        </div>
      )}
      {link && (
        <div className="mt-4">
          <p className="truncate rounded-xl bg-canvas px-3 py-2.5 font-mono text-[13px] text-ink-soft">{link.replace(/^https?:\/\//, "")}</p>
          {expires && <p className="mt-1.5 text-sm text-ink-soft">Hết hạn: {expires}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <CopyButton text={link} promptLabel="Sao chép link mời:" />
            <form action={revoke} onSubmit={() => setLast("revoke")}>
              <Button type="submit" variant="secondary" disabled={revoking} className="w-full">
                {revoking ? <Spinner /> : "Thu hồi link"}
              </Button>
            </form>
          </div>
        </div>
      )}
      <form action={create} onSubmit={() => setLast("create")} className="mt-3">
        <Button type="submit" variant={link ? "ghost" : "primary"} disabled={creating} className="w-full">
          {creating && <Spinner />} {link ? "Tạo link mới (link cũ ngừng dùng)" : "Tạo link mời"}
        </Button>
      </form>
      {message && (
        <div className="mt-3">
          <Alert>{message}</Alert>
        </div>
      )}
      <ul className="mt-4 divide-y divide-line">
        {!loadFailed && checkers.length === 0 && <li className="py-2.5 text-sm text-ink-soft">Chưa có người soát vé.</li>}
        {checkers.map((c) => (
          <Remove key={c.user_id} eventId={eventId} userId={c.user_id} name={c.name} />
        ))}
      </ul>
    </div>
  );
}
