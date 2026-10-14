export interface Product {
	id: number;
	name?: string;
	slug?: string;
	title: string;
	description?: string;
	price: number;
	image?: string;
	images?: string[];
	collection?: 'custom-printing' | 'purely-handmade' | 'digital-creations';
	category?: string;
	subcategory?: string;
	intentions?: string[];
	seller?: string;
	creator: string;
	tag?: string;
	rating?: number;
	reviewCount?: number;
	status?: string;
}
