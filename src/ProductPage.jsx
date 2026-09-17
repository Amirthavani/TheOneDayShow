import { useEffect, useState } from "react";
import { BookingModal } from "./App.jsx";
import { apiUrl } from "./api.js";

const formatCurrency = (amount) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0
}).format(amount);

const formatDate = (date) => new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric"
}).format(new Date(date));

export default function ProductPage({ productId }) {
  const [item, setItem] = useState(null);
  const [selectedImage, setSelectedImage] = useState("");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [liked, setLiked] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadItem() {
      try {
        const response = await fetch(apiUrl(`/api/jewelry/${productId}`));
        const product = await response.json();
        if (!response.ok) throw new Error(product.message);
        setItem(product);
        setSelectedImage(product.images[0]);
      } catch (error) {
        setMessage(error.message || "This product is unavailable.");
      }
    }
    loadItem();
  }, [productId]);

  async function likeProduct() {
    if (liked) return;
    try {
      const response = await fetch(apiUrl(`/api/jewelry/${productId}/like`), { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setItem((current) => ({ ...current, likes: result.likes }));
      setLiked(true);
    } catch (error) {
      setMessage(error.message || "We could not save your like.");
    }
  }

  if (message && !item) {
    return <div className="product-page"><header className="site-header"><a className="brand" href="/"><img className="brand-logo" src="/logo.png" alt="One Day Show" /></a></header><main className="product-not-found"><p>{message}</p><a className="primary-button" href="/">Return to collection</a></main></div>;
  }
  if (!item) return <p className="loading page-loading">Loading your piece...</p>;

  return (
    <div className="product-page">
      <header className="site-header">
        <a className="brand" href="/"><img className="brand-logo" src="/logo.png" alt="One Day Show" /></a>
        <a className="text-link" href="/">← Back to collection</a>
      </header>
      <main className="product-detail">
        <section className="product-gallery">
          <div className="main-product-image"><img src={selectedImage} alt={item.name} /></div>
          {item.images.length > 1 && <div className="gallery-thumbnails">{item.images.map((image, index) => <button key={image} className={image === selectedImage ? "selected" : ""} onClick={() => setSelectedImage(image)}><img src={image} alt={`${item.name} view ${index + 1}`} /></button>)}</div>}
        </section>
        <section className="product-info">
          <p className="eyebrow">{item.category} · {item.style}</p>
          <h1>{item.name}</h1>
          <p className="product-code">Jewelry code: {item.code}</p>
          {item.unavailableFrom && <p className="product-booked-date">Booked: {formatDate(item.unavailableFrom)} - {formatDate(item.unavailableUntil)}</p>}
          <p className="product-description">{item.description || "A beautifully curated jewelry rental for your special celebration."}</p>
          <div className="price-block"><strong>{formatCurrency(item.pricePerDay)}</strong><span>per day</span><p>{formatCurrency(item.deposit)} refundable deposit</p></div>
          <div className="product-actions"><button className="primary-button" onClick={() => setBookingOpen(true)}>Reserve this piece →</button><button className={`like-button ${liked ? "liked" : ""}`} onClick={likeProduct} aria-pressed={liked}>{liked ? "♥" : "♡"} {item.likes}</button></div>
          <div className="detail-notes"><p><strong>Flexible booking</strong> Reserve the dates you need. We confirm any date conflicts before your booking is completed.</p><p><strong>Refundable security deposit</strong> Returned after the piece comes back in its original condition.</p></div>
        </section>
      </main>
      {bookingOpen && <BookingModal item={item} onClose={() => setBookingOpen(false)} onSuccess={setMessage} />}
      {message && item && <div className="toast" role="status">{message}<button onClick={() => setMessage("")} aria-label="Dismiss">×</button></div>}
    </div>
  );
}
