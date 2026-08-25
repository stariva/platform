export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: string;
  coverImage: string;
  content: BlogContent[];
}

export interface BlogContent {
  type: "paragraph" | "heading" | "image" | "quote" | "cta";
  text?: string;
  src?: string;
  alt?: string;
  caption?: string;
  /** Internal link href for "cta" blocks (e.g. "/catalog/interior") */
  href?: string;
  /** Button label for "cta" blocks */
  label?: string;
}
