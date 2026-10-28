/**
 * Icons are picked automatically from a name, so nobody has to choose one.
 * The first rule whose keyword appears in the name wins; otherwise a stable pick from a pool.
 */

type Rule = [icon: string, keywords: string[]];

const CATEGORY_RULES: Rule[] = [
  ['⛵', ['planning', 'plan the week']],
  ['🧹', ['clean', 'tidy', 'house', 'home', 'chore', 'vacuum', 'dust', 'mop']],
  ['🍽️', ['kitchen', 'dish', 'cook', 'meal', 'food', 'dinner', 'lunch', 'breakfast']],
  ['🧺', ['laundry', 'wash', 'clothes', 'iron']],
  ['🗑️', ['trash', 'garbage', 'bin', 'recycl']],
  ['👶', ['baby', 'nappy', 'diaper', 'toddler']],
  ['🧒', ['kid', 'child', 'school run', 'pickup', 'pick up']],
  ['🎒', ['school', 'homework', 'study', 'class']],
  ['🐶', ['dog', 'puppy', 'walk the']],
  ['🐱', ['cat', 'litter']],
  ['🐾', ['pet', 'vet', 'animal', 'fish tank']],
  ['🌿', ['garden', 'plant', 'lawn', 'yard', 'weed', 'flower']],
  ['🚗', ['car', 'drive', 'garage', 'vehicle', 'fuel', 'gas']],
  ['💰', ['money', 'bill', 'budget', 'finance', 'bank', 'pay', 'saving']],
  ['📄', ['paper', 'tax', 'admin', 'document', 'form', 'insurance', 'letter']],
  ['🛠️', ['repair', 'fix', 'diy', 'renovat', 'maintenance', 'tool', 'build']],
  ['🛒', ['shop', 'grocer', 'buy', 'errand', 'store']],
  ['💪', ['fitness', 'gym', 'workout', 'exercise', 'strength', 'sport']],
  ['🏃', ['run', 'jog', 'walk', 'steps', 'cardio']],
  ['🧘', ['yoga', 'meditat', 'mindful', 'calm', 'stretch', 'breath']],
  ['❤️', ['health', 'doctor', 'medic', 'pill', 'dentist', 'self care', 'self-care']],
  ['💧', ['water', 'drink', 'hydrat']],
  ['🥗', ['diet', 'nutrition', 'eat', 'vegetable', 'fruit']],
  ['💤', ['sleep', 'bed', 'rest', 'nap']],
  ['📚', ['read', 'book', 'learn', 'library']],
  ['🧠', ['brain', 'skill', 'course', 'language', 'practice']],
  ['💼', ['work', 'job', 'office', 'career', 'project']],
  ['💻', ['computer', 'email', 'tech', 'code', 'online']],
  ['📞', ['call', 'phone', 'family time', 'parents', 'grandparent']],
  ['🎉', ['party', 'birthday', 'celebrat', 'event', 'gift']],
  ['✈️', ['travel', 'trip', 'holiday', 'vacation', 'flight', 'pack']],
  ['🎨', ['art', 'craft', 'draw', 'paint', 'creative', 'hobby']],
  ['🎵', ['music', 'piano', 'guitar', 'sing', 'instrument']],
  ['🙏', ['pray', 'faith', 'church', 'mosque', 'temple', 'gratitude']],
  ['💑', ['date', 'couple', 'partner', 'relationship', 'love']],
  ['👨‍👩‍👧', ['family', 'together', 'household']],
];

const MEAL_RULES: Rule[] = [
  ['🍝', ['pasta', 'spaghetti', 'lasagn', 'penne', 'mac and cheese', 'bolognese']],
  ['🌮', ['taco', 'fajita', 'nacho', 'mexican']],
  ['🌯', ['burrito', 'wrap', 'kebab', 'shawarma', 'falafel']],
  ['🍛', ['curry', 'dal', 'masala', 'tikka', 'biryani']],
  ['🍕', ['pizza', 'flatbread']],
  ['🍲', ['soup', 'stew', 'chili', 'chowder', 'broth']],
  ['🥗', ['salad', 'bowl', 'poke']],
  ['🍜', ['noodle', 'ramen', 'pho', 'udon', 'pad thai']],
  ['🍣', ['sushi', 'sashimi']],
  ['🥘', ['stir fry', 'stir-fry', 'paella', 'casserole', 'tagine', 'wok']],
  ['🐟', ['fish', 'salmon', 'tuna', 'cod', 'shrimp', 'prawn', 'seafood']],
  ['🍗', ['chicken', 'wings', 'turkey', 'drumstick']],
  ['🥩', ['steak', 'beef', 'lamb', 'pork', 'chop', 'roast', 'bbq', 'barbecue']],
  ['🍔', ['burger', 'hot dog', 'slider']],
  ['🍳', ['egg', 'omelette', 'omelet', 'frittata', 'shakshuka', 'breakfast']],
  ['🥞', ['pancake', 'waffle', 'crepe', 'french toast']],
  ['🥪', ['sandwich', 'toast', 'panini', 'bagel', 'sub']],
  ['🥟', ['dumpling', 'gyoza', 'ravioli', 'pierogi']],
  ['🍚', ['rice', 'risotto', 'pilaf', 'fried rice']],
  ['🥙', ['pita', 'gyro', 'hummus', 'mezze']],
  ['🍱', ['bento', 'leftover', 'meal prep', 'lunchbox']],
  ['🫕', ['fondue', 'hot pot', 'hotpot']],
  ['🥔', ['potato', 'fries', 'mash', 'jacket']],
  ['🍰', ['cake', 'dessert', 'pie', 'cookie', 'brownie']],
];

const CATEGORY_POOL = ['✅', '⭐', '📌', '🎯', '🔖', '🧩', '🌟', '📋'];
const MEAL_POOL = ['🍽️', '🍲', '🥘', '🍛', '🥗', '🍝'];

function pick(name: string, rules: Rule[], pool: string[]) {
  const n = name.toLowerCase();
  const rule = rules.find(([, keywords]) => keywords.some((k) => n.includes(k)));
  if (rule) return rule[0];
  // Same name → same icon, so it doesn't change every time you edit.
  let hash = 0;
  for (let i = 0; i < n.length; i++) hash = (hash * 31 + n.charCodeAt(i)) >>> 0;
  return pool[hash % pool.length];
}

/** An icon for a routine or to-do category, from its name. */
export const categoryIcon = (name: string) => pick(name, CATEGORY_RULES, CATEGORY_POOL);

/** An icon for a meal, from its name. */
export const mealIcon = (name: string) => pick(name, MEAL_RULES, MEAL_POOL);
