/** Shared Academy authorization guard (client-safe: no server-only imports). */
export async function assertCanManage(supabase: any, userId: string) {
  const [{ data: roleRows }, { data: prof }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("can_manage_resources").eq("id", userId).maybeSingle(),
  ]);
  const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
  const isAdmin = roles.some((r: string) => r === "admin" || r === "super_admin");
  if (!isAdmin && !prof?.can_manage_resources) {
    throw new Error("Forbidden: you are not permitted to manage Academy content.");
  }
}
