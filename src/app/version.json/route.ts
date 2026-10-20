import { DEPLOYMENT_ID } from "@/config";

// Prerendered at build into a static file the update notice polls; no request-time work.
export const dynamic = "force-static";

export function GET() {
  return Response.json({ id: DEPLOYMENT_ID });
}
