import { getPrepTable } from "@/lib/supabase";
import { clientIp } from "@/lib/rateLimit";

// Records a privileged action in eduorbit_prep.prep_admin_audit_log (migration 013).
// Best effort by design: if the table is missing the action still succeeds, and the failure is logged.
export async function logAdminAction(admin, action, { targetType = null, targetId = null, metadata = {}, request = null } = {}) {
  try {
    const { error } = await getPrepTable("prep_admin_audit_log").insert({
      admin_id: admin?.id || null,
      admin_email: admin?.email || null,
      action,
      target_type: targetType,
      target_id: targetId ? String(targetId) : null,
      metadata,
      ip: request ? clientIp(request) : null
    });
    if (error) console.warn("[audit] not recorded:", error.message);
  } catch (error) {
    console.warn("[audit] not recorded:", error?.message || error);
  }
}
