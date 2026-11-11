import { getStarSegments } from '../utils/starRating';
import '../styles/star-rating.css';

interface StarRatingProps {
  rating?: number;
  reviewCount?: number;
  className?: string;
}

function StarRating({ rating, reviewCount, className = '' }: StarRatingProps) {
  const hasReviewCount = typeof reviewCount === 'number';
  const noReviews = hasReviewCount && reviewCount === 0;

  if (noReviews || rating == null) {
    return <span className={`star-rating star-rating--empty ${className}`.trim()}>No reviews yet</span>;
  }

  const { filled, empty, safeRating } = getStarSegments(rating);
  const reviewWord = reviewCount === 1 ? 'review' : 'reviews';
  const ariaLabel = hasReviewCount
    ? `Rated ${safeRating.toFixed(1)} out of 5 from ${reviewCount} ${reviewWord}.`
    : `Rated ${safeRating.toFixed(1)} out of 5.`;

  return (
    <span className={`star-rating ${className}`.trim()} role="img" aria-label={ariaLabel}>
      <span className="star-rating__stars" aria-hidden="true">
        <span className="star-rating__filled">{'★'.repeat(filled)}</span>
        <span className="star-rating__empty">{'★'.repeat(empty)}</span>
      </span>
      <span className="star-rating__value" aria-hidden="true">{safeRating.toFixed(1)}</span>
      {hasReviewCount && (
        <span className="star-rating__count" aria-hidden="true">({reviewCount})</span>
      )}
    </span>
  );
}

export default StarRating;
