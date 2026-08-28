import React from "react";

export default function HeroLogos() {
  const techStack = [
    {
      name: "Supabase",
      logo: (
        <svg viewBox="0 0 24 24" className="w-7 h-7 md:w-9 md:h-9">
          <path d="M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L2.203 12.424A.39.39 0 0 0 2.518 13h9.482v8.604a.396.396 0 0 0 .716.233l9.081-12.261a.39.39 0 0 0-.435-.619z" fill="#3ECF8E" />
        </svg>
      )
    },
    {
      name: "Next.js",
      logo: (
        <svg viewBox="0 0 180 180" className="w-7 h-7 md:w-9 md:h-9 fill-black dark:fill-white">
          <path d="M90 0C40.294 0 0 40.294 0 90s40.294 90 90 90 90-40.294 90-90S139.706 0 90 0zm43.348 126.79l-49.882-62.74H70v51.89h10.957V74.887l41.678 52.883a79.034 79.034 0 0 1-32.635 12.18c-34.908 0-63.157-28.249-63.157-63.157S55.092 26.843 90 26.843c34.908 0 63.157 28.249 63.157 63.157a62.977 62.977 0 0 1-19.809 36.79z" />
          <path d="M106.843 115.94h10.957V64.05h-10.957v51.89z" />
        </svg>
      )
    },
    {
      name: "React",
      logo: (
        <svg viewBox="-11.5 -10.23174 23 20.46348" className="w-7 h-7 md:w-9 md:h-9">
          <circle cx="0" cy="0" r="2.05" fill="#61dafb" />
          <g stroke="#61dafb" strokeWidth="1" fill="none">
            <ellipse rx="11" ry="4.2" />
            <ellipse rx="11" ry="4.2" transform="rotate(60)" />
            <ellipse rx="11" ry="4.2" transform="rotate(120)" />
          </g>
        </svg>
      )
    },
    {
      name: "Tailwind CSS",
      logo: (
        <svg viewBox="0 0 24 24" className="w-7 h-7 md:w-9 md:h-9">
          <path d="M12 5.5c-2.5 0-4.5 1-5.5 3 .5-1.5 1.5-2.5 3-3s2.5-.5 3 0l1 1c1.5 1.5 2.5 2 4 2 2.5 0 4.5-1 5.5-3-.5 1.5-1.5 2.5-3 3s-2.5.5-3 0l-1-1c-1.5-1.5-2.5-2-4-2zM6 12.5c-2.5 0-4.5 1-5.5 3 .5-1.5 1.5-2.5 3-3s2.5-.5 3 0l1 1c1.5 1.5 2.5 2 4 2 2.5 0 4.5-1 5.5-3-.5 1.5-1.5 2.5-3 3s-2.5.5-3 0l-1-1c-1.5-1.5-2.5-2-4-2z" fill="#38bdf8" />
        </svg>
      )
    },
    {
      name: "FastAPI",
      logo: (
        <svg viewBox="0 0 100 100" className="w-7 h-7 md:w-9 md:h-9">
          <path d="M50 0a50 50 0 1 0 0 100A50 50 0 0 0 50 0zm0 10a40 40 0 1 1 0 80A40 40 0 0 1 50 10zm-4 15v20H32l24 35v-20h12L46 25z" fill="#009688" />
        </svg>
      )
    },
    {
      name: "PostgreSQL",
      logo: (
        <svg viewBox="0 0 24 24" className="w-7 h-7 md:w-9 md:h-9">
          <path d="M21.2 5.8l-1.3-.8c-.7-.4-1.7-.8-3-1l.3 1.8c.8.2 1.3.4 1.7.6 1.4.8 1.4 1.7 0 2.5-1.7.9-4.7 1.4-8 1.4-2.8 0-5.5-.4-7.2-1.1-.6-.3-.9-.6-.9-.8 0-.4.7-.8 2-1.1l-.5-1.8c-1.8.5-3.3 1.3-3.3 2.9 0 1.2 1 2.2 3 3 1.9.7 4.2 1.1 6.8 1.1 3 0 5.6-.4 7.6-1.1 2.2-.8 3.3-2 3.3-3.3 0-1.2-.5-2-2.5-3.3zM12 17.5c-3 0-5.6-.4-7.6-1.1-1.9-.7-2.9-1.6-2.9-2.7 0-.3.1-.7.4-1 .3.2.7.4 1.1.5-.7 1.3-1.6 2 3.7 2.6 1.9.4 3.9.6 5.9.6 3 0 5.6-.4 7.6-1.1 1.9-.7 2.9-1.6 2.9-2.7 0-1.1-.9-2.1-2.9-2.8l-.6 1.8c1.3.5 2 1.1 2 1.7 0 1.3-3.6 2.4-8 2.4-4.5 0-8.2-1-8.2-2.4 0-.3.2-.6.5-.9l-.9-1.6c-1 1-1.1 2-.1 3 1.9.9 5.3 1.5 8.7 1.5 3 0 5.6-.4 7.6-1.1 2.2-.8 3.3-2 3.3-3.3 0-1.4-1.2-2.5-3.5-3.3l-.5 1.7c1.7.5 2.5 1.3 2.5 2.2 0 1.3-3.6 2.4-8 2.4-4.5 0-8.2-1-8.2-2.4 0-.7.6-1.4 1.5-1.8l-.9-1.7c-1.3.6-2.1 1.5-2.1 2.5 0 1.2 1 2.2 3 3 1.9.7 4.2 1.1 6.8 1.1 3 0 5.6-.4 7.6-1.1 2.2-.8 3.3-2 3.3-3.3 0-1.1-.8-2.1-2.3-2.9l-.7 1.7c1.1.5 1.5 1 1.5 1.6 0 1.3-3.6 2.4-8 2.4z" fill="#336791" />
        </svg>
      )
    },
    {
      name: "Gemini",
      logo: (
        <svg viewBox="0 0 24 24" className="w-7 h-7 md:w-9 md:h-9">
          <defs>
            <linearGradient id="gemini-gradient" x1="2.5" y1="2.5" x2="21.5" y2="21.5">
              <stop offset="0%" stopColor="#4285F4" />
              <stop offset="50%" stopColor="#9B72CB" />
              <stop offset="100%" stopColor="#D96570" />
            </linearGradient>
          </defs>
          <path d="M12 2.5C12 7.75 16.25 12 21.5 12C16.25 12 12 16.25 12 21.5C12 16.25 7.75 12 2.5 12C7.75 12 12 7.75 12 2.5Z" fill="url(#gemini-gradient)" />
        </svg>
      )
    },
    {
      name: "Python",
      logo: (
        <svg viewBox="0 0 110 110" className="w-7 h-7 md:w-9 md:h-9">
          <path fill="#387eb8" d="M53.8,11.2c-12,0-18.7,4.8-21.7,11.6c-2.3,5.2-1.9,13.7-1.9,13.7h23.2v3.7H19.5c-6.8,0-12.7,3-15.5,8.8c-2.5,5.2-2.7,13.5-1.9,19.3c1,7.2,5.7,11.6,13.2,13.6c5.7,1.5,12.5,1.4,12.5,1.4v-9.3c0-7,6-13,13-13h17c7.4,0,13.2-6.1,13.2-13.4V24c0-7.4-5.8-12.8-13.2-12.8H53.8z M44.6,20.4c1.9,0,3.5,1.6,3.5,3.5S46.5,27.4,44.6,27.4c-1.9,0-3.5-1.6-3.5-3.5C41.1,22,42.7,20.4,44.6,20.4z" />
          <path fill="#ffe052" d="M54.5,96.8c12,0,18.7-4.8,21.7-11.6c2.3-5.2,1.9-13.7,1.9-13.7H54.9v-3.7h33.9c6.8,0,12.7-3,15.5-8.8c2.5-5.2,2.7-13.5,1.9-19.3c-1-7.2-5.7-11.6-13.2-13.6c-5.7-1.5-12.5-1.4-12.5-1.4v9.3c0,7-6,13-13,13h-17c-7.4,0-13.2,6.1-13.2,13.4V84c0,7.4,5.8,12.8,13.2,12.8H54.5z M63.7,87.6c-1.9,0-3.5-1.6-3.5-3.5c0-1.9,1.6-3.5,3.5-3.5s3.5,1.6,3.5,3.5S65.6,87.6,63.7,87.6z" />
        </svg>
      )
    },
    {
      name: "Firecrawl",
      logo: (
        <svg viewBox="0 0 24 24" className="w-7 h-7 md:w-9 md:h-9 text-orange-500" fill="currentColor">
          <path d="M12 2c0 0-5 4-5 10a5 5 0 0 0 10 0c0-6-5-10-5-10zm0 14a2 2 0 0 1-2-2c0-1.5 2-4 2-4s2 2.5 2 4a2 2 0 0 1-2 2z" />
        </svg>
      )
    },

  ];

  return (
    <div className="wrapper">
      <div className="w-full relative z-30 mx-auto pt-14 pb-16">
        <p className="text-center text-gray-500 dark:text-white/50 text-lg font-medium mb-12">
          Engineered with world-class AI & data infrastructure
        </p>
        <div className="w-full overflow-x-auto no-scrollbar pb-4">
          <div className="flex items-center justify-center gap-x-6 md:gap-x-10 opacity-70 hover:opacity-100 transition-opacity px-4 mx-auto w-max min-w-full">
            {techStack.map((tech, index) => (
              <div
                key={index}
                className="flex flex-shrink-0 items-center gap-2 group cursor-default grayscale hover:grayscale-0 transition-all duration-300"
              >
                {tech.logo}
                <span className="text-sm md:text-base font-semibold text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{tech.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
