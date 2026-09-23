import { after } from "next/server";
import { dispatchRequest, notificationConfigured, saveRequest } from "@/lib/custom-order/inbox";
import { createOrderHandler } from "@/lib/custom-order/request-handler";

export const runtime = "nodejs";
export const POST = createOrderHandler({ after, dispatchRequest, notificationConfigured, saveRequest });
