/**
 * ============================================
 * CINEMATIC PORTFOLIO — GLOBAL MAGNIFIER SYSTEM
 * ============================================
 * 
 * Features:
 * - Dual layer system (normal + magnified)
 * - Global magnifier effect across entire site
 * - Smooth lerp-based cursor tracking
 * - clip-path: circle() for lens reveal
 * - Color-shift zoom effect
 * - GPU-accelerated with will-change
 */


/**
 * ============================================
 * GLOBAL MAGNIFIER EFFECT
 * ============================================
 */

(function() {
    'use strict';

    // DOM Elements
    const magnifiedLayer = document.getElementById('magnifiedLayer');
    const magnifierLens = document.getElementById('magnifierLens');
    const normalLayer = document.getElementById('normalLayer');

    if (!magnifiedLayer || !magnifierLens) {
        console.warn('Magnifier elements not found');
        return;
    }

    // Configuration
    const config = {
        lerpFactor: 0.12, // Smooth interpolation (lower = smoother, slower)
        magnifierRadius: 100, // Radius of clip-path circle (half of CSS size)
        magnificationScale: 1.5 // Scale factor for magnified content
    };

    // State
    const state = {
        mouseX: 0,
        mouseY: 0,
        currentX: 0,
        currentY: 0,
        isActive: false,
        rafId: null
    };

    /**
     * Linear interpolation for smooth values
     */
    function lerp(start, end, factor) {
        return start + (end - start) * factor;
    }

    /**
     * Get responsive magnifier size from CSS
     */
    function getMagnifierSize() {
        const computedStyle = getComputedStyle(document.documentElement);
        const size = computedStyle.getPropertyValue('--magnifier-size');
        return parseInt(size) || 200;
    }

    /**
     * Update magnifier position and clip-path
     */
    function updateMagnifier() {
        // Smooth interpolation towards target position
        state.currentX = lerp(state.currentX, state.mouseX, config.lerpFactor);
        state.currentY = lerp(state.currentY, state.mouseY, config.lerpFactor);

        // Get responsive magnifier size
        const magnifierSize = getMagnifierSize();
        const magnifierRadius = magnifierSize / 2;
        const scale = config.magnificationScale;

        // Current scroll position
        const scrollY = window.scrollY;

        // Calculate lens position (centered on cursor)
        const lensX = state.currentX - magnifierRadius;
        const lensY = state.currentY - magnifierRadius;

        // Position the glass lens element
        magnifierLens.style.left = `${lensX}px`;
        magnifierLens.style.top = `${lensY}px`;

        // Update clip-path on magnified layer (viewport coordinates)
        magnifiedLayer.style.clipPath = `circle(${magnifierRadius}px at ${state.currentX}px ${state.currentY}px)`;

        /**
         * Transform calculation for magnified layer:
         * 
         * The magnified layer is position:fixed and covers the viewport.
         * We need to:
         * 1. Translate content UP by scrollY so it aligns with the scrolled normal layer
         * 2. Scale from the cursor point so zoomed content appears under the cursor
         * 
         * To scale from cursor point (cx, cy) by factor S:
         *   translateX = cx - (cx * S) = cx * (1 - S)
         *   translateY = (cy + scrollY) - ((cy + scrollY) * S) = (cy + scrollY) * (1 - S)
         * 
         * Then we subtract scrollY from the final Y to account for the fixed positioning
         */

        // Document coordinates of cursor (where in the full page)
        const docX = state.currentX;
        const docY = state.currentY + scrollY;

        // Scale offset: how much to translate so scaling happens from cursor point
        const offsetX = docX * (1 - scale);
        const offsetY = docY * (1 - scale);

        // Final transform: offsetY - scrollY brings it back to viewport coordinates
        magnifiedLayer.style.transform = `translate3d(${offsetX}px, ${offsetY - scrollY}px, 0) scale(${scale})`;
        magnifiedLayer.style.transformOrigin = '0 0';

        // Continue animation loop
        if (state.isActive) {
            state.rafId = requestAnimationFrame(updateMagnifier);
        }
    }

    /**
     * Handle mouse movement - GLOBAL (document level)
     */
    function handleMouseMove(e) {
        state.mouseX = e.clientX;
        state.mouseY = e.clientY;

        if (!state.isActive) {
            state.isActive = true;
            // Initialize position immediately to avoid jump from origin
            state.currentX = state.mouseX;
            state.currentY = state.mouseY;

            magnifierLens.classList.add('active');

            if (state.rafId) cancelAnimationFrame(state.rafId);
            state.rafId = requestAnimationFrame(updateMagnifier);
        }
    }

    /**
     * Handle mouse entering the document
     */
    function handleMouseEnter(e) {
        state.isActive = true;
        state.mouseX = e.clientX;
        state.mouseY = e.clientY;

        // Initialize position immediately to avoid jump
        state.currentX = state.mouseX;
        state.currentY = state.mouseY;

        magnifierLens.classList.add('active');

        if (state.rafId) cancelAnimationFrame(state.rafId);
        state.rafId = requestAnimationFrame(updateMagnifier);
    }

    /**
     * Handle mouse leaving the document
     */
    function handleMouseLeave() {
        state.isActive = false;
        magnifierLens.classList.remove('active');

        // Reset clip-path to hide magnified layer
        magnifiedLayer.style.clipPath = 'circle(0px at 0px 0px)';

        if (state.rafId) {
            cancelAnimationFrame(state.rafId);
            state.rafId = null;
        }
    }

    /**
     * Handle window resize
     */
    function handleResize() {
        // Update magnifier radius from CSS
        const magnifierSize = getMagnifierSize();
        config.magnifierRadius = magnifierSize / 2;
    }

    /**
     * Initialize magnifier effect
     */
    function init() {
        // Get initial magnifier size
        handleResize();

        // GLOBAL event listeners - works across entire website
        document.addEventListener('mousemove', handleMouseMove, { passive: true });
        document.addEventListener('mouseenter', handleMouseEnter);
        document.addEventListener('mouseleave', handleMouseLeave);
        window.addEventListener('resize', handleResize, { passive: true });

        console.log('🔍 Global magnifier initialized');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();


/**
 * ============================================
 * SCROLL ANIMATIONS & PARALLAX
 * ============================================
 */

(function() {
    'use strict';

    const CONFIG = {
        lerpFactor: 0.08,
        parallaxIntensity: 1,
        revealThreshold: 0.15,
        revealRootMargin: '-50px'
    };

    const state = {
        scrollY: 0,
        targetScrollY: 0,
        parallaxElements: [],
        isAnimating: false,
        rafId: null
    };

    /**
     * Linear interpolation
     */
    function lerp(start, end, factor) {
        return start + (end - start) * factor;
    }

    /**
     * Check if element is in viewport
     */
    function isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
    }

    /**
     * Initialize reveal animations with IntersectionObserver
     */
    function initRevealAnimations() {
        const revealElements = document.querySelectorAll('.site-layer--normal [data-reveal]');

        if (!revealElements.length) return;

        const observerOptions = {
            root: null,
            rootMargin: CONFIG.revealRootMargin,
            threshold: CONFIG.revealThreshold
        };

        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const siblings = entry.target.parentElement.querySelectorAll('[data-reveal]');
                    const index = Array.from(siblings).indexOf(entry.target);
                    const delay = index * 100;

                    setTimeout(() => {
                        entry.target.classList.add('visible');
                    }, delay);

                    revealObserver.unobserve(entry.target);
                }
            });
        }, observerOptions);

        revealElements.forEach(element => {
            revealObserver.observe(element);
        });
    }

    /**
     * Initialize parallax elements
     */
    function initParallax() {
        const parallaxElements = document.querySelectorAll('.site-layer--normal [data-parallax]');

        if (!parallaxElements.length) return;

        parallaxElements.forEach(element => {
            const intensity = parseFloat(element.dataset.parallax) || 0.05;
            state.parallaxElements.push({
                element,
                intensity,
                currentY: 0,
                targetY: 0
            });
        });

        startAnimationLoop();
    }

    /**
     * Calculate parallax offset
     */
    function calculateParallaxOffset(element, intensity) {
        const rect = element.getBoundingClientRect();
        const elementCenter = rect.top + rect.height / 2;
        const viewportCenter = window.innerHeight / 2;
        const distance = elementCenter - viewportCenter;

        return distance * intensity * CONFIG.parallaxIntensity;
    }

    /**
     * Update parallax elements
     */
    function updateParallax() {
        state.parallaxElements.forEach(item => {
            if (!isInViewport(item.element)) return;

            item.targetY = calculateParallaxOffset(item.element, item.intensity);
            item.currentY = lerp(item.currentY, item.targetY, CONFIG.lerpFactor);
            item.element.style.transform = `translate3d(0, ${item.currentY}px, 0)`;
        });
    }

    /**
     * Start animation loop
     */
    function startAnimationLoop() {
        if (state.isAnimating) return;
        state.isAnimating = true;
        animate();
    }

    /**
     * Animation loop
     */
    function animate() {
        state.scrollY = lerp(state.scrollY, state.targetScrollY, CONFIG.lerpFactor);
        updateParallax();
        state.rafId = requestAnimationFrame(animate);
    }

    /**
     * Handle scroll
     */
    function handleScroll() {
        state.targetScrollY = window.scrollY;
    }

    /**
     * Initialize contact form
     */
    function initContactForm() {
        const form = document.getElementById('contactForm');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const button = form.querySelector('.submit-btn');
            const buttonText = button.querySelector('span');
            const originalText = buttonText.textContent;

            button.disabled = true;
            buttonText.textContent = 'Sending...';

            setTimeout(() => {
                buttonText.textContent = 'Sent!';
                button.style.background = 'var(--color-accent)';

                setTimeout(() => {
                    buttonText.textContent = originalText;
                    button.style.background = '';
                    button.disabled = false;
                    form.reset();
                }, 2500);
            }, 1500);
        });
    }

    /**
     * Initialize smooth scroll links
     */
    function initSmoothScroll() {
        const links = document.querySelectorAll('a[href^="#"]');

        links.forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href === '#') return;

                const target = document.querySelector(href);
                if (!target) return;

                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            });
        });
    }

    /**
     * Initialize hero glow subtle movement
     */
    function initHeroGlow() {
        const heroGlow = document.querySelector('.site-layer--normal .hero-glow');
        const hero = document.querySelector('.site-layer--normal .hero');

        if (!heroGlow || !hero) return;

        let glowX = 0;
        let glowY = 0;
        let targetX = 0;
        let targetY = 0;

        hero.addEventListener('mousemove', (e) => {
            const rect = hero.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            targetX = ((e.clientX - rect.left - centerX) / centerX) * 10;
            targetY = ((e.clientY - rect.top - centerY) / centerY) * 15;
        }, { passive: true });

        function animateGlow() {
            glowX = lerp(glowX, targetX, 0.03);
            glowY = lerp(glowY, targetY, 0.03);

            heroGlow.style.transform = `translate(calc(-50% + ${glowX}px), calc(-50% + ${glowY}px))`;

            requestAnimationFrame(animateGlow);
        }

        animateGlow();
    }

    /**
     * Main initialization
     */
    function init() {
        initRevealAnimations();
        initParallax();
        initContactForm();
        initSmoothScroll();
        initHeroGlow();

        window.addEventListener('scroll', handleScroll, { passive: true });

        state.targetScrollY = window.scrollY;
        state.scrollY = window.scrollY;

        window.addEventListener('resize', () => {
            state.parallaxElements.forEach(item => {
                item.currentY = 0;
                item.targetY = 0;
            });
        }, { passive: true });

        console.log('✨ Portfolio animations initialized');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();