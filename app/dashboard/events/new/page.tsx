import { NewEventForm } from "../forms";

export default function NewEventPage() {
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Tạo sự kiện</h1>
      <NewEventForm />
    </main>
  );
}
