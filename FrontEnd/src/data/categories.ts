import type { Category, Product } from '../types';

export const categories: Category[] = [
	{ id: 'jewelry-adornments', collection: 'purely-handmade', name: 'Jewelry & Adornments', childSubcategories: ['Necklaces', 'Bracelets', 'Earrings', 'Rings', 'Pendants', 'Talismans & Amulets', 'Mala Beads', 'Hair Adornments', 'Brooches & Pins', 'Custom Jewelry'], image: 'https://images.unsplash.com/photo-1532968961962-8a0cb3a2d0c7?auto=format&fit=crop&w=900&q=80' },
	{ id: 'divination', collection: 'purely-handmade', name: 'Divination', childSubcategories: ['Handmade Tarot Decks', 'Handmade Oracle Decks', 'Handmade Rune Sets', 'Handmade Ogham Sets', 'Pendulums', 'Pendulum Boards', 'Scrying Tools', 'Scrying Mirrors', 'Divination Boards', 'Spirit Boards', 'Divination Dice & Tools', 'Tarot & Oracle Bags', 'Tarot & Oracle Cloths', 'Divination Accessories', 'Custom Divination Tools'], image: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=900&q=80' },
	{ id: 'witchcraft-spellcraft', collection: 'purely-handmade', name: 'Witchcraft & Spellcraft', childSubcategories: ['Spell Jars', 'Spell Bottles', 'Charm Bags', 'Spell Kits', 'Wands', 'Besoms & Ritual Brooms', 'Sigil Crafts', 'Magical Tools', 'Ritual Kits', 'Other Spellcraft'], image: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80' },
	{ id: 'altar-sacred-goods', collection: 'purely-handmade', name: 'Altar & Sacred Goods', childSubcategories: ['Altar Cloths', 'Offering Bowls', 'Offering Trays', 'Candle Holders', 'Incense Holders', 'Altar Tiles', 'Crystal Grids', 'Shrine Décor', 'Sacred Displays', 'Ritual Containers'], image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=900&q=80' },
	{ id: 'candles-wax', collection: 'purely-handmade', name: 'Candles & Wax', childSubcategories: ['Ritual Candles', 'Intention Candles', 'Spell Candles', 'Sculpted Candles', 'Carved Candles', 'Container Candles', 'Wax Melts', 'Candle Sets', 'Other Wax Creations'], image: 'https://images.unsplash.com/photo-1602872029706-5f3b8d5d7c4f?auto=format&fit=crop&w=900&q=80' },
	{ id: 'incense-aromatics', collection: 'purely-handmade', name: 'Incense & Aromatics', childSubcategories: ['Handmade Incense', 'Incense Cones', 'Loose Incense', 'Cleansing Blends', 'Ritual Sprays', 'Room Sprays', 'Scent Blends', 'Other Handmade Aromatics'], image: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=900&q=80' },
	{ id: 'herbs-botanicals', collection: 'purely-handmade', name: 'Herbs & Botanicals', childSubcategories: ['Herbal Blends', 'Botanical Blends', 'Herbal Sachets', 'Ritual Salts', 'Botanical Crafts', 'Herb Bundles', 'Herbal Spell Blends', 'Other Botanical Creations'], image: 'https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=900&q=80' },
	{ id: 'oils-perfume-blends', collection: 'purely-handmade', name: 'Oils, Perfume & Blends', childSubcategories: ['Ritual Oils', 'Intention Oils', 'Anointing Oils', 'Perfume Oils', 'Botanical Perfumes', 'Aromatherapy Blends', 'Other Handmade Blends'], image: 'https://images.unsplash.com/photo-1608571423539-e951a1f2b625?auto=format&fit=crop&w=900&q=80' },
	{ id: 'bath-body', collection: 'purely-handmade', name: 'Bath & Body', childSubcategories: ['Handmade Soap', 'Bath Bombs', 'Bath Salts', 'Body Oils', 'Body Butters', 'Scrubs', 'Herbal Baths', 'Ritual Bath Blends', 'Other Handmade Body Products'], image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=80' },
	{ id: 'fiber-arts-textiles', collection: 'purely-handmade', name: 'Fiber Arts & Textiles', childSubcategories: ['Embroidery', 'Cross-Stitch', 'Crochet', 'Knitting', 'Weaving', 'Macramé', 'Sewing', 'Quilting', 'Tarot Bags', 'Rune Bags', 'Altar Cloths', 'Tapestries', 'Textile Wearables', 'Other Fiber Arts'], image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80' },
	{ id: 'wood-natural-materials', collection: 'purely-handmade', name: 'Wood & Natural Materials', childSubcategories: ['Wood Carvings', 'Wooden Wands', 'Carved Runes', 'Ritual Boards', 'Carved Boxes', 'Driftwood Art', 'Bone Crafts', 'Antler Crafts', 'Natural Material Creations', 'Other Wood & Natural Crafts'], image: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=900&q=80' },
	{ id: 'ceramics-clay', collection: 'purely-handmade', name: 'Ceramics & Clay', childSubcategories: ['Altar Bowls', 'Offering Bowls', 'Incense Burners', 'Candle Holders', 'Ritual Vessels', 'Figurines', 'Sculptures', 'Handmade Tiles', 'Clay Jewelry', 'Other Ceramic & Clay Creations'], image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=80' },
	{ id: 'resin-glass-mixed-media', collection: 'purely-handmade', name: 'Resin, Glass & Mixed Media', childSubcategories: ['Resin Art', 'Resin Jewelry', 'Glass Art', 'Stained Glass', 'Crystal Resin Creations', 'Encased Botanicals', 'Mixed Media', 'Sculptural Creations', 'Other Mixed Media'], image: 'https://images.unsplash.com/photo-1512618834900-8ceac1f4d5f9?auto=format&fit=crop&w=900&q=80' },
	{ id: 'handmade-art', collection: 'purely-handmade', name: 'Handmade Art', childSubcategories: ['Paintings', 'Drawings', 'Watercolor', 'Illustration', 'Mixed Media Art', 'Folk Art', 'Occult Art', 'Spiritual Art', 'Nature Art', 'Sculpture', 'Other Handmade Art'], image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=900&q=80' },
	{ id: 'handmade-books-journals', collection: 'purely-handmade', name: 'Handmade Books & Journals', childSubcategories: ['Grimoires', 'Books of Shadows', 'Handbound Books', 'Spell Books', 'Journals', 'Notebooks', 'Sketchbooks', 'Art Journals', 'Other Handmade Books'], image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=80' },
	{ id: 'clothing-wearables', collection: 'purely-handmade', name: 'Clothing & Wearables', childSubcategories: ['Handmade Clothing', 'Cloaks & Robes', 'Ritual Wear', 'Embellished Clothing', 'Handmade Hats', 'Shawls', 'Scarves', 'Belts', 'Textile Accessories', 'Other Handmade Wearables'], image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80' },
	{ id: 'home-decor', collection: 'purely-handmade', name: 'Home & Décor', childSubcategories: ['Wall Décor', 'Suncatchers', 'Mobiles', 'Dreamcatchers', 'Decorative Boxes', 'Mirrors', 'Handmade Frames', 'Figurines', 'Seasonal Décor', 'Nature-Inspired Décor', 'Other Handmade Décor'], image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=900&q=80' },
	{ id: 'crystals-gemstone-creations', collection: 'purely-handmade', name: 'Crystals & Gemstone Creations', childSubcategories: ['Crystal Carvings', 'Crystal Wirework', 'Crystal Grids', 'Crystal Sculptures', 'Crystal Displays', 'Crystal Suncatchers', 'Crystal Wands', 'Gemstone Crafts', 'Crystal & Resin Art', 'Other Gemstone Creations'], image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=80' },
	{ id: 'handmade-gifts-sets', collection: 'purely-handmade', name: 'Handmade Gifts & Sets', childSubcategories: ['Ritual Gift Sets', 'Crystal & Jewelry Sets', 'Self-Care Sets', 'Witchy Gift Sets', 'Seasonal Sets', 'Handmade Bundles', 'Gift Boxes', 'Other Handmade Gift Sets'], image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80' },
	{ id: 'custom-personalized-handmade', collection: 'purely-handmade', name: 'Custom & Personalized Handmade', childSubcategories: ['Custom Jewelry', 'Custom Artwork', 'Custom Embroidery', 'Personalized Journals', 'Custom Altar Pieces', 'Custom Ritual Items', 'Custom Woodwork', 'Custom Fiber Art', 'Custom Keepsakes', 'Other Custom Handmade'], image: 'https://images.unsplash.com/photo-1532968961962-8a0cb3a2d0c7?auto=format&fit=crop&w=900&q=80' },
	{
		id: 'digital-art',
		collection: 'digital-creations',
		name: 'Digital Art',
		childSubcategories: ['Digital Illustrations', 'Digital Paintings', 'Digital Drawings', 'Printable Art', 'Coloring Pages', 'Digital Collage', 'Digital Portraits', 'Digital Wall Art', 'Digital Wallpapers', 'Other Digital Art'],
		image: 'https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'grimoires-spiritual-journaling',
		collection: 'digital-creations',
		name: 'Grimoires & Spiritual Journaling',
		childSubcategories: ['Digital Grimoires', 'Book of Shadows', 'Digital Spell Books', 'Ritual Journals', 'Moon Journals', 'Shadow Work Journals', 'Spiritual Journals', 'Meditation Journals', 'Reflection Journals', 'Digital Journal Pages', 'Other Spiritual Journaling'],
		image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'tarot-oracle-divination',
		collection: 'digital-creations',
		name: 'Tarot, Oracle & Divination',
		childSubcategories: ['Digital Tarot Decks', 'Digital Oracle Decks', 'Tarot Spreads', 'Tarot Journals', 'Tarot Guides', 'Oracle Guides', 'Rune Resources', 'Ogham Resources', 'Pendulum Resources', 'Scrying Resources', 'Divination Worksheets', 'Divination Guides', 'Other Digital Divination'],
		image: 'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'witchcraft-ritual',
		collection: 'digital-creations',
		name: 'Witchcraft & Ritual',
		childSubcategories: ['Digital Spell Guides', 'Ritual Guides', 'Spell Correspondence Charts', 'Magical Correspondence Guides', 'Ritual Templates', 'Sabbat Resources', 'Seasonal Ritual Resources', 'Moon Magic Resources', 'Sigil Resources', 'Protection Resources', 'Cleansing Resources', 'Witchcraft Workbooks', 'Other Witchcraft Resources'],
		image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'astrology',
		collection: 'digital-creations',
		name: 'Astrology',
		childSubcategories: ['Astrology Guides', 'Birth Chart Resources', 'Zodiac Resources', 'Lunar Resources', 'Moon Phase Resources', 'Planetary Resources', 'Astrology Worksheets', 'Astrology Journals', 'Astrology Planners', 'Other Astrology Resources'],
		image: 'https://images.unsplash.com/photo-1534791547706-6c7e3f8f6845?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'patterns-craft-designs',
		collection: 'digital-creations',
		name: 'Patterns & Craft Designs',
		childSubcategories: ['Cross-Stitch Patterns', 'Embroidery Patterns', 'Crochet Patterns', 'Knitting Patterns', 'Sewing Patterns', 'Quilting Patterns', 'Beading Patterns', 'Jewelry Patterns', 'SVG Files', 'Laser-Cutting Files', 'Craft Templates', 'Other Digital Craft Patterns'],
		image: 'https://images.unsplash.com/photo-1452860606245-08bea0c7f9c7?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'planners-organization',
		collection: 'digital-creations',
		name: 'Planners & Organization',
		childSubcategories: ['Digital Planners', 'Spiritual Planners', 'Witchcraft Planners', 'Moon Trackers', 'Tarot Trackers', 'Crystal Trackers', 'Habit Trackers', 'Journaling Templates', 'Calendars', 'Digital Checklists', 'Other Digital Organization'],
		image: 'https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'ebooks-guides-education',
		collection: 'digital-creations',
		name: 'E-books, Guides & Education',
		childSubcategories: ['E-books', 'Digital Books', 'Educational Guides', 'Workbooks', 'Tutorials', 'Beginner Guides', 'Reference Guides', 'Spiritual Education', 'Witchcraft Education', 'Astrology Education', 'Divination Education', 'Other Educational Resources'],
		image: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'digital-design-assets',
		collection: 'digital-creations',
		name: 'Digital Design Assets',
		childSubcategories: ['Clipart', 'Graphics', 'Fonts', 'Digital Papers', 'Textures', 'Brushes', 'Design Elements', 'Templates', 'Social Media Assets', 'Branding Assets', 'Other Design Assets'],
		image: 'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'printable-resources',
		collection: 'digital-creations',
		name: 'Printable Resources',
		childSubcategories: ['Printable Worksheets', 'Printable Journals', 'Printable Planners', 'Printable Cards', 'Printable Divination Resources', 'Printable Ritual Resources', 'Printable Wall Art', 'Printable Coloring Pages', 'Printable Stationery', 'Printable Bookmarks', 'Other Printables'],
		image: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'spiritual-metaphysical-resources',
		collection: 'digital-creations',
		name: 'Spiritual & Metaphysical Resources',
		childSubcategories: ['Crystal Guides', 'Herbal Resources', 'Energy Work Resources', 'Meditation Resources', 'Spiritual Practice Guides', 'Chakra Resources', 'Sacred Symbol Resources', 'Nature Spirituality Resources', 'Pagan Resources', 'Metaphysical Guides', 'Other Spiritual Resources'],
		image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'digital-templates',
		collection: 'digital-creations',
		name: 'Digital Templates',
		childSubcategories: ['Journal Templates', 'Grimoire Templates', 'Book of Shadows Templates', 'Tarot Templates', 'Oracle Templates', 'Ritual Templates', 'Planner Templates', 'Business Templates', 'Social Media Templates', 'Artist Templates', 'Other Digital Templates'],
		image: 'https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'custom-digital-creations',
		collection: 'digital-creations',
		name: 'Custom Digital Creations',
		childSubcategories: ['Custom Digital Artwork', 'Custom Illustrations', 'Custom Digital Portraits', 'Custom Printable Designs', 'Custom Digital Invitations', 'Custom Graphics', 'Custom Templates', 'Custom Design Work', 'Other Custom Digital Creations'],
		image: 'https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'custom-apparel',
		collection: 'custom-printing',
		name: 'Apparel & Wearables',
		childSubcategories: ['T-Shirts', 'Long-Sleeve Shirts', 'Hoodies', 'Sweatshirts', 'Tank Tops', 'Dresses', 'Skirts', 'Leggings', 'Jackets', 'Hats & Caps', 'Socks', 'Aprons', 'Other Printed Apparel'],
		image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'custom-jewelry-accessories',
		collection: 'custom-printing',
		name: 'Jewelry & Accessories',
		childSubcategories: ['Printed Jewelry', 'Printed Pendants', 'Pins & Brooches', 'Keychains', 'Bag Charms', 'Hair Accessories', 'Accessories', 'Other Printed Accessories'],
		image: 'https://images.unsplash.com/photo-1532968961962-8a0cb3a2d0c7?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'custom-art-prints-wall-decor',
		collection: 'custom-printing',
		name: 'Art Prints & Wall Décor',
		childSubcategories: ['Art Prints', 'Posters', 'Canvas Prints', 'Framed Prints', 'Metal Prints', 'Wood Prints', 'Wall Hangings', 'Tapestry Prints', 'Decorative Panels', 'Other Printed Wall Décor'],
		image: 'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'custom-stickers-decals',
		collection: 'custom-printing',
		name: 'Stickers & Decals',
		childSubcategories: ['Stickers', 'Sticker Sheets', 'Vinyl Stickers', 'Die-Cut Stickers', 'Holographic Stickers', 'Decals', 'Window Decals', 'Labels', 'Other Printed Stickers'],
		image: 'https://images.unsplash.com/photo-1614036417651-efe5912149d8?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'custom-stationery-paper-goods',
		collection: 'custom-printing',
		name: 'Stationery & Paper Goods',
		childSubcategories: ['Journals', 'Notebooks', 'Notepads', 'Greeting Cards', 'Postcards', 'Bookmarks', 'Calendars', 'Planners', 'Letter Sets', 'Art Cards', 'Other Printed Paper Goods'],
		image: 'https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'custom-books-publications',
		collection: 'custom-printing',
		name: 'Books & Printed Publications',
		childSubcategories: ['Printed Books', 'Zines', 'Journals', 'Workbooks', 'Guided Journals', 'Grimoires', 'Books of Shadows', 'Spell Books', 'Coloring Books', 'Activity Books', 'Other Printed Publications'],
		image: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'custom-home-living',
		collection: 'custom-printing',
		name: 'Home & Living',
		childSubcategories: ['Mugs', 'Tumblers', 'Drinkware', 'Coasters', 'Pillows', 'Blankets', 'Kitchen Towels', 'Kitchen Accessories', 'Home Accessories', 'Decorative Items', 'Other Printed Home Goods'],
		image: 'https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'custom-bags-carriers',
		collection: 'custom-printing',
		name: 'Bags & Carriers',
		childSubcategories: ['Tote Bags', 'Handbags', 'Backpacks', 'Pouches', 'Cosmetic Bags', 'Drawstring Bags', 'Messenger Bags', 'Other Printed Bags'],
		image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'custom-phone-tech-accessories',
		collection: 'custom-printing',
		name: 'Phone & Tech Accessories',
		childSubcategories: ['Phone Cases', 'Tablet Cases', 'Laptop Cases', 'Laptop Sleeves', 'Mouse Pads', 'Tech Accessories', 'Device Skins', 'Other Printed Tech Accessories'],
		image: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'custom-spiritual-ritual-printing',
		collection: 'custom-printing',
		name: 'Spiritual & Ritual Printing',
		childSubcategories: ['Printed Tarot Products', 'Printed Oracle Products', 'Tarot Cloths', 'Tarot Bags', 'Printed Rune Resources', 'Altar Prints', 'Ritual Journals', 'Moon Calendars', 'Zodiac Products', 'Spiritual Journals', 'Grimoire Products', 'Book of Shadows Products', 'Ritual Cards', 'Other Spiritual Printed Products'],
		image: 'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'custom-artist-creator-merchandise',
		collection: 'custom-printing',
		name: 'Artist & Creator Merchandise',
		childSubcategories: ['Artist Apparel', 'Artist Prints', 'Artist Stickers', 'Artist Stationery', 'Artist Accessories', 'Creator Merchandise', 'Brand Merchandise', 'Collection Merchandise', 'Limited Edition Products', 'Other Artist Merchandise'],
		image: 'https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'custom-personalized-gifts',
		collection: 'custom-printing',
		name: 'Personalized Gifts',
		childSubcategories: ['Personalized Apparel', 'Personalized Mugs', 'Personalized Wall Art', 'Personalized Journals', 'Personalized Stationery', 'Personalized Bags', 'Personalized Home Goods', 'Personalized Accessories', 'Photo Gifts', 'Name & Initial Products', 'Other Personalized Gifts'],
		image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'custom-invitations-event-goods',
		collection: 'custom-printing',
		name: 'Invitations & Event Goods',
		childSubcategories: ['Invitations', 'Wedding Invitations', 'Event Invitations', 'Party Invitations', 'Thank You Cards', 'Event Signage', 'Place Cards', 'Menus', 'Ceremony Programs', 'Event Decorations', 'Other Printed Event Goods'],
		image: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'custom-seasonal-holiday-printing',
		collection: 'custom-printing',
		name: 'Seasonal & Holiday Printing',
		childSubcategories: ['Halloween', 'Samhain', 'Yule', 'Christmas', 'Imbolc', 'Ostara', 'Beltane', 'Litha', 'Lughnasadh', 'Mabon', "Valentine's Day", 'Birthdays', 'Seasonal Décor', 'Other Seasonal Products'],
		image: 'https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'custom-printing',
		collection: 'custom-printing',
		name: 'Custom Printing',
		childSubcategories: ['Custom Apparel', 'Custom Artwork', 'Custom Stationery', 'Custom Home Goods', 'Custom Accessories', 'Custom Merchandise', 'Custom Printed Gifts', 'Customer-Supplied Artwork', 'Other Custom Printing'],
		image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
	},
];

export const legacyHandmadeCategoryMap: Record<string, string> = {
	'ritual-witchcraft': 'candles-wax', 'crystals-natural-goods': 'herbs-botanicals',
	'jewelry-adornment': 'jewelry-adornments', 'tarot-divination': 'divination',
	'home-altar': 'ceramics-clay', 'bath-body-wellness': 'bath-body',
	'art-fiber': 'fiber-arts-textiles', 'clothing-accessories': 'clothing-wearables',
	'stationery-paper': 'handmade-books-journals', 'gifts-seasonal': 'handmade-gifts-sets',
};

export const legacyDigitalCategoryMap: Record<string, string> = {
	'craft-patterns': 'patterns-craft-designs',
	'digital-spiritual-witchcraft': 'grimoires-spiritual-journaling',
	'digital-tarot-divination': 'tarot-oracle-divination',
	'digital-journals-planners': 'planners-organization',
	'astrology-mysticism': 'astrology',
	'digital-printables': 'printable-resources',
	'digital-books-learning': 'ebooks-guides-education',
};

export const legacyCustomPrintingCategoryMap: Record<string, string> = {
	'custom-apparel': 'custom-apparel',
	'custom-home-living': 'custom-home-living',
	'custom-wall-art': 'custom-art-prints-wall-decor',
	'custom-accessories': 'custom-jewelry-accessories',
	'custom-stationery': 'custom-stationery-paper-goods',
	'custom-gifts': 'custom-personalized-gifts',
};

export const handmadeCategories = categories.filter((category) => category.collection === 'purely-handmade');
export const digitalCategories = categories.filter((category) => category.collection === 'digital-creations');
export const customPrintingCategories = categories.filter((category) => category.collection === 'custom-printing');
export const getCategory = (id: string) => categories.find((category) => category.id === id);
export const isValidCategorySelection = (collection: string, categoryId: string, subcategory: string) => {
	const category = getCategory(categoryId);
	return category?.collection === collection && Boolean(category.childSubcategories?.includes(subcategory));
};

export const getProductCollection = (
	product: Pick<Product, 'category' | 'category_id'>,
	categories: Category[],
): Product['collection'] | undefined => {
	const category = categories.find(
		(item) => item.apiId !== undefined && item.apiId === product.category_id,
	) ?? categories.find(
		(item) => item.slug === product.category || item.id === product.category,
	);

	return category?.collection;
};
