import { getCurrentYear } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { PlayCircle, BookOpen, MessageCircle } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-gray-900">
      <span className="absolute top-0 -translate-x-1/2 left-1/2">
        <svg
          width="1260"
          height="457"
          viewBox="0 0 1260 457"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g filter="url(#filter0_f_11105_867)">
            <circle cx="630" cy="-173.299" r="230" fill="#3B2EFF" />
          </g>
          <defs>
            <filter
              id="filter0_f_11105_867"
              x="0"
              y="-803.299"
              width="1260"
              height="1260"
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
                stdDeviation="200"
                result="effect1_foregroundBlur_11105_867"
              />
            </filter>
          </defs>
        </svg>
      </span>
      <div className="relative z-10 py-16 xl:py-24">
        <div className="container px-5 mx-auto sm:px-7">
          <div className="grid gap-y-8 gap-x-6 lg:grid-cols-12">
            <div className="lg:col-span-3 xl:col-span-4">
              <div>
                <Link href="/" className="block mb-6">
                  <Image
                    src="/images/logo-transparent.png"
                    alt="SnapMind logo"
                    className="object-contain h-12 w-auto"
                    width={140}
                    height={85}
                  />
                </Link>
                <p className="block text-sm text-gray-400 mb-9">
                  SnapMind is the most powerful AI-driven platform for knowledge management and workflow optimization. Unleash the power of artificial intelligence to streamline your tasks.
                </p>
                <div className="flex gap-4">
                  <a
                    href="https://github.com/roshankumar0036singh/SnapMind"
                    target="_blank"
                    className="text-gray-400 hover:text-white/80 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 16 17"
                      fill="none"
                    >
                      <g clipPath="url(#clip0_11105_885)">
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M8.00009 1.25293C6.10091 1.25392 4.264 1.92657 2.81783 3.15061C1.37166 4.37465 0.410521 6.07027 0.106282 7.93426C-0.197957 9.79825 0.174536 11.7091 1.15717 13.325C2.13979 14.941 3.66848 16.1568 5.46987 16.7549C5.86729 16.8287 6.01698 16.5824 6.01698 16.3729C6.01698 16.1635 6.00903 15.5563 6.00638 14.8924C3.78085 15.3732 3.31057 13.9533 3.31057 13.9533C2.9476 13.0312 2.42301 12.7889 2.42301 12.7889C1.69706 12.2962 2.47733 12.3054 2.47733 12.3054C3.28143 12.3621 3.70402 13.1261 3.70402 13.1261C4.41672 14.3418 5.57585 13.9901 6.03155 13.7847C6.10309 13.2696 6.31107 12.9193 6.54025 12.7204C4.76247 12.5202 2.89461 11.8378 2.89461 8.78988C2.88359 7.9994 3.1786 7.23496 3.71859 6.65472C3.63646 6.4545 3.36224 5.64575 3.79675 4.54722C3.79675 4.54722 4.46839 4.33383 5.99712 5.36256C7.30836 5.00601 8.69183 5.00601 10.0031 5.36256C11.5305 4.33383 12.2008 4.54722 12.2008 4.54722C12.6366 5.64312 12.3624 6.45187 12.2803 6.65472C12.822 7.23506 13.1176 8.00083 13.1056 8.79251C13.1056 11.8471 11.2337 12.5202 9.45331 12.7164C9.73945 12.964 9.99512 13.4475 9.99512 14.1903C9.99512 15.2546 9.98585 16.1108 9.98585 16.3729C9.98585 16.585 10.1302 16.8326 10.5356 16.7549C12.3372 16.1567 13.866 14.9407 14.8487 13.3245C15.8313 11.7082 16.2036 9.79713 15.899 7.93296C15.5944 6.0688 14.6328 4.37317 13.1861 3.14933C11.7395 1.9255 9.90215 1.25329 8.00274 1.25293H8.00009Z"
                          fill="currentColor"
                        />
                        <path
                          d="M3.02954 12.6743C3.01232 12.7139 2.94873 12.7257 2.89707 12.6981C2.84541 12.6704 2.80699 12.619 2.82554 12.5782C2.84408 12.5374 2.90635 12.5268 2.95801 12.5545C3.00967 12.5821 3.04941 12.6348 3.02954 12.6743Z"
                          fill="currentColor"
                        />
                        <path
                          d="M3.35423 13.0339C3.3268 13.0476 3.29541 13.0514 3.26545 13.0447C3.23548 13.038 3.2088 13.0211 3.18997 12.997C3.13831 12.9417 3.1277 12.8653 3.16744 12.831C3.20719 12.7968 3.27873 12.8126 3.33039 12.8679C3.38205 12.9232 3.39398 12.9996 3.35423 13.0339Z"
                          fill="currentColor"
                        />
                        <path
                          d="M3.66958 13.4908C3.62056 13.525 3.5371 13.4908 3.49074 13.4223C3.47791 13.41 3.46772 13.3953 3.46075 13.379C3.45379 13.3627 3.4502 13.3452 3.4502 13.3275C3.4502 13.3098 3.45379 13.2922 3.46075 13.2759C3.46772 13.2596 3.47791 13.2449 3.49074 13.2326C3.53975 13.1997 3.62321 13.2326 3.66958 13.2998C3.71594 13.367 3.71727 13.4565 3.66958 13.4908Z"
                          fill="currentColor"
                        />
                        <path
                          d="M4.09725 13.9334C4.05353 13.9822 3.96478 13.969 3.89192 13.9031C3.81906 13.8373 3.80183 13.7477 3.84555 13.7003C3.88926 13.6529 3.97802 13.666 4.05353 13.7306C4.12904 13.7951 4.14361 13.886 4.09725 13.9334Z"
                          fill="currentColor"
                        />
                        <path
                          d="M4.69753 14.1917C4.67766 14.2536 4.58758 14.2813 4.4975 14.2549C4.40742 14.2286 4.3478 14.1548 4.36502 14.0916C4.38225 14.0284 4.47365 13.9994 4.56506 14.0284C4.65646 14.0573 4.71475 14.1271 4.69753 14.1917Z"
                          fill="currentColor"
                        />
                        <path
                          d="M5.35189 14.2361C5.35189 14.3006 5.27771 14.3559 5.18233 14.3572C5.08695 14.3586 5.00879 14.3059 5.00879 14.2413C5.00879 14.1768 5.08297 14.1215 5.17835 14.1201C5.27373 14.1188 5.35189 14.1702 5.35189 14.2361Z"
                          fill="currentColor"
                        />
                        <path
                          d="M5.96118 14.1349C5.9731 14.1994 5.90687 14.2666 5.81149 14.2824C5.71611 14.2982 5.63265 14.26 5.62073 14.1968C5.60881 14.1336 5.67769 14.0651 5.77042 14.0479C5.86315 14.0308 5.94926 14.0703 5.96118 14.1349Z"
                          fill="currentColor"
                        />
                      </g>
                      <defs>
                        <clipPath id="clip0_11105_885">
                          <rect
                            width="16"
                            height="16"
                            fill="currentColor"
                            transform="translate(0 0.919434)"
                          />
                        </clipPath>
                      </defs>
                    </svg>
                  </a>
                  <a
                    href="https://medium.com/@roshankumar00036/i-built-an-ai-that-remembers-everything-i-research-meet-snapmind-7834806ceb20"
                    target="_blank"
                    className="text-gray-400 hover:text-white/80 transition-colors"
                  >
                    <BookOpen size={20} />
                  </a>
                  <a
                    href="https://www.reddit.com/r/lingodotdev/comments/1rvhvz0/snapmind_an_ai_powered_rag_based_comprehensive/"
                    target="_blank"
                    className="text-gray-400 hover:text-white/80 transition-colors"
                  >
                    <MessageCircle size={20} />
                  </a>
                  <a
                    href="https://youtu.be/nNg8kVpigPU"
                    target="_blank"
                    className="text-gray-400 hover:text-white/80 transition-colors"
                  >
                    <PlayCircle size={22} />
                  </a>
                </div>
              </div>
            </div>
            <div className="lg:col-span-6 xl:col-span-5">
              <div className="grid sm:grid-cols-3 gap-7">
                <div>
                  <span className="block mb-6 text-sm text-gray-400">
                    Services
                  </span>
                  <nav className="flex flex-col space-y-3">
                    <Link
                      href="/"
                      className="text-sm font-normal text-gray-400 transition hover:text-white"
                    >
                      Status
                    </Link>
                    <Link
                      href="/pricing"
                      className="text-sm font-normal text-gray-400 transition hover:text-white hidden"
                    >
                      Pricing
                    </Link>
                    <Link
                      href="/pricing#faq"
                      className="text-sm font-normal text-gray-400 transition hover:text-white"
                    >
                      FAQ
                    </Link>
                    <Link
                      href="/contact"
                      className="text-sm font-normal text-gray-400 transition hover:text-white"
                    >
                      Help Docs
                    </Link>
                    <Link
                      href="/privacy"
                      className="text-sm font-normal text-gray-400 transition hover:text-white"
                    >
                      Privacy Policy
                    </Link>
                  </nav>
                </div>
                <div>
                  <span className="block mb-6 text-sm text-gray-400">
                    Features
                  </span>
                  <nav className="flex flex-col space-y-3">
                    <Link
                      href="/#architecture"
                      className="text-sm font-normal text-gray-400 transition hover:text-white"
                    >
                      GraphRAG Engine
                    </Link>
                    <Link
                      href="/#architecture"
                      className="text-sm font-normal text-gray-400 transition hover:text-white"
                    >
                      YouTube Transcript Parsing
                    </Link>
                    <Link
                      href="/#architecture"
                      className="text-sm font-normal text-gray-400 transition hover:text-white"
                    >
                      GitHub Repo Syncing
                    </Link>
                    <Link
                      href="/#architecture"
                      className="text-sm font-normal text-gray-400 transition hover:text-white"
                    >
                      Multi-model Chat
                    </Link>
                    <Link
                      href="/extension"
                      className="text-sm font-normal text-gray-400 transition hover:text-white"
                    >
                      Chrome Extension
                    </Link>
                  </nav>
                </div>
                <div>
                  <span className="relative block mb-6 text-sm text-gray-400">
                    Account
                  </span>
                  <nav className="flex flex-col space-y-3">
                    <Link
                      href="/signin"
                      className="text-sm font-normal text-gray-400 transition hover:text-white"
                    >
                      Login
                    </Link>
                    <Link
                      href="/signin"
                      className="text-sm font-normal text-gray-400 transition hover:text-white"
                    >
                      Sign Up
                    </Link>

                    <Link
                      href="/contact"
                      className="text-sm font-normal text-gray-400 transition hover:text-white"
                    >
                      Support
                    </Link>
                  </nav>
                </div>
              </div>
            </div>
            <div className="lg:col-span-3">
              <div>
                <span className="block mb-6 text-sm text-gray-400">
                  Stay In Touch
                </span>
                <p className="block mb-5 text-sm text-gray-400">
                  Subscribe now for exclusive insights and offers!
                </p>
                <form>
                  <div className="flex flex-col items-center gap-2 w-full sm:max-w-64">
                    <input
                      type="email"
                      placeholder="Enter your email"
                      className="w-full h-12 p-4 text-sm text-white border border-gray-700 rounded-full placeholder:text-center placeholder:text-gray-400 placeholder:text-sm text-center placeholder:font-normal focus:outline-0"
                      required
                    />
                    <button className="w-full px-6 py-3 text-sm font-medium text-white transition rounded-full cursor-pointer bg-primary-500 hover:bg-primary-600">
                      Subscribe Now
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-800">
        <div className="container relative z-10 px-5 mx-auto sm:px-7">
          <div className="py-5 text-center">
            <p className="text-sm text-gray-500">
              &copy; {getCurrentYear()} SnapMind - All Rights Reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
