require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin123';

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Middleware to check admin access
const verifyAdmin = (req, res, next) => {
    const authHeader = req.headers['x-admin-secret'];
    if (authHeader === ADMIN_SECRET) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// (Moved static middleware down to ensure API routes hit first)

const DATA_DIR = path.join(__dirname, 'data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const TESTIMONIALS_FILE = path.join(DATA_DIR, 'testimonials.json');
const SERVICES_FILE = path.join(DATA_DIR, 'services.json');
const GALLERY_FILE = path.join(DATA_DIR, 'gallery.json');

// Ensure data files exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(BOOKINGS_FILE)) fs.writeFileSync(BOOKINGS_FILE, JSON.stringify([]));
if (!fs.existsSync(TESTIMONIALS_FILE)) fs.writeFileSync(TESTIMONIALS_FILE, JSON.stringify([]));
if (!fs.existsSync(SERVICES_FILE)) fs.writeFileSync(SERVICES_FILE, JSON.stringify([]));
if (!fs.existsSync(GALLERY_FILE)) fs.writeFileSync(GALLERY_FILE, JSON.stringify([]));

// Helper for Notifications
const logNotification = (msg) => {
    const logMsg = `[${new Date().toLocaleString()}] ${msg}\n`;
    fs.appendFileSync(path.join(DATA_DIR, 'notifications.log'), logMsg);
    console.log(`%c NOTIFICATION: ${msg}`, 'color: #c5a059; font-weight: bold;');
};

// --- EMAIL SERVICE ---
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER || 'no-reply@maxbarber.com',
        pass: process.env.EMAIL_PASS || 'password'
    }
});

const sendEmail = (booking) => {
    const emailHtml = `
    <div style="font-family: 'Oswald', sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #c5a059; padding: 20px;">
        <h2 style="color: #c5a059; border-bottom: 2px solid #c5a059; padding-bottom: 10px;">Booking Confirmed</h2>
        <p>Hi <strong>${booking.name}</strong>,</p>
        <p>Great news! Your booking at <strong>Max Barber</strong> has been confirmed.</p>
        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Service:</strong> ${booking.service}</p>
            <p><strong>Date:</strong> ${booking.date}</p>
            <p><strong>Time:</strong> ${booking.time}</p>
        </div>
        <p>We look forward to seeing you!</p>
        <p style="font-size: 0.8rem; color: #888;">- Max Barber Team</p>
    </div>
    `;

    const mailOptions = {
        from: '"Max Barber" <no-reply@maxbarber.com>',
        to: booking.email,
        subject: 'Booking Confirmed - Max Barber',
        html: emailHtml
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Email error:', error);
            fs.appendFileSync(path.join(DATA_DIR, 'sent_emails.log'), `[${new Date().toLocaleString()}] EMAIL FAILED FOR ${booking.email}: ${error.message}\n`);
        } else {
            console.log('Email sent: ' + info.response);
            fs.appendFileSync(path.join(DATA_DIR, 'sent_emails.log'), `[${new Date().toLocaleString()}] EMAIL SENT TO ${booking.email} for ${booking.id}\n`);
            logNotification(`Confirmation email sent to ${booking.email}`);
        }
    });

    // Still log locally for simulation if transport isn't fully configured
    console.log(`SIMULATED EMAIL TO: ${booking.email}`);
};

// --- AUTO-CLEANUP SERVICE ---
const cleanupOldBookings = () => {
    fs.readFile(BOOKINGS_FILE, (err, data) => {
        if (err) return;
        try {
            let bookings = JSON.parse(data);
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

            const initialCount = bookings.length;
            // Only keep bookings that are today or in the future
            // Or if they are older than one day from 'now'
            bookings = bookings.filter(b => {
                const bookingDate = new Date(b.date);
                // If bookingDate is more than 24 hours older than now, remove it
                return bookingDate >= oneDayAgo;
            });

            if (bookings.length < initialCount) {
                fs.writeFile(BOOKINGS_FILE, JSON.stringify(bookings, null, 2), (err) => {
                    if (!err) logNotification(`Cleaned up ${initialCount - bookings.length} expired bookings.`);
                });
            }
        } catch (e) { console.error('Cleanup error:', e); }
    });
};

// Run cleanup every hour
setInterval(cleanupOldBookings, 60 * 60 * 1000);
// Initial run
setTimeout(cleanupOldBookings, 5000);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        time: new Date(),
        env: process.env.NODE_ENV,
        hasSecret: !!process.env.ADMIN_SECRET
    });
});

// API Endpoints

// GET all testimonials
app.get('/api/testimonials', (req, res) => {
    fs.readFile(TESTIMONIALS_FILE, (err, data) => {
        if (err) return res.status(500).send('Error reading testimonials');
        res.json(JSON.parse(data));
    });
});

// POST new testimonial
app.post('/api/testimonials', (req, res) => {
    const { name, role, story } = req.body;
    if (!name || !story) return res.status(400).send('Name and Story are required');

    fs.readFile(TESTIMONIALS_FILE, (err, data) => {
        if (err) return res.status(500).send('Error reading data');
        const testimonials = JSON.parse(data);
        const newEntry = { id: Date.now().toString(), name, role: role || 'Client', story, date: new Date() };
        testimonials.unshift(newEntry);

        fs.writeFile(TESTIMONIALS_FILE, JSON.stringify(testimonials, null, 2), (err) => {
            if (err) return res.status(500).send('Error saving data');
            res.status(201).json(newEntry);
        });
    });
});

// DELETE testimonial
app.delete('/api/testimonials/:id', verifyAdmin, (req, res) => {
    const id = req.params.id;
    fs.readFile(TESTIMONIALS_FILE, (err, data) => {
        if (err) return res.status(500).send('Error reading data');
        let testimonials = JSON.parse(data);
        // Use == to match both string and number IDs
        testimonials = testimonials.filter(t => t.id != id);
        fs.writeFile(TESTIMONIALS_FILE, JSON.stringify(testimonials, null, 2), (err) => {
            if (err) return res.status(500).send('Error deleting testimonial');
            res.status(200).json({ message: 'Deleted successfully' });
        });
    });
});

// GET all bookings
app.get('/api/bookings', verifyAdmin, (req, res) => {
    fs.readFile(BOOKINGS_FILE, (err, data) => {
        if (err) return res.status(500).send('Error reading bookings');
        res.json(JSON.parse(data));
    });
});

// POST new booking with conflict check
app.post('/api/bookings', (req, res) => {
    const booking = req.body;
    if (!booking.name || !booking.date || !booking.time) {
        return res.status(400).send('Missing booking details');
    }

    fs.readFile(BOOKINGS_FILE, (err, data) => {
        if (err) return res.status(500).send('Error reading data');
        const bookings = JSON.parse(data);

        // Conflict detection: Same date and time
        const conflict = bookings.find(b => b.date === booking.date && b.time === booking.time);
        if (conflict) {
            return res.status(409).json({ error: 'This time slot is already booked. Please choose another time.' });
        }

        const newBooking = { id: Date.now().toString(), status: 'pending', ...booking, createdAt: new Date() };
        bookings.push(newBooking);

        fs.writeFile(BOOKINGS_FILE, JSON.stringify(bookings, null, 2), (err) => {
            if (err) return res.status(500).send('Error saving booking');

            logNotification(`New booking received from ${booking.name} for ${booking.service} on ${booking.date} at ${booking.time}`);

            res.status(201).json({ message: 'Booking successful', id: newBooking.id });
        });
    });
});

// DELETE booking
app.delete('/api/bookings/:id', verifyAdmin, (req, res) => {
    const id = req.params.id;
    fs.readFile(BOOKINGS_FILE, (err, data) => {
        if (err) return res.status(500).send('Error reading data');
        let bookings = JSON.parse(data);
        // Use == to match both string and number IDs
        bookings = bookings.filter(b => b.id != id);
        fs.writeFile(BOOKINGS_FILE, JSON.stringify(bookings, null, 2), (err) => {
            if (err) return res.status(500).send('Error deleting booking');
            res.status(200).json({ message: 'Deleted successfully' });
        });
    });
});

// PATCH confirm booking
app.patch('/api/bookings/:id/confirm', verifyAdmin, (req, res) => {
    const id = req.params.id;
    fs.readFile(BOOKINGS_FILE, (err, data) => {
        if (err) return res.status(500).send('Error reading data');
        let bookings = JSON.parse(data);
        const bookingIndex = bookings.findIndex(b => b.id == id);
        if (bookingIndex === -1) return res.status(404).send('Booking not found');

        bookings[bookingIndex].status = 'confirmed';

        fs.writeFile(BOOKINGS_FILE, JSON.stringify(bookings, null, 2), (err) => {
            if (err) return res.status(500).send('Error confirmed booking');

            // Trigger email on confirmation
            sendEmail(bookings[bookingIndex]);

            res.status(200).json(bookings[bookingIndex]);
        });
    });
});

// SERVICES ENDPOINTS
app.get('/api/services', (req, res) => {
    fs.readFile(SERVICES_FILE, (err, data) => {
        if (err) return res.status(500).send('Error reading services');
        res.json(JSON.parse(data));
    });
});

app.post('/api/services', verifyAdmin, (req, res) => {
    const service = req.body;
    if (!service.name || !service.price) return res.status(400).send('Name and Price are required');

    fs.readFile(SERVICES_FILE, (err, data) => {
        try {
            if (err) throw err;
            const services = JSON.parse(data);
            const newService = { id: Date.now().toString(), ...service };
            services.push(newService);
            fs.writeFile(SERVICES_FILE, JSON.stringify(services, null, 2), (err) => {
                if (err) throw err;
                res.status(201).json(newService);
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Server error processing service');
        }
    });
});

app.put('/api/services/:id', verifyAdmin, (req, res) => {
    const id = req.params.id;
    const update = req.body;
    fs.readFile(SERVICES_FILE, (err, data) => {
        try {
            if (err) throw err;
            let services = JSON.parse(data);
            const index = services.findIndex(s => s.id == id);
            if (index === -1) return res.status(404).send('Service not found');

            services[index] = { ...services[index], ...update };
            fs.writeFile(SERVICES_FILE, JSON.stringify(services, null, 2), (err) => {
                if (err) throw err;
                res.json(services[index]);
            });
        } catch (e) { res.status(500).send('Update failed'); }
    });
});

app.delete('/api/services/:id', verifyAdmin, (req, res) => {
    const id = req.params.id;
    fs.readFile(SERVICES_FILE, (err, data) => {
        if (err) return res.status(500).send('Error reading data');
        let services = JSON.parse(data);
        services = services.filter(s => s.id != id);
        fs.writeFile(SERVICES_FILE, JSON.stringify(services, null, 2), (err) => {
            if (err) return res.status(500).send('Error deleting service');
            res.status(200).json({ message: 'Deleted' });
        });
    });
});

// GALLERY ENDPOINTS
app.get('/api/gallery', (req, res) => {
    fs.readFile(GALLERY_FILE, (err, data) => {
        if (err) return res.status(500).send('Error reading gallery');
        res.json(JSON.parse(data));
    });
});

app.post('/api/gallery', verifyAdmin, (req, res) => {
    const item = req.body;
    if (!item.url) return res.status(400).send('Image URL is required');

    fs.readFile(GALLERY_FILE, (err, data) => {
        try {
            if (err) throw err;
            const gallery = JSON.parse(data);
            const newItem = { id: Date.now().toString(), ...item };
            gallery.push(newItem);
            fs.writeFile(GALLERY_FILE, JSON.stringify(gallery, null, 2), (err) => {
                if (err) throw err;
                res.status(201).json(newItem);
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Server error processing gallery item');
        }
    });
});

app.put('/api/gallery/:id', verifyAdmin, (req, res) => {
    const id = req.params.id;
    const update = req.body;
    fs.readFile(GALLERY_FILE, (err, data) => {
        try {
            if (err) throw err;
            let gallery = JSON.parse(data);
            const index = gallery.findIndex(g => g.id == id);
            if (index === -1) return res.status(404).send('Item not found');

            gallery[index] = { ...gallery[index], ...update };
            fs.writeFile(GALLERY_FILE, JSON.stringify(gallery, null, 2), (err) => {
                if (err) throw err;
                res.json(gallery[index]);
            });
        } catch (e) { res.status(500).send('Update failed'); }
    });
});

app.delete('/api/gallery/:id', verifyAdmin, (req, res) => {
    const id = req.params.id;
    fs.readFile(GALLERY_FILE, (err, data) => {
        if (err) return res.status(500).send('Error reading data');
        let gallery = JSON.parse(data);
        gallery = gallery.filter(g => g.id != id);
        fs.writeFile(GALLERY_FILE, JSON.stringify(gallery, null, 2), (err) => {
            if (err) return res.status(500).send('Error deleting gallery item');
            res.status(200).json({ message: 'Deleted' });
        });
    });
});

// NOTIFICATIONS ENDPOINT
app.get('/api/notifications', verifyAdmin, (req, res) => {
    const logPath = path.join(DATA_DIR, 'notifications.log');
    if (!fs.existsSync(logPath)) return res.json([]);

    fs.readFile(logPath, 'utf8', (err, data) => {
        if (err) return res.status(500).send('Error reading logs');
        const lines = data.trim().split('\n').reverse().slice(0, 15);
        res.json(lines);
    });
});

// STATS ENDPOINT FOR CHARTS
app.get('/api/stats/bookings', verifyAdmin, (req, res) => {
    fs.readFile(BOOKINGS_FILE, (err, data) => {
        if (err) return res.status(500).send('Error reading bookings');
        const bookings = JSON.parse(data);

        // Group bookings by date for the last 7 days + next 7 days
        const stats = {};
        const today = new Date();
        for (let i = -3; i <= 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            stats[dateStr] = 0;
        }

        bookings.forEach(b => {
            if (stats[b.date] !== undefined) {
                stats[b.date]++;
            }
        });

        res.json(stats);
    });
});

app.use(express.static(path.join(__dirname, '../'))); // Serve frontend files

// Final 404 for any unmatched routes
app.use((req, res) => {
    if (req.url.startsWith('/api/')) {
        res.status(404).json({ error: `API endpoint ${req.method} ${req.url} not found` });
    } else {
        res.status(404).send('Page not found');
    }
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
