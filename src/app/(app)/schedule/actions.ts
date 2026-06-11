"use server";

import { revalidatePath } from "next/cache";
import { requireContractor } from "@/lib/contractor";
import { hmToMinutes, type WeeklyAvailability } from "@/lib/scheduling";

// Persist the weekly hours grid. Days arrive as null (closed) or a window;
// at least one day must stay open or customers could never book anything.
export async function saveAvailability(input: WeeklyAvailability) {
  const { supabase, contractor } = await requireContractor();

  const cleaned: WeeklyAvailability = {};
  for (const dow of ["0", "1", "2", "3", "4", "5", "6"]) {
    const day = input[dow];
    if (!day) continue;
    const start = hmToMinutes(day.start);
    const end = hmToMinutes(day.end);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return { ok: false as const, message: "Times must look like 08:00." };
    }
    if (end <= start) {
      return {
        ok: false as const,
        message: "Each open day needs an end time after its start time.",
      };
    }
    cleaned[dow] = { start: day.start, end: day.end };
  }
  if (Object.keys(cleaned).length === 0) {
    return {
      ok: false as const,
      message: "Keep at least one day open so customers can book.",
    };
  }

  const { error } = await supabase
    .from("contractors")
    .update({ availability: cleaned })
    .eq("id", contractor.id);
  if (error) return { ok: false as const, message: error.message };

  revalidatePath("/schedule");
  return { ok: true as const };
}

// Busy blocks use the same UTC wall-clock convention as job slots: the
// date + HH:MM the contractor types is stored verbatim with a Z suffix.
export async function addBusyBlock(input: {
  title: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
}) {
  const { supabase, contractor } = await requireContractor();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false as const, message: "Pick a date." };
  }
  const startMin = hmToMinutes(input.start);
  const endMin = hmToMinutes(input.end);
  if (Number.isNaN(startMin) || Number.isNaN(endMin) || endMin <= startMin) {
    return {
      ok: false as const,
      message: "End time must be after the start time.",
    };
  }

  const { error } = await supabase.from("busy_blocks").insert({
    contractor_id: contractor.id,
    title: input.title.trim().slice(0, 120) || "Busy",
    start_at: `${input.date}T${input.start}:00.000Z`,
    end_at: `${input.date}T${input.end}:00.000Z`,
  });
  if (error) return { ok: false as const, message: error.message };

  revalidatePath("/schedule");
  return { ok: true as const };
}

export async function deleteBusyBlock(id: string) {
  const { supabase, contractor } = await requireContractor();
  const { error } = await supabase
    .from("busy_blocks")
    .delete()
    .eq("id", id)
    .eq("contractor_id", contractor.id);
  if (error) return { ok: false as const, message: error.message };

  revalidatePath("/schedule");
  return { ok: true as const };
}
