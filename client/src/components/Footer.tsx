import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer>
      <div className="container">
        <div>
          <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem' }}>J & D BEACH HOUSE</h4>
          <p style={{ fontSize: '.88rem', maxWidth: '30ch', marginTop: 8, color: '#94A3B8' }}>
            Beachfront stays in Bolinao, Pangasinan — cottages, suites and villas with instant SMS pings on every reservation.
          </p>
        </div>
        <div>
          <h4>Explore</h4>
          <Link to="/">Book a stay</Link>
          <Link to="/rooms">Rooms & rates</Link>
          <Link to="/my-bookings">My bookings</Link>
          <Link to="/resort-customer">Guest Hub</Link>
        </div>
        <div>
          <h4>Front desk</h4>
          <p style={{ fontSize: '.88rem', color: '#94A3B8' }}>Open 24/7<br />Check-in 2:00 PM<br />Check-out 12:00 NN</p>
        </div>
        <div>
          <h4>Find us</h4>
          <p style={{ fontSize: '.88rem', color: '#94A3B8' }}>Tambak Beach Road<br />Bolinao, Pangasinan 2406<br />+63 900 555 0123 · hello@jdbeachhouse.ph</p>
        </div>
      </div>
      <div className="foot-bottom">
        © {new Date().getFullYear()} J & D Beach House · Bolinao, Pangasinan · All rights reserved.
      </div>
    </footer>
  );
}
