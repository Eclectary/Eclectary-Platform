export interface Product {
	id: number;
	name?: string;
	slug?: string;
	title: string;
	description?: string;
	price: number;
	active: boolean;
	image?: string | null;
	images?: string[];
	collection?: 'custom-printing' | 'purely-handmade' | 'digital-creations';
	category?: string;
	category_id?: number;
	category_name?: string;
	subcategory?: string;
	intentions?: string[];
	seller?: string;
	seller_id?: number;
	creator: string;
	tag?: string;
	rating?: number;
	reviewCount?: number;
	created_at?: string;
	updated_at?: string;
}
