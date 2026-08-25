// Ozon Seller API Types

export interface OzonProductInfo {
  id: number;
  offer_id: string;
  name: string;
  barcode: string;
  category_id: number;
  description: string;
  images: string[];
  primary_image: string;
  price: string;
  old_price: string;
  currency_code: string;
  sku: number;
  fbo_sku: number;
  fbs_sku: number;
  sources: OzonSource[];
  stocks: OzonStock;
  status: OzonProductStatus;
  visible_status: string;
  visibility_details: OzonVisibilityDetails;
  created_at: string;
  updated_at: string;
}

export interface OzonSource {
  is_enabled: boolean;
  sku: number;
  source: string;
}

export interface OzonStock {
  coming: number;
  present: number;
  reserved: number;
}

export interface OzonProductStatus {
  state: string;
  state_failed: string;
  moderate_status: string;
  decline_reasons: string[];
  validation_state: string;
  state_name: string;
  state_description: string;
  is_failed: boolean;
  is_created: boolean;
  state_tooltip: string;
}

export interface OzonVisibilityDetails {
  has_price: boolean;
  has_stock: boolean;
  active_product: boolean;
}

export interface OzonProductListResponse {
  result: {
    items: OzonProductListItem[];
    total: number;
    last_id: string;
  };
}

export interface OzonProductListItem {
  product_id: number;
  offer_id: string;
  is_fbo_visible: boolean;
  is_fbs_visible: boolean;
  archived: boolean;
  is_discounted: boolean;
}

export interface OzonProductInfoResponse {
  result: {
    items: OzonProductInfo[];
  };
}

// ─── Ozon Review API Types ────────────────────────────────────────────────────

export interface OzonReview {
  uuid: string;
  sku: number;
  rating: number; // 1–5
  created_at: string; // ISO-8601
  text: string;
  /** Author's display name – may be absent if hidden by buyer */
  reviewer_name?: string;
  /** Photo URLs attached by buyer */
  media?: { url: string }[];
  /** "published" | "processing" | "rejected" */
  status: string;
}

export interface OzonReviewListResponse {
  reviews: OzonReview[];
  total: number;
  page_token: string;
}

// Normalised review for the UI (decoupled from raw Ozon shape)
export interface Review {
  id: string;
  rating: number;
  text: string;
  date: string; // ISO-8601
  reviewerName: string;
  productSku?: number;
  photos: string[];
  source: "ozon" | "static";
}

// ─── Internal Product Types ───────────────────────────────────────────────────

// Internal Product Types
export type ProductCategory = "clothes" | "interior" | "bags";
export type ProductSubcategory =
  | "dresses"
  | "tops"
  | "belts"
  | "lampshades"
  | "tipis"
  | "pannos"
  | "placemats"
  | "planters"
  | "baskets"
  | "totes"
  | "crossbody";

// Article System Types
export type ArticleCode = string; // Format: XXX-YYY-NNN (e.g., CLO-DRS-001)

export interface ArticleInfo {
  code: ArticleCode;
  category: ProductCategory;
  subcategory: ProductSubcategory;
  number: number;
  description: string;
}

export interface ArticleMapping {
  ozonOfferId: string;
  article: ArticleCode;
  productId: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  price: number;
  oldPrice?: number;
  currency: string;
  images: string[];
  category: ProductCategory;
  subcategory: ProductSubcategory;
  ozonId?: number;
  ozonUrl?: string;
  inStock: boolean;
  material: string;
  dimensions?: string;
  careInstructions?: string;
  color?: string;
  sizes?: string[];
  featured?: boolean;
}

export interface Category {
  slug: ProductCategory;
  name: string;
  description: string;
  image: string;
  subcategories: Subcategory[];
}

export interface Subcategory {
  slug: ProductSubcategory;
  name: string;
  categorySlug: ProductCategory;
}
