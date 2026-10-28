import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import "../styles/navbar.css";
import logo from "../assets/images/eclectary logo nb.png";

const FEEDBACK_URL = import.meta.env.VITE_FEEDBACK_URL || "http://localhost:3000";

function Navbar() {
    const { totalItems } = useCart();
    const { user, token, loading } = useAuth();
    const isLoggedIn = !loading && Boolean(user && token);

    return (
        <nav className="top-nav" aria-label="Main navigation">
            <Link className="brand" to="/" aria-label="Eclectary home">
                <img src={logo} alt="Eclectary" />
            </Link>

            <div className="primary-nav" aria-label="Eclectary departments">
                <Link className="primary-nav__link" to="/shop?collection=purely-handmade">Handmade</Link>
                <Link className="primary-nav__link" to="/shop?collection=digital-creations">Digital Creations</Link>
                <Link className="primary-nav__link" to="/shop?collection=custom-printing">Custom Printing</Link>
                <a className="primary-nav__link" href={FEEDBACK_URL}>Feedback</a>
            </div>

            <div className="account-actions">
                <Link
                    to={isLoggedIn ? "/account/profile" : "/account/login"}
                    className="action"
                    title={isLoggedIn ? "Profile" : "Login"}
                    aria-label={isLoggedIn ? "Profile" : "Login"}
                >
                    <span aria-hidden="true">♙</span>
                    <span>{isLoggedIn ? "Profile" : "Login"}</span>
                </Link>

                {isLoggedIn && (
                    <Link to="/favorites" className="action" title="Favorites" aria-label="Favorites">
                        <span aria-hidden="true">♡</span>
                        <span>Favorites</span>
                    </Link>
                )}

                <Link to="/cart" className="action" title="Cart" aria-label="Cart">
                    <span aria-hidden="true">🛒</span>
                    <span>{totalItems > 0 ? `Cart (${totalItems})` : "Cart"}</span>
                </Link>
            </div>
        </nav>
    );
}

export default Navbar;
