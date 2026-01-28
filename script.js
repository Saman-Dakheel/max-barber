console.log('Max Barber script loaded');

// Mobile Menu Toggle
const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
const nav = document.querySelector('.nav');

if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
        nav.classList.toggle('active');
    });
}

// Close menu when clicking a link
const navLinks = document.querySelectorAll('.nav-link');
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        if (nav.classList.contains('active')) {
            nav.classList.remove('active');
        }
    });
});

// Active Link Highlighting on Scroll
const sections = document.querySelectorAll('section');

const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.3 // Trigger when 30% of the section is visible
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            // Remove active class from all links
            navLinks.forEach(link => link.classList.remove('active'));
            // Add active class to the corresponding link
            const activeLink = document.querySelector(`.nav-link[href="#${id}"]`);
            if (activeLink) {
                activeLink.classList.add('active');
            }
        }
    });
}, observerOptions);

sections.forEach(section => {
    observer.observe(section);
});

// Header Scroll Effect - Removed to keep Vintage Theme consistent
// const header = document.querySelector('.header');
// window.addEventListener('scroll', () => { ... });

// Smooth Scroll for anchor links (if browser doesn't support scroll-behavior: smooth in CSS)
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth'
            });

            // Manually set active class on click to prevent delay
            navLinks.forEach(link => link.classList.remove('active'));
            this.classList.add('active');

            // Close mobile menu if open
            if (nav.classList.contains('active')) {
                nav.classList.remove('active');
            }
        }
    });
});
// Initialize Page Data
async function init() {
    loadTestimonials();
    loadServices();
    loadGallery();

    // Time restriction logic
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');

    if (dateInput && timeInput) {
        dateInput.addEventListener('change', () => {
            const selectedDate = new Date(dateInput.value);
            const day = selectedDate.getUTCDay(); // 0 = Sunday, 6 = Saturday

            if (day >= 1 && day <= 5) {
                // Monday - Friday: 8am to 6pm
                timeInput.min = "08:00";
                timeInput.max = "18:00";
            } else {
                // Saturday - Sunday: 9am to 4pm
                timeInput.min = "09:00";
                timeInput.max = "16:00";
            }
        });
    }
}

async function loadServices() {
    try {
        const response = await fetch('/api/services');
        const services = await response.json();
        const grid = document.querySelector('.services-grid');
        const serviceSelect = document.getElementById('service');

        if (services.length > 0) {
            grid.innerHTML = '';
            if (serviceSelect) {
                serviceSelect.innerHTML = '<option value="" disabled selected>Select a Service</option>';
            }

            services.forEach(s => {
                const card = document.createElement('div');
                card.className = 'service-card';
                card.innerHTML = `
                    <div class="service-img">
                        <img src="assets/service_haircut.png" alt="${s.name}">
                    </div>
                    <div class="service-info">
                        <h3>${s.name}</h3>
                        <p class="service-desc">${s.desc}</p>
                        <span class="price">${s.price}</span>
                    </div>
                `;
                grid.appendChild(card);

                if (serviceSelect) {
                    const opt = document.createElement('option');
                    opt.value = s.name.toLowerCase();
                    opt.textContent = `${s.name} - ${s.price}`;
                    serviceSelect.appendChild(opt);
                }
            });
        }
    } catch (err) { console.error('Failed to load services:', err); }
}

async function loadGallery() {
    try {
        const response = await fetch('/api/gallery');
        const gallery = await response.json();
        const grid = document.querySelector('.gallery-grid');

        if (gallery.length > 0) {
            grid.innerHTML = '';
            gallery.forEach(g => {
                const item = document.createElement('div');
                item.className = 'gallery-item';
                item.innerHTML = `<img src="${g.url}" alt="Work">`;
                grid.appendChild(item);

                // Re-bind lightbox event for new images
                item.querySelector('img').addEventListener('click', () => {
                    const lightboxImg = document.querySelector('#lightbox img');
                    const lightbox = document.getElementById('lightbox');
                    lightboxImg.setAttribute('src', g.url);
                    lightbox.style.display = 'flex';
                    setTimeout(() => lightbox.classList.add('active'), 10);
                    document.body.style.overflow = 'hidden';
                });
            });
        }
    } catch (err) { console.error('Failed to load gallery:', err); }
}

async function loadTestimonials() {
    try {
        const response = await fetch('/api/testimonials');
        const data = await response.json();
        // Clear static grid if elements were added by JS
        // (Existing grid is in HTML, we will prepend backend ones)
        data.forEach(t => renderTestimonial(t));
    } catch (err) {
        console.error('Failed to load testimonials:', err);
    }
}

function renderTestimonial(t) {
    const testimonialsGrid = document.querySelector('.testimonials-grid');
    if (!testimonialsGrid) return;

    const newCard = document.createElement('div');
    newCard.className = 'testimonial-card';
    newCard.innerHTML = `
        <p class="testimonial-text">"${t.story}"</p>
        <div class="testimonial-author">
            <div class="author-avatar">
                <img src="assets/logo.png" alt="Guest" style="filter: grayscale(100%);"> 
            </div>
            <div class="author-info">
                <h4>${t.name}</h4>
                <span>${t.role}</span>
            </div>
        </div>
    `;
    testimonialsGrid.prepend(newCard);
}

// Booking Form Logic
const bookingForm = document.querySelector('.booking-form');
if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('name').value;
        const email = document.getElementById('email') ? document.getElementById('email').value : '';
        const phone = document.getElementById('phone') ? document.getElementById('phone').value : '';
        const date = document.getElementById('date').value;
        const time = document.getElementById('time').value;
        const service = document.getElementById('service').value;
        const notes = document.getElementById('notes') ? document.getElementById('notes').value : '';

        if (!name || !date || !time || !service) {
            showFormMessage('Please fill in all required fields.', 'error', bookingForm);
            return;
        }

        const submitBtn = bookingForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerText;
        submitBtn.innerText = 'Booking...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, phone, date, time, service, notes })
            });

            if (response.ok) {
                bookingForm.reset();
                showFormMessage(`Appointment confirmed for ${name}. We will contact you shortly!`, 'success', bookingForm);
            } else if (response.status === 409) {
                const errData = await response.json();
                showFormMessage(errData.error || 'This time slot is already taken.', 'error', bookingForm);
            } else {
                throw new Error('Server error');
            }
        } catch (err) {
            showFormMessage('Failed to save booking. Please try again.', 'error', bookingForm);
        } finally {
            submitBtn.innerText = originalBtnText;
            submitBtn.disabled = false;
        }
    });
}

function showFormMessage(message, type, formElement) {
    let msgEl = formElement.querySelector('.form-message');
    if (!msgEl) {
        msgEl = document.createElement('div');
        msgEl.className = 'form-message';
        const submitBtn = formElement.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.parentNode.insertBefore(msgEl, submitBtn.nextSibling);
        }
    }

    msgEl.innerText = message;
    msgEl.className = `form-message ${type}`;
    msgEl.style.display = 'block';

    if (type === 'success') {
        setTimeout(() => {
            msgEl.style.display = 'none';
        }, 5000);
    }
}

init();

// Lightbox Logic
const galleryItems = document.querySelectorAll('.gallery-item img');
const body = document.body;

// Select existing Lightbox
const lightbox = document.getElementById('lightbox');

const lightboxImg = lightbox.querySelector('img');
const lightboxClose = lightbox.querySelector('.lightbox-close');

galleryItems.forEach(item => {
    item.addEventListener('click', () => {
        const imgSrc = item.getAttribute('src');
        lightboxImg.setAttribute('src', imgSrc);

        // Remove inline display:none and allow CSS to handle flex
        lightbox.style.display = 'flex';
        // Small delay to allow display change to register before adding opacity class for transition
        setTimeout(() => {
            lightbox.classList.add('active');
        }, 10);

        body.style.overflow = 'hidden'; // Prevent scrolling
    });
});

function closeLightbox() {
    lightbox.classList.remove('active');

    // Wait for transition to finish before hiding
    setTimeout(() => {
        lightbox.style.display = 'none';
        body.style.overflow = 'auto'; // Restore scrolling
    }, 300); // Matches CSS transition time
}

if (lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
}

lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
        closeLightbox();
    }
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
        closeLightbox();
    }
});

// Read More Button Logic
const readMoreBtn = document.getElementById('read-more-btn');
const moreText = document.querySelector('.more-text');

if (readMoreBtn && moreText) {
    readMoreBtn.addEventListener('click', () => {
        moreText.classList.toggle('visible');
        if (moreText.classList.contains('visible')) {
            readMoreBtn.innerText = 'Read Less';
        } else {
            readMoreBtn.innerText = 'Read Our Story';
        }
    });
}

// Client Story Logic
const addStoryBtn = document.getElementById('add-story-btn');
const storyModal = document.getElementById('story-modal');
const closeModal = document.querySelector('.close-modal');
const storyForm = document.getElementById('story-form');

if (addStoryBtn && storyModal) {
    // Open Modal
    addStoryBtn.addEventListener('click', () => {
        storyModal.style.display = 'flex';
        setTimeout(() => {
            storyModal.classList.add('active');
        }, 10);
        document.body.style.overflow = 'hidden';
    });

    // Close Modal Function
    const closeStoryModal = () => {
        storyModal.classList.remove('active');
        setTimeout(() => {
            storyModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300);
    };

    if (closeModal) {
        closeModal.addEventListener('click', closeStoryModal);
    }

    // Close on Outside Click
    storyModal.addEventListener('click', (e) => {
        if (e.target === storyModal) {
            closeStoryModal();
        }
    });

    // Handle Form Submission
    if (storyForm) {
        storyForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('client-name').value;
            const role = document.getElementById('client-role').value || 'Client';
            const story = document.getElementById('client-story').value;

            if (name && story) {
                const submitBtn = storyForm.querySelector('button[type="submit"]');
                const originalBtnText = submitBtn.innerText;
                submitBtn.innerText = 'Submitting...';
                submitBtn.disabled = true;

                try {
                    const response = await fetch('/api/testimonials', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, role, story })
                    });

                    if (response.ok) {
                        const newEntry = await response.json();
                        renderTestimonial(newEntry);
                        storyForm.reset();
                        showFormMessage('Thank you for sharing your story!', 'success', storyForm);

                        setTimeout(() => {
                            closeStoryModal();
                        }, 2000);

                        // Scroll to new story
                        const testimonialsGrid = document.querySelector('.testimonials-grid');
                        const newCard = testimonialsGrid ? testimonialsGrid.firstElementChild : null;
                        if (newCard) newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } else {
                        throw new Error('Server error');
                    }
                } catch (err) {
                    showFormMessage('Failed to save your story. Please try again.', 'error', storyForm);
                } finally {
                    submitBtn.innerText = originalBtnText;
                    submitBtn.disabled = false;
                }
            }
        });
    }
}
