/**
 * lib/admin.ts
 * Single source of truth for admin access.
 * Import isAdminEmail anywhere you need an admin check.
 */

const ADMIN_EMAILS = ["admin@novabank.com"];

export function isAdminEmail(email: string | null | undefined): boolean {
  return ADMIN_EMAILS.includes(email ?? "");
}
