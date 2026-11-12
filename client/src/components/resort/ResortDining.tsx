import React from 'react';

interface ResortDiningProps {
  eyebrow?: string;
  title?: string;
  body?: string;
  image?: string;
  hours?: Array<[string, string]>;
}

export default function ResortDining({
  eyebrow = 'Coastal Table',
  title = 'Seaside Grill & Morning Brew',
  body = 'Catch-of-the-day grilled over charcoal, garlic butter shrimp, and rich Benguet highland coffee enjoyed fifty paces from the water.',
  image = 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200&q=80',
  hours = [
    ['Sunrise Breakfast', '6:30 AM – 10:00 AM'],
    ['Coastal Lunch', '11:30 AM – 2:30 PM'],
    ['Sunset Grill & Drinks', '5:00 PM – 10:00 PM'],
  ],
}: ResortDiningProps) {
  return (
    <section id="dining-section" className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10 pt-16 md:pt-24 scroll-mt-16">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#060B18]/90 md:grid md:grid-cols-2 shadow-xl">
        <div className="relative h-60 sm:h-72 md:h-full md:min-h-[440px]">
          <img
            src={image}
            alt={title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#060B18] via-[#060B18]/20 to-transparent md:bg-gradient-to-l" />
        </div>
        <div className="relative -mt-10 p-6 sm:p-8 md:mt-0 md:flex md:flex-col md:justify-center md:p-12">
          <span className="text-xs uppercase tracking-[0.2em] text-cyan font-bold block mb-1">
            {eyebrow}
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-white font-medium tracking-tight">
            {title}
          </h2>
          <p className="mt-4 text-sm md:text-[15px] font-light leading-relaxed text-white/70">
            {body}
          </p>
          <dl className="mt-6 divide-y divide-white/10 border-t border-white/10">
            {hours.map(([meal, time]) => (
              <div key={meal} className="flex items-center justify-between py-3 text-sm">
                <dt className="text-white/80">{meal}</dt>
                <dd className="font-serif text-lg text-cyan">{time}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
