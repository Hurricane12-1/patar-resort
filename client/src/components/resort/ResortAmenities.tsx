import React from 'react';

interface ResortAmenitiesProps {
  eyebrow?: string;
  title?: string;
  items: Array<{ icon: string; label: string }>;
}

export default function ResortAmenities({
  eyebrow = 'Resort Comforts',
  title = 'Thoughtful Simplicity',
  items = [],
}: ResortAmenitiesProps) {
  const renderIcon = (name: string) => {
    switch (name) {
      case 'wave':
        return <i className="fas fa-water" />;
      case 'wifi':
        return <i className="fas fa-wifi" />;
      case 'utensils':
        return <i className="fas fa-utensils" />;
      case 'cocktail':
        return <i className="fas fa-martini-glass-citrus" />;
      case 'sun':
        return <i className="fas fa-umbrella-beach" />;
      case 'compass':
        return <i className="fas fa-compass" />;
      default:
        return <i className="fas fa-check" />;
    }
  };

  return (
    <section id="amenities-section" className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10 pt-16 md:pt-24 scroll-mt-16">
      <span className="text-xs uppercase tracking-[0.2em] text-cyan font-bold block mb-1">
        {eyebrow}
      </span>
      <h2 className="font-serif text-3xl sm:text-4xl text-white font-medium tracking-tight">
        {title}
      </h2>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {items.map((a) => (
          <div
            key={a.label}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan/30 md:p-5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan/30 bg-cyan/15 text-cyan">
              {renderIcon(a.icon)}
            </span>
            <span className="text-xs md:text-sm font-medium text-white/80">{a.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
