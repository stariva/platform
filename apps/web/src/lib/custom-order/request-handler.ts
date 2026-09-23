import { type OrderRequest, orderRequestSchema, validatePhoto } from "./schema";

interface OrderHandlerDependencies {
  notificationConfigured: () => boolean;
  saveRequest: (data: OrderRequest, photo: File | null) => Promise<string>;
  dispatchRequest: (id: string) => Promise<void>;
  after: (callback: () => Promise<void>) => void;
}
export function createOrderHandler({
  notificationConfigured,
  saveRequest,
  dispatchRequest,
  after,
}: OrderHandlerDependencies) {
  return async function POST(request: Request) {
    if (Number(request.headers.get("content-length")) > 9 * 1024 * 1024)
      return Response.json(
        { error: "Фото слишком большое (максимум 8 МБ)" },
        { status: 413 },
      );
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return Response.json({ error: "Некорректный запрос" }, { status: 400 });
    }
    if (form.get("website"))
      return Response.json(
        { error: "Не удалось принять заявку" },
        { status: 400 },
      );
    let attribution: unknown;
    try {
      attribution = form.has("attribution")
        ? JSON.parse(String(form.get("attribution")))
        : undefined;
    } catch {
      return Response.json(
        { error: "Некорректный источник заявки" },
        { status: 400 },
      );
    }
    const parsed = orderRequestSchema.safeParse({
      ...Object.fromEntries(form),
      attribution,
    });
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 },
      );
    const entry = form.get("photo");
    const photo = entry instanceof File && entry.size ? entry : null;
    if (photo) {
      const error = validatePhoto(photo);
      if (error) return Response.json({ error }, { status: 400 });
    }
    if (!notificationConfigured())
      return Response.json(
        {
          error:
            "Приём заявок временно недоступен. Напишите мастеру в Telegram или позвоните.",
        },
        { status: 503 },
      );
    try {
      const requestId = await saveRequest(parsed.data, photo);
      after(async () => {
        try {
          await dispatchRequest(requestId);
        } catch {
          console.error("[custom-order] delivery_deferred", { requestId });
        }
      });
      return Response.json({ ok: true, requestId });
    } catch (error) {
      if (error instanceof Error && error.message === "request_conflict")
        return Response.json(
          { error: "Заявка изменилась. Попробуйте отправить её ещё раз." },
          { status: 409 },
        );
      console.error("[custom-order] save_failed");
      return Response.json(
        {
          error:
            "Не удалось сохранить заявку. Данные остались в форме — повторите отправку или свяжитесь с мастером.",
        },
        { status: 503 },
      );
    }
  };
}
