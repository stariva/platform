export type { BlogContent, BlogPost } from "./types";

import { bazovyeUzlyMakrame } from "./5-bazovykh-uzlov-makrame";
import { dizainMakrameSChegoNachatEsliVyNeKhudozhnik } from "./dizain-makrame-s-chego-nachat-esli-vy-ne-khudozhnik";
import { filosofiyaSlowLivingIRuchnayaRabota } from "./filosofiya-slow-living-i-ruchnaya-rabota";
import { istoriyaMakrameOtMoryakovDoInterera } from "./istoriya-makrame-ot-moryakov-do-interera";
import { kakUkhazhivatZaMakrameStirkaChistkaKhranenie } from "./kak-ukhazhivat-za-makrame-stirka-chistka-khranenie";
import { kakUkrasiteDetskuyuKomnatuMakrame } from "./kak-ukrasite-detskuyu-komnatu-makrame";
import { kakVybratMakrameSvetilnikDlyaDoma } from "./kak-vybrat-makrame-svetilnik-dlya-doma";
import { kakVybratPervyyMasterKlass } from "./kak-vybrat-pervyy-master-klass";
import { kakVyibratNaturalnyeMaterialyDlyaMakrame } from "./kak-vyibrat-naturalnye-materialy-dlya-makrame";
import { makrameAbazhurAtmosfera } from "./makrame-abazhur-atmosfera-vechera";
import { makrameAbazhurSvoimiRukamiSChegoNachat } from "./makrame-abazhur-svoimi-rukami-s-chego-nachat";
import { makrameDlyaBalkonovILodzhiy } from "./makrame-dlya-balkonov-i-lodzhiy";
import { makrameDlyaDetskoyBezopasnyeIdei } from "./makrame-dlya-detskoy-bezopasnye-idei";
import { makrameDlyaKafeIRestoranov } from "./makrame-dlya-kafe-i-restoranov";
import { makrameDlyaMolodozhenov } from "./makrame-dlya-molodozhenov";
import { makrameIFengShui } from "./makrame-i-feng-shui";
import { makrameNaSvadbe } from "./makrame-na-svadbe";
import { makrameNaUlice } from "./makrame-na-ulice";
import { makrameOsenZimniyDekor } from "./makrame-osen-zimniy-dekor";
import { makramePodarokKakUpak } from "./makrame-podarok-kak-upakovyvat";
import { makramePoyasaSChem } from "./makrame-poyasa-s-chem-nosit";
import { makrameSumkiTrendLeta } from "./makrame-sumki-trend-leta";
import { makrameVInterereSkandinvskiyStil } from "./makrame-v-interere-skandinavskiy-stil";
import { makrameVMalenkoyKvartire } from "./makrame-v-malenkoy-kvartire";
import { makrameVPodarok } from "./makrame-v-podarok";
import { naturalnoKrasenieKhlopka } from "./naturalnoe-krasenie-khlopka";
import { trendyMakrame20252026 } from "./trendy-makrame-2025-2026";
import type { BlogPost } from "./types";
import { uhodZaIzdeliyamiIzMakrame } from "./uhod-za-izdeliyami-iz-makrame";

export const blogPosts: BlogPost[] = [
  istoriyaMakrameOtMoryakovDoInterera,
  kakVybratMakrameSvetilnikDlyaDoma,
  uhodZaIzdeliyamiIzMakrame,
  filosofiyaSlowLivingIRuchnayaRabota,
  makrameAbazhurSvoimiRukamiSChegoNachat,
  kakUkrasiteDetskuyuKomnatuMakrame,
  makrameVInterereSkandinvskiyStil,
  kakVyibratNaturalnyeMaterialyDlyaMakrame,
  dizainMakrameSChegoNachatEsliVyNeKhudozhnik,
  makrameIFengShui,
  makrameDlyaMolodozhenov,
  makrameDlyaBalkonovILodzhiy,
  makrameVPodarok,
  makrameDlyaDetskoyBezopasnyeIdei,
  makrameDlyaKafeIRestoranov,
  makrameSumkiTrendLeta,
  kakUkhazhivatZaMakrameStirkaChistkaKhranenie,
  makrameVMalenkoyKvartire,
  makrameOsenZimniyDekor,
  naturalnoKrasenieKhlopka,
  makrameNaUlice,
  bazovyeUzlyMakrame,
  trendyMakrame20252026,
  kakVybratPervyyMasterKlass,
  makramePoyasaSChem,
  makrameAbazhurAtmosfera,
  makramePodarokKakUpak,
  makrameNaSvadbe,
].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
