import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import type { ChangelogEntry } from "@/lib/types";
import {
  createChangelogEntry,
  updateChangelogEntry,
  toggleChangelogPublish,
  deleteChangelogEntry,
} from "../actions";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const input =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none";
const btn =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50";

export default async function AdminChangelogPage() {
  const { admin } = await requireAdmin();
  const { data } = await admin
    .from("changelog_entries")
    .select("*")
    .order("created_at", { ascending: false });
  const entries = (data ?? []) as ChangelogEntry[];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">Changelog</h1>
        <Link
          href="/admin"
          className="text-xs text-zinc-500 underline-offset-2 hover:underline"
        >
          ← Admin
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Published entries appear in every contractor&apos;s “What&apos;s new”
        panel.
      </p>

      {/* New entry */}
      <form
        action={createChangelogEntry}
        className="mt-4 space-y-2 rounded-2xl border border-zinc-200 bg-white p-4"
      >
        <h2 className="text-sm font-semibold text-zinc-900">New entry</h2>
        <div className="flex gap-2">
          <input
            name="version"
            placeholder="Version (optional, e.g. v1.4)"
            className={`${input} max-w-[40%]`}
          />
          <input name="title" placeholder="Title" required className={input} />
        </div>
        <textarea
          name="body"
          rows={3}
          placeholder="What changed? (plain text, line breaks preserved)"
          className={input}
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input type="checkbox" name="publish" defaultChecked />
            Publish now
          </label>
          <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
            Add entry
          </button>
        </div>
      </form>

      {entries.length === 0 && (
        <p className="mt-6 text-center text-sm text-zinc-500">
          No entries yet.
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {entries.map((e) => (
          <li
            key={e.id}
            className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  e.published_at
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-zinc-200 text-zinc-600"
                }`}
              >
                {e.published_at ? `published ${fmt(e.published_at)}` : "draft"}
              </span>
              <div className="flex gap-2">
                <form action={toggleChangelogPublish.bind(null, e.id)}>
                  <button className={btn}>
                    {e.published_at ? "Unpublish" : "Publish"}
                  </button>
                </form>
                <form action={deleteChangelogEntry.bind(null, e.id)}>
                  <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                    Delete
                  </button>
                </form>
              </div>
            </div>

            <form action={updateChangelogEntry} className="space-y-2">
              <input type="hidden" name="id" value={e.id} />
              <div className="flex gap-2">
                <input
                  name="version"
                  defaultValue={e.version ?? ""}
                  placeholder="Version"
                  className={`${input} max-w-[40%]`}
                />
                <input
                  name="title"
                  defaultValue={e.title}
                  required
                  className={input}
                />
              </div>
              <textarea
                name="body"
                rows={3}
                defaultValue={e.body}
                className={input}
              />
              <div className="flex justify-end">
                <button className={btn}>Save changes</button>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
