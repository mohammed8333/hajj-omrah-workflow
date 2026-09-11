import React from "react";
import { DocumentReviewStatus, RequestStatus } from "@/types";
import { REVIEW_STATUS_MAP, STATUS_MAP } from "@/lib/constants";

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const meta = STATUS_MAP[status] || {
    label: status,
    color: "bg-gray-100 text-gray-800 border-gray-300",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.color}`}
    >
      {meta.label}
    </span>
  );
}

export function DocumentStatusBadge({ status }: { status: DocumentReviewStatus }) {
  const meta = REVIEW_STATUS_MAP[status] || {
    label: status,
    color: "bg-gray-100 text-gray-800",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${meta.color}`}
    >
      {meta.label}
    </span>
  );
}
