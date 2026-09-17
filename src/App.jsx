import { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import AdminPanel from "./AdminPanel.jsx";
import { apiUrl } from "./api.js";
import ProductPage from "./ProductPage.jsx";

const categories = ["All", "Necklaces", "Chokers", "Earrings", "Waist Belts"];
const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);
const bookingLabel = (item) => item.unavailableFrom && item.unavailableUntil
  ? `Booked: ${new Date(item.unavailableFrom).toLocaleDateString()} - ${new Date(item.unavailableUntil).toLocaleDateString()}`
  : null;
const toDateInput = (date) => date
  ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  : "";
const fromStoredDate = (date) => new Date(`${String(date).slice(0, 10)}T00:00:00`);

export default function App() {
  const productMatch = window.location.pathname.match(/^\/product\/([^/]+)$/);
  if (productMatch) return <ProductPage productId={productMatch[1]} />;
  return window.location.pathname === "/admin" ? <AdminPanel /> : <Storefront />;
}

function Storefront() {
  const [items, setItems] = useState([]);
  const [heroProduct, setHeroProduct] = useState(null);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadJewelry() {
      setIsLoading(true);
      setError("");
      try {
        const query = new URLSearchParams();
        if (category !== "All") query.set("category", category);
        if (search.trim()) query.set("search", search.trim());
        const response = await fetch(apiUrl(`/api/jewelry?${query}`), { signal: controller.signal });
        if (!response.ok) throw new Error("Catalog unavailable");
        setItems(await response.json());
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError("We could not load the collection. Please refresh and try again.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }
    const debounce = window.setTimeout(loadJewelry, search ? 250 : 0);
    return () => {
      controller.abort();
      window.clearTimeout(debounce);
    };
  }, [category, search]);

  useEffect(() => {
    async function loadHeroProduct() {
      try {
        const response = await fetch(apiUrl("/api/jewelry?premium=true"));
        if (!response.ok) throw new Error("Premium product unavailable");
        const products = await response.json();
        setHeroProduct(products[0] || null);
      } catch {
        setHeroProduct(null);
      }
    }
    loadHeroProduct();
  }, []);

  const featured = useMemo(() => items.filter((item) => item.featured).slice(0, 4), [items]);

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="One Day Show home">
          <img className="brand-logo" src="/logo.png" alt="One Day Show" />
        </a>
        <nav className={menuOpen ? "open" : ""} aria-label="Primary navigation">
          <a href="#collection" onClick={() => setMenuOpen(false)}>Collection</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <button className="nav-button" onClick={() => { setEnquiryOpen(true); setMenuOpen(false); }}>Enquire</button>
        </nav>
        <button className="header-cta" onClick={() => document.querySelector("#collection").scrollIntoView({ behavior: "smooth" })}>
          Explore rentals
        </button>
        <button className="menu-toggle" aria-label="Toggle navigation menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? "×" : "Menu"}
        </button>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Jewelry for your moment</p>
            <h1>Borrow the <em>brilliance.</em></h1>
            <p className="hero-description">
              Signature South Indian jewelry, thoughtfully curated for weddings,
              celebrations, and every unforgettable entrance.
            </p>
            <p className="pickup-location">Fremont, California · Bay Area jewelry rental pickup by appointment only.</p>
            <div className="hero-actions">
              <a className="primary-button" href="#collection">Find your piece <span>→</span></a>
              <a className="text-link" href="#how-it-works">How renting works</a>
            </div>
            <div className="hero-trust">
              <span><strong>150+</strong> heirloom-inspired pieces</span>
              <span><strong>24 hr</strong> easy rental window</span>
            </div>
          </div>
          <div className="hero-image">
            {heroProduct && <a href={`/product/${heroProduct._id}`}><img src={heroProduct.image} alt={heroProduct.name} /></a>}
            <div className="image-caption">
              <span>Premium piece</span>
              <strong>{heroProduct ? heroProduct.name : "Premium collection"}</strong>
            </div>
          </div>
        </section>

        <section className="value-strip" id="how-it-works">
          <article><span>01</span><div><h2>Choose your shine</h2><p>Browse occasion-ready jewelry.</p></div></article>
          <article><span>02</span><div><h2>Reserve your dates</h2><p>Book online in just a few minutes.</p></div></article>
          <article><span>03</span><div><h2>Wear & return</h2><p>Look extraordinary, without the commitment.</p></div></article>
        </section>

        <section className="collection-section" id="collection">
          <div className="section-heading">
            <div>
              <p className="eyebrow">The rental edit</p>
              <h2>Made to be remembered</h2>
            </div>
            <p>Choose a piece that turns your special day into a story worth keeping.</p>
          </div>

          <div className="catalog-controls">
            <div className="category-tabs" aria-label="Jewelry category">
              {categories.map((option) => (
                <button
                  className={category === option ? "active" : ""}
                  key={option}
                  onClick={() => setCategory(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <label className="search-box">
              <span>⌕</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search the collection"
                aria-label="Search the collection"
              />
            </label>
          </div>

          {error && <p className="message error-message">{error}</p>}
          {isLoading ? (
            <p className="loading">Curating the collection...</p>
          ) : (
            <div className="product-grid">
              {items.map((item) => (
                <article className="product-card" key={item._id}>
                  <div className="product-image">
                    <a className="product-image-link" href={`/product/${item._id}`} aria-label={`View details for ${item.name}`}>
                      <img src={item.image} alt={item.name} />
                    </a>
                    {item.featured && <span>Most loved</span>}
                    {bookingLabel(item) && <p className="catalog-booking">{bookingLabel(item)}</p>}
                    {item.available && <button aria-label={`Reserve ${item.name}`} onClick={() => setSelected(item)}>Reserve</button>}
                  </div>
                  <div className="product-details">
                    <div><p>{item.category} · {item.style}</p><h3><a href={`/product/${item._id}`}>{item.name}</a></h3></div>
                    <strong>{formatCurrency(item.pricePerDay)}<small>/ day</small></strong>
                  </div>
                </article>
              ))}
            </div>
          )}
          {!isLoading && !error && items.length === 0 && <p className="loading">No pieces match that search.</p>}
        </section>

        <section className="occasion-section">
          <div className="occasion-image"><img src="/images/Traditional%20Mullai%20Malai%20Haram.jpeg" alt="Traditional gold jewelry" /></div>
          <div className="occasion-copy">
            <p className="eyebrow">For every occasion</p>
            <h2>Your celebration,<br /><em>your style.</em></h2>
            <p>From the first glance to the last dance, discover jewelry that feels like it was made for your story.</p>
            <button className="text-link link-button" onClick={() => setEnquiryOpen(true)}>Ask about a piece <span>→</span></button>
          </div>
        </section>

        {featured.length > 0 && (
          <section className="featured-section">
            <p className="eyebrow">A closer look</p>
            <div className="featured-list">
              {featured.slice(0, 3).map((item) => <span key={item._id}>{item.name}</span>)}
            </div>
          </section>
        )}
      </main>

      <footer>
        <a className="brand" href="#top"><img className="brand-logo" src="/logo.png" alt="One Day Show" /></a>
        <p>Jewelry made for one extraordinary day.</p>
        <span>© {new Date().getFullYear()} One Day Show</span>
      </footer>

      {selected && <BookingModal item={selected} onClose={() => setSelected(null)} onSuccess={setNotice} />}
      {enquiryOpen && <EnquiryModal onClose={() => setEnquiryOpen(false)} onSuccess={setNotice} />}
      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
    </div>
  );
}

function EnquiryModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", eventDate: "", message: "" });
  const [status, setStatus] = useState({ loading: false, message: "" });
  async function submit(event) {
    event.preventDefault();
    setStatus({ loading: true, message: "" });
    try {
      const response = await fetch(apiUrl("/api/enquiries"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      onClose();
      onSuccess("Thank you. We will be in touch shortly.");
    } catch (error) {
      setStatus({ loading: false, message: error.message || "Your enquiry could not be sent." });
      return;
    }
    setStatus({ loading: false, message: "" });
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="booking-modal enquiry-modal" role="dialog" aria-modal="true" aria-labelledby="enquiry-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close enquiry form">×</button><p className="eyebrow">We are here to help</p><h2 id="enquiry-title">Start a conversation</h2><p>Tell us what you are looking for and we will help you find the right piece.</p><form onSubmit={submit}><div className="form-grid"><label>Full name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Email address<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Phone number<input required type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>Event date (optional)<input type="date" value={form.eventDate} onChange={(event) => setForm({ ...form, eventDate: event.target.value })} /></label><label>How can we help?<textarea required value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label></div>{status.message && <p className="message error-message">{status.message}</p>}<button className="primary-button booking-submit" disabled={status.loading}>{status.loading ? "Sending..." : "Send enquiry →"}</button></form></section></div>;
}

export function BookingModal({ item, onClose, onSuccess }) {
  const [form, setForm] = useState({ customerName: "", email: "", phone: "", eventDate: "", returnDate: "" });
  const [status, setStatus] = useState({ loading: false, message: "" });
  const rentalTotal = useMemo(() => {
    if (!form.eventDate || !form.returnDate) return null;
    const days = Math.floor((new Date(`${form.returnDate}T00:00:00`) - new Date(`${form.eventDate}T00:00:00`)) / 86_400_000) + 1;
    return days > 0 ? days * item.pricePerDay : null;
  }, [form.eventDate, form.returnDate, item.pricePerDay]);
  const minimumDate = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (!item.availableAfter) return today;
    const availableAfter = new Date(item.availableAfter).toISOString().slice(0, 10);
    return availableAfter > today ? availableAfter : today;
  }, [item.availableAfter]);
  const selectedRange = form.eventDate ? {
    from: fromStoredDate(form.eventDate),
    to: form.returnDate ? fromStoredDate(form.returnDate) : undefined
  } : undefined;
  const disabledDates = useMemo(() => [
    { before: fromStoredDate(minimumDate) },
    ...(item.bookedPeriods || []).map((period) => ({
      from: fromStoredDate(period.eventDate),
      to: fromStoredDate(period.returnDate)
    }))
  ], [item.bookedPeriods, minimumDate]);

  const selectedPeriodOverlapsBooking = useMemo(() => {
    if (!form.eventDate || !form.returnDate) return false;
    const start = new Date(`${form.eventDate}T00:00:00`);
    const end = new Date(`${form.returnDate}T00:00:00`);
    return (item.bookedPeriods || []).some((period) =>
      start <= new Date(period.returnDate) && end >= new Date(period.eventDate)
    );
  }, [form.eventDate, form.returnDate, item.bookedPeriods]);

  async function submit(event) {
    event.preventDefault();
    if (selectedPeriodOverlapsBooking) {
      setStatus({ loading: false, message: "Your selected rental period includes booked dates." });
      return;
    }
    setStatus({ loading: true, message: "" });
    try {
      const response = await fetch(apiUrl("/api/rentals"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, jewelryId: item._id })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      onClose();
      onSuccess(`Your reservation request for ${item.name} has been sent for approval.`);
    } catch (requestError) {
      setStatus({ loading: false, message: requestError.message || "Booking could not be completed." });
      return;
    }
    setStatus({ loading: false, message: "" });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="booking-modal" id="booking" role="dialog" aria-modal="true" aria-labelledby="booking-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close booking form">×</button>
        <div className="booking-product"><img src={item.image} alt={item.name} /><div><p className="eyebrow">Reserve this piece</p><h2 id="booking-title">{item.name}</h2><p>{formatCurrency(item.pricePerDay)} per day · {formatCurrency(item.deposit)} refundable deposit</p></div></div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>Full name<input required value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} /></label>
            <label>Email address<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label>Phone number<input required type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <div className="calendar-field">
              <span>Choose rental dates</span>
              <DayPicker
                mode="range"
                selected={selectedRange}
                onSelect={(range) => {
                  setStatus({ loading: false, message: "" });
                  setForm({ ...form, eventDate: toDateInput(range?.from), returnDate: toDateInput(range?.to) });
                }}
                disabled={disabledDates}
                excludeDisabled
              />
              <p>{form.eventDate ? `Selected: ${form.eventDate}${form.returnDate ? ` to ${form.returnDate}` : ""}` : "Select a start and return date."}</p>
            </div>
          </div>
          {rentalTotal && <p className="rental-total">Estimated rental: <strong>{formatCurrency(rentalTotal)}</strong></p>}
          {status.message && <p className="message error-message">{status.message}</p>}
          <button className="primary-button booking-submit" disabled={status.loading}>{status.loading ? "Confirming..." : "Confirm reservation →"}</button>
        </form>
      </section>
    </div>
  );
}
