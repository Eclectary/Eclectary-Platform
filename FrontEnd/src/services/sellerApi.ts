import { sellers } from '../data/sellers';
import type { Seller } from '../types';
import api from './api';

interface PublicSeller {
	id: number;
	name: string;
	image: string | null;
	specialty: string | null;
	bio: string | null;
}

function toSeller(seller: PublicSeller): Seller {
	return {
		id: seller.id,
		name: seller.name,
		image: seller.image || '/favicon.svg',
		specialty: seller.specialty ?? '',
		bio: seller.bio ?? '',
	};
}

export async function getPublicSellers(): Promise<Seller[]> {
	const response = await api.get<{ data: PublicSeller[] }>('/sellers');
	return response.data.data.map(toSeller);
}

export async function getPublicSellerById(id: string): Promise<Seller> {
	const response = await api.get<{ data: PublicSeller }>(`/sellers/${encodeURIComponent(id)}`);
	return toSeller(response.data.data);
}

export function getSellers(): Seller[] {
	return sellers;
}

export function getSellerById(id: string): Seller | undefined {
	return sellers.find((seller) => String(seller.id) === id);
}

export function getSellersByCategory(categoryId: string): Seller[] {
	return sellers.filter((seller) => seller.categories?.includes(categoryId));
}
