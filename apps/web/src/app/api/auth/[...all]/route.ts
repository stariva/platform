import { corsPreflight, withCors } from "@stariva/auth/cors";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/server";

export const runtime = "nodejs";

const handlers = toNextJsHandler(auth);

// CORS — только для мобильного приложения (точные origin'ы, без cookie:
// см. @stariva/auth/cors). Для запросов со своего сайта ничего не меняется.
export const GET = async (request: Request) =>
  withCors(request, await handlers.GET(request));

export const POST = async (request: Request) =>
  withCors(request, await handlers.POST(request));

export const OPTIONS = (request: Request) => corsPreflight(request);
