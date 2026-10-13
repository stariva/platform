import { MessageCircleIcon } from "lucide-react";
import Link from "next/link";
import { ContactMasterButton } from "@/components/stariva/contact-master";
import { PhoneIcon } from "@/components/stariva/icons";
import { CONTACTS } from "@/lib/contacts";
import { DESIGNER_MESSAGE } from "../_data";

const related = [
  { href: "/b2b", label: "Декор для кафе и ресторанов" },
  { href: "/resort", label: "Для баз отдыха и отелей" },
  { href: "/abazhury", label: "Абажуры в каталоге" },
];

export function DesignersContact() {
  return (
    <section className="py-28 lg:py-40 bg-sand">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          <div className="lg:col-span-6">
            <p className="label-caps text-terracotta tracking-widest mb-4">
              Начнём?
            </p>
            <h2 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] text-espresso leading-[1.05] text-balance mb-6">
              Обсудим ваш проект
            </h2>
            <p className="text-taupe text-base leading-[1.8] max-w-md">
              Без брифа тоже можно: напишите о проекте своими словами и
              приложите визуализации — Ольга задаст уточняющие вопросы сама.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {related.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center label-caps-md text-espresso border border-espresso/15 px-5 py-2.5 rounded-full hover:border-espresso transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 bg-parchment border border-espresso/10 rounded-2xl p-8 lg:p-10 flex flex-col gap-4">
            <p className="text-espresso/60 text-[14px] leading-[1.75]">
              Удобнее всего в мессенджере — Telegram, WhatsApp или MAX: туда
              сразу можно прислать план и визуализации.
            </p>
            <ContactMasterButton
              source="designers_contacts"
              message={DESIGNER_MESSAGE}
              className="flex items-center gap-4 px-7 py-5 rounded-full bg-espresso text-parchment hover:bg-terracotta-dark transition-colors duration-300"
            >
              <MessageCircleIcon
                className="w-5 h-5 shrink-0"
                strokeWidth={1.3}
              />
              <span className="label-caps-md">Написать Ольге</span>
            </ContactMasterButton>
            <a
              href={CONTACTS.phoneHref}
              className="flex items-center gap-4 px-7 py-5 rounded-full border border-espresso/20 text-espresso hover:border-espresso hover:bg-espresso/5 transition-colors duration-300"
            >
              <PhoneIcon className="w-5 h-5 shrink-0" />
              <span className="font-serif text-xl">{CONTACTS.phone}</span>
            </a>
            <p className="text-espresso/70 text-[11px] label-caps pt-2 border-t border-espresso/8">
              {CONTACTS.hours} · договор, счёт, акт и чек НПД
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
