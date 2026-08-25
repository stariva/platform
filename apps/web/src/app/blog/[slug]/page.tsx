import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/stariva/json-ld";
import { PinterestSaveButton } from "@/components/stariva/pinterest-save-button";
import { blogPosts, formatDate, getPostBySlug } from "@/lib/blog-data";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://stariva.ru";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  const url = `/blog/${slug}`;
  const image = `${BASE_URL}${post.coverImage}`;

  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `${BASE_URL}${url}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      url: `${BASE_URL}${url}`,
      publishedTime: post.date,
      images: [{ url: image, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [image],
    },
  };
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = blogPosts
    .filter((p) => p.slug !== post.slug)
    .slice(0, 2);
  const url = `/blog/${slug}`;

  return (
    <>
      <Header variant="solid" />
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Блог", href: "/blog" },
          { name: post.title, href: url },
        ]}
      />
      <ArticleJsonLd
        title={post.title}
        description={post.excerpt}
        image={post.coverImage}
        datePublished={post.date}
        url={url}
      />
      <main className="pt-24 lg:pt-32 pb-20">
        {/* Back Link */}
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 mb-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-taupe hover:text-terracotta transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span className="label-caps-md">Назад к блогу</span>
          </Link>
        </div>

        {/* Article Header */}
        <article className="max-w-[1400px] mx-auto px-6 lg:px-10">
          <header className="max-w-3xl mx-auto text-center mb-12">
            <div className="flex items-center justify-center gap-4 mb-6">
              <span className="label-caps text-terracotta">
                {post.category}
              </span>
              <span className="w-1 h-1 rounded-full bg-taupe/50" />
              <span className="label-caps text-taupe">{post.readTime}</span>
            </div>
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-espresso mb-6 text-balance">
              {post.title}
            </h1>
            <p className="text-taupe text-lg leading-relaxed mb-6">
              {post.excerpt}
            </p>
            <time dateTime={post.date} className="text-sm text-taupe/70">
              {formatDate(post.date)}
            </time>
          </header>

          {/* Cover Image */}
          <div className="relative aspect-[21/9] lg:aspect-[2.5/1] overflow-hidden rounded-xl mb-16">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              className="object-cover"
              sizes="(max-width: 1400px) 100vw, 1400px"
              priority
            />
          </div>

          {/* Article Content */}
          <div className="max-w-2xl mx-auto">
            {post.content.map((block, index) => {
              switch (block.type) {
                case "paragraph":
                  return (
                    <p
                      // biome-ignore lint/suspicious/noArrayIndexKey: blog content blocks are static and never reordered
                      key={index}
                      className="text-espresso/90 leading-relaxed text-lg mb-6"
                    >
                      {block.text}
                    </p>
                  );
                case "heading":
                  return (
                    <h2
                      // biome-ignore lint/suspicious/noArrayIndexKey: blog content blocks are static and never reordered
                      key={index}
                      className="font-serif text-2xl lg:text-3xl text-espresso mt-12 mb-6"
                    >
                      {block.text}
                    </h2>
                  );
                case "image":
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: blog content blocks are static and never reordered
                    <figure key={index} className="my-12">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
                        <Image
                          src={block.src ?? ""}
                          alt={block.alt ?? ""}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 672px"
                        />
                      </div>
                      {block.caption && (
                        <figcaption className="text-center text-sm text-taupe mt-4">
                          {block.caption}
                        </figcaption>
                      )}
                    </figure>
                  );
                case "quote":
                  return (
                    <blockquote
                      // biome-ignore lint/suspicious/noArrayIndexKey: blog content blocks are static and never reordered
                      key={index}
                      className="my-12 pl-6 border-l-2 border-terracotta"
                    >
                      <p className="font-serif text-xl lg:text-2xl text-espresso italic leading-relaxed">
                        {block.text}
                      </p>
                    </blockquote>
                  );
                case "cta":
                  return (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: blog content blocks are static and never reordered
                      key={index}
                      className="my-10 p-6 bg-sand rounded-xl border border-espresso/8 text-center"
                    >
                      <p className="text-espresso/80 text-base mb-4">
                        {block.text}
                      </p>
                      <Link
                        href={block.href ?? "/catalog"}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-espresso text-parchment label-caps-md hover:bg-terracotta transition-colors"
                      >
                        {block.label ?? "Перейти"}
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M2 6h8M7 3l3 3-3 3"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </Link>
                    </div>
                  );
                default:
                  return null;
              }
            })}
          </div>

          {/* CTA Section */}
          <div className="max-w-2xl mx-auto mt-16 pt-12 border-t border-espresso/10">
            {/* Pinterest Save */}
            <div className="flex justify-center mb-8">
              <PinterestSaveButton
                url={`${BASE_URL}${url}`}
                imageUrl={`${BASE_URL}${post.coverImage}`}
                description={`${post.title} — ${post.excerpt} | Stariva`}
                variant="button"
              />
            </div>

            {/* CTA to catalog */}
            <div className="p-6 bg-espresso rounded-xl text-parchment text-center">
              <p className="font-serif text-xl mb-2">Понравилась статья?</p>
              <p className="text-parchment/70 text-sm mb-5">
                Посмотрите изделия ручного макраме в нашем каталоге
              </p>
              <Link
                href="/catalog"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-terracotta text-parchment label-caps-md hover:bg-terracotta/90 transition-colors"
              >
                Смотреть каталог
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 6h8M7 3l3 3-3 3"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </article>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="max-w-[1400px] mx-auto px-6 lg:px-10 mt-20 lg:mt-32">
            <h2 className="font-serif text-2xl lg:text-3xl text-espresso mb-10 text-center">
              Читайте также
            </h2>
            <div className="grid md:grid-cols-2 gap-8 lg:gap-10 max-w-4xl mx-auto">
              {relatedPosts.map((relatedPost) => (
                <Link
                  key={relatedPost.slug}
                  href={`/blog/${relatedPost.slug}`}
                  className="group block"
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-lg mb-5">
                    <Image
                      src={relatedPost.coverImage}
                      alt={relatedPost.title}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 400px"
                    />
                    <div className="absolute inset-0 bg-espresso/10 group-hover:bg-espresso/0 transition-colors duration-500" />
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="label-caps text-terracotta">
                      {relatedPost.category}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-taupe/50" />
                    <span className="label-caps text-taupe">
                      {relatedPost.readTime}
                    </span>
                  </div>
                  <h3 className="font-serif text-xl text-espresso group-hover:text-terracotta transition-colors text-balance">
                    {relatedPost.title}
                  </h3>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Back to Blog */}
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 mt-16 text-center">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 label-caps-md px-6 py-3 rounded-full border border-espresso text-espresso hover:bg-espresso hover:text-parchment transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Все статьи блога
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
