export function isAdminEmail(email: string, adminEmails: string | undefined): boolean {
  const wanted = email.trim().toLowerCase();
  if (!wanted || !adminEmails) return false;
  return adminEmails
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .includes(wanted);
}
