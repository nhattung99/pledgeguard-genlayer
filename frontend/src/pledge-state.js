export function canClaimExpiry(pledge, now) {
  if (["AWAITING_EVIDENCE", "DISPUTED"].includes(pledge.status)) {
    return now > Number(pledge.deadline);
  }
  // Legacy deployments have no review timeout and cannot execute this recovery.
  return (
    pledge.status === "SUBMITTED" &&
    pledge.review_timeout_at !== undefined &&
    pledge.review_timeout_at !== null &&
    now > Number(pledge.review_timeout_at)
  );
}
