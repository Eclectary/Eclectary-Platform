import { useCallback, useEffect, useMemo, useState } from "react";

import ProductImage from "./ProductImage";
import { parseApiError } from "../services/apiErrors";
import { getCategories } from "../services/categoryApi";
import type { ProductMutationInput } from "../services/productApi";
import type { Category, Product } from "../types";
import "../styles/product-form.css";

interface ProductFormProps {
  initialProduct?: Product;
  onSubmit: (input: ProductMutationInput) => Promise<void>;
  submitLabel: string;
}

interface FormErrors {
  title?: string;
  price?: string;
  category?: string;
}

function ProductForm({ initialProduct, onSubmit, submitLabel }: ProductFormProps) {
  const [title, setTitle] = useState(initialProduct?.title ?? "");
  const [description, setDescription] = useState(initialProduct?.description ?? "");
  const [price, setPrice] = useState(initialProduct ? String(initialProduct.price) : "");
  const [categoryId, setCategoryId] = useState(initialProduct?.category_id ? String(initialProduct.category_id) : "");
  const [subcategory, setSubcategory] = useState(initialProduct?.subcategory ?? "");
  const [images, setImages] = useState<File[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      setCategories(await getCategories());
    } catch {
      setCategoriesError("We could not load categories. Please try again.");
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void getCategories()
      .then((data) => {
        if (active) setCategories(data);
      })
      .catch(() => {
        if (active) setCategoriesError("We could not load categories. Please try again.");
      })
      .finally(() => {
        if (active) setCategoriesLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((category) => String(category.apiId) === categoryId),
    [categories, categoryId],
  );
  const subcategoryChoices = selectedCategory?.childSubcategories ?? [];

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const nextErrors: FormErrors = {};
    const normalizedTitle = title.trim();
    const numericCategoryId = Number(categoryId);

    if (!normalizedTitle) nextErrors.title = "Enter a product title.";
    if (!price.trim()) {
      nextErrors.price = "Enter a price.";
    } else if (!/^\d+(?:\.\d+)?$/.test(price.trim())) {
      nextErrors.price = "Enter a nonnegative decimal price.";
    }
    if (!Number.isSafeInteger(numericCategoryId) || numericCategoryId <= 0 || !selectedCategory) {
      nextErrors.category = "Choose a valid category.";
    }

    setErrors(nextErrors);
    setServerError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit({
        title: normalizedTitle,
        description: description.trim(),
        price: price.trim(),
        category_id: numericCategoryId,
        subcategory: subcategory.trim(),
        images,
      });
    } catch (error) {
      setServerError(parseApiError(error, "We could not save this product. Please try again.").message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="product-form" onSubmit={submit} noValidate>
      <label>
        <span>Title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={Boolean(errors.title)}
          required
        />
        {errors.title && <span className="product-form__error">{errors.title}</span>}
      </label>

      <label>
        <span>Description <small>(optional)</small></span>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} />
      </label>

      <label>
        <span>Price</span>
        <input
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          aria-invalid={Boolean(errors.price)}
          required
        />
        {errors.price && <span className="product-form__error">{errors.price}</span>}
      </label>

      <label>
        <span>Category</span>
        <select
          value={categoryId}
          onChange={(event) => {
            setCategoryId(event.target.value);
            setSubcategory("");
          }}
          aria-invalid={Boolean(errors.category)}
          disabled={categoriesLoading}
          required
        >
          <option value="">{categoriesLoading ? "Loading categories..." : "Choose a category"}</option>
          {categories.map((category) => (
            <option key={category.apiId} value={category.apiId}>{category.name}</option>
          ))}
        </select>
        {errors.category && <span className="product-form__error">{errors.category}</span>}
      </label>

      {categoriesError && (
        <div className="product-form__error" role="alert">
          <p>{categoriesError}</p>
          <button type="button" onClick={() => void loadCategories()}>Retry categories</button>
        </div>
      )}

      <label>
        <span>Subcategory <small>(optional)</small></span>
        {subcategoryChoices.length > 0 ? (
          <select value={subcategory} onChange={(event) => setSubcategory(event.target.value)}>
            <option value="">No subcategory</option>
            {subcategoryChoices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
          </select>
        ) : (
          <input value={subcategory} onChange={(event) => setSubcategory(event.target.value)} />
        )}
      </label>

      {initialProduct?.images && initialProduct.images.length > 0 && (
        <section className="product-form__existing-images" aria-label="Existing product images">
          <h3>Existing images</h3>
          <div>
            {initialProduct.images.map((image, index) => (
              <ProductImage
                key={image}
                image={image}
                alt={`${initialProduct.title} image ${index + 1}`}
                className="product-form__image"
                fallbackClassName="product-form__image-fallback"
              />
            ))}
          </div>
        </section>
      )}

      <label>
        <span>{initialProduct ? "Add images" : "Images"} <small>(optional)</small></span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(event) => setImages(Array.from(event.target.files ?? []))}
        />
        {images.length > 0 && <span>{images.length} image{images.length === 1 ? "" : "s"} selected</span>}
      </label>

      {serverError && <p className="product-form__error" role="alert">{serverError}</p>}

      <button type="submit" disabled={submitting || categoriesLoading || Boolean(categoriesError)}>
        {submitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}

export default ProductForm;
