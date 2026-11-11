import React from "react";
import ReactDOM from "react-dom/client";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import { CartProvider } from "./context/CartContext";
import { CheckoutProvider } from "./context/CheckoutProvider";
import { WishlistProvider } from "./context/WishlistContext";
import { AuthProvider } from "./context/AuthContext";
import "./styles/global.css";

ReactDOM.createRoot(
  document.getElementById("root")!
).render(
  <React.StrictMode>
    <AuthProvider>
      <CartProvider>
        <CheckoutProvider>
          <WishlistProvider>
            <App />
            <SpeedInsights />
            <Analytics />
          </WishlistProvider>
        </CheckoutProvider>
      </CartProvider>
    </AuthProvider>
  </React.StrictMode>
);