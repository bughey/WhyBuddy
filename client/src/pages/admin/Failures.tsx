import { useEffect } from "react";

import { useAdminStore } from "@/lib/admin-store";

import {
  AdminErrorBanner,
  AdminTableShell,
  EmptyTableRow,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  formatAdminDate,
  formatAdminValue,
} from "./admin-page-utils";

export function AdminFailuresPage() {
  const failures = useAdminStore(state => state.failures);
  const loading = useAdminStore(state => state.loading);
  const error = useAdminStore(state => state.error);
  const loadFailures = useAdminStore(state => state.loadFailures);

  useEffect(() => {
    void loadFailures();
  }, [loadFailures]);

  return (
    <section data-testid="admin-failures-page" className="space-y-3">
      <AdminErrorBanner error={error} />
      <AdminTableShell
        title="Failures"
        description="Failure records for operational triage."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Failure</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Run</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {failures.map(failure => (
              <TableRow key={failure.id}>
                <TableCell>
                  <div className="min-w-48">
                    <p className="font-medium">{failure.id}</p>
                    <p className="max-w-sm truncate text-xs text-slate-500">
                      {formatAdminValue(failure.message)}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge value={failure.status ?? "failed"} />
                </TableCell>
                <TableCell>{formatAdminValue(failure.runId)}</TableCell>
                <TableCell>{formatAdminValue(failure.projectId)}</TableCell>
                <TableCell>{formatAdminValue(failure.reason)}</TableCell>
                <TableCell>{formatAdminDate(failure.createdAt)}</TableCell>
              </TableRow>
            ))}
            {!failures.length ? (
              <EmptyTableRow
                colSpan={6}
                label={
                  loading ? "Loading failures..." : "No failures returned."
                }
              />
            ) : null}
          </TableBody>
        </Table>
      </AdminTableShell>
    </section>
  );
}
