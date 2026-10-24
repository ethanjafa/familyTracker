/** Starter meals so the backlog isn't empty on day one. Tap one to add it with its ingredients. */
export const MEAL_IDEAS: { name: string; icon: string; ingredients: string[] }[] = [
  { name: 'Pasta night', icon: '🍝', ingredients: ['Pasta', 'Tomato sauce', 'Parmesan', 'Garlic'] },
  { name: 'Tacos', icon: '🌮', ingredients: ['Tortillas', 'Minced meat', 'Avocados', 'Salsa', 'Cheese'] },
  { name: 'Curry', icon: '🍛', ingredients: ['Rice', 'Chicken', 'Curry paste', 'Coconut milk', 'Onions'] },
  { name: 'Pizza night', icon: '🍕', ingredients: ['Pizza dough', 'Mozzarella', 'Tomato sauce'] },
  { name: 'Soup', icon: '🍲', ingredients: ['Vegetables', 'Stock', 'Bread'] },
  { name: 'Big salad', icon: '🥗', ingredients: ['Lettuce', 'Tomatoes', 'Cucumber', 'Feta'] },
  { name: 'Stir-fry', icon: '🥘', ingredients: ['Noodles', 'Vegetables', 'Soy sauce', 'Tofu'] },
  { name: 'Salmon & rice', icon: '🐟', ingredients: ['Salmon', 'Rice', 'Lemon', 'Broccoli'] },
  { name: 'Omelette', icon: '🍳', ingredients: ['Eggs', 'Cheese', 'Spinach'] },
  { name: 'Burgers', icon: '🍔', ingredients: ['Burger buns', 'Patties', 'Lettuce', 'Tomatoes'] },
];

export const MEAL_ICONS = [
  '🍽️', '🍝', '🌮', '🍛', '🍕', '🍲', '🥗', '🥘', '🐟', '🍳', '🍔', '🍜',
  '🍣', '🌯', '🥪', '🍗', '🥩', '🥞', '🍱', '🥟', '🫕', '🍚', '🥙', '🍰',
] as const;
