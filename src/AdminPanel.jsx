import { useEffect, useState } from "react";
import { apiUrl } from "./api.js";

const emptyItem = {
  code: "", name: "", category: "Necklaces", style: "Bridal", pricePerDay: "", deposit: "",
  description: "", image: "",   images: [], featured: false, premium: false, available: true
};

async function adminRequest(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers
    }
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body.message || "The request could not be completed.");
  return body;
}

export default function AdminPanel() {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [items, setItems] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [rentalEdits, setRentalEdits] = useState({});
  const [itemForm, setItemForm] = useState(emptyItem);
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState({ loading: false, message: "", error: false });

  function showStatus(message, error = false) {
    setStatus({ loading: false, message, error });
  }

  async function loadDashboard() {
    const [jewelry, enquiryList, rentalList] = await Promise.all([
      adminRequest("/api/admin/jewelry"),
      adminRequest("/api/admin/enquiries"),
      adminRequest("/api/admin/rentals")
    ]);
    setItems(jewelry);
    setEnquiries(enquiryList);
    setRentals(rentalList);
  }

  useEffect(() => {
    async function restoreSession() {
      try {
        await adminRequest("/api/admin/session");
        await loadDashboard();
        setIsAuthenticated(true);
      } catch {
        setIsAuthenticated(false);
      }
    }
    restoreSession();
  }, []);

  async function login(event) {
    event.preventDefault();
    setStatus({ loading: true, message: "", error: false });
    try {
      await adminRequest("/api/admin/login", {
        method: "POST",
        body: JSON.stringify(credentials)
      });
      await loadDashboard();
      setIsAuthenticated(true);
      showStatus("Signed in successfully.");
    } catch (error) {
      showStatus(error.message, true);
    }
  }

  async function logout() {
    await adminRequest("/api/admin/logout", { method: "POST" });
    setIsAuthenticated(false);
    setItems([]);
    setEnquiries([]);
    setRentals([]);
    setRentalEdits({});
    setStatus({ loading: false, message: "", error: false });
  }

  async function saveItem(event) {
    event.preventDefault();
    setStatus({ loading: true, message: "", error: false });
    if (!itemForm.images.length && !itemForm.image) {
      return showStatus("Upload at least one product image.", true);
    }
    const payload = {
      ...itemForm,
      image: itemForm.images[0] || itemForm.image,
      pricePerDay: Number(itemForm.pricePerDay),
      deposit: Number(itemForm.deposit)
    };
    try {
      const path = editingId ? `/api/admin/jewelry/${editingId}` : "/api/admin/jewelry";
      const item = await adminRequest(path, { method: editingId ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setItems((current) => editingId ? current.map((entry) => entry._id === item._id ? item : entry) : [item, ...current]);
      setItemForm(emptyItem);
      setEditingId(null);
      showStatus(editingId ? "Jewelry item updated." : "Jewelry item added.");
    } catch (error) {
      showStatus(error.message, true);
    }
  }

  function editItem(item) {
    setEditingId(item._id);
    setItemForm({
      code: item.code || "", name: item.name, category: item.category, style: item.style, description: item.description || "",
      pricePerDay: item.pricePerDay, deposit: item.deposit, image: item.image,
      images: item.images?.length ? item.images : [item.image].filter(Boolean),
      featured: item.featured, premium: item.premium, available: item.available
    });
    document.querySelector("#jewelry-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function removeItem(item) {
    if (!window.confirm(`Remove ${item.name} from the catalog?`)) return;
    try {
      await adminRequest(`/api/admin/jewelry/${item._id}`, { method: "DELETE" });
      setItems((current) => current.filter((entry) => entry._id !== item._id));
      showStatus("Jewelry item removed.");
    } catch (error) {
      showStatus(error.message, true);
    }
  }

  async function moveItem(item, direction) {
    try {
      await adminRequest(`/api/admin/jewelry/${item._id}/order`, {
        method: "PATCH",
        body: JSON.stringify({ direction })
      });
      await loadDashboard();
      showStatus(`Moved ${item.name} ${direction}.`);
    } catch (error) {
      showStatus(error.message, true);
    }
  }

  async function changeEnquiryStatus(id, value) {
    try {
      const enquiry = await adminRequest(`/api/admin/enquiries/${id}`, { method: "PATCH", body: JSON.stringify({ status: value }) });
      setEnquiries((current) => current.map((entry) => entry._id === id ? enquiry : entry));
    } catch (error) {
      showStatus(error.message, true);
    }
  }

  async function updateRental(rental, status) {
    const dates = rentalEdits[rental._id] || {
      eventDate: new Date(rental.eventDate).toISOString().slice(0, 10),
      returnDate: new Date(rental.returnDate).toISOString().slice(0, 10)
    };
    try {
      const updated = await adminRequest(`/api/admin/rentals/${rental._id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...dates, status })
      });
      setRentals((current) => current.map((entry) => entry._id === updated._id ? updated : entry));
      setRentalEdits((current) => {
        const { [rental._id]: removed, ...remaining } = current;
        return remaining;
      });
      showStatus(status === "confirmed" ? "Reservation approved." : "Reservation dates updated.");
    } catch (error) {
      showStatus(error.message, true);
    }
  }

  async function uploadPhotos(event) {
    const files = [...event.target.files];
    if (!files.length) return;
    setStatus({ loading: true, message: "", error: false });
    const formData = new FormData();
    files.forEach((file) => formData.append("photos", file));
    try {
      const result = await adminRequest("/api/admin/uploads", { method: "POST", body: formData });
      setItemForm((current) => ({ ...current, images: [...current.images, ...result.images] }));
      showStatus(`${result.images.length} photo${result.images.length > 1 ? "s" : ""} uploaded.`);
    } catch (error) {
      showStatus(error.message, true);
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="admin-page">
      <header className="site-header">
        <a className="brand" href="/" aria-label="One Day Show home"><img className="brand-logo" src="/logo.png" alt="One Day Show" /></a>
        <a className="text-link" href="/">Back to storefront</a>
      </header>
      <main className="admin-section">
        <div className="admin-heading"><div><p className="eyebrow">Private workspace</p><h1>Manage the show</h1></div><p>Update the jewelry catalog and respond to customer enquiries in one place.</p></div>
        {!isAuthenticated ? (
          <form className="admin-login" onSubmit={login}>
            <label>Username<input required autoComplete="username" value={credentials.username} onChange={(event) => setCredentials({ ...credentials, username: event.target.value })} /></label>
            <label>Password<input required type="password" autoComplete="current-password" value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} /></label>
            <button className="primary-button" disabled={status.loading}>{status.loading ? "Signing in..." : "Sign in →"}</button>
            {status.message && <p className={`admin-status ${status.error ? "error-message" : ""}`}>{status.message}</p>}
          </form>
        ) : (
          <div className="admin-dashboard">
            <div className="dashboard-topline"><p className={`admin-status ${status.error ? "error-message" : ""}`}>{status.message}</p><button className="secondary-button" onClick={logout}>Sign out</button></div>
            <div className="admin-columns">
              <div>
                <h3 id="jewelry-form">{editingId ? "Edit jewelry" : "Add jewelry"}</h3>
                <form className="admin-form" onSubmit={saveItem}>
                  <label>Jewelry code<input required value={itemForm.code} onChange={(event) => setItemForm({ ...itemForm, code: event.target.value.toUpperCase() })} placeholder="001" /></label>
                  <label>Name<input required value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} /></label>
                  <label>Category<select value={itemForm.category} onChange={(event) => setItemForm({ ...itemForm, category: event.target.value })}><option>Necklaces</option><option>Chokers</option><option>Earrings</option><option>Waist Belts</option></select></label>
                  <label>Style<select value={itemForm.style} onChange={(event) => setItemForm({ ...itemForm, style: event.target.value })}><option>Bridal</option><option>Party</option><option>Casual</option><option>Festival</option></select></label>
                  <label className="full-field">Description<textarea required value={itemForm.description} onChange={(event) => setItemForm({ ...itemForm, description: event.target.value })} placeholder="Describe the design, material, and ideal occasion." /></label>
                  <label>Daily rental (USD)<input required min="0" type="number" value={itemForm.pricePerDay} onChange={(event) => setItemForm({ ...itemForm, pricePerDay: event.target.value })} /></label>
                  <label>Refundable deposit (USD)<input required min="0" type="number" value={itemForm.deposit} onChange={(event) => setItemForm({ ...itemForm, deposit: event.target.value })} /></label>
                  <label className="full-field">Primary image path (optional)<input value={itemForm.image} onChange={(event) => setItemForm({ ...itemForm, image: event.target.value })} placeholder="/images/filename.jpg" /></label>
                  <label className="full-field upload-field">Upload product photos<input type="file" accept="image/*" multiple onChange={uploadPhotos} /></label>
                  {itemForm.images.length > 0 && <div className="uploaded-images">{itemForm.images.map((image) => <div key={image}><img src={image} alt="" /><button type="button" aria-label="Remove photo" onClick={() => setItemForm({ ...itemForm, images: itemForm.images.filter((entry) => entry !== image) })}>×</button></div>)}</div>}
                  <label className="check-field"><input type="checkbox" checked={itemForm.available} onChange={(event) => setItemForm({ ...itemForm, available: event.target.checked })} /> Available to rent</label>
                  <label className="check-field"><input type="checkbox" checked={itemForm.featured} onChange={(event) => setItemForm({ ...itemForm, featured: event.target.checked })} /> Feature this piece</label>
                  <label className="check-field"><input type="checkbox" checked={itemForm.premium} onChange={(event) => setItemForm({ ...itemForm, premium: event.target.checked })} /> Show as premium hero product</label>
                  <div className="form-actions"><button className="primary-button" disabled={status.loading}>{editingId ? "Save changes" : "Add to catalog"}</button>{editingId && <button type="button" className="secondary-button" onClick={() => { setEditingId(null); setItemForm(emptyItem); }}>Cancel</button>}</div>
                </form>
              </div>
              <div className="admin-list"><h3>Jewelry catalog <span>{items.length}</span></h3>{items.map((item, index) => <article key={item._id}><img src={item.image} alt="" /><div><strong>{item.code} · {item.name}</strong><p>{item.category} · ${item.pricePerDay}/day · {item.isAvailableToday ? "Available now" : "Unavailable now"}{item.premium ? " · Premium hero" : ""}</p><p>{item.unavailableFrom ? `Reserved from ${new Date(item.unavailableFrom).toLocaleDateString()}` : "No upcoming booking"} · {item.views} views · {item.likes} likes</p></div><button aria-label={`Move ${item.name} up`} disabled={index === 0} onClick={() => moveItem(item, "up")}>↑</button><button aria-label={`Move ${item.name} down`} disabled={index === items.length - 1} onClick={() => moveItem(item, "down")}>↓</button><button onClick={() => editItem(item)}>Edit</button><button className="danger-button" onClick={() => removeItem(item)}>Remove</button></article>)}</div>
            </div>
            <div className="enquiry-list"><h3>Customer enquiries <span>{enquiries.length}</span></h3>{enquiries.length === 0 ? <p>No enquiries received yet.</p> : enquiries.map((enquiry) => <article key={enquiry._id}><div><strong>{enquiry.name}</strong><p>{enquiry.email} · {enquiry.phone}</p><p>{enquiry.message}</p></div><select value={enquiry.status} onChange={(event) => changeEnquiryStatus(enquiry._id, event.target.value)}><option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option></select></article>)}</div>
            <div className="rental-list"><h3>Reservation requests <span>{rentals.length}</span></h3>{rentals.length === 0 ? <p>No active reservations.</p> : rentals.map((rental) => <RentalCard key={rental._id} rental={rental} dates={rentalEdits[rental._id]} onDateChange={(field, value) => setRentalEdits((current) => ({ ...current, [rental._id]: { ...(current[rental._id] || { eventDate: new Date(rental.eventDate).toISOString().slice(0, 10), returnDate: new Date(rental.returnDate).toISOString().slice(0, 10) }), [field]: value } }))} onSave={() => updateRental(rental, rental.status)} onApprove={() => updateRental(rental, "confirmed")} />)}</div>
          </div>
        )}
      </main>
    </div>
  );
}

function RentalCard({ rental, dates, onDateChange, onSave, onApprove }) {
  const eventDate = dates?.eventDate || new Date(rental.eventDate).toISOString().slice(0, 10);
  const returnDate = dates?.returnDate || new Date(rental.returnDate).toISOString().slice(0, 10);
  return <article>
    <div>
      {rental.jewelryId ? <a className="rental-product-link" href={`/product/${rental.jewelryId}`}>{rental.jewelryCode} · {rental.jewelryName}</a> : <strong>{rental.jewelryCode} · {rental.jewelryName}</strong>}
      <p>{rental.customerName} · {rental.email} · {rental.phone}</p>
    </div>
    <div className="rental-actions">
      <span className={`rental-status ${rental.status}`}>{rental.status}</span>
      <label>From<input type="date" value={eventDate} onChange={(event) => onDateChange("eventDate", event.target.value)} /></label>
      <label>To<input type="date" value={returnDate} onChange={(event) => onDateChange("returnDate", event.target.value)} /></label>
      <button className="secondary-button" onClick={onSave}>Save dates</button>
      {rental.status === "pending" && <button className="primary-button" onClick={onApprove}>Approve</button>}
    </div>
  </article>;
}
