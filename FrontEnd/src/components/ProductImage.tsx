import { useState } from "react";

import { getProductImageUrl } from "../utils/productImageUrl";

interface ProductImageProps {
  image?: string | null;
  alt: string;
  className: string;
  fallbackClassName: string;
  loading?: "eager" | "lazy";
}

function ProductImage({
  image,
  alt,
  className,
  fallbackClassName,
  loading,
}: ProductImageProps) {
  const source = image ? getProductImageUrl(image) : undefined;
  const [failedSource, setFailedSource] = useState<string>();

  if (!source || failedSource === source) {
    return (
      <span className={fallbackClassName} role="img" aria-label={`No image available for ${alt}`}>
        Image unavailable
      </span>
    );
  }

  return (
    <img
      className={className}
      src={source}
      alt={alt}
      loading={loading}
      onError={() => setFailedSource(source)}
    />
  );
}

export default ProductImage;
