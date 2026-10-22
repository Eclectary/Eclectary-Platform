import { Link } from "react-router-dom";
import "../styles/footer.css";

const FEEDBACK_URL = import.meta.env.VITE_FEEDBACK_URL || "http://localhost:3000";

function Footer() {
  return (
    <footer className="site-footer" role="contentinfo" aria-label="Site footer">
      <div className="footer-inner">
        <div className="footer-top">
          <h2 className="footer-brand">ECLECTARY</h2>
          <p className="footer-tagline">Where handmade meets meaning.</p>
        </div>

        <div className="footer-columns">
          <div className="footer-col">
            <h3>SHOP</h3>
            <ul>
              <li><Link to="/shop">All Products</Link></li>
              <li><Link to="/shop?collection=purely-handmade">Purely Handmade</Link></li>
              <li><Link to="/shop?collection=digital-creations">Digital Creations</Link></li>
              <li><Link to="/shop?collection=custom-printing">Custom Printing</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h3>CREATE</h3>
            <ul>
              <li><a href="#">Become a Creator</a></li>
              <li><a href="#">Seller Dashboard</a></li>
              <li><a href="#">Seller Resources</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h3>ABOUT</h3>
            <ul>
              <li><a href="#">About Eclectary</a></li>
              <li><a href="#">Our Mission</a></li>
              <li><Link to="/shop#makers">Meet the Creators</Link></li>
              <li><a href="#">Blog</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h3>HELP</h3>
            <ul>
              <li><a href="#">FAQ</a></li>
              <li><a href="#">Contact</a></li>
              <li><a href={FEEDBACK_URL}>Feedback</a></li>
              <li><a href="#">Shipping</a></li>
              <li><a href="#">Returns</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-discover">
          <h4>DISCOVER</h4>
          <p className="discover-tags">Metaphysical • Art • Nature • Witchy • Spiritual</p>
        </div>

        <div className="footer-social">
          <h4>Follow Eclectary</h4>
          <div className="social-links">
            <a href="#" aria-label="Instagram" className="social-btn">Instagram</a>
            <a href="#" aria-label="Facebook" className="social-btn">Facebook</a>
            <a href="#" aria-label="Pinterest" className="social-btn">Pinterest</a>
            <a href="#" aria-label="TikTok" className="social-btn">TikTok</a>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="copyright">© 2026 Eclectary</div>
          <div className="legal-links">
            <a href="#">Privacy Policy</a>
            <span className="sep">|</span>
            <a href="#">Terms</a>
            <span className="sep">|</span>
            <a href="#">Seller Agreement</a>
            <span className="sep">|</span>
            <a href="#">Accessibility</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
