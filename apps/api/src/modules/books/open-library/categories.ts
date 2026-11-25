/**
 * The catalog's curated subjects. Open Library tags are noisy (hundreds per work, mixed casing,
 * "nyt:…" lists), so a book's `subjects` is the set of these labels whose aliases match its tags.
 * `query` is the Open Library subject used to fetch popular books for the category.
 */
export interface Category {
  label: string;
  query: string;
  aliases: string[];
}

export const CATEGORIES: readonly Category[] = [
  {
    label: 'fantasy',
    query: 'fantasy',
    aliases: ['fantasy', 'fantasy fiction', 'epic fantasy', 'high fantasy'],
  },
  {
    label: 'science fiction',
    query: 'science fiction',
    aliases: ['science fiction', 'sci-fi', 'space opera'],
  },
  {
    label: 'mystery',
    query: 'mystery',
    aliases: [
      'mystery',
      'mystery fiction',
      'detective and mystery stories',
      'detective stories',
    ],
  },
  {
    label: 'thriller',
    query: 'thriller',
    aliases: ['thriller', 'thrillers', 'suspense', 'suspense fiction'],
  },
  {
    label: 'crime',
    query: 'crime',
    aliases: ['crime', 'crime fiction', 'murder'],
  },
  {
    label: 'romance',
    query: 'romance',
    aliases: ['romance', 'love stories', 'romance fiction'],
  },
  {
    label: 'historical fiction',
    query: 'historical fiction',
    aliases: ['historical fiction'],
  },
  {
    label: 'horror',
    query: 'horror',
    aliases: ['horror', 'horror fiction', 'horror stories'],
  },
  {
    label: 'adventure',
    query: 'adventure',
    aliases: [
      'adventure',
      'adventure stories',
      'adventure and adventurers',
      'action & adventure',
    ],
  },
  {
    label: 'dystopia',
    query: 'dystopias',
    aliases: ['dystopias', 'dystopia', 'dystopian'],
  },
  {
    label: 'young adult',
    query: 'young adult fiction',
    aliases: ['young adult fiction', 'young adult', 'teen fiction'],
  },
  {
    label: 'children',
    query: 'juvenile fiction',
    aliases: ['juvenile fiction', "children's fiction", "children's stories"],
  },
  {
    label: 'classics',
    query: 'classic literature',
    aliases: ['classic literature', 'classics', 'classic fiction'],
  },
  {
    label: 'literary fiction',
    query: 'literary fiction',
    aliases: ['literary fiction', 'literature'],
  },
  {
    label: 'short stories',
    query: 'short stories',
    aliases: ['short stories', 'short story'],
  },
  { label: 'poetry', query: 'poetry', aliases: ['poetry', 'poems'] },
  { label: 'drama', query: 'drama', aliases: ['drama', 'plays', 'tragedies'] },
  {
    label: 'humor',
    query: 'humor',
    aliases: ['humor', 'humour', 'humorous fiction', 'humorous stories'],
  },
  {
    label: 'graphic novels',
    query: 'graphic novels',
    aliases: [
      'graphic novels',
      'comics',
      'comic books, strips, etc.',
      'comics & graphic novels',
    ],
  },
  {
    label: 'biography',
    query: 'biography',
    aliases: ['biography', 'autobiography', 'memoir', 'memoirs', 'biographies'],
  },
  {
    label: 'history',
    query: 'history',
    aliases: ['history', 'world history', 'military history'],
  },
  {
    label: 'war',
    query: 'war',
    aliases: ['war', 'war stories', 'world war, 1939-1945'],
  },
  {
    label: 'science',
    query: 'science',
    aliases: ['science', 'popular science', 'physics', 'biology', 'astronomy'],
  },
  { label: 'philosophy', query: 'philosophy', aliases: ['philosophy'] },
  { label: 'psychology', query: 'psychology', aliases: ['psychology'] },
  {
    label: 'self-help',
    query: 'self-help',
    aliases: [
      'self-help',
      'self-help techniques',
      'personal development',
      'success',
    ],
  },
  {
    label: 'business',
    query: 'business',
    aliases: ['business', 'management', 'economics', 'entrepreneurship'],
  },
  {
    label: 'politics',
    query: 'politics',
    aliases: ['politics', 'political science', 'politics and government'],
  },
  {
    label: 'religion',
    query: 'religion',
    aliases: ['religion', 'spirituality', 'theology'],
  },
  {
    label: 'travel',
    query: 'travel',
    aliases: ['travel', 'voyages and travels', 'description and travel'],
  },
  {
    label: 'cooking',
    query: 'cooking',
    aliases: ['cooking', 'cookbooks', 'cookery'],
  },
  {
    label: 'programming',
    query: 'computer programming',
    aliases: [
      'computer programming',
      'programming',
      'software engineering',
      'computer science',
    ],
  },
];
