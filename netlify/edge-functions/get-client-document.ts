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

const VALID_DOC_TYPES = ["contract", "quote"];
const SIGNED_URL_TTL_SECONDS = 300;

export default async (req: Request): Promise<Response> => {
  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = env("SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Document access is not configured." }, 503);
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const docType = url.searchParams.get("type") || "";

  if (!token || !VALID_DOC_TYPES.includes(docType)) {
    return jsonResponse({ error: "token and a valid type (contract or quote) are required." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Same token-validation contract as every other client-facing access
  // path in this system (see assert_valid_client_token in Postgres): an
  // invalid or revoked token gets one generic rejection, never a hint
  // about which check failed.
  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id, contract_uploaded_at, quote_uploaded_at")
    .eq("client_access_token", token)
    .eq("token_revoked", false)
    .single();

  if (projectError || !project) {
    return jsonResponse({ error: "Invalid or expired link." }, 404);
  }

  const uploadedAt = docType === "contract" ? project.contract_uploaded_at : project.quote_uploaded_at;
  if (!uploadedAt) {
    return jsonResponse({ error: "This document hasn't been uploaded yet." }, 404);
  }

  const path = `${project.id}/${docType}.pdf`;
  const { data: signed, error: signError } = await admin
    .storage
    .from("project-documents")
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    return jsonResponse({ error: "Could not generate a download link — please try again." }, 500);
  }

  return Response.redirect(signed.signedUrl, 302);
};

export const config: Config = {
  path: "/board/api/document",
  onError: "fail",
};
