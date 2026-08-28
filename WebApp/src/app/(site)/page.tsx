import BenefitsGrid from '@/components/sections/benefits-grid';
import TestimonialsSection from '@/components/sections/client-testimonial';
import FaqAccordion from '@/components/sections/faq-accordion';
import HeroSection from '@/components/sections/hero-section';
import ToolsTab from '@/components/sections/tools-tab';
import { CoreFeatures } from '@/components/sections/core-features';
import ArchitectureSection from '@/components/sections/architecture-section';
import UseCasesSection from '@/components/sections/use-cases';
import CtaSection from '@/components/sections/cta-section';

import { ScrollReveal } from '@/components/ui/scroll-reveal';

export default async function Home() {
  return (
    <>
      <ScrollReveal>
        <HeroSection />
      </ScrollReveal>
      
      <ScrollReveal delay={0.1}>
        <ArchitectureSection />
      </ScrollReveal>
      
      <ScrollReveal delay={0.1}>
        <CoreFeatures />
      </ScrollReveal>
      
      <ScrollReveal delay={0.1}>
        <ToolsTab />
      </ScrollReveal>
      
      <ScrollReveal delay={0.1}>
        <BenefitsGrid />
      </ScrollReveal>
      
      <ScrollReveal delay={0.1}>
        <UseCasesSection />
      </ScrollReveal>
      
      <ScrollReveal delay={0.1}>
        <TestimonialsSection />
      </ScrollReveal>
      
      <ScrollReveal delay={0.1}>
        <FaqAccordion />
      </ScrollReveal>
      
      <ScrollReveal delay={0.1}>
        <CtaSection />
      </ScrollReveal>
    </>
  );
}