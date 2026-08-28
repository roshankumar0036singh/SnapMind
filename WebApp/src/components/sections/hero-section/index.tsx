import Link from 'next/link';
import Image from 'next/image';
import HeroLogos from '../hero-logos';
import { Subheading } from './subheading';
import { IntroVideo } from './intro-video';
import HeroGraphic from './hero-graphic';

export default function HeroSection() {
  return (
    <section className="pt-16 relative overflow-hidden dark:bg-[#171F2E]">
      <div className="max-w-[120rem] mx-auto relative">
        <div className="wrapper">
          <div className="max-w-[800px] mx-auto">
            <div className="text-center pb-8">
              <Subheading text="AI-Driven Knowledge Management" />

              <h1 className="text-gray-700 mx-auto font-bold mb-4 text-4xl sm:text-[50px] dark:text-white/90 sm:leading-[64px] max-w-[700px]">
                Empower Your Workflow with SnapMind Intelligence
              </h1>
              <p className="max-w-[537px] text-center mx-auto dark:text-gray-400 text-gray-500 text-base">
                Unleash the Power of AI to Organize Your Knowledge, Streamline Your
                Workflow, and Redefine Success for Your Team.
              </p>

              <div className="mt-9 flex sm:flex-row flex-col gap-3 relative z-30 items-center justify-center">
                <Link
                  href="/signin"
                  className="bg-primary-500 transition h-12 inline-flex items-center justify-center hover:bg-primary-600 px-6 py-3 rounded-full text-white text-sm"
                >
                  Explore app
                </Link>

                <IntroVideo />
              </div>
            </div>
          </div>
          <div className="max-w-[1000px] mx-auto relative mt-6 md:mt-8">
            <div className="p-3 sm:p-[18px] relative z-30 rounded-[32px] border border-white/30 dark:border-white/10 bg-white/20 backdrop-blur-sm">
              <Image 
                src="/images/hero/hero-image-new.jpg"
                alt="SnapMind Dashboard"
                width={1920}
                height={1080}
                className="w-full rounded-2xl shadow-2xl border border-gray-200/20 dark:border-white/10 object-cover"
                priority
              />
            </div>
            <div className="absolute hidden lg:block z-10 -top-20 -translate-y-20 left-1/2 -translate-x-1/2 pointer-events-none">
              <svg
                width="1300"
                height="1001"
                viewBox="0 0 1300 1001"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g opacity="0.7" filter="url(#filter0_f_9279_7148)">
                  <circle cx="800" cy="500.03" r="300" fill="#4E6EFF" />
                </g>
                <g opacity="0.3" filter="url(#filter1_f_9279_7148)">
                  <circle cx="500" cy="500.03" r="300" fill="#FF58D5" />
                </g>
                <defs>
                  <filter
                    id="filter0_f_9279_7148"
                    x="300"
                    y="0.029541"
                    width="1000"
                    height="1000"
                    filterUnits="userSpaceOnUse"
                    colorInterpolationFilters="sRGB"
                  >
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend
                      mode="normal"
                      in="SourceGraphic"
                      in2="BackgroundImageFix"
                      result="shape"
                    />
                    <feGaussianBlur
                      stdDeviation="100"
                      result="effect1_foregroundBlur_9279_7148"
                    />
                  </filter>
                  <filter
                    id="filter1_f_9279_7148"
                    x="0"
                    y="0.029541"
                    width="1000"
                    height="1000"
                    filterUnits="userSpaceOnUse"
                    colorInterpolationFilters="sRGB"
                  >
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend
                      mode="normal"
                      in="SourceGraphic"
                      in2="BackgroundImageFix"
                      result="shape"
                    />
                    <feGaussianBlur
                      stdDeviation="100"
                      result="effect1_foregroundBlur_9279_7148"
                    />
                  </filter>
                </defs>
              </svg>
            </div>
          </div>
        </div>

        <div className="max-[1100px]:hidden">
          <Image
            src="/images/hero/shape-left-1.svg?v=2"
            className="absolute top-14 left-16 floating-1"
            alt=""
            width={194}
            height={53}
          />
          <Image
            src="/images/hero/shape-left-2.svg?v=2"
            className="absolute left-[145px] top-[298px] floating-2 max-[1240px]:left-[80px]"
            alt=""
            width={210}
            height={53}
          />
          <Image
            src="/images/hero/shape-right-1.svg?v=1"
            className="absolute right-16 top-[108px] floating-3"
            alt=""
            width={205}
            height={52}
          />
          <Image
            src="/images/hero/shape-right-2.svg?v=2"
            className="absolute top-[316px] right-[200px] floating-4 max-[1240px]:right-[80px] max-[1350px]:right-[150px] max-[1500px]:right-[200px]"
            alt=""
            width={202}
            height={52}
          />
        </div>
      </div>
      <div className="hero-glow-bg pointer-events-none w-full h-167.5 absolute z-10 bottom-0"></div>
      <HeroLogos />
    </section>
  );
}
