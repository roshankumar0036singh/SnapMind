"use client";

import Image from 'next/image';


const testimonials = [
  {
    id: 1,
    name: 'Ralph Edwards',
    company: 'Data Scientist',
    image: '/images/users/user-1.png',
    testimonial:
      "SnapMind's ability to ingest entire GitHub repos and YouTube videos into a queryable knowledge graph has saved me hundreds of hours of research.",
  },
  {
    id: 2,
    name: 'Albert Flores',
    company: 'Research Analyst',
    image: '/images/users/user-2.png',
    testimonial:
      "The GraphRAG feature is incredible! Being able to visualize the relationships between entities automatically extracted from my PDFs is a game-changer.",
  },
  {
    id: 3,
    name: 'Jenny Wilson',
    company: 'Tech Lead',
    image: '/images/users/user-3.png',
    testimonial:
      "I love the Autonomous Web Research mode. It scrapes the web, ranks the best sources, and gives me cited answers instantly.",
  },
  {
    id: 4,
    name: 'Esther Howard',
    company: 'PhD Student',
    image: '/images/users/user-4.png',
    testimonial:
      "The semantic bookmarks in the Research Notebook help me connect the dots between ideas I would have otherwise missed.",
  },
  {
    id: 5,
    name: 'Katie Lee',
    company: 'Content Strategist',
    image: '/images/users/image copy.png',
    testimonial:
      "Generating a fully formatted academic DOCX report from my research session in one click is pure magic. So efficient!",
  },
  {
    id: 6,
    name: 'Terry Watson',
    company: 'Product Manager',
    image: '/images/users/image copy 2.png',
    testimonial:
      "Having a multi-language pipeline out of the box makes researching foreign documents effortless. The translation is flawless.",
  },
];

export default function TestimonialsSection() {
  return (
    <section className="md:py-28 py-14 relative">
      <div className="wrapper">
        <div>
          <div className="max-w-2xl mx-auto mb-12 text-center">
            <h2 className="mb-3 font-bold text-center text-gray-800 text-3xl dark:text-white/90 md:text-title-lg">
              What our users say
            </h2>
            <p className="max-w-xl mx-auto leading-6 text-gray-500 dark:text-gray-400">
              Unlock the Potential of Innovation. Discover how SnapMind's Advanced AI
              Tools transform your workflow with Unmatched Precision and Intelligence.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3 max-w-[72rem] mx-auto">
            {testimonials.map((testimonial) => (
              <TestimonialCard
                key={testimonial.id}
                testimonial={testimonial}
              />
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}

// Testimonial Card Component
function TestimonialCard({
  testimonial,
}: {
  testimonial: (typeof testimonials)[number];
}) {
  return (
    <div className="p-2 bg-gray-50 dark:bg-white/5 dark:border-gray-800 dark:hover:border-white/10 border rounded-[20px] border-gray-100 hover:border-primary-200 transition">
      <div className="flex items-center p-3 mb-3 bg-white/90 dark:bg-white/[0.03] rounded-2xl">
        <div>
          <Image
            src={testimonial.image || '/placeholder.svg'}
            alt={testimonial.name}
            width={52}
            height={52}
            className="size-13 object-cover ring-2 ring-white dark:ring-gray-700 mr-4 rounded-full drop-shadow-[0_8px_20px_rgba(0,0,0,0.08)]"
          />
        </div>
        <div>
          <h3 className="text-gray-800 font-base dark:text-white/90">
            {testimonial.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {testimonial.company}
          </p>
        </div>
      </div>
      <div className="p-5 rounded-2xl bg-white/90 dark:bg-white/[0.03]">
        <p className="text-base leading-6 text-gray-700 dark:text-gray-400">
          {testimonial.testimonial}
        </p>
      </div>
    </div>
  );
}
