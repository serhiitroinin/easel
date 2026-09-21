import type { HarnessDiscovery, HarnessLimit, HarnessLimitSnapshot } from "reins";

function percentOf(limit: HarnessLimit): number | null {
  if (limit.usedPercent !== undefined) return Math.max(0, Math.min(100, limit.usedPercent));
  if (limit.limit !== undefined && limit.limit > 0 && limit.used !== undefined) {
    return Math.max(0, Math.min(100, (limit.used / limit.limit) * 100));
  }
  return null;
}

function resetsIn(limit: HarnessLimit): string | null {
  if (!limit.resetsAt) return null;
  const at = Date.parse(limit.resetsAt);
  if (!Number.isFinite(at)) return null;
  const hours = Math.round((at - Date.now()) / 3_600_000);
  if (hours <= 0) return "resets soon";
  return hours < 48 ? `resets in ${hours} h` : `resets in ${Math.round(hours / 24)} d`;
}

function amountOf(limit: HarnessLimit): string | null {
  if (limit.remaining !== undefined) {
    const unit = limit.unit.toLowerCase() === limit.label.toLowerCase() ? "" : ` ${limit.unit}`;
    return `${formatAmount(limit.remaining)}${unit} left`;
  }
  if (limit.used !== undefined && limit.limit !== undefined) {
    return `${formatAmount(limit.used)} of ${formatAmount(limit.limit)}`;
  }
  return null;
}

function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function Row({ limit }: { limit: HarnessLimit }) {
  const percent = percentOf(limit);
  const when = resetsIn(limit);
  const amount = percent === null ? amountOf(limit) : null;
  return (
    <div className="meterline">
      <span className="meter">{percent !== null && <span style={{ width: `${percent}%` }} />}</span>
      <span>
        {limit.label}
        {percent !== null ? ` ${Math.round(percent)}%` : ""}
        {amount ? ` ${amount}` : ""}
        {when ? ` · ${when}` : ""}
      </span>
    </div>
  );
}

/** One quiet row for each limit. The three discovery states are all written in plain words. */
export function LimitLine({ discovery }: { discovery: HarnessDiscovery<HarnessLimitSnapshot> }) {
  if (discovery.status === "unsupported") {
    return <p className="limitline">{discovery.message ?? "This engine does not report account limits."}</p>;
  }
  if (discovery.status === "unavailable") {
    return <p className="limitline">Account limits are unavailable. {discovery.message}</p>;
  }
  const { limits, planLabel } = discovery.value;
  if (limits.length === 0) return <p className="limitline">{planLabel ?? "No account limit is in force."}</p>;
  return (
    <div className="limitline limits">
      {planLabel && <span className="plan">{planLabel} plan</span>}
      {limits.map((limit) => <Row key={limit.id} limit={limit} />)}
    </div>
  );
}
