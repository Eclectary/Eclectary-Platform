export interface Category {
  id: string;
  apiId?: number;
  slug?: string;
  name: string;
  image?: string;
  childSubcategories?: string[];
  collection?: 'custom-printing' | 'purely-handmade' | 'digital-creations';
}
