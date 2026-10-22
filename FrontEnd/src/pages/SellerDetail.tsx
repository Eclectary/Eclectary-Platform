import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';

import ProductCard from '../components/ProductCard';
import { products } from '../data/products';
import { getPublicSellerById, getSellerById } from '../services/sellerApi';
import { getProducts } from '../services/productApi';
import type { Product, Seller } from '../types';
import '../styles/seller-detail.css';

function SellerDetail() {
  const { id } = useParams();
  const isPublicSeller = Boolean(id && /^\d+$/.test(id));
  const [profile, setProfile] = useState<{
    id: string;
    seller?: Seller;
    products: Product[];
    error?: string;
  } | null>(null);
  const currentProfile = profile?.id === id ? profile : null;
  const loading = isPublicSeller && !currentProfile;
  const error = currentProfile?.error;
  const seller = isPublicSeller
    ? currentProfile?.seller
    : (id ? getSellerById(id) : undefined);
  const sellerProducts = isPublicSeller
    ? (currentProfile?.products ?? [])
    : (seller ? products.filter((product) => product.creator === seller.name) : []);

  useEffect(() => {
    if (!id || !isPublicSeller) return;
    let active = true;

    const loadSeller = async () => {
      let sellerLoaded = false;
      try {
        const publicSeller = await getPublicSellerById(id);
        sellerLoaded = true;
        const catalog = await getProducts();
        if (active) {
          setProfile({
            id,
            seller: publicSeller,
            products: catalog.filter((product) => product.seller_id === publicSeller.id)
              .map((product) => ({ ...product, price: Number(product.price), creator: publicSeller.name })),
          });
        }
      } catch (error) {
        if (active) {
          setProfile({
            id,
            products: [],
            error: !sellerLoaded && isAxiosError(error) && error.response?.status === 404
              ? undefined
              : 'Unable to load this shop.',
          });
        }
      }
    };

    void loadSeller();
    return () => { active = false; };
  }, [id, isPublicSeller]);

  if (loading || error) {
    return (
      <section className="seller-detail seller-detail--empty">
        <p role={error ? 'alert' : 'status'}>{error || 'Loading shop...'}</p>
        <Link className="seller-detail__back-link" to="/shop">Return to the shop</Link>
      </section>
    );
  }

  if (!seller) {
    return (
      <section className="seller-detail seller-detail--empty" aria-live="polite">
        <p className="eyebrow">Seller not found</p>
        <h1>That shop is unavailable.</h1>
        <Link className="seller-detail__back-link" to="/shop">
          Return to the shop
        </Link>
      </section>
    );
  }

  return (
    <article className="seller-detail">
      <Link className="seller-detail__back-link" to="/shop">
        &larr; Back to shop
      </Link>

      <header className="seller-detail__hero">
        <div className="seller-detail__image-wrap">
          <img className="seller-detail__image" src={seller.image} alt={`${seller.name}, ${seller.specialty}`} />
          <span className="seller-detail__status">Independent maker</span>
        </div>
        <div className="seller-detail__copy">
          <p className="eyebrow">The maker's shop</p>
          <h1>{seller.name}</h1>
          <p className="seller-detail__specialty">{seller.specialty}</p>
          <p className="seller-detail__bio">{seller.bio}</p>
          <div className="seller-detail__stats" aria-label={`${seller.name} shop details`}>
            <span><strong>{sellerProducts.length}</strong> {sellerProducts.length === 1 ? 'item' : 'items'}</span>
            {!isPublicSeller && <span><strong>4.9</strong> average rating</span>}
            {!isPublicSeller && <span><strong>Local</strong> small-batch goods</span>}
          </div>
        </div>
      </header>

      <section className="seller-detail__catalog" aria-labelledby="seller-catalog-heading">
        <div className="seller-detail__catalog-heading">
          <div>
            <p className="eyebrow">From the studio</p>
            <h2 id="seller-catalog-heading">Shop {seller.name}</h2>
          </div>
          <p>{sellerProducts.length} {sellerProducts.length === 1 ? 'piece' : 'pieces'} made with intention</p>
        </div>

        {sellerProducts.length > 0 ? (
          <div className="seller-detail__products">
            {sellerProducts.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : (
          <div className="seller-detail__empty-catalog">
            <h3>This maker is preparing their first collection.</h3>
            <p>Browse the rest of Eclectary while their shop comes together.</p>
            <Link className="seller-detail__shop-link" to="/shop">Explore all shops</Link>
          </div>
        )}
      </section>
    </article>
  );
}

export default SellerDetail;