export function formatRelativeTime(value: string | number | Date): string {
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return "";
  }

  const diff = Date.now() - target.getTime();
  const units = [
    { label: "day", ms: 86_400_000 },
    { label: "hour", ms: 3_600_000 },
    { label: "minute", ms: 60_000 },
  ];

  for (const unit of units) {
    if (diff >= unit.ms) {
      const value = Math.floor(diff / unit.ms);
      const suffix = value === 1 ? unit.label : `${unit.label}s`;
      return `${value} ${suffix} ago`;
    }
  }

  return "just now";
}
