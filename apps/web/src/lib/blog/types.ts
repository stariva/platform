export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: string;
  coverImage: string;
  /** CSS object-position for the cover, when the default center crop cuts off the subject */
  coverPosition?: string;
  /** "portrait" puts a vertical cover beside the title instead of cropping it into the wide banner */
  coverOrientation?: "portrait";
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
