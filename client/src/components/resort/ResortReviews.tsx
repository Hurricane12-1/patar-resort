import React from 'react';

interface ReviewItem {
  quote: string;
  name: string;
  from: string;
}

interface ResortReviewsProps {
  eyebrow?: string;
  title?: string;
  items: ReviewItem[];
}

export default function ResortReviews({
  eyebrow = 'Guest Reflections',
  title = 'Memories of Patar',
  items = [],
}: ResortReviewsProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10 pt-16 md:pt-24">
      <span className="text-xs uppercase tracking-[0.2em] text-cyan font-bold block mb-1">
        {eyebrow}
      </span>
      <h2 className="font-serif text-3xl sm:text-4xl text-white font-medium tracking-tight">
        {title}
      </h2>

      <div className="mt-8 flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-none lg:grid lg:grid-cols-3 lg:gap-5">
        {items.map((rev) => (
          <figure
            key={rev.name}
            className="flex w-[85%] shrink-0 snap-start flex-col rounded-3xl border border-white/10 bg-[#060B18]/90 p-6 sm:w-[60%] md:p-7 lg:w-auto shadow-md"
          >
            <span className="text-sm tracking-[0.2em] text-[#FBBF24]">
              <i className="fas fa-star" /><i className="fas fa-star" /><i className="fas fa-star" /><i className="fas fa-star" /><i className="fas fa-star" />
            </span>
            <blockquote className="mt-4 font-serif text-xl italic leading-relaxed text-white/90">
              "{rev.quote}"
            </blockquote>
            <figcaption className="mt-auto flex items-center gap-3 border-t border-white/10 pt-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan/40 bg-cyan/10 font-serif text-base text-cyan font-bold">
                {rev.name[0]}
              </span>
              <span>
                <span className="block text-xs font-medium text-white">{rev.name}</span>
                <span className="block text-[11px] text-white/50">{rev.from}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
