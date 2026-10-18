import api from './api';
import { categories as categoryMetadata } from '../data/categories';
import type { Category } from '../types/category';

interface ApiCategory {
  id: number;
  name: string;
  slug: string;
}

interface CategoriesResponse {
  data: ApiCategory[];
}

export async function getCategories(): Promise<Category[]> {
  const response = await api.get<CategoriesResponse>('/categories');
  const metadataBySlug = new Map(categoryMetadata.map((category) => [category.id, category]));
  const seenIds = new Set<number>();
  const seenSlugs = new Set<string>();

  return response.data.data.reduce<Category[]>((mergedCategories, apiCategory) => {
    if (seenIds.has(apiCategory.id) || seenSlugs.has(apiCategory.slug)) {
      return mergedCategories;
    }

    seenIds.add(apiCategory.id);
    seenSlugs.add(apiCategory.slug);
    const metadata = metadataBySlug.get(apiCategory.slug);

    mergedCategories.push({
      ...metadata,
      id: apiCategory.slug,
      apiId: apiCategory.id,
      slug: apiCategory.slug,
      name: metadata?.name ?? apiCategory.name,
    });

    return mergedCategories;
  }, []);
}
