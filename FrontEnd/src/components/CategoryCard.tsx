import { Link } from 'react-router-dom';

import type { Category } from '../types/category';
import '../styles/category-card.css';

interface CategoryCardProps {
  category: Category;
}

function CategoryCard({ category }: CategoryCardProps) {
  return (
    <article className="category-card">
      <Link className="category-card__link" to={`/category/${category.id}`} aria-label={`Browse ${category.name}`}>
        {category.image && <img className="category-card__image" src={category.image} alt="" loading="lazy" />}
        <span className="category-card__overlay" aria-hidden="true" />
        <h3 className="category-card__name">{category.name}</h3>
      </Link>
    </article>
  );
}

export default CategoryCard;
