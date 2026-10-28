const fs = require("fs");
const p = "C:/Users/User 1/OneDrive/Documents/Eclectary Platform/FrontEnd/src/App.tsx";
let c = fs.readFileSync(p, "utf8");
if (!c.includes("import Orders")) {
  c = c.replace('import OrderConfirmation from "./pages/OrderConfirmation";', 
    'import OrderConfirmation from "./pages/OrderConfirmation";\nimport Orders from "./pages/Orders";');
}
if (!c.includes("/account/orders")) {
  const old = '            <Route path="/account/profile" element={<Profile />} />\n            <Route path="/checkout" element={<Checkout />} />';
  const neu = '            <Route path="/account/profile" element={<Profile />} />\n            <Route path="/account/orders" element={<Orders />} />\n            <Route path="/checkout" element={<Checkout />} />';
  if (c.includes(old)) {
    c = c.replace(old, neu);
  } else {
    c = c.replace('<Route path="/account/profile" element={<Profile />} />',
      '<Route path="/account/profile" element={<Profile />} />\n            <Route path="/account/orders" element={<Orders />} />');
  }
}
fs.writeFileSync(p, c);
console.log("ok");
