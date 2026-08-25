import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { ItemListJsonLd } from "@/components/stariva/json-ld";
import { blogPosts, formatDate } from "@/lib/blog-data";
import { NewsletterForm } from "./newsletter-form";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://stariva.ru";

export const metadata: Metadata = {
  title: "Блог о макраме — советы, история, вдохновение",
  description:
    "Статьи о технике макраме, уходе за изделиями, истории ремесла и философии осознанного потребления. Блог мастерской Stariva.",
  alternates: { canonical: `${BASE_URL}/blog` },
  openGraph: {
    type: "website",
    title: "Блог Stariva — о макраме, уюте и осознанной жизни",
    description:
      "Статьи о технике макраме, уходе за изделиями, истории ремесла и философии осознанного потребления.",
    url: `${BASE_URL}/blog`,
    images: [
      {
        url: `${BASE_URL}${blogPosts[0]!.coverImage}`,
        width: 1200,
        height: 630,
        alt: "Блог Stariva",
      },
    ],
  },
};

export default function BlogPage() {
  const featuredPost = blogPosts[0]!;
  const otherPosts = blogPosts.slice(1);

  return (
    <>
      <Header variant="solid" />
      <ItemListJsonLd
        name="Блог Stariva — статьи о макраме"
        url="/blog"
        items={blogPosts.map((post) => ({
          name: post.title,
          url: `/blog/${post.slug}`,
          image: `${BASE_URL}${post.coverImage}`,
        }))}
      />
      <main className="pt-24 lg:pt-32 pb-20">
        {/* Hero Section */}
        <section className="max-w-[1400px] mx-auto px-6 lg:px-10 mb-16 lg:mb-24">
          <div className="text-center mb-12">
            <span className="label-caps text-terracotta mb-4 block">
              Блог Stariva
            </span>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-espresso mb-6 text-balance">
              Истории о ремесле, уюте и осознанной жизни
            </h1>
            <p className="text-taupe max-w-2xl mx-auto text-lg leading-relaxed">
              Делюсь вдохновением, советами по уходу за изделиями и историями о
              том, как ручная работа меняет пространство вокруг нас.
            </p>
          </div>

          {/* Featured Post */}
          <article>
            <Link href={`/blog/${featuredPost.slug}`} className="group block">
              <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
                <div className="relative aspect-[4/3] lg:aspect-[3/2] overflow-hidden rounded-lg">
                  <Image
                    src={featuredPost.coverImage}
                    alt={featuredPost.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority
                  />
                  <div className="absolute inset-0 bg-espresso/10 group-hover:bg-espresso/0 transition-colors duration-500" />
                </div>
                <div className="lg:py-8">
                  <div className="flex items-center gap-4 mb-4">
                    <span className="label-caps text-terracotta">
                      {featuredPost.category}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-taupe/50" />
                    <span className="label-caps text-taupe">
                      {featuredPost.readTime}
                    </span>
                  </div>
                  <h2 className="font-serif text-2xl md:text-3xl lg:text-4xl text-espresso mb-4 group-hover:text-terracotta transition-colors text-balance">
                    {featuredPost.title}
                  </h2>
                  <p className="text-taupe leading-relaxed mb-6">
                    {featuredPost.excerpt}
                  </p>
                  <div className="flex items-center gap-4">
                    <time
                      dateTime={featuredPost.date}
                      className="text-sm text-taupe"
                    >
                      {formatDate(featuredPost.date)}
                    </time>
                    <span className="label-caps-md text-terracotta group-hover:underline underline-offset-4">
                      Читать статью
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </article>
        </section>

        {/* Divider */}
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 mb-16 lg:mb-24">
          <div className="h-px bg-espresso/10" />
        </div>

        {/* Posts Grid */}
        <section className="max-w-[1400px] mx-auto px-6 lg:px-10">
          <h2 className="font-serif text-2xl lg:text-3xl text-espresso mb-10">
            Все статьи
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
            {otherPosts.map((post) => (
              <article key={post.slug}>
                <Link href={`/blog/${post.slug}`} className="group block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-lg mb-5">
                    <Image
                      src={post.coverImage}
                      alt={post.title}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-espresso/10 group-hover:bg-espresso/0 transition-colors duration-500" />
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="label-caps text-terracotta">
                      {post.category}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-taupe/50" />
                    <span className="label-caps text-taupe">
                      {post.readTime}
                    </span>
                  </div>
                  <h3 className="font-serif text-xl lg:text-2xl text-espresso mb-3 group-hover:text-terracotta transition-colors text-balance">
                    {post.title}
                  </h3>
                  <p className="text-taupe text-sm leading-relaxed mb-4 line-clamp-2">
                    {post.excerpt}
                  </p>
                  <time dateTime={post.date} className="text-sm text-taupe/70">
                    {formatDate(post.date)}
                  </time>
                </Link>
              </article>
            ))}
          </div>
        </section>

        {/* Newsletter CTA */}
        <section className="max-w-[1400px] mx-auto px-6 lg:px-10 mt-20 lg:mt-32">
          <div className="bg-sand rounded-2xl p-8 lg:p-12 text-center">
            <h2 className="font-serif text-2xl lg:text-3xl text-espresso mb-4">
              Подпишитесь на мои истории
            </h2>
            <p className="text-taupe max-w-lg mx-auto mb-8">
              Раз в месяц присылаю новые статьи, вдохновение и закулисье
              мастерской. Без спама, только тёплые письма.
            </p>
            <NewsletterForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
