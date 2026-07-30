import type { Config } from "https://edge.netlify.com";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function env(name: string): string {
  return Netlify.env.get(name)?.trim() || "";
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

const VALID_ROLES = ["pm", "editor"];

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = env("SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Staff invites are not configured." }, 503);
  }

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) {
    return jsonResponse({ error: "Missing authorization." }, 401);
  }

  let body: { email?: string; full_name?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const email = (body.email || "").trim();
  const fullName = (body.full_name || "").trim();
  const role = body.role || "";

  if (!email || !fullName || !VALID_ROLES.includes(role)) {
    return jsonResponse({ error: "email, full_name, and a valid role (pm or editor) are required." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Trust boundary: getUser() validates the JWT's signature and expiry
  // against Supabase Auth itself. Decoding the token's payload directly,
  // without this call, would let anyone forge a token claiming an
  // arbitrary `sub` and skip straight to the profiles lookup below.
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return jsonResponse({ error: "Invalid or expired session." }, 401);
  }

  const { data: callerProfile, error: profileError } = await admin
    .from("profiles")
    .select("role, active")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !callerProfile || callerProfile.role !== "owner" || !callerProfile.active) {
    return jsonResponse({ error: "Only the Owner can invite staff." }, 403);
  }

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);
  if (inviteError || !inviteData?.user) {
    return jsonResponse({ error: inviteError?.message || "Could not send invite." }, 400);
  }

  const { error: insertError } = await admin.from("profiles").insert({
    id: inviteData.user.id,
    role,
    full_name: fullName,
    email,
    active: true,
  });

  if (insertError) {
    // The auth.users account now exists but has no matching profiles row --
    // clean it up so a failed invite doesn't leave an orphaned, roleless
    // account that can technically authenticate but has no board access,
    // and that would block a retry with the same email.
    await admin.auth.admin.deleteUser(inviteData.user.id);
    return jsonResponse({ error: "Could not create staff profile — please try again." }, 500);
  }

  return jsonResponse({ id: inviteData.user.id, email, full_name: fullName, role }, 200);
};

export const config: Config = {
  path: "/board/api/invite-staff",
  onError: "fail",
};
