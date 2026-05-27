/**
 * FeaturesCard — lista toggles com key `feature:*`.
 */

"use client";

import { ToggleRow } from "./toggle-row";
import { isFeatureKey } from "@/lib/toggles-meta";

interface ToggleData {
  key: string;
  enabled: boolean;
  description: string | null;
  updated_at: string;
}

interface Props {
  toggles: ToggleData[];
  onMutated: () => void | Promise<void>;
}

export function FeaturesCard({ toggles, onMutated }: Props): React.ReactElement | null {
  const features = toggles.filter((t) => isFeatureKey(t.key));
  if (features.length === 0) return null;

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
        Features
      </h2>
      <div className="mt-4 space-y-4">
        {features.map((t) => (
          <ToggleRow key={t.key} toggle={t} onMutated={onMutated} />
        ))}
      </div>
    </section>
  );
}
