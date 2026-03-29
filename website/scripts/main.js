document.addEventListener("DOMContentLoaded", () => {
  // Intersection Observer for scroll animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

  // Mobile Menu Toggle
  const mobileToggle = document.querySelector('.mobile-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
      navLinks.style.flexDirection = 'column';
      navLinks.style.position = 'absolute';
      navLinks.style.top = '64px';
      navLinks.style.left = '0';
      navLinks.style.width = '100%';
      navLinks.style.background = 'rgba(8,12,16,0.95)';
      navLinks.style.padding = '2rem';
      navLinks.style.borderBottom = '1px solid rgba(124,58,237,0.12)';
    });
  }

  // FAQ Accordions
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const header = item.querySelector('.faq-header');
    if(header) {
      header.addEventListener('click', () => {
        item.classList.toggle('open');
        const content = item.querySelector('.faq-content');
        if (item.classList.contains('open')) {
          content.style.maxHeight = content.scrollHeight + 'px';
        } else {
          content.style.maxHeight = '0';
        }
      });
    }
  });

  // Copy to clipboard
  const copyBtns = document.querySelectorAll('.copy-btn');
  copyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-copy');
      navigator.clipboard.writeText(text).then(() => {
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Copied!';
        setTimeout(() => { btn.innerHTML = originalText; }, 2000);
      });
    });
  });

  // Hero Tab Switching
  const heroTabs = document.querySelectorAll('.hero-tab-btn');
  if (heroTabs.length > 0) {
    heroTabs.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const parentNav = e.target.closest('.hero-terminal-nav');
        if (!parentNav) return;
        
        // Remove active from all buttons in the nav
        parentNav.querySelectorAll('.hero-tab-btn').forEach(b => b.classList.remove('active'));
        
        // Find the adjacent .hero-terminal-body or equivalent
        const container = e.target.closest('.hero-terminal-wrapper').querySelector('.hero-terminal-body');
        container.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        
        // Set new active and display block
        e.target.classList.add('active');
        const targetId = e.target.getAttribute('data-target');
        const targetEl = document.getElementById(targetId);
        if(targetEl) targetEl.style.display = 'block';
      });
    });
  }

  // General Tab Switching (fallback)
  const tabBtns = document.querySelectorAll('.tab-btn');
  if(tabBtns.length > 0) {
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const parent = btn.parentElement.parentElement;
        parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        parent.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        
        btn.classList.add('active');
        const target = btn.getAttribute('data-target');
        const targetEl = document.getElementById(target);
        if(targetEl) targetEl.style.display = 'grid'; 
      });
    });
  }
});
