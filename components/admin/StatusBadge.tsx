const STATUS_STYLES: Record<string, string> = {
  pending: "badge badge-amber",
  approved: "badge badge-green",
  confirmed: "badge badge-blue",
  rejected: "badge badge-red",
  cancelled: "badge badge-gray",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={STATUS_STYLES[status] ?? "badge badge-gray"} style={{ textTransform: "capitalize" }}>
      {status}
    </span>
  );
}
