import BenefitsGrid from '@/components/sections/benefits-grid';
import TestimonialsSection from '@/components/sections/client-testimonial';
import FaqAccordion from '@/components/sections/faq-accordion';
import HeroSection from '@/components/sections/hero-section';
import ToolsTab from '@/components/sections/tools-tab';
import { CoreFeatures } from '@/components/sections/core-features';
import ArchitectureSection from '@/components/sections/architecture-section';
import UseCasesSection from '@/components/sections/use-cases';
import CtaSection from '@/components/sections/cta-section';

export default async function Home() {
  return (
    <>
      <HeroSection />
      <ArchitectureSection />
      <CoreFeatures />
      <ToolsTab />
      <BenefitsGrid />
      <UseCasesSection />
      <TestimonialsSection />
      <FaqAccordion />
      <CtaSection />
    </>
  );
}